import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, adminApiFetch, adminCookieOptions, isSameOriginPost, noStoreHeaders, readAdminBody } from "../../../../lib/adminApi";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ error: "Invalid request." }, { status: 403, headers: noStoreHeaders });
  const body = await readAdminBody(request);
  if (!body || typeof body.email !== "string" || typeof body.code !== "string") {
    return Response.json({ error: "Invalid sign-in request." }, { status: 400, headers: noStoreHeaders });
  }
  try {
    const response = await adminApiFetch("/api/admin/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, code: body.code }),
    });
    if (response.status === 400) return Response.json({ error: "Invalid sign-in request." }, { status: 400, headers: noStoreHeaders });
    if (response.status === 401) return Response.json({ error: "Code invalid or expired." }, { status: 401, headers: noStoreHeaders });
    if (response.status === 429) return Response.json({ error: "Please wait before trying again." }, { status: 429, headers: noStoreHeaders });
    if (!response.ok) throw new Error("Admin API unavailable.");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("token" in result) || !("expiresAt" in result)) {
      throw new Error("Invalid admin session response.");
    }
    const { token, expiresAt } = result;
    const expiry = new Date(String(expiresAt));
    if (
      typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
      !Number.isFinite(expiry.getTime()) || expiry <= new Date() ||
      expiry.getTime() > Date.now() + 12 * 60 * 60 * 1000 + 60_000
    ) throw new Error("Invalid admin session response.");
    (await cookies()).set(ADMIN_COOKIE_NAME, token, adminCookieOptions(expiry));
    return Response.json({ ok: true }, { headers: noStoreHeaders });
  } catch {
    return Response.json({ error: "Admin sign-in is unavailable." }, { status: 503, headers: noStoreHeaders });
  }
}
