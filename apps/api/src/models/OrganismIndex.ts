import mongoose, { Schema, type Model } from "mongoose";

const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const GENOME_HEX_PATTERN = /^[0-9a-f]{32}$/;
const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;

export type OrganismIndex = {
  organismPda: string;
  organismNumber: string;
  sgtMint: string;
  parentOrganismPda: string | null;
  generation: number;
  genome: string;
  bornAt: Date;
  coreAsset: string;
  transactionSignature: string;
  ancestorNumbers: string[];
  indexedAt: Date;
};

const publicKeyField = {
  type: String,
  required: true,
  minlength: PUBLIC_KEY_MIN_LENGTH,
  maxlength: PUBLIC_KEY_MAX_LENGTH
};

const organismIndexSchema = new Schema<OrganismIndex>(
  {
    organismPda: {
      ...publicKeyField,
      unique: true
    },
    organismNumber: {
      type: String,
      required: true,
      unique: true,
      match: DECIMAL_U64_PATTERN
    },
    sgtMint: {
      ...publicKeyField,
      unique: true
    },
    parentOrganismPda: {
      type: String,
      default: null,
      minlength: PUBLIC_KEY_MIN_LENGTH,
      maxlength: PUBLIC_KEY_MAX_LENGTH,
      index: true
    },
    generation: {
      type: Number,
      required: true,
      min: 0,
      index: true
    },
    genome: {
      type: String,
      required: true,
      match: GENOME_HEX_PATTERN
    },
    bornAt: {
      type: Date,
      required: true
    },
    coreAsset: {
      ...publicKeyField,
      unique: true
    },
    transactionSignature: {
      type: String,
      required: true
    },
    ancestorNumbers: {
      type: [String],
      required: true,
      default: [],
      index: true
    },
    indexedAt: {
      type: Date,
      required: true
    }
  },
  {
    versionKey: false
  }
);

export const OrganismIndexModel =
  (mongoose.models.OrganismIndex as Model<OrganismIndex> | undefined) ??
  mongoose.model<OrganismIndex>("OrganismIndex", organismIndexSchema);
