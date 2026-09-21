import { getAuthenticatedSeeker } from "../../../../src/auth/session";
import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { OrganismIndexModel } from "../../../../src/models/OrganismIndex";
import {
  publicOrganismFilter,
  toPublicOrganism
} from "../../../../src/organisms/responses";
import { ensureReproductionFields } from "../../../../src/spore/organismState";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const seeker = await getAuthenticatedSeeker(request);

    if (!seeker) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const organism = await OrganismIndexModel.findOne({
      sgtMint: seeker.sgtMint,
      ...publicOrganismFilter
    }).lean();

    if (!organism) {
      return jsonOk({
        organism: null
      });
    }

    const normalized = await ensureReproductionFields(organism);

    const parent = normalized.parentOrganismPda
      ? await OrganismIndexModel.findOne({
          organismPda: normalized.parentOrganismPda,
          ...publicOrganismFilter
        }).lean()
      : null;

    // Owner-private reproduction fields for active QR / cooldown UX.
    // Commitment is never a plaintext secret.
    return jsonOk({
      organism: {
        ...toPublicOrganism(normalized, parent),
        nextSporeAt: normalized.nextSporeAt.toISOString(),
        activeSporeCommitment: normalized.activeSporeCommitment,
        activeSporeExpiresAt: normalized.activeSporeExpiresAt.toISOString()
      }
    });
  } catch {
    return jsonError(503, "server_misconfigured", "Organism lookup is unavailable.");
  }
}
