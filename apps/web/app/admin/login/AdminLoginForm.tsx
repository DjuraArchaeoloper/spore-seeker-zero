"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (step !== "code") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      });
      if (!response.ok) {
        setMessage(response.status === 400 ? "Enter a valid email address." : "Could not request a code. Try again shortly.");
        return;
      }
      setStep("code");
      setCode("");
      setResendAt(Date.now() + 60_000);
      setMessage("If this email is approved, a code is on its way.");
    } catch {
      setMessage("Could not request a code. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
        cache: "no-store",
      });
      if (!response.ok) {
        setMessage(response.status === 401 ? "Code invalid or expired." : "Sign-in is unavailable. Try again shortly.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setMessage("Sign-in is unavailable. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return step === "email" ? (
    <form className="adminForm" onSubmit={requestCode}>
      <label htmlFor="admin-email">EMAIL</label>
      <input
        id="admin-email"
        type="email"
        autoComplete="email"
        value={email}
        maxLength={254}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button type="submit" disabled={busy}>{busy ? "REQUESTING…" : "SEND CODE"}</button>
      {message && <p className="adminMessage" role="status">{message}</p>}
    </form>
  ) : (
    <form className="adminForm" onSubmit={verifyCode}>
      <p className="adminDestination">ENTER CODE FOR <span>{email}</span></p>
      <label htmlFor="admin-code">ONE-TIME CODE</label>
      <input
        id="admin-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
        required
      />
      <button type="submit" disabled={busy || code.length !== 6}>{busy ? "VERIFYING…" : "VERIFY CODE"}</button>
      <div className="adminSecondaryActions">
        <button type="button" disabled={busy || now < resendAt} onClick={() => void requestCode()}>
          {now < resendAt ? `RESEND IN ${Math.ceil((resendAt - now) / 1000)}S` : "RESEND CODE"}
        </button>
        <button type="button" disabled={busy} onClick={() => { setStep("email"); setMessage(""); }}>
          CHANGE EMAIL
        </button>
      </div>
      {message && <p className="adminMessage" role="status">{message}</p>}
    </form>
  );
}
