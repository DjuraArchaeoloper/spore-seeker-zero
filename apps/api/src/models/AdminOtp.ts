import mongoose, { Schema, type Model } from "mongoose";

/** One current challenge and request throttle per normalized email hash. */
export type AdminOtp = {
  _id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  sentAt: Date;
  requestWindowStartedAt: Date;
  requestCount: number;
  usedAt: Date | null;
  purgeAt: Date;
};

const adminOtpSchema = new Schema<AdminOtp>(
  {
    _id: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, required: true, min: 0 },
    sentAt: { type: Date, required: true },
    requestWindowStartedAt: { type: Date, required: true },
    requestCount: { type: Number, required: true, min: 1 },
    usedAt: { type: Date, default: null },
    purgeAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "admin_otps", bufferCommands: false },
);

adminOtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const AdminOtpModel =
  (mongoose.models.AdminOtp as Model<AdminOtp> | undefined) ??
  mongoose.model<AdminOtp>("AdminOtp", adminOtpSchema);
