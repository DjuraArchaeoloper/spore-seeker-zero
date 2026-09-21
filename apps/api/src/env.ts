const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const authConfig = {
  nonceTtlMs: FIVE_MINUTES_MS,
  sessionTtlMs: SEVEN_DAYS_MS,
  statement: "Sign in to SPØR and verify this Seeker."
} as const;

type RequiredEnvName =
  | "MONGODB_URI"
  | "HELIUS_API_KEY"
  | "SIWS_DOMAIN"
  | "SIWS_URI"
  | "SPORE_PROGRAM_ID"
  | "HELIUS_WEBHOOK_AUTH"
  | "SPORE_DEVNET_APPROVED_PROGRAM_ID"
  | "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY"
  | "SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS"
  | "SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS"
  | "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET"
  | "SPORE_DEVNET_SPONSOR_SECRET";

export type SolanaCluster = "mainnet" | "devnet";

export function getRequiredEnv(name: RequiredEnvName) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : null;
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

export function getDevnetTestSgtBootstrapConfig() {
  const enabled = getOptionalEnv("SPORE_DEVNET_TEST_SGT_BOOTSTRAP_ENABLED") === "true";

  if (!enabled) {
    return {
      enabled: false
    } as const;
  }

  return {
    enabled: true,
    approvedProgramId: getRequiredEnv("SPORE_DEVNET_APPROVED_PROGRAM_ID"),
    mintAuthoritySecret: getRequiredEnv("SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET"),
    sponsorSecret: getRequiredEnv("SPORE_DEVNET_SPONSOR_SECRET"),
    testerFundingTargetLamports: getDevnetTesterFundingTargetLamports()
  } as const;
}

function getDevnetTesterFundingTargetLamports() {
  const value = getOptionalEnv("SPORE_DEVNET_TESTER_FUNDING_TARGET_LAMPORTS");

  if (!value) {
    return 100_000_000;
  }

  if (!/^[0-9]+$/.test(value)) {
    throw new Error("SPORE_DEVNET_TESTER_FUNDING_TARGET_LAMPORTS must be an integer lamport amount.");
  }

  const lamports = Number(value);

  if (!Number.isSafeInteger(lamports) || lamports < 0) {
    throw new Error("SPORE_DEVNET_TESTER_FUNDING_TARGET_LAMPORTS must be a safe non-negative integer.");
  }

  return lamports;
}

export function getSporSocialSecret() {
  const value = getOptionalEnv("SPOR_SOCIAL_SECRET");

  if (!value) {
    throw new Error("Missing required environment variable: SPOR_SOCIAL_SECRET");
  }

  return value;
}

export type SporeReproductionMode = "server" | "anchor_legacy";

/**
 * Production default is server-era reproduction (Mongo + settlement + Core).
 * `anchor_legacy` is only for explicit legacy/devnet Anchor testing.
 */
export function getSporeReproductionMode(): SporeReproductionMode {
  const value = process.env.SPORE_REPRODUCTION_MODE?.trim() ?? "server";

  if (value !== "server" && value !== "anchor_legacy") {
    throw new Error("SPORE_REPRODUCTION_MODE must be server or anchor_legacy.");
  }

  return value;
}

export function assertServerReproductionEnabled() {
  if (getSporeReproductionMode() !== "server") {
    throw new Error(
      "Server-era /api/spore reproduction is disabled (SPORE_REPRODUCTION_MODE)."
    );
  }
}

/** Optional server-era secrets used by settlement / Core finalization / bootstrap. */
export function getSporeServerEraConfig() {
  return {
    serverAuthoritySecret: getOptionalEnv("SPORE_SERVER_AUTHORITY_SECRET"),
    assetDerivationSecret: getOptionalEnv("SPORE_ASSET_DERIVATION_SECRET"),
    treasury: getOptionalEnv("SPORE_TREASURY"),
    birthFeeLamports: getOptionalEnv("SPORE_BIRTH_FEE_LAMPORTS"),
    metadataBaseUri: getOptionalEnv("SPORE_METADATA_BASE_URI")
  };
}

export function getCronSecret() {
  const value = getOptionalEnv("CRON_SECRET");

  if (!value) {
    throw new Error("Missing required environment variable: CRON_SECRET");
  }

  return value;
}

export function getXOauth1Credentials() {
  const appKey = getOptionalEnv("X_API_KEY");
  const appSecret = getOptionalEnv("X_API_KEY_SECRET");
  const accessToken = getOptionalEnv("X_ACCESS_TOKEN");
  const accessSecret = getOptionalEnv("X_ACCESS_TOKEN_SECRET");

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Missing required X OAuth environment variables.");
  }

  return {
    appKey,
    appSecret,
    accessToken,
    accessSecret
  };
}
