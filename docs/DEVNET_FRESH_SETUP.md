# Fresh DEVNET Setup Checklist

This checklist is for a completely fresh DEVNET-only SPORE environment. It must not be used for mainnet, and none of the generated secrets belong in mobile code or tracked files.

## Local generation

Generate fresh local identities after this prompt with:

```sh
node scripts/devnet/fresh-devnet-setup.cjs generate
```

The default output directory is `scripts/devnet/.generated/fresh-devnet/`, which is gitignored. The generate step creates local files only; it does not contact devnet, deploy a program, initialize Species, initialize Seeker Zero, build Android, or mint tester SGTs.

## Generated identities

The setup script generates:

- SPORE program keypair and Program ID
- Species / Seeker Zero authority wallet
- Test-SGT mint authority
- Devnet sponsor wallet
- Test-SGT group mint/config authority material used by the verifier

The script prints only public values and file paths. Private key material is written to local gitignored files.

## Current fresh devnet public values

The generated setup currently in `scripts/devnet/.generated/fresh-devnet/` is wired around:

```sh
SPORE_DEVNET_PROGRAM_ID=9HvZ7ckadQt38R1KxYPhP759yCCx4MRF8NBquV4HUUXZ
SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY=F4sYop49na9Mgy2xBricUgq5YVgNXYX5n4BZWHfXXtnY
SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS=C7htVBfxMFUEYVai6s2haQqQkoce5y31mpk8a3r8sBW4
SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS=C7htVBfxMFUEYVai6s2haQqQkoce5y31mpk8a3r8sBW4
SPORE_DEVNET_SPONSOR_PUBLIC_KEY=Fktdbq1aKgTsrMQnVVWy49u4rmRi1xzAX9aMrGS4dw5P
SPORE_DEVNET_GENESIS_WALLET=5aGaP8JaquRsyB3EKCaCJimPvUFnv634j8QfLJPkxemG
```

## DEVNET API environment template

Use the generated `api.devnet.env` and `api.devnet.secrets.env` as the source of truth. A fresh devnet API environment must contain placeholders or generated values for:

```sh
MONGODB_URI=mongodb+srv://<DEVNET_MONGODB_USER>:<DEVNET_MONGODB_PASSWORD>@<DEVNET_MONGODB_CLUSTER>/spor_devnet_fresh?retryWrites=true&w=majority
# Fresh devnet Mongo database name: spor_devnet_fresh
HELIUS_API_KEY=<DEVNET_HELIUS_API_KEY>
SIWS_DOMAIN=<DEVNET_SIWS_DOMAIN>
SIWS_URI=<DEVNET_API_URL>
HELIUS_WEBHOOK_AUTH=<DEVNET_ONLY_WEBHOOK_AUTH>

SPORE_SOLANA_CLUSTER=devnet
SPORE_PROGRAM_ID=9HvZ7ckadQt38R1KxYPhP759yCCx4MRF8NBquV4HUUXZ
SPORE_DEVNET_APPROVED_PROGRAM_ID=9HvZ7ckadQt38R1KxYPhP759yCCx4MRF8NBquV4HUUXZ

SPORE_DEVNET_TEST_SGT_BOOTSTRAP_ENABLED=true
SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY=F4sYop49na9Mgy2xBricUgq5YVgNXYX5n4BZWHfXXtnY
SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS=C7htVBfxMFUEYVai6s2haQqQkoce5y31mpk8a3r8sBW4
SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS=C7htVBfxMFUEYVai6s2haQqQkoce5y31mpk8a3r8sBW4
SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET=<DEVNET_ONLY_BASE64_KEYPAIR_SECRET>

SPORE_DEVNET_SPONSOR_PUBLIC_KEY=Fktdbq1aKgTsrMQnVVWy49u4rmRi1xzAX9aMrGS4dw5P
SPORE_DEVNET_SPONSOR_SECRET=<DEVNET_ONLY_BASE64_KEYPAIR_SECRET>
SPORE_DEVNET_TESTER_FUNDING_TARGET_LAMPORTS=100000000
```

