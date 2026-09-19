import mongoose, { Schema, type Model } from "mongoose";

const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const ORGANISM_NUMBER_SORT_KEY_PATTERN = /^[0-9]{20}$/;

export type OrganismDescendantCounter = {
  organismNumber: string;
  organismNumberSortKey: string;
  totalDescendants: number;
  createdAt: Date;
  updatedAt: Date;
};

const organismDescendantCounterSchema = new Schema<OrganismDescendantCounter>(
  {
    organismNumber: {
      type: String,
      required: true,
      unique: true,
      match: DECIMAL_U64_PATTERN,
      immutable: true
    },
    organismNumberSortKey: {
      type: String,
      required: true,
      match: ORGANISM_NUMBER_SORT_KEY_PATTERN,
      immutable: true
    },
    totalDescendants: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(value: number) {
          return Number.isInteger(value);
        },
        message: "totalDescendants must be an integer."
      }
    },
    createdAt: {
      type: Date,
      required: true,
      immutable: true
    },
    updatedAt: {
      type: Date,
      required: true
    }
  },
  {
    versionKey: false
  }
);

organismDescendantCounterSchema.index({
  totalDescendants: -1,
  organismNumberSortKey: 1
});

export const OrganismDescendantCounterModel =
  (mongoose.models.OrganismDescendantCounter as
    | Model<OrganismDescendantCounter>
    | undefined) ??
  mongoose.model<OrganismDescendantCounter>(
    "OrganismDescendantCounter",
    organismDescendantCounterSchema
  );
