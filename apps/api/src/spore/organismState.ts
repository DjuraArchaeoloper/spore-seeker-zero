import {
  ORGANISM_STATUS,
  OrganismIndexModel,
  type OrganismIndex,
  type OrganismStatus
} from "../models/OrganismIndex";
import {
  EMPTY_SPORE_COMMITMENT_HEX,
  dateFromUnixSeconds,
  unixSecondsFromDate
} from "./bytes";

/** Legacy Helius-indexed docs may omit status; treat them as finalized. */
export function isFinalizedOrganismStatus(
  status: OrganismStatus | undefined | null
): boolean {
  return status === ORGANISM_STATUS.finalized || status == null;
}

export const finalizedOrganismFilter: {
  $or: Array<{ status: string } | { status: { $exists: false } }>;
} = {
  $or: [
    { status: ORGANISM_STATUS.finalized },
    { status: { $exists: false } }
  ]
};

export function normalizeOrganismReproductionState(
  organism: OrganismIndex
): OrganismIndex {
  return {
    ...organism,
    status: organism.status ?? ORGANISM_STATUS.finalized,
    mutationSlot: organism.mutationSlot ?? null,
    nextSporeAt: organism.nextSporeAt ?? organism.bornAt,
    activeSporeCommitment:
      organism.activeSporeCommitment ?? EMPTY_SPORE_COMMITMENT_HEX,
    activeSporeExpiresAt:
      organism.activeSporeExpiresAt ?? dateFromUnixSeconds(0),
    claimedOfferCommitment: organism.claimedOfferCommitment ?? null,
    activeClaimReservationId: organism.activeClaimReservationId ?? null,
    coreAsset: organism.coreAsset ?? null,
    transactionSignature: organism.transactionSignature ?? null,
    createdAt: organism.createdAt ?? organism.indexedAt
  };
}

/**
 * Persist reproduction defaults onto legacy indexed organisms so conditional
 * writes can rely on concrete fields.
 */
export async function ensureReproductionFields(
  organism: OrganismIndex
): Promise<OrganismIndex> {
  const normalized = normalizeOrganismReproductionState(organism);
  const needsBackfill =
    organism.status == null ||
    organism.nextSporeAt == null ||
    organism.activeSporeCommitment == null ||
    organism.activeSporeExpiresAt == null ||
    organism.createdAt == null;

  if (!needsBackfill) {
    return normalized;
  }

  await OrganismIndexModel.updateOne(
    { organismPda: organism.organismPda },
    {
      $set: {
        status: ORGANISM_STATUS.finalized,
        nextSporeAt: normalized.nextSporeAt,
        activeSporeCommitment: normalized.activeSporeCommitment,
        activeSporeExpiresAt: normalized.activeSporeExpiresAt,
        mutationSlot: normalized.mutationSlot,
        claimedOfferCommitment: normalized.claimedOfferCommitment,
        activeClaimReservationId: normalized.activeClaimReservationId,
        createdAt: normalized.createdAt
      }
    }
  );

  return normalized;
}

export function commitmentToBigintExpiry(expiresAt: Date): bigint {
  return BigInt(unixSecondsFromDate(expiresAt));
}
