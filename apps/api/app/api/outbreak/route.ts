import { getAuthenticatedSeeker } from "../../../src/auth/session";
import { connectToDatabase } from "../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../src/http/responses";
import {
  getOutbreakStateForSeeker,
  OutbreakConfigurationError
} from "../../../src/outbreak/read";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const seeker = await getAuthenticatedSeeker(request);

    if (!seeker) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const outbreak = await getOutbreakStateForSeeker({
      sgtMint: seeker.sgtMint
    });

    return jsonOk(outbreak);
  } catch (error) {
    if (error instanceof OutbreakConfigurationError) {
      console.error("SPORE outbreak configuration conflict");
    }

    return jsonError(503, "server_misconfigured", "Outbreak is unavailable.");
  }
}
