type ErrorCode =
  | "bad_request"
  | "authentication_failed"
  | "unauthorized"
  | "not_seeker"
  | "not_found"
  | "indexing_deferred"
  | "integrity_conflict"
  | "verification_unavailable"
  | "server_misconfigured"
  | "outbreak_scoring_deferred"
  | "x_publish_failed"
  | "spore_not_ready"
  | "spore_offer_expired"
  | "active_spore_already_released"
  | "organism_already_exists"
  | "self_reproduction"
  | "claim_conflict"
  | "settlement_invalid"
  | "settlement_expired"
  | "settlement_not_ready"
  | "settlement_simulation_failed"
  | "finalization_conflict"
  | "species_not_ready";

export type { ErrorCode };

const headers = {
  "Cache-Control": "no-store"
};

export function jsonOk(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers
  });
}

export function jsonError(status: number, code: ErrorCode, message: string) {
  return Response.json(
    {
      error: {
        code,
        message
      }
    },
    {
      status,
      headers
    }
  );
}
