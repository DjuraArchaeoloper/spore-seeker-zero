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

export type OrganismIndex = {
  /**
   * Logical organism identity (historically named organismPda).
   * Derived from Anchor PDA seeds for cross-era compatibility, but server-era
   * births do not create or require a custom SPØR Organism account on-chain.
   */
  organismPda: string;
  organismNumber: string;
  sgtMint: string;
  parentOrganismPda: string | null;
  generation: number;
  genome: string;
  bornAt: Date;
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
