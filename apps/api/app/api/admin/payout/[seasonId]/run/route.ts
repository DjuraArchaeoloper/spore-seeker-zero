import { adminRoute } from "../../../../../../src/admin/route";
import { getPayoutRun } from "../../../../../../src/admin/payout";
import { jsonOk } from "../../../../../../src/http/responses";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };
export function GET(request: Request, context: Context) {
  return adminRoute(request, async () => jsonOk({ run: await getPayoutRun((await context.params).seasonId) }));
}
