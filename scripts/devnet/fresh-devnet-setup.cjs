#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} = require("@solana/web3.js");
const {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_GROUP_MEMBER_SIZE,
  TOKEN_GROUP_SIZE,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeGroupMemberPointerInstruction,
  createInitializeGroupInstruction,
  createInitializeGroupPointerInstruction,
  createInitializeMemberInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getGroupMemberPointerState,
  getMetadataPointerState,
  getMint,
  getMintLen,
  getTokenGroupMemberState,
  getTokenGroupState,
  unpackMint
} = require("@solana/spl-token");

const PERMANENT_PROGRAM_ID = "Bo5SBbmJiGW7xFiHun5rikfqdbUagSXdQQJN4d7PpGPw";
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_OUT_DIR = "scripts/devnet/.generated/fresh-devnet";
const DEFAULT_MONGODB_DB_NAME = "spor_devnet";
const DEFAULT_TESTER_FUNDING_TARGET_LAMPORTS = 100_000_000;
const DEFAULT_TEST_SGT_GROUP_MAX_SIZE = 1_000_000n;
const CONFIRM_OPTIONS = {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
  skipPreflight: false,
  maxRetries: 5
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const args = parseArgs(argv);

  switch (command) {
    case "generate":
      generateFreshDevnet(args);
      break;
    case "show-env":
      showEnv(args);
      break;
    case "create-test-sgt-group":
      await createTestSgtGroup(args);
      break;
    case "create-test-sgt":
      await createTestSgt(args);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function generateFreshDevnet(args) {
  const outDir = resolveOutputDir(args.outDir ?? DEFAULT_OUT_DIR);
  const manifestPath = path.join(outDir, "manifest.json");
  const existingManifest = tryLoadManifest(manifestPath);
  const programId = normalizeProgramId(args.programId ?? PERMANENT_PROGRAM_ID, "--program-id");
  const rpcUrl = args.rpcUrl ?? DEFAULT_RPC_URL;
  const apiUrl = args.apiUrl ?? "<DEVNET_API_URL>";
  const mongodbDbName = args.mongodbDbName ?? DEFAULT_MONGODB_DB_NAME;
  const mongodbUri = args.mongodbUri ?? renderMongoPlaceholderUri(mongodbDbName);
  const heliusApiKey = args.heliusApiKey ?? "<DEVNET_HELIUS_API_KEY>";
  const siwsDomain = args.siwsDomain ?? "<DEVNET_SIWS_DOMAIN>";
  const testerFundingTargetLamports = args.testerFundingTargetLamports ?? String(DEFAULT_TESTER_FUNDING_TARGET_LAMPORTS);

  if (existingManifest) {
    assertExistingManifestMatches(existingManifest, {
      programId,
      rpcUrl: args.rpcUrl,
      mongodbDbName: args.mongodbDbName,
      mongodbUri: args.mongodbUri,
      serverAuthorityKeypair: args.serverAuthorityKeypair,
      sponsorKeypair: args.sponsorKeypair,
      testSgtMintAuthorityKeypair: args.testSgtMintAuthorityKeypair,
      testSgtGroupMintKeypair: args.testSgtGroupMintKeypair
    });
    printGenerationSummary(existingManifest, slashPath(manifestPath), {
      reused: true
    });
    return;
  }

  const requiredSecrets = loadRequiredGenerateSecrets();
  const serverAuthorityKeypair = loadRequiredKeypair(args.serverAuthorityKeypair, "--server-authority-keypair");

  ensureFreshOutputDirectory(outDir);

  const keypairDir = path.join(outDir, "keypairs");
  const testSgtMintAuthorityKeypair = loadOrGenerateKeypair(
    args.testSgtMintAuthorityKeypair,
    path.join(keypairDir, "test-sgt-mint-authority.json")
  );
  const sponsorKeypair = loadOrGenerateKeypair(
    args.sponsorKeypair,
    path.join(keypairDir, "devnet-sponsor.json")
  );
  const testSgtGroupMintKeypair = loadOrGenerateKeypair(
    args.testSgtGroupMintKeypair,
    path.join(keypairDir, "test-sgt-group-mint.json")
  );
  const keypairs = {
    serverAuthority: serverAuthorityKeypair.keypair,
    testSgtMintAuthority: testSgtMintAuthorityKeypair.keypair,
    sponsor: sponsorKeypair.keypair,
    testSgtGroupMint: testSgtGroupMintKeypair.keypair
  };
  const serverAuthority = keypairs.serverAuthority.publicKey.toBase58();
  const testSgtMintAuthority = keypairs.testSgtMintAuthority.publicKey.toBase58();
  const sponsor = keypairs.sponsor.publicKey.toBase58();
  const testSgtGroupMint = keypairs.testSgtGroupMint.publicKey.toBase58();
  const manifest = {
    version: 2,
    cluster: "devnet",
    rpcUrl,
    apiUrl,
    devnetGenesisHash: DEVNET_GENESIS_HASH,
    generatedAt: new Date().toISOString(),
    program: {
      publicKey: programId
    },
    serverAuthority: {
      publicKey: serverAuthority,
      keypairPath: slashPath(serverAuthorityKeypair.path)
    },
    testSgt: {
      mintAuthority: testSgtMintAuthority,
      mintAuthorityKeypairPath: slashPath(testSgtMintAuthorityKeypair.path),
      metadataAddress: testSgtGroupMint,
      groupAddress: testSgtGroupMint,
      groupMint: testSgtGroupMint,
      groupMintKeypairPath: slashPath(testSgtGroupMintKeypair.path),
      groupMintAuthority: sponsor,
      groupUpdateAuthority: sponsor,
      groupMaxSize: DEFAULT_TEST_SGT_GROUP_MAX_SIZE.toString()
    },
    sponsor: {
      publicKey: sponsor,
      keypairPath: slashPath(sponsorKeypair.path)
    },
    mongo: {
      uri: mongodbUri,
      databaseName: mongodbDbName
    },
    envFiles: {
      apiPublic: slashPath(path.join(outDir, "api.devnet.env")),
      apiSecrets: slashPath(path.join(outDir, "api.devnet.secrets.env")),
      mobile: slashPath(path.join(outDir, "mobile.devnet.env"))
    }
  };

  writeFileExclusive(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  writeFileExclusive(
    path.join(outDir, "api.devnet.env"),
    renderApiPublicEnv({
      programId,
      rpcUrl,
      apiUrl,
      mongodbUri,
      mongodbDbName,
      heliusApiKey,
      siwsDomain,
      testSgtMintAuthority,
      testSgtGroupMint,
      sponsor,
      testerFundingTargetLamports
    }),
    0o600
  );
  writeFileExclusive(
    path.join(outDir, "api.devnet.secrets.env"),
    renderApiSecretsEnv(keypairs, requiredSecrets),
    0o600
  );
  writeFileExclusive(
    path.join(outDir, "mobile.devnet.env"),
    renderMobileEnv({
      apiUrl,
      rpcUrl,
      programId
    }),
    0o600
  );
  writeFileExclusive(path.join(outDir, "README.md"), renderGeneratedReadme(manifest, slashPath(manifestPath)), 0o600);

  printGenerationSummary(manifest, slashPath(manifestPath));
}

function showEnv(args) {
  const manifest = loadManifest(args.manifest);

  console.log(renderPublicSummary(manifest));
  console.log("");
  console.log(`API public env: ${manifest.envFiles.apiPublic}`);
  console.log(`API secret env: ${manifest.envFiles.apiSecrets}`);
  console.log(`Mobile env: ${manifest.envFiles.mobile}`);
}

async function createTestSgtGroup(args) {
  const manifest = loadManifest(args.manifest);
  const rpcUrl = args.rpcUrl ?? manifest.rpcUrl ?? DEFAULT_RPC_URL;
  const connection = new Connection(rpcUrl, "confirmed");
  await assertDevnet(connection, "create Test SGT group");

  const sponsor = loadKeypair(resolveMaybeRelative(manifest.sponsor.keypairPath));
  const groupMint = loadKeypair(resolveMaybeRelative(manifest.testSgt.groupMintKeypairPath));

  if (!sponsor.publicKey.equals(new PublicKey(manifest.sponsor.publicKey))) {
    throw new Error("Sponsor keypair does not match manifest.");
  }
  if (!groupMint.publicKey.equals(new PublicKey(manifest.testSgt.groupMint))) {
    throw new Error("Group mint keypair does not match manifest.");
  }

  const existing = await connection.getAccountInfo(groupMint.publicKey, "confirmed");

  if (existing) {
    const mint = unpackMint(groupMint.publicKey, existing, TOKEN_2022_PROGRAM_ID);
    const tokenGroup = getTokenGroupState(mint);

    if (
      !existing.owner.equals(TOKEN_2022_PROGRAM_ID) ||
      tokenGroup?.updateAuthority?.equals(sponsor.publicKey) !== true
    ) {
      throw new Error("Existing Test SGT group mint does not match the manifest sponsor/update authority.");
    }

    console.log(`Test SGT group already exists: ${groupMint.publicKey.toBase58()}`);
    return;
  }

  const mintLength = getMintLen([ExtensionType.GroupPointer]);
  const mintRentLamports = await connection.getMinimumBalanceForRentExemption(mintLength, "confirmed");
  const tokenGroupRentLamports = await connection.getMinimumBalanceForRentExemption(TOKEN_GROUP_SIZE, "confirmed");
  const maxSize = BigInt(manifest.testSgt.groupMaxSize ?? DEFAULT_TEST_SGT_GROUP_MAX_SIZE.toString());
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: sponsor.publicKey,
      newAccountPubkey: groupMint.publicKey,
      space: mintLength,
      lamports: mintRentLamports,
      programId: TOKEN_2022_PROGRAM_ID
    }),
    createInitializeGroupPointerInstruction(
      groupMint.publicKey,
      sponsor.publicKey,
      groupMint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      groupMint.publicKey,
      0,
      sponsor.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    ),
    SystemProgram.transfer({
      fromPubkey: sponsor.publicKey,
      toPubkey: groupMint.publicKey,
      lamports: tokenGroupRentLamports
    }),
    createInitializeGroupInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      group: groupMint.publicKey,
      mint: groupMint.publicKey,
      mintAuthority: sponsor.publicKey,
      updateAuthority: sponsor.publicKey,
      maxSize
    })
  );
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [sponsor, groupMint],
    CONFIRM_OPTIONS
  );

  console.log(
    JSON.stringify(
      {
        cluster: "devnet",
        groupMint: groupMint.publicKey.toBase58(),
        groupUpdateAuthority: sponsor.publicKey.toBase58(),
        signature
      },
      null,
      2
    )
  );
}

