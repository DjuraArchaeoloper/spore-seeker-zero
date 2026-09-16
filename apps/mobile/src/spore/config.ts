import { PublicKey, SystemProgram } from "@solana/web3.js";
import { SporeFailure } from "./payload";

type SporeCluster = "mainnet" | "devnet";

const CURRENT_DEVNET_GENESIS_PROGRAM_ID =
  "9HvZ7ckadQt38R1KxYPhP759yCCx4MRF8NBquV4HUUXZ";
const MAX_METADATA_BASE_URI_LENGTH = 96;

const GENESIS_HASHES: Record<SporeCluster, string> = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
};

export function sporeCluster(): SporeCluster {
  const cluster = process.env.EXPO_PUBLIC_SPORE_SOLANA_CLUSTER ?? "mainnet";

  if (cluster !== "mainnet" && cluster !== "devnet") {
    throw new SporeFailure("SPØR Solana cluster is not configured.");
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
    throw new SporeFailure("SPØR program is not configured.");
  }
}

export function sporeMetadataBaseUri() {
  const value = process.env.EXPO_PUBLIC_SPORE_API_URL?.replace(/\/+$/, "");

  if (
    !value ||
    !value.startsWith("https://") ||
    value.length > MAX_METADATA_BASE_URI_LENGTH
  ) {
    throw new SporeFailure("SPØR devnet metadata URI is not configured.");
  }

  return value;
}

export function isDevnetGenesisCandidate(walletAddress: string) {
  try {
    return (
      sporeCluster() === "devnet" &&
      process.env.EXPO_PUBLIC_SPORE_DEVNET_GENESIS_ENABLED === "true" &&
      sporeProgramId().equals(new PublicKey(CURRENT_DEVNET_GENESIS_PROGRAM_ID)) &&
      configuredDevnetGenesisWallet()?.equals(new PublicKey(walletAddress)) === true
    );
  } catch {
    return false;
  }
}

export function assertDevnetGenesisCandidate(walletAddress: string) {
  if (sporeCluster() !== "devnet") {
    throw new SporeFailure("Devnet genesis is unavailable.");
  }
  if (process.env.EXPO_PUBLIC_SPORE_DEVNET_GENESIS_ENABLED !== "true") {
    throw new SporeFailure("Devnet genesis is disabled.");
  }
  if (!sporeProgramId().equals(new PublicKey(CURRENT_DEVNET_GENESIS_PROGRAM_ID))) {
    throw new SporeFailure("Devnet genesis is not configured for this program.");
  }

  const wallet = configuredDevnetGenesisWallet();

  if (!wallet || !wallet.equals(new PublicKey(walletAddress))) {
    throw new SporeFailure("This wallet cannot initialize devnet genesis.");
  }
}

function configuredDevnetGenesisWallet() {
  const value = process.env.EXPO_PUBLIC_SPORE_DEVNET_GENESIS_WALLET;

  if (!value) {
    return null;
  }

  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}
