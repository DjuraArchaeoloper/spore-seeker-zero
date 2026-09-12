import { SolanaSignIn, type SolanaSignInOutput } from "@solana/wallet-standard-features";
import { verifySignIn } from "@solana/wallet-standard-util";
import { PublicKey } from "@solana/web3.js";

import { getSiwsConfig } from "../env";
import { isPlainObject, type JsonObject } from "../http/request";

export type SiwsPayload = {
  domain: string;
  statement: string;
  uri: string;
  version: "1";
  chainId: "solana:mainnet" | "solana:devnet";
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

export type MobileSignInResult = {
  address: string;
  signed_message: string;
  signature: string;
  signature_type?: string;
};

const NONCE_PATTERN = /^[a-f0-9]{64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export function isNonce(value: unknown): value is string {
  return typeof value === "string" && NONCE_PATTERN.test(value);
}

export function createSiwsPayload(input: { nonce: string; createdAt: Date; expiresAt: Date }): SiwsPayload {
  const config = getSiwsConfig();

  return {
    domain: config.domain,
    statement: config.statement,
    uri: config.uri,
    version: "1",
    chainId: getSiwsChainId(config.chainId),
    nonce: input.nonce,
    issuedAt: input.createdAt.toISOString(),
    expirationTime: input.expiresAt.toISOString()
  };
}

export function parseMobileSignInResult(value: unknown): MobileSignInResult | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const allowedKeys = new Set(["address", "signed_message", "signature", "signature_type"]);

  if (!Object.keys(value).every((key) => allowedKeys.has(key))) {
    return null;
  }

  const { address, signed_message: signedMessage, signature, signature_type: signatureType } = value;

  if (!isBase64String(address, 128) || !isBase64String(signedMessage, 4096) || !isBase64String(signature, 512)) {
    return null;
  }

  if (signatureType !== undefined && signatureType !== "ed25519") {
    return null;
  }

  return {
    address,
    signed_message: signedMessage,
    signature,
    signature_type: signatureType
  };
}

export function verifySiwsPayload(payload: SiwsPayload, result: MobileSignInResult) {
  const publicKey = decodeBase64(result.address);
  const signedMessage = decodeBase64(result.signed_message);
  const signature = decodeBase64(result.signature);

  if (publicKey.length !== 32 || signature.length !== 64 || signedMessage.length === 0) {
    return null;
  }

  const walletAddress = new PublicKey(publicKey).toBase58();
  const output: SolanaSignInOutput = {
    account: {
      address: walletAddress,
      publicKey,
      chains: [payload.chainId],
      features: [SolanaSignIn]
    },
    signedMessage,
    signature
  };

  const expected = getSiwsConfig();

  if (
    payload.version !== "1" ||
    payload.chainId !== expected.chainId ||
    payload.domain !== expected.domain ||
    payload.uri !== expected.uri ||
    payload.statement !== expected.statement
  ) {
    return null;
  }

  if (!verifySignIn(payload, output)) {
    return null;
  }

  return { walletAddress };
}

export function getVerifyBody(body: JsonObject) {
  const allowedKeys = new Set(["nonce", "signInResult"]);

  if (!Object.keys(body).every((key) => allowedKeys.has(key))) {
    return null;
  }

  if (!isNonce(body.nonce)) {
    return null;
  }

  const signInResult = parseMobileSignInResult(body.signInResult);

  if (!signInResult) {
    return null;
  }

  return {
    nonce: body.nonce,
    signInResult
  };
}

function isBase64String(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    value.length % 4 === 0 &&
    BASE64_PATTERN.test(value)
  );
}

function decodeBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function getSiwsChainId(value: string): SiwsPayload["chainId"] {
  if (value === "solana:mainnet" || value === "solana:devnet") {
    return value;
  }

  throw new Error("Invalid SIWS chain ID.");
}