async function createTestSgt(args) {
  const manifest = loadManifest(args.manifest);
  const owner = requiredPublicKey(args.owner, "--owner");
  const rpcUrl = args.rpcUrl ?? manifest.rpcUrl ?? DEFAULT_RPC_URL;
  const connection = new Connection(rpcUrl, "confirmed");
  await assertDevnet(connection, "create Test SGT");

  const context = loadFreshTestSgtContext(manifest);
  await assertTestSgtGroup(connection, context.groupAddress, context.sponsor.publicKey);

  const mint = Keypair.generate();
  const mintLength = getMintLen([
    ExtensionType.MetadataPointer,
    ExtensionType.GroupMemberPointer
  ]);
  const mintRentLamports = await connection.getMinimumBalanceForRentExemption(mintLength, "confirmed");
  const createMintTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: context.sponsor.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLength,
      lamports: mintRentLamports,
      programId: TOKEN_2022_PROGRAM_ID
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      context.mintAuthority.publicKey,
      context.metadataAddress,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeGroupMemberPointerInstruction(
      mint.publicKey,
      context.mintAuthority.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint.publicKey,
      0,
      context.mintAuthority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );
  const createMintSignature = await sendAndConfirmTransaction(
    connection,
    createMintTransaction,
    uniqueSigners([context.sponsor, mint]),
    CONFIRM_OPTIONS
  );

  const tokenGroupMemberRentLamports = await connection.getMinimumBalanceForRentExemption(
    TOKEN_GROUP_MEMBER_SIZE,
    "confirmed"
  );
  const initializeMembershipTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: context.sponsor.publicKey,
      toPubkey: mint.publicKey,
      lamports: tokenGroupMemberRentLamports
    }),
    createInitializeMemberInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      member: mint.publicKey,
      memberMint: mint.publicKey,
      memberMintAuthority: context.mintAuthority.publicKey,
      group: context.groupAddress,
      groupUpdateAuthority: context.sponsor.publicKey
    })
  );
  const initializeMembershipSignature = await sendAndConfirmTransaction(
    connection,
    initializeMembershipTransaction,
    uniqueSigners([context.sponsor, context.mintAuthority]),
    CONFIRM_OPTIONS
  );

  const ownerTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const mintToOwnerTransaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      context.sponsor.publicKey,
      ownerTokenAccount,
      owner,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createMintToCheckedInstruction(
      mint.publicKey,
      ownerTokenAccount,
      context.mintAuthority.publicKey,
      1n,
      0,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );
  const mintToOwnerSignature = await sendAndConfirmTransaction(
    connection,
    mintToOwnerTransaction,
    uniqueSigners([context.sponsor, context.mintAuthority]),
    CONFIRM_OPTIONS
  );

  await verifyCreatedTestSgt(connection, {
    mintAddress: mint.publicKey,
    owner,
    ownerTokenAccount,
    mintAuthority: context.mintAuthority.publicKey,
    metadataAddress: context.metadataAddress,
    groupAddress: context.groupAddress
  });

  console.log(
    JSON.stringify(
      {
        owner: owner.toBase58(),
        testSgtMint: mint.publicKey.toBase58(),
        ownerTokenAccount: ownerTokenAccount.toBase58(),
        testSgtGroup: context.groupAddress.toBase58(),
        signatures: {
          createMintWithPointers: createMintSignature,
          initializeTokenGroupMembership: initializeMembershipSignature,
          createOwnerTokenAccountAndMintOne: mintToOwnerSignature
        }
      },
      null,
      2
    )
  );
}

