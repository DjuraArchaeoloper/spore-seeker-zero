import { PublicKey, SystemProgram } from "@solana/web3.js";
import { SporeFailure } from "./payload";

type SporeCluster = "mainnet" | "devnet";

const GENESIS_HASHES: Record<SporeCluster, string> = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
};

export function sporeCluster(): SporeCluster {
  const cluster = process.env.EXPO_PUBLIC_SPORE_SOLANA_CLUSTER ?? "mainnet";

  if (cluster !== "mainnet" && cluster !== "devnet") {
    throw new SporeFailure("SPOR Solana cluster is not configured.");
  }

  return cluster;
}

export function sporeGenesisHash() {
  return GENESIS_HASHES[sporeCluster()];
}

export function sporeWalletChain() {
  return `solana:${sporeCluster()}` as const;
}

export function sporeProgramId() {
  try {
    const key = new PublicKey(process.env.EXPO_PUBLIC_SPORE_PROGRAM_ID ?? "");
    if (key.equals(SystemProgram.programId)) throw new Error();
    return key;
  } catch {
    throw new SporeFailure("SPOR program is not configured.");
  }
}
