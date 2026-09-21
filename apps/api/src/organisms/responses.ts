import { ORGANISM_STATUS } from "../models/OrganismIndex";
import type { OrganismIndex } from "../models/OrganismIndex";

type OrganismLike = Pick<
  OrganismIndex,
  | "organismPda"
  | "organismNumber"
  | "sgtMint"
  | "parentOrganismPda"
  | "generation"
  | "genome"
  | "bornAt"
  | "coreAsset"
>;

export function toPublicOrganism(
  organism: OrganismLike,
  parent?: Pick<OrganismIndex, "organismPda" | "organismNumber"> | null
) {
  return {
    // organismPda is a logical identity string (compat), not proof of an on-chain account.
    organismPda: organism.organismPda,
    organismNumber: organism.organismNumber,
    sgtMint: organism.sgtMint,
    generation: organism.generation,
    genome: organism.genome,
    parent: parent
      ? {
          organismPda: parent.organismPda,
          organismNumber: parent.organismNumber
        }
      : null,
    parentOrganismPda: organism.parentOrganismPda,
    bornAt: organism.bornAt.toISOString(),
    coreAsset: organism.coreAsset
  };
}

/** Public/read queries should never surface pending or abandoned births. */
export const publicOrganismFilter: {
  $or: Array<{ status: string } | { status: { $exists: false } }>;
} = {
  $or: [
    { status: ORGANISM_STATUS.finalized },
    { status: { $exists: false } }
  ]
};
