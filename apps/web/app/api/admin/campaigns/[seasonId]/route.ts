import { proxyAdminRequest } from "../../../../../lib/adminApi";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };
export async function GET(request: Request, context: Context) {
  const { seasonId } = await context.params;
  return proxyAdminRequest(request, `/api/admin/campaigns/${encodeURIComponent(seasonId)}`, "GET");
}
export async function PATCH(request: Request, context: Context) {
  const { seasonId } = await context.params;
  return proxyAdminRequest(request, `/api/admin/campaigns/${encodeURIComponent(seasonId)}`, "PATCH");
}
