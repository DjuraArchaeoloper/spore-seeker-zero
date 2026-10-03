import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, adminApiFetch, isSameOriginPost, noStoreHeaders } from "../../../../lib/adminApi";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ error: "Invalid request." }, { status: 403, headers: noStoreHeaders });
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return Response.json({ ok: true }, { headers: noStoreHeaders });
  try {
    const response = await adminApiFetch("/api/admin/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Admin API unavailable.");
    jar.delete(ADMIN_COOKIE_NAME);
    return Response.json({ ok: true }, { headers: noStoreHeaders });
  } catch {
    return Response.json({ error: "Could not end the session." }, { status: 503, headers: noStoreHeaders });
  }
}
