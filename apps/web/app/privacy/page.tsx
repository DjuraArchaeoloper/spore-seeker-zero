import type { Metadata } from "next";
import { SPORE_PUBLIC_SITE_ORIGIN } from "@spore/shared";
import { LegalDocumentPage } from "../LegalDocumentPage";
import { legalDocuments } from "../legalDocuments";

const document = legalDocuments.privacy;

export const metadata: Metadata = {
  title: document.title,
  description: document.description,
  alternates: {
    canonical: `${SPORE_PUBLIC_SITE_ORIGIN}${document.path}`,
  },
  openGraph: {
    title: document.title,
    description: document.description,
    url: document.path,
    siteName: "SPØR",
    type: "website",
  },
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={document} />;
}
