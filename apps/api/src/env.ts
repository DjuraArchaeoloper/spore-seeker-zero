const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const authConfig = {
  nonceTtlMs: FIVE_MINUTES_MS,
  sessionTtlMs: SEVEN_DAYS_MS,
  statement: "Sign in to SPORE and verify this Seeker."
} as const;

type RequiredEnvName =
  | "MONGODB_URI"
  | "HELIUS_API_KEY"
  | "SIWS_DOMAIN"
  | "SIWS_URI"
  | "SPORE_PROGRAM_ID"
  | "HELIUS_WEBHOOK_AUTH";

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
    statement: authConfig.statement
  };
}

export function getHeliusRpcUrl() {
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(getRequiredEnv("HELIUS_API_KEY"))}`;
}

export function getSporeProgramId() {
  return getRequiredEnv("SPORE_PROGRAM_ID");
}

export function getHeliusWebhookAuth() {
  return getRequiredEnv("HELIUS_WEBHOOK_AUTH");
}
