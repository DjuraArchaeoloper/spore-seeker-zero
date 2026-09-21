/// Canonical PDA seed labels. Byte constants only; derivation stays Solana-side.
pub const SPECIES_SEED: &[u8] = b"species";
pub const ORGANISM_SEED: &[u8] = b"organism";
pub const CORE_ASSET_SEED: &[u8] = b"core_asset";

pub const PUBKEY_BYTE_LENGTH: usize = 32;
pub const GENOME_BYTE_LENGTH: usize = 16;
pub const SPORE_COMMITMENT_BYTE_LENGTH: usize = 32;
pub const MAX_METADATA_BASE_URI_LENGTH: usize = 96;
pub const MAX_BIRTH_FEE_LAMPORTS: u64 = 10_000_000;

pub const SEEKER_ZERO_ORGANISM_NUMBER: u64 = 0;
pub const SEEKER_ZERO_GENERATION: u32 = 0;
// Canonical root genome bytes only. These do not define phenotype rules yet.
pub const SEEKER_ZERO_GENOME: [u8; GENOME_BYTE_LENGTH] = [
    0x53, 0x50, 0x4f, 0x52, 0x45, 0x00, 0x00, 0x00, 0x53, 0x45, 0x45, 0x4b, 0x45, 0x52,
    0x00, 0x00,
];

pub const SPORE_REGEN_SECONDS: i64 = 7_200;
pub const SPORE_OFFER_TTL_SECONDS: i64 = 120;
pub const EMPTY_SPORE_COMMITMENT: [u8; SPORE_COMMITMENT_BYTE_LENGTH] =
    [0; SPORE_COMMITMENT_BYTE_LENGTH];
