import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountInfo,
} from "@solana/web3.js";
import type { AuthIdentity, PublicOrganism } from "../auth/api";
import { getCurrentIdentity } from "../auth/api";
import { getStoredSessionToken } from "../auth/session";
import {
  assertDevnetGenesisCandidate,
  isDevnetGenesisCandidate,
  sporeGenesisHash,
  sporeMetadataBaseUri,
  sporeProgramId,
} from "./config";
import {
  commitment,
  encodeSecretBase64Url,
  SporeFailure,
  type ClaimPayload,
} from "./payload";
import {
  abandonClaimViaApi,
  confirmClaimWithRetry,
  fetchClaimSettlementViaApi,
  fetchOwnOrganismFromApi,
  releaseSporeViaApi,
  reserveClaimViaApi,
  type OwnOrganismResponse,
} from "./reproductionApi";

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

type PreflightDebugMetadata = Record<string, string | number | boolean | null>;
type PreflightDebug = (phase: string, metadata?: PreflightDebugMetadata) => void;
export type DevnetGenesisStatus =
  | { visible: false }
  | { visible: true; mode: "fresh" | "seekerZeroRetry" };
export type DevnetGenesisResult = {
  organism: Organism | null;
  slot?: number;
};
export type ClaimSporeResult = {
  slot: number;
  transactionSignature: string;
  organism: Organism;
  reservationId: string;
};

const EMPTY_COMMITMENT = new Uint8Array(32);
/** Soft local offer window while QR accept awaits server reserve validation. */
const SOFT_OFFER_SECONDS = 120;

const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const CORE = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const SPECIES_ACCOUNT_SIZE = 229;
const SEEKER_ZERO_ORGANISM_NUMBER = 0;

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
          "SPØR requires the configured Solana environment.",
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
    throw new SporeFailure("SPØR RPC is not configured.");
  return (rpc ??= new Connection(url, "confirmed"));
}

export function programId() {
  return sporeProgramId();
}

export function organismPda(mint: PublicKey) {
  return pda("organism", mint);
}

export function speciesPda() {
  return pda("species");
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
    throw new SporeFailure("Invalid canonical SPØR account.");
  }

  return data;
}

function hexToBytes(hex: string, expectedLength: number) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length !== expectedLength * 2) {
    throw new SporeFailure("Invalid organism encoding.");
  }

  const bytes = new Uint8Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function unixFromIso(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new SporeFailure("Invalid organism encoding.");
  return Math.floor(ms / 1000);
}

export function organismFromPublic(
  organism: PublicOrganism,
  reproduction?: {
    nextSporeAt?: string;
    activeSporeCommitment?: string;
    activeSporeExpiresAt?: string;
  },
): Organism {
  return {
    address: new PublicKey(organism.organismPda),
    organismNumber: organism.organismNumber,
    sgtMint: new PublicKey(organism.sgtMint),
    parentOrganism: organism.parentOrganismPda
      ? new PublicKey(organism.parentOrganismPda)
      : null,
    generation: organism.generation,
    genome: hexToBytes(organism.genome, 16),
    bornAt: unixFromIso(organism.bornAt),
    nextSporeAt: unixFromIso(reproduction?.nextSporeAt ?? organism.bornAt),
    activeSporeCommitment: reproduction?.activeSporeCommitment
      ? hexToBytes(reproduction.activeSporeCommitment, 32)
      : new Uint8Array(EMPTY_COMMITMENT),
    activeSporeExpiresAt: unixFromIso(
      reproduction?.activeSporeExpiresAt ?? new Date(0).toISOString(),
    ),
  };
}

function organismFromOwnApi(organism: OwnOrganismResponse): Organism {
  return organismFromPublic(organism, {
    nextSporeAt: organism.nextSporeAt,
    activeSporeCommitment: organism.activeSporeCommitment,
    activeSporeExpiresAt: organism.activeSporeExpiresAt,
  });
}

