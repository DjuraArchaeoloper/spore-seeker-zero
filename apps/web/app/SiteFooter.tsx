import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="siteFooter" aria-label="Site footer">
      <Link href="/terms">Terms</Link>
      <Link href="/privacy">Privacy</Link>
      <Link href="/data-deletion">Data Deletion</Link>
    </footer>
  );
}
