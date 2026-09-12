import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountInfo,
} from "@solana/web3.js";
import type { AuthIdentity } from "../auth/api";
import { getCurrentIdentity } from "../auth/api";
import { getStoredSessionToken } from "../auth/session";
import { sporeGenesisHash, sporeProgramId } from "./config";
import { commitment, SporeFailure, type ClaimPayload } from "./payload";

export type Organism = {
  address: PublicKey;
  organismNumber: string;
  sgtMint: PublicKey;
  parentOrganism: PublicKey | null;
  generation: number;
  genome: Uint8Array;
  bornAt: number;
  nextSporeAt: number;
  activeSporeCommitment: Uint8Array;
  activeSporeExpiresAt: number;
};

const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const CORE = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

const discriminator = (name: string): Buffer =>
  Buffer.from(sha256(Buffer.from(name)).subarray(0, 8));

let rpc: Connection | undefined;
let networkCheck: Promise<void> | undefined;

async function assertConfiguredNetwork() {
  networkCheck ??= connection()
    .getGenesisHash()
    .then((hash) => {
      if (hash !== sporeGenesisHash())
        throw new SporeFailure(
          "SPORE requires the configured Solana environment.",
        );
    })
    .catch((error: unknown) => {
      networkCheck = undefined;
      throw error;
    });
  await networkCheck;
}

export function connection() {
  if (process.env.EXPO_PUBLIC_SPORE_VISUAL_PREVIEW === "true")
    throw new SporeFailure("Reproduction is unavailable in visual preview.");
  const url = process.env.EXPO_PUBLIC_SPORE_RPC_URL;
  if (!url?.startsWith("https://"))
    throw new SporeFailure("SPORE RPC is not configured.");
  return (rpc ??= new Connection(url, "confirmed"));
}

export function programId() {
  return sporeProgramId();
}

export function organismPda(mint: PublicKey) {
  return pda("organism", mint);
}

function pda(seed: string, mint?: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed), ...(mint ? [mint.toBuffer()] : [])],
    programId(),
  )[0];
}

function checkedData(info: AccountInfo<Buffer>, name: string): Buffer {
  const data = Buffer.from(info.data);

  if (
    info.executable ||
    !info.owner.equals(programId()) ||
    !Buffer.from(data.subarray(0, 8)).equals(discriminator(`account:${name}`))
  ) {
    throw new SporeFailure("Invalid canonical SPORE account.");
  }

  return data;
}

// Anchor/Borsh layout from programs/spore/src/state.rs. No generated IDL/client exists in this repository.
export function decodeOrganism(
  address: PublicKey,
  info: AccountInfo<Buffer>,
): Organism {
  const data = checkedData(info, "Organism");
  if (data.length !== 157)
    throw new SporeFailure("Invalid canonical SPORE account.");
  let offset = 8;
  const take = (length: number): Buffer => {
    const bytes = Buffer.from(data.subarray(offset, offset + length));
    offset += length;
    return bytes;
  };
  const timestamp = () => {
    const value = Number(take(8).readBigInt64LE(0));
    if (!Number.isSafeInteger(value))
      throw new SporeFailure("Invalid canonical SPORE account.");
    return value;
  };
  const organismNumber = take(8).readBigUInt64LE(0).toString();
  const sgtMint = new PublicKey(take(32));
  const option = take(1)[0];
  if (option !== 0 && option !== 1)
    throw new SporeFailure("Invalid canonical SPORE account.");
  const parentOrganism = option === 1 ? new PublicKey(take(32)) : null;
  const generation = take(4).readUInt32LE(0);
  const genome = new Uint8Array(take(16));
  const bornAt = timestamp();
  const nextSporeAt = timestamp();
  const activeSporeCommitment = new Uint8Array(take(32));
  const activeSporeExpiresAt = timestamp();
  if (!organismPda(sgtMint).equals(address))
    throw new SporeFailure("Invalid canonical SPORE account.");
  return {
    address,
    organismNumber,
    sgtMint,
    parentOrganism,
    generation,
    genome,
    bornAt,
    nextSporeAt,
    activeSporeCommitment,
    activeSporeExpiresAt,
  };
}

export async function fetchOrganism(
  address: PublicKey,
  minContextSlot?: number,
) {
  await assertConfiguredNetwork();
  const result = await connection().getAccountInfoAndContext(address, {
    commitment: "confirmed",
    minContextSlot,
  });
  return result.value ? decodeOrganism(address, result.value) : null;
}

