import mongoose, { Schema, type Model } from "mongoose";

const CAMPAIGN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const MAX_U64_DECIMAL = "18446744073709551615";
const BIRTH_REFERENCE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,96}:(0|[1-9][0-9]*)$/;

export const SKR_REWARD_ROLES = ["parent", "newSeeker"] as const;
export const SKR_PAYOUT_STATUSES = ["pending", "paid", "failed"] as const;

export type SkrReward = {
  /** Deterministic campaign + qualifying child SGT + role key. */
  _id: string;
  /** May identify an Outbreak season; no separate campaign source is introduced. */
  campaignId: string;
  childSgtMint: string;
  birthReference: string | null;
  recipientSgtMint: string;
  role: (typeof SKR_REWARD_ROLES)[number];
  /** Exact unsigned base-unit amount. Never a JS number or a UI decimal. */
  amountAtomic: string;
  tokenMint: string;
  decimals: number;
  payoutStatus: (typeof SKR_PAYOUT_STATUSES)[number];
  /** Current prepared/submitted/failed payout transaction; no wallet replaces SGT ownership. */
  payoutTransactionId?: string | null;
  paidSignature?: string | null;
  paidAt?: Date | null;
  createdAt: Date;
};

export function getSkrRewardId(
  reward: Pick<SkrReward, "campaignId" | "childSgtMint" | "role">,
) {
  return `${reward.campaignId}:${reward.childSgtMint}:${reward.role}`;
}

const publicKeyField = {
  type: String,
  required: true,
  match: PUBLIC_KEY_PATTERN,
  immutable: true,
};

const skrRewardSchema = new Schema<SkrReward>(
  {
    _id: { type: String, required: true, immutable: true },
    campaignId: {
      type: String,
      required: true,
      match: CAMPAIGN_ID_PATTERN,
      immutable: true,
    },
    childSgtMint: publicKeyField,
    birthReference: {
      type: String,
      default: null,
      match: BIRTH_REFERENCE_PATTERN,
      immutable: true,
    },
    recipientSgtMint: publicKeyField,
    role: {
      type: String,
      required: true,
      enum: SKR_REWARD_ROLES,
      immutable: true,
    },
    amountAtomic: {
      type: String,
      required: true,
      match: DECIMAL_U64_PATTERN,
      maxlength: MAX_U64_DECIMAL.length,
      immutable: true,
      set(value: unknown) {
        if (typeof value !== "string") {
          throw new TypeError("SKR amounts must be decimal strings in base units.");
        }
        return value;
      },
      validate: {
        validator(value: string) {
          return value.length < MAX_U64_DECIMAL.length || value <= MAX_U64_DECIMAL;
        },
        message: "amountAtomic must fit an unsigned u64.",
      },
    },
    tokenMint: publicKeyField,
    decimals: {
      type: Number,
      required: true,
      min: 0,
      max: 18,
      immutable: true,
      validate: {
        validator: Number.isInteger,
        message: "decimals must be an integer.",
      },
    },
    payoutStatus: {
      type: String,
      required: true,
      enum: SKR_PAYOUT_STATUSES,
      default: "pending",
    },
    payoutTransactionId: { type: String, default: null },
    paidSignature: { type: String, default: null },
    paidAt: { type: Date, default: null },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    versionKey: false,
    collection: "skr_rewards",
    bufferCommands: false,
  },
);

skrRewardSchema.pre("validate", function () {
  const expectedId = getSkrRewardId(this);
  if (!this._id) {
    this._id = expectedId;
  } else if (this._id !== expectedId) {
    this.invalidate("_id", "SKR reward id must match campaign, child SGT and role.");
  }
});

skrRewardSchema.index({ campaignId: 1, payoutStatus: 1 });

// One reward per campaign/birth/role, enforced by Mongo's unique _id index.
// Future upserts must use getSkrRewardId() as their _id filter.
export const SkrRewardModel =
  (mongoose.models.SkrReward as Model<SkrReward> | undefined) ??
  mongoose.model<SkrReward>("SkrReward", skrRewardSchema);