## DEVNET Anchor build environment template

Use the generated `anchor.devnet.env` before a later devnet Anchor build with `devnet-test-sgt`:

```sh
SPORE_DEVNET_PROGRAM_ID=9HvZ7ckadQt38R1KxYPhP759yCCx4MRF8NBquV4HUUXZ
SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY=F4sYop49na9Mgy2xBricUgq5YVgNXYX5n4BZWHfXXtnY
SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS=C7htVBfxMFUEYVai6s2haQqQkoce5y31mpk8a3r8sBW4
SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS=C7htVBfxMFUEYVai6s2haQqQkoce5y31mpk8a3r8sBW4
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
ANCHOR_WALLET=<LOCAL_SPECIES_AUTHORITY_KEYPAIR_PATH>
```

When the Anchor program is built with `devnet-test-sgt`, `programs/spore/build.rs` requires these DEVNET variables and generates both the devnet Program ID and Test-SGT verifier constants for that build.

## DEVNET mobile environment template

Use the generated `mobile.devnet.env` for a later devnet Android build:

```sh
EXPO_PUBLIC_SPORE_API_URL=<DEVNET_API_URL>
EXPO_PUBLIC_SPORE_VISUAL_PREVIEW=false
EXPO_PUBLIC_SPORE_SOLANA_CLUSTER=devnet
EXPO_PUBLIC_SPORE_RPC_URL=https://api.devnet.solana.com
EXPO_PUBLIC_SPORE_PROGRAM_ID=9HvZ7ckadQt38R1KxYPhP759yCCx4MRF8NBquV4HUUXZ
EXPO_PUBLIC_SPORE_DEVNET_GENESIS_ENABLED=true
EXPO_PUBLIC_SPORE_DEVNET_GENESIS_WALLET=5aGaP8JaquRsyB3EKCaCJimPvUFnv634j8QfLJPkxemG
```

Mobile receives public DEVNET values only. It must never receive Test-SGT mint authority or sponsor secrets. The tracked `apps/mobile/devnet.env.example` and `development` / `preview` EAS profiles intentionally use `<DEVNET_API_URL>` until the devnet API URL exists.

## Loading/copying generated env

Use these files as the source of truth when configuring devnet:

```sh
scripts/devnet/.generated/fresh-devnet/anchor.devnet.env
scripts/devnet/.generated/fresh-devnet/api.devnet.env
scripts/devnet/.generated/fresh-devnet/api.devnet.secrets.env
scripts/devnet/.generated/fresh-devnet/mobile.devnet.env
```

For deploy hosts, copy public API values from `apps/api/devnet.env.example` or the generated `api.devnet.env`, set `HELIUS_WEBHOOK_AUTH` as a devnet-only secret, then copy only the two private key secrets from `api.devnet.secrets.env` into the devnet API secret store. For mobile, copy only public values from `apps/mobile/devnet.env.example` or `mobile.devnet.env`.

## Fresh database strategy

Create a separate empty devnet Mongo database and point `MONGODB_URI` at it. Do not migrate or copy production data. A fresh devnet database starts with empty organisms, identities, Test-SGT assignments, sessions, webhooks, and outbreak data. Seeker Zero should later become organism `#000000` through the normal Seeker Zero genesis path.

## Later manual sequence

After local generation, use the generated README and manifest for the later deployment sequence:

1. Fund the generated sponsor wallet on Solana devnet.
2. Create the DEVNET Test-SGT group/config with `create-test-sgt-group`.
3. Apply the fresh Program ID to devnet-only local config with `apply-program-id`.
4. Build and deploy the Anchor program with `devnet-test-sgt`.
5. Configure the devnet API with the generated API env files and a fresh devnet Mongo database.
6. Configure the devnet mobile build with the generated mobile env values.
7. Initialize Species and Seeker Zero in a later step.

Mainnet remains on the default program declaration and real-SGT constants because the generated DEVNET values are required only when the `devnet-test-sgt` feature and DEVNET bootstrap environment are explicitly enabled.
