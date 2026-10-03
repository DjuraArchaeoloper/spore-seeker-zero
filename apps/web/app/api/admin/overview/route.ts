import { proxyAdminRequest } from "../../../../lib/adminApi";

export const runtime = "nodejs";
export const GET = (request: Request) => proxyAdminRequest(request, "/api/admin/overview", "GET");
