import { adminRoute } from "../../../../../../src/admin/route";
import { previewPayout } from "../../../../../../src/admin/payout";
import { jsonOk } from "../../../../../../src/http/responses";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };
export function GET(request: Request, context: Context) {
  return adminRoute(request, async () => jsonOk({ preview: await previewPayout((await context.params).seasonId) }));
}
