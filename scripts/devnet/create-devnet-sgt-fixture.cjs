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
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeGroupMemberPointerInstruction,
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
const DEFAULT_AUTHORITY_PATH = "~/.config/solana/spore-devnet/sgt-authority.json";
const DEFAULT_PAYER_PATH = "~/.config/solana/spore-devnet-deployer.json";
const DEFAULT_GROUP_UPDATE_AUTHORITY_PATH = DEFAULT_PAYER_PATH;
const DEFAULT_MINT_KEYPAIR_DIR = "~/.config/solana/spore-devnet";
const SGT_AUTHORITY = new PublicKey("9Q7121Yh9BQFbQE74nJPpukArv3E1ttAH3ZvuyVk47d4");
const SGT_GROUP_MINT = new PublicKey("AY9Ktqa4gnuthezVAkkSL3AdKi6sntLXyDjS5Ago1zzH");
const SPORE_PROGRAM_ID = new PublicKey("GVKoapVqZCBNWkuHopCZSFDqBGimxHWuHsFeoEcVd4Me");
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
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const recipient = requiredPublicKey(args.recipient, "--recipient");
  const rpcUrl = args.rpcUrl ?? DEFAULT_RPC_URL;
  const authorityPath = expandHome(args.authority ?? DEFAULT_AUTHORITY_PATH);
  const payerPath = expandHome(args.payer ?? DEFAULT_PAYER_PATH);
  const groupUpdateAuthorityPath = expandHome(args.groupUpdateAuthority ?? DEFAULT_GROUP_UPDATE_AUTHORITY_PATH);
  const mintKeypairDir = expandHome(args.mintKeypairDir ?? DEFAULT_MINT_KEYPAIR_DIR);

  const connection = new Connection(rpcUrl, "confirmed");
  await assertDevnet(connection);

  const authority = loadKeypair(authorityPath);
  const payer = loadKeypair(payerPath);
  const groupUpdateAuthority = loadKeypair(groupUpdateAuthorityPath);

  if (!authority.publicKey.equals(SGT_AUTHORITY)) {
    throw new Error(`Authority keypair does not match expected SGT authority ${SGT_AUTHORITY.toBase58()}.`);
  }

  const groupInfo = await connection.getAccountInfo(SGT_GROUP_MINT, "confirmed");

  if (!groupInfo || !groupInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error("Configured devnet SGT group mint is missing or is not owned by Token-2022.");
  }

  const groupMint = unpackMint(SGT_GROUP_MINT, groupInfo, TOKEN_2022_PROGRAM_ID);
  const tokenGroup = getTokenGroupState(groupMint);

  if (!tokenGroup?.updateAuthority?.equals(groupUpdateAuthority.publicKey)) {
    throw new Error("Configured devnet SGT group update authority does not match the provided group update authority signer.");
  }

  const mint = Keypair.generate();
  const mintKeypairPath = path.join(mintKeypairDir, `sgt-mint-${mint.publicKey.toBase58()}.json`);

  persistMintKeypair(mintKeypairPath, mint);

  const mintLen = getMintLen([
    ExtensionType.MetadataPointer,
    ExtensionType.GroupMemberPointer
  ]);
  const mintRentLamports = await connection.getMinimumBalanceForRentExemption(mintLen, "confirmed");
  const createMintTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports: mintRentLamports,
      programId: TOKEN_2022_PROGRAM_ID
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      authority.publicKey,
      SGT_GROUP_MINT,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeGroupMemberPointerInstruction(
      mint.publicKey,
      authority.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint.publicKey,
      0,
      authority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );
  const createMintSignature = await sendAndConfirmTransaction(
    connection,
    createMintTransaction,
    [payer, mint],
    CONFIRM_OPTIONS
  );

  const tokenGroupMemberRentLamports = await connection.getMinimumBalanceForRentExemption(
    TOKEN_GROUP_MEMBER_SIZE,
    "confirmed"
  );
  const initializeMembershipTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: mint.publicKey,
      lamports: tokenGroupMemberRentLamports
    }),
    createInitializeMemberInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      member: mint.publicKey,
      memberMint: mint.publicKey,
      memberMintAuthority: authority.publicKey,
      group: SGT_GROUP_MINT,
      groupUpdateAuthority: groupUpdateAuthority.publicKey
    })
  );
  const initializeMembershipSignature = await sendAndConfirmTransaction(
    connection,
    initializeMembershipTransaction,
    uniqueSigners([payer, authority, groupUpdateAuthority]),
    CONFIRM_OPTIONS
  );

  const recipientTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    recipient,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const mintToRecipientTransaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      recipientTokenAccount,
      recipient,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createMintToCheckedInstruction(
      mint.publicKey,
      recipientTokenAccount,
      authority.publicKey,
      1n,
      0,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );
  const mintToRecipientSignature = await sendAndConfirmTransaction(
    connection,
    mintToRecipientTransaction,
    [payer, authority],
    CONFIRM_OPTIONS
  );

  const verification = await verifyFixture(connection, mint.publicKey, recipient, recipientTokenAccount);

  console.log(
    JSON.stringify(
      {
        cluster: "devnet",
        payer: payer.publicKey.toBase58(),
        authority: authority.publicKey.toBase58(),
        groupUpdateAuthority: groupUpdateAuthority.publicKey.toBase58(),
        groupMint: SGT_GROUP_MINT.toBase58(),
        recipient: recipient.toBase58(),
        mint: mint.publicKey.toBase58(),
        mintKeypairPath,
        recipientTokenAccount: recipientTokenAccount.toBase58(),
        signatures: {
          createMintWithPointers: createMintSignature,
          initializeTokenGroupMembership: initializeMembershipSignature,
          createRecipientAtaAndMintOne: mintToRecipientSignature
        },
        verification
      },
      null,
      2
    )
  );
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    switch (value) {
      case "--recipient":
        args.recipient = argv[++index];
        break;
      case "--rpc-url":
        args.rpcUrl = argv[++index];
        break;
      case "--authority":
        args.authority = argv[++index];
        break;
      case "--payer":
        args.payer = argv[++index];
        break;
      case "--group-update-authority":
        args.groupUpdateAuthority = argv[++index];
        break;
      case "--mint-keypair-dir":
        args.mintKeypairDir = argv[++index];
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/devnet/create-devnet-sgt-fixture.cjs --recipient <PUBLIC_KEY> [options]

Options:
  --rpc-url <URL>              Devnet RPC URL. Default: ${DEFAULT_RPC_URL}
  --authority <PATH>           SGT authority keypair. Default: ${DEFAULT_AUTHORITY_PATH}
  --payer <PATH>               Payer keypair. Default: ${DEFAULT_PAYER_PATH}
  --group-update-authority <PATH>
                               Group update authority keypair. Default: ${DEFAULT_GROUP_UPDATE_AUTHORITY_PATH}
  --mint-keypair-dir <PATH>    Directory for the generated mint keypair. Default: ${DEFAULT_MINT_KEYPAIR_DIR}
`);
}

async function assertDevnet(connection) {
  const genesisHash = await connection.getGenesisHash();

  if (genesisHash !== DEVNET_GENESIS_HASH) {
    throw new Error("Refusing to run: RPC endpoint is not Solana devnet.");
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

function expandHome(value) {
  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
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

function persistMintKeypair(filePath, keypair) {
  if (fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing mint keypair file: ${filePath}`);
  }

  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });
  fs.writeFileSync(filePath, JSON.stringify(Array.from(keypair.secretKey)), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
}