// Anchor/Borsh layout from programs/spore/src/state.rs. No generated IDL/client exists in this repository.
export function decodeOrganism(
  address: PublicKey,
  info: AccountInfo<Buffer>,
): Organism {
  const data = checkedData(info, "Organism");
  if (data.length !== 157)
    throw new SporeFailure("Invalid canonical SPØR account.");
  let offset = 8;
  const take = (length: number): Buffer => {
    const bytes = Buffer.from(data.subarray(offset, offset + length));
    offset += length;
    return bytes;
  };
  const timestamp = () => {
    const value = Number(take(8).readBigInt64LE(0));
    if (!Number.isSafeInteger(value))
      throw new SporeFailure("Invalid canonical SPØR account.");
    return value;
  };
  const organismNumber = take(8).readBigUInt64LE(0).toString();
  const sgtMint = new PublicKey(take(32));
  const option = take(1)[0];
  if (option !== 0 && option !== 1)
    throw new SporeFailure("Invalid canonical SPØR account.");
  const parentOrganism = option === 1 ? new PublicKey(take(32)) : null;
  const generation = take(4).readUInt32LE(0);
  const genome = new Uint8Array(take(16));
  const bornAt = timestamp();
  const nextSporeAt = timestamp();
  const activeSporeCommitment = new Uint8Array(take(32));
  const activeSporeExpiresAt = timestamp();
  if (!organismPda(sgtMint).equals(address))
    throw new SporeFailure("Invalid canonical SPØR account.");
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
  _minContextSlot?: number,
) {
  const organism = await fetchOwnOrganismFromApi(identity);
  return organism ? organismFromOwnApi(organism) : null;
}

export async function fetchDevnetGenesisStatus(
  identity: AuthIdentity,
): Promise<DevnetGenesisStatus> {
  if (!isDevnetGenesisCandidate(identity.walletAddress)) {
    return { visible: false };
  }

  await assertConfiguredNetwork();

  const species = await fetchSpeciesState();

  if (!species) {
    return { visible: true, mode: "fresh" };
  }

  const owner = new PublicKey(identity.walletAddress);

  if (
    !species.seekerZeroOrganism &&
    species.authority.equals(owner) &&
    species.nextOrganismNumber === SEEKER_ZERO_ORGANISM_NUMBER &&
    species.totalOrganisms === 0
  ) {
    return { visible: true, mode: "seekerZeroRetry" };
  }

  return { visible: false };
}

