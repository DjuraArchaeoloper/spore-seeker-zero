import type { Metadata, Viewport } from "next";
import { Michroma } from "next/font/google";
import "./globals.css";

const description =
  "A digital species spreading from one Solana Seeker to another.";
const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const ogImage = {
  url: "/opengraph.png",
  width: 1200,
  height: 630,
  alt: "SPØR · Seeker Zero",
} as const;

const siteUrl = "https://sporseekerzero.fun"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Cognios",

  title: "SPØR · Seeker Zero",
  description,
  openGraph: {
    title: "SPØR · Seeker Zero",
    description,
    siteName: "SPØR",
    type: "website",
    url: "/",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "SPØR · Seeker Zero",
    description,
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#03080d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={michroma.className}>{children}</body>
    </html>
  );
}
