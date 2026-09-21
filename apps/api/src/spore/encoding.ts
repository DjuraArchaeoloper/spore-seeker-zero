import { PublicKey } from "@solana/web3.js";

import { getSporeProgramId } from "../env";

const ORGANISM_SEED = Buffer.from("organism");

/**
 * Logical organism identity for server-era state.
 *
 * Derived with the same seeds as the historical Anchor Organism PDA
 * (`["organism", sgt_mint]` under SPORE_PROGRAM_ID) so bloodline/parent
 * references stay compatible across eras.
 *
 * This does **not** create or require an on-chain Organism account.
 * Server-era births are canonical in Mongo (+ Metaplex Core), not in a
 * custom SPØR program account.
 */
export function deriveOrganismIdentity(sgtMint: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [ORGANISM_SEED, new PublicKey(sgtMint).toBuffer()],
    new PublicKey(getSporeProgramId())
  );

  return pda.toBase58();
}

export function pubkeyToBytes(base58: string): Uint8Array {
  return new PublicKey(base58).toBytes();
}
