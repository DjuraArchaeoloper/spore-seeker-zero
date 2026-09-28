const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_METADATA_BASE_URI_LENGTH = 96;

export const authConfig = {
  nonceTtlMs: FIVE_MINUTES_MS,
  sessionTtlMs: SEVEN_DAYS_MS,
  statement: "Sign in to SPØR and verify this Seeker."
} as const;

type RequiredEnvName =
  | "SPORE_ENV"
  | "MONGODB_URI"
  | "HELIUS_API_KEY"
  | "SIWS_DOMAIN"
  | "SIWS_URI"
  | "SPORE_PROGRAM_ID"
  | "HELIUS_WEBHOOK_AUTH"
  | "SPORE_TREASURY"
  | "SPORE_BIRTH_FEE_LAMPORTS"
  | "SPORE_METADATA_BASE_URI"
  | "SPORE_SERVER_AUTHORITY_SECRET"
  | "SPORE_ASSET_DERIVATION_SECRET"
  | "SPORE_DEVNET_APPROVED_PROGRAM_ID"
  | "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY"
  | "SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS"
  | "SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS"
  | "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET"
  | "SPORE_DEVNET_SPONSOR_SECRET";

export type SporeEnvironment = "mainnet" | "devnet";
export type SolanaCluster = "mainnet" | "devnet";

/** Canonical Solana genesis hashes used to detect cluster/RPC disagreement. */
export const SOLANA_GENESIS_HASHES: Record<SolanaCluster, string> = {
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
};

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

export function getSporeEnv(): SporeEnvironment {
  const value = process.env.SPORE_ENV?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SPORE_ENV");
  }

  if (value !== "mainnet" && value !== "devnet") {
    throw new Error("SPORE_ENV must be mainnet or devnet.");
  }

  return value;
}

/**
 * Cluster-selected Helius RPC URL used by every server-side Solana call
 * (settlement construction, simulation, verification, Core finalization).
 * Controlled by SPORE_SOLANA_CLUSTER + HELIUS_API_KEY — never hardcode hosts elsewhere.
 */
export function getHeliusRpcUrl() {
  const cluster = getSolanaCluster();
  const rpcUrl = buildHeliusRpcUrl(cluster);
  assertRpcUrlMatchesCluster(rpcUrl, cluster);
  return rpcUrl;
}

function buildHeliusRpcUrl(cluster: SolanaCluster) {
  return `https://${cluster}.helius-rpc.com/?api-key=${encodeURIComponent(getRequiredEnv("HELIUS_API_KEY"))}`;
}

export function getSporeProgramId() {
  const value = getRequiredEnv("SPORE_PROGRAM_ID");

  if (!PUBLIC_KEY_PATTERN.test(value) || value === "11111111111111111111111111111111") {
    throw new Error(
      "SPORE_PROGRAM_ID must be a stable non-system Solana public key namespace."
    );
  }

  return value;
}

export function getHeliusWebhookAuth() {
  return getRequiredEnv("HELIUS_WEBHOOK_AUTH");
}

export function getMongoUri() {
  const uri = getRequiredEnv("MONGODB_URI");
  const databaseName = getMongoDatabaseName(uri);
  const env = getSporeEnv();
  const normalized = databaseName.toLowerCase();

  if (env === "devnet" && !/(^|[_-])(dev|devnet)([_-]|$)/.test(normalized)) {
    throw new Error(
      "SPORE_ENV=devnet requires MONGODB_URI to name a dev/devnet database."
    );
  }

  if (env === "mainnet") {
    if (!/(^|[_-])(mainnet|prod|production)([_-]|$)/.test(normalized)) {
      throw new Error(
        "SPORE_ENV=mainnet requires MONGODB_URI to name a mainnet/prod database."
      );
    }

    if (/(^|[_-])(dev|devnet|test|local|fresh)([_-]|$)/.test(normalized)) {
      throw new Error(
        "SPORE_ENV=mainnet must not use a devnet/test/local Mongo database."
      );
    }
  }

  return uri;
}

export function getCanonicalPublicApiUrl() {
  const value = getRequiredEnv("SPORE_METADATA_BASE_URI").replace(/\/+$/, "");

  assertPublicUrlForEnvironment("SPORE_METADATA_BASE_URI", value, getSporeEnv());

  if (value.length > MAX_METADATA_BASE_URI_LENGTH) {
    throw new Error("SPORE_METADATA_BASE_URI exceeds the 96 byte Core URI limit.");
  }

  return value;
}

/**
 * Explicit cluster selection. No silent mainnet default — Preview/devnet hosts
 * must set SPORE_SOLANA_CLUSTER=devnet or settlement will build the wrong network.
 */
export function getSolanaCluster(): SolanaCluster {
  const value = process.env.SPORE_SOLANA_CLUSTER?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SPORE_SOLANA_CLUSTER");
  }

  if (value !== "mainnet" && value !== "devnet") {
    throw new Error("SPORE_SOLANA_CLUSTER must be mainnet or devnet.");
  }

  const env = getSporeEnv();

  if (env !== value) {
    throw new Error(
      `SPORE_ENV=${env} requires SPORE_SOLANA_CLUSTER=${env}.`
    );
  }

  return value;
}

