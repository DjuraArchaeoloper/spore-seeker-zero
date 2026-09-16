import crypto from "crypto";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_GROUP_MEMBER_SIZE,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeGroupMemberPointerInstruction,
  createInitializeMemberInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getGroupMemberPointerState,
  getMetadataPointerState,
  getMint,
  getMintLen,
  getTokenGroupMemberState,
  getTokenGroupState,
  unpackMint,
} from "@solana/spl-token";

import {
  getDevnetTestSgtBootstrapConfig,
  getHeliusRpcUrl,
  getSgtVerificationConfig,
  getSolanaCluster,
  getSporeProgramId,
} from "../env";
import {
  DevnetTestSgtAssignmentModel,
  type DevnetTestSgtAssignment,
} from "../models/DevnetTestSgtAssignment";
import { verifySeekerGenesisToken, type SgtVerificationResult } from "./sgt";

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const MINT_DERIVATION_LABEL = "spore-devnet-test-sgt-v1";
const FUNDING_RESERVATION_TTL_MS = 10 * 60 * 1000;
const CONFIRM_OPTIONS = {
  commitment: "confirmed" as const,
  preflightCommitment: "confirmed" as const,
  skipPreflight: false,
  maxRetries: 5,
};

type BootstrapContext = {
  connection: Connection;
  programId: PublicKey;
  mintAuthority: Keypair;
  metadataAddress: PublicKey;
  groupAddress: PublicKey;
  sponsor: Keypair;
  testerFundingTargetLamports: number;
};

export class DevnetTestSgtBootstrapDisabledError extends Error {
  constructor() {
    super("Devnet Test SGT bootstrap is not enabled.");
  }
}

export class DevnetTestSgtBootstrapError extends Error {
  constructor() {
    super("Devnet Test SGT bootstrap failed.");
  }
}

export async function ensureDevnetTestSgt(
  walletAddress: string,
): Promise<SgtVerificationResult> {
  try {
    const context = await getBootstrapContext();
    const wallet = normalizePublicKey(walletAddress);
    const mint = deriveTestSgtMint(context, wallet);
    const assignment = await DevnetTestSgtAssignmentModel.findOne({
      wallet: wallet.toBase58(),
    }).lean();

    if (assignment && assignment.sgtMint !== mint.publicKey.toBase58()) {
      const assignedMint = tryPublicKey(assignment.sgtMint);
      const assigned = assignedMint
        ? await verifyDevnetTestSgt(context, wallet, assignedMint)
        : null;

      if (assigned) {
        await ensureDevnetSolFunding(context, wallet, assignment).catch(
          (error: unknown) => {
            console.warn("[DEVNET TEST SGT]", {
              phase: "funding_failed",
              wallet: wallet.toBase58(),
              reason: getSafeErrorReason(error),
            });
          },
        );

        return assigned;
      }

      console.warn("[DEVNET TEST SGT]", {
        phase: "stale_assignment_ignored",
        wallet: wallet.toBase58(),
        staleSgtMint: assignment.sgtMint,
        currentSgtMint: mint.publicKey.toBase58(),
      });
    }

    const verified = await ensureMintedAndVerified(context, wallet, mint);
    const saved = await saveAssignment(wallet, verified.mintAddress);

    await ensureDevnetSolFunding(context, wallet, saved).catch(
      (error: unknown) => {
        console.warn("[DEVNET TEST SGT]", {
          phase: "funding_failed",
          wallet: wallet.toBase58(),
          reason: getSafeErrorReason(error),
        });
      },
    );

    return verified;
  } catch (error) {
    if (
      error instanceof DevnetTestSgtBootstrapDisabledError ||
      error instanceof DevnetTestSgtBootstrapError
    ) {
      throw error;
    }

    console.warn("[DEVNET TEST SGT]", {
      phase: "bootstrap_failed",
      reason: getSafeErrorReason(error),
    });

    throw new DevnetTestSgtBootstrapError();
  }
}

