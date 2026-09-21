export const EMPTY_SPORE_COMMITMENT_HEX = "0".repeat(64);
export const SPORE_SECRET_BYTE_LENGTH = 32;
export const GENOME_BYTE_LENGTH = 16;
export const COMMITMENT_BYTE_LENGTH = 32;

export function unixSecondsNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function dateFromUnixSeconds(seconds: number | bigint): Date {
  return new Date(Number(seconds) * 1000);
}

export function unixSecondsFromDate(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hex encoding.");
  }

  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function assertSporeSecret(secret: Uint8Array): void {
  if (secret.length !== SPORE_SECRET_BYTE_LENGTH) {
    throw new Error("Spore secret must be 32 bytes.");
  }

  if (!secret.some((byte) => byte !== 0)) {
    throw new Error("Spore secret must be non-zero.");
  }
}
