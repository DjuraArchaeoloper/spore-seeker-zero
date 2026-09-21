import { getSporSocialSecret } from "../../../../../../src/env";
import { isBearerSecretAuthorized } from "../../../../../../src/http/bearerSecret";
import { RequestBodyError, readJsonObject } from "../../../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../../../src/http/responses";
import { PostTextError, parsePostText } from "../../../../../../src/social/postText";
import { logXPublishError, publishTextToX } from "../../../../../../src/social/xPublish";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const body = await readJsonObject(request, MAX_BODY_BYTES);
    const text = parsePostText(body.text);
    const result = await publishTextToX(text);

    return jsonOk({
      ok: true,
      id: result.id,
      text: result.text
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, "bad_request", error.message);
    }

    if (error instanceof PostTextError) {
      return jsonError(400, "bad_request", error.message);
    }

    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return jsonError(503, "server_misconfigured", "Social publishing is unavailable.");
    }

    logXPublishError(error);

    return jsonError(502, "x_publish_failed", "Unable to publish post.");
  }
}

function isAuthorized(request: Request) {
  return isBearerSecretAuthorized(request, getSporSocialSecret());
}