export async function fundAssignedDevnetTestSgt(
  walletAddress: string,
  sgtMint: string,
) {
  const wallet = normalizePublicKey(walletAddress);
  const assignment = await DevnetTestSgtAssignmentModel.findOne({
    wallet: wallet.toBase58(),
    sgtMint,
  }).lean();

  if (!assignment) {
    return;
  }

  try {
    const context = await getBootstrapContext();
    const mint = deriveTestSgtMint(context, wallet);

    if (mint.publicKey.toBase58() !== assignment.sgtMint) {
      return;
    }

    await ensureDevnetSolFunding(context, wallet, assignment);
  } catch (error) {
    if (error instanceof DevnetTestSgtBootstrapDisabledError) {
      return;
    }

    console.warn("[DEVNET TEST SGT]", {
      phase: "assigned_funding_failed",
      wallet: wallet.toBase58(),
      reason: getSafeErrorReason(error),
    });
  }
}

async function getBootstrapContext(): Promise<BootstrapContext> {
  if (getSolanaCluster() !== "devnet") {
    throw new DevnetTestSgtBootstrapDisabledError();
  }

  const bootstrap = getDevnetTestSgtBootstrapConfig();

  if (!bootstrap.enabled) {
    throw new DevnetTestSgtBootstrapDisabledError();
  }

  try {
    const connection = new Connection(getHeliusRpcUrl(), "confirmed");
    const genesisHash = await connection.getGenesisHash();

    if (genesisHash !== DEVNET_GENESIS_HASH) {
      throw new DevnetTestSgtBootstrapDisabledError();
    }

    const programId = normalizePublicKey(getSporeProgramId());
    const approvedProgramId = normalizePublicKey(bootstrap.approvedProgramId);

    if (!programId.equals(approvedProgramId)) {
      throw new DevnetTestSgtBootstrapDisabledError();
    }

    const sgtConfig = getSgtVerificationConfig();
    const mintAuthority = keypairFromSecret(bootstrap.mintAuthoritySecret);
    const sponsor = keypairFromSecret(bootstrap.sponsorSecret);
    const expectedMintAuthority = normalizePublicKey(sgtConfig.mintAuthority);
    const metadataAddress = normalizePublicKey(sgtConfig.metadataAddress);
    const groupAddress = normalizePublicKey(sgtConfig.groupAddress);

    if (!mintAuthority.publicKey.equals(expectedMintAuthority)) {
      throw new DevnetTestSgtBootstrapDisabledError();
    }

    await assertDevnetGroupAuthority(
      connection,
      groupAddress,
      sponsor.publicKey,
    );

    return {
      connection,
      programId,
      mintAuthority,
      metadataAddress,
      groupAddress,
      sponsor,
      testerFundingTargetLamports: bootstrap.testerFundingTargetLamports,
    };
  } catch (error) {
    if (error instanceof DevnetTestSgtBootstrapDisabledError) {
      throw error;
    }

    throw new DevnetTestSgtBootstrapDisabledError();
  }
}

async function assertDevnetGroupAuthority(
  connection: Connection,
  groupAddress: PublicKey,
  expectedUpdateAuthority: PublicKey,
) {
  const groupInfo = await connection.getAccountInfo(groupAddress, "confirmed");

  if (!groupInfo || !groupInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new DevnetTestSgtBootstrapDisabledError();
  }

  const groupMint = unpackMint(groupAddress, groupInfo, TOKEN_2022_PROGRAM_ID);
  const tokenGroup = getTokenGroupState(groupMint);

  if (!tokenGroup?.updateAuthority?.equals(expectedUpdateAuthority)) {
    throw new DevnetTestSgtBootstrapDisabledError();
  }
}

