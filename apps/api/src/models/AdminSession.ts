import mongoose, { Schema, type Model } from "mongoose";

export type AdminSession = {
  tokenHash: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

const adminSessionSchema = new Schema<AdminSession>(
  {
    tokenHash: { type: String, required: true, unique: true },
    email: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { versionKey: false, collection: "admin_sessions", bufferCommands: false },
);

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminSessionModel =
  (mongoose.models.AdminSession as Model<AdminSession> | undefined) ??
  mongoose.model<AdminSession>("AdminSession", adminSessionSchema);
