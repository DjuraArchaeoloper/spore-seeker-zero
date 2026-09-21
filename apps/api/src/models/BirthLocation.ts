import mongoose, { Schema, type Model } from "mongoose";

const DECIMAL_U64_PATTERN = /^(0|[1-9][0-9]*)$/;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;
const BIRTH_REFERENCE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,96}:(0|[1-9][0-9]*)$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const LOCATION_KEY_PATTERN =
  /^(?:[A-Z]{2}|ZZ):-?[0-9]{1,3}\.[05]:-?[0-9]{1,3}\.[05]$/;
const LOCATION_LABEL_PATTERN = /^[\p{L}\p{M} .,'()-]{1,80}$/u;
const COORDINATE_PRECISION_DEGREES = 0.5;

export type BirthLocation = {
  birthReference: string;
  organismNumber: string;
  transactionSignature: string;
  countryCode: string | null;
  countryName: string | null;
  regionLabel: string | null;
  cityLabel: string | null;
  label: string;
  locationKey: string;
  latitude: number;
  longitude: number;
  coordinatePrecisionDegrees: number;
  createdAt: Date;
};

const nullableLocationLabelField = {
  type: String,
  default: null,
  maxlength: 80,
  match: LOCATION_LABEL_PATTERN,
  immutable: true,
};

const birthLocationSchema = new Schema<BirthLocation>(
  {
    birthReference: {
      type: String,
      required: true,
      unique: true,
      match: BIRTH_REFERENCE_PATTERN,
      immutable: true,
    },
    organismNumber: {
      type: String,
      required: true,
      unique: true,
      match: DECIMAL_U64_PATTERN,
      immutable: true,
    },
    transactionSignature: {
      type: String,
      required: true,
      minlength: 80,
      maxlength: 96,
      match: BASE58_PATTERN,
      immutable: true,
      index: true,
    },
    countryCode: {
      type: String,
      default: null,
      match: COUNTRY_CODE_PATTERN,
      immutable: true,
    },
    countryName: {
      ...nullableLocationLabelField,
    },
    regionLabel: {
      ...nullableLocationLabelField,
    },
    cityLabel: {
      ...nullableLocationLabelField,
    },
    label: {
      type: String,
      required: true,
      maxlength: 80,
      match: LOCATION_LABEL_PATTERN,
      immutable: true,
    },
    locationKey: {
      type: String,
      required: true,
      match: LOCATION_KEY_PATTERN,
      immutable: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
      immutable: true,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
      immutable: true,
    },
    coordinatePrecisionDegrees: {
      type: Number,
      required: true,
      min: COORDINATE_PRECISION_DEGREES,
      max: COORDINATE_PRECISION_DEGREES,
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
    collection: "birth_locations",
  },
);

birthLocationSchema.index({ locationKey: 1, createdAt: 1 });

export const BirthLocationModel =
  (mongoose.models.BirthLocation as Model<BirthLocation> | undefined) ??
  mongoose.model<BirthLocation>("BirthLocation", birthLocationSchema);
