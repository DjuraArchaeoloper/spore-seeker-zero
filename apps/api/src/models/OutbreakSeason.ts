import mongoose, { Schema, type Model } from "mongoose";

const SEASON_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SCORING_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const DECIMAL_AMOUNT_PATTERN = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;

export const OUTBREAK_SEASON_STATUSES = ["scheduled", "active", "ended"] as const;

export type OutbreakSeasonStatus = (typeof OUTBREAK_SEASON_STATUSES)[number];

export type OutbreakSkrPoolMetadata = {
  tokenMint?: string;
  totalAmount?: string;
  decimals?: number;
  label?: string;
  notes?: string;
};

export type OutbreakSeason = {
  seasonId: string;
  startsAt: Date;
  endsAt: Date;
  status: OutbreakSeasonStatus;
  scoringVersion: string;
  skrPool?: OutbreakSkrPoolMetadata;
  createdAt: Date;
  updatedAt: Date;
};

const skrPoolSchema = new Schema<OutbreakSkrPoolMetadata>(
  {
    tokenMint: {
      type: String,
      minlength: PUBLIC_KEY_MIN_LENGTH,
      maxlength: PUBLIC_KEY_MAX_LENGTH
    },
    totalAmount: {
      type: String,
      match: DECIMAL_AMOUNT_PATTERN,
      maxlength: 80
    },
    decimals: {
      type: Number,
      min: 0,
      max: 18
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 240
    }
  },
  {
    _id: false,
    versionKey: false
  }
);

const outbreakSeasonSchema = new Schema<OutbreakSeason>(
  {
    seasonId: {
      type: String,
      required: true,
      unique: true,
      match: SEASON_ID_PATTERN
    },
    startsAt: {
      type: Date,
      required: true,
      index: true
    },
    endsAt: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: OUTBREAK_SEASON_STATUSES,
      index: true
    },
    scoringVersion: {
      type: String,
      required: true,
      match: SCORING_VERSION_PATTERN,
      maxlength: 64
    },
    skrPool: {
      type: skrPoolSchema,
      required: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
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
