import mongoose, { Schema, type Model } from "mongoose";

const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const SEASON_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;
const BIRTH_EVENT_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,160}$/;
const REWARD_WINDOW_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SCORING_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export const OUTBREAK_EVENT_TYPES = ["direct_birth", "lineage_continuation"] as const;

export type OutbreakEventType = (typeof OUTBREAK_EVENT_TYPES)[number];

export type OutbreakContribution = {
  seasonId: string;
  eventType: OutbreakEventType;
  birthEventKey: string;
  birthTransactionSignature: string;
  childOrganismPda: string;
  childOrganismNumber: string;
  childSgtMint: string;
  parentOrganismPda: string;
  contributorOrganismNumber: string;
  contributorSgtMint: string;
  points: number;
  scoringVersion: string;
  birthBornAt: Date;
  rewardWindowKey: string | null;
  rewardSlot: number | null;
  createdAt: Date;
};

const publicKeyField = {
  type: String,
  required: true,
  minlength: PUBLIC_KEY_MIN_LENGTH,
  maxlength: PUBLIC_KEY_MAX_LENGTH,
  immutable: true
};

const organismNumberField = {
  type: String,
  required: true,
  match: DECIMAL_U64_PATTERN,
  immutable: true
};

const outbreakContributionSchema = new Schema<OutbreakContribution>(
  {
    seasonId: {
      type: String,
      required: true,
      match: SEASON_ID_PATTERN,
      immutable: true,
      index: true
    },
    eventType: {
      type: String,
      required: true,
      enum: OUTBREAK_EVENT_TYPES,
      immutable: true
    },
    birthEventKey: {
      type: String,
      required: true,
      match: BIRTH_EVENT_KEY_PATTERN,
      immutable: true
    },
    birthTransactionSignature: {
      type: String,
      required: true,
      minlength: 80,
      maxlength: 96,
      match: BASE58_PATTERN,
      immutable: true
    },
    childOrganismPda: {
      ...publicKeyField
    },
    childOrganismNumber: {
      ...organismNumberField
    },
    childSgtMint: {
      ...publicKeyField
    },
    parentOrganismPda: {
      ...publicKeyField
    },
    contributorOrganismNumber: {
      ...organismNumberField
    },
    contributorSgtMint: {
      ...publicKeyField,
      index: true
    },
    points: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(value: number) {
          return Number.isInteger(value);
        },
        message: "points must be an integer."
      },
      immutable: true
    },
    scoringVersion: {
      type: String,
      required: true,
      match: SCORING_VERSION_PATTERN,
      maxlength: 64,
      immutable: true
    },
    birthBornAt: {
      type: Date,
      required: true,
      immutable: true
    },
    rewardWindowKey: {
      type: String,
      default: null,
      match: REWARD_WINDOW_KEY_PATTERN,
      immutable: true
    },
    rewardSlot: {
      type: Number,
      default: null,
      min: 1,
      max: 3,
      validate: {
        validator(value: number | null) {
          return value === null || Number.isInteger(value);
        },
        message: "rewardSlot must be an integer."
      },
      immutable: true
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true
    }
  },
  {
    versionKey: false
  }
);

outbreakContributionSchema.index({ eventType: 1, birthEventKey: 1 }, { unique: true });
outbreakContributionSchema.index(
  { eventType: 1, childOrganismPda: 1 },
  {
    unique: true,
    partialFilterExpression: {
      eventType: "lineage_continuation"
    }
  }
);
outbreakContributionSchema.index(
  {
    seasonId: 1,
    eventType: 1,
    contributorSgtMint: 1,
    rewardWindowKey: 1,
    rewardSlot: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      eventType: "direct_birth",
      rewardWindowKey: { $type: "string" },
      rewardSlot: { $type: "number" }
    }
  }
);
outbreakContributionSchema.index({ seasonId: 1, contributorSgtMint: 1, createdAt: -1 });
outbreakContributionSchema.index({
  seasonId: 1,
  contributorSgtMint: 1,
  rewardWindowKey: 1,
  birthBornAt: 1
});
outbreakContributionSchema.index({ seasonId: 1, eventType: 1, createdAt: -1 });

export const OutbreakContributionModel =
  (mongoose.models.OutbreakContribution as Model<OutbreakContribution> | undefined) ??
  mongoose.model<OutbreakContribution>("OutbreakContribution", outbreakContributionSchema);