function uniqueSigners(signers) {
  const unique = new Map();

  for (const signer of signers) {
    unique.set(signer.publicKey.toBase58(), signer);
  }

  return Array.from(unique.values());
}

async function verifyFixture(connection, mintAddress, recipient, recipientTokenAccount) {
  const mintAccountInfo = await connection.getAccountInfo(mintAddress, "confirmed");

  if (!mintAccountInfo) {
    throw new Error("New SGT mint account could not be fetched for verification.");
  }

  const mint = unpackMint(mintAddress, mintAccountInfo, TOKEN_2022_PROGRAM_ID);
  const metadataPointer = getMetadataPointerState(mint);
  const groupMemberPointer = getGroupMemberPointerState(mint);
  const tokenGroupMember = getTokenGroupMemberState(mint);
  const mintState = await getMint(connection, mintAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
  const tokenAccount = await getAccount(connection, recipientTokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);
  const organismPda = PublicKey.findProgramAddressSync(
    [Buffer.from("organism"), mintAddress.toBuffer()],
    SPORE_PROGRAM_ID
  )[0];
  const organismAccount = await connection.getAccountInfo(organismPda, "confirmed");
  const actual = {
    mintAuthority: mint.mintAuthority?.toBase58() ?? null,
    metadataPointerAuthority: metadataPointer?.authority?.toBase58() ?? null,
    metadataAddress: metadataPointer?.metadataAddress?.toBase58() ?? null,
    groupMemberPointerAuthority: groupMemberPointer?.authority?.toBase58() ?? null,
    groupMemberPointerMemberAddress: groupMemberPointer?.memberAddress?.toBase58() ?? null,
    tokenGroupMemberMint: tokenGroupMember?.mint?.toBase58() ?? null,
    tokenGroupMemberGroup: tokenGroupMember?.group?.toBase58() ?? null,
    supply: mintState.supply.toString(),
    decimals: mintState.decimals,
    recipientTokenAccountOwner: tokenAccount.owner.toBase58(),
    recipientTokenAccountMint: tokenAccount.mint.toBase58(),
    recipientTokenAmount: tokenAccount.amount.toString(),
    recipientTokenState: tokenAccount.isInitialized ? "initialized" : "not_initialized",
    organismPda: organismPda.toBase58(),
    organismAccountExists: organismAccount !== null
  };
  const checks = {
    token2022Program: mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID),
    mintAuthority: actual.mintAuthority === SGT_AUTHORITY.toBase58(),
    metadataPointerAuthority: actual.metadataPointerAuthority === SGT_AUTHORITY.toBase58(),
    metadataAddress: actual.metadataAddress === SGT_GROUP_MINT.toBase58(),
    groupMemberPointerAuthority: actual.groupMemberPointerAuthority === SGT_AUTHORITY.toBase58(),
    groupMemberPointerMemberAddress: actual.groupMemberPointerMemberAddress === mintAddress.toBase58(),
    tokenGroupMemberMint: actual.tokenGroupMemberMint === mintAddress.toBase58(),
    tokenGroupMemberGroup: actual.tokenGroupMemberGroup === SGT_GROUP_MINT.toBase58(),
    supplyExactlyOne: actual.supply === "1",
    decimalsZero: actual.decimals === 0,
    recipientOwner: actual.recipientTokenAccountOwner === recipient.toBase58(),
    recipientMint: actual.recipientTokenAccountMint === mintAddress.toBase58(),
    recipientAmountExactlyOne: actual.recipientTokenAmount === "1",
    recipientTokenInitialized: tokenAccount.isInitialized,
    noSporeOrganism: !actual.organismAccountExists
  };

  if (!Object.values(checks).every(Boolean)) {
    throw new Error(`Fixture verification failed: ${JSON.stringify({ actual, checks }, null, 2)}`);
  }

  return {
    actual,
    checks
  };
}
