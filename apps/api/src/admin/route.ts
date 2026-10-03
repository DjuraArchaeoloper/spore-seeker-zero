import { AdminUnauthorizedError, requireAdminSession } from "./auth";
import { CampaignConfigurationError } from "../outbreak/campaigns";
import { RequestBodyError } from "../http/request";
import { PayoutError } from "./payout";
import { jsonError } from "../http/responses";

export async function adminRoute(request: Request, action: () => Promise<Response>) {
  try {
    await requireAdminSession(request);
    return await action();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return jsonError(401, "unauthorized", "Unauthorized.");
    if (error instanceof RequestBodyError) return jsonError(error.status, "bad_request", error.message);
    if (error instanceof PayoutError) {
      const code = error.status === 404 ? "not_found" : error.status >= 500 ? "server_misconfigured" : "bad_request";
      return jsonError(error.status, code, error.message);
    }
    if (error instanceof CampaignConfigurationError) {
      const conflict = /overlap|already|started|cancelled|Only a scheduled|missing, ended/i.test(error.message);
      return jsonError(conflict ? 409 : 400, "bad_request", error.message);
    }
    return jsonError(503, "server_misconfigured", "Admin data is unavailable.");
  }
}
