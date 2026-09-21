import type { AuthenticatedSeeker } from "../auth/session";
import {
  SgtVerificationUnavailableError,
  verifySeekerGenesisToken
} from "../auth/sgt";
import { connectToDatabase } from "../db/mongoose";
import {
  ORGANISM_STATUS,
  OrganismIndexModel,
  type OrganismIndex
} from "../models/OrganismIndex";
import {
  EMPTY_SPORE_COMMITMENT_HEX,
  assertSporeSecret,
  bytesToHex,
  dateFromUnixSeconds,
  unixSecondsFromDate,
  unixSecondsNow
} from "./bytes";
import {
  checkedOfferExpiresAt,
  commitSporeSecret,
  hasLiveSpore
} from "./core";
import { SporeDomainError } from "./errors";
import {
  finalizedOrganismFilter,
  ensureReproductionFields,
  normalizeOrganismReproductionState
} from "./organismState";

export type ReleaseSporeResult = {
  organism: OrganismIndex;
  activeSporeCommitment: string;
  activeSporeExpiresAt: Date;
};

/**
 * Release a spore offer for the authenticated Seeker's organism.
 * Stores SHA-256(secret) only. Uses server time exclusively.
 */
export async function releaseSpore(input: {
  seeker: AuthenticatedSeeker;
  secret: Uint8Array;
}): Promise<ReleaseSporeResult> {
  await connectToDatabase();

  try {
    assertSporeSecret(input.secret);
  } catch {
    throw new SporeDomainError(
      "invalid_spore_secret",
      "Invalid spore secret."
    );
  }

  await assertCurrentSgtOwnership(input.seeker);

  const commitmentHex = bytesToHex(commitSporeSecret(input.secret));

  if (commitmentHex === EMPTY_SPORE_COMMITMENT_HEX) {
    throw new SporeDomainError(
      "invalid_spore_commitment",
      "Invalid spore commitment."
    );
  }

  const nowSeconds = unixSecondsNow();
  const expiresAtSeconds = checkedOfferExpiresAt(BigInt(nowSeconds));

  if (expiresAtSeconds === null) {
    throw new SporeDomainError("math_overflow", "Spore offer expiry overflow.");
  }

  const organism = await OrganismIndexModel.findOne({
    sgtMint: input.seeker.sgtMint,
    ...finalizedOrganismFilter
  }).lean();

  if (!organism) {
    throw new SporeDomainError(
      "organism_not_found",
      "No organism found for this Seeker."
    );
  }

  const normalized = await ensureReproductionFields(organism);

  if (nowSeconds < unixSecondsFromDate(normalized.nextSporeAt)) {
    throw new SporeDomainError("spore_not_ready", "Organism spore is not ready.");
  }

  if (
    hasLiveSpore(
      hexCommitmentBytes(normalized.activeSporeCommitment),
      BigInt(unixSecondsFromDate(normalized.activeSporeExpiresAt)),
      BigInt(nowSeconds)
    )
  ) {
    throw new SporeDomainError(
      "active_spore_already_released",
      "An active spore is already released."
    );
  }

  if (normalized.activeClaimReservationId) {
    const { ClaimReservationModel, ACTIVE_CLAIM_RESERVATION_STATUSES } =
      await import("../models/ClaimReservation");
    const locked = await ClaimReservationModel.findOne({
      reservationId: normalized.activeClaimReservationId,
      status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES] }
    }).lean();

    if (locked) {
      throw new SporeDomainError(
        "claim_conflict",
        "An active claim still holds this spore."
      );
    }
  }

  const expiresAt = dateFromUnixSeconds(expiresAtSeconds);
  const nowDate = dateFromUnixSeconds(nowSeconds);
  const updated = await OrganismIndexModel.findOneAndUpdate(
    {
      sgtMint: input.seeker.sgtMint,
      status: { $ne: ORGANISM_STATUS.pending },
      nextSporeAt: { $lte: nowDate },
      $and: [
        {
          $or: [
            { activeClaimReservationId: null },
            { activeClaimReservationId: { $exists: false } }
          ]
        },
        {
          $or: [
            { activeSporeCommitment: EMPTY_SPORE_COMMITMENT_HEX },
            { activeSporeCommitment: { $exists: false } },
            { activeSporeExpiresAt: { $lt: nowDate } },
            { activeSporeExpiresAt: dateFromUnixSeconds(0) },
            { activeSporeExpiresAt: { $exists: false } }
          ]
        }
      ]
    },
    {
      $set: {
        activeSporeCommitment: commitmentHex,
        activeSporeExpiresAt: expiresAt,
        nextSporeAt: normalized.nextSporeAt,
        status: ORGANISM_STATUS.finalized,
        activeClaimReservationId: null
      }
    },
    { new: true }
  ).lean();

  if (!updated) {
    const latest = await OrganismIndexModel.findOne({
      sgtMint: input.seeker.sgtMint,
      ...finalizedOrganismFilter
    }).lean();

    if (!latest) {
      throw new SporeDomainError(
        "organism_not_found",
        "No organism found for this Seeker."
      );
    }

    const latestNormalized = normalizeOrganismReproductionState(latest);
    const latestNow = unixSecondsNow();

    if (latestNow < unixSecondsFromDate(latestNormalized.nextSporeAt)) {
      throw new SporeDomainError("spore_not_ready", "Organism spore is not ready.");
    }

    if (
      hasLiveSpore(
        hexCommitmentBytes(latestNormalized.activeSporeCommitment),
        BigInt(unixSecondsFromDate(latestNormalized.activeSporeExpiresAt)),
        BigInt(latestNow)
      )
    ) {
      throw new SporeDomainError(
        "active_spore_already_released",
        "An active spore is already released."
      );
    }

    throw new SporeDomainError(
      "claim_conflict",
      "Unable to release spore due to a concurrent update."
    );
  }

  return {
    organism: normalizeOrganismReproductionState(updated),
    activeSporeCommitment: commitmentHex,
    activeSporeExpiresAt: expiresAt
  };
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

function hexCommitmentBytes(commitmentHex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(commitmentHex, "hex"));
}
