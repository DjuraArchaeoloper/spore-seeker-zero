import { PublicKey, SystemProgram } from "@solana/web3.js";
import { SporeFailure } from "./payload";

type SporeEnvironment = "mainnet" | "devnet";
type SporeCluster = "mainnet" | "devnet";

const CURRENT_DEVNET_GENESIS_PROGRAM_ID =
  "9HvZ7ckadQt38R1KxYPhP759yCCx4MRF8NBquV4HUUXZ";
const MAX_METADATA_BASE_URI_LENGTH = 96;

const GENESIS_HASHES: Record<SporeCluster, string> = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
};

export function sporeEnv(): SporeEnvironment {
  const env = process.env.EXPO_PUBLIC_SPORE_ENV?.trim();

  if (!env) {
    throw new SporeFailure("SPØR environment is not configured.");
  }

  if (env !== "mainnet" && env !== "devnet") {
    throw new SporeFailure("SPØR environment is not configured.");
  }

  return env;
}

export function sporeCluster(): SporeCluster {
  const cluster = process.env.EXPO_PUBLIC_SPORE_SOLANA_CLUSTER?.trim();

  // No silent mainnet default — a missing bake-time env makes MWA authorize
  // as solana:mainnet and Solflare reports Network Mismatch on a DEVNET wallet.
  if (!cluster) {
    throw new SporeFailure("SPØR Solana cluster is not configured.");
  }

  if (cluster !== "mainnet" && cluster !== "devnet") {
    throw new SporeFailure("SPØR Solana cluster is not configured.");
  }

  const env = sporeEnv();

  if (cluster !== env) {
    throw new SporeFailure("SPØR Solana cluster does not match the app environment.");
  }

  return cluster;
}

export function sporeGenesisHash() {
  return GENESIS_HASHES[sporeCluster()];
}

/**
 * MWA authorize `chain` value. With EXPO_PUBLIC_SPORE_SOLANA_CLUSTER=devnet
 * this is exactly `solana:devnet` (CAIP-2 / MWA 2.0).
 */
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
  const value = sporeApiBaseUrl();

  if (
    value.length > MAX_METADATA_BASE_URI_LENGTH
  ) {
    throw new SporeFailure("SPØR metadata URI is not configured.");
  }

  return value;
}

export function assertSporeEnvironmentConfigured() {
  const env = sporeEnv();
  const cluster = sporeCluster();
  const mode = sporeReproductionMode();
  const apiUrl = sporeApiBaseUrl();
  const rpcUrl = sporeRpcUrl();

  sporeProgramId();

  if (env === "mainnet") {
    if (cluster !== "mainnet" || mode !== "server") {
      throw new SporeFailure("SPØR mainnet must use server reproduction.");
    }

    if (process.env.EXPO_PUBLIC_SPORE_VISUAL_PREVIEW === "true") {
      throw new SporeFailure("SPØR mainnet cannot run in visual preview.");
    }

    if (process.env.EXPO_PUBLIC_SPORE_DEVNET_GENESIS_ENABLED === "true") {
      throw new SporeFailure("SPØR mainnet cannot enable devnet genesis.");
    }

    if (isNonProductionMainnetHost(hostnameFromUrl(apiUrl))) {
      throw new SporeFailure("SPØR mainnet API URL cannot point at a non-production host.");
    }

    if (isNonProductionMainnetHost(hostnameFromUrl(rpcUrl))) {
      throw new SporeFailure("SPØR mainnet RPC URL cannot point at a non-production host.");
    }
  }
}

export function isDevnetGenesisCandidate(walletAddress: string) {
  try {
    // Server-era production must never take the Anchor genesis path.
    if (sporeReproductionMode() === "server") {
      return false;
    }

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
  if (sporeReproductionMode() === "server") {
    throw new SporeFailure("Anchor genesis is unavailable in server reproduction mode.");
  }
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

/**
 * `server` (default): mobile uses /api/spore/* for release/claim.
 * `anchor_legacy`: reserved for explicit legacy Anchor reproduction testing.
 */
export function sporeReproductionMode(): "server" | "anchor_legacy" {
  const value = process.env.EXPO_PUBLIC_SPORE_REPRODUCTION_MODE ?? "server";

  if (value !== "server" && value !== "anchor_legacy") {
    throw new SporeFailure("SPØR reproduction mode is not configured.");
  }

  if (sporeEnv() === "mainnet" && value !== "server") {
    throw new SporeFailure("SPØR mainnet must use server reproduction.");
  }

  return value;
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

function sporeApiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_SPORE_API_URL?.replace(/\/+$/, "");

  if (!value || !isAllowedPublicUrl(value, sporeEnv())) {
    throw new SporeFailure("SPØR API URL is not configured.");
  }

  return value;
}

function sporeRpcUrl() {
  const value = process.env.EXPO_PUBLIC_SPORE_RPC_URL?.trim();

  if (!value || !isAllowedPublicUrl(value, sporeEnv())) {
    throw new SporeFailure("SPØR RPC is not configured.");
  }

  return value;
}

function isAllowedPublicUrl(value: string, env: SporeEnvironment) {
  const hostname = hostnameFromUrl(value);

  if (!hostname) {
    return false;
  }

  if (/^https:\/\//i.test(value)) {
    return true;
  }

  return (
    env === "devnet" &&
    /^http:\/\//i.test(value) &&
    isLocalOrPrivateDevelopmentHost(hostname)
  );
}

function hostnameFromUrl(value: string) {
  const match = /^https?:\/\/(?:\[([^\]]+)\]|([^/?#:]+))(?::[0-9]+)?(?:[/?#]|$)/i.exec(value);
  return (match?.[1] ?? match?.[2] ?? "").toLowerCase();
}

function isNonProductionMainnetHost(hostname: string) {
  return (
    isLocalOrPrivateDevelopmentHost(hostname) ||
    hostname.includes("devnet") ||
    hostname.includes("testnet") ||
    hostname.includes("staging") ||
    hostname.includes("preview") ||
    hostname.includes("-git-")
  );
}

function isLocalOrPrivateDevelopmentHost(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  ) {
    return true;
  }

  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
    return true;
  }

  const private172 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./.exec(hostname);
  return private172 !== null;
}
