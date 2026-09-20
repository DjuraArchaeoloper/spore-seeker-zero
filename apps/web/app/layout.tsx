import type { Metadata, Viewport } from "next";
import { Michroma } from "next/font/google";
import "./globals.css";

const description = "A digital species spreading from one Solana Seeker to another.";
const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "SPØR · Seeker Zero",
  description,
  openGraph: {
    title: "SPØR · Seeker Zero",
    description,
    siteName: "SPØR",
    type: "website"
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#03080d"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={michroma.className}>{children}</body>
    </html>
  );
}
