import crypto from "crypto";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction
} from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  create,
  fetchAsset,
  mplCore
} from "@metaplex-foundation/mpl-core";
import {
  createNoopSigner,
  createSignerFromKeypair,
  publicKey as umiPublicKey,
  signerIdentity
} from "@metaplex-foundation/umi";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
  toWeb3JsInstruction
} from "@metaplex-foundation/umi-web3js-adapters";
import { createMemoInstruction } from "@solana/spl-memo";

import type { AuthenticatedSeeker } from "../auth/session";
import {
  SgtVerificationUnavailableError,
  verifySeekerGenesisToken
} from "../auth/sgt";
import { connectToDatabase } from "../db/mongoose";
import { getHeliusRpcUrl } from "../env";
import {
  ACTIVE_CLAIM_RESERVATION_STATUSES,
  CLAIM_RESERVATION_STATUS,
  ClaimReservationModel,
  type ClaimReservation
} from "../models/ClaimReservation";
import { OrganismIndexModel, type OrganismIndex } from "../models/OrganismIndex";
import {
  dateFromUnixSeconds,
  hexToBytes,
  unixSecondsFromDate,
  unixSecondsNow
} from "./bytes";
import { hasLiveSpore } from "./core";
import { SporeDomainError } from "./errors";
import { finalizeClaimBirth } from "./finalizeBirth";
import {
  ensureReproductionFields,
  finalizedOrganismFilter
} from "./organismState";
import { deriveCoreAssetKeypair, getSporeServerAuthorityKeypair } from "./serverAuthority";
import { getSolanaConnection } from "./solanaConnection";
import { getCanonicalSpecies } from "./species";

const MEMO_PREFIX = "spore-claim:";
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const LANDED_SETTLEMENT_SIGNATURE_SCAN = 25;

export type SettlementTransactionResult = {
  reservation: ClaimReservation;
  transactionBase64: string;
  expectedCoreAsset: string;
  attemptId: string;
  lastValidBlockHeight: number;
  birthFeeLamports: string;
  treasury: string;
};

export type BuildClaimSettlementResult =
  | ({ kind: "needs_signature" } & SettlementTransactionResult)
  | {
      kind: "finalized";
      reservation: ClaimReservation;
      organism: OrganismIndex;
    };

/**
 * Build a recipient-payable settlement transaction for a reserved claim.
 * Partially signs with the derived Core asset keypair only.
 *
 * Before preparing/refreshing a transaction for a settling reservation, probes
 * whether the expected Core asset already landed and recovers via confirm+finalize.
 */
