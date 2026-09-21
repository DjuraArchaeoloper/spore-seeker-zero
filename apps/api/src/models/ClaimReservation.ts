import mongoose, { Schema, type Model } from "mongoose";

const COMMITMENT_HEX_PATTERN = /^[0-9a-f]{64}$/;
const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{64}$/;
const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const GENOME_HEX_PATTERN = /^[0-9a-f]{32}$/;

export const CLAIM_RESERVATION_STATUS = {
  reserved: "reserved",
  settling: "settling",
  settled: "settled",
  finalized: "finalized",
  abandoned: "abandoned",
} as const;

export type ClaimReservationStatus =
  (typeof CLAIM_RESERVATION_STATUS)[keyof typeof CLAIM_RESERVATION_STATUS];

/** Statuses that still hold the parent/recipient active-claim lock. */
export const ACTIVE_CLAIM_RESERVATION_STATUSES = [
  CLAIM_RESERVATION_STATUS.reserved,
  CLAIM_RESERVATION_STATUS.settling,
  CLAIM_RESERVATION_STATUS.settled,
] as const;

/**
 * Temporary claim lock through settlement/finalization.
 * Plaintext spore secrets are never stored.
 */
export type ClaimReservation = {
  reservationId: string;
  parentOrganismPda: string;
  parentSgtMint: string;
  recipientSgtMint: string;
  recipientWalletAddress: string;
  sporeCommitment: string;
  status: ClaimReservationStatus;
  preparedAt: Date;
  updatedAt: Date;

  /** Settlement attempt (recipient-signed Core create + fee). */
  settlementAttemptId: string | null;
  expectedCoreAsset: string | null;
  recentBlockhash: string | null;
  lastValidBlockHeight: number | null;
  /** Partially signed legacy transaction (base64). Asset key never leaves the server. */
  settlementTransactionBase64: string | null;
  settlementSignature: string | null;
  settlementSlot: string | null;
  settlementBlockTime: number | null;

  /** Allocated only after verified settlement. Never reused. */
  organismNumber: string | null;
  generation: number | null;
  genome: string | null;
  bornAt: Date | null;
  mutationSlot: string | null;
  childOrganismPda: string | null;

  coreFinalizationSignature: string | null;
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

const claimReservationSchema = new Schema<ClaimReservation>(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
      match: IDEMPOTENCY_KEY_PATTERN,
    },
    parentOrganismPda: {
      ...publicKeyField,
      index: true,
    },
    parentSgtMint: {
      ...publicKeyField,
    },
    recipientSgtMint: {
      ...publicKeyField,
      index: true,
    },
    recipientWalletAddress: {
      ...publicKeyField,
    },
    sporeCommitment: {
      type: String,
      required: true,
      match: COMMITMENT_HEX_PATTERN,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(CLAIM_RESERVATION_STATUS),
      index: true,
    },
    preparedAt: {
      type: Date,
      required: true,
    },
    updatedAt: {
      type: Date,
      required: true,
    },
    settlementAttemptId: {
      type: String,
      default: null,
    },
    expectedCoreAsset: {
      ...optionalPublicKeyField,
    },
    recentBlockhash: {
      type: String,
      default: null,
    },
    lastValidBlockHeight: {
      type: Number,
      default: null,
    },
    settlementTransactionBase64: {
      type: String,
      default: null,
    },
    settlementSignature: {
      type: String,
      default: null,
    },
    settlementSlot: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null) {
          return value === null || DECIMAL_U64_PATTERN.test(value);
        },
      },
    },
    settlementBlockTime: {
      type: Number,
      default: null,
    },
    organismNumber: {
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
      default: null,
      min: 0,
    },
    genome: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null) {
          return value === null || GENOME_HEX_PATTERN.test(value);
        },
      },
    },
    bornAt: {
      type: Date,
      default: null,
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
    childOrganismPda: {
      ...optionalPublicKeyField,
    },
    coreFinalizationSignature: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
    collection: "claim_reservations",
  },
);

claimReservationSchema.index(
  { parentOrganismPda: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES] },
    },
  },
);
claimReservationSchema.index(
  { recipientSgtMint: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES] },
    },
  },
);
claimReservationSchema.index(
  { organismNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      organismNumber: { $type: "string" },
    },
  },
);

export const ClaimReservationModel =
  (mongoose.models.ClaimReservation as Model<ClaimReservation> | undefined) ??
  mongoose.model<ClaimReservation>("ClaimReservation", claimReservationSchema);
