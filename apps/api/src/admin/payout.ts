import crypto from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  unpackAccount,
} from "@solana/spl-token";

import { connectToDatabase } from "../db/mongoose";
import { verifySeekerGenesisToken } from "../auth/sgt";
import { getHeliusRpcUrl, getSolanaCluster, SOLANA_GENESIS_HASHES } from "../env";
import { OutbreakSeasonModel, type OutbreakSeason } from "../models/OutbreakSeason";
import { PayoutRunModel } from "../models/PayoutRun";
import { PayoutTransactionModel, type PayoutTransaction, type PayoutTransfer } from "../models/PayoutTransaction";
import { SeekerIdentityModel } from "../models/SeekerIdentity";
import { SkrRewardModel, type SkrReward } from "../models/SkrReward";
import { getCampaignLifecycle } from "../outbreak/campaigns";

const MAX_U64 = 18_446_744_073_709_551_615n;
const MAX_TX_BYTES = 1232;
const MAX_RECIPIENTS_PER_TX = 4;
const GUARD_COLLECTION = "payout_campaign_guards";
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export class PayoutError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "PayoutError";
  }
}

type EligibleReward = SkrReward & { payoutTransactionId?: string | null };
type Recipient = PayoutTransfer & { publicKey: PublicKey; ata: PublicKey; needsAta: boolean };

function publicKey(value: string, label: string) {
  try {
    const key = new PublicKey(value);
    if (key.toBase58() !== value) throw new Error("noncanonical");
    return key;
  } catch {
    throw new PayoutError(`Invalid ${label}.`, 400);
  }
}

function payoutConfiguration() {
  const mintText = process.env.SPORE_SKR_MINT?.trim();
  const treasuryText = process.env.SPORE_SKR_TREASURY_WALLET?.trim();
  if (!mintText || !treasuryText) throw new PayoutError("SKR payout configuration is missing.", 503);
  return { expectedMint: publicKey(mintText, "configured SKR mint"), treasury: publicKey(treasuryText, "configured treasury wallet") };
}

async function payoutConnection() {
  const cluster = getSolanaCluster();
  const connection = new Connection(getHeliusRpcUrl(), "confirmed");
  if (await connection.getGenesisHash() !== SOLANA_GENESIS_HASHES[cluster]) {
    throw new PayoutError("Solana RPC cluster does not match payout configuration.", 503);
  }
  return { connection, cluster };
}

async function payoutCampaign(campaignId: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(campaignId)) throw new PayoutError("Invalid campaign ID.", 400);
  await connectToDatabase();
  const campaign = await OutbreakSeasonModel.findOne({ seasonId: campaignId, skrCampaign: { $exists: true } }).lean();
  if (!campaign) throw new PayoutError("Campaign not found.", 404);
  if (!["ended", "cancelled"].includes(getCampaignLifecycle(campaign))) {
    throw new PayoutError("Payouts open only after the campaign ends or is cancelled.");
  }
  if (!campaign.skrCampaign || !campaign.skrFundedBirths) throw new PayoutError("Campaign reward configuration is incomplete.");
  return campaign;
}

async function chainContext(campaign: OutbreakSeason) {
  const config = campaign.skrCampaign!;
  const { expectedMint, treasury } = payoutConfiguration();
  const mint = publicKey(config.tokenMint, "campaign SKR mint");
  if (!mint.equals(expectedMint)) throw new PayoutError("Campaign mint does not match configured SKR mint.");
  const { connection, cluster } = await payoutConnection();
  const mintInfo = await connection.getAccountInfo(mint, "confirmed");
  if (!mintInfo?.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new PayoutError("V1 payouts require a standard SPL token mint matching the campaign.");
  }
  const mintState = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
  if (!mintState.isInitialized) throw new PayoutError("SKR mint is not initialized.");
  if (mintState.decimals !== config.decimals) throw new PayoutError("On-chain SKR decimals differ from campaign snapshot.");
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, false, TOKEN_PROGRAM_ID);
  const treasuryInfo = await connection.getAccountInfo(treasuryAta, "confirmed");
  let balance = 0n;
  if (treasuryInfo) {
    const account = await getAccount(connection, treasuryAta, "confirmed", TOKEN_PROGRAM_ID);
    if (!account.owner.equals(treasury) || !account.mint.equals(mint) || account.isFrozen) {
      throw new PayoutError("Treasury token account is invalid.");
    }
    balance = account.amount;
  }
  return { connection, cluster, treasury, mint, treasuryAta, balance };
}

