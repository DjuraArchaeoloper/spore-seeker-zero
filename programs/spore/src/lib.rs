use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod sgt;
pub mod state;

use constants::{
    CORE_ASSET_SEED, EMPTY_SPORE_COMMITMENT, GENOME_BYTE_LENGTH, MAX_BIRTH_FEE_LAMPORTS,
    ORGANISM_SEED, SEEKER_ZERO_GENERATION, SEEKER_ZERO_GENOME, SEEKER_ZERO_ORGANISM_NUMBER,
    SPECIES_SEED,
};
use errors::SporeError;
use mpl_core::{
    instructions::CreateV2CpiBuilder,
    types::{PermanentFreezeDelegate, Plugin, PluginAuthority, PluginAuthorityPair},
};
use sgt::verify_seeker_genesis_token;
use spore_core::{
    checked_child_generation, checked_increment_u64, checked_next_spore_at,
    checked_offer_expires_at, format_organism_name, format_organism_uri, has_live_spore,
    is_valid_metadata_base_uri, mutate_child_genome, spore_secret_matches,
};
use state::{Organism, Species};

#[cfg(feature = "devnet-test-sgt")]
include!(concat!(env!("OUT_DIR"), "/devnet_program_id.rs"));
#[cfg(not(feature = "devnet-test-sgt"))]
declare_id!("GVKoapVqZCBNWkuHopCZSFDqBGimxHWuHsFeoEcVd4Me");

#[program]
pub mod spore {
    use super::*;

    pub fn initialize_species(
        ctx: Context<InitializeSpecies>,
        treasury: Pubkey,
        birth_fee_lamports: u64,
        metadata_base_uri: String,
    ) -> Result<()> {
        require!(
            is_valid_metadata_base_uri(&metadata_base_uri),
            SporeError::InvalidMetadataBaseUri
        );
        require_keys_neq!(
            treasury,
            Pubkey::default(),
            SporeError::InvalidTreasury
        );
        require!(
            birth_fee_lamports <= MAX_BIRTH_FEE_LAMPORTS,
            SporeError::BirthFeeTooHigh
        );

        let species = &mut ctx.accounts.species;

        species.authority = ctx.accounts.authority.key();
        species.treasury = treasury;
        species.birth_fee_lamports = birth_fee_lamports;
        species.metadata_base_uri = metadata_base_uri;
        species.next_organism_number = SEEKER_ZERO_ORGANISM_NUMBER;
        species.seeker_zero_organism = None;
        species.total_organisms = 0;

        Ok(())
    }

    // Only Seeker Zero is authority-created. Every other organism must be born.
    pub fn initialize_seeker_zero(ctx: Context<InitializeSeekerZero>) -> Result<()> {
        require!(
            ctx.accounts.species.seeker_zero_organism.is_none(),
            SporeError::SeekerZeroAlreadyInitialized
        );
        require!(
            ctx.accounts.species.next_organism_number == SEEKER_ZERO_ORGANISM_NUMBER
                && ctx.accounts.species.total_organisms == 0,
            SporeError::SpeciesNotReadyForGenesis
        );
        require!(
            ctx.accounts.core_asset.data_is_empty(),
            SporeError::CoreAssetAlreadyExists
        );

        let verified_sgt = verify_seeker_genesis_token(
            &ctx.accounts.sgt_mint,
            &ctx.accounts.sgt_token_account,
            &ctx.accounts.authority.to_account_info(),
        )?;

        let born_at = Clock::get()?.unix_timestamp;
        let seeker_zero_key = {
            let seeker_zero = &mut ctx.accounts.seeker_zero;

            seeker_zero.organism_number = SEEKER_ZERO_ORGANISM_NUMBER;
            seeker_zero.sgt_mint = verified_sgt.mint_address;
            seeker_zero.parent_organism = None;
            seeker_zero.generation = SEEKER_ZERO_GENERATION;
            seeker_zero.genome = SEEKER_ZERO_GENOME;
            seeker_zero.born_at = born_at;
            seeker_zero.next_spore_at = born_at;
            seeker_zero.active_spore_commitment = EMPTY_SPORE_COMMITMENT;
            seeker_zero.active_spore_expires_at = 0;

            seeker_zero.key()
        };

        create_frozen_core_asset(
            &ctx.accounts.core_program.to_account_info(),
            &ctx.accounts.core_asset.to_account_info(),
            &ctx.accounts.authority.to_account_info(),
            &ctx.accounts.authority.to_account_info(),
            &ctx.accounts.species.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            ctx.accounts.species.key(),
            &verified_sgt.mint_address,
            ctx.bumps.species,
            ctx.bumps.core_asset,
            SEEKER_ZERO_ORGANISM_NUMBER,
            &ctx.accounts.species.metadata_base_uri,
        )?;

        let species = &mut ctx.accounts.species;
        species.seeker_zero_organism = Some(seeker_zero_key);
        species.next_organism_number = 1;
        species.total_organisms = 1;

        emit!(OrganismBorn {
            child_organism: seeker_zero_key,
            child_organism_number: SEEKER_ZERO_ORGANISM_NUMBER,
            child_sgt_mint: verified_sgt.mint_address,
            parent_organism: Pubkey::default(),
            core_asset: ctx.accounts.core_asset.key(),
            generation: SEEKER_ZERO_GENERATION,
            genome: SEEKER_ZERO_GENOME,
            born_at,
        });

        Ok(())
    }

