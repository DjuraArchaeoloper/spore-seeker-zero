import { createHmac } from "crypto";
import { Keypair } from "@solana/web3.js";

import { SporeDomainError } from "./errors";

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Server update-authority keypair for temporary Core control.
 * Configure later via SPORE_SERVER_AUTHORITY_SECRET (JSON byte array).
 * Never expose this secret to mobile/clients.
 */
export function getSporeServerAuthorityKeypair(): Keypair {
  const secret = getOptionalEnv("SPORE_SERVER_AUTHORITY_SECRET");

  if (!secret) {
    throw new SporeDomainError(
      "server_misconfigured",
      "SPORE_SERVER_AUTHORITY_SECRET is not configured."
    );
  }

  return keypairFromJsonSecret(secret, "SPORE_SERVER_AUTHORITY_SECRET");
}

/**
 * HMAC key used to derive deterministic Core asset signers per settlement attempt.
 * Defaults to the server authority secret when SPORE_ASSET_DERIVATION_SECRET is unset.
 */
export function getSporeAssetDerivationSecret(): string {
  const dedicated = getOptionalEnv("SPORE_ASSET_DERIVATION_SECRET");

  if (dedicated) {
    return dedicated;
  }

  const authority = getOptionalEnv("SPORE_SERVER_AUTHORITY_SECRET");

  if (!authority) {
    throw new SporeDomainError(
      "server_misconfigured",
      "SPORE_ASSET_DERIVATION_SECRET or SPORE_SERVER_AUTHORITY_SECRET is required."
    );
  }

  return authority;
}

export function deriveCoreAssetKeypair(input: {
  reservationId: string;
  attemptId: string;
}): Keypair {
  const seed = createHmac("sha256", getSporeAssetDerivationSecret())
    .update(`spore-core-asset:v1:${input.reservationId}:${input.attemptId}`, "utf8")
    .digest();

  return Keypair.fromSeed(seed);
}

function keypairFromJsonSecret(secret: string, envName: string): Keypair {
  let parsed: unknown;

  try {
    parsed = JSON.parse(secret);
  } catch {
    throw new SporeDomainError(
      "server_misconfigured",
      `${envName} must be a JSON secret-key byte array.`
    );
  }

  if (!Array.isArray(parsed) || parsed.length < 64 || !parsed.every((n) => typeof n === "number")) {
    throw new SporeDomainError(
      "server_misconfigured",
      `${envName} must be a JSON secret-key byte array.`
    );
  }

  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}