async function eligibleRewards(campaignId: string) {
  const [rewards, runs] = await Promise.all([
    SkrRewardModel.find({ campaignId, payoutStatus: { $in: ["pending", "failed"] } }).sort({ _id: 1 }).lean(),
    PayoutRunModel.find({ campaignId }).sort({ createdAt: -1 }).lean(),
  ]);
  const pointers = [...new Set(rewards.map((reward) => reward.payoutTransactionId).filter((id): id is string => !!id))];
  const transactions = await PayoutTransactionModel.find({ _id: { $in: pointers } }).select({ status: 1 }).lean();
  const byId = new Map(transactions.map((transaction) => [transaction._id, transaction.status]));
  const eligible: EligibleReward[] = [];
  let lockedRewards = 0;
  let unpaidTotalAtomic = 0n;
  for (const reward of rewards) {
    if (!/^[1-9][0-9]*$/.test(reward.amountAtomic)) throw new PayoutError("Reward ledger contains an invalid SKR amount.");
    unpaidTotalAtomic += BigInt(reward.amountAtomic);
    const pointer = reward.payoutTransactionId;
    if (!pointer || byId.get(pointer) === "failed") eligible.push(reward);
    else lockedRewards += 1; // Unknown pointers and in-flight transfers fail closed.
  }
  return { eligible, lockedRewards, runs, unpaidTotalAtomic };
}

async function assertRewardLedger(campaign: OutbreakSeason) {
  const config = campaign.skrCampaign!;
  const rewards = await SkrRewardModel.find({ campaignId: campaign.seasonId })
    .select({ childSgtMint: 1, role: 1, amountAtomic: 1, tokenMint: 1, decimals: 1 }).lean();
  const births = new Map<string, number>();
  let total = 0n;
  for (const reward of rewards) {
    const expected = reward.role === "parent" ? config.parentRewardAtomic
      : reward.role === "newSeeker" ? config.newSeekerRewardAtomic : null;
    if (!expected || reward.amountAtomic !== expected || reward.tokenMint !== config.tokenMint || reward.decimals !== config.decimals) {
      throw new PayoutError("Campaign reward ledger is inconsistent. Manual audit required.");
    }
    const bit = reward.role === "parent" ? 1 : 2;
    const current = births.get(reward.childSgtMint) ?? 0;
    if (current & bit) throw new PayoutError("Duplicate reward role in campaign ledger. Manual audit required.");
    births.set(reward.childSgtMint, current | bit);
    total += BigInt(reward.amountAtomic);
  }
  if ([...births.values()].some((roles) => roles !== 3) ||
    BigInt(births.size) !== BigInt(campaign.skrFundedBirths!.toString()) ||
    total > BigInt(config.budgetAtomic)) {
    throw new PayoutError("Campaign rewards exceed the funded birth ledger. Manual audit required.");
  }
}

