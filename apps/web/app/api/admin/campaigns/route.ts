import { proxyAdminRequest } from "../../../../lib/adminApi";

export const runtime = "nodejs";
export const GET = (request: Request) => proxyAdminRequest(request, "/api/admin/campaigns", "GET");
export const POST = (request: Request) => proxyAdminRequest(request, "/api/admin/campaigns", "POST");