export async function fetchOwnOrganism(
  identity: AuthIdentity,
  minContextSlot?: number,
) {
  return fetchOrganism(
    organismPda(new PublicKey(identity.sgtMint)),
    minContextSlot,
  );
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const hasOffer = (parent: Organism) =>
  parent.activeSporeCommitment.some(Boolean) &&
  parent.activeSporeExpiresAt >= nowSeconds();

export async function preflightOffer(payload: ClaimPayload) {
  const parent = await fetchOrganism(payload.parent);
  if (!parent || !parent.activeSporeCommitment.some(Boolean))
    throw new SporeFailure("This offer was already claimed or replaced.");
  if (parent.activeSporeExpiresAt <= nowSeconds())
    throw new SporeFailure("This spore offer has expired.");
  if (
    !Buffer.from(commitment(payload.secret)).equals(
      Buffer.from(parent.activeSporeCommitment),
    )
  )
    throw new SporeFailure("This offer was already claimed or replaced.");
  if (parent.nextSporeAt > nowSeconds())
    throw new SporeFailure("This spore is not ready.");
  return parent;
}

async function currentSigner(expected: AuthIdentity) {
  const token = await getStoredSessionToken();
  if (!token) throw new SporeFailure("Sign in again to continue.");
  const actual = await getCurrentIdentity(token);
  if (
    actual.sgtMint !== expected.sgtMint ||
    actual.walletAddress !== expected.walletAddress
  )
    throw new SporeFailure("Your Seeker identity changed. Sign in again.");
  // The configured environment is the only chain selector. QR payloads cannot switch it.
  await assertConfiguredNetwork();
  const owner = new PublicKey(actual.walletAddress);
  const mint = new PublicKey(actual.sgtMint);
  const accounts = await connection().getTokenAccountsByOwner(
    owner,
    { mint },
    "confirmed",
  );
  const tokenAccount = accounts.value.find(
    ({ account }) =>
      account.owner.equals(TOKEN_2022) &&
      account.data.length >= 165 &&
      new PublicKey(account.data.subarray(0, 32)).equals(mint) &&
      new PublicKey(account.data.subarray(32, 64)).equals(owner) &&
      account.data.readBigUInt64LE(64) === BigInt(1) &&
      account.data[108] !== 0,
  );
  if (!tokenAccount)
    throw new SporeFailure(
      "Your wallet no longer holds this Seeker Genesis Token.",
    );
  return { owner, mint, tokenAccount: tokenAccount.pubkey };
}

const meta = (pubkey: PublicKey, isWritable = false, isSigner = false) => ({
  pubkey,
  isWritable,
  isSigner,
});

async function send(
  identity: AuthIdentity,
  name: string,
  bytes: Uint8Array,
  keys: ReturnType<typeof meta>[],
) {
  const { sendWalletTransaction } = await import("../auth/wallet");
  const instruction = new TransactionInstruction({
    programId: programId(),
    keys,
    data: Buffer.concat([discriminator(`global:${name}`), Buffer.from(bytes)]),
  });
  try {
    return await sendWalletTransaction(connection(), identity, instruction);
  } finally {
    instruction.data.fill(0);
  }
}

export async function releaseSpore(identity: AuthIdentity, secret: Uint8Array) {
  const { owner, mint, tokenAccount } = await currentSigner(identity);
  const address = organismPda(mint);
  const parent = await fetchOrganism(address);
  if (!parent || parent.nextSporeAt > nowSeconds())
    throw new SporeFailure("Your spore is not ready.");
  if (hasOffer(parent))
    throw new SporeFailure("An offer is still active. Wait for it to expire.");
  const hash = commitment(secret);
  const slot = await send(identity, "release_spore", hash, [
    meta(owner, true, true),
    meta(address, true),
    meta(mint),
    meta(tokenAccount),
  ]);
  let released: Organism | null;
  try {
    released = await fetchOrganism(address, slot);
  } catch {
    throw new SporeFailure(
      "Release confirmed, but its account could not be read. Refresh before releasing again.",
    );
  }
  if (
    !released ||
    !Buffer.from(released.activeSporeCommitment).equals(Buffer.from(hash)) ||
    !hasOffer(released)
  )
    throw new SporeFailure(
      "The released offer is no longer available. Refresh your organism.",
    );
  return released;
}

export async function claimSpore(
  identity: AuthIdentity,
  payload: ClaimPayload,
) {
  const { owner, mint, tokenAccount } = await currentSigner(identity);
  if (await fetchOwnOrganism(identity))
    throw new SporeFailure("This Seeker already owns an organism.");
  await preflightOffer(payload);
  const species = pda("species");
  const info = await connection().getAccountInfo(species, "confirmed");
  if (!info) throw new SporeFailure("The species is not available yet.");
  const data = checkedData(info, "Species");
  if (data.length !== 229)
    throw new SporeFailure("Invalid canonical Species account.");
  const treasury = new PublicKey(data.subarray(40, 72));
  return send(identity, "claim_spore", payload.secret, [
    meta(species, true),
    meta(payload.parent, true),
    meta(owner, true, true),
    meta(mint),
    meta(tokenAccount),
    meta(treasury, true),
    meta(organismPda(mint), true),
    meta(pda("core_asset", mint), true),
    meta(CORE),
    meta(SystemProgram.programId),
  ]);
}