async function recipientsFor(rewards: EligibleReward[], campaign: OutbreakSeason) {
  const config = campaign.skrCampaign!;
  const sgts = [...new Set(rewards.map((reward) => reward.recipientSgtMint))];
  const identities = await SeekerIdentityModel.find({ sgtMint: { $in: sgts } }).lean();
  const walletBySgt = new Map(identities.map((identity) => [identity.sgtMint, identity.currentWalletAddress]));
  const group = new Map<string, { amount: bigint; rewardIds: string[] }>();
  const missing: { recipientSgtMint: string; reason: string }[] = [];
  for (const reward of rewards) {
    const expectedAmount = reward.role === "parent" ? config.parentRewardAtomic
      : reward.role === "newSeeker" ? config.newSeekerRewardAtomic : null;
    if (reward.tokenMint !== config.tokenMint || reward.decimals !== config.decimals ||
      reward.amountAtomic !== expectedAmount) {
      throw new PayoutError("Reward ledger differs from campaign SKR snapshot.");
    }
    const current = group.get(reward.recipientSgtMint) ?? { amount: 0n, rewardIds: [] };
    current.amount += BigInt(reward.amountAtomic);
    current.rewardIds.push(reward._id);
    group.set(reward.recipientSgtMint, current);
  }
  const recipients: { recipientSgtMint: string; walletAddress: string; amountAtomic: string; rewardIds: string[] }[] = [];
  for (const [sgt, total] of group) {
    const walletAddress = walletBySgt.get(sgt);
    if (!walletAddress) { missing.push({ recipientSgtMint: sgt, reason: "No verified current wallet" }); continue; }
    try {
      const wallet = publicKey(walletAddress, "recipient wallet");
      if (!PublicKey.isOnCurve(wallet.toBytes())) throw new Error("off curve");
      if (total.amount > MAX_U64) throw new Error("amount exceeds u64");
      recipients.push({ recipientSgtMint: sgt, walletAddress, amountAtomic: total.amount.toString(), rewardIds: total.rewardIds });
    } catch {
      missing.push({ recipientSgtMint: sgt, reason: "Invalid wallet or amount" });
    }
  }
  recipients.sort((a, b) => a.recipientSgtMint.localeCompare(b.recipientSgtMint));
  const currentOwners: typeof recipients = [];
  for (let offset = 0; offset < recipients.length; offset += 8) {
    const batch = recipients.slice(offset, offset + 8);
    let verified: (Awaited<ReturnType<typeof verifySeekerGenesisToken>>)[];
    try {
      verified = await Promise.all(batch.map((recipient) =>
        verifySeekerGenesisToken(recipient.walletAddress, { expectedMintAddress: recipient.recipientSgtMint })
      ));
    } catch {
      throw new PayoutError("Current SGT ownership verification is unavailable.", 503);
    }
    batch.forEach((recipient, index) => {
      if (verified[index]?.mintAddress === recipient.recipientSgtMint) currentOwners.push(recipient);
      else missing.push({ recipientSgtMint: recipient.recipientSgtMint, reason: "Indexed wallet no longer holds this SGT" });
    });
  }
  return { recipients: currentOwners, missing };
}

async function assertPreparedRecipientsCurrent(transfers: PayoutTransfer[]) {
  const sgts = [...new Set(transfers.map((transfer) => transfer.recipientSgtMint))];
  const identities = await SeekerIdentityModel.find({ sgtMint: { $in: sgts } })
    .select({ sgtMint: 1, currentWalletAddress: 1 }).lean();
  const walletBySgt = new Map(identities.map((identity) => [identity.sgtMint, identity.currentWalletAddress]));
  const stale = () => new PayoutError("Prepared payout recipient SGT ownership changed. Reconcile and prepare a new run.");
  if (transfers.some((transfer) => walletBySgt.get(transfer.recipientSgtMint) !== transfer.walletAddress)) {
    throw stale();
  }
  for (let offset = 0; offset < transfers.length; offset += 8) {
    const batch = transfers.slice(offset, offset + 8);
    let verified: (Awaited<ReturnType<typeof verifySeekerGenesisToken>>)[];
    try {
      verified = await Promise.all(batch.map((transfer) =>
        verifySeekerGenesisToken(transfer.walletAddress, { expectedMintAddress: transfer.recipientSgtMint })
      ));
    } catch {
      throw new PayoutError("Current SGT ownership verification is unavailable.", 503);
    }
    if (batch.some((transfer, index) => verified[index]?.mintAddress !== transfer.recipientSgtMint)) {
      throw stale();
    }
  }
}

