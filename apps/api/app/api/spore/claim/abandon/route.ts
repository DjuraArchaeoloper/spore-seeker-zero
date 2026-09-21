import { connectToDatabase } from "../../../../../src/db/mongoose";
import { jsonOk } from "../../../../../src/http/responses";
import {
  handleSporeRouteError,
  isAuthenticatedSeeker,
  parseReservationId,
  readSporeJsonBody,
  requireAuthenticatedSeeker,
  requireStringField
} from "../../../../../src/spore/http";
import { abandonPreparedClaim } from "../../../../../src/spore/prepareClaim";

export const runtime = "nodejs";

/**
 * POST /api/spore/claim/abandon
 * Body: { reservationId }
 * Only valid before settlement is confirmed.
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const seekerOrError = await requireAuthenticatedSeeker(request);

    if (!isAuthenticatedSeeker(seekerOrError)) {
      return seekerOrError;
    }

    const body = await readSporeJsonBody(request);
    const reservationId = parseReservationId(
      requireStringField(body, "reservationId")
    );

    const reservation = await abandonPreparedClaim({
      seeker: seekerOrError,
      reservationId
    });

    return jsonOk({
      reservationId: reservation.reservationId,
      status: reservation.status
    });
  } catch (error) {
    return handleSporeRouteError(error);
  }
}
