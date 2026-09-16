import crypto from "crypto";

import { PublicKey } from "@solana/web3.js";

import { connectToDatabase } from "../../../../src/db/mongoose";
import { getHeliusWebhookAuth, getSporeProgramId } from "../../../../src/env";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import {
  indexHeliusRawTransactions,
  OrganismIndexConflictError,
  ParentOrganismMissingError,
  WebhookPayloadError
} from "../../../../src/indexing/organismBorn";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;

export async function POST(request: Request) {
  try {
    if (!isAuthorizedWebhook(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const sporeProgramId = normalizePublicKey(getSporeProgramId());
    const payload = await readJsonValue(request, MAX_WEBHOOK_BODY_BYTES);

    await connectToDatabase();

    const result = await indexHeliusRawTransactions(payload, sporeProgramId);

    if (result.outbreakFailed > 0) {
      return jsonError(503, "outbreak_scoring_deferred", "Outbreak scoring will be retried.");
    }

    return jsonOk(result);
  } catch (error) {
    if (error instanceof ParentOrganismMissingError) {
      return jsonError(503, "indexing_deferred", "Parent organism is not indexed yet.");
    }

    if (error instanceof OrganismIndexConflictError) {
      console.error("SPORE organism index conflict", {
        organismPda: error.organismPda
      });

      return jsonError(409, "integrity_conflict", "Organism index conflict.");
    }

    if (error instanceof WebhookPayloadError) {
      return jsonError(400, "bad_request", "Invalid webhook payload.");
    }

    return jsonError(503, "server_misconfigured", "Webhook processing is unavailable.");
  }
}

function isAuthorizedWebhook(request: Request) {
  const actual = request.headers.get("authorization");
  const expected = getHeliusWebhookAuth();

  if (!actual) {
    return false;
  }

  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");

  return (
    actualBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(actualBytes, expectedBytes)
  );
}

async function readJsonValue(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const declaredLength = Number(contentLength);

    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      throw new WebhookPayloadError("Invalid content length.");
    }

    if (declaredLength > maxBytes) {
      throw new WebhookPayloadError("Request body is too large.");
    }
  }

  if (!request.body) {
    throw new WebhookPayloadError("Request body is required.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    bytesRead += value.byteLength;

    if (bytesRead > maxBytes) {
      throw new WebhookPayloadError("Request body is too large.");
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WebhookPayloadError("Request body must be valid JSON.");
  }
}

function normalizePublicKey(value: string) {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new Error("Invalid SPORE program ID.");
  }
}
