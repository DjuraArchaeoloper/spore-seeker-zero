import { connectToDatabase } from "../../../../../src/db/mongoose";
import { jsonError } from "../../../../../src/http/responses";
import { OrganismIndexModel } from "../../../../../src/models/OrganismIndex";
import { renderOrganismPng } from "../../../../../src/nft/organismImage";

export const runtime = "nodejs";

const DECIMAL_DIGITS = /^[0-9]+$/;
const MAX_U64_DECIMAL = "18446744073709551615";
const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "image/png"
};

type RouteContext = {
  params: Promise<{
    organismNumber: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organismNumber } = await context.params;
    const normalizedNumber = normalizeOrganismNumber(organismNumber);

    if (!normalizedNumber) {
      return jsonError(400, "bad_request", "Invalid organism number.");
    }

    await connectToDatabase();

    const organism = await OrganismIndexModel.findOne({
      organismNumber: normalizedNumber
    }).lean();

    if (!organism) {
      return jsonError(404, "not_found", "Organism not found.");
    }

    const image = await renderOrganismPng(organism.genome, {
      generation: organism.generation,
      organismNumber: organism.organismNumber
    });

    return new Response(new Uint8Array(image), {
      headers
    });
  } catch {
    return jsonError(503, "server_misconfigured", "NFT image lookup is unavailable.");
  }
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
