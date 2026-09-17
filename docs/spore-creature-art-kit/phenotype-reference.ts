/**
 * Documentation shim only.
 *
 * The live genome -> phenotype implementation is packages/shared/src/genome.ts.
 * Keep this file as a pointer for older art-kit docs; do not fork formulas here.
 */

export {
  BODY_FAMILY_BUCKETS,
  BODY_FAMILY_BY_BUCKET,
  BODY_FAMILY_BY_SLOT,
  BODY_FAMILY_SLOTS,
  deriveSporePhenotype,
  describeMutation,
  GENOME_GENES,
  genomeToHex,
  mix8,
  parseGenomeHex,
  phenotypeFromGenome,
  resolveCreatureFamily,
  SEEKER_ZERO_GENOME,
  SEEKER_ZERO_GENOME_HEX,
  validateGenomeBytes,
  type AppendageMode,
  type CoreMode,
  type CreatureFamily,
  type GenomeBytes,
  type GenomeGene,
  type GenomeInput,
  type MutationDescription,
  type OrganismPhenotype,
  type SurfaceMode
} from "../../packages/shared/src/genome";
