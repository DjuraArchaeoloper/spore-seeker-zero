import mongoose from "mongoose";

import { connectToDatabase } from "../../../../../../../src/db/mongoose";
import { getSporSocialSecret } from "../../../../../../../src/env";
import { isBearerSecretAuthorized } from "../../../../../../../src/http/bearerSecret";
import { RequestBodyError, readJsonObject } from "../../../../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../../../../src/http/responses";
import { SocialPostModel } from "../../../../../../../src/models/SocialPost";
import { PostTextError, parsePostText } from "../../../../../../../src/social/postText";

export const runtime = "nodejs";

const MAX_PATCH_BODY_BYTES = 4 * 1024;
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ALLOWED_PATCH_FIELDS = new Set(["text", "scheduledFor"]);

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isAuthorized(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const { id } = await context.params;
    const objectId = parseObjectId(id);

    if (!objectId) {
      return jsonError(404, "not_found", "Post not found.");
    }

    const body = await readJsonObject(request, MAX_PATCH_BODY_BYTES);
    const updates = parsePatchBody(body);

    await connectToDatabase();

    const updated = await SocialPostModel.findOneAndUpdate(
      {
        _id: objectId,
        status: "pending"
      },
      {
        $set: updates
      },
      {
        new: true
      }
    ).lean();

    if (!updated) {
      return unresolvedPendingMutationResponse(objectId);
    }

    return jsonOk({
      ok: true,
      post: {
        id: String(updated._id),
        text: updated.text,
        scheduledFor: updated.scheduledFor.toISOString(),
        status: updated.status,
        createdAt: updated.createdAt.toISOString()
      }
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, "bad_request", error.message);
    }

    if (error instanceof QueueMutationError || error instanceof PostTextError) {
      return jsonError(400, "bad_request", error.message);
    }

    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
    }

    console.error("SPØR internal social queue patch failed");

    return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!isAuthorized(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const { id } = await context.params;
    const objectId = parseObjectId(id);

    if (!objectId) {
      return jsonError(404, "not_found", "Post not found.");
    }

    await connectToDatabase();

    const deleted = await SocialPostModel.findOneAndDelete({
      _id: objectId,
      status: "pending"
    }).lean();

    if (!deleted) {
      return unresolvedPendingMutationResponse(objectId);
    }

    return jsonOk({
      ok: true,
      deleted: true,
      id: String(deleted._id)
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
    }

    console.error("SPØR internal social queue delete failed");

    return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
  }
}

function isAuthorized(request: Request) {
  return isBearerSecretAuthorized(request, getSporSocialSecret());
}

function parseObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const objectId = new mongoose.Types.ObjectId(id);

  if (String(objectId) !== id) {
    return null;
  }

  return objectId;
}

function parsePatchBody(body: Record<string, unknown>) {
  const keys = Object.keys(body);

  if (keys.length === 0) {
    throw new QueueMutationError("Request body must include text and/or scheduledFor.");
  }

  for (const key of keys) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      throw new QueueMutationError(`Unknown field: ${key}.`);
    }
  }

  const updates: {
    text?: string;
    scheduledFor?: Date;
  } = {};

  if ("text" in body) {
    updates.text = parsePostText(body.text);
  }

  if ("scheduledFor" in body) {
    updates.scheduledFor = parseScheduledFor(body.scheduledFor);
  }

  if (!("text" in updates) && !("scheduledFor" in updates)) {
    throw new QueueMutationError("Request body must include text and/or scheduledFor.");
  }

  return updates;
}

function parseScheduledFor(value: unknown) {
  if (typeof value !== "string") {
    throw new QueueMutationError("scheduledFor must be a string.");
  }

  const scheduledFor = value.trim();

  if (!ISO_DATE_TIME_PATTERN.test(scheduledFor)) {
    throw new QueueMutationError("scheduledFor must be a valid ISO date/time.");
  }

  const date = new Date(scheduledFor);

  if (Number.isNaN(date.getTime())) {
    throw new QueueMutationError("scheduledFor must be a valid ISO date/time.");
  }

  return date;
}

async function unresolvedPendingMutationResponse(objectId: mongoose.Types.ObjectId) {
  const existing = await SocialPostModel.findById(objectId).select({ _id: 1 }).lean();

  if (!existing) {
    return jsonError(404, "not_found", "Post not found.");
  }

  return jsonError(409, "integrity_conflict", "Post is no longer pending.");
}

class QueueMutationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
