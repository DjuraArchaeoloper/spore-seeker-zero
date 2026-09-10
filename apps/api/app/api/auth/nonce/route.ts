import crypto from "crypto";

import { connectToDatabase } from "../../../../src/db/mongoose";
import { authConfig } from "../../../../src/env";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { AuthNonceModel } from "../../../../src/models/AuthNonce";
import { createSiwsPayload } from "../../../../src/auth/siws";

export const runtime = "nodejs";

export async function POST() {
  try {
    await connectToDatabase();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + authConfig.nonceTtlMs);
    const nonce = await createUniqueNonce(now, expiresAt);

    return jsonOk({
      signInPayload: createSiwsPayload({
        nonce,
        createdAt: now,
        expiresAt
      })
    });
  } catch {
    return jsonError(500, "server_misconfigured", "Authentication is unavailable.");
  }
}

async function createUniqueNonce(createdAt: Date, expiresAt: Date) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nonce = crypto.randomBytes(32).toString("hex");

    try {
      await AuthNonceModel.create({
        nonce,
        createdAt,
        expiresAt,
        usedAt: null
      });

      return nonce;
    } catch {
      continue;
    }
  }

  throw new Error("Unable to create nonce.");
}
