import mongoose, { Schema, type Model } from "mongoose";

const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;
const BIRTH_REFERENCE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,96}:(0|[1-9][0-9]*)$/;

export type OrganismDescendantCountEvent = {
  childOrganismNumber: string;
  birthReference: string;
  transactionSignature: string;
  ancestorNumbers: string[];
  createdAt: Date;
};

const organismNumberField = {
  type: String,
  required: true,
  match: DECIMAL_U64_PATTERN,
  immutable: true,
};

const organismDescendantCountEventSchema =
  new Schema<OrganismDescendantCountEvent>(
    {
      childOrganismNumber: {
        ...organismNumberField,
        unique: true,
      },
      birthReference: {
        type: String,
        required: true,
        unique: true,
        match: BIRTH_REFERENCE_PATTERN,
        immutable: true,
      },
      transactionSignature: {
        type: String,
        required: true,
        minlength: 80,
        maxlength: 96,
        match: BASE58_PATTERN,
        immutable: true,
      },
      ancestorNumbers: {
        type: [String],
        required: true,
        default: [],
        validate: {
          validator(values: string[]) {
            return values.every((value) => DECIMAL_U64_PATTERN.test(value));
          },
          message: "ancestorNumbers must be decimal u64 strings.",
        },
        immutable: true,
      },
      createdAt: {
        type: Date,
        required: true,
        immutable: true,
      },
    },
    {
      versionKey: false,
      collection: "organism_descendant_count_events",
    },
  );

organismDescendantCountEventSchema.index({ transactionSignature: 1 });

export const OrganismDescendantCountEventModel =
  (mongoose.models.OrganismDescendantCountEvent as
    | Model<OrganismDescendantCountEvent>
    | undefined) ??
  mongoose.model<OrganismDescendantCountEvent>(
    "OrganismDescendantCountEvent",
    organismDescendantCountEventSchema,
  );
