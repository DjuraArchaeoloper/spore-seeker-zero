import { adminRoute } from "../../../../../../src/admin/route";
import { reconcilePayout } from "../../../../../../src/admin/payout";
import { jsonOk } from "../../../../../../src/http/responses";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };
export function POST(request: Request, context: Context) {
  return adminRoute(request, async () => jsonOk({ run: await reconcilePayout((await context.params).seasonId) }));
}