export async function previewPayout(campaignId: string) {
  const campaign = await payoutCampaign(campaignId);
  await assertRewardLedger(campaign);
  const [{ eligible, lockedRewards, runs, unpaidTotalAtomic }, chain] = await Promise.all([eligibleRewards(campaignId), chainContext(campaign)]);
  const resolved = await recipientsFor(eligible, campaign);
  const { recipients, invalid } = await recipientAccounts(chain, resolved.recipients);
  const missing = [...resolved.missing, ...invalid];
  const totalAtomic = recipients.reduce((sum, item) => sum + BigInt(item.amountAtomic), 0n);
  const active = await PayoutTransactionModel.countDocuments({ campaignId, status: { $in: ["prepared", "submitted"] } });
  return {
    campaignId, lifecycle: getCampaignLifecycle(campaign), cluster: chain.cluster,
    treasuryWallet: chain.treasury.toBase58(), tokenMint: chain.mint.toBase58(), decimals: campaign.skrCampaign!.decimals,
    treasuryBalanceAtomic: chain.balance.toString(), recipientCount: recipients.length,
    rewardCount: recipients.reduce((sum, item) => sum + item.rewardIds.length, 0),
    totalAtomic: totalAtomic.toString(), unpaidTotalAtomic: unpaidTotalAtomic.toString(), missing, lockedRewards,
    estimatedBatches: Math.ceil(recipients.length / MAX_RECIPIENTS_PER_TX),
    mainRunExists: runs.some((run) => run.kind === "main"), activeTransactions: active,
    latestRunId: runs[0]?._id ?? null,
  };
}

async function recipientAccounts(chain: Awaited<ReturnType<typeof chainContext>>, transfers: Awaited<ReturnType<typeof recipientsFor>>["recipients"]) {
  const recipients: Recipient[] = transfers.map((transfer) => {
    const publicKeyValue = publicKey(transfer.walletAddress, "recipient wallet");
    return { ...transfer, publicKey: publicKeyValue, ata: getAssociatedTokenAddressSync(chain.mint, publicKeyValue, false, TOKEN_PROGRAM_ID), needsAta: false };
  });
  const invalid: { recipientSgtMint: string; reason: string }[] = [];
  const valid: Recipient[] = [];
  for (let offset = 0; offset < recipients.length; offset += 100) {
    const slice = recipients.slice(offset, offset + 100);
    const infos = await chain.connection.getMultipleAccountsInfo(slice.map((item) => item.ata), "confirmed");
    for (let index = 0; index < slice.length; index += 1) {
      const recipient = slice[index]!;
      const info = infos[index];
      if (!info) {
        recipient.needsAta = true;
        valid.push(recipient);
        continue;
      }
      try {
        const account = unpackAccount(recipient.ata, info, TOKEN_PROGRAM_ID);
        if (!account.owner.equals(recipient.publicKey) || !account.mint.equals(chain.mint) || account.isFrozen) {
          throw new Error("invalid recipient token account");
        }
        valid.push(recipient);
      } catch {
        invalid.push({ recipientSgtMint: recipient.recipientSgtMint, reason: "Invalid or frozen SKR token account" });
      }
    }
  }
  return { recipients: valid, invalid };
}

type BuiltTransaction = Pick<PayoutTransaction, "transfers" | "rewardIds" | "unsignedTransactionBase64" | "messageHash" | "blockhash" | "lastValidBlockHeight">;

async function buildTransactions(chain: Awaited<ReturnType<typeof chainContext>>, recipients: Recipient[], decimals: number) {
  const { blockhash, lastValidBlockHeight } = await chain.connection.getLatestBlockhash("finalized");
  const built: BuiltTransaction[] = [];
  let batch: Recipient[] = [];
  function make(items: Recipient[]) {
    const transaction = new Transaction({ feePayer: chain.treasury, recentBlockhash: blockhash });
    for (const recipient of items) {
      if (recipient.needsAta) transaction.add(createAssociatedTokenAccountIdempotentInstruction(chain.treasury, recipient.ata, recipient.publicKey, chain.mint, TOKEN_PROGRAM_ID));
      transaction.add(createTransferCheckedInstruction(chain.treasuryAta, chain.mint, recipient.ata, chain.treasury, BigInt(recipient.amountAtomic), decimals, [], TOKEN_PROGRAM_ID));
    }
    const bytes = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
    return { transaction, bytes };
  }
  function push(items: Recipient[]) {
    const { transaction, bytes } = make(items);
    if (bytes.length > MAX_TX_BYTES) throw new PayoutError("Recipient transfer cannot fit in a Solana transaction.");
    built.push({
      transfers: items.map(({ recipientSgtMint, walletAddress, amountAtomic, rewardIds }) => ({ recipientSgtMint, walletAddress, amountAtomic, rewardIds })),
      rewardIds: items.flatMap((item) => item.rewardIds),
      unsignedTransactionBase64: bytes.toString("base64"),
      messageHash: crypto.createHash("sha256").update(transaction.serializeMessage()).digest("hex"),
      blockhash, lastValidBlockHeight,
    });
  }
  function fits(items: Recipient[]) {
    try { return make(items).bytes.length <= MAX_TX_BYTES; }
    catch (error) {
      if (error instanceof Error && /too large|overruns|out of range/i.test(error.message)) return false;
      throw error;
    }
  }
  for (const recipient of recipients) {
    const candidate = [...batch, recipient];
    if (candidate.length > MAX_RECIPIENTS_PER_TX || !fits(candidate)) {
      if (!batch.length) throw new PayoutError("Recipient transfer cannot fit in a Solana transaction.");
      if (!fits([recipient])) throw new PayoutError("Recipient transfer cannot fit in a Solana transaction.");
      push(batch); batch = [recipient];
    } else batch = candidate;
  }
  if (batch.length) push(batch);
  return built;
}

