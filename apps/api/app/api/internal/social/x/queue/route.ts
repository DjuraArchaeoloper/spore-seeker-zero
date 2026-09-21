import { connectToDatabase } from "../../../../../../src/db/mongoose";
import { getSporSocialSecret } from "../../../../../../src/env";
import { isBearerSecretAuthorized } from "../../../../../../src/http/bearerSecret";
import { RequestBodyError, isPlainObject, readJsonObject } from "../../../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../../../src/http/responses";
import { SocialPostModel } from "../../../../../../src/models/SocialPost";
import { PostTextError, parsePostText } from "../../../../../../src/social/postText";

export const runtime = "nodejs";

const MAX_QUEUE_BODY_BYTES = 64 * 1024;
const MAX_BATCH_SIZE = 50;
const MAX_ACTIVE_QUEUE_VIEW = 50;
const MAX_RECENT_TERMINAL_VIEW = 20;
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    await connectToDatabase();

    const [activePosts, recentTerminalPosts] = await Promise.all([
      SocialPostModel.find({
        status: { $in: ["pending", "publishing"] }
      })
        .sort({ scheduledFor: 1 })
        .limit(MAX_ACTIVE_QUEUE_VIEW)
        .lean(),
      SocialPostModel.find({
        status: { $in: ["posted", "failed"] }
      })
        .sort({ updatedAt: -1 })
        .limit(MAX_RECENT_TERMINAL_VIEW)
        .lean()
    ]);

    return jsonOk({
      ok: true,
      posts: [...activePosts, ...recentTerminalPosts].map(serializeQueuePost)
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
    }

    console.error("SPØR internal social queue view failed");

    return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    const body = await readJsonObject(request, MAX_QUEUE_BODY_BYTES);
    const validatedPosts = parseQueuePosts(body.posts);

    await connectToDatabase();

    const created = await SocialPostModel.insertMany(
      validatedPosts.map((post) => ({
        text: post.text,
        scheduledFor: post.scheduledFor,
        status: "pending" as const
      })),
      { ordered: true }
    );

    return jsonOk({
      ok: true,
      posts: created.map((post) => ({
        id: String(post._id),
        status: post.status,
        scheduledFor: post.scheduledFor.toISOString()
      }))
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, "bad_request", error.message);
    }

    if (error instanceof QueueValidationError || error instanceof PostTextError) {
      return jsonError(400, "bad_request", error.message);
    }

    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
    }

    console.error("SPØR internal social queue insert failed");

    return jsonError(503, "server_misconfigured", "Social queue is unavailable.");
  }
}

function isAuthorized(request: Request) {
  return isBearerSecretAuthorized(request, getSporSocialSecret());
}

function parseQueuePosts(value: unknown) {
  if (!Array.isArray(value)) {
    throw new QueueValidationError("posts must be an array.");
  }

  if (value.length === 0) {
    throw new QueueValidationError("posts must not be empty.");
  }

  if (value.length > MAX_BATCH_SIZE) {
    throw new QueueValidationError(`posts must contain at most ${MAX_BATCH_SIZE} items.`);
  }

  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new QueueValidationError(`posts[${index}] must be an object.`);
    }

    return {
      text: parsePostText(entry.text),
      scheduledFor: parseScheduledFor(entry.scheduledFor, index)
    };
  });
}

function parseScheduledFor(value: unknown, index: number) {
  if (typeof value !== "string") {
    throw new QueueValidationError(`posts[${index}].scheduledFor must be a string.`);
  }

  const scheduledFor = value.trim();

  if (!ISO_DATE_TIME_PATTERN.test(scheduledFor)) {
    throw new QueueValidationError(`posts[${index}].scheduledFor must be a valid ISO date/time.`);
  }

  const date = new Date(scheduledFor);

  if (Number.isNaN(date.getTime())) {
    throw new QueueValidationError(`posts[${index}].scheduledFor must be a valid ISO date/time.`);
  }

  return date;
}

function serializeQueuePost(post: {
  _id: unknown;
  text: string;
  scheduledFor: Date;
  status: string;
  xPostId?: string;
  postedAt?: Date;
  createdAt: Date;
}) {
  return {
    id: String(post._id),
    text: post.text,
    scheduledFor: post.scheduledFor.toISOString(),
    status: post.status,
    ...(post.xPostId ? { xPostId: post.xPostId } : {}),
    ...(post.postedAt ? { postedAt: post.postedAt.toISOString() } : {}),
    createdAt: post.createdAt.toISOString()
  };
}

class QueueValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
