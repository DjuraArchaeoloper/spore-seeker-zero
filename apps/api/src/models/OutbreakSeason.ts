import mongoose, { Schema, type Model, type Types } from "mongoose";

const SEASON_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SCORING_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const DECIMAL_AMOUNT_PATTERN = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;
const PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const MAX_U64_DECIMAL = "18446744073709551615";

export const OUTBREAK_SEASON_STATUSES = [
  "scheduled",
  "active",
  "ended",
] as const;

export type OutbreakSeasonStatus = (typeof OUTBREAK_SEASON_STATUSES)[number];

export type OutbreakSkrPoolMetadata = {
  tokenMint?: string;
  totalAmount?: string;
  decimals?: number;
  label?: string;
  notes?: string;
};

/** V1 reward snapshot. Legacy skrPool metadata and points remain independent. */
export type OutbreakSkrCampaign = {
  parentRewardAtomic: string;
  newSeekerRewardAtomic: string;
  budgetAtomic: string;
  tokenMint: string;
  decimals: number;
};

export type OutbreakSeason = {
  seasonId: string;
  title?: string;
  startsAt: Date;
  endsAt: Date;
  status: OutbreakSeasonStatus;
  scoringVersion: string;
  skrPool?: OutbreakSkrPoolMetadata;
  skrCampaign?: OutbreakSkrCampaign;
  /** Decimal128 keeps the atomic funded-birth counter exact beyond JS safe integers. */
  skrFundedBirths?: Types.Decimal128;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const skrPoolSchema = new Schema<OutbreakSkrPoolMetadata>(
  {
    tokenMint: {
      type: String,
      minlength: PUBLIC_KEY_MIN_LENGTH,
      maxlength: PUBLIC_KEY_MAX_LENGTH,
    },
    totalAmount: {
      type: String,
      match: DECIMAL_AMOUNT_PATTERN,
      maxlength: 80,
    },
    decimals: {
      type: Number,
      min: 0,
      max: 18,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 240,
    },
  },
  {
    _id: false,
    versionKey: false,
    collection: "outbreak_seasons",
  },
);

const atomicAmountField = {
  type: String,
  required: true,
  match: DECIMAL_U64_PATTERN,
  maxlength: MAX_U64_DECIMAL.length,
  validate: {
    validator(value: string) {
      return (
        value !== "0" &&
        (value.length < MAX_U64_DECIMAL.length || value <= MAX_U64_DECIMAL)
      );
    },
    message: "SKR amount must be a positive unsigned u64 base-unit string.",
  },
};

const skrCampaignSchema = new Schema<OutbreakSkrCampaign>(
  {
    parentRewardAtomic: atomicAmountField,
    newSeekerRewardAtomic: atomicAmountField,
    budgetAtomic: atomicAmountField,
    tokenMint: { type: String, required: true, match: PUBLIC_KEY_PATTERN },
    decimals: {
      type: Number,
      required: true,
      min: 0,
      max: 18,
      validate: { validator: Number.isInteger },
    },
  },
  { _id: false, versionKey: false },
);

const outbreakSeasonSchema = new Schema<OutbreakSeason>(
  {
    seasonId: {
      type: String,
      required: true,
      unique: true,
      match: SEASON_ID_PATTERN,
    },
    title: { type: String, trim: true, maxlength: 80 },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: OUTBREAK_SEASON_STATUSES,
      index: true,
    },
    scoringVersion: {
      type: String,
      required: true,
      match: SCORING_VERSION_PATTERN,
      maxlength: 64,
    },
    skrPool: {
      type: skrPoolSchema,
      required: false,
    },
    skrCampaign: { type: skrCampaignSchema, required: false },
    skrFundedBirths: { type: Schema.Types.Decimal128, required: false },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

outbreakSeasonSchema.pre("validate", function () {
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "endsAt must be after startsAt.");
  }
});

outbreakSeasonSchema.index({ status: 1, startsAt: 1, endsAt: 1 });

export const OutbreakSeasonModel =
  (mongoose.models.OutbreakSeason as Model<OutbreakSeason> | undefined) ??
  mongoose.model<OutbreakSeason>("OutbreakSeason", outbreakSeasonSchema);
