import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError } from "../../../../src/http/responses";
import { OrganismIndexModel } from "../../../../src/models/OrganismIndex";

export const runtime = "nodejs";

const DECIMAL_DIGITS = /^[0-9]+$/;
const MAX_U64_DECIMAL = "18446744073709551615";
const headers = {
  "Cache-Control": "no-store"
};

type RouteContext = {
  params: Promise<{
    organismNumber: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
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

    const origin = new URL(request.url).origin;
    const paddedNumber = organism.organismNumber.padStart(6, "0");
    const image = `${origin}/api/nft/${organism.organismNumber}/image`;

    return Response.json(
      {
        name: `SPØR #${paddedNumber}`,
        description:
          organism.organismNumber === "0"
            ? "Seeker Zero \u2014 The first Seekerborne case."
            : "Seekerborne \u2014 Descendant of Seeker Zero.",
        image,
        attributes: [
          {
            trait_type: "Generation",
            value: organism.generation
          },
          {
            trait_type: "Organism Number",
            value: organism.organismNumber
          },
          {
            trait_type: "Genome",
            value: organism.genome
          },
          {
            trait_type: "SGT Mint",
            value: organism.sgtMint
          }
        ],
        properties: {
          category: "image",
          files: [
            {
              type: "image/png",
              uri: image
            }
          ]
        }
      },
      {
        headers
      }
    );
  } catch {
    return jsonError(503, "server_misconfigured", "NFT metadata lookup is unavailable.");
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
