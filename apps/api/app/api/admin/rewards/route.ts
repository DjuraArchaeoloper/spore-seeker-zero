import { adminRoute } from "../../../../src/admin/route";
import { listRewardLedger } from "../../../../src/admin/dashboard";
import { jsonError, jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export function GET(request: Request) {
  return adminRoute(request, async () => {
    try {
      return jsonOk({ ledger: await listRewardLedger(new URL(request.url).searchParams) });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid ")) {
        return jsonError(400, "bad_request", error.message);
      }
      throw error;
    }
  });
}
