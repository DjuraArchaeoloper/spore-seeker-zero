import { base58 } from "@metaplex-foundation/umi/serializers";
import { PublicKey, type Connection } from "@solana/web3.js";

import { getAuthenticatedSeeker } from "../../../../src/auth/session";
import { connectToDatabase } from "../../../../src/db/mongoose";
import { getSporeEnv } from "../../../../src/env";
import { readJsonObject, RequestBodyError, type JsonObject } from "../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { BirthLocationModel } from "../../../../src/models/BirthLocation";
import {
  ORGANISM_BIRTH_ERA,
  ORGANISM_STATUS,
  OrganismIndexModel
} from "../../../../src/models/OrganismIndex";
import { SpeciesStateModel } from "../../../../src/models/SpeciesState";
import {
  getBirthReference,
  normalizeOrganismNumber,
  normalizeTransactionSignature
} from "../../../../src/organisms/identifiers";
import { publicOrganismFilter } from "../../../../src/organisms/responses";
import { getVerifiedSolanaConnection } from "../../../../src/spore/solanaConnection";

export const runtime = "nodejs";

const MAX_LOCATION_BODY_BYTES = 4 * 1024;
const LOCATION_GRID_DEGREES = 0.5;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const LOCATION_LABEL_MAX_LENGTH = 80;
const LOCATION_LABEL_PATTERN = /^[\p{L}\p{M} .,'()-]{1,80}$/u;
const MAINNET_SEEKER_ZERO_SGT = "GJPtXDXZnPVB2qqA45YGSx5FVPdHeJxJHHMyxAXiH1bx";
const MAINNET_SEEKER_ZERO_PDA = "9kcwN8aMPsFgWg8gexEKuVTYePtckjCaZDhrUk3waJ2o";
const MPL_CORE_PROGRAM_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
const CORE_CREATE_V1_DISCRIMINATOR = 0;
const CORE_CREATE_V2_DISCRIMINATOR = 20;
const MAX_GENESIS_ASSET_SIGNATURES = 1000;
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
  organismNumber: string | null;
  transactionSignature: string | null;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  countryName: string | null;
  regionLabel: string | null;
  cityLabel: string | null;
};

