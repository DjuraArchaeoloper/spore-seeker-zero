import mongoose, { Schema, type Model } from "mongoose";

const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const PUBLIC_KEY_MIN_LENGTH = 32;
const PUBLIC_KEY_MAX_LENGTH = 44;

/** Singleton key for the one canonical species record. */
export const CANONICAL_SPECIES_KEY = "canonical" as const;

export type SpeciesState = {
  key: typeof CANONICAL_SPECIES_KEY;
  seekerZeroOrganismPda: string | null;
  nextOrganismNumber: string;
  totalOrganisms: string;
  treasury: string;
  birthFeeLamports: string;
  /** HTTPS base URI used for Core metadata URIs (no trailing slash). */
  metadataBaseUri: string;
  updatedAt: Date;
};

const publicKeyField = {
  type: String,
  required: true,
  minlength: PUBLIC_KEY_MIN_LENGTH,
  maxlength: PUBLIC_KEY_MAX_LENGTH,
};

const speciesStateSchema = new Schema<SpeciesState>(
  {
    key: {
      type: String,
      required: true,
      enum: [CANONICAL_SPECIES_KEY],
      unique: true,
    },
    seekerZeroOrganismPda: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null) {
          return (
            value === null ||
            (value.length >= PUBLIC_KEY_MIN_LENGTH &&
              value.length <= PUBLIC_KEY_MAX_LENGTH)
          );
        },
      },
    },
    nextOrganismNumber: {
      type: String,
      required: true,
      match: DECIMAL_U64_PATTERN,
    },
    totalOrganisms: {
      type: String,
      required: true,
      match: DECIMAL_U64_PATTERN,
    },
    treasury: {
      ...publicKeyField,
    },
    birthFeeLamports: {
      type: String,
      required: true,
      match: DECIMAL_U64_PATTERN,
    },
    metadataBaseUri: {
      type: String,
      required: true,
      maxlength: 96,
    },
    updatedAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
    collection: "species_states",
  },
);

export const SpeciesStateModel =
  (mongoose.models.SpeciesState as Model<SpeciesState> | undefined) ??
  mongoose.model<SpeciesState>("SpeciesState", speciesStateSchema);
