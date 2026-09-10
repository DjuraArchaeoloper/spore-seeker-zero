import crypto from "crypto";

import { SessionModel } from "../models/Session";
import { SeekerIdentityModel } from "../models/SeekerIdentity";
import { authConfig } from "../env";

const SESSION_TOKEN_BYTES = 32;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AuthenticatedSeeker = {
  sgtMint: string;
  walletAddress: string;
};

export function generateSessionToken() {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createSession(sgtMint: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + authConfig.sessionTtlMs);

    try {
      await SessionModel.create({
        tokenHash,
        sgtMint,
        createdAt: now,
        expiresAt,
        revokedAt: null
      });

      return {
        token,
        expiresAt
      };
    } catch {
      continue;
    }
  }

  throw new Error("Unable to create session.");
}

export async function getAuthenticatedSeeker(request: Request): Promise<AuthenticatedSeeker | null> {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const now = new Date();
  const session = await SessionModel.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: now },
    revokedAt: null
  }).lean();

  if (!session) {
    return null;
  }

  const seeker = await SeekerIdentityModel.findOne({
    sgtMint: session.sgtMint
  }).lean();

  if (!seeker) {
    return null;
  }

  return {
    sgtMint: seeker.sgtMint,
    walletAddress: seeker.currentWalletAddress
  };
}

export async function revokeSession(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return;
  }

  await SessionModel.updateOne(
    {
      tokenHash: hashSessionToken(token),
      revokedAt: null
    },
    {
      $set: {
        revokedAt: new Date()
      }
    }
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!SESSION_TOKEN_PATTERN.test(token)) {
    return null;
  }

  return token;
}