export async function initializeDevnetGenesis(
  identity: AuthIdentity,
): Promise<DevnetGenesisResult> {
  assertDevnetGenesisCandidate(identity.walletAddress);

  const { owner, mint, tokenAccount } = await currentSigner(identity);
  const existing = await fetchOrganism(organismPda(mint));

  if (existing) {
    return { organism: existing };
  }

  let minContextSlot: number | undefined;
  let species = await fetchSpeciesState();

  if (!species) {
    minContextSlot = await send(
      identity,
      "initialize_species",
      encodeInitializeSpeciesArgs(owner, sporeMetadataBaseUri()),
      [
        meta(speciesPda(), true),
        meta(owner, true, true),
        meta(SystemProgram.programId),
      ],
    );
    species = await fetchSpeciesState(minContextSlot);
  }

  if (!species) {
    throw new SporeFailure("Species initialized, but its account is not readable yet.");
  }
  if (!species.authority.equals(owner)) {
    throw new SporeFailure("Devnet Species belongs to another authority.");
  }
  if (
    species.seekerZeroOrganism ||
    species.nextOrganismNumber !== SEEKER_ZERO_ORGANISM_NUMBER ||
    species.totalOrganisms !== 0
  ) {
    const organism = await fetchOrganism(organismPda(mint), minContextSlot);

    if (organism) {
      return { organism, slot: minContextSlot };
    }

    throw new SporeFailure("Devnet Seeker Zero is already initialized.");
  }

  const coreAsset = pda("core_asset", mint);
  const coreAssetInfo = await connection().getAccountInfo(coreAsset, "confirmed");

  if (coreAssetInfo && coreAssetInfo.data.length > 0) {
    throw new SporeFailure("Devnet Seeker Zero Core NFT already exists.");
  }

  const seekerZeroSlot = await send(
    identity,
    "initialize_seeker_zero",
    new Uint8Array(),
    [
      meta(owner, true, true),
      meta(speciesPda(), true),
      meta(mint),
      meta(tokenAccount),
      meta(organismPda(mint), true),
      meta(coreAsset, true),
      meta(CORE),
      meta(SystemProgram.programId),
    ],
  );
  const organism = await fetchOrganism(organismPda(mint), seekerZeroSlot);

  return { organism, slot: seekerZeroSlot };
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const hasOffer = (parent: Organism) =>
  parent.activeSporeCommitment.some(Boolean) &&
  parent.activeSporeExpiresAt >= nowSeconds();

/**
 * Soft preflight for scan UX. Server reserve is authoritative on ACCEPT LIFE.
 * Does not invent parent organism number/genome/generation.
 */
export async function preflightOffer(
  payload: ClaimPayload,
  debug?: PreflightDebug,
) {
  debug?.("soft_preflight_start", {
    parent: payload.parent.toBase58(),
  });
  commitment(payload.secret);
  // Minimal parent identity for UI plumbing only. Birth reveal uses null parent
  // traits from this stub — never treat these fields as canonical state.
  const stub: Organism = {
    address: payload.parent,
    organismNumber: "",
    sgtMint: new PublicKey(new Uint8Array(32)),
    parentOrganism: null,
    generation: 0,
    genome: new Uint8Array(16),
    bornAt: 0,
    nextSporeAt: 0,
    activeSporeCommitment: new Uint8Array(commitment(payload.secret)),
    // Local UX upper bound matching doctrine TTL; server remains authoritative.
    activeSporeExpiresAt: nowSeconds() + SOFT_OFFER_SECONDS,
  };
  debug?.("soft_preflight_complete", {
    parent: payload.parent.toBase58(),
    expiresAt: stub.activeSporeExpiresAt,
  });
  return stub;
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
  const hash = commitment(secret);
  await releaseSporeViaApi(encodeSecretBase64Url(secret));

  const released = await fetchOwnOrganism(identity);
  if (
    !released ||
    !Buffer.from(released.activeSporeCommitment).equals(Buffer.from(hash)) ||
    !hasOffer(released)
  ) {
    throw new SporeFailure(
      "The released offer is no longer available. Refresh your organism.",
    );
  }

  return released;
}

export async function claimSpore(
  identity: AuthIdentity,
  payload: ClaimPayload,
) {
  const result = await claimSporeWithSignature(identity, payload);

  return result.slot;
}

export async function claimSporeWithSignature(
  identity: AuthIdentity,
  payload: ClaimPayload,
): Promise<ClaimSporeResult> {
  if (await fetchOwnOrganism(identity)) {
    throw new SporeFailure("This Seeker already owns an organism.");
  }

  const secretBase64Url = encodeSecretBase64Url(payload.secret);
  let reservationId: string | null = null;
  let transactionSignature: string | null = null;
  let settlementPrepared = false;

  try {
    const reserved = await reserveClaimViaApi({
      parentOrganismPda: payload.parent.toBase58(),
      secretBase64Url,
    });
    reservationId = reserved.reservationId;

    if (reserved.organism) {
      return {
        slot: 0,
        transactionSignature: reserved.transactionSignature ?? "",
        organism: organismFromPublic(reserved.organism),
        reservationId,
      };
    }

    const settlement = await fetchClaimSettlementViaApi(reservationId);
    settlementPrepared = true;

    if (settlement.organism) {
      return {
        slot: 0,
        transactionSignature: settlement.transactionSignature ?? "",
        organism: organismFromPublic(settlement.organism),
        reservationId,
      };
    }

    if (!settlement.transaction || settlement.lastValidBlockHeight == null) {
      throw new SporeFailure("Unable to prepare settlement.");
    }

    const { signAndSendPreparedTransaction } = await import("../auth/wallet");
    const submitted = await signAndSendPreparedTransaction(
      connection(),
      identity,
      settlement.transaction,
      settlement.lastValidBlockHeight,
    );
    transactionSignature = submitted.signature;

    const confirmed = await confirmClaimWithRetry({
      reservationId,
      transactionSignature,
    });

    return {
      slot: submitted.slot,
      transactionSignature,
      organism: organismFromPublic(confirmed.organism),
      reservationId,
    };
  } catch (error) {
    // Only abandon pre-settlement reservations. Once settlement is prepared,
    // recovery is confirm-only (tx may already be broadcast).
    if (reservationId && !transactionSignature && !settlementPrepared) {
      await abandonClaimViaApi(reservationId).catch(() => {});
    }

    if (
      error instanceof SporeFailure &&
      reservationId &&
      transactionSignature
    ) {
      (error as SporeFailure & {
        reservationId?: string;
        transactionSignature?: string;
      }).reservationId = reservationId;
      (error as SporeFailure & {
        reservationId?: string;
        transactionSignature?: string;
      }).transactionSignature = transactionSignature;
    }

    throw error;
  }
}

type SpeciesState = {
  authority: PublicKey;
  seekerZeroOrganism: PublicKey | null;
  nextOrganismNumber: number;
  totalOrganisms: number;
};

async function fetchSpeciesState(minContextSlot?: number) {
  const result = await connection().getAccountInfoAndContext(speciesPda(), {
    commitment: "confirmed",
    minContextSlot,
  });

  return result.value ? decodeSpeciesState(result.value) : null;
}

function decodeSpeciesState(info: AccountInfo<Buffer>): SpeciesState {
  const data = checkedData(info, "Species");

  if (data.length !== SPECIES_ACCOUNT_SIZE) {
    throw new SporeFailure("Invalid canonical Species account.");
  }

  let offset = 8;
  const take = (length: number) => {
    const bytes = Buffer.from(data.subarray(offset, offset + length));

    if (bytes.length !== length) {
      throw new SporeFailure("Invalid canonical Species account.");
    }

    offset += length;
    return bytes;
  };
  const authority = new PublicKey(take(32));

  take(32); // treasury
  take(8); // birth_fee_lamports

  const metadataBaseUriLength = take(4).readUInt32LE(0);

  if (metadataBaseUriLength > 96) {
    throw new SporeFailure("Invalid canonical Species account.");
  }

  take(metadataBaseUriLength);

  const nextOrganismNumber = readU64LeAsSafeNumber(
    take(8),
    "next_organism_number",
  );
  const seekerZeroOption = take(1)[0];
  let seekerZeroOrganism: PublicKey | null = null;

  if (seekerZeroOption === 1) {
    seekerZeroOrganism = new PublicKey(take(32));
  } else if (seekerZeroOption !== 0) {
    throw new SporeFailure("Invalid canonical Species account.");
  }

  const totalOrganisms = readU64LeAsSafeNumber(take(8), "total_organisms");

  return {
    authority,
    seekerZeroOrganism,
    nextOrganismNumber,
    totalOrganisms,
  };
}

function encodeInitializeSpeciesArgs(treasury: PublicKey, metadataBaseUri: string) {
  const metadataBytes = Buffer.from(metadataBaseUri, "utf8");
  const data = Buffer.alloc(32 + 8 + 4 + metadataBytes.length);
  let offset = 0;

  treasury.toBuffer().copy(data, offset);
  offset += 32;
  data.writeUInt32LE(0, offset);
  data.writeUInt32LE(0, offset + 4);
  offset += 8;
  data.writeUInt32LE(metadataBytes.length, offset);
  offset += 4;
  metadataBytes.copy(data, offset);

  return data;
}

function readU64LeAsSafeNumber(bytes: Buffer, fieldName: string) {
  const low = bytes.readUInt32LE(0);
  const high = bytes.readUInt32LE(4);
  const value = high * 0x100000000 + low;

  if (!Number.isSafeInteger(value)) {
    throw new SporeFailure(`Invalid canonical Species ${fieldName}.`);
  }

  return value;
}
