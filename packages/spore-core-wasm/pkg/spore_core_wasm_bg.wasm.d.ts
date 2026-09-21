/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const checked_child_generation: (a: number) => number;
export const checked_increment_u64: (a: bigint) => [number, bigint];
export const checked_next_spore_at: (a: bigint) => [number, bigint];
export const checked_offer_expires_at: (a: bigint) => [number, bigint];
export const commit_spore_secret: (a: number, b: number) => [number, number, number, number];
export const format_organism_name: (a: bigint) => [number, number];
export const format_organism_uri: (a: number, b: number, c: bigint) => [number, number];
export const has_live_spore: (a: number, b: number, c: bigint, d: bigint) => [number, number, number];
export const is_valid_metadata_base_uri: (a: number, b: number) => number;
export const mutate_child_genome: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint, h: bigint, i: bigint) => [number, number, number, number];
export const spore_secret_matches: (a: number, b: number, c: number, d: number) => [number, number, number];
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_start: () => void;
