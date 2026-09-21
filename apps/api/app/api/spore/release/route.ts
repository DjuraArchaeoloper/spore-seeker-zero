import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonOk } from "../../../../src/http/responses";
import {
  handleSporeRouteError,
  isAuthenticatedSeeker,
  parseBase64UrlSecret,
  readSporeJsonBody,
  requireAuthenticatedSeeker,
  requireStringField
} from "../../../../src/spore/http";
import { releaseSpore } from "../../../../src/spore/releaseSpore";

export const runtime = "nodejs";

/**
 * POST /api/spore/release
 * Body: { secret: base64url(32 bytes) }
 * Identity comes only from the session.
 */
export async function POST(request: Request) {
  let secret: Uint8Array | null = null;

  try {
    await connectToDatabase();

    const seekerOrError = await requireAuthenticatedSeeker(request);

    if (!isAuthenticatedSeeker(seekerOrError)) {
      return seekerOrError;
    }

    const body = await readSporeJsonBody(request);
    secret = parseBase64UrlSecret(requireStringField(body, "secret"));

    const result = await releaseSpore({
      seeker: seekerOrError,
      secret
    });

    return jsonOk({
      organismNumber: result.organism.organismNumber,
      organismPda: result.organism.organismPda,
      activeSporeExpiresAt: result.activeSporeExpiresAt.toISOString()
    });
  } catch (error) {
    return handleSporeRouteError(error);
  } finally {
    secret?.fill(0);
  }
}
