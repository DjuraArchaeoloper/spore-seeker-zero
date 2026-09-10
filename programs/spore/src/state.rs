use anchor_lang::prelude::*;

use crate::constants::{
    GENOME_BYTE_LENGTH, MAX_METADATA_BASE_URI_LENGTH, SPORE_COMMITMENT_BYTE_LENGTH,
};

const DISCRIMINATOR_SPACE: usize = 8;
const PUBKEY_SPACE: usize = 32;
const OPTION_PUBKEY_SPACE: usize = 1 + PUBKEY_SPACE;
const U64_SPACE: usize = 8;
const U32_SPACE: usize = 4;
const I64_SPACE: usize = 8;
const STRING_LENGTH_PREFIX_SPACE: usize = 4;
const METADATA_BASE_URI_SPACE: usize =
    STRING_LENGTH_PREFIX_SPACE + MAX_METADATA_BASE_URI_LENGTH;
const SPORE_COMMITMENT_SPACE: usize = SPORE_COMMITMENT_BYTE_LENGTH;

#[account]
pub struct Species {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub birth_fee_lamports: u64,
    pub metadata_base_uri: String,
    pub next_organism_number: u64,
    pub seeker_zero_organism: Option<Pubkey>,
    pub total_organisms: u64,
}

impl Species {
    pub const SPACE: usize = DISCRIMINATOR_SPACE
        + PUBKEY_SPACE
        + PUBKEY_SPACE
        + U64_SPACE
        + METADATA_BASE_URI_SPACE
        + U64_SPACE
        + OPTION_PUBKEY_SPACE
        + U64_SPACE;
}

#[account]
pub struct Organism {
    pub organism_number: u64,
    pub sgt_mint: Pubkey,
    pub parent_organism: Option<Pubkey>,
    pub generation: u32,
    pub genome: [u8; GENOME_BYTE_LENGTH],
    pub born_at: i64,
    pub next_spore_at: i64,
    pub active_spore_commitment: [u8; SPORE_COMMITMENT_BYTE_LENGTH],
    pub active_spore_expires_at: i64,
}

impl Organism {
    pub const SPACE: usize = DISCRIMINATOR_SPACE
        + U64_SPACE
        + PUBKEY_SPACE
        + OPTION_PUBKEY_SPACE
        + U32_SPACE
        + GENOME_BYTE_LENGTH
        + I64_SPACE
        + I64_SPACE
        + SPORE_COMMITMENT_SPACE
        + I64_SPACE;
}
