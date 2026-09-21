import { Connection } from "@solana/web3.js";

import { getHeliusRpcUrl } from "../env";
import { SporeDomainError } from "./errors";

let connection: Connection | null = null;

function getConnection() {
  return (connection ??= new Connection(getHeliusRpcUrl(), "confirmed"));
}

/** Confirmed-commitment Solana slot for mutation entropy. */
export async function fetchConfirmedSlot(): Promise<bigint> {
  try {
    const slot = await getConnection().getSlot("confirmed");

    if (!Number.isSafeInteger(slot) || slot < 0) {
      throw new SporeDomainError("slot_unavailable", "Solana slot is unavailable.");
    }

    return BigInt(slot);
  } catch (error) {
    if (error instanceof SporeDomainError) {
      throw error;
    }

    throw new SporeDomainError("slot_unavailable", "Solana slot is unavailable.");
  }
}
