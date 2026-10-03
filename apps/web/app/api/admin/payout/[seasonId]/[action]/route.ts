import { proxyAdminRequest, noStoreHeaders } from "../../../../../../lib/adminApi";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string; action: string }> };

async function forward(request: Request, context: Context, method: "GET" | "POST") {
  const { seasonId, action } = await context.params;
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(seasonId) ||
    !(method === "GET" ? ["preview", "run"] : ["prepare", "retry", "reconcile", "submit"]).includes(action)) {
    return Response.json({ error: "Invalid payout route." }, { status: 404, headers: noStoreHeaders });
  }
  return proxyAdminRequest(request, `/api/admin/payout/${seasonId}/${action}`, method);
}

export function GET(request: Request, context: Context) { return forward(request, context, "GET"); }
export function POST(request: Request, context: Context) { return forward(request, context, "POST"); }
