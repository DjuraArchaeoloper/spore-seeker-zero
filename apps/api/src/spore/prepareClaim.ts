import crypto from "crypto";
import mongoose from "mongoose";

import type { AuthenticatedSeeker } from "../auth/session";
import {
  SgtVerificationUnavailableError,
  verifySeekerGenesisToken
} from "../auth/sgt";
import { connectToDatabase } from "../db/mongoose";
import {
  ACTIVE_CLAIM_RESERVATION_STATUSES,
  CLAIM_RESERVATION_STATUS,
  ClaimReservationModel,
  type ClaimReservation
} from "../models/ClaimReservation";
import {
  OrganismIndexModel,
  type OrganismIndex
} from "../models/OrganismIndex";
import {
  EMPTY_SPORE_COMMITMENT_HEX,
  assertSporeSecret,
  bytesToHex,
  hexToBytes,
  unixSecondsFromDate,
  unixSecondsNow
} from "./bytes";
import {
  commitSporeSecret,
  hasLiveSpore,
  sporeSecretMatches
} from "./core";
import { SporeDomainError } from "./errors";
import { finalizeClaimBirth } from "./finalizeBirth";
import {
  finalizedOrganismFilter,
  ensureReproductionFields
} from "./organismState";
import { getCanonicalSpecies } from "./species";

export type ClaimReservationResult = {
  reservation: ClaimReservation;
  parent: OrganismIndex;
  birthFeeLamports: string;
  treasury: string;
  /** Present when the claim is already settled/finalized and recovery completed. */
  organism?: OrganismIndex;
};

/**
 * Reserve a live spore offer for settlement.
 * Does not allocate organism numbers, mutate genomes, consume the offer,
 * start cooldown, or create a canonical organism.
 */
