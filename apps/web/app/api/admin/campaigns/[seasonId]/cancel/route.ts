import { proxyAdminRequest } from "../../../../../../lib/adminApi";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };
export async function POST(request: Request, context: Context) {
  const { seasonId } = await context.params;
  return proxyAdminRequest(request, `/api/admin/campaigns/${encodeURIComponent(seasonId)}/cancel`, "POST");
}
