import { after } from "next/server";

import { normalizeAdminEmail, requestAdminCode } from "../../../../src/admin/auth";
import { readJsonObject, RequestBodyError } from "../../../../src/http/request";
import { rateLimit } from "../../../../src/http/rateLimit";
import { jsonError, jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    keyPrefix: "admin:request-code",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await readJsonObject(request, 1024);
    const email = normalizeAdminEmail(body.email);
    if (!email) return jsonError(400, "bad_request", "Enter a valid email address.");
    const deliver = await requestAdminCode(email);
    after(deliver);
    // Identical response for approved, unapproved, cooling down, or capped email.
    return jsonOk({ ok: true }, 202);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, "bad_request", "Invalid request.");
    }
    return jsonError(503, "verification_unavailable", "Admin sign-in is unavailable.");
  }
}

