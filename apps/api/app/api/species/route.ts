import { connectToDatabase } from "../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../src/http/responses";
import { OrganismIndexModel } from "../../../src/models/OrganismIndex";
import {
  publicOrganismFilter,
  toPublicOrganism
} from "../../../src/organisms/responses";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDatabase();

    const [population, deepest, seekerZero] = await Promise.all([
      OrganismIndexModel.countDocuments(publicOrganismFilter),
      OrganismIndexModel.findOne(publicOrganismFilter).sort({ generation: -1 }).lean(),
      OrganismIndexModel.findOne({
        organismNumber: "0",
        ...publicOrganismFilter
      }).lean()
    ]);

    return jsonOk({
      population,
      deepestGeneration: deepest?.generation ?? 0,
      seekerZero: seekerZero ? toPublicOrganism(seekerZero, null) : null
    });
  } catch {
    return jsonError(503, "server_misconfigured", "Species statistics are unavailable.");
  }
}
