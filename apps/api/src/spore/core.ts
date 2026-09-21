/**
 * Server-only adapter over `@spore/core-wasm`.
 * No species-law logic — typed passthrough to canonical Rust spore-core.
 */

import { createRequire } from "node:module";
import path from "node:path";

import type * as SporeCoreWasm from "@spore/core-wasm";

if (typeof window !== "undefined") {
  throw new Error("spore-core WASM is server-only.");
}

// Resolve from the API package root so Vercel serverless traces stay stable.
const require = createRequire(path.join(process.cwd(), "package.json"));
const sporeCore = require("@spore/core-wasm") as typeof SporeCoreWasm;

export interface MutateChildGenomeInput {
  parentGenome: Uint8Array;
  parentOrganism: Uint8Array;
  recipientSgtMint: Uint8Array;
  childNumber: bigint;
  slot: bigint;
  bornAt: bigint;
}

export function mutateChildGenome(input: MutateChildGenomeInput): Uint8Array {
  return sporeCore.mutate_child_genome(
    input.parentGenome,
    input.parentOrganism,
    input.recipientSgtMint,
    input.childNumber,
    input.slot,
    input.bornAt
  );
}

export function commitSporeSecret(secret: Uint8Array): Uint8Array {
  return sporeCore.commit_spore_secret(secret);
}

export function sporeSecretMatches(
  secret: Uint8Array,
  commitment: Uint8Array
): boolean {
  return sporeCore.spore_secret_matches(secret, commitment);
}

export function hasLiveSpore(
  activeSporeCommitment: Uint8Array,
  activeSporeExpiresAt: bigint,
  now: bigint
): boolean {
  return sporeCore.has_live_spore(
    activeSporeCommitment,
    activeSporeExpiresAt,
    now
  );
}

export function checkedChildGeneration(parentGeneration: number): number | null {
  const value = sporeCore.checked_child_generation(parentGeneration);
  return value === undefined ? null : value;
}

export function checkedOfferExpiresAt(now: bigint): bigint | null {
  const value = sporeCore.checked_offer_expires_at(now);
  return value === undefined ? null : value;
}

export function checkedNextSporeAt(now: bigint): bigint | null {
  const value = sporeCore.checked_next_spore_at(now);
  return value === undefined ? null : value;
}

export function checkedIncrementU64(value: bigint): bigint | null {
  const next = sporeCore.checked_increment_u64(value);
  return next === undefined ? null : next;
}

export function formatOrganismName(organismNumber: bigint): string {
  return sporeCore.format_organism_name(organismNumber);
}

export function formatOrganismUri(
  metadataBaseUri: string,
  organismNumber: bigint
): string {
  return sporeCore.format_organism_uri(metadataBaseUri, organismNumber);
}

export function isValidMetadataBaseUri(metadataBaseUri: string): boolean {
  return sporeCore.is_valid_metadata_base_uri(metadataBaseUri);
}