async function withPayoutGuard<T>(campaignId: string, work: (session: ClientSession) => Promise<T>) {
  const guard = mongoose.connection.db!.collection<{ _id: string; revision: number }>(GUARD_COLLECTION);
  try {
    await guard.updateOne({ _id: campaignId }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) throw error;
  }
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      await guard.updateOne({ _id: campaignId }, { $inc: { revision: 1 } }, { session });
      return work(session);
    });
  } finally {
    await session.endSession();
  }
}

export async function preparePayout(campaignId: string, kind: "main" | "retry") {
  const campaign = await payoutCampaign(campaignId);
  await assertRewardLedger(campaign);
  const [{ eligible, runs }, chain] = await Promise.all([eligibleRewards(campaignId), chainContext(campaign)]);
  const resolved = await recipientsFor(eligible, campaign);
  const { recipients, invalid } = await recipientAccounts(chain, resolved.recipients);
  const missing = [...resolved.missing, ...invalid];
  if (kind === "main" && runs.some((run) => run.kind === "main")) {
    throw new PayoutError("Main payout run already exists. Use retry for unpaid recipients.");
  }
  if (kind === "retry" && !runs.some((run) => run.kind === "main")) {
    throw new PayoutError("Prepare the main payout run first.");
  }
  if (!recipients.length) throw new PayoutError("No payable recipients have a valid current wallet and SKR token account.");
  const total = recipients.reduce((sum, item) => sum + BigInt(item.amountAtomic), 0n);
  if (chain.balance < total) throw new PayoutError("Treasury SKR balance does not cover the full prepared run.");
  const built = await buildTransactions(chain, recipients, campaign.skrCampaign!.decimals);
  const missingAtas = new Set(recipients.filter((item) => item.needsAta).map((item) => item.ata.toBase58())).size;
  const rent = await chain.connection.getMinimumBalanceForRentExemption(165, "confirmed");
  const treasurySol = await chain.connection.getBalance(chain.treasury, "confirmed");
  if (BigInt(treasurySol) < BigInt(rent) * BigInt(missingAtas) + 50_000n * BigInt(built.length)) {
    throw new PayoutError("Treasury SOL balance is too low for account creation and transaction fees.");
  }
  const runId = crypto.randomUUID();
  const transactionDocs: PayoutTransaction[] = built.map((batch, index) => ({
    ...batch, _id: `${runId}:${index}`, campaignId, runId, index,
    status: "prepared", treasuryWallet: chain.treasury.toBase58(), tokenMint: chain.mint.toBase58(),
    decimals: campaign.skrCampaign!.decimals, signature: null, signedTransactionBase64: null,
    submittedAt: null, confirmedAt: null, failedAt: null, failureReason: null, createdAt: new Date(),
  }));
  const rewardToTx = new Map(transactionDocs.flatMap((transaction) => transaction.rewardIds.map((id) => [id, transaction._id] as const)));

  await withPayoutGuard(campaignId, async (session) => {
    const current = await OutbreakSeasonModel.findOne({ seasonId: campaignId }).session(session).lean();
    if (!current || !["ended", "cancelled"].includes(getCampaignLifecycle(current)) ||
      current.skrCampaign?.tokenMint !== campaign.skrCampaign?.tokenMint ||
      current.skrCampaign?.decimals !== campaign.skrCampaign?.decimals) {
      throw new PayoutError("Campaign payout configuration changed.");
    }
    if (await PayoutTransactionModel.exists({ campaignId, status: { $in: ["prepared", "submitted"] } }).session(session)) {
      throw new PayoutError("A payout run still has unresolved transactions. Reconcile it first.");
    }
    const mainExists = await PayoutRunModel.exists({ campaignId, kind: "main" }).session(session);
    if ((kind === "main" && mainExists) || (kind === "retry" && !mainExists)) {
      throw new PayoutError("Payout run sequence changed. Refresh preview.");
    }
    const selectedIds = [...rewardToTx.keys()];
    const currentRewards = await SkrRewardModel.find({ _id: { $in: selectedIds } }).session(session).lean();
    const selectedById = new Map(eligible.map((reward) => [reward._id, reward]));
    if (currentRewards.length !== selectedIds.length) throw new PayoutError("Reward ledger changed. Refresh preview.");
    const priorIds = [...new Set(currentRewards.map((reward) => reward.payoutTransactionId).filter((id): id is string => !!id))];
    const prior = await PayoutTransactionModel.find({ _id: { $in: priorIds } }).select({ status: 1 }).session(session).lean();
    const priorStatus = new Map(prior.map((transaction) => [transaction._id, transaction.status]));
    for (const reward of currentRewards) {
      const selected = selectedById.get(reward._id);
      if (!selected || reward.payoutStatus === "paid" || reward.payoutTransactionId !== selected.payoutTransactionId ||
        reward.amountAtomic !== selected.amountAtomic || reward.recipientSgtMint !== selected.recipientSgtMint ||
        (reward.payoutTransactionId && priorStatus.get(reward.payoutTransactionId) !== "failed")) {
        throw new PayoutError("Reward claim changed. Refresh preview.");
      }
    }
    const identities = await SeekerIdentityModel.find({ sgtMint: { $in: recipients.map((item) => item.recipientSgtMint) } }).session(session).lean();
    const walletBySgt = new Map(identities.map((identity) => [identity.sgtMint, identity.currentWalletAddress]));
    if (recipients.some((item) => walletBySgt.get(item.recipientSgtMint) !== item.walletAddress)) {
      throw new PayoutError("A recipient wallet changed. Refresh preview.");
    }
    await PayoutRunModel.create([{
      _id: runId, campaignId, kind, treasuryWallet: chain.treasury.toBase58(),
      tokenMint: chain.mint.toBase58(), decimals: campaign.skrCampaign!.decimals, createdAt: new Date(),
    }], { session });
    await PayoutTransactionModel.create(transactionDocs, { session });
    const result = await SkrRewardModel.bulkWrite(currentRewards.map((reward) => ({
      updateOne: {
        filter: { _id: reward._id, payoutStatus: { $in: ["pending", "failed"] }, payoutTransactionId: reward.payoutTransactionId ?? null },
        update: { $set: { payoutTransactionId: rewardToTx.get(reward._id)!, payoutStatus: "pending" } },
      },
    })), { session, ordered: true });
    if (result.modifiedCount !== selectedIds.length) throw new PayoutError("Reward claims changed during preparation.");
  });
  return {
    runId, kind, campaignId, recipientCount: recipients.length, totalAtomic: total.toString(),
    missing, transactions: transactionDocs.map(publicTransaction),
  };
}

