"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("Logout failed.");
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Could not end the session. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="adminLogout">
      <button type="button" onClick={logout} disabled={busy}>{busy ? "SIGNING OUT…" : "SIGN OUT"}</button>
      {error && <p className="adminMessage" role="alert">{error}</p>}
    </div>
  );
}
