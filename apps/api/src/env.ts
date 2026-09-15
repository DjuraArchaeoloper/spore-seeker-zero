const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const authConfig = {
  nonceTtlMs: FIVE_MINUTES_MS,
  sessionTtlMs: SEVEN_DAYS_MS,
  statement: "Sign in to SPOR and verify this Seeker."
} as const;

type RequiredEnvName =
  | "MONGODB_URI"
  | "HELIUS_API_KEY"
  | "SIWS_DOMAIN"
  | "SIWS_URI"
  | "SPORE_PROGRAM_ID"
  | "HELIUS_WEBHOOK_AUTH"
  | "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY"
  | "SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS"
  | "SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS";

export type SolanaCluster = "mainnet" | "devnet";

export function getRequiredEnv(name: RequiredEnvName) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSiwsConfig() {
  return {
    domain: getRequiredEnv("SIWS_DOMAIN"),
    uri: getRequiredEnv("SIWS_URI"),
    statement: authConfig.statement,
    chainId: getSolanaCluster() === "devnet" ? "solana:devnet" : "solana:mainnet"
  };
}

export function getHeliusRpcUrl() {
  const cluster = getSolanaCluster() === "devnet" ? "devnet" : "mainnet";
  return `https://${cluster}.helius-rpc.com/?api-key=${encodeURIComponent(getRequiredEnv("HELIUS_API_KEY"))}`;
}

export function getSporeProgramId() {
  return getRequiredEnv("SPORE_PROGRAM_ID");
}

export function getHeliusWebhookAuth() {
  return getRequiredEnv("HELIUS_WEBHOOK_AUTH");
}

export function getSolanaCluster(): SolanaCluster {
  const value = process.env.SPORE_SOLANA_CLUSTER?.trim() ?? "mainnet";

  if (value !== "mainnet" && value !== "devnet") {
    throw new Error("SPORE_SOLANA_CLUSTER must be mainnet or devnet.");
  }

  return value;
}

export function getSgtVerificationConfig() {
  if (getSolanaCluster() === "devnet") {
    return {
      mintAuthority: getRequiredEnv("SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY"),
      metadataAddress: getRequiredEnv("SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS"),
      groupAddress: getRequiredEnv("SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS")
    };
  }

  return {
    mintAuthority: "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4",
    metadataAddress: "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te",
    groupAddress: "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te"
  };
}
