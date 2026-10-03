import { adminRoute } from "../../../../../../src/admin/route";
import { getCampaignDetail } from "../../../../../../src/admin/dashboard";
import { jsonOk } from "../../../../../../src/http/responses";
import { cancelCampaign } from "../../../../../../src/outbreak/campaigns";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };

export function POST(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { seasonId } = await context.params;
    await cancelCampaign(seasonId, true);
    return jsonOk({ campaign: await getCampaignDetail(seasonId) });
  });
}
