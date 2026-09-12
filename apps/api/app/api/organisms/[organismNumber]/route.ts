import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { OrganismIndexModel } from "../../../../src/models/OrganismIndex";
import { toPublicOrganism } from "../../../../src/organisms/responses";

export const runtime = "nodejs";

const DECIMAL_DIGITS = /^[0-9]+$/;
const MAX_U64_DECIMAL = "18446744073709551615";

type RouteContext = {
  params: Promise<{
    organismNumber: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await connectToDatabase();

    const { organismNumber } = await context.params;
    const normalizedNumber = normalizeOrganismNumber(organismNumber);

    if (!normalizedNumber) {
      return jsonError(400, "bad_request", "Invalid organism number.");
    }

    const organism = await OrganismIndexModel.findOne({
      organismNumber: normalizedNumber
    }).lean();

    if (!organism) {
      return jsonError(404, "not_found", "Organism not found.");
    }

    const ancestors = await loadAncestors(organism.ancestorNumbers);
    const parent = organism.parentOrganismPda
      ? ancestors.find((ancestor) => ancestor.organismPda === organism.parentOrganismPda) ?? null
      : null;
    const directChildren = await OrganismIndexModel.find({
      parentOrganismPda: organism.organismPda
    })
      .sort({ bornAt: 1 })
      .lean();
    const totalDescendants = await OrganismIndexModel.countDocuments({
      ancestorNumbers: organism.organismNumber
    });

    return jsonOk({
      organism: toPublicOrganism(organism, parent),
      ancestors: ancestors.map((ancestor, index) =>
        toPublicOrganism(ancestor, index === 0 ? null : ancestors[index - 1])
      ),
      directChildren: directChildren.map((child) => toPublicOrganism(child, organism)),
      totalDescendants
    });
  } catch {
    return jsonError(503, "server_misconfigured", "Organism lookup is unavailable.");
  }
}

async function loadAncestors(ancestorNumbers: string[]) {
  if (ancestorNumbers.length === 0) {
    return [];
  }

  const ancestors = await OrganismIndexModel.find({
    organismNumber: {
      $in: ancestorNumbers
    }
  }).lean();
  const byNumber = new Map(ancestors.map((ancestor) => [ancestor.organismNumber, ancestor]));

  return ancestorNumbers
    .map((organismNumber) => byNumber.get(organismNumber))
    .filter(isDefined);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function normalizeOrganismNumber(value: string) {
  if (!DECIMAL_DIGITS.test(value)) {
    return null;
  }

  const normalized = value.replace(/^0+/, "") || "0";

  if (
    normalized.length > MAX_U64_DECIMAL.length ||
    (normalized.length === MAX_U64_DECIMAL.length && normalized > MAX_U64_DECIMAL)
  ) {
    return null;
  }

  return normalized;
}