async function ensureMintedAndVerified(
  context: BootstrapContext,
  wallet: PublicKey,
  mint: Keypair,
): Promise<SgtVerificationResult> {
  const existing = await verifyDevnetTestSgt(context, wallet, mint.publicKey);

  if (existing) {
    return existing;
  }

  await ensureMintAccount(context, mint);
  await ensureGroupMembership(context, mint.publicKey);
  await ensureRecipientToken(context, wallet, mint.publicKey);

  const verified = await verifyDevnetTestSgt(context, wallet, mint.publicKey);

  if (!verified) {
    throw new DevnetTestSgtBootstrapError();
  }

  return verified;
}

async function ensureMintAccount(context: BootstrapContext, mint: Keypair) {
  const existing = await context.connection.getAccountInfo(
    mint.publicKey,
    "confirmed",
  );

  if (existing) {
    if (!existing.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      throw new DevnetTestSgtBootstrapError();
    }

    return;
  }

  const mintLength = getMintLen([
    ExtensionType.MetadataPointer,
    ExtensionType.GroupMemberPointer,
  ]);
  const lamports = await context.connection.getMinimumBalanceForRentExemption(
    mintLength,
    "confirmed",
  );
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: context.sponsor.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLength,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      context.mintAuthority.publicKey,
      context.metadataAddress,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeGroupMemberPointerInstruction(
      mint.publicKey,
      context.mintAuthority.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint.publicKey,
      0,
      context.mintAuthority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  try {
    await sendAndConfirmTransaction(
      context.connection,
      transaction,
      uniqueSigners([context.sponsor, mint]),
      CONFIRM_OPTIONS,
    );
  } catch (error) {
    const recovered = await context.connection.getAccountInfo(
      mint.publicKey,
      "confirmed",
    );

    if (!recovered?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      throw error;
    }
  }
}

async function ensureGroupMembership(
  context: BootstrapContext,
  mintAddress: PublicKey,
) {
  if (await hasExpectedGroupMembership(context, mintAddress)) {
    return;
  }

  const lamports = await context.connection.getMinimumBalanceForRentExemption(
    TOKEN_GROUP_MEMBER_SIZE,
    "confirmed",
  );
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: context.sponsor.publicKey,
      toPubkey: mintAddress,
      lamports,
    }),
    createInitializeMemberInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      member: mintAddress,
      memberMint: mintAddress,
      memberMintAuthority: context.mintAuthority.publicKey,
      group: context.groupAddress,
      groupUpdateAuthority: context.sponsor.publicKey,
    }),
  );

  try {
    await sendAndConfirmTransaction(
      context.connection,
      transaction,
      uniqueSigners([context.sponsor, context.mintAuthority]),
      CONFIRM_OPTIONS,
    );
  } catch (error) {
    if (!(await hasExpectedGroupMembership(context, mintAddress))) {
      throw error;
    }
  }
}