function renderApiPublicEnv(input) {
  return [
    "# DEVNET-ONLY API environment. Use a fresh devnet Mongo database.",
    `# Fresh devnet Mongo database name: ${input.mongodbDbName}`,
    "SPORE_ENV=devnet",
    `MONGODB_URI=${input.mongodbUri}`,
    `HELIUS_API_KEY=${input.heliusApiKey}`,
    `SIWS_DOMAIN=${input.siwsDomain}`,
    `SIWS_URI=${input.apiUrl}`,
    `SPORE_PROGRAM_ID=${input.programId}`,
    "SPORE_SOLANA_CLUSTER=devnet",
    "SPORE_REPRODUCTION_MODE=server",
    "SPORE_TREASURY=<DEVNET_TREASURY_PUBLIC_KEY>",
    "SPORE_BIRTH_FEE_LAMPORTS=<DEVNET_BIRTH_FEE_LAMPORTS>",
    `SPORE_METADATA_BASE_URI=${input.apiUrl}`,
    "SPORE_SERVER_AUTHORITY_SECRET=<copy from api.devnet.secrets.env>",
    "SPORE_ASSET_DERIVATION_SECRET=<copy from api.devnet.secrets.env>",
    "SPORE_VERBOSE_SOLANA_DIAGNOSTICS=false",
    "HELIUS_WEBHOOK_AUTH=<copy from api.devnet.secrets.env>",
    "SPORE_DEVNET_TEST_SGT_BOOTSTRAP_ENABLED=true",
    `SPORE_DEVNET_APPROVED_PROGRAM_ID=${input.programId}`,
    `SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY=${input.testSgtMintAuthority}`,
    `SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS=${input.testSgtGroupMint}`,
    `SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS=${input.testSgtGroupMint}`,
    `SPORE_DEVNET_SPONSOR_PUBLIC_KEY=${input.sponsor}`,
    "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET=<copy from api.devnet.secrets.env>",
    "SPORE_DEVNET_SPONSOR_SECRET=<copy from api.devnet.secrets.env>",
    `SPORE_DEVNET_TESTER_FUNDING_TARGET_LAMPORTS=${input.testerFundingTargetLamports}`,
    ""
  ].join("\n");
}

