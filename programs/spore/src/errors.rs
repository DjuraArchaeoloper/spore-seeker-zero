use anchor_lang::prelude::*;

#[error_code]
pub enum SporeError {
    #[msg("Species is not ready for Seeker Zero genesis.")]
    SpeciesNotReadyForGenesis,

    #[msg("Seeker Zero has already been initialized.")]
    SeekerZeroAlreadyInitialized,

    #[msg("Invalid Seeker Zero genesis authority.")]
    InvalidGenesisAuthority,

    #[msg("Species is not ready for reproduction.")]
    SpeciesNotReadyForReproduction,

    #[msg("Organism spore is not ready.")]
    SporeNotReady,

    #[msg("An active spore is already released.")]
    ActiveSporeAlreadyReleased,

    #[msg("Invalid spore commitment.")]
    InvalidSporeCommitment,

    #[msg("No active spore is available.")]
    NoActiveSpore,

    #[msg("Spore offer has expired.")]
    SporeOfferExpired,

    #[msg("Invalid spore secret.")]
    InvalidSporeSecret,

    #[msg("Invalid organism identity.")]
    InvalidOrganismIdentity,

    #[msg("An organism cannot reproduce into the same SGT.")]
    SelfReproduction,

    #[msg("Arithmetic overflow.")]
    MathOverflow,

    #[msg("Invalid treasury account.")]
    InvalidTreasury,

    #[msg("Birth fee exceeds the SPORE maximum.")]
    BirthFeeTooHigh,

    #[msg("Invalid metadata base URI.")]
    InvalidMetadataBaseUri,

    #[msg("Invalid Metaplex Core program.")]
    InvalidCoreProgram,

    #[msg("Core Asset already exists.")]
    CoreAssetAlreadyExists,

    #[msg("Expected Token-2022 account.")]
    InvalidToken2022Account,

    #[msg("Seeker token owner must sign.")]
    MissingSeekerSignature,

    #[msg("Invalid Seeker token account.")]
    InvalidSeekerTokenAccount,

    #[msg("Invalid Seeker Genesis Token.")]
    InvalidSeekerGenesisToken,
}
