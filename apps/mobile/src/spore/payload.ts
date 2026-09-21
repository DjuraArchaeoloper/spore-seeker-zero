import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";

export class SporeFailure extends Error {}
export type ClaimPayload = { parent: PublicKey; secret: Uint8Array };
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function validateSecret(secret: Uint8Array) {
  if (secret.length !== 32 || !secret.some(Boolean)) throw new SporeFailure("Malformed spore secret.");
}
export const commitment = (secret: Uint8Array) => {
  validateSecret(secret);
  return sha256(secret);
};
/** Base64url (no padding) encoding for spore secrets sent to the API. */
export function encodeSecretBase64Url(secret: Uint8Array) {
  validateSecret(secret);
  return encode(secret);
}
export function serializeClaim({ parent, secret }: ClaimPayload) {
  validateSecret(secret);
  return `spore://claim?v=1&p=${parent.toBase58()}&s=${encode(secret)}`;
}
export function parseClaim(input: string): ClaimPayload {
  // Deliberately no URL normalization, percent decoding, fragments or extra fields.
  if (input.length > 180 || !input.startsWith("spore://claim?")) throw new SporeFailure("Invalid spore QR.");
  const fields = input.slice(14).split("&");
  const params = new Map<string, string>();
  for (const field of fields) {
    const match = /^(v|p|s)=([^=&?#%]+)$/.exec(field);
    if (!match || params.has(match[1])) throw new SporeFailure("Invalid spore QR.");
    params.set(match[1], match[2]);
  }
  if (params.size !== 3) throw new SporeFailure("Invalid spore QR.");
  if (params.get("v") !== "1") throw new SporeFailure("Unsupported spore QR version.");
  const encoded = params.get("s")!;
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new SporeFailure("Malformed spore secret.");
  const secret = new Uint8Array(Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  if (secret.length !== 32 || encode(secret) !== encoded || !secret.some(Boolean)) {
    secret.fill(0);
    throw new SporeFailure("Malformed spore secret.");
  }
  try {
    const parent = new PublicKey(params.get("p")!);
    if (parent.toBase58() !== params.get("p")) throw new Error();
    return { parent, secret };
  } catch {
    secret.fill(0);
    throw new SporeFailure("Invalid spore QR.");
  }
}
export function sporeMessage(error: unknown) {
  // Never surface/log RPC objects: they can contain serialized claim instructions.
  if (error instanceof SporeFailure) return error.message;
  if (error instanceof Error && error.message && !error.message.includes("{")) {
    // Preserve short transport failures without dumping payloads.
    if (error.message.length <= 120) return error.message;
  }
  return "Unable to reach SPØR. Please try again.";
}
