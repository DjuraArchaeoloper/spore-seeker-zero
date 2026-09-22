/**
 * Fail fast on Node boot when SPORE_SOLANA_CLUSTER and the Helius RPC disagree,
 * or when the cluster env is missing (no silent mainnet default).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { assertConfiguredSolanaNetwork } = await import("./src/env");
  await assertConfiguredSolanaNetwork();
}