function renderMongoPlaceholderUri(databaseName) {
  return `mongodb+srv://<DEVNET_MONGODB_USER>:<DEVNET_MONGODB_PASSWORD>@<DEVNET_MONGODB_CLUSTER>/${databaseName}?retryWrites=true&w=majority`;
}

function renderApiSecretsEnv(keypairs, secrets) {
  return [
    "# DEVNET-ONLY API secrets. Never copy these to mainnet or mobile.",
    `SPORE_SERVER_AUTHORITY_SECRET=${secretToJson(keypairs.serverAuthority)}`,
    `SPORE_ASSET_DERIVATION_SECRET=${secrets.assetDerivationSecret}`,
    `HELIUS_WEBHOOK_AUTH=${secrets.webhookAuth}`,
    `SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET=${secretToBase64(keypairs.testSgtMintAuthority)}`,
    `SPORE_DEVNET_SPONSOR_SECRET=${secretToBase64(keypairs.sponsor)}`,
    ""
  ].join("\n");
}

function renderMobileEnv(input) {
  return [
    "# DEVNET-ONLY mobile environment.",
    "EXPO_PUBLIC_SPORE_ENV=devnet",
    `EXPO_PUBLIC_SPORE_API_URL=${input.apiUrl}`,
    "EXPO_PUBLIC_SPORE_VISUAL_PREVIEW=false",
    "EXPO_PUBLIC_SPORE_SOLANA_CLUSTER=devnet",
    "EXPO_PUBLIC_SPORE_REPRODUCTION_MODE=server",
    `EXPO_PUBLIC_SPORE_RPC_URL=${input.rpcUrl}`,
    `EXPO_PUBLIC_SPORE_PROGRAM_ID=${input.programId}`,
    ""
  ].join("\n");
}

