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
import { SporeDomainError } from "./errors";
import { finalizeClaimBirth } from "./finalizeBirth";
import { finalizedOrganismFilter } from "./organismState";
import {
  buildClaimSettlementTransaction,
  type SettlementTransactionResult
} from "./settlement";

export type ActiveClaimResolution =
  | { kind: "none" }
  | {
      kind: "organism";
      reservation: ClaimReservation;
      organism: OrganismIndex;
    }
  | {
      kind: "needs_signature";
      settlement: SettlementTransactionResult;
    };

/**
 * Discover and recover the signed-in recipient's active claim without the QR secret.
 * Binding is wallet session + verified SGT only (reservation already established).
 */
export async function resolveActiveClaimForRecipient(
  seeker: AuthenticatedSeeker
): Promise<ActiveClaimResolution> {
  await connectToDatabase();
  await assertCurrentSgtOwnership(seeker);

  const existingOrganism = await OrganismIndexModel.findOne({
    sgtMint: seeker.sgtMint,
    ...finalizedOrganismFilter
  }).lean();

  if (existingOrganism) {
    const reservation = await ClaimReservationModel.findOne({
      recipientSgtMint: seeker.sgtMint,
      recipientWalletAddress: seeker.walletAddress,
      status: {
        $in: [
          ...ACTIVE_CLAIM_RESERVATION_STATUSES,
          CLAIM_RESERVATION_STATUS.finalized
        ]
      }
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (reservation) {
      return {
        kind: "organism",
        reservation,
        organism: existingOrganism
      };
    }

    return { kind: "none" };
  }

  const reservation = await ClaimReservationModel.findOne({
    recipientSgtMint: seeker.sgtMint,
    recipientWalletAddress: seeker.walletAddress,
    status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES] }
  }).lean();

  if (!reservation) {
    return { kind: "none" };
  }

  if (reservation.status === CLAIM_RESERVATION_STATUS.settled) {
    const organism = await finalizeClaimBirth({
      reservationId: reservation.reservationId
    });
    const latest = await ClaimReservationModel.findOne({
      reservationId: reservation.reservationId
    }).lean();

    return {
      kind: "organism",
      reservation: latest ?? reservation,
      organism
    };
  }

  // reserved | settling — reuse settlement recovery (landed probe / blockhash refresh).
  const settlement = await buildClaimSettlementTransaction({
    seeker,
    reservationId: reservation.reservationId
  });

  if (settlement.kind === "finalized") {
    return {
      kind: "organism",
      reservation: settlement.reservation,
      organism: settlement.organism
    };
  }

  return {
    kind: "needs_signature",
    settlement
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
