import mongoose, { Schema, type Model } from "mongoose";

export type AuthNonce = {
  nonce: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
};

const authNonceSchema = new Schema<AuthNonce>(
  {
    nonce: {
      type: String,
      required: true,
      unique: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
    collection: "auth_nonces",
  },
);

authNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthNonceModel =
  (mongoose.models.AuthNonce as Model<AuthNonce> | undefined) ??
  mongoose.model<AuthNonce>("AuthNonce", authNonceSchema);