/**
 * Boot-safe checks only. Mainnet requires the full production configuration;
 * devnet validates only the always-required identity/state boundary.
 * Does not perform any network/RPC fetches.
 */
export function assertSolanaStaticConfiguration() {
  assertServerEnvironmentConfiguration();
}

export function assertServerEnvironmentConfiguration() {
  const env = getSporeEnv();

  getSolanaCluster();
  getMongoUri();
  getSporeProgramId();

  if (env === "mainnet") {
    assertMainnetFailClosedConfiguration();
    return;
  }

  assertOptionalDevnetConfiguration();
}

/**
 * Live cluster/genesis verification against the configured RPC.
 * Lazy + cached per process; concurrent callers share one in-flight promise.
 * Call only from Solana-dependent paths (e.g. getVerifiedSolanaConnection).
 */
let configuredNetworkAssert: Promise<void> | null = null;

export async function assertConfiguredSolanaNetwork() {
  if (!configuredNetworkAssert) {
    configuredNetworkAssert = runConfiguredSolanaNetworkAssert().catch((error) => {
      configuredNetworkAssert = null;
      throw error;
    });
  }

  await configuredNetworkAssert;
}

async function runConfiguredSolanaNetworkAssert() {
  const cluster = getSolanaCluster();
  const rpcUrl = getHeliusRpcUrl();
  const mode = getSporeReproductionMode();

  // Hostname alignment is already enforced by getHeliusRpcUrl().
  // In server reproduction mode, also verify live RPC genesis so a wrong-network
  // endpoint cannot silently produce mainnet settlement transactions on "devnet".
  if (mode !== "server") {
    return;
  }

  const { Connection } = await import("@solana/web3.js");
  const connection = new Connection(rpcUrl, "confirmed");
  const genesisHash = await connection.getGenesisHash();

  if (genesisHash !== SOLANA_GENESIS_HASHES[cluster]) {
    throw new Error(
      `Solana cluster/RPC mismatch: SPORE_SOLANA_CLUSTER=${cluster} but the RPC genesis hash does not match that cluster.`
    );
  }
}