function renderGeneratedReadme(manifest, manifestPath) {
  return [
    "# Fresh SPORE Devnet Output",
    "",
    "This directory is generated locally and must remain gitignored.",
    "It is for server-mode devnet Test SGT fixtures only; it does not deploy or initialize the SPORE Anchor program.",
    "",
    renderPublicSummary(manifest),
    "",
    "Required environment variables for generate:",
    "",
    "- SPORE_ASSET_DERIVATION_SECRET",
    "- HELIUS_WEBHOOK_AUTH",
    "",
    "api.devnet.secrets.env derives SPORE_SERVER_AUTHORITY_SECRET from the configured server authority keypair file.",
    "It stores the two required secret environment values without printing them to stdout.",
    "",
    "Command behavior:",
    "",
    "- generate: LOCAL ONLY; writes generated files/keypairs and sends no Solana transactions.",
    "- show-env: LOCAL ONLY; reads the manifest and prints public file paths.",
    "- create-test-sgt-group: submits Solana devnet transactions paid by the sponsor wallet.",
    "- create-test-sgt: submits Solana devnet transactions paid by the sponsor wallet.",
    "",
    "Manual sequence:",
    "",
    "1. Fund the sponsor wallet on Solana devnet.",
    `2. Create the Test SGT group: node scripts/devnet/fresh-devnet-setup.cjs create-test-sgt-group --manifest ${manifestPath}`,
    "3. Configure the devnet API from api.devnet.env plus api.devnet.secrets.env.",
    "4. Configure the devnet mobile build from mobile.devnet.env.",
    "5. Use create-test-sgt manually only when a devnet wallet needs a fixture SGT.",
    ""
  ].join("\n");
}

function printGenerationSummary(manifest, manifestPath, options = {}) {
  console.log(renderPublicSummary(manifest));
  console.log("");
  if (options.reused) {
    console.log("Existing manifest found; no files were overwritten.");
    console.log("");
  }
  console.log("Local files:");
  console.log(`- Manifest: ${manifestPath}`);
  console.log(`- API public env: ${manifest.envFiles.apiPublic}`);
  console.log(`- API secret env: ${manifest.envFiles.apiSecrets}`);
  console.log(`- Mobile env: ${manifest.envFiles.mobile}`);
  console.log("");
  console.log("No devnet transactions were sent by generate.");
}

