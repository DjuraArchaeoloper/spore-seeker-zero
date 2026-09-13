import { connectToDatabase } from "../../../../src/db/mongoose";
import { authConfig, getSolanaCluster } from "../../../../src/env";
import { readJsonObject, RequestBodyError } from "../../../../src/http/request";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { createSession } from "../../../../src/auth/session";
import { createSiwsPayload, getVerifyBody, verifySiwsPayload } from "../../../../src/auth/siws";
import { SgtVerificationUnavailableError, verifySeekerGenesisToken } from "../../../../src/auth/sgt";
import { AuthNonceModel } from "../../../../src/models/AuthNonce";
import { SeekerIdentityModel } from "../../../../src/models/SeekerIdentity";

export const runtime = "nodejs";

const MAX_VERIFY_BODY_BYTES = 8192;

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await readJsonObject(request, MAX_VERIFY_BODY_BYTES);
    const verifyBody = getVerifyBody(body);

    if (!verifyBody) {
      return jsonError(400, "bad_request", "Invalid authentication request.");
    }

    const now = new Date();
    const nonceRecord = await AuthNonceModel.findOne({
      nonce: verifyBody.nonce
    }).lean();

    if (!nonceRecord || nonceRecord.usedAt || nonceRecord.expiresAt <= now) {
      return jsonError(401, "authentication_failed", "Authentication failed.");
    }

    const siwsPayload = createSiwsPayload({
      nonce: nonceRecord.nonce,
      createdAt: nonceRecord.createdAt,
      expiresAt: nonceRecord.expiresAt
    });

    const siws = verifySiwsPayload(siwsPayload, verifyBody.signInResult);

    if (!siws) {
      return jsonError(401, "authentication_failed", "Authentication failed.");
    }

    console.log("[AUTH DEBUG]", {
      phase: "siws_verified",
      walletAddress: siws.walletAddress,
      cluster: getSolanaCluster()
    });

    const sgt = await verifySeekerGenesisToken(siws.walletAddress);

    if (!sgt) {
      return jsonError(403, "not_seeker", "Seeker verification failed.");
    }

    const consumedNonce = await AuthNonceModel.findOneAndUpdate(
      {
        nonce: verifyBody.nonce,
        usedAt: null,
        expiresAt: { $gt: new Date() }
      },
      {
        $set: {
          usedAt: new Date()
        }
      }
    );

    if (!consumedNonce) {
      return jsonError(401, "authentication_failed", "Authentication failed.");
    }

    const authenticatedAt = new Date();

    await SeekerIdentityModel.findOneAndUpdate(
      {
        sgtMint: sgt.mintAddress
      },
      {
        $set: {
          currentWalletAddress: siws.walletAddress,
          lastAuthenticatedAt: authenticatedAt
        },
        $setOnInsert: {
          sgtMint: sgt.mintAddress,
          createdAt: authenticatedAt
        }
      },
      {
        upsert: true
      }
    );

    const session = await createSession(sgt.mintAddress);

    return jsonOk({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      seeker: {
        sgtMint: sgt.mintAddress,
        walletAddress: siws.walletAddress
      }
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, "bad_request", "Invalid authentication request.");
    }

    if (error instanceof SgtVerificationUnavailableError) {
      return jsonError(503, "verification_unavailable", "Seeker verification is temporarily unavailable.");
    }

    return jsonError(401, "authentication_failed", "Authentication failed.");
  }
}