function assertRpcUrlMatchesCluster(rpcUrl: string, cluster: SolanaCluster) {
  let hostname: string;

  try {
    hostname = new URL(rpcUrl).hostname.toLowerCase();
  } catch {
    throw new Error("Solana RPC configuration is invalid.");
  }

  if (cluster === "devnet") {
    if (!hostname.includes("devnet")) {
      throw new Error(
        "Solana cluster/RPC mismatch: SPORE_SOLANA_CLUSTER is devnet but the RPC endpoint is not."
      );
    }
    return;
  }

  if (hostname.includes("devnet") || !hostname.includes("mainnet")) {
    throw new Error(
      "Solana cluster/RPC mismatch: SPORE_SOLANA_CLUSTER is mainnet but the RPC endpoint is not."
    );
  }
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

  if (getSporeEnv() === "mainnet" && enabled) {
    throw new Error("SPORE_ENV=mainnet must not enable devnet Test SGT bootstrap.");
  }

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

  if (getSporeEnv() === "mainnet" && value !== "server") {
    throw new Error("SPORE_ENV=mainnet requires SPORE_REPRODUCTION_MODE=server.");
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

export function isVerboseSolanaDiagnosticsEnabled() {
  return (
    getSporeEnv() !== "mainnet" &&
    getOptionalEnv("SPORE_VERBOSE_SOLANA_DIAGNOSTICS") === "true"
  );
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

function assertMainnetFailClosedConfiguration() {
  getHeliusRpcUrl();
  getHeliusWebhookAuth();
  getCanonicalPublicApiUrl();
  assertSiwsConfiguration();

  if (getSporeReproductionMode() !== "server") {
    throw new Error("SPORE_ENV=mainnet requires server reproduction mode.");
  }

  if (getOptionalEnv("VERCEL_ENV") === "preview") {
    throw new Error("SPORE_ENV=mainnet must not run in a Vercel preview environment.");
  }

  if (getOptionalEnv("SPORE_VERBOSE_SOLANA_DIAGNOSTICS") === "true") {
    throw new Error("SPORE_ENV=mainnet must not enable verbose Solana diagnostics.");
  }

  for (const name of [
    "SPORE_DEVNET_TEST_SGT_BOOTSTRAP_ENABLED",
    "SPORE_DEVNET_APPROVED_PROGRAM_ID",
    "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY",
    "SPORE_DEVNET_TEST_SGT_METADATA_ADDRESS",
    "SPORE_DEVNET_TEST_SGT_GROUP_ADDRESS",
    "SPORE_DEVNET_TEST_SGT_MINT_AUTHORITY_SECRET",
    "SPORE_DEVNET_SPONSOR_SECRET",
    "SPORE_DEVNET_SPONSOR_PUBLIC_KEY",
    "SPORE_DEVNET_TESTER_FUNDING_TARGET_LAMPORTS",
    "EXPO_PUBLIC_SPORE_DEVNET_GENESIS_ENABLED"
  ]) {
    if (getOptionalEnv(name)) {
      throw new Error(`SPORE_ENV=mainnet must not define ${name}.`);
    }
  }

  for (const name of [
    "EXPO_PUBLIC_SPORE_VISUAL_PREVIEW",
    "SPORE_VISUAL_PREVIEW"
  ]) {
    if (getOptionalEnv(name) === "true") {
      throw new Error(`SPORE_ENV=mainnet must not enable ${name}.`);
    }
  }

  const metadataHost = new URL(getCanonicalPublicApiUrl()).hostname.toLowerCase();
  const siwsHost = new URL(getSiwsConfig().uri).hostname.toLowerCase();

  if (isNonProductionPublicHost(metadataHost) || isNonProductionPublicHost(siwsHost)) {
    throw new Error("SPORE_ENV=mainnet must not use devnet, local, or preview public URLs.");
  }

  const authoritySecret = getRequiredEnv("SPORE_SERVER_AUTHORITY_SECRET");
  const assetDerivationSecret = getRequiredEnv("SPORE_ASSET_DERIVATION_SECRET");

  if (assetDerivationSecret === authoritySecret) {
    throw new Error(
      "SPORE_ENV=mainnet requires SPORE_ASSET_DERIVATION_SECRET to differ from SPORE_SERVER_AUTHORITY_SECRET."
    );
  }

  assertPublicKey("SPORE_TREASURY", getRequiredEnv("SPORE_TREASURY"));
  assertBirthFeeLamports(getRequiredEnv("SPORE_BIRTH_FEE_LAMPORTS"));
}

function assertSiwsConfiguration() {
  const { domain, uri } = getSiwsConfig();

  assertPublicUrlForEnvironment("SIWS_URI", uri, getSporeEnv());

  const hostname = new URL(uri).hostname.toLowerCase();
  if (domain.toLowerCase() !== hostname) {
    throw new Error("SIWS_DOMAIN must match the hostname of SIWS_URI.");
  }
}

function assertOptionalDevnetConfiguration() {
  const metadataBaseUri = getOptionalEnv("SPORE_METADATA_BASE_URI");
  if (metadataBaseUri) {
    assertPublicUrlForEnvironment(
      "SPORE_METADATA_BASE_URI",
      metadataBaseUri.replace(/\/+$/, ""),
      "devnet",
    );
  }

  const siwsDomain = getOptionalEnv("SIWS_DOMAIN");
  const siwsUri = getOptionalEnv("SIWS_URI");
  if (siwsDomain || siwsUri) {
    assertSiwsConfiguration();
  }

  if (getOptionalEnv("HELIUS_API_KEY")) {
    getHeliusRpcUrl();
  }
}

function assertBirthFeeLamports(value: string) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("SPORE_BIRTH_FEE_LAMPORTS must be a non-negative integer.");
  }

  const lamports = BigInt(value);
  if (lamports > 10_000_000n) {
    throw new Error("SPORE_BIRTH_FEE_LAMPORTS exceeds the protocol maximum.");
  }
}

function assertPublicKey(name: string, value: string) {
  if (!PUBLIC_KEY_PATTERN.test(value) || value === "11111111111111111111111111111111") {
    throw new Error(`${name} must be a valid non-system Solana public key.`);
  }
}

function assertPublicUrlForEnvironment(
  name: string,
  value: string,
  env: SporeEnvironment,
) {
  const url = parseUrl(name, value);

  if (env === "mainnet") {
    if (url.protocol !== "https:" || !url.hostname) {
      throw new Error(`${name} must be a valid HTTPS URL.`);
    }
    return;
  }

  if (url.protocol === "https:") {
    return;
  }

  if (url.protocol === "http:" && isLocalDevelopmentHost(url.hostname.toLowerCase())) {
    return;
  }

  throw new Error(`${name} must be HTTPS, or HTTP localhost for SPORE_ENV=devnet.`);
}

function parseUrl(name: string, value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!url.hostname) {
    throw new Error(`${name} must include a hostname.`);
  }

  return url;
}

function isLocalDevelopmentHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isNonProductionPublicHost(hostname: string) {
  return (
    isLocalDevelopmentHost(hostname) ||
    hostname.includes("devnet") ||
    hostname.includes("testnet") ||
    hostname.includes("staging") ||
    hostname.includes("preview") ||
    hostname.includes("-git-")
  );
}

function getMongoDatabaseName(uri: string) {
  let url: URL;

  try {
    url = new URL(uri);
  } catch {
    throw new Error("MONGODB_URI must be a valid MongoDB connection URI.");
  }

  if (url.protocol !== "mongodb:" && url.protocol !== "mongodb+srv:") {
    throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://.");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "");

  if (!databaseName || databaseName === "admin" || databaseName === "local") {
    throw new Error("MONGODB_URI must include an explicit application database name.");
  }

  return databaseName;
}