async function ensureRecipientToken(
  context: BootstrapContext,
  wallet: PublicKey,
  mintAddress: PublicKey,
) {
  if (await hasExpectedRecipientToken(context, wallet, mintAddress)) {
    return;
  }

  const mint = await getMint(
    context.connection,
    mintAddress,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );

  if (mint.decimals !== 0 || mint.supply !== BigInt(0)) {
    throw new DevnetTestSgtBootstrapError();
  }

  const recipientTokenAccount = getAssociatedTokenAddressSync(
    mintAddress,
    wallet,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      context.sponsor.publicKey,
      recipientTokenAccount,
      wallet,
      mintAddress,
      TOKEN_2022_PROGRAM_ID,
    ),
    createMintToCheckedInstruction(
      mintAddress,
      recipientTokenAccount,
      context.mintAuthority.publicKey,
      BigInt(1),
      0,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  try {
    await sendAndConfirmTransaction(
      context.connection,
      transaction,
      uniqueSigners([context.sponsor, context.mintAuthority]),
      CONFIRM_OPTIONS,
    );
  } catch (error) {
    if (!(await hasExpectedRecipientToken(context, wallet, mintAddress))) {
      throw error;
    }
  }
}

async function verifyDevnetTestSgt(
  context: BootstrapContext,
  wallet: PublicKey,
  mintAddress: PublicKey,
): Promise<SgtVerificationResult | null> {
  if (!(await hasExpectedDevnetTestSgtShape(context, wallet, mintAddress))) {
    return null;
  }

  return verifySeekerGenesisToken(wallet.toBase58(), {
    expectedMintAddress: mintAddress.toBase58(),
  });
}

async function hasExpectedDevnetTestSgtShape(
  context: BootstrapContext,
  wallet: PublicKey,
  mintAddress: PublicKey,
) {
  try {
    const mintInfo = await context.connection.getAccountInfo(
      mintAddress,
      "confirmed",
    );

    if (!mintInfo || !mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return false;
    }

    const mint = unpackMint(mintAddress, mintInfo, TOKEN_2022_PROGRAM_ID);
    const metadataPointer = getMetadataPointerState(mint);
    const groupMemberPointer = getGroupMemberPointerState(mint);
    const tokenGroupMember = getTokenGroupMemberState(mint);

    if (
      mint.mintAuthority?.equals(context.mintAuthority.publicKey) !== true ||
      metadataPointer?.authority?.equals(context.mintAuthority.publicKey) !==
        true ||
      metadataPointer?.metadataAddress?.equals(context.metadataAddress) !==
        true ||
      groupMemberPointer?.authority?.equals(context.mintAuthority.publicKey) !==
        true ||
      groupMemberPointer?.memberAddress?.equals(mintAddress) !== true ||
      tokenGroupMember?.mint?.equals(mintAddress) !== true ||
      tokenGroupMember?.group?.equals(context.groupAddress) !== true
    ) {
      return false;
    }

    return hasExpectedRecipientToken(context, wallet, mintAddress);
  } catch {
    return false;
  }
}

async function hasExpectedGroupMembership(
  context: BootstrapContext,
  mintAddress: PublicKey,
) {
  try {
    const mintInfo = await context.connection.getAccountInfo(
      mintAddress,
      "confirmed",
    );

    if (!mintInfo || !mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return false;
    }

    const mint = unpackMint(mintAddress, mintInfo, TOKEN_2022_PROGRAM_ID);
    const groupMember = getTokenGroupMemberState(mint);

    return (
      groupMember?.mint?.equals(mintAddress) === true &&
      groupMember.group?.equals(context.groupAddress) === true
    );
  } catch {
    return false;
  }
}

async function hasExpectedRecipientToken(
  context: BootstrapContext,
  wallet: PublicKey,
  mintAddress: PublicKey,
) {
  try {
    const mint = await getMint(
      context.connection,
      mintAddress,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      mintAddress,
      wallet,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    const tokenAccount = await getAccount(
      context.connection,
      recipientTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );

    return (
      mint.decimals === 0 &&
      mint.supply === BigInt(1) &&
      tokenAccount.isInitialized &&
      tokenAccount.owner.equals(wallet) &&
      tokenAccount.mint.equals(mintAddress) &&
      tokenAccount.amount === BigInt(1)
    );
  } catch {
    return false;
  }
}

async function saveAssignment(
  wallet: PublicKey,
  sgtMint: string,
): Promise<DevnetTestSgtAssignment> {
  const now = new Date();

  try {
    const assignment = await DevnetTestSgtAssignmentModel.findOneAndUpdate(
      {
        wallet: wallet.toBase58(),
      },
      {
        $set: {
          sgtMint,
          updatedAt: now,
        },
        $setOnInsert: {
          wallet: wallet.toBase58(),
          createdAt: now,
        },
      },
      {
        new: true,
        upsert: true,
      },
    ).lean();

    if (!assignment || assignment.sgtMint !== sgtMint) {
      throw new DevnetTestSgtBootstrapError();
    }

    return assignment;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const assignment = await DevnetTestSgtAssignmentModel.findOne({
      wallet: wallet.toBase58(),
    }).lean();

    if (!assignment || assignment.sgtMint !== sgtMint) {
      throw new DevnetTestSgtBootstrapError();
    }

    return assignment;
  }
}

async function ensureDevnetSolFunding(
  context: BootstrapContext,
  wallet: PublicKey,
  assignment: Pick<DevnetTestSgtAssignment, "wallet" | "fundedAt">,
) {
  if (assignment.fundedAt || context.testerFundingTargetLamports <= 0) {
    return;
  }

  const balance = await context.connection.getBalance(wallet, "confirmed");

  if (balance >= context.testerFundingTargetLamports) {
    return;
  }

  const now = new Date();
  const staleReservation = new Date(now.getTime() - FUNDING_RESERVATION_TTL_MS);
  const reserved = await DevnetTestSgtAssignmentModel.findOneAndUpdate(
    {
      wallet: assignment.wallet,
      fundedAt: null,
      $or: [
        { fundingReservedAt: null },
        { fundingReservedAt: { $lt: staleReservation } },
      ],
    },
    {
      $set: {
        fundingReservedAt: now,
        updatedAt: now,
      },
    },
    {
      new: true,
    },
  ).lean();

  if (!reserved) {
    return;
  }

  const lamports = context.testerFundingTargetLamports - balance;

  try {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: context.sponsor.publicKey,
        toPubkey: wallet,
        lamports,
      }),
    );

    await sendAndConfirmTransaction(
      context.connection,
      transaction,
      [context.sponsor],
      CONFIRM_OPTIONS,
    );

    await DevnetTestSgtAssignmentModel.updateOne(
      {
        wallet: assignment.wallet,
        fundedAt: null,
      },
      {
        $set: {
          fundedAt: new Date(),
          fundedLamports: lamports,
          updatedAt: new Date(),
        },
        $unset: {
          fundingReservedAt: "",
        },
      },
    );
  } catch (error) {
    await DevnetTestSgtAssignmentModel.updateOne(
      {
        wallet: assignment.wallet,
      },
      {
        $set: {
          updatedAt: new Date(),
        },
        $unset: {
          fundingReservedAt: "",
        },
      },
    );

    throw error;
  }
}