function publicTransaction(transaction: PayoutTransaction) {
  return {
    id: transaction._id, index: transaction.index, status: transaction.status,
    recipientCount: transaction.transfers.length,
    totalAtomic: transaction.transfers.reduce((sum, item) => sum + BigInt(item.amountAtomic), 0n).toString(),
    unsignedTransactionBase64: transaction.status === "prepared" ? transaction.unsignedTransactionBase64 : null,
    signature: transaction.signature ?? null, failureReason: transaction.failureReason ?? null,
    lastValidBlockHeight: transaction.lastValidBlockHeight,
  };
}

export async function getPayoutRun(campaignId: string) {
  await payoutCampaign(campaignId);
  const run = await PayoutRunModel.findOne({ campaignId }).sort({ createdAt: -1 }).lean();
  if (!run) return null;
  const transactions = await PayoutTransactionModel.find({ runId: run._id }).sort({ index: 1 }).lean();
  return {
    runId: run._id, kind: run.kind, createdAt: run.createdAt.toISOString(),
    treasuryWallet: run.treasuryWallet, tokenMint: run.tokenMint, decimals: run.decimals,
    transactions: transactions.map(publicTransaction),
  };
}

function base58(bytes: Uint8Array) {
  let value = BigInt(`0x${Buffer.from(bytes).toString("hex")}`);
  let encoded = "";
  while (value > 0n) {
    encoded = BASE58[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }
  return encoded;
}

export async function submitSignedPayout(campaignId: string, transactionId: string, signedBase64: string) {
  const campaign = await payoutCampaign(campaignId);
  if (typeof transactionId !== "string" || !/^[0-9a-f-]{36}:[0-9]+$/.test(transactionId)) {
    throw new PayoutError("Invalid payout transaction ID.", 400);
  }
  if (typeof signedBase64 !== "string" || signedBase64.length > 2400 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signedBase64)) {
    throw new PayoutError("Invalid signed transaction.", 400);
  }
  const stored = await PayoutTransactionModel.findOne({ _id: transactionId, campaignId }).lean();
  if (!stored || !["prepared", "submitted"].includes(stored.status)) throw new PayoutError("Transaction is not payable.");
  const configured = payoutConfiguration();
  if (stored.tokenMint !== campaign.skrCampaign!.tokenMint ||
    stored.tokenMint !== configured.expectedMint.toBase58() ||
    stored.treasuryWallet !== configured.treasury.toBase58()) {
    throw new PayoutError("Prepared payout no longer matches treasury or SKR configuration.");
  }
  const bytes = Buffer.from(signedBase64, "base64");
  if (bytes.toString("base64") !== signedBase64 || bytes.length > MAX_TX_BYTES) throw new PayoutError("Invalid signed transaction bytes.", 400);
  let transaction: Transaction;
  try { transaction = Transaction.from(bytes); }
  catch { throw new PayoutError("Invalid Solana transaction.", 400); }
  try {
    if (!transaction.serialize({ requireAllSignatures: true, verifySignatures: true }).equals(bytes)) {
      throw new Error("noncanonical");
    }
  } catch { throw new PayoutError("Signed transaction bytes are not canonical.", 400); }
  const treasury = publicKey(stored.treasuryWallet, "treasury wallet");
  if (!transaction.feePayer?.equals(treasury) || transaction.recentBlockhash !== stored.blockhash ||
    transaction.signatures.length !== 1 || !transaction.signatures[0]?.publicKey.equals(treasury) ||
    !transaction.verifySignatures()) {
    throw new PayoutError("Treasury signature or transaction authority is invalid.", 400);
  }
  const hash = crypto.createHash("sha256").update(transaction.serializeMessage()).digest("hex");
  if (hash !== stored.messageHash || !transaction.signature) {
    throw new PayoutError("Signed transaction differs from the prepared payout.", 400);
  }
  const signature = base58(transaction.signature);
  if (stored.status === "submitted" && stored.signature !== signature) {
    throw new PayoutError("This payout already has a different submitted signature.");
  }
  const { connection } = await payoutConnection();
  if (stored.status === "prepared" && await connection.getBlockHeight("finalized") > stored.lastValidBlockHeight) {
    throw new PayoutError("Prepared blockhash expired. Reconcile and retry.");
  }
  await assertPreparedRecipientsCurrent(stored.transfers);
  if (stored.status === "prepared") {
    const submitted = await PayoutTransactionModel.findOneAndUpdate(
      { _id: transactionId, campaignId, status: "prepared", signature: null },
      { $set: { status: "submitted", signature, signedTransactionBase64: signedBase64, submittedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!submitted) {
      const concurrent = await PayoutTransactionModel.findById(transactionId).lean();
      if (concurrent?.status !== "submitted" || concurrent.signature !== signature) {
        throw new PayoutError("Payout transaction state changed. Reconcile before retrying.");
      }
    }
  }
  let sendWarning = false;
  try {
    const sentSignature = await connection.sendRawTransaction(bytes, {
      skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 2,
    });
    if (sentSignature !== signature) throw new Error("Signature mismatch from RPC.");
  } catch {
    // Signature and exact signed bytes are already durable. The same bytes may
    // be resubmitted, but no replacement payout can be prepared while unresolved.
    sendWarning = true;
  }
  return { transactionId, status: "submitted" as const, signature, sendWarning };
}

async function settleTransaction(transaction: PayoutTransaction, result: "confirmed" | "failed", reason?: string) {
  await withPayoutGuard(transaction.campaignId, async (session) => {
    const now = new Date();
    const changed = await PayoutTransactionModel.updateOne(
      { _id: transaction._id, status: transaction.status, signature: transaction.signature ?? null },
      { $set: result === "confirmed"
        ? { status: "confirmed", confirmedAt: now, failureReason: null }
        : { status: "failed", failedAt: now, failureReason: reason ?? "Finalized transaction failed." } },
      { session },
    );
    if (changed.modifiedCount !== 1) return;
    const rewards = await SkrRewardModel.updateMany(
      { _id: { $in: transaction.rewardIds }, payoutTransactionId: transaction._id, payoutStatus: { $ne: "paid" } },
      { $set: result === "confirmed"
        ? { payoutStatus: "paid", paidSignature: transaction.signature, paidAt: now }
        : { payoutStatus: "failed", paidSignature: null, paidAt: null } },
      { session },
    );
    if (rewards.modifiedCount !== transaction.rewardIds.length) {
      throw new PayoutError("Reward ledger and payout transaction disagree. Manual audit required.");
    }
  });
}

export async function reconcilePayout(campaignId: string) {
  await payoutCampaign(campaignId);
  const { connection } = await payoutConnection();
  const transactions = await PayoutTransactionModel.find({ campaignId, status: { $in: ["prepared", "submitted"] } }).lean();
  const height = await connection.getBlockHeight("finalized");
  const submitted = transactions.filter((transaction) => transaction.status === "submitted");
  const statuses = new Map<string, Awaited<ReturnType<typeof connection.getSignatureStatuses>>["value"][number]>();
  for (let offset = 0; offset < submitted.length; offset += 256) {
    const slice = submitted.slice(offset, offset + 256);
    if (slice.some((transaction) => !transaction.signature)) throw new PayoutError("Submitted payout has no signature. Manual audit required.");
    const fetched = await connection.getSignatureStatuses(slice.map((transaction) => transaction.signature!), { searchTransactionHistory: true });
    slice.forEach((transaction, index) => statuses.set(transaction._id, fetched.value[index] ?? null));
  }
  for (const transaction of transactions) {
    if (transaction.status === "prepared") {
      if (height > transaction.lastValidBlockHeight) {
        await settleTransaction(transaction, "failed", "No signed transaction was recorded before blockhash expiry.");
      }
      continue;
    }
    if (!transaction.signature) throw new PayoutError("Submitted payout has no signature. Manual audit required.");
    const status = statuses.get(transaction._id);
    if (status?.confirmationStatus === "finalized") {
      await settleTransaction(transaction, status.err ? "failed" : "confirmed", status.err ? "Finalized transaction failed." : undefined);
      continue;
    }
    if (!status && height > transaction.lastValidBlockHeight) {
      try {
        const finalized = await connection.getTransaction(transaction.signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
        if (finalized?.meta) {
          await settleTransaction(transaction, finalized.meta.err ? "failed" : "confirmed", finalized.meta.err ? "Finalized transaction failed." : undefined);
        }
      } catch { /* RPC history uncertainty keeps the reward locked. */ }
      // A missing RPC status is not proof of failure. Keep the reward locked.
      // Another reconciliation or manual chain audit must establish finality.
      continue;
    }
    if (!status && transaction.signedTransactionBase64 && height <= transaction.lastValidBlockHeight) {
      await assertPreparedRecipientsCurrent(transaction.transfers);
      try { await connection.sendRawTransaction(Buffer.from(transaction.signedTransactionBase64, "base64"), { maxRetries: 2 }); }
      catch { /* The durable signature remains the only eligible transaction. */ }
    }
  }
  return getPayoutRun(campaignId);
}
