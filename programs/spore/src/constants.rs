use anchor_lang::{
    prelude::Pubkey,
    solana_program::pubkey,
};

pub use spore_core::{
    CORE_ASSET_SEED, EMPTY_SPORE_COMMITMENT, GENOME_BYTE_LENGTH, MAX_BIRTH_FEE_LAMPORTS,
    MAX_METADATA_BASE_URI_LENGTH, ORGANISM_SEED, SEEKER_ZERO_GENERATION, SEEKER_ZERO_GENOME,
    SEEKER_ZERO_ORGANISM_NUMBER, SPECIES_SEED, SPORE_COMMITMENT_BYTE_LENGTH,
    SPORE_OFFER_TTL_SECONDS, SPORE_REGEN_SECONDS,
};

// Official Solana Mobile Seeker Genesis Token addresses.
// Source: https://docs.solanamobile.com/marketing/engaging-seeker-users
#[cfg(not(feature = "devnet-test-sgt"))]
pub const SGT_MINT_AUTHORITY: Pubkey = pubkey!("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4");
#[cfg(not(feature = "devnet-test-sgt"))]
pub const SGT_METADATA_ADDRESS: Pubkey = pubkey!("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
#[cfg(not(feature = "devnet-test-sgt"))]
pub const SGT_GROUP_ADDRESS: Pubkey = pubkey!("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");

#[cfg(feature = "devnet-test-sgt")]
include!(concat!(env!("OUT_DIR"), "/devnet_test_sgt_constants.rs"));
