import { revokeSession } from "../../../../src/auth/session";
import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    await revokeSession(request);
  } catch {
    return jsonError(503, "server_misconfigured", "Logout is unavailable.");
  }

  return jsonOk({
    ok: true
  });
}
