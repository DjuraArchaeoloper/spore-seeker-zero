import {
  submitBirthLocation,
  submitSeekerZeroBirthLocation,
  type BirthLocationCoordinates,
} from "../auth/api";
import { getStoredSessionToken } from "../auth/session";
import type { Organism } from "./chain";

type ExpoLocation = typeof import("expo-location");
type ReverseGeocodedAddress = Awaited<
  ReturnType<ExpoLocation["reverseGeocodeAsync"]>
>[number];

type BirthLocationClaim = {
  newborn: Organism;
  transactionSignature?: string | null;
};

type BirthLocality = {
  cityLabel?: string;
  countryCode?: string;
  countryName?: string;
  regionLabel?: string;
};

const LOCATION_LABEL_MAX_LENGTH = 80;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const LOCATION_LABEL_PATTERN = /^[\p{L}\p{M} .,'()-]{1,80}$/u;

export async function submitOptionalBirthLocation({
  newborn,
  transactionSignature,
}: BirthLocationClaim) {
  if (!transactionSignature) {
    return;
  }

  try {
    const token = await getStoredSessionToken();

    if (!token) {
      return;
    }

    const location = await acquireOptionalBirthLocation();
    if (!location) {
      return;
    }

    await submitBirthLocation(token, {
      organismNumber: newborn.organismNumber,
      transactionSignature,
      ...location,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[SPØR LOCATION] Birth location skipped.",
        error instanceof Error ? error.message : "Unknown location error.",
      );
    }
  }
}

export async function submitOptionalSeekerZeroBirthLocation() {
  const token = await getStoredSessionToken();
  if (!token) {
    throw new Error("Sign in again to continue.");
  }

  const location = await acquireOptionalBirthLocation();
  if (!location) {
    return false;
  }

  await submitSeekerZeroBirthLocation(token, location);
  return true;
}

async function acquireOptionalBirthLocation(): Promise<BirthLocationCoordinates | null> {
  const Location = await import("expo-location");
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Lowest,
  });
  const { latitude, longitude } = position.coords;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const locality = await reverseGeocodeBirthLocality(Location, latitude, longitude);
  return { latitude, longitude, ...locality };
}

async function reverseGeocodeBirthLocality(
  Location: ExpoLocation,
  latitude: number,
  longitude: number,
): Promise<BirthLocality> {
  try {
    const [address] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    return getBirthLocality(address);
  } catch {
    return {};
  }
}

function getBirthLocality(address?: ReverseGeocodedAddress | null): BirthLocality {
  if (!address) {
    return {};
  }

  const cityLabel = firstLocationLabel(
    address.city,
    address.district,
    address.subregion,
    address.region,
  );
  const regionLabel = normalizeLocationLabel(address.region);
  const countryCode = normalizeCountryCode(address.isoCountryCode);
  const countryName = normalizeLocationLabel(address.country);

  return {
    ...(cityLabel ? { cityLabel } : {}),
    ...(regionLabel ? { regionLabel } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(countryName ? { countryName } : {}),
  };
}

function firstLocationLabel(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeLocationLabel(value);

    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function normalizeLocationLabel(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (
    normalized.length === 0 ||
    normalized.length > LOCATION_LABEL_MAX_LENGTH ||
    !LOCATION_LABEL_PATTERN.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

function normalizeCountryCode(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  return COUNTRY_CODE_PATTERN.test(normalized) && normalized !== "ZZ"
    ? normalized
    : undefined;
}
