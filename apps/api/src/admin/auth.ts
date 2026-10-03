import crypto from "node:crypto";
import mongoose from "mongoose";

import { connectToDatabase } from "../db/mongoose";
import { AdminOtpModel, type AdminOtp } from "../models/AdminOtp";
import { AdminSessionModel } from "../models/AdminSession";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_PURGE_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const OTP_PATTERN = /^[0-9]{6}$/;
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type AdminIdentity = { email: string };

export class AdminUnauthorizedError extends Error {
  constructor() {
    super("Admin authentication required.");
    this.name = "AdminUnauthorizedError";
  }
}

/** Conservative ASCII normalization; no provider-specific alias rewriting. */
export function normalizeAdminEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /[^\x21-\x7e]/.test(email)) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (
    !local || local.length > 64 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) ||
    local.startsWith(".") || local.endsWith(".") || local.includes("..") ||
    !domain || domain.length > 253 ||
    domain.split(".").length < 2 ||
    !domain.split(".").every((label) => DOMAIN_LABEL_PATTERN.test(label))
  ) return null;
  return email;
}

export async function requestAdminCode(email: string): Promise<() => Promise<void>> {
  const config = getAdminAuthConfig();
  const delivery = getAdminEmailConfig();
  await connectToDatabase();
  const normalized = normalizeAdminEmail(email);
  if (!normalized || !config.allowedEmails.has(normalized)) return async () => {};

  const now = new Date();
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const emailKey = emailHash(normalized, config.otpSecret);
  const codeHash = hashOtp(normalized, code, config.otpSecret);
  const reserved = await reserveCode(emailKey, codeHash, now);
  if (!reserved) return async () => {};

  return async () => {
    try {
      await sendAdminCode(normalized, code, delivery);
    } catch (error) {
      // The request response stays identical for approved and unapproved addresses.
      try {
        await AdminOtpModel.updateOne(
          { _id: emailKey, codeHash },
          { $set: { expiresAt: new Date(0) } },
        );
      } catch {
        // Delivery failure remains an internal diagnostic, never an email oracle.
      }
      console.error("SPØR admin code delivery failed.", {
        reason: error instanceof Error ? error.name : "Unknown",
      });
    }
  };
}

export async function verifyAdminCode(email: string, code: string) {
  const config = getAdminAuthConfig();
  const normalized = normalizeAdminEmail(email);
  if (!normalized || typeof code !== "string" || !OTP_PATTERN.test(code)) return null;
  await connectToDatabase();

  const emailKey = emailHash(normalized, config.otpSecret);
  const challenge = await AdminOtpModel.findById(emailKey).lean();
  const now = new Date();
  if (
    !challenge || challenge.usedAt || challenge.expiresAt <= now ||
    challenge.attempts >= OTP_MAX_ATTEMPTS
  ) return null;

  const candidateHash = hashOtp(normalized, code, config.otpSecret);
  if (!crypto.timingSafeEqual(Buffer.from(candidateHash, "hex"), Buffer.from(challenge.codeHash, "hex"))) {
    await AdminOtpModel.updateOne(
      {
        _id: emailKey,
        codeHash: challenge.codeHash,
        usedAt: null,
        expiresAt: { $gt: now },
        attempts: { $lt: OTP_MAX_ATTEMPTS },
      },
      { $inc: { attempts: 1 } },
    );
    return null;
  }

  // A code for an unapproved address can never establish an admin session.
  if (!config.allowedEmails.has(normalized)) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await mongoose.startSession();
  try {
    const authenticated = await session.withTransaction(async () => {
      const consumed = await AdminOtpModel.findOneAndUpdate(
        {
          _id: emailKey,
          codeHash: candidateHash,
          usedAt: null,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: OTP_MAX_ATTEMPTS },
        },
        { $set: { usedAt: new Date() } },
        { session, returnDocument: "after" },
      );
      if (!consumed) return false;
      await AdminSessionModel.create(
        [{
          tokenHash: hashSessionToken(token),
          email: normalized,
          createdAt: new Date(),
          expiresAt,
          revokedAt: null,
        }],
        { session },
      );
      return true;
    });
    return authenticated ? { token, expiresAt, admin: { email: normalized } } : null;
  } finally {
    await session.endSession();
  }
}

