import { getAuthenticatedSeeker } from "../../../../src/auth/session";
import { connectToDatabase } from "../../../../src/db/mongoose";
import { readJsonObject, RequestBodyError, type JsonObject } from "../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { BirthLocationModel } from "../../../../src/models/BirthLocation";
import { OrganismIndexModel } from "../../../../src/models/OrganismIndex";
import {
  getBirthReference,
  normalizeOrganismNumber,
  normalizeTransactionSignature
} from "../../../../src/organisms/identifiers";
import { publicOrganismFilter } from "../../../../src/organisms/responses";

export const runtime = "nodejs";

const MAX_LOCATION_BODY_BYTES = 4 * 1024;
const LOCATION_GRID_DEGREES = 0.5;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const LOCATION_LABEL_MAX_LENGTH = 80;
const LOCATION_LABEL_PATTERN = /^[\p{L}\p{M} .,'()-]{1,80}$/u;
const ALLOWED_FIELDS = new Set([
  "organismNumber",
  "transactionSignature",
  "latitude",
  "longitude",
  "countryCode",
  "countryName",
  "regionLabel",
  "cityLabel"
]);

type BirthLocationSubmission = {
  organismNumber: string;
  transactionSignature: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  countryName: string | null;
  regionLabel: string | null;
  cityLabel: string | null;
};

class BirthLocationInputError extends Error {}

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const seeker = await getAuthenticatedSeeker(request);

    if (!seeker) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const body = await readJsonObject(request, MAX_LOCATION_BODY_BYTES);
    const input = parseBirthLocationSubmission(body);
    const organism = await OrganismIndexModel.findOne({
      organismNumber: input.organismNumber,
      transactionSignature: input.transactionSignature,
      sgtMint: seeker.sgtMint,
      ...publicOrganismFilter
    })
      .select({
        organismNumber: 1,
        transactionSignature: 1
      })
      .lean();

    if (!organism) {
      return jsonError(404, "not_found", "Organism birth not found.");
    }

    const transactionSignature = input.transactionSignature;
    const birthReference = getBirthReference(
      organism.organismNumber,
      transactionSignature
    );
    const existing = await BirthLocationModel.findOne({
      organismNumber: organism.organismNumber
    }).lean();

    if (existing) {
      if (existing.birthReference !== birthReference) {
        return jsonError(409, "integrity_conflict", "Birth location already exists.");
      }

      return jsonOk({
        recorded: true,
        created: false
      });
    }

    const coarseLatitude = coarsenCoordinate(input.latitude, -90, 90);
    const coarseLongitude = coarsenCoordinate(input.longitude, -180, 180);
    const label = getLocationDisplayLabel(input);

    try {
      await BirthLocationModel.create({
        birthReference,
        organismNumber: organism.organismNumber,
        transactionSignature,
        countryCode: input.countryCode ?? undefined,
        countryName: input.countryName ?? undefined,
        regionLabel: input.regionLabel ?? undefined,
        cityLabel: input.cityLabel ?? undefined,
        label,
        locationKey: getLocationKey(input.countryCode, coarseLatitude, coarseLongitude),
        latitude: coarseLatitude,
        longitude: coarseLongitude,
        coordinatePrecisionDegrees: LOCATION_GRID_DEGREES,
        createdAt: new Date()
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const existingAfterRace = await BirthLocationModel.findOne({
        organismNumber: organism.organismNumber
      }).lean();

      if (!existingAfterRace || existingAfterRace.birthReference !== birthReference) {
        return jsonError(409, "integrity_conflict", "Birth location already exists.");
      }

      return jsonOk({
        recorded: true,
        created: false
      });
    }

    return jsonOk(
      {
        recorded: true,
        created: true
      },
      201
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, "bad_request", "Invalid birth location request.");
    }

    if (error instanceof BirthLocationInputError) {
      return jsonError(400, "bad_request", "Invalid birth location request.");
    }

    return jsonError(503, "server_misconfigured", "Birth location is unavailable.");
  }
}

function parseBirthLocationSubmission(body: JsonObject): BirthLocationSubmission {
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new BirthLocationInputError("Unknown field.");
    }
  }

  const organismNumber = normalizeOrganismNumber(body.organismNumber);
  const transactionSignature = normalizeTransactionSignature(body.transactionSignature);

  if (!organismNumber || !transactionSignature) {
    throw new BirthLocationInputError("Invalid birth reference.");
  }

  return {
    organismNumber,
    transactionSignature,
    latitude: readCoordinate(body.latitude, "latitude", -90, 90),
    longitude: readCoordinate(body.longitude, "longitude", -180, 180),
    countryCode: normalizeCountryCode(body.countryCode),
    countryName: normalizeLocationLabel(body.countryName),
    regionLabel: normalizeLocationLabel(body.regionLabel),
    cityLabel: normalizeLocationLabel(body.cityLabel)
  };
}

function readCoordinate(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new BirthLocationInputError(`${label} is invalid.`);
  }

  return value;
}

function normalizeCountryCode(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BirthLocationInputError("countryCode is invalid.");
  }

  const normalized = value.trim().toUpperCase();

  if (!COUNTRY_CODE_PATTERN.test(normalized) || normalized === "ZZ") {
    throw new BirthLocationInputError("countryCode is invalid.");
  }

  return normalized;
}

function normalizeLocationLabel(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BirthLocationInputError("Location label is invalid.");
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > LOCATION_LABEL_MAX_LENGTH || !LOCATION_LABEL_PATTERN.test(normalized)) {
    throw new BirthLocationInputError("Location label is invalid.");
  }

  return normalized;
}

function getLocationDisplayLabel(input: BirthLocationSubmission) {
  const locality = input.cityLabel ?? input.regionLabel;
  const country = input.countryName ?? input.countryCode;

  if (locality && country && !sameLocationLabel(locality, country)) {
    const displayLabel = `${locality}, ${country}`;

    if (displayLabel.length <= LOCATION_LABEL_MAX_LENGTH) {
      return displayLabel;
    }
  }

  return locality ?? country ?? "Unlabeled region";
}

function sameLocationLabel(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function coarsenCoordinate(value: number, min: number, max: number) {
  const coarse = Number(
    (Math.round(value / LOCATION_GRID_DEGREES) * LOCATION_GRID_DEGREES).toFixed(1)
  );
  const clamped = Math.min(max, Math.max(min, coarse));

  return Object.is(clamped, -0) ? 0 : clamped;
}

function getLocationKey(countryCode: string | null, latitude: number, longitude: number) {
  return `${countryCode ?? "ZZ"}:${latitude.toFixed(1)}:${longitude.toFixed(1)}`;
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
