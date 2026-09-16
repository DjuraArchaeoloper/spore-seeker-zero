#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
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

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_OUT_DIR = "scripts/devnet/.generated/fresh-devnet";
const DEFAULT_MONGODB_DB_NAME = "spor_devnet_fresh";
const DEFAULT_TESTER_FUNDING_TARGET_LAMPORTS = 100_000_000;
const DEFAULT_TEST_SGT_GROUP_MAX_SIZE = 1_000_000n;
const CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const SPECIES_ACCOUNT_SIZE = 229;
const SEEKER_ZERO_ORGANISM_NUMBER = 0n;
const U64_MAX = (1n << 64n) - 1n;
const MAX_METADATA_BASE_URI_LENGTH = 96;
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
    case "apply-program-id":
      applyProgramId(args);
      break;
    case "create-test-sgt-group":
      await createTestSgtGroup(args);
      break;
    case "create-test-sgt":
      await createTestSgt(args);
      break;
    case "initialize-species":
      await initializeSpecies(args);
      break;
    case "initialize-seeker-zero":
      await initializeSeekerZero(args);
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
  const rpcUrl = args.rpcUrl ?? DEFAULT_RPC_URL;
  const apiUrl = args.apiUrl ?? "<DEVNET_API_URL>";
  const mongodbDbName = args.mongodbDbName ?? DEFAULT_MONGODB_DB_NAME;
  const mongodbUri = args.mongodbUri ?? renderMongoPlaceholderUri(mongodbDbName);
  const heliusApiKey = args.heliusApiKey ?? "<DEVNET_HELIUS_API_KEY>";
  const siwsDomain = args.siwsDomain ?? "<DEVNET_SIWS_DOMAIN>";
  const webhookAuth = args.webhookAuth ?? randomSecretHex();
  const testerFundingTargetLamports = args.testerFundingTargetLamports ?? String(DEFAULT_TESTER_FUNDING_TARGET_LAMPORTS);

  ensureFreshOutputDirectory(outDir);

  const keypairs = {
    program: Keypair.generate(),
    speciesAuthority: Keypair.generate(),
    testSgtMintAuthority: Keypair.generate(),
    sponsor: Keypair.generate(),
    testSgtGroupMint: Keypair.generate()
  };
  const keypairDir = path.join(outDir, "keypairs");
  const files = {
    program: path.join(keypairDir, "spore-program-keypair.json"),
    speciesAuthority: path.join(keypairDir, "species-authority.json"),
    testSgtMintAuthority: path.join(keypairDir, "test-sgt-mint-authority.json"),
    sponsor: path.join(keypairDir, "devnet-sponsor.json"),
    testSgtGroupMint: path.join(keypairDir, "test-sgt-group-mint.json")
  };

  fs.mkdirSync(keypairDir, { recursive: true });

  for (const [name, keypair] of Object.entries(keypairs)) {
    writeKeypair(files[name], keypair);
  }

  const programId = keypairs.program.publicKey.toBase58();
  const speciesAuthority = keypairs.speciesAuthority.publicKey.toBase58();
  const testSgtMintAuthority = keypairs.testSgtMintAuthority.publicKey.toBase58();
  const sponsor = keypairs.sponsor.publicKey.toBase58();
  const testSgtGroupMint = keypairs.testSgtGroupMint.publicKey.toBase58();
  const manifest = {
    version: 1,
    cluster: "devnet",
    rpcUrl,
    devnetGenesisHash: DEVNET_GENESIS_HASH,
    generatedAt: new Date().toISOString(),
    program: {
      publicKey: programId,
      keypairPath: slashPath(files.program)
    },
    speciesAuthority: {
      publicKey: speciesAuthority,
      keypairPath: slashPath(files.speciesAuthority)
    },
    testSgt: {
      mintAuthority: testSgtMintAuthority,
      mintAuthorityKeypairPath: slashPath(files.testSgtMintAuthority),
      metadataAddress: testSgtGroupMint,
      groupAddress: testSgtGroupMint,
      groupMint: testSgtGroupMint,
      groupMintKeypairPath: slashPath(files.testSgtGroupMint),
      groupMintAuthority: sponsor,
      groupUpdateAuthority: sponsor,
      groupMaxSize: DEFAULT_TEST_SGT_GROUP_MAX_SIZE.toString()
    },
    sponsor: {
      publicKey: sponsor,
      keypairPath: slashPath(files.sponsor)
    },
    mongo: {
      uri: mongodbUri,
      databaseName: mongodbDbName
    },
    envFiles: {
      anchor: slashPath(path.join(outDir, "anchor.devnet.env")),
      apiPublic: slashPath(path.join(outDir, "api.devnet.env")),
      apiSecrets: slashPath(path.join(outDir, "api.devnet.secrets.env")),
      mobile: slashPath(path.join(outDir, "mobile.devnet.env"))
    }
  };

  const manifestPath = path.join(outDir, "manifest.json");

  writeFileExclusive(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  writeFileExclusive(path.join(outDir, "anchor.devnet.env"), renderAnchorEnv(manifest), 0o600);
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
      webhookAuth,
      testSgtMintAuthority,
      testSgtGroupMint,
      sponsor,
      testerFundingTargetLamports
    }),
    0o600
  );
  writeFileExclusive(
    path.join(outDir, "api.devnet.secrets.env"),
    renderApiSecretsEnv(keypairs),
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
  console.log(`Anchor env: ${manifest.envFiles.anchor}`);
  console.log(`API public env: ${manifest.envFiles.apiPublic}`);
  console.log(`API secret env: ${manifest.envFiles.apiSecrets}`);
  console.log(`Mobile env: ${manifest.envFiles.mobile}`);
}

