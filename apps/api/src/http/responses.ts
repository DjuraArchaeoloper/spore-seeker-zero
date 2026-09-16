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
  | "outbreak_scoring_deferred";

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
