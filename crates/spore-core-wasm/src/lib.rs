//! Thin wasm-bindgen surface over `spore-core`.
//! No species-law logic lives here — only FFI length checks and passthroughs.

use spore_core::{
    GENOME_BYTE_LENGTH, PUBKEY_BYTE_LENGTH, SPORE_COMMITMENT_BYTE_LENGTH,
};
use wasm_bindgen::prelude::*;

fn as_fixed<const N: usize>(bytes: &[u8], label: &str) -> Result<[u8; N], JsValue> {
    bytes
        .try_into()
        .map_err(|_| JsValue::from_str(&format!("{label} must be {N} bytes")))
}

/// Deterministic one-gene mutation. `slot` and `born_at` are explicit entropy inputs.
#[wasm_bindgen]
pub fn mutate_child_genome(
    parent_genome: &[u8],
    parent_organism: &[u8],
    recipient_sgt_mint: &[u8],
    child_number: u64,
    slot: u64,
    born_at: i64,
) -> Result<Vec<u8>, JsValue> {
    let genome = spore_core::mutate_child_genome(
        &as_fixed::<GENOME_BYTE_LENGTH>(parent_genome, "parent_genome")?,
        &as_fixed::<PUBKEY_BYTE_LENGTH>(parent_organism, "parent_organism")?,
        &as_fixed::<PUBKEY_BYTE_LENGTH>(recipient_sgt_mint, "recipient_sgt_mint")?,
        child_number,
        slot,
        born_at,
    );

    Ok(genome.to_vec())
}

#[wasm_bindgen]
pub fn commit_spore_secret(secret: &[u8]) -> Result<Vec<u8>, JsValue> {
    let commitment = spore_core::commit_spore_secret(&as_fixed::<SPORE_COMMITMENT_BYTE_LENGTH>(
        secret,
        "secret",
    )?);

    Ok(commitment.to_vec())
}

#[wasm_bindgen]
pub fn spore_secret_matches(secret: &[u8], commitment: &[u8]) -> Result<bool, JsValue> {
    Ok(spore_core::spore_secret_matches(
        &as_fixed::<SPORE_COMMITMENT_BYTE_LENGTH>(secret, "secret")?,
        &as_fixed::<SPORE_COMMITMENT_BYTE_LENGTH>(commitment, "commitment")?,
    ))
}

#[wasm_bindgen]
pub fn has_live_spore(
    active_spore_commitment: &[u8],
    active_spore_expires_at: i64,
    now: i64,
) -> Result<bool, JsValue> {
    Ok(spore_core::has_live_spore(
        &as_fixed::<SPORE_COMMITMENT_BYTE_LENGTH>(
            active_spore_commitment,
            "active_spore_commitment",
        )?,
        active_spore_expires_at,
        now,
    ))
}

#[wasm_bindgen]
pub fn checked_child_generation(parent_generation: u32) -> Option<u32> {
    spore_core::checked_child_generation(parent_generation)
}

#[wasm_bindgen]
pub fn checked_offer_expires_at(now: i64) -> Option<i64> {
    spore_core::checked_offer_expires_at(now)
}

#[wasm_bindgen]
pub fn checked_next_spore_at(now: i64) -> Option<i64> {
    spore_core::checked_next_spore_at(now)
}

#[wasm_bindgen]
pub fn checked_increment_u64(value: u64) -> Option<u64> {
    spore_core::checked_increment_u64(value)
}

#[wasm_bindgen]
pub fn format_organism_name(organism_number: u64) -> String {
    spore_core::format_organism_name(organism_number)
}

#[wasm_bindgen]
pub fn format_organism_uri(metadata_base_uri: &str, organism_number: u64) -> String {
    spore_core::format_organism_uri(metadata_base_uri, organism_number)
}

#[wasm_bindgen]
pub fn is_valid_metadata_base_uri(metadata_base_uri: &str) -> bool {
    spore_core::is_valid_metadata_base_uri(metadata_base_uri)
}
