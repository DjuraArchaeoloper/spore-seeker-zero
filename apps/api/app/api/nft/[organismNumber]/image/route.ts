import { connectToDatabase } from "../../../../../src/db/mongoose";
import { jsonError } from "../../../../../src/http/responses";
import { OrganismIndexModel } from "../../../../../src/models/OrganismIndex";

export const runtime = "nodejs";

const DECIMAL_DIGITS = /^[0-9]+$/;
const MAX_U64_DECIMAL = "18446744073709551615";
const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "image/svg+xml; charset=utf-8"
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

    return new Response(renderSvg(organism), {
      headers
    });
  } catch {
    return jsonError(503, "server_misconfigured", "NFT image lookup is unavailable.");
  }
}

function renderSvg(organism: {
  organismNumber: string;
  generation: number;
  genome: string;
}) {
  const genome = organism.genome.match(/.{1,8}/g)?.join(" ") ?? organism.genome;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" role="img">
  <rect width="1200" height="1200" fill="#05070a"/>
  <rect x="72" y="72" width="1056" height="1056" fill="none" stroke="#253041" stroke-width="2"/>
  <text x="120" y="180" fill="#eef4ff" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="48" letter-spacing="4">SPØR: SEEKER ZERO</text>
  <text x="120" y="500" fill="#aeb8c8" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="34">ORGANISM NUMBER ${escapeXml(organism.organismNumber)}</text>
  <text x="120" y="585" fill="#aeb8c8" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="34">GENERATION ${escapeXml(String(organism.generation))}</text>
  <text x="120" y="670" fill="#aeb8c8" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="34">GENOME ${escapeXml(genome)}</text>
</svg>`;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
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
