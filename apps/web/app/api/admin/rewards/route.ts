import { proxyAdminRequest } from "../../../../lib/adminApi";

export const runtime = "nodejs";
export function GET(request: Request) {
  const source = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["campaignId", "status", "role", "page"]) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return proxyAdminRequest(request, `/api/admin/rewards${suffix}`, "GET");
}
