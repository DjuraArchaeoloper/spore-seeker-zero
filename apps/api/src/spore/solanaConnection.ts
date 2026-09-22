import { Connection } from "@solana/web3.js";

import { assertConfiguredSolanaNetwork, getHeliusRpcUrl } from "../env";
import { SporeDomainError } from "./errors";

let connection: Connection | null = null;

export function getSolanaConnection() {
  return (connection ??= new Connection(getHeliusRpcUrl(), {
    commitment: "confirmed"
  }));
}

/**
 * Settlement-path entry: ensure cluster + RPC agree (hostname + genesis) before
 * blockhash / simulation / verification / Core lookups.
 * Verification is lazy (first Solana-dependent call) and cached per process.
 */
export async function getVerifiedSolanaConnection() {
  try {
    await assertConfiguredSolanaNetwork();
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("Solana cluster/RPC mismatch")
        ? error.message
        : error instanceof Error &&
            error.message.startsWith("Missing required environment variable")
          ? error.message
          : error instanceof Error &&
              error.message.startsWith("SPORE_SOLANA_CLUSTER must be")
            ? error.message
            : "Solana RPC is temporarily unavailable.";

    throw new SporeDomainError("server_misconfigured", message);
  }

  return getSolanaConnection();
}
