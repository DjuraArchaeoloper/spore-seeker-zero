/* tslint:disable */
/* eslint-disable */

export function checked_child_generation(parent_generation: number): number | undefined;

export function checked_increment_u64(value: bigint): bigint | undefined;

export function checked_next_spore_at(now: bigint): bigint | undefined;

export function checked_offer_expires_at(now: bigint): bigint | undefined;

export function commit_spore_secret(secret: Uint8Array): Uint8Array;

export function format_organism_name(organism_number: bigint): string;

export function format_organism_uri(metadata_base_uri: string, organism_number: bigint): string;

export function has_live_spore(active_spore_commitment: Uint8Array, active_spore_expires_at: bigint, now: bigint): boolean;

export function is_valid_metadata_base_uri(metadata_base_uri: string): boolean;

/**
 * Deterministic one-gene mutation. `slot` and `born_at` are explicit entropy inputs.
 */
export function mutate_child_genome(parent_genome: Uint8Array, parent_organism: Uint8Array, recipient_sgt_mint: Uint8Array, child_number: bigint, slot: bigint, born_at: bigint): Uint8Array;

export function spore_secret_matches(secret: Uint8Array, commitment: Uint8Array): boolean;