    pub fn release_spore(ctx: Context<ReleaseSpore>, commitment: [u8; 32]) -> Result<()> {
        require!(
            commitment != EMPTY_SPORE_COMMITMENT,
            SporeError::InvalidSporeCommitment
        );

        let verified_sgt = verify_seeker_genesis_token(
            &ctx.accounts.parent_sgt_mint,
            &ctx.accounts.parent_sgt_token_account,
            &ctx.accounts.owner.to_account_info(),
        )?;

        let now = Clock::get()?.unix_timestamp;
        let parent = &mut ctx.accounts.parent_organism;

        require_keys_eq!(
            parent.sgt_mint,
            verified_sgt.mint_address,
            SporeError::InvalidOrganismIdentity
        );
        require!(now >= parent.next_spore_at, SporeError::SporeNotReady);
        require!(
            !has_live_spore(
                &parent.active_spore_commitment,
                parent.active_spore_expires_at,
                now,
            ),
            SporeError::ActiveSporeAlreadyReleased
        );

        parent.active_spore_commitment = commitment;
        parent.active_spore_expires_at =
            checked_offer_expires_at(now).ok_or(SporeError::MathOverflow)?;

        Ok(())
    }

    pub fn claim_spore(ctx: Context<ClaimSpore>, secret: [u8; 32]) -> Result<()> {
        require!(
            secret != EMPTY_SPORE_COMMITMENT,
            SporeError::InvalidSporeSecret
        );

        let verified_sgt = verify_seeker_genesis_token(
            &ctx.accounts.recipient_sgt_mint,
            &ctx.accounts.recipient_sgt_token_account,
            &ctx.accounts.recipient.to_account_info(),
        )?;

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let child_organism_key = ctx.accounts.child_organism.key();
        let parent_organism_key = ctx.accounts.parent_organism.key();
        let core_asset_key = ctx.accounts.core_asset.key();
        let metadata_base_uri = ctx.accounts.species.metadata_base_uri.clone();
        let birth_fee_lamports = ctx.accounts.species.birth_fee_lamports;
        require!(
            ctx.accounts.core_asset.data_is_empty(),
            SporeError::CoreAssetAlreadyExists
        );

        require!(
            ctx.accounts.species.seeker_zero_organism.is_some()
                && ctx.accounts.species.next_organism_number > SEEKER_ZERO_ORGANISM_NUMBER
                && ctx.accounts.species.total_organisms > 0,
            SporeError::SpeciesNotReadyForReproduction
        );
        require!(
            ctx.accounts.parent_organism.active_spore_commitment != EMPTY_SPORE_COMMITMENT
                && ctx.accounts.parent_organism.active_spore_expires_at != 0,
            SporeError::NoActiveSpore
        );
        require!(
            now <= ctx.accounts.parent_organism.active_spore_expires_at,
            SporeError::SporeOfferExpired
        );
        require!(
            spore_secret_matches(
                &secret,
                &ctx.accounts.parent_organism.active_spore_commitment,
            ),
            SporeError::InvalidSporeSecret
        );
        require!(
            now >= ctx.accounts.parent_organism.next_spore_at,
            SporeError::SporeNotReady
        );
        require!(
            verified_sgt.mint_address != ctx.accounts.parent_organism.sgt_mint,
            SporeError::SelfReproduction
        );

        let child_number = ctx.accounts.species.next_organism_number;
        let generation = checked_child_generation(ctx.accounts.parent_organism.generation)
            .ok_or(SporeError::MathOverflow)?;
        let genome = mutate_child_genome(
            &ctx.accounts.parent_organism.genome,
            &parent_organism_key.to_bytes(),
            &verified_sgt.mint_address.to_bytes(),
            child_number,
            clock.slot,
            now,
        );
        let next_parent_spore_at =
            checked_next_spore_at(now).ok_or(SporeError::MathOverflow)?;
        let next_organism_number =
            checked_increment_u64(ctx.accounts.species.next_organism_number)
                .ok_or(SporeError::MathOverflow)?;
        let total_organisms = checked_increment_u64(ctx.accounts.species.total_organisms)
            .ok_or(SporeError::MathOverflow)?;

        {
            let child = &mut ctx.accounts.child_organism;
            child.organism_number = child_number;
            child.sgt_mint = verified_sgt.mint_address;
            child.parent_organism = Some(parent_organism_key);
            child.generation = generation;
            child.genome = genome;
            child.born_at = now;
            child.next_spore_at = now;
            child.active_spore_commitment = EMPTY_SPORE_COMMITMENT;
            child.active_spore_expires_at = 0;
        }

        create_frozen_core_asset(
            &ctx.accounts.core_program.to_account_info(),
            &ctx.accounts.core_asset.to_account_info(),
            &ctx.accounts.recipient.to_account_info(),
            &ctx.accounts.recipient.to_account_info(),
            &ctx.accounts.species.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            ctx.accounts.species.key(),
            &verified_sgt.mint_address,
            ctx.bumps.species,
            ctx.bumps.core_asset,
            child_number,
            &metadata_base_uri,
        )?;
        transfer_birth_fee(
            &ctx.accounts.recipient.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            birth_fee_lamports,
        )?;

        let parent = &mut ctx.accounts.parent_organism;
        parent.next_spore_at = next_parent_spore_at;
        parent.active_spore_commitment = EMPTY_SPORE_COMMITMENT;
        parent.active_spore_expires_at = 0;

        let species = &mut ctx.accounts.species;
        species.next_organism_number = next_organism_number;
        species.total_organisms = total_organisms;

        emit!(OrganismBorn {
            child_organism: child_organism_key,
            child_organism_number: child_number,
            child_sgt_mint: verified_sgt.mint_address,
            parent_organism: parent_organism_key,
            core_asset: core_asset_key,
            generation,
            genome,
            born_at: now,
        });

        Ok(())
    }

