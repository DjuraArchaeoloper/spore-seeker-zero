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
 */
export async function getVerifiedSolanaConnection() {
  try {
    await assertConfiguredSolanaNetwork();
  } catch (error) {
    throw new SporeDomainError(
      "server_misconfigured",
      error instanceof Error
        ? error.message
        : "Solana RPC is misconfigured."
    );
  }

  return getSolanaConnection();
}