function renderPublicSummary(manifest) {
  return [
    "Fresh devnet public values:",
    `- Program ID: ${manifest.program.publicKey}`,
    `- Server authority: ${manifest.serverAuthority.publicKey}`,
    `- Sponsor wallet: ${manifest.sponsor.publicKey}`,
    `- Test SGT mint authority: ${manifest.testSgt.mintAuthority}`,
    `- Test SGT group/address: ${manifest.testSgt.groupAddress}`,
    `- Test SGT metadata address: ${manifest.testSgt.metadataAddress}`
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    switch (value) {
      case "--out-dir":
        args.outDir = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--program-id":
        args.programId = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--manifest":
        args.manifest = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--owner":
        args.owner = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--rpc-url":
        args.rpcUrl = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--api-url":
        args.apiUrl = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--mongodb-uri":
        args.mongodbUri = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--mongodb-db-name":
        args.mongodbDbName = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--helius-api-key":
        args.heliusApiKey = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--siws-domain":
        args.siwsDomain = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--tester-funding-target-lamports":
        args.testerFundingTargetLamports = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--server-authority-keypair":
        args.serverAuthorityKeypair = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--sponsor-keypair":
        args.sponsorKeypair = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--test-sgt-mint-authority-keypair":
        args.testSgtMintAuthorityKeypair = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--test-sgt-group-mint-keypair":
        args.testSgtGroupMintKeypair = nextOptionValue(argv, index, value);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${value}`);
    }
  }

  return args;
}

function nextOptionValue(argv, index, flag) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage:
  node scripts/devnet/fresh-devnet-setup.cjs generate [options]
  node scripts/devnet/fresh-devnet-setup.cjs show-env --manifest <PATH>
  node scripts/devnet/fresh-devnet-setup.cjs create-test-sgt-group --manifest <PATH> [--rpc-url <URL>]
  node scripts/devnet/fresh-devnet-setup.cjs create-test-sgt --manifest <PATH> --owner <WALLET_PUBKEY> [--rpc-url <URL>]

Options for generate:
  --out-dir <PATH>                         Default: ${DEFAULT_OUT_DIR}
  --program-id <PUBLIC_KEY>                Default: ${PERMANENT_PROGRAM_ID}
  --rpc-url <URL>                          Default: ${DEFAULT_RPC_URL}
  --api-url <URL>                          Placeholder default: <DEVNET_API_URL>
  --mongodb-uri <URI>                      Placeholder default includes /${DEFAULT_MONGODB_DB_NAME}
  --mongodb-db-name <NAME>                 Default: ${DEFAULT_MONGODB_DB_NAME}
  --helius-api-key <KEY>                   Placeholder default: <DEVNET_HELIUS_API_KEY>
  --siws-domain <DOMAIN>                   Placeholder default: <DEVNET_SIWS_DOMAIN>
  --tester-funding-target-lamports <N>     Default: ${DEFAULT_TESTER_FUNDING_TARGET_LAMPORTS}
  --server-authority-keypair <PATH>        Required for fresh generate; existing server authority keypair JSON file
  --sponsor-keypair <PATH>                 Reuse an existing sponsor keypair JSON file
  --test-sgt-mint-authority-keypair <PATH> Reuse an existing Test SGT mint authority keypair JSON file
  --test-sgt-group-mint-keypair <PATH>     Reuse an existing Test SGT group mint keypair JSON file

Options for create-test-sgt:
  --manifest <PATH>                        Fresh devnet manifest path
  --owner <PUBLIC_KEY>                     Wallet that will own the Test SGT token account
  --rpc-url <URL>                          Optional devnet RPC URL override

Note: create-test-sgt is manual bootstrap tooling and is not deterministic; repeated invocations can create another Test SGT for the same owner.

Required environment variables for a fresh generate:
  SPORE_ASSET_DERIVATION_SECRET            Existing devnet asset derivation secret
  HELIUS_WEBHOOK_AUTH                       Existing devnet webhook auth secret

api.devnet.secrets.env derives SPORE_SERVER_AUTHORITY_SECRET from --server-authority-keypair.
It stores the required secret environment values without printing them to stdout.

Command behavior:
  generate                                  LOCAL ONLY: writes generated files/keypairs, sends no Solana transactions
  show-env                                  LOCAL ONLY: reads the manifest and prints public file paths
  create-test-sgt-group                     SUBMITS SOLANA DEVNET TRANSACTIONS: sponsor wallet pays
  create-test-sgt                           SUBMITS SOLANA DEVNET TRANSACTIONS: sponsor wallet pays

This tool is server-mode devnet fixture tooling only. It does not deploy or initialize the SPORE Anchor program,
and it does not modify Anchor.toml or apps/mobile/eas.json.
`);
}

async function assertDevnet(connection, action) {
  const genesisHash = await connection.getGenesisHash();

  if (genesisHash !== DEVNET_GENESIS_HASH) {
    throw new Error(`Refusing to ${action}: RPC endpoint is not Solana devnet.`);
  }
}

function loadManifest(manifestPath) {
  if (!manifestPath) {
    throw new Error("Missing --manifest <PATH>.");
  }

  return JSON.parse(fs.readFileSync(resolveMaybeRelative(manifestPath), "utf8"));
}

function tryLoadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function assertExistingManifestMatches(
  manifest,
  {
    programId,
    rpcUrl,
    mongodbDbName,
    mongodbUri,
    serverAuthorityKeypair,
    sponsorKeypair,
    testSgtMintAuthorityKeypair,
    testSgtGroupMintKeypair
  }
) {
  const existingProgramId = requiredManifestString(manifest.program?.publicKey, "program.publicKey");
  requiredManifestString(manifest.serverAuthority?.publicKey, "serverAuthority.publicKey");

  if (existingProgramId !== programId) {
    throw new Error(
      `Refusing to reuse existing fresh devnet output: manifest program ID ${existingProgramId} does not match ${programId}.`
    );
  }
  if (manifest.cluster !== "devnet") {
    throw new Error("Refusing to reuse existing fresh devnet output: manifest cluster is not devnet.");
  }
  if (rpcUrl && manifest.rpcUrl !== rpcUrl) {
    throw new Error("Refusing to reuse existing fresh devnet output: manifest rpcUrl does not match --rpc-url.");
  }
  if (mongodbDbName && manifest.mongo?.databaseName !== mongodbDbName) {
    throw new Error("Refusing to reuse existing fresh devnet output: manifest Mongo database does not match --mongodb-db-name.");
  }
  if (mongodbUri && manifest.mongo?.uri !== mongodbUri) {
    throw new Error("Refusing to reuse existing fresh devnet output: manifest Mongo URI does not match --mongodb-uri.");
  }

  assertOptionalKeypairMatchesManifest(
    serverAuthorityKeypair,
    manifest.serverAuthority?.publicKey,
    "serverAuthority.publicKey",
    "--server-authority-keypair"
  );
  assertOptionalKeypairMatchesManifest(
    sponsorKeypair,
    manifest.sponsor?.publicKey,
    "sponsor.publicKey",
    "--sponsor-keypair"
  );
  assertOptionalKeypairMatchesManifest(
    testSgtMintAuthorityKeypair,
    manifest.testSgt?.mintAuthority,
    "testSgt.mintAuthority",
    "--test-sgt-mint-authority-keypair"
  );
  assertOptionalKeypairMatchesManifest(
    testSgtGroupMintKeypair,
    manifest.testSgt?.groupMint,
    "testSgt.groupMint",
    "--test-sgt-group-mint-keypair"
  );
}

function assertOptionalKeypairMatchesManifest(keypairPath, expectedPublicKey, manifestName, flagName) {
  if (!keypairPath) {
    return;
  }

  const keypair = loadKeypair(resolveMaybeRelative(keypairPath));
  const expected = manifestPublicKey(expectedPublicKey, manifestName);

  if (!keypair.publicKey.equals(expected)) {
    throw new Error(`Refusing to reuse existing fresh devnet output: ${flagName} does not match ${manifestName}.`);
  }
}

function loadFreshTestSgtContext(manifest) {
  const mintAuthority = loadKeypair(resolveMaybeRelative(requiredManifestString(
    manifest.testSgt?.mintAuthorityKeypairPath,
    "testSgt.mintAuthorityKeypairPath"
  )));
  const sponsor = loadKeypair(resolveMaybeRelative(requiredManifestString(
    manifest.sponsor?.keypairPath,
    "sponsor.keypairPath"
  )));
  const expectedMintAuthority = manifestPublicKey(manifest.testSgt?.mintAuthority, "testSgt.mintAuthority");
  const expectedSponsor = manifestPublicKey(manifest.sponsor?.publicKey, "sponsor.publicKey");
  const metadataAddress = manifestPublicKey(manifest.testSgt?.metadataAddress, "testSgt.metadataAddress");
  const groupAddress = manifestPublicKey(manifest.testSgt?.groupAddress, "testSgt.groupAddress");
  const groupUpdateAuthority = manifestPublicKey(
    manifest.testSgt?.groupUpdateAuthority,
    "testSgt.groupUpdateAuthority"
  );

  if (!mintAuthority.publicKey.equals(expectedMintAuthority)) {
    throw new Error("Test SGT mint authority keypair does not match manifest.");
  }
  if (!sponsor.publicKey.equals(expectedSponsor)) {
    throw new Error("Sponsor keypair does not match manifest.");
  }
  if (!groupUpdateAuthority.equals(sponsor.publicKey)) {
    throw new Error("Manifest Test SGT group update authority must be the sponsor wallet.");
  }

  return {
    mintAuthority,
    sponsor,
    metadataAddress,
    groupAddress
  };
}

function normalizeProgramId(value, name) {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new Error(`Invalid public key for ${name}.`);
  }
}

