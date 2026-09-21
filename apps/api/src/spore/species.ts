import type { ClientSession } from "mongoose";

import {
  CANONICAL_SPECIES_KEY,
  SpeciesStateModel,
  type SpeciesState
} from "../models/SpeciesState";
import { SporeDomainError } from "./errors";

export async function getCanonicalSpecies(
  session?: ClientSession
): Promise<SpeciesState> {
  const query = SpeciesStateModel.findOne({ key: CANONICAL_SPECIES_KEY });

  if (session) {
    query.session(session);
  }

  const species = await query.lean();

  if (!species) {
    throw new SporeDomainError(
      "species_not_ready",
      "Canonical species state is not initialized."
    );
  }

  return species;
}

export type UpsertCanonicalSpeciesInput = {
  seekerZeroOrganismPda: string | null;
  nextOrganismNumber: string;
  totalOrganisms: string;
  treasury: string;
  birthFeeLamports: string;
  metadataBaseUri: string;
};

/**
 * Creates the singleton species record exactly once.
 * Refuses to overwrite an existing canonical species.
 */
export async function insertCanonicalSpeciesOnce(
  input: UpsertCanonicalSpeciesInput,
  session?: ClientSession
): Promise<SpeciesState> {
  const updatedAt = new Date();
  const document = {
    key: CANONICAL_SPECIES_KEY,
    seekerZeroOrganismPda: input.seekerZeroOrganismPda,
    nextOrganismNumber: input.nextOrganismNumber,
    totalOrganisms: input.totalOrganisms,
    treasury: input.treasury,
    birthFeeLamports: input.birthFeeLamports,
    metadataBaseUri: input.metadataBaseUri,
    updatedAt
  };

  try {
    await SpeciesStateModel.create([document], session ? { session } : undefined);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new SporeDomainError(
        "species_not_ready",
        "Canonical species state already exists."
      );
    }

    throw error;
  }

  return getCanonicalSpecies(session);
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}
