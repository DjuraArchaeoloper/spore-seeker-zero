import mongoose, { Schema, type Model } from "mongoose";

const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;

export type DevnetTestSgtAssignment = {
  wallet: string;
  sgtMint: string;
  createdAt: Date;
  updatedAt: Date;
  fundedAt?: Date | null;
  fundedLamports?: number | null;
  fundingReservedAt?: Date | null;
};

const publicKeyField = {
  type: String,
  required: true,
  minlength: PUBLIC_KEY_MIN_LENGTH,
  maxlength: PUBLIC_KEY_MAX_LENGTH,
};

const devnetTestSgtAssignmentSchema = new Schema<DevnetTestSgtAssignment>(
  {
    wallet: {
      ...publicKeyField,
      unique: true,
    },
    sgtMint: {
      ...publicKeyField,
      unique: true,
    },
    fundedAt: {
      type: Date,
      default: null,
    },
    fundedLamports: {
      type: Number,
      default: null,
      min: 0,
    },
    fundingReservedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "devnet_test_sgt_assignments",
  },
);

export const DevnetTestSgtAssignmentModel =
  (mongoose.models.DevnetTestSgtAssignment as
    | Model<DevnetTestSgtAssignment>
    | undefined) ??
  mongoose.model<DevnetTestSgtAssignment>(
    "DevnetTestSgtAssignment",
    devnetTestSgtAssignmentSchema,
  );
