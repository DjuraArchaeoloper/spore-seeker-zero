import { adminApiFetch, isSameOriginPost, noStoreHeaders, readAdminBody } from "../../../../lib/adminApi";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ error: "Invalid request." }, { status: 403, headers: noStoreHeaders });
  const body = await readAdminBody(request);
  if (!body || typeof body.email !== "string") {
    return Response.json({ error: "Enter a valid email address." }, { status: 400, headers: noStoreHeaders });
  }
  try {
    const response = await adminApiFetch("/api/admin/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email }),
    });
    if (response.status === 400) return Response.json({ error: "Enter a valid email address." }, { status: 400, headers: noStoreHeaders });
    if (response.status === 429) return Response.json({ error: "Please wait before trying again." }, { status: 429, headers: noStoreHeaders });
    if (!response.ok) throw new Error("Admin API unavailable.");
    return Response.json({ ok: true }, { status: 202, headers: noStoreHeaders });
  } catch {
    return Response.json({ error: "Admin sign-in is unavailable." }, { status: 503, headers: noStoreHeaders });
  }
}
