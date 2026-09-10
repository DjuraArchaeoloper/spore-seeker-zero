import { getAuthenticatedSeeker } from "../../../../src/auth/session";
import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const seeker = await getAuthenticatedSeeker(request);

    if (!seeker) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    return jsonOk(seeker);
  } catch {
    return jsonError(503, "server_misconfigured", "Authentication is unavailable.");
  }
}
