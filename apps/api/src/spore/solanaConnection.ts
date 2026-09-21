import { Connection } from "@solana/web3.js";

import { getHeliusRpcUrl } from "../env";

let connection: Connection | null = null;

export function getSolanaConnection() {
  return (connection ??= new Connection(getHeliusRpcUrl(), {
    commitment: "confirmed"
  }));
}
