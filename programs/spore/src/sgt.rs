use anchor_lang::{
    prelude::*,
    solana_program::program_option::COption,
};
use anchor_spl::token_2022::{
    spl_token_2022::{
        extension::{
            group_member_pointer::GroupMemberPointer, metadata_pointer::MetadataPointer,
            BaseStateWithExtensions, StateWithExtensions,
        },
        state::{Account as Token2022Account, AccountState, Mint as Token2022Mint},
    },
    ID as TOKEN_2022_PROGRAM_ID,
};
use spl_token_group_interface::state::TokenGroupMember;

use crate::{
    constants::{SGT_GROUP_ADDRESS, SGT_METADATA_ADDRESS, SGT_MINT_AUTHORITY},
    errors::SporeError,
};

pub struct VerifiedSeekerGenesisToken {
    pub mint_address: Pubkey,
}

pub fn verify_seeker_genesis_token<'info>(
    sgt_mint: &AccountInfo<'info>,
    sgt_token_account: &AccountInfo<'info>,
    token_owner: &AccountInfo<'info>,
) -> Result<VerifiedSeekerGenesisToken> {
    require!(
        token_owner.is_signer,
        SporeError::MissingSeekerSignature
    );
    require_keys_eq!(
        *sgt_mint.owner,
        TOKEN_2022_PROGRAM_ID,
        SporeError::InvalidToken2022Account
    );
    require_keys_eq!(
        *sgt_token_account.owner,
        TOKEN_2022_PROGRAM_ID,
        SporeError::InvalidToken2022Account
    );

    let mint_data = sgt_mint.try_borrow_data()?;
    let mint = StateWithExtensions::<Token2022Mint>::unpack(&mint_data)
        .map_err(|_| error!(SporeError::InvalidSeekerGenesisToken))?;

    let token_account_data = sgt_token_account.try_borrow_data()?;
    let token_account = StateWithExtensions::<Token2022Account>::unpack(&token_account_data)
        .map_err(|_| error!(SporeError::InvalidSeekerTokenAccount))?;

    require_keys_eq!(
        token_account.base.mint,
        *sgt_mint.key,
        SporeError::InvalidSeekerTokenAccount
    );
    require_keys_eq!(
        token_account.base.owner,
        *token_owner.key,
        SporeError::InvalidSeekerTokenAccount
    );
    require!(
        token_account.base.amount == 1,
        SporeError::InvalidSeekerTokenAccount
    );
    require!(
        token_account.base.state != AccountState::Uninitialized,
        SporeError::InvalidSeekerTokenAccount
    );

    verify_sgt_mint(sgt_mint.key, &mint)?;

    Ok(VerifiedSeekerGenesisToken {
        mint_address: *sgt_mint.key,
    })
}

fn verify_sgt_mint(
    sgt_mint_address: &Pubkey,
    mint: &StateWithExtensions<Token2022Mint>,
) -> Result<()> {
    require!(
        mint.base.mint_authority == COption::Some(SGT_MINT_AUTHORITY),
        SporeError::InvalidSeekerGenesisToken
    );

    let metadata_pointer = mint
        .get_extension::<MetadataPointer>()
        .map_err(|_| error!(SporeError::InvalidSeekerGenesisToken))?;
    let metadata_pointer_authority = Option::<Pubkey>::from(metadata_pointer.authority);
    let metadata_address = Option::<Pubkey>::from(metadata_pointer.metadata_address);

    require!(
        metadata_pointer_authority == Some(SGT_MINT_AUTHORITY),
        SporeError::InvalidSeekerGenesisToken
    );
    require!(
        metadata_address == Some(SGT_METADATA_ADDRESS),
        SporeError::InvalidSeekerGenesisToken
    );

    let group_member_pointer = mint
        .get_extension::<GroupMemberPointer>()
        .map_err(|_| error!(SporeError::InvalidSeekerGenesisToken))?;
    let group_member_pointer_authority = Option::<Pubkey>::from(group_member_pointer.authority);
    let group_member_address = Option::<Pubkey>::from(group_member_pointer.member_address);

    require!(
        group_member_pointer_authority == Some(SGT_MINT_AUTHORITY),
        SporeError::InvalidSeekerGenesisToken
    );
    require!(
        group_member_address == Some(*sgt_mint_address),
        SporeError::InvalidSeekerGenesisToken
    );

    let group_member = mint
        .get_extension::<TokenGroupMember>()
        .map_err(|_| error!(SporeError::InvalidSeekerGenesisToken))?;

    require_keys_eq!(
        group_member.mint,
        *sgt_mint_address,
        SporeError::InvalidSeekerGenesisToken
    );
    require_keys_eq!(
        group_member.group,
        SGT_GROUP_ADDRESS,
        SporeError::InvalidSeekerGenesisToken
    );

    Ok(())
}
