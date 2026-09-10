import mongoose, { Schema, type Model } from "mongoose";

export type Session = {
  tokenHash: string;
  sgtMint: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

const sessionSchema = new Schema<Session>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    sgtMint: {
      type: String,
      required: true,
      index: true
    },
    createdAt: {
      type: Date,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revokedAt: {
      type: Date,
      default: null
    }
  },
  {
    versionKey: false
  }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel =
  (mongoose.models.Session as Model<Session> | undefined) ??
  mongoose.model<Session>("Session", sessionSchema);