export async function getAdminSession(request: Request): Promise<AdminIdentity | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const config = getAdminAuthConfig();
  await connectToDatabase();
  const session = await AdminSessionModel.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
    revokedAt: null,
  }).lean();
  if (!session || !config.allowedEmails.has(session.email)) return null;
  return { email: session.email };
}

/** Use this in every future admin API handler before reading or mutating data. */
export async function requireAdminSession(request: Request): Promise<AdminIdentity> {
  const admin = await getAdminSession(request);
  if (!admin) throw new AdminUnauthorizedError();
  return admin;
}

export async function revokeAdminSession(request: Request): Promise<void> {
  const token = getBearerToken(request);
  if (!token) return;
  await connectToDatabase();
  await AdminSessionModel.updateOne(
    { tokenHash: hashSessionToken(token), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

function getAdminAuthConfig() {
  const otpSecret = process.env.ADMIN_OTP_SECRET?.trim();
  const emails = process.env.ADMIN_EMAILS?.split(",").map((email) => email.trim()) ?? [];
  const normalizedEmails = emails.map(normalizeAdminEmail);
  const allowedEmails = new Set(normalizedEmails.filter((email): email is string => !!email));
  if (
    !otpSecret || Buffer.byteLength(otpSecret) < 32 ||
    allowedEmails.size === 0 || normalizedEmails.some((email) => !email)
  ) {
    throw new Error("Admin authentication environment is incomplete.");
  }
  return { otpSecret, allowedEmails };
}

function getAdminEmailConfig() {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.ADMIN_EMAIL_FROM?.trim();
  if (!resendApiKey || !emailFrom || emailFrom.length > 254 || /[\r\n]/.test(emailFrom)) {
    throw new Error("Admin email delivery environment is incomplete.");
  }
  return { resendApiKey, emailFrom };
}

async function reserveCode(emailKey: string, codeHash: string, now: Date): Promise<boolean> {
  const current = await AdminOtpModel.findById(emailKey).lean();
  if (current && now.getTime() - current.sentAt.getTime() < OTP_RESEND_MS) return false;
  const sameWindow = !!current && now.getTime() - current.requestWindowStartedAt.getTime() < OTP_REQUEST_WINDOW_MS;
  if (sameWindow && current.requestCount >= OTP_MAX_REQUESTS_PER_WINDOW) return false;

  const next: AdminOtp = {
    _id: emailKey,
    codeHash,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    attempts: 0,
    sentAt: now,
    requestWindowStartedAt: sameWindow ? current!.requestWindowStartedAt : now,
    requestCount: sameWindow ? current!.requestCount + 1 : 1,
    usedAt: null,
    purgeAt: new Date(now.getTime() + OTP_PURGE_MS),
  };

  if (!current) {
    try {
      await AdminOtpModel.create(next);
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  const updated = await AdminOtpModel.updateOne(
    {
      _id: emailKey,
      codeHash: current.codeHash,
      sentAt: current.sentAt,
      requestCount: current.requestCount,
    },
    { $set: {
      codeHash: next.codeHash,
      expiresAt: next.expiresAt,
      attempts: next.attempts,
      sentAt: next.sentAt,
      requestWindowStartedAt: next.requestWindowStartedAt,
      requestCount: next.requestCount,
      usedAt: next.usedAt,
      purgeAt: next.purgeAt,
    } },
  );
  return updated.modifiedCount === 1;
}

async function sendAdminCode(
  to: string,
  code: string,
  config: { resendApiKey: string; emailFrom: string },
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [to],
      subject: "Your SPØR admin code",
      text: `Your SPØR admin code is ${code}. It expires in 10 minutes.`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Admin email provider rejected delivery.");
}

function emailHash(email: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`email:${email}`).digest("hex");
}

function hashOtp(email: string, code: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`otp:${email}:${code}`).digest("hex");
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return SESSION_TOKEN_PATTERN.test(token) ? token : null;
}

function isDuplicateKey(error: unknown) {
  return !!error && typeof error === "object" && "code" in error && error.code === 11000;
}
