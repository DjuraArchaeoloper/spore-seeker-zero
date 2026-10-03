import { normalizeAdminEmail, verifyAdminCode } from "../../../../src/admin/auth";
import { readJsonObject, RequestBodyError } from "../../../../src/http/request";
import { rateLimit } from "../../../../src/http/rateLimit";
import { jsonError, jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    keyPrefix: "admin:verify-code",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await readJsonObject(request, 1024);
    const email = normalizeAdminEmail(body.email);
    const code = body.code;
    if (!email || typeof code !== "string" || !/^[0-9]{6}$/.test(code)) {
      return jsonError(400, "bad_request", "Invalid sign-in request.");
    }
    const result = await verifyAdminCode(email, code);
    if (!result) {
      return jsonError(401, "authentication_failed", "Code invalid or expired.");
    }
    return jsonOk({
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      admin: result.admin,
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, "bad_request", "Invalid request.");
    }
    return jsonError(503, "verification_unavailable", "Admin sign-in is unavailable.");
  }
}