function applyProgramId(args) {
  const manifest = loadManifest(args.manifest);
  const programId = manifest.program.publicKey;

  updateAnchorToml(programId);
  updateMobileEasDevnetProgramId(programId);

  console.log(`Updated Anchor.toml [programs.devnet] to ${programId}.`);
  console.log("Updated apps/mobile/eas.json development/preview devnet Program ID only.");
  console.log("Rust devnet declare_id is supplied at build time by SPORE_DEVNET_PROGRAM_ID when devnet-test-sgt is enabled.");
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

async function initializeSpecies(args) {
  const manifest = loadManifest(args.manifest);
  const treasury = requiredPublicKey(args.treasury, "--treasury");
  const birthFeeLamports = requiredU64(args.birthFeeLamports, "--birth-fee-lamports");
  const metadataBaseUri = requiredMetadataBaseUri(args.metadataBaseUri);
  const rpcUrl = args.rpcUrl ?? manifest.rpcUrl ?? DEFAULT_RPC_URL;
  const connection = new Connection(rpcUrl, "confirmed");
  await assertDevnet(connection, "initialize Species");

  const programId = manifestPublicKey(manifest.program?.publicKey, "program.publicKey");
  const authority = loadKeypair(resolveMaybeRelative(requiredManifestString(
    manifest.speciesAuthority?.keypairPath,
    "speciesAuthority.keypairPath"
  )));
  const expectedAuthority = manifestPublicKey(
    manifest.speciesAuthority?.publicKey,
    "speciesAuthority.publicKey"
  );

  if (!authority.publicKey.equals(expectedAuthority)) {
    throw new Error("Species authority keypair does not match manifest.");
  }

  const [speciesPda] = PublicKey.findProgramAddressSync([Buffer.from("species")], programId);
  const existingSpecies = await connection.getAccountInfo(speciesPda, "confirmed");

  if (existingSpecies) {
    throw new Error(`Refusing to initialize Species: Species PDA is already initialized (${speciesPda.toBase58()}).`);
  }

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        {
          pubkey: speciesPda,
          isSigner: false,
          isWritable: true
        },
        {
          pubkey: authority.publicKey,
          isSigner: true,
          isWritable: true
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false
        }
      ],
      data: encodeInitializeSpeciesInstruction({
        treasury,
        birthFeeLamports,
        metadataBaseUri
      })
    })
  );
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [authority],
    CONFIRM_OPTIONS
  );

  console.log(
    JSON.stringify(
      {
        speciesPda: speciesPda.toBase58(),
        signature
      },
      null,
      2
    )
  );
}

