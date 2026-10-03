import { adminRoute } from "../../../../src/admin/route";
import { getOverview } from "../../../../src/admin/dashboard";
import { jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export function GET(request: Request) {
  return adminRoute(request, async () => jsonOk({ overview: await getOverview() }));
}