function deriveTestSgtMint(context: BootstrapContext, wallet: PublicKey) {
  const seed = crypto
    .createHmac("sha256", context.mintAuthority.secretKey)
    .update(MINT_DERIVATION_LABEL)
    .update(wallet.toBuffer())
    .update(context.programId.toBuffer())
    .update(context.metadataAddress.toBuffer())
    .update(context.groupAddress.toBuffer())
    .digest()
    .subarray(0, 32);

  return Keypair.fromSeed(seed);
}

function keypairFromSecret(secret: string) {
  let bytes: unknown;

  try {
    bytes = secret.startsWith("[")
      ? JSON.parse(secret)
      : Array.from(Buffer.from(secret, "base64"));
  } catch {
    throw new DevnetTestSgtBootstrapDisabledError();
  }

  if (
    !Array.isArray(bytes) ||
    bytes.length !== 64 ||
    !bytes.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 255,
    )
  ) {
    throw new DevnetTestSgtBootstrapDisabledError();
  }

  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function normalizePublicKey(value: string) {
  try {
    return new PublicKey(value);
  } catch {
    throw new DevnetTestSgtBootstrapDisabledError();
  }
}

function tryPublicKey(value: string) {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function uniqueSigners(signers: Keypair[]) {
  const unique = new Map<string, Keypair>();

  for (const signer of signers) {
    unique.set(signer.publicKey.toBase58(), signer);
  }

  return Array.from(unique.values());
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

function getSafeErrorReason(error: unknown) {
  return error instanceof Error ? error.name || "Error" : "Unknown";
}
