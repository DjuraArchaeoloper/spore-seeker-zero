import mongoose, { Schema, type Model } from "mongoose";

export type PayoutRun = {
  _id: string;
  campaignId: string;
  kind: "main" | "retry";
  treasuryWallet: string;
  tokenMint: string;
  decimals: number;
  createdAt: Date;
};

const schema = new Schema<PayoutRun>({
  _id: { type: String, required: true },
  campaignId: { type: String, required: true, index: true },
  kind: { type: String, required: true, enum: ["main", "retry"] },
  treasuryWallet: { type: String, required: true },
  tokenMint: { type: String, required: true },
  decimals: { type: Number, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, { collection: "payout_runs", versionKey: false });

schema.index({ campaignId: 1, kind: 1 }, { unique: true, partialFilterExpression: { kind: "main" } });

export const PayoutRunModel =
  (mongoose.models.PayoutRun as Model<PayoutRun> | undefined) ??
  mongoose.model<PayoutRun>("PayoutRun", schema);
