use std::{env, fs, path::PathBuf};

const BASE58_ALPHABET: &str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

fn main() {
    println!("cargo:rerun-if-env-changed=SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY");
    println!("cargo:rerun-if-env-changed=SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS");
    println!("cargo:rerun-if-env-changed=SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS");

    if env::var_os("CARGO_FEATURE_DEVNET_TEST_SGT").is_none() {
        return;
    }

    let mint_authority = required_pubkey("SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY");
    let metadata_address = required_pubkey("SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS");
    let group_address = required_pubkey("SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS");
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is set by Cargo"))
        .join("devnet_test_sgt_constants.rs");

    fs::write(
        output,
        format!(
            "pub const SGT_MINT_AUTHORITY: Pubkey = pubkey!(\"{mint_authority}\");\n\
             pub const SGT_METADATA_ADDRESS: Pubkey = pubkey!(\"{metadata_address}\");\n\
             pub const SGT_GROUP_ADDRESS: Pubkey = pubkey!(\"{group_address}\");\n"
        ),
    )
    .expect("write generated devnet SGT constants");
}

fn required_pubkey(name: &str) -> String {
    let value = env::var(name).unwrap_or_else(|_| {
        panic!("{name} is required when building with feature devnet-test-sgt")
    });

    if !(32..=44).contains(&value.len()) || !value.chars().all(|ch| BASE58_ALPHABET.contains(ch)) {
        panic!("{name} must be a base58 Solana public key");
    }

    value
}
