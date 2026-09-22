/**
 * Static Solana env checks only — never call Helius/Solana from boot.
 * Live cluster/genesis verification runs lazily in getVerifiedSolanaConnection().
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { assertSolanaStaticConfiguration } = await import("./src/env");
  assertSolanaStaticConfiguration();
}