function loadRequiredGenerateSecrets() {
  return {
    assetDerivationSecret: getRequiredProcessEnv("SPORE_ASSET_DERIVATION_SECRET"),
    webhookAuth: getRequiredProcessEnv("HELIUS_WEBHOOK_AUTH")
  };
}

function getRequiredProcessEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable for fresh generate: ${name}.`);
  }

  return value;
}

function loadRequiredKeypair(existingPath, flagName) {
  if (!existingPath) {
    throw new Error(`Missing required argument ${flagName} <PATH>.`);
  }

  const resolvedPath = resolveMaybeRelative(existingPath);

  return {
    keypair: loadKeypair(resolvedPath),
    path: resolvedPath
  };
}

function loadOrGenerateKeypair(existingPath, generatedPath) {
  if (existingPath) {
    const resolvedPath = resolveMaybeRelative(existingPath);

    return {
      keypair: loadKeypair(resolvedPath),
      path: resolvedPath
    };
  }

  const keypair = Keypair.generate();

  writeKeypair(generatedPath, keypair);

  return {
    keypair,
    path: generatedPath
  };
}

async function assertTestSgtGroup(connection, groupAddress, expectedUpdateAuthority) {
  const groupInfo = await connection.getAccountInfo(groupAddress, "confirmed");

  if (!groupInfo || !groupInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error("Fresh Test SGT group is missing or is not owned by Token-2022.");
  }

  const groupMint = unpackMint(groupAddress, groupInfo, TOKEN_2022_PROGRAM_ID);
  const tokenGroup = getTokenGroupState(groupMint);

  if (!tokenGroup?.updateAuthority?.equals(expectedUpdateAuthority)) {
    throw new Error("Fresh Test SGT group update authority does not match the sponsor wallet.");
  }
}

async function verifyCreatedTestSgt(
  connection,
  { mintAddress, owner, ownerTokenAccount, mintAuthority, metadataAddress, groupAddress }
) {
  const mintInfo = await connection.getAccountInfo(mintAddress, "confirmed");

  if (!mintInfo || !mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error("Created Test SGT mint is missing or is not owned by Token-2022.");
  }

  const mint = unpackMint(mintAddress, mintInfo, TOKEN_2022_PROGRAM_ID);
  const metadataPointer = getMetadataPointerState(mint);
  const groupMemberPointer = getGroupMemberPointerState(mint);
  const tokenGroupMember = getTokenGroupMemberState(mint);
  const mintState = await getMint(connection, mintAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
  const tokenAccount = await getAccount(connection, ownerTokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);
  const checks = {
    mintAuthority: mint.mintAuthority?.equals(mintAuthority) === true,
    metadataPointerAuthority: metadataPointer?.authority?.equals(mintAuthority) === true,
    metadataAddress: metadataPointer?.metadataAddress?.equals(metadataAddress) === true,
    groupMemberPointerAuthority: groupMemberPointer?.authority?.equals(mintAuthority) === true,
    groupMemberPointerMemberAddress: groupMemberPointer?.memberAddress?.equals(mintAddress) === true,
    tokenGroupMemberMint: tokenGroupMember?.mint?.equals(mintAddress) === true,
    tokenGroupMemberGroup: tokenGroupMember?.group?.equals(groupAddress) === true,
    supplyExactlyOne: mintState.supply === 1n,
    decimalsZero: mintState.decimals === 0,
    ownerTokenAccountOwner: tokenAccount.owner.equals(owner),
    ownerTokenAccountMint: tokenAccount.mint.equals(mintAddress),
    ownerTokenAccountAmount: tokenAccount.amount === 1n,
    ownerTokenAccountInitialized: tokenAccount.isInitialized
  };

  if (!Object.values(checks).every(Boolean)) {
    throw new Error(`Created Test SGT verification failed: ${JSON.stringify(checks, null, 2)}`);
  }
}

function requiredManifestString(value, name) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing manifest value: ${name}`);
  }

  return value;
}

