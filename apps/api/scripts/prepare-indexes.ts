import type { Document } from "mongodb";
import mongoose from "mongoose";

import { connectToDatabase } from "../src/db/mongoose";

mongoose.set("autoIndex", false);

const ACTIVE_CLAIM_RESERVATION_STATUSES = [
  "reserved",
  "settling",
  "settled",
] as const;

type IndexKey = Record<string, 1 | -1>;

type IndexDescription = {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Document;
};

type CriticalIndex = {
  collectionName: string;
  key: IndexKey;
  options: {
    name: string;
    unique?: boolean;
    sparse?: boolean;
    expireAfterSeconds?: number;
    partialFilterExpression?: Document;
  };
};

const criticalIndexes: CriticalIndex[] = [
  {
    collectionName: "organism_indices",
    key: { organismPda: 1 },
    options: { name: "organismPda_1", unique: true },
  },
  {
    collectionName: "organism_indices",
    key: { organismNumber: 1 },
    options: { name: "organismNumber_1", unique: true },
  },
  {
    collectionName: "organism_indices",
    key: { sgtMint: 1 },
    options: { name: "sgtMint_1", unique: true },
  },
  {
    collectionName: "organism_indices",
    key: { coreAsset: 1 },
    options: { name: "coreAsset_1", unique: true, sparse: true },
  },
  {
    collectionName: "claim_reservations",
    key: { reservationId: 1 },
    options: { name: "reservationId_1", unique: true },
  },
  {
    collectionName: "claim_reservations",
    key: { parentOrganismPda: 1 },
    options: {
      name: "active_parent_claim_reservation_unique",
      unique: true,
      partialFilterExpression: {
        status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES] },
      },
    },
  },
  {
    collectionName: "claim_reservations",
    key: { recipientSgtMint: 1 },
    options: {
      name: "active_recipient_claim_reservation_unique",
      unique: true,
      partialFilterExpression: {
        status: { $in: [...ACTIVE_CLAIM_RESERVATION_STATUSES] },
      },
    },
  },
  {
    collectionName: "claim_reservations",
    key: { organismNumber: 1 },
    options: {
      name: "claim_reservation_organism_number_unique",
      unique: true,
      partialFilterExpression: {
        organismNumber: { $type: "string" },
      },
    },
  },
  {
    collectionName: "species_states",
    key: { key: 1 },
    options: { name: "key_1", unique: true },
  },
  {
    collectionName: "seeker_identities",
    key: { sgtMint: 1 },
    options: { name: "sgtMint_1", unique: true },
  },
  {
    collectionName: "outbreakseasons",
    key: { seasonId: 1 },
    options: { name: "seasonId_1", unique: true },
  },
  {
    collectionName: "sessions",
    key: { tokenHash: 1 },
    options: { name: "tokenHash_1", unique: true },
  },
  {
    collectionName: "sessions",
    key: { expiresAt: 1 },
    options: { name: "expiresAt_1", expireAfterSeconds: 0 },
  },
  {
    collectionName: "auth_nonces",
    key: { nonce: 1 },
    options: { name: "nonce_1", unique: true },
  },
  {
    collectionName: "auth_nonces",
    key: { expiresAt: 1 },
    options: { name: "expiresAt_1", expireAfterSeconds: 0 },
  },
  {
    collectionName: "admin_sessions",
    key: { tokenHash: 1 },
    options: { name: "tokenHash_1", unique: true },
  },
  {
    collectionName: "admin_sessions",
    key: { expiresAt: 1 },
    options: { name: "expiresAt_1", expireAfterSeconds: 0 },
  },
  {
    collectionName: "admin_otps",
    key: { purgeAt: 1 },
    options: { name: "purgeAt_1", expireAfterSeconds: 0 },
  },
  {
    collectionName: "payout_runs",
    key: { campaignId: 1, kind: 1 },
    options: { name: "payout_main_per_campaign", unique: true, partialFilterExpression: { kind: "main" } },
  },
  {
    collectionName: "skr_rewards",
    key: { campaignId: 1, payoutStatus: 1 },
    options: { name: "campaignId_1_payoutStatus_1" },
  },
  {
    collectionName: "payout_transactions",
    key: { campaignId: 1, status: 1, createdAt: 1 },
    options: { name: "campaignId_1_status_1_createdAt_1" },
  },
  {
    collectionName: "payout_transactions",
    key: { runId: 1 },
    options: { name: "runId_1" },
  },
  {
    collectionName: "payout_transactions",
    key: { signature: 1 },
    options: { name: "payout_signature_unique", unique: true, partialFilterExpression: { signature: { $type: "string" } } },
  },
];

async function main() {
  await connectToDatabase();

  for (const index of criticalIndexes) {
    await ensureCriticalIndex(index);
  }

  console.log("SPØR Mongo indexes are ready.");
}

async function ensureCriticalIndex(index: CriticalIndex) {
  const collection = mongoose.connection.collection(index.collectionName);
  let actualIndexes = await inspectIndexes(collection);

  if (!findEquivalentIndex(actualIndexes, index)) {
    await collection.createIndex(index.key, index.options);
    actualIndexes = await inspectIndexes(collection);
  }

  assertIndex(actualIndexes, index);
}

async function inspectIndexes(
  collection: mongoose.mongo.Collection,
): Promise<IndexDescription[]> {
  try {
    return (await collection.indexes()) as IndexDescription[];
  } catch (error) {
    if (isNamespaceNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

function isNamespaceNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    codeName?: unknown;
    message?: unknown;
  };

  return (
    candidate.code === 26 ||
    candidate.codeName === "NamespaceNotFound" ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("ns does not exist"))
  );
}

function assertIndex(
  actualIndexes: IndexDescription[],
  expected: CriticalIndex,
) {
  const actual = findEquivalentIndex(actualIndexes, expected);

  if (!actual) {
    throw new Error(
      `Missing Mongo index ${expected.collectionName}.${expected.options.name}.`,
    );
  }

  for (const key of ["unique", "sparse", "expireAfterSeconds"] as const) {
    if (
      expected.options[key] !== undefined &&
      actual[key] !== expected.options[key]
    ) {
      throw new Error(
        `Mongo index ${expected.collectionName}.${actual.name} has invalid ${key}.`,
      );
    }
  }

  if (
    expected.options.partialFilterExpression !== undefined &&
    stableJson(actual.partialFilterExpression) !==
      stableJson(expected.options.partialFilterExpression)
  ) {
    throw new Error(
      `Mongo index ${expected.collectionName}.${actual.name} has an invalid partial filter.`,
    );
  }
}

function findEquivalentIndex(
  actualIndexes: IndexDescription[],
  expected: CriticalIndex,
) {
  return actualIndexes.find(
    (index) =>
      stableJson(index.key) === stableJson(expected.key) &&
      matchesBooleanOption(index.unique, expected.options.unique) &&
      matchesBooleanOption(index.sparse, expected.options.sparse) &&
      matchesNumberOption(
        index.expireAfterSeconds,
        expected.options.expireAfterSeconds,
      ) &&
      stableJson(index.partialFilterExpression) ===
        stableJson(expected.options.partialFilterExpression),
  );
}

function matchesBooleanOption(actual: boolean | undefined, expected: boolean | undefined) {
  return expected === undefined ? actual !== true : actual === expected;
}

function matchesNumberOption(actual: number | undefined, expected: number | undefined) {
  return expected === undefined ? actual === undefined : actual === expected;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }

  return value;
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Mongo index preparation failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