async function initializeSeekerZero(args) {
  const manifest = loadManifest(args.manifest);
  const sgtMint = requiredPublicKey(args.sgtMint, "--sgt-mint");
  const rpcUrl = args.rpcUrl ?? manifest.rpcUrl ?? DEFAULT_RPC_URL;
  const connection = new Connection(rpcUrl, "confirmed");
  await assertDevnet(connection, "initialize Seeker Zero");

  const programId = manifestPublicKey(manifest.program?.publicKey, "program.publicKey");
  const authority = loadKeypair(resolveMaybeRelative(requiredManifestString(
    manifest.speciesAuthority?.keypairPath,
    "speciesAuthority.keypairPath"
  )));
  const expectedAuthority = manifestPublicKey(
    manifest.speciesAuthority?.publicKey,
    "speciesAuthority.publicKey"
  );

  if (!authority.publicKey.equals(expectedAuthority)) {
    throw new Error("Species authority keypair does not match manifest.");
  }

  const testSgtMintAuthority = manifestPublicKey(
    manifest.testSgt?.mintAuthority,
    "testSgt.mintAuthority"
  );
  const testSgtMetadataAddress = manifestPublicKey(
    manifest.testSgt?.metadataAddress,
    "testSgt.metadataAddress"
  );
  const testSgtGroupAddress = manifestPublicKey(
    manifest.testSgt?.groupAddress,
    "testSgt.groupAddress"
  );
  const [speciesPda] = PublicKey.findProgramAddressSync([Buffer.from("species")], programId);
  const [seekerZeroPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("organism"), sgtMint.toBuffer()],
    programId
  );
  const [coreAssetPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("core_asset"), sgtMint.toBuffer()],
    programId
  );
  const speciesInfo = await connection.getAccountInfo(speciesPda, "confirmed");

  if (!speciesInfo) {
    throw new Error(`Species PDA is not initialized: ${speciesPda.toBase58()}.`);
  }

  const species = decodeSpeciesAccount(speciesPda, speciesInfo, programId);

  if (!species.authority.equals(authority.publicKey)) {
    throw new Error("On-chain Species authority does not match the fresh manifest authority.");
  }
  if (
    species.seekerZeroOrganism ||
    species.nextOrganismNumber !== SEEKER_ZERO_ORGANISM_NUMBER ||
    species.totalOrganisms !== 0n
  ) {
    throw new Error("Refusing to initialize Seeker Zero: Species already has genesis state.");
  }

  const existingSeekerZero = await connection.getAccountInfo(seekerZeroPda, "confirmed");

  if (existingSeekerZero) {
    throw new Error(`Refusing to initialize Seeker Zero: organism PDA already exists (${seekerZeroPda.toBase58()}).`);
  }

  const existingCoreAsset = await connection.getAccountInfo(coreAssetPda, "confirmed");

  if (existingCoreAsset?.data.length > 0) {
    throw new Error(`Refusing to initialize Seeker Zero: Core Asset PDA already has data (${coreAssetPda.toBase58()}).`);
  }

  const sgtTokenAccount = await findAuthorityOwnedToken2022Account(
    connection,
    authority.publicKey,
    sgtMint
  );
  await verifyCreatedTestSgt(connection, {
    mintAddress: sgtMint,
    owner: authority.publicKey,
    ownerTokenAccount: sgtTokenAccount,
    mintAuthority: testSgtMintAuthority,
    metadataAddress: testSgtMetadataAddress,
    groupAddress: testSgtGroupAddress
  });

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        {
          pubkey: authority.publicKey,
          isSigner: true,
          isWritable: true
        },
        {
          pubkey: speciesPda,
          isSigner: false,
          isWritable: true
        },
        {
          pubkey: sgtMint,
          isSigner: false,
          isWritable: false
        },
        {
          pubkey: sgtTokenAccount,
          isSigner: false,
          isWritable: false
        },
        {
          pubkey: seekerZeroPda,
          isSigner: false,
          isWritable: true
        },
        {
          pubkey: coreAssetPda,
          isSigner: false,
          isWritable: true
        },
        {
          pubkey: CORE_PROGRAM_ID,
          isSigner: false,
          isWritable: false
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false
        }
      ],
      data: instructionDiscriminator("initialize_seeker_zero")
    })
  );
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [authority],
    CONFIRM_OPTIONS
  );

  console.log(
    JSON.stringify(
      {
        seekerZeroOrganismPda: seekerZeroPda.toBase58(),
        organismNumber: 0,
        coreAsset: coreAssetPda.toBase58(),
        signature
      },
      null,
      2
    )
  );
}

