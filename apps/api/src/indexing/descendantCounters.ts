import mongoose from "mongoose";

import { OrganismDescendantCounterModel } from "../models/OrganismDescendantCounter";
import {
  OrganismDescendantCountEventModel,
  type OrganismDescendantCountEvent
} from "../models/OrganismDescendantCountEvent";
import type { OrganismIndex } from "../models/OrganismIndex";
import { getBirthReference, toOrganismNumberSortKey } from "../organisms/identifiers";

type IndexedBirth = Pick<
  OrganismIndex,
  "organismNumber" | "transactionSignature" | "ancestorNumbers"
>;

export type DescendantCounterStatus = "counted" | "existing" | "skipped";

export class DescendantCounterConflictError extends Error {
  constructor(readonly childOrganismNumber: string) {
    super("Descendant counter event conflict.");
  }
}

export async function ensureDescendantCountersForBirth(
  indexedBirth: IndexedBirth
): Promise<DescendantCounterStatus> {
  const ancestorNumbers = [...new Set(indexedBirth.ancestorNumbers)];

  if (ancestorNumbers.length === 0) {
    return "skipped";
  }

  const birthReference = getBirthReference(
    indexedBirth.organismNumber,
    indexedBirth.transactionSignature
  );
  const session = await mongoose.startSession();
  let status: DescendantCounterStatus = "skipped";

  try {
    await session.withTransaction(async () => {
      const existing = await OrganismDescendantCountEventModel.findOne({
        childOrganismNumber: indexedBirth.organismNumber
      })
        .session(session)
        .lean();

      if (existing) {
        assertEventMatches(existing, indexedBirth, ancestorNumbers, birthReference);
        status = "existing";
        return;
      }

      const now = new Date();

      await OrganismDescendantCountEventModel.create(
        [
          {
            childOrganismNumber: indexedBirth.organismNumber,
            birthReference,
            transactionSignature: indexedBirth.transactionSignature,
            ancestorNumbers,
            createdAt: now
          }
        ],
        { session }
      );

      await OrganismDescendantCounterModel.bulkWrite(
        ancestorNumbers.map((ancestorNumber) => ({
          updateOne: {
            filter: {
              organismNumber: ancestorNumber
            },
            update: {
              $inc: {
                totalDescendants: 1
              },
              $set: {
                updatedAt: now
              },
              $setOnInsert: {
                organismNumber: ancestorNumber,
                organismNumberSortKey: toOrganismNumberSortKey(ancestorNumber),
                createdAt: now
              }
            },
            upsert: true
          }
        })),
        {
          ordered: false,
          session
        }
      );

      status = "counted";
    });

    return status;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await OrganismDescendantCountEventModel.findOne({
        childOrganismNumber: indexedBirth.organismNumber
      }).lean();

      if (existing) {
        assertEventMatches(existing, indexedBirth, ancestorNumbers, birthReference);
        return "existing";
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

function assertEventMatches(
  existing: OrganismDescendantCountEvent,
  indexedBirth: IndexedBirth,
  ancestorNumbers: string[],
  birthReference: string
) {
  const matches =
    existing.childOrganismNumber === indexedBirth.organismNumber &&
    existing.birthReference === birthReference &&
    existing.transactionSignature === indexedBirth.transactionSignature &&
    arraysEqual(existing.ancestorNumbers, ancestorNumbers);

  if (!matches) {
    throw new DescendantCounterConflictError(indexedBirth.organismNumber);
  }
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
