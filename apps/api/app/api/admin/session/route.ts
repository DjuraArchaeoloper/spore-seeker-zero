import { AdminUnauthorizedError, requireAdminSession } from "../../../../src/admin/auth";
import { jsonError, jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return jsonOk({ admin: await requireAdminSession(request) });
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }
    return jsonError(503, "verification_unavailable", "Admin session is unavailable.");
  }
}
