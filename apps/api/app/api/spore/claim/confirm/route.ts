import { connectToDatabase } from "../../../../../src/db/mongoose";
import { jsonOk } from "../../../../../src/http/responses";
import { toPublicOrganism } from "../../../../../src/organisms/responses";
import {
  handleSporeRouteError,
  isAuthenticatedSeeker,
  parseReservationId,
  parseTransactionSignature,
  readSporeJsonBody,
  requireAuthenticatedSeeker,
  requireStringField
} from "../../../../../src/spore/http";
import { confirmAndFinalizeClaim } from "../../../../../src/spore/claimSettlement";

export const runtime = "nodejs";

/**
 * POST /api/spore/claim/confirm
 * Body: { reservationId, transactionSignature }
 * Server independently verifies the tx and finalizes the birth.
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const seekerOrError = await requireAuthenticatedSeeker(request);

    if (!isAuthenticatedSeeker(seekerOrError)) {
      return seekerOrError;
    }

    const body = await readSporeJsonBody(request, 8192);
    const reservationId = parseReservationId(
      requireStringField(body, "reservationId")
    );
    const transactionSignature = parseTransactionSignature(
      requireStringField(body, "transactionSignature")
    );

    const result = await confirmAndFinalizeClaim({
      seeker: seekerOrError,
      reservationId,
      transactionSignature
    });

    return jsonOk({
      reservationId: result.reservation.reservationId,
      status: result.reservation.status,
      organism: toPublicOrganism(result.organism, null)
    });
  } catch (error) {
    return handleSporeRouteError(error);
  }
}