function updateAnchorToml(programId) {
  const filePath = "Anchor.toml";
  const content = fs.readFileSync(filePath, "utf8");
  const next = content.replace(
    /(\[programs\.devnet\]\s*spore\s*=\s*")[^"]+(")/m,
    `$1${programId}$2`
  );

  if (next === content) {
    throw new Error("Unable to locate [programs.devnet] spore entry in Anchor.toml.");
  }

  fs.writeFileSync(filePath, next);
}

function updateMobileEasDevnetProgramId(programId) {
  const filePath = "apps/mobile/eas.json";
  const eas = JSON.parse(fs.readFileSync(filePath, "utf8"));

  for (const profileName of ["development", "preview"]) {
    const profile = eas.build?.[profileName];

    if (!profile?.env || profile.env.EXPO_PUBLIC_SPORE_SOLANA_CLUSTER !== "devnet") {
      throw new Error(`Unable to locate devnet mobile build profile: ${profileName}`);
    }

    profile.env.EXPO_PUBLIC_SPORE_PROGRAM_ID = programId;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(eas, null, 2)}\n`);
}

function renderAnchorEnv(manifest) {
  return [
    "# Source this for a devnet Anchor build with --features devnet-test-sgt.",
    `SPORE_DEVNET_PROGRAM_ID=${manifest.program.publicKey}`,
    `SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY=${manifest.testSgt.mintAuthority}`,
    `SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS=${manifest.testSgt.metadataAddress}`,
    `SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS=${manifest.testSgt.groupAddress}`,
    `ANCHOR_PROVIDER_URL=${manifest.rpcUrl}`,
    `ANCHOR_WALLET=${manifest.speciesAuthority.keypairPath}`,
    ""
  ].join("\n");
}

function renderApiPublicEnv(input) {
  return [
    "# DEVNET-ONLY API environment. Use a fresh devnet Mongo database.",
    `# Fresh devnet Mongo database name: ${input.mongodbDbName}`,
    `MONGODB_URI=${input.mongodbUri}`,
    `HELIUS_API_KEY=${input.heliusApiKey}`,
    `SIWS_DOMAIN=${input.siwsDomain}`,
    `SIWS_URI=${input.apiUrl}`,
    `SPORE_PROGRAM_ID=${input.programId}`,
    "SPORE_SOLANA_CLUSTER=devnet",
    `HELIUS_WEBHOOK_AUTH=${input.webhookAuth}`,
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

function renderApiSecretsEnv(keypairs) {
  return [
    "# DEVNET-ONLY API secrets. Never copy these to mainnet or mobile.",
    `SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET=${secretToBase64(keypairs.testSgtMintAuthority)}`,
    `SPORE_DEVNET_SPONSOR_SECRET=${secretToBase64(keypairs.sponsor)}`,
    ""
  ].join("\n");
}

function renderMobileEnv(input) {
  return [
    "# DEVNET-ONLY mobile environment.",
    `EXPO_PUBLIC_SPORE_API_URL=${input.apiUrl}`,
    "EXPO_PUBLIC_SPORE_VISUAL_PREVIEW=false",
    "EXPO_PUBLIC_SPORE_SOLANA_CLUSTER=devnet",
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
    "",
    renderPublicSummary(manifest),
    "",
    "Manual sequence:",
    "",
    "1. Fund the sponsor wallet on Solana devnet.",
    `2. Create the Test SGT group: node scripts/devnet/fresh-devnet-setup.cjs create-test-sgt-group --manifest ${manifestPath}`,
    `3. Apply local devnet Program ID config: node scripts/devnet/fresh-devnet-setup.cjs apply-program-id --manifest ${manifestPath}`,
    "4. Build/deploy the Anchor program with the env values in anchor.devnet.env and feature devnet-test-sgt.",
    "5. Configure the devnet API from api.devnet.env plus api.devnet.secrets.env.",
    "6. Configure the devnet mobile build from mobile.devnet.env.",
    "7. Initialize Species and Seeker Zero in a later prompt only.",
    ""
  ].join("\n");
}

function printGenerationSummary(manifest, manifestPath) {
  console.log(renderPublicSummary(manifest));
  console.log("");
  console.log("Generated local files:");
  console.log(`- Manifest: ${manifestPath}`);
  console.log(`- Anchor env: ${manifest.envFiles.anchor}`);
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
    `- Species authority: ${manifest.speciesAuthority.publicKey}`,
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
      case "--manifest":
        args.manifest = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--owner":
        args.owner = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--sgt-mint":
        args.sgtMint = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--treasury":
        args.treasury = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--birth-fee-lamports":
        args.birthFeeLamports = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--metadata-base-uri":
        args.metadataBaseUri = nextOptionValue(argv, index, value);
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
      case "--webhook-auth":
        args.webhookAuth = nextOptionValue(argv, index, value);
        index += 1;
        break;
      case "--tester-funding-target-lamports":
        args.testerFundingTargetLamports = nextOptionValue(argv, index, value);
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
  node scripts/devnet/fresh-devnet-setup.cjs apply-program-id --manifest <PATH>
  node scripts/devnet/fresh-devnet-setup.cjs create-test-sgt-group --manifest <PATH> [--rpc-url <URL>]
  node scripts/devnet/fresh-devnet-setup.cjs create-test-sgt --manifest <PATH> --owner <WALLET_PUBKEY> [--rpc-url <URL>]
  node scripts/devnet/fresh-devnet-setup.cjs initialize-species --manifest <PATH> --treasury <PUBKEY> --birth-fee-lamports <N> --metadata-base-uri <URI> [--rpc-url <URL>]
  node scripts/devnet/fresh-devnet-setup.cjs initialize-seeker-zero --manifest <PATH> --sgt-mint <PUBKEY> [--rpc-url <URL>]

Options for generate:
  --out-dir <PATH>                         Default: ${DEFAULT_OUT_DIR}
  --rpc-url <URL>                          Default: ${DEFAULT_RPC_URL}
  --api-url <URL>                          Placeholder default: <DEVNET_API_URL>
  --mongodb-uri <URI>                      Placeholder default includes /${DEFAULT_MONGODB_DB_NAME}
  --mongodb-db-name <NAME>                 Default: ${DEFAULT_MONGODB_DB_NAME}
  --helius-api-key <KEY>                   Placeholder default: <DEVNET_HELIUS_API_KEY>
  --siws-domain <DOMAIN>                   Placeholder default: <DEVNET_SIWS_DOMAIN>
  --webhook-auth <SECRET>                  Default: generated local random value
  --tester-funding-target-lamports <N>     Default: ${DEFAULT_TESTER_FUNDING_TARGET_LAMPORTS}

Options for create-test-sgt:
  --manifest <PATH>                        Fresh devnet manifest path
  --owner <PUBLIC_KEY>                     Wallet that will own the Test SGT token account
  --rpc-url <URL>                          Optional devnet RPC URL override

Note: create-test-sgt is manual bootstrap tooling and is not deterministic; repeated invocations can create another Test SGT for the same owner.

Options for initialize-species:
  --manifest <PATH>                        Fresh devnet manifest path
  --treasury <PUBLIC_KEY>                  Species treasury public key
  --birth-fee-lamports <N>                 Non-negative u64 lamport amount
  --metadata-base-uri <URI>                HTTPS API origin, no trailing slash
  --rpc-url <URL>                          Optional devnet RPC URL override

Options for initialize-seeker-zero:
  --manifest <PATH>                        Fresh devnet manifest path
  --sgt-mint <PUBLIC_KEY>                  Existing authority-owned fresh Test SGT mint
  --rpc-url <URL>                          Optional devnet RPC URL override
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

function decodeSpeciesAccount(address, account, programId) {
  if (!account.owner.equals(programId)) {
    throw new Error(`Species PDA is not owned by the fresh program: ${address.toBase58()}.`);
  }

  const data = Buffer.from(account.data);

  if (data.length !== SPECIES_ACCOUNT_SIZE) {
    throw new Error(`Species PDA has invalid account size: ${address.toBase58()}.`);
  }
  if (!data.subarray(0, 8).equals(accountDiscriminator("Species"))) {
    throw new Error(`Species PDA has invalid account discriminator: ${address.toBase58()}.`);
  }

  let offset = 8;
  const take = (length, label) => {
    const end = offset + length;

    if (end > data.length) {
      throw new Error(`Species account is truncated while reading ${label}.`);
    }

    const value = data.subarray(offset, end);
    offset = end;
    return value;
  };
  const authority = new PublicKey(take(32, "authority"));
  const treasury = new PublicKey(take(32, "treasury"));
  const birthFeeLamports = take(8, "birth_fee_lamports").readBigUInt64LE(0);
  const metadataBaseUriLength = take(4, "metadata_base_uri length").readUInt32LE(0);

  if (metadataBaseUriLength > MAX_METADATA_BASE_URI_LENGTH) {
    throw new Error("Species metadata_base_uri length exceeds the program maximum.");
  }

  const metadataBaseUri = take(metadataBaseUriLength, "metadata_base_uri").toString("utf8");
  const nextOrganismNumber = take(8, "next_organism_number").readBigUInt64LE(0);
  const seekerZeroOption = take(1, "seeker_zero_organism option")[0];
  let seekerZeroOrganism = null;

  if (seekerZeroOption === 1) {
    seekerZeroOrganism = new PublicKey(take(32, "seeker_zero_organism"));
  } else if (seekerZeroOption !== 0) {
    throw new Error("Species seeker_zero_organism option is invalid.");
  }

  const totalOrganisms = take(8, "total_organisms").readBigUInt64LE(0);

  return {
    authority,
    treasury,
    birthFeeLamports,
    metadataBaseUri,
    nextOrganismNumber,
    seekerZeroOrganism,
    totalOrganisms
  };
}

async function findAuthorityOwnedToken2022Account(connection, owner, mint) {
  const associatedTokenAccount = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const associatedAccount = await tryGetToken2022Account(connection, associatedTokenAccount);

  if (associatedAccount && tokenAccountMatches(associatedAccount, mint, owner)) {
    return associatedTokenAccount;
  }

  const accounts = await connection.getTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_2022_PROGRAM_ID
    },
    "confirmed"
  );
  const matches = accounts.value
    .filter(({ account }) => rawTokenAccountMatches(account.data, mint, owner))
    .map(({ pubkey }) => pubkey);

  if (matches.length === 0) {
    throw new Error("Species authority does not own a Token-2022 account holding exactly one supplied SGT.");
  }
  if (matches.length > 1) {
    throw new Error("Multiple authority-owned Token-2022 accounts hold the supplied SGT; refuse ambiguous genesis.");
  }

  return matches[0];
}

async function tryGetToken2022Account(connection, tokenAccount) {
  try {
    return await getAccount(connection, tokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch {
    return null;
  }
}

function tokenAccountMatches(tokenAccount, mint, owner) {
  return (
    tokenAccount.mint.equals(mint) &&
    tokenAccount.owner.equals(owner) &&
    tokenAccount.amount === 1n &&
    tokenAccount.isInitialized
  );
}

function rawTokenAccountMatches(data, mint, owner) {
  const buffer = Buffer.from(data);

  return (
    buffer.length >= 165 &&
    new PublicKey(buffer.subarray(0, 32)).equals(mint) &&
    new PublicKey(buffer.subarray(32, 64)).equals(owner) &&
    buffer.readBigUInt64LE(64) === 1n &&
    buffer[108] !== 0
  );
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

function requiredU64(value, name) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new Error(`Missing or invalid required argument ${name}.`);
  }

  const parsed = BigInt(value);

  if (parsed > U64_MAX) {
    throw new Error(`${name} must fit in u64.`);
  }

  return parsed;
}

function requiredMetadataBaseUri(value) {
  if (typeof value !== "string" || !value) {
    throw new Error("Missing required argument --metadata-base-uri.");
  }

  if (!value.startsWith("https://") || value.endsWith("/")) {
    throw new Error("--metadata-base-uri must start with https:// and must not end with /.");
  }

  if (Buffer.byteLength(value, "utf8") > MAX_METADATA_BASE_URI_LENGTH) {
    throw new Error(`--metadata-base-uri must be at most ${MAX_METADATA_BASE_URI_LENGTH} bytes.`);
  }

  return value;
}

function encodeInitializeSpeciesInstruction({ treasury, birthFeeLamports, metadataBaseUri }) {
  const metadataBytes = Buffer.from(metadataBaseUri, "utf8");
  const data = Buffer.alloc(8 + 32 + 8 + 4 + metadataBytes.length);
  let offset = 0;

  instructionDiscriminator("initialize_species").copy(data, offset);
  offset += 8;
  treasury.toBuffer().copy(data, offset);
  offset += 32;
  data.writeBigUInt64LE(birthFeeLamports, offset);
  offset += 8;
  data.writeUInt32LE(metadataBytes.length, offset);
  offset += 4;
  metadataBytes.copy(data, offset);

  return data;
}

function instructionDiscriminator(name) {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function accountDiscriminator(name) {
  return crypto.createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
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

function uniqueSigners(signers) {
  const unique = new Map();

  for (const signer of signers) {
    unique.set(signer.publicKey.toBase58(), signer);
  }

  return Array.from(unique.values());
}

function randomSecretHex() {
  return `Bearer ${crypto.randomBytes(32).toString("hex")}`;
}
