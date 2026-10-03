import { revokeAdminSession } from "../../../../src/admin/auth";
import { jsonError, jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await revokeAdminSession(request);
    return jsonOk({ ok: true });
  } catch {
    return jsonError(503, "verification_unavailable", "Admin logout is unavailable.");
  }
}