function manifestPublicKey(value, name) {
  try {
    return new PublicKey(requiredManifestString(value, name));
  } catch {
    throw new Error(`Invalid manifest public key: ${name}`);
  }
}

function requiredPublicKey(value, name) {
  if (!value) {
    throw new Error(`Missing required argument ${name}.`);
  }

  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`Invalid public key for ${name}.`);
  }
}

function writeKeypair(filePath, keypair) {
  writeFileExclusive(filePath, JSON.stringify(Array.from(keypair.secretKey)), 0o600);
}

function loadKeypair(filePath) {
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (
    !Array.isArray(json) ||
    json.length !== 64 ||
    !json.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
  ) {
    throw new Error(`Invalid Solana keypair file: ${filePath}`);
  }

  return Keypair.fromSecretKey(Uint8Array.from(json));
}

function writeFileExclusive(filePath, content, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, {
    encoding: "utf8",
    mode,
    flag: "wx"
  });
}

function ensureFreshOutputDirectory(outDir) {
  if (fs.existsSync(outDir)) {
    const entries = fs.readdirSync(outDir);

    if (entries.length > 0) {
      throw new Error(`Refusing to overwrite existing fresh devnet output directory: ${outDir}`);
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
}

function resolveOutputDir(value) {
  return path.resolve(resolveHome(value));
}

function resolveMaybeRelative(value) {
  const resolved = resolveHome(value);

  return path.isAbsolute(resolved) ? resolved : path.resolve(resolved);
}

function resolveHome(value) {
  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function slashPath(value) {
  return path.relative(process.cwd(), path.resolve(value)).replace(/\\/g, "/");
}

function secretToBase64(keypair) {
  return Buffer.from(keypair.secretKey).toString("base64");
}

function secretToJson(keypair) {
  return JSON.stringify(Array.from(keypair.secretKey));
}

function uniqueSigners(signers) {
  const unique = new Map();

  for (const signer of signers) {
    unique.set(signer.publicKey.toBase58(), signer);
  }

  return Array.from(unique.values());
}
