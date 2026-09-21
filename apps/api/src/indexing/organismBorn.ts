import crypto from "crypto";

import { PublicKey } from "@solana/web3.js";

import { ensureDescendantCountersForBirth } from "./descendantCounters";
import {
  ORGANISM_STATUS,
  OrganismIndexModel,
  type OrganismIndex
} from "../models/OrganismIndex";
import {
  ensureOutbreakContributionsForBirth,
  type OutbreakScoringStatus
} from "../outbreak/scoring";
import { EMPTY_SPORE_COMMITMENT_HEX } from "../spore/bytes";

const PROGRAM_DATA_PREFIX = "Program data: ";
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;
const ORGANISM_SEED = "organism";
const CORE_ASSET_SEED = "core_asset";
const ORGANISM_BORN_DISCRIMINATOR = crypto
  .createHash("sha256")
  .update("event:OrganismBorn")
  .digest()
  .subarray(0, 8);
const PUBLIC_KEY_BYTES = 32;
const U64_BYTES = 8;
const U32_BYTES = 4;
const I64_BYTES = 8;
const GENOME_BYTES = 16;
const ORGANISM_BORN_DATA_BYTES =
  8 + PUBLIC_KEY_BYTES + U64_BYTES + PUBLIC_KEY_BYTES + PUBLIC_KEY_BYTES + PUBLIC_KEY_BYTES + U32_BYTES + GENOME_BYTES + I64_BYTES;
const DEFAULT_PUBKEY = "11111111111111111111111111111111";
const MAX_SAFE_SOLANA_TIMESTAMP = BigInt(Math.floor(8_640_000_000_000_000 / 1000));

type JsonObject = Record<string, unknown>;

export type HeliusIndexResult = {
  indexed: number;
  duplicates: number;
  ignored: number;
  outbreakScored: number;
  outbreakSkipped: number;
  outbreakFailed: number;
};

type OrganismBornEvent = {
  organismPda: string;
  organismNumber: string;
  sgtMint: string;
  parentOrganismPda: string | null;
  generation: number;
  genome: string;
  bornAt: Date;
  coreAsset: string;
};

type CandidateEvent = {
  event: OrganismBornEvent;
  transactionSignature: string;
};

type IndexOrganismBornResult = {
  indexStatus: "indexed" | "duplicate";
  outbreakStatus: OutbreakScoringStatus | "failed";
};

class IndexingError extends Error {}

export class WebhookPayloadError extends IndexingError {}

export class ParentOrganismMissingError extends IndexingError {}

export class OrganismIndexConflictError extends IndexingError {
  constructor(readonly organismPda: string) {
    super("Organism index conflict.");
  }
}

export async function indexHeliusRawTransactions(
  payload: unknown,
  sporeProgramId: string
): Promise<HeliusIndexResult> {
  const transactions = getTransactionPayloads(payload);
  const result: HeliusIndexResult = {
    indexed: 0,
    duplicates: 0,
    ignored: 0,
    outbreakScored: 0,
    outbreakSkipped: 0,
    outbreakFailed: 0
  };

  for (const transaction of transactions) {
    const events = extractOrganismBornEvents(transaction, sporeProgramId);

    if (events.length === 0) {
      result.ignored += 1;
      continue;
    }

    for (const candidate of events) {
      const indexed = await indexOrganismBorn(candidate);

      if (indexed.indexStatus === "duplicate") {
        result.duplicates += 1;
      } else {
        result.indexed += 1;
      }

      if (indexed.outbreakStatus === "scored") {
        result.outbreakScored += 1;
      } else if (indexed.outbreakStatus === "skipped") {
        result.outbreakSkipped += 1;
      } else {
        result.outbreakFailed += 1;
      }
    }
  }

  return result;
}

function getTransactionPayloads(payload: unknown): JsonObject[] {
  if (!Array.isArray(payload)) {
    throw new WebhookPayloadError("Webhook payload must be an array.");
  }

  return payload.map((item) => {
    if (!isPlainObject(item)) {
      throw new WebhookPayloadError("Webhook transaction must be an object.");
    }

    return item;
  });
}

function extractOrganismBornEvents(
  transaction: JsonObject,
  sporeProgramId: string
): CandidateEvent[] {
  const meta = getObject(transaction.meta, "meta");
  const error = meta.err;

  if (!Object.hasOwn(meta, "err")) {
    throw new WebhookPayloadError("meta.err is required.");
  }

  if (error !== null) {
    return [];
  }

  const logMessages = getStringArray(meta.logMessages, "meta.logMessages");
  const transactionObject = getObject(transaction.transaction, "transaction");
  const signatures = getStringArray(transactionObject.signatures, "transaction.signatures");
  const transactionSignature = signatures[0];

  if (!transactionSignature) {
    throw new WebhookPayloadError("Transaction signature is missing.");
  }
  if (
    !BASE58_PATTERN.test(transactionSignature) ||
    transactionSignature.length < 80 ||
    transactionSignature.length > 96
  ) {
    throw new WebhookPayloadError("Transaction signature is invalid.");
  }

  return extractProgramEventsFromLogs(logMessages, sporeProgramId).map((event) => ({
    event,
    transactionSignature
  }));
}

