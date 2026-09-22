/**
 * Server-only adapter over the canonical Rust spore-core WASM bindings.
 * No species-law logic — typed passthrough to packages/spore-core-wasm/pkg.
 */

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import type * as SporeCoreWasm from "@spore/core-wasm";

if (typeof window !== "undefined") {
  throw new Error("spore-core WASM is server-only.");
}

function resolveSporeCoreWasmEntry(): string {
  const candidates = [
    // Monorepo-root execution (Vercel / workspace root cwd).
    path.resolve(process.cwd(), "packages/spore-core-wasm/pkg/spore_core_wasm.js"),
    // apps/api execution (local next from apps/api).
    path.resolve(process.cwd(), "../../packages/spore-core-wasm/pkg/spore_core_wasm.js"),
  ];

  const entry = candidates.find((candidate) => fs.existsSync(candidate));
  if (!entry) {
    throw new Error(
      "spore-core WASM runtime files are missing. Expected packages/spore-core-wasm/pkg/spore_core_wasm.js relative to process.cwd().",
    );
  }
  return entry;
}

// Load wasm-bindgen Node output by absolute path — never resolve `@spore/core-wasm` at runtime.
const require = createRequire(path.join(process.cwd(), "package.json"));
const sporeCore = require(resolveSporeCoreWasmEntry()) as typeof SporeCoreWasm;

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
