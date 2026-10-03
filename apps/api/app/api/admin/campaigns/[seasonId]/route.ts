import { adminRoute } from "../../../../../src/admin/route";
import { parseCampaignForm } from "../../../../../src/admin/campaignInput";
import { getCampaignDetail } from "../../../../../src/admin/dashboard";
import { readJsonObject } from "../../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../../src/http/responses";
import { editScheduledCampaign } from "../../../../../src/outbreak/campaigns";

export const runtime = "nodejs";
type Context = { params: Promise<{ seasonId: string }> };

export function GET(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { seasonId } = await context.params;
    const campaign = await getCampaignDetail(seasonId);
    return campaign ? jsonOk({ campaign }) : jsonError(404, "not_found", "Campaign not found.");
  });
}

export function PATCH(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { seasonId } = await context.params;
    const input = parseCampaignForm(await readJsonObject(request, 4096), seasonId);
    await editScheduledCampaign(seasonId, input);
    return jsonOk({ campaign: await getCampaignDetail(seasonId) });
  });
}