function extractProgramEventsFromLogs(
  logMessages: string[],
  sporeProgramId: string
): OrganismBornEvent[] {
  const events: OrganismBornEvent[] = [];
  const stack: string[] = [];

  for (const line of logMessages) {
    const invoke = /^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[[0-9]+\]$/.exec(line);

    if (invoke) {
      stack.push(invoke[1]);
      continue;
    }

    if (line.startsWith(PROGRAM_DATA_PREFIX) && stack[stack.length - 1] === sporeProgramId) {
      const event = decodeOrganismBornEvent(
        line.slice(PROGRAM_DATA_PREFIX.length),
        sporeProgramId
      );

      if (event) {
        events.push(event);
      }

      continue;
    }

    const finished = /^Program ([1-9A-HJ-NP-Za-km-z]+) (success|failed: .+)$/.exec(line);

    if (finished) {
      const lastIndex = stack.lastIndexOf(finished[1]);

      if (lastIndex >= 0) {
        stack.splice(lastIndex);
      }
    }
  }

  return events;
}

function decodeOrganismBornEvent(
  encoded: string,
  sporeProgramId: string
): OrganismBornEvent | null {
  let data: Buffer;

  if (!BASE64_PATTERN.test(encoded)) {
    throw new WebhookPayloadError("Invalid Anchor event encoding.");
  }

  try {
    data = Buffer.from(encoded, "base64");
  } catch {
    throw new WebhookPayloadError("Invalid Anchor event encoding.");
  }

  if (data.length < ORGANISM_BORN_DISCRIMINATOR.length) {
    throw new WebhookPayloadError("Malformed Anchor event.");
  }

  if (!data.subarray(0, 8).equals(ORGANISM_BORN_DISCRIMINATOR)) {
    return null;
  }

  if (data.length !== ORGANISM_BORN_DATA_BYTES) {
    throw new WebhookPayloadError("Malformed OrganismBorn event.");
  }

  let offset = 8;
  const organismPda = readPubkey(data, offset);
  offset += PUBLIC_KEY_BYTES;
  const organismNumber = readU64String(data, offset);
  offset += U64_BYTES;
  const sgtMint = readPubkey(data, offset);
  offset += PUBLIC_KEY_BYTES;
  const parent = readPubkey(data, offset);
  offset += PUBLIC_KEY_BYTES;
  const coreAsset = readPubkey(data, offset);
  offset += PUBLIC_KEY_BYTES;
  const generation = data.readUInt32LE(offset);
  offset += U32_BYTES;
  const genome = data.subarray(offset, offset + GENOME_BYTES).toString("hex");
  offset += GENOME_BYTES;
  const bornAt = readSolanaTimestamp(data, offset);
  const event = {
    organismPda,
    organismNumber,
    sgtMint,
    parentOrganismPda: parent === DEFAULT_PUBKEY ? null : parent,
    generation,
    genome,
    bornAt,
    coreAsset
  };

  validateDerivedAddresses(event, sporeProgramId);

  return event;
}