export async function prepareClaimSpore(input: {
  seeker: AuthenticatedSeeker;
  parentOrganismPda: string;
  secret: Uint8Array;
}): Promise<ClaimReservationResult> {
  await connectToDatabase();

  try {
    assertSporeSecret(input.secret);
  } catch {
    throw new SporeDomainError("invalid_spore_secret", "Invalid spore secret.");
  }

  await assertCurrentSgtOwnership(input.seeker);

  const existingOrganism = await OrganismIndexModel.findOne({
    sgtMint: input.seeker.sgtMint,
    ...finalizedOrganismFilter
  }).lean();

  if (existingOrganism) {
    throw new SporeDomainError(
      "organism_already_exists",
      "This Seeker already owns an organism."
    );
  }

  const offerCommitmentHex = bytesToHex(commitSporeSecret(input.secret));
  const reservationId = buildReservationId({
    parentOrganismPda: input.parentOrganismPda,
    sporeCommitment: offerCommitmentHex,
    recipientSgtMint: input.seeker.sgtMint
  });

  const existingReservation = await ClaimReservationModel.findOne({
    reservationId
  }).lean();

  if (existingReservation) {
    if (
      existingReservation.status === CLAIM_RESERVATION_STATUS.reserved ||
      existingReservation.status === CLAIM_RESERVATION_STATUS.settling
    ) {
      return resumeReservation({
        reservation: existingReservation,
        seeker: input.seeker,
        secret: input.secret
      });
    }

    if (
      existingReservation.status === CLAIM_RESERVATION_STATUS.settled ||
      existingReservation.status === CLAIM_RESERVATION_STATUS.finalized
    ) {
      return resumeCompletedReservation({
        reservation: existingReservation,
        seeker: input.seeker,
        secret: input.secret
      });
    }

    // Abandoned reservations may be recreated for the same deterministic id
    // only while the parent offer is still live (validated below).
  }

  const parent = await loadFinalizedParent(input.parentOrganismPda);
  const species = await getCanonicalSpecies();

  assertSpeciesReadyForReproduction(species);
  assertNotSelfReproduction(parent.sgtMint, input.seeker.sgtMint);

  const nowSeconds = unixSecondsNow();
  assertParentOfferReady(parent, input.secret, nowSeconds);

  if (
    parent.activeClaimReservationId &&
    parent.activeClaimReservationId !== reservationId
  ) {
    const foreign = await ClaimReservationModel.findOne({
      reservationId: parent.activeClaimReservationId,
      status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES] }
    }).lean();

    if (foreign) {
      throw new SporeDomainError(
        "claim_conflict",
        "This spore offer is already reserved."
      );
    }
  }

  const preparedAt = new Date();
  const session = await mongoose.startSession();

  try {
    let result: ClaimReservationResult | null = null;

    await session.withTransaction(async () => {
      await clearStaleParentReservation(parent.organismPda, reservationId, session);

      const lockNow = new Date();
      const reservedParent = await OrganismIndexModel.findOneAndUpdate(
        {
          organismPda: parent.organismPda,
          sgtMint: { $ne: input.seeker.sgtMint },
          activeSporeCommitment: offerCommitmentHex,
          activeSporeExpiresAt: { $gte: lockNow },
          nextSporeAt: { $lte: lockNow },
          $or: [
            { activeClaimReservationId: null },
            { activeClaimReservationId: { $exists: false } },
            { activeClaimReservationId: reservationId }
          ]
        },
        {
          $set: {
            activeClaimReservationId: reservationId
          }
        },
        { new: true, session }
      ).lean();

      if (!reservedParent) {
        throw new SporeDomainError(
          "claim_conflict",
          "This spore offer is no longer available."
        );
      }

      const reservationDocument: ClaimReservation = {
        reservationId,
        parentOrganismPda: parent.organismPda,
        parentSgtMint: parent.sgtMint,
        recipientSgtMint: input.seeker.sgtMint,
        recipientWalletAddress: input.seeker.walletAddress,
        sporeCommitment: offerCommitmentHex,
        status: CLAIM_RESERVATION_STATUS.reserved,
        preparedAt,
        updatedAt: preparedAt,
        settlementAttemptId: null,
        expectedCoreAsset: null,
        recentBlockhash: null,
        lastValidBlockHeight: null,
        settlementTransactionBase64: null,
        settlementSignature: null,
        settlementSlot: null,
        settlementBlockTime: null,
        organismNumber: null,
        generation: null,
        genome: null,
        bornAt: null,
        mutationSlot: null,
        childOrganismPda: null,
        coreFinalizationSignature: null
      };

      try {
        await ClaimReservationModel.findOneAndUpdate(
          { reservationId },
          {
            $set: reservationDocument
          },
          {
            upsert: true,
            new: true,
            session,
            setDefaultsOnInsert: true
          }
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new SporeDomainError(
            "claim_conflict",
            "This spore offer is already reserved."
          );
        }

        throw error;
      }

      result = {
        reservation: reservationDocument,
        parent: await ensureReproductionFields(reservedParent),
        birthFeeLamports: species.birthFeeLamports,
        treasury: species.treasury
      };
    });

    if (!result) {
      throw new SporeDomainError("claim_conflict", "Unable to reserve claim.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Abandon a reservation and free the parent offer for another valid claimant
 * (if the offer is still within its normal TTL / readiness rules).
 * Settled/finalized births cannot be abandoned.
 */
export async function abandonPreparedClaim(input: {
  seeker: AuthenticatedSeeker;
  reservationId: string;
}): Promise<ClaimReservation> {
  await connectToDatabase();
  await assertCurrentSgtOwnership(input.seeker);

  if (!/^[0-9a-f]{64}$/.test(input.reservationId)) {
    throw new SporeDomainError("claim_conflict", "Invalid reservation.");
  }

  const session = await mongoose.startSession();

  try {
    let abandoned: ClaimReservation | null = null;

    await session.withTransaction(async () => {
      const existing = await ClaimReservationModel.findOne({
        reservationId: input.reservationId,
        recipientSgtMint: input.seeker.sgtMint
      })
        .session(session)
        .lean();

      if (!existing) {
        throw new SporeDomainError(
          "organism_not_found",
          "No claim reservation found to abandon."
        );
      }

      if (
        existing.status === CLAIM_RESERVATION_STATUS.settled ||
        existing.status === CLAIM_RESERVATION_STATUS.finalized
      ) {
        throw new SporeDomainError(
          "claim_conflict",
          "A settled birth cannot be abandoned."
        );
      }

      // Once settlement is prepared, recovery is confirm-only — never abandon
      // a possibly-broadcast transaction by rotating/freeing the offer.
      if (existing.status !== CLAIM_RESERVATION_STATUS.reserved) {
        throw new SporeDomainError(
          "claim_conflict",
          "Settlement already prepared; confirm instead of abandoning."
        );
      }

      if (existing.settlementSignature) {
        throw new SporeDomainError(
          "claim_conflict",
          "A settled birth cannot be abandoned."
        );
      }

      const reservation = await ClaimReservationModel.findOneAndUpdate(
        {
          reservationId: input.reservationId,
          recipientSgtMint: input.seeker.sgtMint,
          status: CLAIM_RESERVATION_STATUS.reserved
        },
        {
          $set: {
            status: CLAIM_RESERVATION_STATUS.abandoned,
            settlementTransactionBase64: null,
            updatedAt: new Date()
          }
        },
        { new: true, session }
      ).lean();

      if (!reservation) {
        throw new SporeDomainError(
          "organism_not_found",
          "No active claim reservation found to abandon."
        );
      }

      await OrganismIndexModel.updateOne(
        {
          organismPda: reservation.parentOrganismPda,
          activeClaimReservationId: reservation.reservationId
        },
        {
          $set: {
            activeClaimReservationId: null
          }
        },
        { session }
      );

      abandoned = reservation;
    });

    if (!abandoned) {
      throw new SporeDomainError(
        "organism_not_found",
        "No active claim reservation found to abandon."
      );
    }

    return abandoned;
  } finally {
    await session.endSession();
  }
}

async function resumeReservation(input: {
  reservation: ClaimReservation;
  seeker: AuthenticatedSeeker;
  secret: Uint8Array;
}): Promise<ClaimReservationResult> {
  if (input.reservation.recipientSgtMint !== input.seeker.sgtMint) {
    throw new SporeDomainError(
      "claim_conflict",
      "This spore offer is already reserved."
    );
  }

  if (input.reservation.recipientWalletAddress !== input.seeker.walletAddress) {
    throw new SporeDomainError(
      "claim_conflict",
      "This reservation is bound to a different wallet session."
    );
  }

  if (
    !sporeSecretMatches(
      input.secret,
      hexToBytes(input.reservation.sporeCommitment)
    )
  ) {
    throw new SporeDomainError(
      "claim_conflict",
      "A reservation already exists for a different offer."
    );
  }

  const parent = await loadFinalizedParent(input.reservation.parentOrganismPda);
  const nowSeconds = unixSecondsNow();

  // Offer must still be live for reserved retries. Settling may continue
  // toward confirm even if the QR TTL elapsed after reservation lock.
  if (input.reservation.status === CLAIM_RESERVATION_STATUS.reserved) {
    assertParentOfferReady(parent, input.secret, nowSeconds);
  }

  if (
    parent.activeClaimReservationId &&
    parent.activeClaimReservationId !== input.reservation.reservationId
  ) {
    throw new SporeDomainError(
      "claim_conflict",
      "This spore offer is already reserved."
    );
  }

  if (parent.activeClaimReservationId !== input.reservation.reservationId) {
    await OrganismIndexModel.updateOne(
      {
        organismPda: parent.organismPda,
        activeSporeCommitment: input.reservation.sporeCommitment,
        $or: [
          { activeClaimReservationId: null },
          { activeClaimReservationId: { $exists: false } },
          { activeClaimReservationId: input.reservation.reservationId }
        ]
      },
      {
        $set: {
          activeClaimReservationId: input.reservation.reservationId
        }
      }
    );
  }

  const species = await getCanonicalSpecies();

  return {
    reservation: input.reservation,
    parent,
    birthFeeLamports: species.birthFeeLamports,
    treasury: species.treasury
  };
}

async function resumeCompletedReservation(input: {
  reservation: ClaimReservation;
  seeker: AuthenticatedSeeker;
  secret: Uint8Array;
}): Promise<ClaimReservationResult> {
  if (input.reservation.recipientSgtMint !== input.seeker.sgtMint) {
    throw new SporeDomainError(
      "claim_conflict",
      "This spore offer is already reserved."
    );
  }

  if (input.reservation.recipientWalletAddress !== input.seeker.walletAddress) {
    throw new SporeDomainError(
      "claim_conflict",
      "This reservation is bound to a different wallet session."
    );
  }

  if (
    !sporeSecretMatches(
      input.secret,
      hexToBytes(input.reservation.sporeCommitment)
    )
  ) {
    throw new SporeDomainError(
      "claim_conflict",
      "A reservation already exists for a different offer."
    );
  }

  const organism = await finalizeClaimBirth({
    reservationId: input.reservation.reservationId
  });
  const parent = await loadFinalizedParent(input.reservation.parentOrganismPda);
  const species = await getCanonicalSpecies();
  const latest = await ClaimReservationModel.findOne({
    reservationId: input.reservation.reservationId
  }).lean();

  return {
    reservation: latest ?? input.reservation,
    parent,
    birthFeeLamports: species.birthFeeLamports,
    treasury: species.treasury,
    organism
  };
}

async function clearStaleParentReservation(
  parentOrganismPda: string,
  nextReservationId: string,
  session: mongoose.ClientSession
) {
  const parent = await OrganismIndexModel.findOne({ organismPda: parentOrganismPda })
    .session(session)
    .lean();

  if (!parent?.activeClaimReservationId) {
    return;
  }

  if (parent.activeClaimReservationId === nextReservationId) {
    return;
  }

  const existing = await ClaimReservationModel.findOne({
    reservationId: parent.activeClaimReservationId
  })
    .session(session)
    .lean();

  const isStale =
    !existing ||
    !ACTIVE_CLAIM_RESERVATION_STATUSES.includes(
      existing.status as (typeof ACTIVE_CLAIM_RESERVATION_STATUSES)[number]
    );

  if (!isStale) {
    throw new SporeDomainError(
      "claim_conflict",
      "This spore offer is already reserved."
    );
  }

  await OrganismIndexModel.updateOne(
    {
      organismPda: parentOrganismPda,
      activeClaimReservationId: parent.activeClaimReservationId
    },
    {
      $set: {
        activeClaimReservationId: null
      }
    },
    { session }
  );
}

async function loadFinalizedParent(parentOrganismPda: string) {
  const parent = await OrganismIndexModel.findOne({
    organismPda: parentOrganismPda,
    ...finalizedOrganismFilter
  }).lean();

  if (!parent) {
    throw new SporeDomainError("invalid_parent", "Parent organism not found.");
  }

  return ensureReproductionFields(parent);
}

function buildReservationId(input: {
  parentOrganismPda: string;
  sporeCommitment: string;
  recipientSgtMint: string;
}) {
  return crypto
    .createHash("sha256")
    .update(
      `${input.parentOrganismPda}:${input.sporeCommitment}:${input.recipientSgtMint}`,
      "utf8"
    )
    .digest("hex");
}

function assertSpeciesReadyForReproduction(species: {
  seekerZeroOrganismPda: string | null;
  nextOrganismNumber: string;
  totalOrganisms: string;
}) {
  if (
    !species.seekerZeroOrganismPda ||
    species.nextOrganismNumber === "0" ||
    species.totalOrganisms === "0"
  ) {
    throw new SporeDomainError(
      "species_not_ready",
      "Species is not ready for reproduction."
    );
  }
}

function assertNotSelfReproduction(parentSgtMint: string, recipientSgtMint: string) {
  if (parentSgtMint === recipientSgtMint) {
    throw new SporeDomainError(
      "self_reproduction",
      "An organism cannot reproduce into the same SGT."
    );
  }
}

function assertParentOfferReady(
  parent: OrganismIndex,
  secret: Uint8Array,
  nowSeconds: number
) {
  if (
    parent.activeSporeCommitment === EMPTY_SPORE_COMMITMENT_HEX ||
    unixSecondsFromDate(parent.activeSporeExpiresAt) === 0
  ) {
    throw new SporeDomainError("no_active_spore", "No active spore is available.");
  }

  if (nowSeconds > unixSecondsFromDate(parent.activeSporeExpiresAt)) {
    throw new SporeDomainError("spore_offer_expired", "Spore offer has expired.");
  }

  if (!sporeSecretMatches(secret, hexToBytes(parent.activeSporeCommitment))) {
    throw new SporeDomainError("invalid_spore_secret", "Invalid spore secret.");
  }

  if (nowSeconds < unixSecondsFromDate(parent.nextSporeAt)) {
    throw new SporeDomainError("spore_not_ready", "Organism spore is not ready.");
  }

  if (
    !hasLiveSpore(
      hexToBytes(parent.activeSporeCommitment),
      BigInt(unixSecondsFromDate(parent.activeSporeExpiresAt)),
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

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}