    pub fn update_birth_fee(
        ctx: Context<UpdateBirthFee>,
        birth_fee_lamports: u64,
    ) -> Result<()> {
        require!(
            birth_fee_lamports <= MAX_BIRTH_FEE_LAMPORTS,
            SporeError::BirthFeeTooHigh
        );

        ctx.accounts.species.birth_fee_lamports = birth_fee_lamports;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeSpecies<'info> {
    #[account(
        init,
        payer = authority,
        space = Species::SPACE,
        seeds = [SPECIES_SEED],
        bump
    )]
    pub species: Account<'info, Species>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateBirthFee<'info> {
    #[account(
        mut,
        seeds = [SPECIES_SEED],
        bump,
        has_one = authority @ SporeError::InvalidGenesisAuthority
    )]
    pub species: Account<'info, Species>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeSeekerZero<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SPECIES_SEED],
        bump,
        has_one = authority @ SporeError::InvalidGenesisAuthority
    )]
    pub species: Account<'info, Species>,

    /// CHECK: Parsed and validated as an official Token-2022 Seeker Genesis Token mint.
    pub sgt_mint: AccountInfo<'info>,

    /// CHECK: Parsed and validated as the authority-owned Token-2022 SGT token account.
    pub sgt_token_account: AccountInfo<'info>,

    #[account(
        init,
        payer = authority,
        space = Organism::SPACE,
        seeds = [ORGANISM_SEED, sgt_mint.key().as_ref()],
        bump
    )]
    pub seeker_zero: Account<'info, Organism>,

    #[account(
        mut,
        seeds = [CORE_ASSET_SEED, sgt_mint.key().as_ref()],
        bump
    )]
    /// CHECK: Created by Metaplex Core through CPI at the canonical SPORE asset PDA.
    pub core_asset: UncheckedAccount<'info>,

    #[account(address = mpl_core::ID @ SporeError::InvalidCoreProgram)]
    /// CHECK: Address-constrained to the official Metaplex Core program.
    pub core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseSpore<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [ORGANISM_SEED, parent_organism.sgt_mint.as_ref()],
        bump
    )]
    pub parent_organism: Account<'info, Organism>,

    /// CHECK: Parsed and validated as an official Token-2022 Seeker Genesis Token mint.
    pub parent_sgt_mint: AccountInfo<'info>,

    /// CHECK: Parsed and validated as the owner-controlled Token-2022 SGT token account.
    pub parent_sgt_token_account: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ClaimSpore<'info> {
    #[account(
        mut,
        seeds = [SPECIES_SEED],
        bump
    )]
    pub species: Account<'info, Species>,

    #[account(
        mut,
        seeds = [ORGANISM_SEED, parent_organism.sgt_mint.as_ref()],
        bump
    )]
    pub parent_organism: Account<'info, Organism>,

    #[account(mut)]
    pub recipient: Signer<'info>,

    /// CHECK: Parsed and validated as an official Token-2022 Seeker Genesis Token mint.
    pub recipient_sgt_mint: AccountInfo<'info>,

    /// CHECK: Parsed and validated as the recipient-controlled Token-2022 SGT token account.
    pub recipient_sgt_token_account: AccountInfo<'info>,

    #[account(
        mut,
        address = species.treasury @ SporeError::InvalidTreasury
    )]
    /// CHECK: Address-constrained to the fixed species treasury.
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = recipient,
        space = Organism::SPACE,
        seeds = [ORGANISM_SEED, recipient_sgt_mint.key().as_ref()],
        bump
    )]
    pub child_organism: Account<'info, Organism>,

    #[account(
        mut,
        seeds = [CORE_ASSET_SEED, recipient_sgt_mint.key().as_ref()],
        bump
    )]
    /// CHECK: Created by Metaplex Core through CPI at the canonical SPORE asset PDA.
    pub core_asset: UncheckedAccount<'info>,

    #[account(address = mpl_core::ID @ SporeError::InvalidCoreProgram)]
    /// CHECK: Address-constrained to the official Metaplex Core program.
    pub core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct OrganismBorn {
    pub child_organism: Pubkey,
    pub child_organism_number: u64,
    pub child_sgt_mint: Pubkey,
    pub parent_organism: Pubkey,
    pub core_asset: Pubkey,
    pub generation: u32,
    pub genome: [u8; GENOME_BYTE_LENGTH],
    pub born_at: i64,
}