async function indexOrganismBorn(candidate: CandidateEvent): Promise<IndexOrganismBornResult> {
  const ancestorNumbers = await deriveAncestorNumbers(candidate.event);
  const indexedAt = new Date();
  const document = {
    ...candidate.event,
    transactionSignature: candidate.transactionSignature,
    ancestorNumbers,
    indexedAt,
    createdAt: indexedAt,
    mutationSlot: null,
    nextSporeAt: candidate.event.bornAt,
    activeSporeCommitment: EMPTY_SPORE_COMMITMENT_HEX,
    activeSporeExpiresAt: new Date(0),
    claimedOfferCommitment: null,
    activeClaimReservationId: null,
    status: ORGANISM_STATUS.finalized
  };

  const existing = await findExistingIndex(document);

  if (existing) {
    assertCanonicalMatch(existing, document);
    await ensureDescendantCountersForBirth(existing);
    return {
      indexStatus: "duplicate",
      outbreakStatus: await scoreOutbreakBirth(existing)
    };
  }

  try {
    await OrganismIndexModel.create(document);
    await ensureDescendantCountersForBirth(document);
    return {
      indexStatus: "indexed",
      outbreakStatus: await scoreOutbreakBirth(document)
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const duplicate = await findExistingIndex(document);

    if (!duplicate) {
      throw error;
    }

    assertCanonicalMatch(duplicate, document);
    await ensureDescendantCountersForBirth(duplicate);
    return {
      indexStatus: "duplicate",
      outbreakStatus: await scoreOutbreakBirth(duplicate)
    };
  }
}

async function scoreOutbreakBirth(
  document: Pick<
    OrganismIndex,
    | "organismPda"
    | "organismNumber"
    | "sgtMint"
    | "parentOrganismPda"
    | "generation"
    | "genome"
    | "bornAt"
    | "coreAsset"
    | "transactionSignature"
  >
): Promise<OutbreakScoringStatus | "failed"> {
  try {
    return await ensureOutbreakContributionsForBirth(document);
  } catch (error) {
    console.error("SPØR outbreak scoring failed.", {
      organismPda: document.organismPda,
      reason: getSafeOutbreakErrorReason(error)
    });

    return "failed";
  }
}

async function deriveAncestorNumbers(event: OrganismBornEvent): Promise<string[]> {
  if (event.organismNumber === "0") {
    if (event.parentOrganismPda !== null || event.generation !== 0) {
      throw new WebhookPayloadError("Malformed Seeker Zero birth event.");
    }

    return [];
  }

  if (!event.parentOrganismPda || event.generation === 0) {
    throw new WebhookPayloadError("Malformed child birth event.");
  }

  const parent = await OrganismIndexModel.findOne({
    organismPda: event.parentOrganismPda
  }).lean();

  if (!parent) {
    throw new ParentOrganismMissingError("Parent organism is not indexed yet.");
  }
  if (event.generation !== parent.generation + 1) {
    throw new WebhookPayloadError("Child generation does not match parent.");
  }

  return [...parent.ancestorNumbers, parent.organismNumber];
}

function validateDerivedAddresses(event: OrganismBornEvent, sporeProgramId: string) {
  if (
    event.organismPda === DEFAULT_PUBKEY ||
    event.sgtMint === DEFAULT_PUBKEY ||
    event.coreAsset === DEFAULT_PUBKEY
  ) {
    throw new WebhookPayloadError("OrganismBorn event contains a default identity.");
  }

  const programId = new PublicKey(sporeProgramId);
  const sgtMint = new PublicKey(event.sgtMint);
  const [expectedOrganismPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ORGANISM_SEED), sgtMint.toBuffer()],
    programId
  );
  const [expectedCoreAsset] = PublicKey.findProgramAddressSync(
    [Buffer.from(CORE_ASSET_SEED), sgtMint.toBuffer()],
    programId
  );

  if (
    event.organismPda !== expectedOrganismPda.toBase58() ||
    event.coreAsset !== expectedCoreAsset.toBase58()
  ) {
    throw new WebhookPayloadError("OrganismBorn event uses noncanonical addresses.");
  }
}

async function findExistingIndex(document: Omit<OrganismIndex, "_id">) {
  return OrganismIndexModel.findOne({
    $or: [
      { organismPda: document.organismPda },
      { organismNumber: document.organismNumber },
      { sgtMint: document.sgtMint },
      { coreAsset: document.coreAsset }
    ]
  }).lean();
}

function assertCanonicalMatch(
  existing: OrganismIndex,
  incoming: Omit<OrganismIndex, "_id">
) {
  const matches =
    existing.organismPda === incoming.organismPda &&
    existing.organismNumber === incoming.organismNumber &&
    existing.sgtMint === incoming.sgtMint &&
    existing.parentOrganismPda === incoming.parentOrganismPda &&
    existing.generation === incoming.generation &&
    existing.genome === incoming.genome &&
    existing.bornAt.getTime() === incoming.bornAt.getTime() &&
    existing.coreAsset === incoming.coreAsset &&
    existing.transactionSignature === incoming.transactionSignature &&
    arraysEqual(existing.ancestorNumbers, incoming.ancestorNumbers);

  if (!matches) {
    throw new OrganismIndexConflictError(incoming.organismPda);
  }
}

function readPubkey(data: Buffer, offset: number) {
  return new PublicKey(data.subarray(offset, offset + PUBLIC_KEY_BYTES)).toBase58();
}

function readU64String(data: Buffer, offset: number) {
  return data.readBigUInt64LE(offset).toString(10);
}

function readSolanaTimestamp(data: Buffer, offset: number) {
  const seconds = data.readBigInt64LE(offset);

  if (seconds < 0 || seconds > MAX_SAFE_SOLANA_TIMESTAMP) {
    throw new WebhookPayloadError("Invalid birth timestamp.");
  }

  return new Date(Number(seconds) * 1000);
}

function getObject(value: unknown, label: string): JsonObject {
  if (!isPlainObject(value)) {
    throw new WebhookPayloadError(`${label} must be an object.`);
  }

  return value;
}

function getStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new WebhookPayloadError(`${label} must be a string array.`);
  }

  return value;
}

function isPlainObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDuplicateKeyError(error: unknown) {
  return isPlainObject(error) && error.code === 11000;
}

function getSafeOutbreakErrorReason(error: unknown) {
  if (error instanceof Error) {
    return error.name || "Error";
  }

  return "Unknown";
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
