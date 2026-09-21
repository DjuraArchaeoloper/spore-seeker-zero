import mongoose, { Schema, type Model } from "mongoose";

export const SOCIAL_POST_STATUSES = ["pending", "publishing", "posted", "failed"] as const;

export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export type SocialPost = {
  text: string;
  scheduledFor: Date;
  status: SocialPostStatus;
  xPostId?: string;
  postedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};

const socialPostSchema = new Schema<SocialPost>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 280
    },
    scheduledFor: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      required: true,
      enum: SOCIAL_POST_STATUSES,
      default: "pending"
    },
    xPostId: {
      type: String,
      required: false
    },
    postedAt: {
      type: Date,
      required: false
    },
    lastError: {
      type: String,
      required: false,
      maxlength: 500
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

socialPostSchema.index({ status: 1, scheduledFor: 1 });

export const SocialPostModel =
  (mongoose.models.SocialPost as Model<SocialPost> | undefined) ??
  mongoose.model<SocialPost>("SocialPost", socialPostSchema);
