import { adminRoute } from "../../../../src/admin/route";
import { parseCampaignForm } from "../../../../src/admin/campaignInput";
import { campaignView, listCampaignViews } from "../../../../src/admin/dashboard";
import { readJsonObject } from "../../../../src/http/request";
import { jsonOk } from "../../../../src/http/responses";
import { createCampaign } from "../../../../src/outbreak/campaigns";

export const runtime = "nodejs";

export function GET(request: Request) {
  return adminRoute(request, async () => jsonOk({ campaigns: await listCampaignViews() }));
}

export function POST(request: Request) {
  return adminRoute(request, async () => {
    const input = parseCampaignForm(await readJsonObject(request, 4096));
    const result = await createCampaign(input);
    return jsonOk({ campaign: campaignView(result!.campaign, result!.lifecycle) }, 201);
  });
}