export async function buildClaimSettlementTransaction(input: {
  seeker: AuthenticatedSeeker;
  reservationId: string;
}): Promise<BuildClaimSettlementResult> {
  await connectToDatabase();
  await assertCurrentSgtOwnership(input.seeker);

  let reservation = await loadActiveReservationForRecipient(
    input.reservationId,
    input.seeker.sgtMint
  );

  if (reservation.recipientWalletAddress !== input.seeker.walletAddress) {
    throw new SporeDomainError(
      "claim_conflict",
      "This reservation is bound to a different wallet session."
    );
  }

  if (
    reservation.status === CLAIM_RESERVATION_STATUS.settled ||
    reservation.status === CLAIM_RESERVATION_STATUS.finalized
  ) {
    const organism = await finalizeClaimBirth({
      reservationId: reservation.reservationId
    });
    const latest = await ClaimReservationModel.findOne({
      reservationId: reservation.reservationId
    }).lean();

    return {
      kind: "finalized",
      reservation: latest ?? reservation,
      organism
    };
  }

  if (
    reservation.status !== CLAIM_RESERVATION_STATUS.reserved &&
    reservation.status !== CLAIM_RESERVATION_STATUS.settling
  ) {
    throw new SporeDomainError(
      "settlement_not_ready",
      "Reservation is not available for settlement."
    );
  }

  await assertReservationOfferStillValid(reservation);

  const species = await getCanonicalSpecies();
  const connection = getSolanaConnection();

  // Settling recovery: if a prior wallet broadcast already created the Core asset,
  // confirm+finalize instead of asking the wallet to sign again.
  if (
    reservation.status === CLAIM_RESERVATION_STATUS.settling &&
    reservation.expectedCoreAsset
  ) {
    const landedSignature = await findLandedSettlementSignature({
      reservation,
      treasury: species.treasury,
      birthFeeLamports: species.birthFeeLamports
    });

    if (landedSignature) {
      const settled = await confirmClaimSettlement({
        seeker: input.seeker,
        reservationId: reservation.reservationId,
        transactionSignature: landedSignature
      });
      const organism = await finalizeClaimBirth({
        reservationId: settled.reservationId
      });
      const latest = await ClaimReservationModel.findOne({
        reservationId: settled.reservationId
      }).lean();

      return {
        kind: "finalized",
        reservation: latest ?? settled,
        organism
      };
    }
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  if (
    reservation.status === CLAIM_RESERVATION_STATUS.settling &&
    reservation.settlementAttemptId &&
    reservation.expectedCoreAsset &&
    reservation.settlementTransactionBase64 &&
    reservation.lastValidBlockHeight != null &&
    reservation.recentBlockhash === blockhash
  ) {
    return await finalizeNeedsSignatureAfterSimulation({
      connection,
      transactionBase64: reservation.settlementTransactionBase64,
      reservation,
      expectedCoreAsset: reservation.expectedCoreAsset,
      attemptId: reservation.settlementAttemptId,
      lastValidBlockHeight: reservation.lastValidBlockHeight,
      birthFeeLamports: species.birthFeeLamports,
      treasury: species.treasury
    });
  }

  if (
    reservation.status === CLAIM_RESERVATION_STATUS.settling &&
    reservation.lastValidBlockHeight != null
  ) {
    const currentHeight = await connection.getBlockHeight("confirmed");

    // Blockhash still usable: never rotate the prepared settlement identity.
    if (
      currentHeight <= reservation.lastValidBlockHeight &&
      reservation.settlementTransactionBase64 &&
      reservation.expectedCoreAsset &&
      reservation.settlementAttemptId
    ) {
      return await finalizeNeedsSignatureAfterSimulation({
        connection,
        transactionBase64: reservation.settlementTransactionBase64,
        reservation,
        expectedCoreAsset: reservation.expectedCoreAsset,
        attemptId: reservation.settlementAttemptId,
        lastValidBlockHeight: reservation.lastValidBlockHeight,
        birthFeeLamports: species.birthFeeLamports,
        treasury: species.treasury
      });
    }
  }

  // Preserve the same Core asset keypair across blockhash refreshes so a
  // late-landing settlement cannot be orphaned by attempt rotation.
  // Atomically claim attemptId once so concurrent /settlement calls cannot
  // bind different expectedCoreAsset values.
  let attemptId = reservation.settlementAttemptId;
  if (!attemptId) {
    const claimedAttemptId = crypto.randomBytes(16).toString("hex");
    const claimed = await ClaimReservationModel.findOneAndUpdate(
      {
        reservationId: reservation.reservationId,
        recipientSgtMint: input.seeker.sgtMint,
        status: {
          $in: [
            CLAIM_RESERVATION_STATUS.reserved,
            CLAIM_RESERVATION_STATUS.settling
          ]
        },
        $or: [
          { settlementAttemptId: null },
          { settlementAttemptId: { $exists: false } }
        ]
      },
      {
        $set: {
          settlementAttemptId: claimedAttemptId,
          status: CLAIM_RESERVATION_STATUS.settling,
          updatedAt: new Date()
        }
      },
      { new: true }
    ).lean();

    if (claimed?.settlementAttemptId) {
      attemptId = claimed.settlementAttemptId;
      reservation = claimed;
    } else {
      const latest = await loadActiveReservationForRecipient(
        reservation.reservationId,
        input.seeker.sgtMint
      );
      if (!latest.settlementAttemptId) {
        throw new SporeDomainError(
          "claim_conflict",
          "Unable to prepare settlement attempt."
        );
      }
      attemptId = latest.settlementAttemptId;
      reservation = latest;
    }
  }

  const assetKeypair = deriveCoreAssetKeypair({
    reservationId: reservation.reservationId,
    attemptId
  });
  const serverAuthority = getSporeServerAuthorityKeypair();
  const recipient = new PublicKey(reservation.recipientWalletAddress);
  const treasury = new PublicKey(species.treasury);
  const birthFeeLamports = BigInt(species.birthFeeLamports);

  if (birthFeeLamports < 0n) {
    throw new SporeDomainError("settlement_invalid", "Invalid birth fee.");
  }

  if (birthFeeLamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new SporeDomainError("settlement_invalid", "Birth fee exceeds safe integer range.");
  }

  const umi = createUmi(getHeliusRpcUrl()).use(mplCore());
  umi.use(
    signerIdentity(createNoopSigner(fromWeb3JsPublicKey(recipient)), true)
  );
  const assetSigner = createSignerFromKeypair(umi, fromWeb3JsKeypair(assetKeypair));
  const provisionalName = "SPØR PENDING";
  const provisionalUri = `${species.metadataBaseUri}/api/nft/pending`;

  const createBuilder = create(umi, {
    asset: assetSigner,
    name: provisionalName,
    uri: provisionalUri,
    owner: fromWeb3JsPublicKey(recipient),
    updateAuthority: fromWeb3JsPublicKey(serverAuthority.publicKey),
    plugins: [
      {
        type: "PermanentFreezeDelegate",
        frozen: true,
        authority: { type: "None" }
      }
    ]
  });

  const createIx = createBuilder.getInstructions().map((ix) => toWeb3JsInstruction(ix));

  const feeIx =
    birthFeeLamports === 0n
      ? null
      : SystemProgram.transfer({
          fromPubkey: recipient,
          toPubkey: treasury,
          lamports: Number(birthFeeLamports)
        });

  const memoIx = createMemoInstruction(`${MEMO_PREFIX}${reservation.reservationId}`, [
    recipient
  ]);

  const transaction = new Transaction({
    feePayer: recipient,
    blockhash,
    lastValidBlockHeight
  });

  for (const ix of createIx) {
    transaction.add(ix);
  }

  if (feeIx) {
    transaction.add(feeIx);
  }

  transaction.add(memoIx);
  transaction.partialSign(assetKeypair);

  // TEMPORARY: simulate the exact prepared settlement tx before returning it.
  await assertSettlementTransactionSimulates({
    connection,
    transaction,
    reservationId: reservation.reservationId,
    attemptId,
    expectedCoreAsset: assetKeypair.publicKey.toBase58(),
    lastValidBlockHeight
  });

  const transactionBase64 = transaction
    .serialize({
      requireAllSignatures: false,
      verifySignatures: false
    })
    .toString("base64");

  const updated = await ClaimReservationModel.findOneAndUpdate(
    {
      reservationId: reservation.reservationId,
      recipientSgtMint: input.seeker.sgtMint,
      status: {
        $in: [CLAIM_RESERVATION_STATUS.reserved, CLAIM_RESERVATION_STATUS.settling]
      }
    },
    {
      $set: {
        status: CLAIM_RESERVATION_STATUS.settling,
        settlementAttemptId: attemptId,
        expectedCoreAsset: assetKeypair.publicKey.toBase58(),
        recentBlockhash: blockhash,
        lastValidBlockHeight,
        settlementTransactionBase64: transactionBase64,
        updatedAt: new Date()
      }
    },
    { new: true }
  ).lean();

  if (!updated || !updated.expectedCoreAsset || !updated.settlementAttemptId) {
    throw new SporeDomainError("claim_conflict", "Unable to prepare settlement attempt.");
  }

  return {
    kind: "needs_signature",
    reservation: updated,
    transactionBase64,
    expectedCoreAsset: updated.expectedCoreAsset,
    attemptId: updated.settlementAttemptId,
    lastValidBlockHeight,
    birthFeeLamports: species.birthFeeLamports,
    treasury: species.treasury
  };
}

/**
 * TEMPORARY diagnostic gate: only return a cached/prepared settlement tx after
 * simulating it with sigVerify disabled (recipient signature not present yet).
 * On failure, keep the reservation recoverable in settling and do not abandon.
 */
async function finalizeNeedsSignatureAfterSimulation(input: {
  connection: Connection;
  transactionBase64: string;
  reservation: ClaimReservation;
  expectedCoreAsset: string;
  attemptId: string;
  lastValidBlockHeight: number;
  birthFeeLamports: string;
  treasury: string;
}): Promise<Extract<BuildClaimSettlementResult, { kind: "needs_signature" }>> {
  const transaction = Transaction.from(
    Buffer.from(input.transactionBase64, "base64")
  );

  await assertSettlementTransactionSimulates({
    connection: input.connection,
    transaction,
    reservationId: input.reservation.reservationId,
    attemptId: input.attemptId,
    expectedCoreAsset: input.expectedCoreAsset,
    lastValidBlockHeight: input.lastValidBlockHeight
  });

  return {
    kind: "needs_signature",
    reservation: input.reservation,
    transactionBase64: input.transactionBase64,
    expectedCoreAsset: input.expectedCoreAsset,
    attemptId: input.attemptId,
    lastValidBlockHeight: input.lastValidBlockHeight,
    birthFeeLamports: input.birthFeeLamports,
    treasury: input.treasury
  };
}

/**
 * TEMPORARY: simulate the exact settlement transaction that would be sent to mobile.
 * Does not mutate instructions, fee payer, blockhash, or signer layout.
 * Uses VersionedTransaction + sigVerify:false because the recipient fee-payer
 * signature is not present yet (legacy Transaction.simulateTransaction replaces blockhash).
 */
async function assertSettlementTransactionSimulates(input: {
  connection: Connection;
  transaction: Transaction;
  reservationId: string;
  attemptId: string;
  expectedCoreAsset: string;
  lastValidBlockHeight: number;
}): Promise<void> {
  const instructionProgramIds = input.transaction.instructions.map((ix) =>
    ix.programId.toBase58()
  );
  const currentBlockHeight = await input.connection.getBlockHeight("confirmed");
  const versioned = toVersionedTransactionForSimulation(input.transaction);

  let simulation;
  try {
    simulation = await input.connection.simulateTransaction(versioned, {
      sigVerify: false,
      replaceRecentBlockhash: false,
      commitment: "confirmed"
    });
  } catch (error) {
    console.error("[SPØR SETTLEMENT SIM]", {
      phase: "rpc_error",
      reservationId: input.reservationId,
      attemptId: input.attemptId,
      expectedCoreAsset: input.expectedCoreAsset,
      lastValidBlockHeight: input.lastValidBlockHeight,
      currentBlockHeight,
      instructionProgramIds,
      rpcError:
        error instanceof Error ? error.message : "unknown_simulation_rpc_error"
    });
    throw new SporeDomainError(
      "settlement_simulation_failed",
      "Settlement transaction failed simulation."
    );
  }

  const { err, logs, unitsConsumed } = simulation.value;

  console.error("[SPØR SETTLEMENT SIM]", {
    phase: err ? "failed" : "ok",
    reservationId: input.reservationId,
    attemptId: input.attemptId,
    expectedCoreAsset: input.expectedCoreAsset,
    lastValidBlockHeight: input.lastValidBlockHeight,
    currentBlockHeight,
    instructionProgramIds,
    err,
    logs,
    unitsConsumed,
    slot: simulation.context.slot
  });

  if (err) {
    throw new SporeDomainError(
      "settlement_simulation_failed",
      "Settlement transaction failed simulation."
    );
  }
}

/**
 * Convert a partially signed legacy Transaction into VersionedTransaction for
 * config-based simulation without replacing blockhash or mutating the original.
 */
function toVersionedTransactionForSimulation(
  transaction: Transaction
): VersionedTransaction {
  if (!transaction.feePayer || !transaction.recentBlockhash) {
    throw new SporeDomainError(
      "settlement_simulation_failed",
      "Settlement transaction failed simulation."
    );
  }

  const message = transaction.compileMessage();
  const versioned = new VersionedTransaction(message);

  for (let i = 0; i < message.header.numRequiredSignatures; i += 1) {
    const accountKey = message.accountKeys[i];
    const signed = transaction.signatures.find((entry) =>
      entry.publicKey.equals(accountKey)
    );

    if (signed?.signature) {
      versioned.signatures[i] = signed.signature;
    }
  }

  return versioned;
}

/**
 * Independently verify a recipient settlement signature, then allocate immutable
 * organism number/genome using the settlement transaction slot + blockTime.
 */
export async function confirmClaimSettlement(input: {
  seeker: AuthenticatedSeeker;
  reservationId: string;
  transactionSignature: string;
}): Promise<ClaimReservation> {
  await connectToDatabase();
  await assertCurrentSgtOwnership(input.seeker);

  const reservation = await loadActiveReservationForRecipient(
    input.reservationId,
    input.seeker.sgtMint
  );

  if (reservation.recipientWalletAddress !== input.seeker.walletAddress) {
    throw new SporeDomainError(
      "claim_conflict",
      "This reservation is bound to a different wallet session."
    );
  }

  if (reservation.status === CLAIM_RESERVATION_STATUS.settled) {
    if (reservation.settlementSignature === input.transactionSignature) {
      return reservation;
    }

    throw new SporeDomainError(
      "settlement_invalid",
      "Reservation already settled with a different signature."
    );
  }

  if (reservation.status === CLAIM_RESERVATION_STATUS.finalized) {
    if (
      reservation.settlementSignature &&
      reservation.settlementSignature !== input.transactionSignature
    ) {
      throw new SporeDomainError(
        "settlement_invalid",
        "Reservation already settled with a different signature."
      );
    }

    return reservation;
  }

  if (
    reservation.status !== CLAIM_RESERVATION_STATUS.settling &&
    reservation.status !== CLAIM_RESERVATION_STATUS.reserved
  ) {
    throw new SporeDomainError(
      "settlement_not_ready",
      "Reservation is not awaiting settlement."
    );
  }

  if (!reservation.expectedCoreAsset || !reservation.settlementAttemptId) {
    throw new SporeDomainError(
      "settlement_not_ready",
      "No settlement attempt is prepared."
    );
  }

  const species = await getCanonicalSpecies();
  const verified = await verifySettlementTransaction({
    reservation,
    transactionSignature: input.transactionSignature,
    treasury: species.treasury,
    birthFeeLamports: species.birthFeeLamports
  });

  // Allocation happens only after chain verification succeeds.
  return allocateSettledOrganismState({
    reservation,
    settlementSignature: input.transactionSignature,
    settlementSlot: verified.slot,
    settlementBlockTime: verified.blockTime
  });
}

export function claimMemoForReservation(reservationId: string) {
  return `${MEMO_PREFIX}${reservationId}`;
}

/**
 * Discover a finalized settlement signature for the reserved Core asset without
 * trusting the mobile client. Returns null when the asset is absent or no
 * signature passes canonical settlement verification.
 */
async function findLandedSettlementSignature(input: {
  reservation: ClaimReservation;
  treasury: string;
  birthFeeLamports: string;
}): Promise<string | null> {
  if (!input.reservation.expectedCoreAsset) {
    return null;
  }

  const connection = getSolanaConnection();
  const expectedAsset = new PublicKey(input.reservation.expectedCoreAsset);
  const account = await connection.getAccountInfo(expectedAsset, "confirmed");

  if (!account) {
    return null;
  }

  if (input.reservation.settlementSignature) {
    try {
      await verifySettlementTransaction({
        reservation: input.reservation,
        transactionSignature: input.reservation.settlementSignature,
        treasury: input.treasury,
        birthFeeLamports: input.birthFeeLamports
      });
      return input.reservation.settlementSignature;
    } catch {
      // Fall through to signature scan.
    }
  }

  const signatures = await connection.getSignaturesForAddress(expectedAsset, {
    limit: LANDED_SETTLEMENT_SIGNATURE_SCAN
  });

  for (const entry of signatures) {
    if (entry.err) {
      continue;
    }

    try {
      await verifySettlementTransaction({
        reservation: input.reservation,
        transactionSignature: entry.signature,
        treasury: input.treasury,
        birthFeeLamports: input.birthFeeLamports
      });
      return entry.signature;
    } catch {
      // Try older signatures until one matches reservation memo + fee + signers.
    }
  }

  // Asset account exists but no finalized matching settlement was found yet.
  // Do not rotate/rebuild the create instruction against an occupied address.
  throw new SporeDomainError(
    "settlement_not_ready",
    "Settlement is confirming on-chain. Refresh and try again."
  );
}

async function verifySettlementTransaction(input: {
  reservation: ClaimReservation;
  transactionSignature: string;
  treasury: string;
  birthFeeLamports: string;
}) {
  const connection = getSolanaConnection();
  const tx = await connection.getTransaction(input.transactionSignature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0
  });

  if (!tx) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Settlement transaction was not found as finalized."
    );
  }

  if (tx.meta?.err) {
    throw new SporeDomainError("settlement_invalid", "Settlement transaction failed.");
  }

  if (tx.blockTime == null || tx.blockTime <= 0) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Settlement transaction is missing blockTime."
    );
  }

  const accountKeys = tx.transaction.message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses
  });
  const recipient = new PublicKey(input.reservation.recipientWalletAddress);
  const expectedAsset = new PublicKey(input.reservation.expectedCoreAsset!);
  const treasury = new PublicKey(input.treasury);
  const feeLamports = BigInt(input.birthFeeLamports);

  const accountIndex = (pubkey: PublicKey) => {
    for (let i = 0; i < accountKeys.length; i += 1) {
      if (accountKeys.get(i)?.equals(pubkey)) {
        return i;
      }
    }

    return -1;
  };

  const recipientIndex = accountIndex(recipient);
  const assetIndex = accountIndex(expectedAsset);
  const treasuryIndex = feeLamports > 0n ? accountIndex(treasury) : -1;

  if (recipientIndex < 0 || assetIndex < 0) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Settlement transaction is missing required accounts."
    );
  }

  if (feeLamports > 0n && treasuryIndex < 0) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Settlement transaction is missing the canonical treasury."
    );
  }

  const header = tx.transaction.message.header;
  if (recipientIndex >= header.numRequiredSignatures) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Recipient did not sign the settlement transaction."
    );
  }

  if (assetIndex >= header.numRequiredSignatures) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Expected Core asset did not sign the settlement transaction."
    );
  }

  if (feeLamports > 0n) {
    const pre = tx.meta?.preBalances?.[treasuryIndex];
    const post = tx.meta?.postBalances?.[treasuryIndex];

    if (pre == null || post == null || BigInt(post - pre) !== feeLamports) {
      throw new SporeDomainError(
        "settlement_invalid",
        "Canonical treasury did not receive the exact birth fee."
      );
    }
  }

  const memo = claimMemoForReservation(input.reservation.reservationId);
  const parsed = await connection.getParsedTransaction(input.transactionSignature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0
  });

  if (!parsed) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Settlement transaction was not found as finalized."
    );
  }

  const memoOk = parsed.transaction.message.instructions.some((ix) => {
    if ("parsed" in ix) {
      return (
        ix.program === "spl-memo" &&
        typeof ix.parsed === "string" &&
        ix.parsed.includes(memo)
      );
    }

    return (
      ix.programId.equals(MEMO_PROGRAM_ID) &&
      Buffer.from(ix.data, "base64").toString("utf8").includes(memo)
    );
  });

  if (!memoOk) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Settlement transaction is missing the reservation memo."
    );
  }

  const umi = createUmi(getHeliusRpcUrl()).use(mplCore());
  const asset = await fetchAsset(umi, umiPublicKey(expectedAsset.toBase58()));

  if (asset.owner !== umiPublicKey(recipient.toBase58())) {
    throw new SporeDomainError(
      "settlement_invalid",
      "Core asset owner is not the recipient."
    );
  }

  const freeze = asset.permanentFreezeDelegate;

  if (!freeze || freeze.frozen !== true || freeze.authority.type !== "None") {
    throw new SporeDomainError(
      "settlement_invalid",
      "Core asset is missing a frozen PermanentFreezeDelegate."
    );
  }

  if (freeze.authority.type !== "None") {
    throw new SporeDomainError(
      "settlement_invalid",
      "PermanentFreezeDelegate authority must be None."
    );
  }

  return {
    slot: BigInt(tx.slot),
    blockTime: tx.blockTime
  };
}

