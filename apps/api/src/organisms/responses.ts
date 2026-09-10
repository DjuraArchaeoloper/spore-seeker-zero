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
