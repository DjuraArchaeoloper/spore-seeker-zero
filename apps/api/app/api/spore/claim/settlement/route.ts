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
import { buildClaimSettlementTransaction } from "../../../../../src/spore/settlement";

export const runtime = "nodejs";

/**
 * POST /api/spore/claim/settlement
 * Body: { reservationId }
 * Returns a partially signed legacy transaction (base64) for the recipient wallet.
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

    const result = await buildClaimSettlementTransaction({
      seeker: seekerOrError,
      reservationId
    });

    return jsonOk({
      reservationId: result.reservation.reservationId,
      status: result.reservation.status,
      transaction: result.transactionBase64,
      encoding: "base64",
      lastValidBlockHeight: result.lastValidBlockHeight,
      birthFeeLamports: result.birthFeeLamports
    });
  } catch (error) {
    return handleSporeRouteError(error);
  }
}
