import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "spore_admin_session";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function adminApiFetch(path: string, init: RequestInit = {}) {
  const configured = process.env.ADMIN_API_ORIGIN?.trim();
  if (!configured) throw new Error("ADMIN_API_ORIGIN is missing.");
  const origin = new URL(configured);
  const localHttp =
    process.env.NODE_ENV !== "production" &&
    origin.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(origin.hostname);
  if (
    (origin.protocol !== "https:" && !localHttp) ||
    origin.username || origin.password || origin.pathname !== "/" ||
    origin.search || origin.hash ||
    !/^\/api\/admin\/[a-z0-9_/-]+(?:\?[A-Za-z0-9_=&%+.-]*)?$/.test(path) || path.includes("..")
  ) throw new Error("ADMIN_API_ORIGIN is invalid.");

  return fetch(new URL(path, origin), {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(path.includes("/payout/") ? 60_000 : 15_000),
  });
}

export async function getCurrentAdmin(): Promise<{ email: string } | null> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  try {
    const response = await adminApiFetch("/api/admin/session", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("admin" in body)) return null;
    const admin = body.admin;
    if (!admin || typeof admin !== "object" || !("email" in admin)) return null;
    return typeof admin.email === "string" ? { email: admin.email } : null;
  } catch {
    return null;
  }
}

export function isSameOriginPost(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export async function readAdminBody(request: Request, maxBytes = 1024): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return null;
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) return null;
    chunks.push(value);
  }
  try {
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    const body: unknown = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function adminCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };
}

export const noStoreHeaders = { "Cache-Control": "no-store" };

/** Browser-facing admin routes only forward the HttpOnly cookie server-side. */
export async function proxyAdminRequest(request: Request, path: string, method: "GET" | "POST" | "PATCH") {
  if (method !== "GET" && !isSameOriginPost(request)) {
    return Response.json({ error: "Invalid request." }, { status: 403, headers: noStoreHeaders });
  }
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers: noStoreHeaders });
  }
  let body: Record<string, unknown> | null = null;
  if (method === "PATCH" || (method === "POST" && !path.endsWith("/cancel"))) {
    body = await readAdminBody(request, 4096);
    if (!body) return Response.json({ error: "Invalid request." }, { status: 400, headers: noStoreHeaders });
  }
  try {
    const upstream = await adminApiFetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...noStoreHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Admin API unavailable." }, { status: 503, headers: noStoreHeaders });
  }
}
