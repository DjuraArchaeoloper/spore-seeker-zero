export const SPORE_PUBLIC_SITE_ORIGIN = "https://sporseekerzero.fun";

export const SPORE_LEGAL_URLS = {
  terms: `${SPORE_PUBLIC_SITE_ORIGIN}/terms`,
  privacy: `${SPORE_PUBLIC_SITE_ORIGIN}/privacy`,
  dataDeletion: `${SPORE_PUBLIC_SITE_ORIGIN}/data-deletion`,
} as const;

export type SporeLegalDocument = keyof typeof SPORE_LEGAL_URLS;
