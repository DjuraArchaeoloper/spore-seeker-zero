import { submitBirthLocation } from "../auth/api";
import { getStoredSessionToken } from "../auth/session";
import type { Organism } from "./chain";

type BirthLocationClaim = {
  newborn: Organism;
  transactionSignature?: string | null;
};

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

    const Location = await import("expo-location");
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
    });
    const { latitude, longitude } = position.coords;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    await submitBirthLocation(token, {
      organismNumber: newborn.organismNumber,
      transactionSignature,
      latitude,
      longitude,
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
