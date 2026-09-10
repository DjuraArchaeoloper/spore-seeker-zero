import { getAuthenticatedSeeker } from "../../../../src/auth/session";
import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { OrganismIndexModel } from "../../../../src/models/OrganismIndex";
import { toPublicOrganism } from "../../../../src/organisms/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const seeker = await getAuthenticatedSeeker(request);

    if (!seeker) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const organism = await OrganismIndexModel.findOne({
      sgtMint: seeker.sgtMint
    }).lean();

    if (!organism) {
      return jsonOk({
        organism: null
      });
    }

    const parent = organism.parentOrganismPda
      ? await OrganismIndexModel.findOne({
          organismPda: organism.parentOrganismPda
        }).lean()
      : null;

    return jsonOk({
      organism: toPublicOrganism(organism, parent)
    });
  } catch {
    return jsonError(503, "server_misconfigured", "Organism lookup is unavailable.");
  }
}
