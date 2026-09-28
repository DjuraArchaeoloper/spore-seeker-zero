import mongoose, { Schema, type Model } from "mongoose";

const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const GENOME_HEX_PATTERN = /^[0-9a-f]{32}$/;
const COMMITMENT_HEX_PATTERN = /^[0-9a-f]{64}$/;
const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;

export const ORGANISM_STATUS = {
  pending: "pending",
  finalized: "finalized",
  abandoned: "abandoned",
} as const;

export type OrganismStatus =
  (typeof ORGANISM_STATUS)[keyof typeof ORGANISM_STATUS];

export const ORGANISM_BIRTH_ERA = {
  serverV1: "server_v1",
  anchorLegacy: "anchor_legacy",
} as const;

export type OrganismBirthEra =
  (typeof ORGANISM_BIRTH_ERA)[keyof typeof ORGANISM_BIRTH_ERA];

export const ORGANISM_INDEX_SCHEMA_VERSION = 1;
export const GENOME_ALGORITHM_VERSION = "spore-core-v1";

export type OrganismIndex = {
  /**
   * Namespace-derived organism identity (historically named organismPda).
   * Derived from `["organism", sgtMint]` under identityNamespaceProgramId for
   * cross-era compatibility. Server-era births do not create or prove a custom
   * SPØR Organism account on-chain.
   */
  organismPda: string;
  /** Canonical permanent organism identity. */
  sgtMint: string;
  organismNumber: string;
  parentOrganismPda: string | null;
  parentSgtMint: string | null;
  parentOrganismNumber: string | null;
  generation: number;
  genome: string;
  bornAt: Date;
  /** Unix seconds matching immutable Core metadata and future on-chain import. */
  bornAtUnix: string;
  /** Program id namespace used to derive organismPda for this server-era record. */
  identityNamespaceProgramId: string;
  birthEra: OrganismBirthEra;
  schemaVersion: number;
  genomeAlgorithmVersion: string;
  /** Solana slot used as mutation entropy. Null for legacy indexed births. */
  mutationSlot: string | null;
  nextSporeAt: Date;
  /** Hex-encoded 32-byte commitment. All zeros = no active offer. */
  activeSporeCommitment: string;
  activeSporeExpiresAt: Date;
  /**
   * Commitment that was consumed on successful finalization.
   * Never stores the plaintext secret.
   */
  claimedOfferCommitment: string | null;
  /**
   * Active claim reservation id for the current spore offer, if any.
   * Offer commitment remains until settlement finalizes.
   */
  activeClaimReservationId: string | null;
  status: OrganismStatus;
  /** Set when Core birth certificate exists. Null while pending. */
  coreAsset: string | null;
  /** Settlement / birth tx. Null while pending. */
  transactionSignature: string | null;
  ancestorNumbers: string[];
  indexedAt: Date;
  createdAt: Date;
};

const publicKeyField = {
  type: String,
  required: true,
  minlength: PUBLIC_KEY_MIN_LENGTH,
  maxlength: PUBLIC_KEY_MAX_LENGTH,
};

const optionalPublicKeyField = {
  type: String,
  default: null,
  minlength: PUBLIC_KEY_MIN_LENGTH,
  maxlength: PUBLIC_KEY_MAX_LENGTH,
};

const organismIndexSchema = new Schema<OrganismIndex>(
  {
    organismPda: {
      ...publicKeyField,
      unique: true,
    },
    organismNumber: {
      type: String,
      required: true,
      unique: true,
      match: DECIMAL_U64_PATTERN,
    },
    sgtMint: {
      ...publicKeyField,
      unique: true,
    },
    parentOrganismPda: {
      type: String,
      default: null,
      minlength: PUBLIC_KEY_MIN_LENGTH,
      maxlength: PUBLIC_KEY_MAX_LENGTH,
      index: true,
    },
    parentSgtMint: {
      ...optionalPublicKeyField,
    },
    parentOrganismNumber: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null) {
          return value === null || DECIMAL_U64_PATTERN.test(value);
        },
      },
    },
    generation: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    genome: {
      type: String,
      required: true,
      match: GENOME_HEX_PATTERN,
    },
    bornAt: {
      type: Date,
      required: true,
    },
    bornAtUnix: {
      type: String,
      required: true,
      match: DECIMAL_U64_PATTERN,
    },
    identityNamespaceProgramId: {
      ...publicKeyField,
    },
    birthEra: {
      type: String,
      required: true,
      enum: Object.values(ORGANISM_BIRTH_ERA),
      default: ORGANISM_BIRTH_ERA.serverV1,
    },
    schemaVersion: {
      type: Number,
      required: true,
      min: 1,
      default: ORGANISM_INDEX_SCHEMA_VERSION,
      validate: {
        validator(value: number) {
          return Number.isInteger(value);
        },
      },
    },
    genomeAlgorithmVersion: {
      type: String,
      required: true,
      default: GENOME_ALGORITHM_VERSION,
    },
    mutationSlot: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null) {
          return value === null || DECIMAL_U64_PATTERN.test(value);
        },
      },
    },
    nextSporeAt: {
      type: Date,
      required: true,
    },
    activeSporeCommitment: {
      type: String,
      required: true,
      match: COMMITMENT_HEX_PATTERN,
    },
    activeSporeExpiresAt: {
      type: Date,
      required: true,
    },
    claimedOfferCommitment: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null) {
          return value === null || COMMITMENT_HEX_PATTERN.test(value);
        },
      },
    },
    activeClaimReservationId: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null) {
          return value === null || /^[0-9a-f]{64}$/.test(value);
        },
      },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ORGANISM_STATUS),
      index: true,
    },
    coreAsset: {
      ...optionalPublicKeyField,
      sparse: true,
      unique: true,
      validate: {
        validator(value: string | null) {
          const document = this as { status?: OrganismStatus };
          return document.status !== ORGANISM_STATUS.finalized || value !== null;
        },
        message: "Finalized organisms require a Core asset.",
      },
    },
    transactionSignature: {
      type: String,
      default: null,
    },
    ancestorNumbers: {
      type: [String],
      required: true,
      default: [],
      index: true,
    },
    indexedAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
    collection: "organism_indices",
  },
);

export const OrganismIndexModel =
  (mongoose.models.OrganismIndex as Model<OrganismIndex> | undefined) ??
  mongoose.model<OrganismIndex>("OrganismIndex", organismIndexSchema);
