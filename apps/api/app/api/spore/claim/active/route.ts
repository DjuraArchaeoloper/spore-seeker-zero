import { connectToDatabase } from "../../../../../src/db/mongoose";
import { jsonOk } from "../../../../../src/http/responses";
import { toPublicOrganism } from "../../../../../src/organisms/responses";
import { resolveActiveClaimForRecipient } from "../../../../../src/spore/activeClaim";
import {
  handleSporeRouteError,
  isAuthenticatedSeeker,
  requireAuthenticatedSeeker
} from "../../../../../src/spore/http";

export const runtime = "nodejs";

/**
 * GET /api/spore/claim/active
 * Discover the signed-in recipient's active claim without the QR spore secret.
 * Returns null when none exists; otherwise resumes settlement recovery or the organism.
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const seekerOrError = await requireAuthenticatedSeeker(request);

    if (!isAuthenticatedSeeker(seekerOrError)) {
      return seekerOrError;
    }

    const result = await resolveActiveClaimForRecipient(seekerOrError);

    if (result.kind === "none") {
      return jsonOk({ activeClaim: null });
    }

    if (result.kind === "organism") {
      return jsonOk({
        activeClaim: {
          reservationId: result.reservation.reservationId,
          status: result.reservation.status,
          parentOrganismPda: result.reservation.parentOrganismPda,
          transactionSignature: result.reservation.settlementSignature,
          organism: toPublicOrganism(result.organism, null)
        }
      });
    }

    return jsonOk({
      activeClaim: {
        reservationId: result.settlement.reservation.reservationId,
        status: result.settlement.reservation.status,
        parentOrganismPda: result.settlement.reservation.parentOrganismPda,
        birthFeeLamports: result.settlement.birthFeeLamports,
        transaction: result.settlement.transactionBase64,
        encoding: "base64" as const,
        lastValidBlockHeight: result.settlement.lastValidBlockHeight
      }
    });
  } catch (error) {
    return handleSporeRouteError(error);
  }
}
