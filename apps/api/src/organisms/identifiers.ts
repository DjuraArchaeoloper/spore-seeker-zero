const DECIMAL_DIGITS = /^[0-9]+$/;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;
const MAX_U64_DECIMAL = "18446744073709551615";
const U64_SORT_KEY_LENGTH = MAX_U64_DECIMAL.length;

export function normalizeOrganismNumber(value: unknown) {
  if (typeof value !== "string" || !DECIMAL_DIGITS.test(value)) {
    return null;
  }

  const normalized = value.replace(/^0+/, "") || "0";

  if (
    normalized.length > MAX_U64_DECIMAL.length ||
    (normalized.length === MAX_U64_DECIMAL.length && normalized > MAX_U64_DECIMAL)
  ) {
    return null;
  }

  return normalized;
}

export function normalizeTransactionSignature(value: unknown) {
  if (
    typeof value !== "string" ||
    !BASE58_PATTERN.test(value) ||
    value.length < 80 ||
    value.length > 96
  ) {
    return null;
  }

  return value;
}

export function getBirthReference(organismNumber: string, transactionSignature: string) {
  return `${transactionSignature}:${organismNumber}`;
}

export function toOrganismNumberSortKey(organismNumber: string) {
  return organismNumber.padStart(U64_SORT_KEY_LENGTH, "0");
}
