/**
 * One-time Seeker Zero bootstrap (server-era).
 *
 * Usage (from apps/api, with env loaded):
 *   SPORE_BOOTSTRAP_SEEKER_ZERO=true \
 *   SPORE_BOOTSTRAP_SEEKER_ZERO_SGT=... \
 *   SPORE_BOOTSTRAP_SEEKER_ZERO_WALLET=... \
 *   SPORE_TREASURY=... \
 *   SPORE_BIRTH_FEE_LAMPORTS=... \
 *   SPORE_METADATA_BASE_URI=https://... \
 *   SPORE_SERVER_AUTHORITY_SECRET='[...]' \
 *   npx --yes tsx scripts/bootstrap-seeker-zero.ts
 *
 * Not exposed as a public HTTP route. Impossible to mint arbitrary organisms.
 */

import { bootstrapSeekerZero } from "../src/spore/bootstrapSeekerZero";
import { SporeDomainError } from "../src/spore/errors";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  if (process.env.SPORE_BOOTSTRAP_SEEKER_ZERO?.trim() !== "true") {
    throw new Error(
      "Refusing to run: set SPORE_BOOTSTRAP_SEEKER_ZERO=true explicitly."
    );
  }

  const result = await bootstrapSeekerZero({
    seekerZeroSgtMint: requireEnv("SPORE_BOOTSTRAP_SEEKER_ZERO_SGT"),
    seekerZeroWallet: requireEnv("SPORE_BOOTSTRAP_SEEKER_ZERO_WALLET"),
    treasury: requireEnv("SPORE_TREASURY"),
    birthFeeLamports: requireEnv("SPORE_BIRTH_FEE_LAMPORTS"),
    metadataBaseUri: requireEnv("SPORE_METADATA_BASE_URI")
  });

  // Never print secrets. Identity addresses only.
  console.log(
    JSON.stringify(
      {
        ok: true,
        organismNumber: result.organism.organismNumber,
        organismIdentity: result.organism.organismPda,
        sgtMint: result.organism.sgtMint,
        coreAsset: result.coreAsset,
        nextOrganismNumber: "1",
        totalOrganisms: "1"
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  if (error instanceof SporeDomainError) {
    console.error(`Bootstrap failed: ${error.code}: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`Bootstrap failed: ${error.message}`);
  } else {
    console.error("Bootstrap failed.");
  }
  process.exitCode = 1;
});
