import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { OrganismDescendantCounterModel } from "../../../../src/models/OrganismDescendantCounter";
import { OrganismIndexModel } from "../../../../src/models/OrganismIndex";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
    const counters = await OrganismDescendantCounterModel.find({
      totalDescendants: {
        $gt: 0
      }
    })
      .sort({
        totalDescendants: -1,
        organismNumberSortKey: 1
      })
      .limit(limit)
      .lean();
    const organismNumbers = counters.map((counter) => counter.organismNumber);
    const organisms = await OrganismIndexModel.find({
      organismNumber: {
        $in: organismNumbers
      }
    })
      .select({
        organismNumber: 1,
        generation: 1
      })
      .lean();
    const organismsByNumber = new Map(
      organisms.map((organism) => [organism.organismNumber, organism])
    );

    return jsonOk({
      limit,
      leaders: counters
        .map((counter) => {
          const organism = organismsByNumber.get(counter.organismNumber);

          if (!organism) {
            return null;
          }

          return {
            organismNumber: counter.organismNumber,
            generation: organism.generation,
            totalDescendants: counter.totalDescendants
          };
        })
        .filter(isDefined)
    });
  } catch {
    return jsonError(503, "server_misconfigured", "Species leaderboard is unavailable.");
  }
}

function parseLimit(value: string | null) {
  if (value === null) {
    return DEFAULT_LIMIT;
  }

  if (!/^[0-9]+$/.test(value)) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
