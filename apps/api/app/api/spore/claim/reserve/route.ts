import { connectToDatabase } from "../../../../../src/db/mongoose";
import { jsonOk } from "../../../../../src/http/responses";
import { toPublicOrganism } from "../../../../../src/organisms/responses";
import {
  handleSporeRouteError,
  isAuthenticatedSeeker,
  parseBase64UrlSecret,
  parseParentOrganismPda,
  readSporeJsonBody,
  requireAuthenticatedSeeker,
  requireStringField
} from "../../../../../src/spore/http";
import { prepareClaimSpore } from "../../../../../src/spore/prepareClaim";

export const runtime = "nodejs";

/**
 * POST /api/spore/claim/reserve
 * Body: { parentOrganismPda, secret }
 * Identity comes only from the session.
 * Resumes an existing active reservation for the same parent/offer/SGT.
 * If the claim is already settled/finalized, returns the organism for recovery.
 */
export async function POST(request: Request) {
  let secret: Uint8Array | null = null;

  try {
    await connectToDatabase();

    const seekerOrError = await requireAuthenticatedSeeker(request);

    if (!isAuthenticatedSeeker(seekerOrError)) {
      return seekerOrError;
    }

    const body = await readSporeJsonBody(request);
    const parentOrganismPda = parseParentOrganismPda(
      requireStringField(body, "parentOrganismPda")
    );
    secret = parseBase64UrlSecret(requireStringField(body, "secret"));

    const result = await prepareClaimSpore({
      seeker: seekerOrError,
      parentOrganismPda,
      secret
    });

    if (result.organism) {
      return jsonOk({
        reservationId: result.reservation.reservationId,
        status: result.reservation.status,
        parentOrganismPda: result.reservation.parentOrganismPda,
        parentOrganismNumber: result.parent.organismNumber,
        birthFeeLamports: result.birthFeeLamports,
        preparedAt: result.reservation.preparedAt.toISOString(),
        transactionSignature: result.reservation.settlementSignature,
        organism: toPublicOrganism(result.organism, null)
      });
    }

    return jsonOk({
      reservationId: result.reservation.reservationId,
      status: result.reservation.status,
      parentOrganismPda: result.reservation.parentOrganismPda,
      parentOrganismNumber: result.parent.organismNumber,
      birthFeeLamports: result.birthFeeLamports,
      preparedAt: result.reservation.preparedAt.toISOString()
    });
  } catch (error) {
    return handleSporeRouteError(error);
  } finally {
    secret?.fill(0);
  }
}
