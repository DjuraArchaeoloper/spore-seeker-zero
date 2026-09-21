import mongoose, { Schema, type Model } from "mongoose";

export type SeekerIdentity = {
  sgtMint: string;
  currentWalletAddress: string;
  createdAt: Date;
  lastAuthenticatedAt: Date;
};

const seekerIdentitySchema = new Schema<SeekerIdentity>(
  {
    sgtMint: {
      type: String,
      required: true,
      unique: true,
    },
    currentWalletAddress: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
    lastAuthenticatedAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
    collection: "seeker_identities",
  },
);

export const SeekerIdentityModel =
  (mongoose.models.SeekerIdentity as Model<SeekerIdentity> | undefined) ??
  mongoose.model<SeekerIdentity>("SeekerIdentity", seekerIdentitySchema);
