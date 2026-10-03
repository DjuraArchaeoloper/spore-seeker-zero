import mongoose, { Schema, type Model } from "mongoose";

const PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Delivery receipt only. Canonical birth data stays in OrganismIndex. */
export type CampaignBirth = {
  /** Child SGT mint: stable across server and indexed birth paths. */
  _id: string;
  createdAt: Date;
  /** Null until reward processing completes; older receipts without this field remain retryable. */
  processedAt?: Date | null;
};

const campaignBirthSchema = new Schema<CampaignBirth>(
  {
    _id: {
      type: String,
      required: true,
      match: PUBLIC_KEY_PATTERN,
      immutable: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
    processedAt: { type: Date, default: null },
  },
  {
    versionKey: false,
    collection: "campaign_births",
    bufferCommands: false,
  },
);

// Mongo's built-in unique _id index deduplicates delivery without index setup.
export const CampaignBirthModel =
  (mongoose.models.CampaignBirth as Model<CampaignBirth> | undefined) ??
  mongoose.model<CampaignBirth>("CampaignBirth", campaignBirthSchema);