class BirthLocationInputError extends Error {}
class GenesisReferenceError extends Error {}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const seeker = await getAuthenticatedSeeker(request);
    if (!seeker) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const organism = await findMainnetSeekerZero(seeker.sgtMint);
    if (!organism) {
      return jsonError(404, "not_found", "Organism birth not found.");
    }

    const recorded = await BirthLocationModel.exists({ organismNumber: organism.organismNumber });
    return jsonOk({ eligible: !recorded, recorded: Boolean(recorded) });
  } catch {
    return jsonError(503, "server_misconfigured", "Birth location is unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const seeker = await getAuthenticatedSeeker(request);

    if (!seeker) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const body = await readJsonObject(request, MAX_LOCATION_BODY_BYTES);
    const input = parseBirthLocationSubmission(body);
    const genesisBackfill = input.organismNumber === null;
    const organism = genesisBackfill
      ? await findMainnetSeekerZero(seeker.sgtMint)
      : await OrganismIndexModel.findOne({
          organismNumber: input.organismNumber,
          transactionSignature: input.transactionSignature,
          sgtMint: seeker.sgtMint,
          ...publicOrganismFilter
        })
          .select({ organismNumber: 1, transactionSignature: 1 })
          .lean();

    if (!organism) {
      return jsonError(404, "not_found", "Organism birth not found.");
    }

    const existing = await BirthLocationModel.findOne({
      organismNumber: organism.organismNumber
    }).lean();

    if (genesisBackfill && existing) {
      return jsonOk({ recorded: true, created: false });
    }

    const transactionSignature = genesisBackfill
      ? await resolveGenesisCreateSignature(organism.transactionSignature, organism.coreAsset)
      : input.transactionSignature!;
    const birthReference = getBirthReference(
      organism.organismNumber,
      transactionSignature
    );

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

    if (error instanceof GenesisReferenceError) {
      return jsonError(409, "integrity_conflict", "Seeker Zero birth reference is invalid.");
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

  const hasOrganismNumber = Object.hasOwn(body, "organismNumber");
  const hasTransactionSignature = Object.hasOwn(body, "transactionSignature");
  if (hasOrganismNumber !== hasTransactionSignature) {
    throw new BirthLocationInputError("Invalid birth reference.");
  }
  const organismNumber = hasOrganismNumber ? normalizeOrganismNumber(body.organismNumber) : null;
  const transactionSignature = hasTransactionSignature
    ? normalizeTransactionSignature(body.transactionSignature)
    : null;
  if (hasOrganismNumber && (!organismNumber || !transactionSignature)) {
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

async function findMainnetSeekerZero(sgtMint: string) {
  if (getSporeEnv() !== "mainnet" || sgtMint !== MAINNET_SEEKER_ZERO_SGT) {
    return null;
  }

  const [organism, species] = await Promise.all([
    OrganismIndexModel.findOne({
      organismNumber: "0",
      organismPda: MAINNET_SEEKER_ZERO_PDA,
      sgtMint,
      birthEra: ORGANISM_BIRTH_ERA.serverV1,
      status: ORGANISM_STATUS.finalized,
      generation: 0,
      parentOrganismPda: null,
    }).select({ organismNumber: 1, organismPda: 1, transactionSignature: 1, coreAsset: 1 }).lean(),
    SpeciesStateModel.findOne({ key: "canonical" })
      .select({ seekerZeroOrganismPda: 1 })
      .lean()
  ]);

  return organism?.coreAsset &&
    species?.seekerZeroOrganismPda === organism.organismPda
    ? organism
    : null;
}

async function resolveGenesisCreateSignature(
  storedSignatures: string | null,
  coreAsset: string | null
) {
  const signatures = storedSignatures?.split(",") ?? [];
  if (
    signatures.length !== 2 ||
    !coreAsset ||
    signatures.some((signature) => normalizeTransactionSignature(signature) !== signature)
  ) {
    throw new GenesisReferenceError();
  }

  const connection = await getVerifiedSolanaConnection();
  let transactionUnavailable = false;

  // A resumed bootstrap may store update + revoke, with creation absent from this field.
  for (const signature of signatures) {
    const createsAsset = await isCoreAssetCreation(connection, signature, coreAsset);
    if (createsAsset === true) return signature;
    if (createsAsset === null) transactionUnavailable = true;
  }

  const assetSignatures = await connection.getSignaturesForAddress(
    new PublicKey(coreAsset),
    { limit: MAX_GENESIS_ASSET_SIGNATURES },
    "confirmed"
  );
  for (const entry of assetSignatures) {
    if (entry.err || signatures.includes(entry.signature)) continue;
    const createsAsset = await isCoreAssetCreation(connection, entry.signature, coreAsset);
    if (createsAsset === true) return entry.signature;
    if (createsAsset === null) transactionUnavailable = true;
  }

  if (transactionUnavailable) {
    throw new Error("Seeker Zero Core creation transaction is unavailable.");
  }
  throw new GenesisReferenceError();
}

async function isCoreAssetCreation(
  connection: Connection,
  signature: string,
  coreAsset: string
): Promise<boolean | null> {
  const transaction = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0
  });
  if (!transaction?.meta) {
    return null;
  }

  const message = transaction.transaction.message;
  if (
    transaction.meta.err ||
    transaction.transaction.signatures[0] !== signature ||
    !("accountKeys" in message)
  ) {
    return false;
  }

  const assetIndex = message.accountKeys.findIndex((key) => key.toBase58() === coreAsset);
  const coreProgramIndex = message.accountKeys.findIndex(
    (key) => key.toBase58() === MPL_CORE_PROGRAM_ID
  );
  return assetIndex >= 0 &&
    assetIndex < message.header.numRequiredSignatures &&
    coreProgramIndex >= 0 &&
    message.instructions.some((instruction) => {
      if (
        instruction.programIdIndex !== coreProgramIndex ||
        instruction.accounts[0] !== assetIndex
      ) {
        return false;
      }
      const discriminator = base58.serialize(instruction.data)[0];
      return discriminator === CORE_CREATE_V1_DISCRIMINATOR ||
        discriminator === CORE_CREATE_V2_DISCRIMINATOR;
    });
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
