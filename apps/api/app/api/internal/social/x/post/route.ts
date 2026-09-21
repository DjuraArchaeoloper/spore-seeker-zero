import crypto from "crypto";

import { getSporSocialSecret } from "../../../../../../src/env";
import { RequestBodyError, readJsonObject } from "../../../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../../../src/http/responses";
import { createXClient } from "../../../../../../src/social/x";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024;
const MAX_POST_TEXT_LENGTH = 280;

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const body = await readJsonObject(request, MAX_BODY_BYTES);
    const text = parsePostText(body.text);
    const client = createXClient();
    const result = await client.v2.tweet(text);

    return jsonOk({
      ok: true,
      id: result.data.id,
      text: result.data.text
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

    console.error("SPØR internal X post failed");

    return jsonError(502, "server_misconfigured", "Unable to publish post.");
  }
}

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return false;
  }

  const expected = getSporSocialSecret();
  const actualBytes = Buffer.from(token, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");

  return (
    actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes)
  );
}

function parsePostText(value: unknown) {
  if (typeof value !== "string") {
    throw new PostTextError("text must be a string.");
  }

  const text = value.trim();

  if (!text) {
    throw new PostTextError("text is required.");
  }

  if (text.length > MAX_POST_TEXT_LENGTH) {
    throw new PostTextError(`text must be at most ${MAX_POST_TEXT_LENGTH} characters.`);
  }

  return text;
}

class PostTextError extends Error {
  constructor(message: string) {
    super(message);
  }
}
