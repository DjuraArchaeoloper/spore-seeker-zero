import crypto from "crypto";
import { Connection, PublicKey, type AccountInfo } from "@solana/web3.js";

import { getHeliusRpcUrl, getSporeProgramId } from "../env";

const ORGANISM_SEED = "organism";
const CORE_ASSET_SEED = "core_asset";
const ORGANISM_ACCOUNT_SIZE = 157;
const ORGANISM_ACCOUNT_DISCRIMINATOR = crypto
  .createHash("sha256")
  .update("account:Organism")
  .digest()
  .subarray(0, 8);

let connection: Connection | null = null;

export class OutbreakBirthVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutbreakBirthVerificationError";
  }
}

export type CanonicalOrganismAccount = {
  organismPda: string;
  organismNumber: string;
  sgtMint: string;
  parentOrganismPda: string | null;
  generation: number;
  genome: string;
  bornAt: Date;
  coreAsset: string;
};

export type ExpectedIndexedBirth = {
  organismPda: string;
  organismNumber: string;
  sgtMint: string;
  parentOrganismPda: string | null;
  generation: number;
  genome: string;
  bornAt: Date;
  coreAsset: string;
};

export async function verifyCanonicalBirth(
  expected: ExpectedIndexedBirth
): Promise<CanonicalOrganismAccount> {
  const canonical = await fetchCanonicalOrganismByPda(expected.organismPda);

  assertEqual("child organism PDA", canonical.organismPda, expected.organismPda);
  assertEqual("child SGT mint", canonical.sgtMint, expected.sgtMint);
  assertEqual("child organism number", canonical.organismNumber, expected.organismNumber);
  assertEqual("child parent organism PDA", canonical.parentOrganismPda, expected.parentOrganismPda);
  assertEqual("child generation", canonical.generation, expected.generation);
  assertEqual("child genome", canonical.genome, expected.genome.toLowerCase());
  assertEqual("child bornAt", canonical.bornAt.getTime(), expected.bornAt.getTime());
  assertEqual("child Core Asset PDA", canonical.coreAsset, expected.coreAsset);

  return canonical;
}

export async function fetchCanonicalOrganismByPda(
  organismPda: string
): Promise<CanonicalOrganismAccount> {
  const programId = getProgramPublicKey();
  const organismPublicKey = parsePublicKey(organismPda, "organism PDA");
  const account = await getConnection().getAccountInfo(organismPublicKey, "confirmed");

  if (!account) {
    throw new OutbreakBirthVerificationError("canonical organism account was not found");
  }

  return decodeOrganismAccount(organismPublicKey, account, programId);
}

function decodeOrganismAccount(
  organismPublicKey: PublicKey,
  account: AccountInfo<Buffer>,
  programId: PublicKey
): CanonicalOrganismAccount {
  if (!account.owner.equals(programId)) {
    throw new OutbreakBirthVerificationError("canonical organism account owner mismatch");
  }

  const data = Buffer.from(account.data);
  if (data.length !== ORGANISM_ACCOUNT_SIZE) {
    throw new OutbreakBirthVerificationError("canonical organism account size mismatch");
  }

  if (!data.subarray(0, 8).equals(ORGANISM_ACCOUNT_DISCRIMINATOR)) {
    throw new OutbreakBirthVerificationError("canonical organism discriminator mismatch");
  }

  let offset = 8;
  const take = (size: number) => {
    const end = offset + size;
    if (end > data.length) {
      throw new OutbreakBirthVerificationError("canonical organism account is truncated");
    }
    const slice = data.subarray(offset, end);
    offset = end;
    return slice;
  };

  const organismNumber = take(8).readBigUInt64LE(0).toString();
  const sgtMint = new PublicKey(take(32)).toBase58();
  const parentOption = take(1)[0];

  let parentOrganismPda: string | null = null;
  if (parentOption === 1) {
    parentOrganismPda = new PublicKey(take(32)).toBase58();
  } else if (parentOption !== 0) {
    throw new OutbreakBirthVerificationError("canonical organism parent option is invalid");
  }

  const generation = take(4).readUInt32LE(0);
  const genome = take(16).toString("hex");
  const bornAt = decodeUnixTimestamp(take(8), "bornAt");

  take(8); // next_spore_at is not used for reward integrity.
  take(32); // active_spore_commitment is not used for reward integrity.
  take(8); // active_spore_expires_at is not used for reward integrity.

  const derivedOrganismPda = deriveOrganismPda(new PublicKey(sgtMint), programId).toBase58();
  if (derivedOrganismPda !== organismPublicKey.toBase58()) {
    throw new OutbreakBirthVerificationError("canonical organism PDA derivation mismatch");
  }

  const coreAsset = deriveCoreAssetPda(new PublicKey(sgtMint), programId).toBase58();

  return {
    organismPda: organismPublicKey.toBase58(),
    organismNumber,
    sgtMint,
    parentOrganismPda,
    generation,
    genome,
    bornAt,
    coreAsset
  };
}

function decodeUnixTimestamp(buffer: Buffer, fieldName: string): Date {
  const seconds = buffer.readBigInt64LE(0);
  if (seconds < BigInt(0) || seconds > BigInt(Number.MAX_SAFE_INTEGER / 1000)) {
    throw new OutbreakBirthVerificationError(`canonical organism ${fieldName} is outside supported range`);
  }

  return new Date(Number(seconds) * 1000);
}

function deriveOrganismPda(sgtMint: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ORGANISM_SEED, "utf8"), sgtMint.toBuffer()],
    programId
  )[0];
}

function deriveCoreAssetPda(sgtMint: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CORE_ASSET_SEED, "utf8"), sgtMint.toBuffer()],
    programId
  )[0];
}

function getConnection() {
  if (!connection) {
    connection = new Connection(getHeliusRpcUrl(), "confirmed");
  }

  return connection;
}

function getProgramPublicKey() {
  return parsePublicKey(getSporeProgramId(), "SPORE program id");
}

function parsePublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new OutbreakBirthVerificationError(`invalid ${label}`);
  }
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new OutbreakBirthVerificationError(`${label} mismatch`);
  }
}
