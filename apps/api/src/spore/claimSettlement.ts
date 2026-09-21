import type { AuthenticatedSeeker } from "../auth/session";
import type { ClaimReservation } from "../models/ClaimReservation";
import type { OrganismIndex } from "../models/OrganismIndex";
import { finalizeClaimBirth } from "./finalizeBirth";
import {
  buildClaimSettlementTransaction,
  confirmClaimSettlement,
  type SettlementTransactionResult
} from "./settlement";

export {
  buildClaimSettlementTransaction,
  confirmClaimSettlement
} from "./settlement";
export { finalizeClaimBirth } from "./finalizeBirth";

/**
 * Verify settlement then finalize Core + Mongo.
 * Safe to retry: settled allocation is sticky; Core/Mongo finalization is idempotent.
 */
export async function confirmAndFinalizeClaim(input: {
  seeker: AuthenticatedSeeker;
  reservationId: string;
  transactionSignature: string;
}): Promise<{
  reservation: ClaimReservation;
  organism: OrganismIndex;
}> {
  const reservation = await confirmClaimSettlement(input);
  const organism = await finalizeClaimBirth({
    reservationId: reservation.reservationId
  });

  return { reservation, organism };
}

export type { SettlementTransactionResult };
