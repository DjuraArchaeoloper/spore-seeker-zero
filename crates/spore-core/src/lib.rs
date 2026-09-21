//! Pure deterministic SPØR species logic.
//!
//! No Anchor, Clock, accounts, PDAs, CPIs, or token runtime parsing.

mod constants;

pub use constants::*;

use sha2::{Digest, Sha256};

/// SHA-256 over concatenated slices — same semantics as Solana `hash::hashv`.
fn sha256v(vals: &[&[u8]]) -> [u8; SPORE_COMMITMENT_BYTE_LENGTH] {
    let mut hasher = Sha256::new();
    for val in vals {
        hasher.update(val);
    }
    hasher.finalize().into()
}

/// `SHA256(secret)` commitment used by release/claim.
pub fn commit_spore_secret(
    secret: &[u8; SPORE_COMMITMENT_BYTE_LENGTH],
) -> [u8; SPORE_COMMITMENT_BYTE_LENGTH] {
    sha256v(&[secret.as_ref()])
}

/// True when `SHA256(secret)` equals the stored commitment.
pub fn spore_secret_matches(
    secret: &[u8; SPORE_COMMITMENT_BYTE_LENGTH],
    commitment: &[u8; SPORE_COMMITMENT_BYTE_LENGTH],
) -> bool {
    commit_spore_secret(secret) == *commitment
}

/// True when a non-empty commitment is still within its offer window.
pub fn has_live_spore(
    active_spore_commitment: &[u8; SPORE_COMMITMENT_BYTE_LENGTH],
    active_spore_expires_at: i64,
    now: i64,
) -> bool {
    *active_spore_commitment != EMPTY_SPORE_COMMITMENT
        && active_spore_expires_at != 0
        && now <= active_spore_expires_at
}

/// Deterministic one-gene mutation. `slot` and `born_at` are explicit inputs
/// (Anchor supplies `Clock` values; callers must not invent entropy).
pub fn mutate_child_genome(
    parent_genome: &[u8; GENOME_BYTE_LENGTH],
    parent_organism: &[u8; PUBKEY_BYTE_LENGTH],
    recipient_sgt_mint: &[u8; PUBKEY_BYTE_LENGTH],
    child_number: u64,
    slot: u64,
    born_at: i64,
) -> [u8; GENOME_BYTE_LENGTH] {
    // Deterministic pseudo-random cosmetic evolution; not adversarial randomness.
    let child_number_bytes = child_number.to_le_bytes();
    let slot_bytes = slot.to_le_bytes();
    let born_at_bytes = born_at.to_le_bytes();
    let seed = sha256v(&[
        parent_genome.as_ref(),
        parent_organism.as_ref(),
        recipient_sgt_mint.as_ref(),
        child_number_bytes.as_ref(),
        slot_bytes.as_ref(),
        born_at_bytes.as_ref(),
    ]);

    let gene_index = usize::from(seed[0]) % GENOME_BYTE_LENGTH;
    let delta = (seed[1] % 255).wrapping_add(1);
    let mut genome = *parent_genome;

    genome[gene_index] = genome[gene_index].wrapping_add(delta);

    genome
}

pub fn checked_child_generation(parent_generation: u32) -> Option<u32> {
    parent_generation.checked_add(1)
}

pub fn checked_offer_expires_at(now: i64) -> Option<i64> {
    now.checked_add(SPORE_OFFER_TTL_SECONDS)
}

pub fn checked_next_spore_at(now: i64) -> Option<i64> {
    now.checked_add(SPORE_REGEN_SECONDS)
}

pub fn checked_increment_u64(value: u64) -> Option<u64> {
    value.checked_add(1)
}

pub fn format_organism_name(organism_number: u64) -> String {
    format!("Organism #{organism_number:06}")
}

pub fn format_organism_uri(metadata_base_uri: &str, organism_number: u64) -> String {
    format!("{metadata_base_uri}/api/nft/{organism_number}")
}

pub fn is_valid_metadata_base_uri(metadata_base_uri: &str) -> bool {
    metadata_base_uri.starts_with("https://")
        && !metadata_base_uri.ends_with('/')
        && metadata_base_uri.len() <= MAX_METADATA_BASE_URI_LENGTH
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commitment_matches_and_rejects() {
        let secret = [7u8; SPORE_COMMITMENT_BYTE_LENGTH];
        let commitment = commit_spore_secret(&secret);
        assert!(spore_secret_matches(&secret, &commitment));
        let other = [8u8; SPORE_COMMITMENT_BYTE_LENGTH];
        assert!(!spore_secret_matches(&other, &commitment));
    }

    #[test]
    fn mutate_changes_exactly_one_byte_and_is_deterministic() {
        let parent = SEEKER_ZERO_GENOME;
        let parent_org = [1u8; PUBKEY_BYTE_LENGTH];
        let recipient = [2u8; PUBKEY_BYTE_LENGTH];
        let a = mutate_child_genome(&parent, &parent_org, &recipient, 1, 99, 1_700_000_000);
        let b = mutate_child_genome(&parent, &parent_org, &recipient, 1, 99, 1_700_000_000);
        assert_eq!(a, b);

        let changed = parent
            .iter()
            .zip(a.iter())
            .filter(|(left, right)| left != right)
            .count();
        assert_eq!(changed, 1);
    }

    #[test]
    fn mutate_entropy_inputs_change_result() {
        let parent = SEEKER_ZERO_GENOME;
        let parent_org = [1u8; PUBKEY_BYTE_LENGTH];
        let recipient = [2u8; PUBKEY_BYTE_LENGTH];
        let base = mutate_child_genome(&parent, &parent_org, &recipient, 1, 99, 1_700_000_000);
        let other_slot =
            mutate_child_genome(&parent, &parent_org, &recipient, 1, 100, 1_700_000_000);
        let other_born =
            mutate_child_genome(&parent, &parent_org, &recipient, 1, 99, 1_700_000_001);
        assert_ne!(base, other_slot);
        assert_ne!(base, other_born);
    }

    #[test]
    fn timing_rules_match_doctrine() {
        assert_eq!(checked_offer_expires_at(1_000), Some(1_000 + 120));
        assert_eq!(checked_next_spore_at(1_000), Some(1_000 + 7_200));
        assert!(has_live_spore(&[1u8; 32], 1_100, 1_050));
        assert!(!has_live_spore(&[1u8; 32], 1_100, 1_101));
        assert!(!has_live_spore(&EMPTY_SPORE_COMMITMENT, 1_100, 1_050));
    }

    #[test]
    fn generation_and_counter_checked() {
        assert_eq!(checked_child_generation(0), Some(1));
        assert_eq!(checked_increment_u64(0), Some(1));
        assert_eq!(checked_child_generation(u32::MAX), None);
        assert_eq!(checked_increment_u64(u64::MAX), None);
    }
}