async function allocateSettledOrganismState(input: {
  reservation: ClaimReservation;
  settlementSignature: string;
  settlementSlot: bigint;
  settlementBlockTime: number;
}): Promise<ClaimReservation> {
  const mongoose = await import("mongoose");
  const {
    checkedChildGeneration,
    checkedIncrementU64,
    mutateChildGenome
  } = await import("./core");
  const { deriveOrganismIdentity, pubkeyToBytes } = await import("./encoding");
  const { bytesToHex, hexToBytes } = await import("./bytes");
  const { CANONICAL_SPECIES_KEY, SpeciesStateModel } = await import("../models/SpeciesState");

  const parent = await OrganismIndexModel.findOne({
    organismPda: input.reservation.parentOrganismPda,
    ...finalizedOrganismFilter
  }).lean();

  if (!parent) {
    throw new SporeDomainError("invalid_parent", "Parent organism not found.");
  }

  const normalizedParent = await ensureReproductionFields(parent);
  const session = await mongoose.default.startSession();

  try {
    let settled: ClaimReservation | null = null;

    await session.withTransaction(async () => {
      const live = await ClaimReservationModel.findOne({
        reservationId: input.reservation.reservationId
      })
        .session(session)
        .lean();

      if (!live) {
        throw new SporeDomainError("claim_conflict", "Reservation disappeared.");
      }

      if (live.status === CLAIM_RESERVATION_STATUS.settled || live.status === CLAIM_RESERVATION_STATUS.finalized) {
        if (
          live.settlementSignature &&
          live.settlementSignature !== input.settlementSignature
        ) {
          throw new SporeDomainError(
            "settlement_invalid",
            "Reservation already settled with a different signature."
          );
        }
        settled = live;
        return;
      }

      const existingOrganism = await OrganismIndexModel.findOne({
        sgtMint: input.reservation.recipientSgtMint,
        ...finalizedOrganismFilter
      })
        .session(session)
        .lean();

      if (existingOrganism) {
        throw new SporeDomainError(
          "organism_already_exists",
          "This Seeker already owns an organism."
        );
      }

      const species = await SpeciesStateModel.findOne({ key: CANONICAL_SPECIES_KEY })
        .session(session)
        .lean();

      if (!species) {
        throw new SporeDomainError("species_not_ready", "Canonical species state is not initialized.");
      }

      const childNumber = species.nextOrganismNumber;
      const nextOrganismNumber = checkedIncrementU64(BigInt(childNumber));
      const generation = checkedChildGeneration(normalizedParent.generation);

      if (nextOrganismNumber === null || generation === null) {
        throw new SporeDomainError("math_overflow", "Organism counter overflow.");
      }

      const bornAtUnix = input.settlementBlockTime;
      const genomeBytes = mutateChildGenome({
        parentGenome: hexToBytes(normalizedParent.genome),
        parentOrganism: pubkeyToBytes(normalizedParent.organismPda),
        recipientSgtMint: pubkeyToBytes(input.reservation.recipientSgtMint),
        childNumber: BigInt(childNumber),
        slot: input.settlementSlot,
        bornAt: BigInt(bornAtUnix)
      });

      const speciesUpdate = await SpeciesStateModel.updateOne(
        {
          key: CANONICAL_SPECIES_KEY,
          nextOrganismNumber: childNumber
        },
        {
          $set: {
            nextOrganismNumber: nextOrganismNumber.toString(),
            updatedAt: new Date()
          }
        },
        { session }
      );

      if (speciesUpdate.modifiedCount !== 1) {
        throw new SporeDomainError("claim_conflict", "Organism number allocation conflict.");
      }

      const updated = await ClaimReservationModel.findOneAndUpdate(
        {
          reservationId: input.reservation.reservationId,
          status: {
            $in: [CLAIM_RESERVATION_STATUS.settling, CLAIM_RESERVATION_STATUS.reserved]
          }
        },
        {
          $set: {
            status: CLAIM_RESERVATION_STATUS.settled,
            settlementSignature: input.settlementSignature,
            settlementSlot: input.settlementSlot.toString(),
            settlementBlockTime: bornAtUnix,
            organismNumber: childNumber,
            generation,
            genome: bytesToHex(genomeBytes),
            bornAt: dateFromUnixSeconds(bornAtUnix),
            mutationSlot: input.settlementSlot.toString(),
            childOrganismPda: deriveOrganismIdentity(input.reservation.recipientSgtMint),
            updatedAt: new Date()
          }
        },
        { new: true, session }
      ).lean();

      if (!updated) {
        throw new SporeDomainError("claim_conflict", "Unable to commit settled reservation.");
      }

      settled = updated;
    });

    if (!settled) {
      throw new SporeDomainError("claim_conflict", "Unable to allocate organism state.");
    }

    return settled;
  } finally {
    await session.endSession();
  }
}

