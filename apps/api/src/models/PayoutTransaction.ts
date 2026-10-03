import mongoose, { Schema, type Model } from "mongoose";

export type PayoutTransfer = {
  recipientSgtMint: string;
  walletAddress: string;
  amountAtomic: string;
  rewardIds: string[];
};

export type PayoutTransaction = {
  _id: string;
  campaignId: string;
  runId: string;
  index: number;
  status: "prepared" | "submitted" | "confirmed" | "failed";
  treasuryWallet: string;
  tokenMint: string;
  decimals: number;
  transfers: PayoutTransfer[];
  rewardIds: string[];
  unsignedTransactionBase64: string;
  messageHash: string;
  blockhash: string;
  lastValidBlockHeight: number;
  signature?: string | null;
  signedTransactionBase64?: string | null;
  submittedAt?: Date | null;
  confirmedAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
};

const transferSchema = new Schema<PayoutTransfer>({
  recipientSgtMint: { type: String, required: true },
  walletAddress: { type: String, required: true },
  amountAtomic: { type: String, required: true },
  rewardIds: { type: [String], required: true },
}, { _id: false });

const schema = new Schema<PayoutTransaction>({
  _id: { type: String, required: true },
  campaignId: { type: String, required: true },
  runId: { type: String, required: true, index: true },
  index: { type: Number, required: true },
  status: { type: String, required: true, enum: ["prepared", "submitted", "confirmed", "failed"] },
  treasuryWallet: { type: String, required: true },
  tokenMint: { type: String, required: true },
  decimals: { type: Number, required: true },
  transfers: { type: [transferSchema], required: true },
  rewardIds: { type: [String], required: true },
  unsignedTransactionBase64: { type: String, required: true },
  messageHash: { type: String, required: true },
  blockhash: { type: String, required: true },
  lastValidBlockHeight: { type: Number, required: true },
  signature: { type: String, default: null },
  signedTransactionBase64: { type: String, default: null },
  submittedAt: { type: Date, default: null },
  confirmedAt: { type: Date, default: null },
  failedAt: { type: Date, default: null },
  failureReason: { type: String, default: null },
  createdAt: { type: Date, required: true, default: Date.now },
}, { collection: "payout_transactions", versionKey: false });

schema.index({ campaignId: 1, status: 1, createdAt: 1 });
schema.index({ signature: 1 }, { unique: true, partialFilterExpression: { signature: { $type: "string" } } });

export const PayoutTransactionModel =
  (mongoose.models.PayoutTransaction as Model<PayoutTransaction> | undefined) ??
  mongoose.model<PayoutTransaction>("PayoutTransaction", schema);