#[allow(clippy::too_many_arguments)]
fn create_frozen_core_asset<'info>(
    core_program: &AccountInfo<'info>,
    core_asset: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    species: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    species_key: Pubkey,
    sgt_mint: &Pubkey,
    species_bump: u8,
    core_asset_bump: u8,
    organism_number: u64,
    metadata_base_uri: &str,
) -> Result<()> {
    let name = format_organism_name(organism_number);
    let uri = format_organism_uri(metadata_base_uri, organism_number);
    let species_bump_seed = [species_bump];
    let core_asset_bump_seed = [core_asset_bump];
    let species_seeds: &[&[u8]] = &[SPECIES_SEED, species_bump_seed.as_ref()];
    let core_asset_seeds: &[&[u8]] = &[
        CORE_ASSET_SEED,
        sgt_mint.as_ref(),
        core_asset_bump_seed.as_ref(),
    ];
    let signer_seeds = &[species_seeds, core_asset_seeds];

    CreateV2CpiBuilder::new(core_program)
        .asset(core_asset)
        .collection(None)
        .authority(Some(species))
        .payer(payer)
        .owner(Some(owner))
        .update_authority(Some(species))
        .system_program(system_program)
        .name(name)
        .uri(uri)
        .plugins(vec![PluginAuthorityPair {
            plugin: Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate { frozen: true }),
            authority: Some(PluginAuthority::Address {
                address: species_key,
            }),
        }])
        .invoke_signed(signer_seeds)?;

    Ok(())
}

fn transfer_birth_fee<'info>(
    from: &AccountInfo<'info>,
    treasury: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    lamports: u64,
) -> Result<()> {
    if lamports == 0 {
        return Ok(());
    }

    let transfer_accounts = anchor_lang::system_program::Transfer {
        from: from.clone(),
        to: treasury.clone(),
    };
    let transfer_context =
        CpiContext::new(system_program.clone(), transfer_accounts);

    anchor_lang::system_program::transfer(transfer_context, lamports)
}