async function loadActiveReservationForRecipient(
  reservationId: string,
  recipientSgtMint: string
) {
  const reservation = await ClaimReservationModel.findOne({
    reservationId,
    recipientSgtMint,
    status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES, CLAIM_RESERVATION_STATUS.finalized] }
  }).lean();

  if (!reservation) {
    throw new SporeDomainError("organism_not_found", "Claim reservation not found.");
  }

  return reservation;
}

async function assertReservationOfferStillValid(reservation: ClaimReservation) {
  const parent = await OrganismIndexModel.findOne({
    organismPda: reservation.parentOrganismPda,
    ...finalizedOrganismFilter
  }).lean();

  if (!parent) {
    throw new SporeDomainError("invalid_parent", "Parent organism not found.");
  }

  const normalized = await ensureReproductionFields(parent);
  const nowSeconds = unixSecondsNow();

  if (normalized.activeSporeCommitment !== reservation.sporeCommitment) {
    throw new SporeDomainError(
      "claim_conflict",
      "Parent spore offer no longer matches this reservation."
    );
  }

  if (
    normalized.activeClaimReservationId &&
    normalized.activeClaimReservationId !== reservation.reservationId
  ) {
    throw new SporeDomainError(
      "claim_conflict",
      "Parent spore offer is reserved by another claim."
    );
  }

  // Settling reservations already won the offer lock; allow blockhash refresh
  // after the public QR TTL so a slow wallet can still confirm.
  if (reservation.status === CLAIM_RESERVATION_STATUS.settling) {
    if (normalized.activeClaimReservationId !== reservation.reservationId) {
      throw new SporeDomainError(
        "claim_conflict",
        "Parent spore offer is no longer locked to this reservation."
      );
    }

    return;
  }

  if (
    !hasLiveSpore(
      hexToBytes(normalized.activeSporeCommitment),
      BigInt(unixSecondsFromDate(normalized.activeSporeExpiresAt)),
      BigInt(nowSeconds)
    )
  ) {
    throw new SporeDomainError("spore_offer_expired", "Spore offer has expired.");
  }
}

async function assertCurrentSgtOwnership(seeker: AuthenticatedSeeker) {
  let verified;

  try {
    verified = await verifySeekerGenesisToken(seeker.walletAddress, {
      expectedMintAddress: seeker.sgtMint
    });
  } catch (error) {
    if (error instanceof SgtVerificationUnavailableError) {
      throw new SporeDomainError(
        "verification_unavailable",
        "SGT verification is unavailable."
      );
    }

    throw error;
  }

  if (!verified || verified.mintAddress !== seeker.sgtMint) {
    throw new SporeDomainError(
      "not_seeker",
      "Wallet no longer holds this Seeker Genesis Token."
    );
  }
}
