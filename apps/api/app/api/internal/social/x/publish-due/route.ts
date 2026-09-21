import { connectToDatabase } from "../../../../../../src/db/mongoose";
import { getCronSecret } from "../../../../../../src/env";
import { isBearerSecretAuthorized } from "../../../../../../src/http/bearerSecret";
import { jsonError, jsonOk } from "../../../../../../src/http/responses";
import { SocialPostModel } from "../../../../../../src/models/SocialPost";
import {
  isDefiniteXRejection,
  logXPublishError,
  publishTextToX,
  sanitizeXPublishError
} from "../../../../../../src/social/xPublish";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return jsonError(401, "unauthorized", "Unauthorized.");
    }

    await connectToDatabase();

    const now = new Date();
    const claimed = await SocialPostModel.findOneAndUpdate(
      {
        status: "pending",
        scheduledFor: { $lte: now }
      },
      {
        $set: { status: "publishing" },
        $unset: { lastError: 1 }
      },
      {
        sort: { scheduledFor: 1 },
        new: true
      }
    );

    if (!claimed) {
      return jsonOk({
        ok: true,
        published: false
      });
    }

    let published: { id: string; text: string };

    try {
      published = await publishTextToX(claimed.text);
    } catch (publishError) {
      logXPublishError(publishError);

      if (isDefiniteXRejection(publishError)) {
        await SocialPostModel.updateOne(
          { _id: claimed._id, status: "publishing" },
          {
            $set: {
              status: "failed",
              lastError: sanitizeXPublishError(publishError)
            }
          }
        );

        return jsonError(502, "x_publish_failed", "Unable to publish post.");
      }

      console.error("SPØR social publish outcome ambiguous; left as publishing", {
        id: String(claimed._id)
      });

      if (publishError instanceof Error && publishError.message.startsWith("Missing required")) {
        return jsonError(503, "server_misconfigured", "Social publishing is unavailable.");
      }

      return jsonError(502, "x_publish_failed", "Unable to publish post.");
    }

    try {
      await SocialPostModel.updateOne(
        { _id: claimed._id, status: "publishing" },
        {
          $set: {
            status: "posted",
            xPostId: published.id,
            postedAt: new Date()
          },
          $unset: { lastError: 1 }
        }
      );
    } catch {
      console.error("SPØR social post published to X but Mongo update failed", {
        id: String(claimed._id)
      });

      return jsonError(
        503,
        "server_misconfigured",
        "Post may have published; manual reconciliation required."
      );
    }

    return jsonOk({
      ok: true,
      published: true,
      id: String(claimed._id),
      xPostId: published.id
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return jsonError(503, "server_misconfigured", "Social publishing is unavailable.");
    }

    console.error("SPØR internal social publish-due failed");

    return jsonError(503, "server_misconfigured", "Social publishing is unavailable.");
  }
}

function isAuthorized(request: Request) {
  return isBearerSecretAuthorized(request, getCronSecret());
}
