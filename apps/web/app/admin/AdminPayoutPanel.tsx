"use client";

import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import type { StandardConnectFeature } from "@wallet-standard/features";
import type { SolanaSignTransactionFeature } from "@solana/wallet-standard-features";
import { useEffect, useState } from "react";

type Preview = {
  campaignId: string; cluster: "mainnet" | "devnet"; treasuryWallet: string; tokenMint: string;
  decimals: number; treasuryBalanceAtomic: string; recipientCount: number; rewardCount: number;
  totalAtomic: string; unpaidTotalAtomic: string; estimatedBatches: number; missing: { recipientSgtMint: string; reason: string }[];
  lockedRewards: number; mainRunExists: boolean; activeTransactions: number; latestRunId: string | null;
};
type PayoutTx = {
  id: string; index: number; status: "prepared" | "submitted" | "confirmed" | "failed";
  recipientCount: number; totalAtomic: string; unsignedTransactionBase64: string | null;
  signature: string | null; failureReason: string | null; lastValidBlockHeight: number;
};
type Run = { runId: string; kind: "main" | "retry"; createdAt?: string; transactions: PayoutTx[] };
type WalletWithPayout = Wallet & StandardConnectFeature & SolanaSignTransactionFeature;

function supportsPayout(wallet: Wallet): wallet is WalletWithPayout {
  const connect = wallet.features["standard:connect"] as StandardConnectFeature["standard:connect"] | undefined;
  const sign = wallet.features["solana:signTransaction"] as SolanaSignTransactionFeature["solana:signTransaction"] | undefined;
  return !!connect?.connect && !!sign?.signTransaction && sign.supportedTransactionVersions.includes("legacy");
}
function atomic(value: string, decimals: number) {
  const padded = value.padStart(decimals + 1, "0");
  if (!decimals) return padded;
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${padded.slice(0, -decimals)}.${fraction}` : padded.slice(0, -decimals);
}
function bytesFromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
function base64FromBytes(value: Uint8Array) {
  let text = "";
  for (const byte of value) text += String.fromCharCode(byte);
  return btoa(text);
}
async function adminRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET", cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? result?.error ?? "Payout request failed.");
  return result as T;
}

export function AdminPayoutPanel({ campaignId, decimals, onProgress }: { campaignId: string; decimals: number; onProgress: () => void }) {
  const base = `/api/admin/payout/${campaignId}`;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [wallets, setWallets] = useState<WalletWithPayout[]>([]);
  const [walletIndex, setWalletIndex] = useState(0);
  const [connected, setConnected] = useState<{ wallet: WalletWithPayout; account: WalletAccount } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reload() {
    const [previewResult, runResult] = await Promise.allSettled([
      adminRequest<{ preview: Preview }>(`${base}/preview`),
      adminRequest<{ run: Run | null }>(`${base}/run`),
    ]);
    if (previewResult.status === "fulfilled") setPreview(previewResult.value.preview);
    if (runResult.status === "fulfilled") setRun(runResult.value.run);
    if (previewResult.status === "rejected") throw previewResult.reason;
    if (runResult.status === "rejected") throw runResult.reason;
  }

  useEffect(() => {
    const registry = getWallets();
    const update = () => setWallets(registry.get().filter(supportsPayout));
    update();
    const offRegister = registry.on("register", update);
    const offUnregister = registry.on("unregister", update);
    void reload().catch((error) => setMessage(error.message));
    return () => { offRegister(); offUnregister(); };
    // The panel is keyed by campaign ID; a new campaign mounts a fresh flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    if (!run?.transactions.some((transaction) => transaction.status === "submitted")) return;
    let inFlight = false;
    const id = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void adminRequest<{ run: Run | null }>(`${base}/reconcile`, {}).then((result) => {
        setRun(result.run);
        onProgress();
        if (!result.run?.transactions.some((transaction) => transaction.status === "submitted")) void reload();
      }).catch((error) => setMessage(error.message)).finally(() => { inFlight = false; });
    }, 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, run?.runId, run?.transactions.map((transaction) => transaction.status).join(",")]);

  async function connectTreasury() {
    const wallet = wallets[walletIndex];
    if (!wallet || !preview) return;
    setBusy(true); setMessage("");
    try {
      const connect = wallet.features["standard:connect"] as StandardConnectFeature["standard:connect"];
      const { accounts } = await connect.connect();
      const chain = preview.cluster === "mainnet" ? "solana:mainnet" : "solana:devnet";
      const account = accounts.find((item) => item.address === preview.treasuryWallet && item.chains.includes(chain) && item.features.includes("solana:signTransaction"));
      if (!account) throw new Error("Connected wallet is not the configured treasury on this Solana network.");
      setConnected({ wallet, account });
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function prepare(kind: "main" | "retry") {
    if (!connected || !preview || connected.account.address !== preview.treasuryWallet) return;
    setBusy(true); setMessage("");
    try {
      const result = await adminRequest<{ run: Run }>(`${base}/${kind === "main" ? "prepare" : "retry"}`, {});
      setRun(result.run);
      await reload();
      setMessage("Payout prepared. Review the transaction count, then sign with the treasury wallet.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function signAndSubmit() {
    if (!connected || !preview || !run) return;
    setBusy(true); setMessage("");
    try {
      const chain: "solana:mainnet" | "solana:devnet" = preview.cluster === "mainnet" ? "solana:mainnet" : "solana:devnet";
      const sign = connected.wallet.features["solana:signTransaction"] as SolanaSignTransactionFeature["solana:signTransaction"];
      const pending = run.transactions.filter((transaction) => transaction.status === "prepared" && transaction.unsignedTransactionBase64);
      if (!pending.length) throw new Error("No prepared transactions remain to sign.");
      let hadBroadcastWarning = false;
      for (let offset = 0; offset < pending.length; offset += 8) {
        const group = pending.slice(offset, offset + 8);
        const inputs = group.map((transaction) => ({
          account: connected.account, chain,
          transaction: bytesFromBase64(transaction.unsignedTransactionBase64!),
        }));
        let signed: readonly { signedTransaction: Uint8Array }[];
        try {
          // Wallet Standard accepts multiple inputs; compatible wallets may approve the group at once.
          signed = await sign.signTransaction(...inputs);
          if (signed.length !== group.length) throw new Error("Wallet returned an incomplete batch.");
        } catch {
          signed = [];
          for (const input of inputs) {
            const one = await sign.signTransaction(input);
            if (one.length !== 1) throw new Error("Wallet returned an incomplete signature.");
            signed = [...signed, one[0]!];
          }
        }
        for (let index = 0; index < group.length; index += 1) {
          const transaction = group[index]!;
          const result = await adminRequest<{ signature: string; sendWarning: boolean }>(`${base}/submit`, {
            transactionId: transaction.id,
            signedTransactionBase64: base64FromBytes(signed[index]!.signedTransaction),
          });
          if (result.sendWarning) hadBroadcastWarning = true;
        }
        setRun((await adminRequest<{ run: Run }>(`${base}/run`)).run);
      }
      setMessage(hadBroadcastWarning
        ? "A signed transaction is recorded but broadcast is uncertain. Reconcile before retrying."
        : "Signed transactions submitted. Finality is being checked.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); void reload().catch(() => {}); }
  }

  async function reconcile() {
    setBusy(true); setMessage("");
    try {
      setRun((await adminRequest<{ run: Run | null }>(`${base}/reconcile`, {})).run);
      await reload();
      onProgress();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  const counts = { prepared: 0, submitted: 0, confirmed: 0, failed: 0 };
  for (const transaction of run?.transactions ?? []) counts[transaction.status] += 1;
  return <div className="adminPayout">
    <div className="adminDetailBreak" /><h3>Payout review</h3>
    {!preview && <p className="adminMuted">{message ? "Payout preview unavailable." : "Loading payout eligibility and treasury balance…"}</p>}
    {preview && <>
      <div className="adminLine"><span>Recipients / reward rows</span><b>{preview.recipientCount} / {preview.rewardCount}</b></div>
      <div className="adminLine"><span>All unpaid rewards</span><b>{atomic(preview.unpaidTotalAtomic, decimals)} SKR</b></div>
      <div className="adminLine"><span>Ready in this run</span><b>{atomic(preview.totalAtomic, decimals)} SKR</b></div>
      <div className="adminLine"><span>Treasury balance</span><b>{atomic(preview.treasuryBalanceAtomic, decimals)} SKR</b></div>
      <div className="adminLine"><span>Estimated transactions</span><b>{preview.estimatedBatches}</b></div>
      <div className="adminLine"><span>Locked in unresolved transfers</span><b>{preview.lockedRewards}</b></div>
      <div className="adminLine"><span>Missing / invalid recipients</span><b>{preview.missing.length}</b></div>
      <p className="adminMuted">Treasury: {preview.treasuryWallet}<br />Mint: {preview.tokenMint} · {preview.cluster}</p>
      {preview.missing.length > 0 && <details className="adminPayoutMissing"><summary>Review recipients needing a wallet</summary>{preview.missing.map((item) => <p key={item.recipientSgtMint}>{item.recipientSgtMint} · {item.reason}</p>)}</details>}
      {!connected ? <div className="adminPayoutWallet">
        <label>WALLET<select value={walletIndex} onChange={(event) => setWalletIndex(Number(event.target.value))}>{wallets.map((wallet, index) => <option key={`${wallet.name}-${index}`} value={index}>{wallet.name}</option>)}</select></label>
        <button className="adminPrimary" type="button" onClick={() => void connectTreasury()} disabled={busy || wallets.length === 0}>CONNECT TREASURY</button>
        {!wallets.length && <p className="adminMuted">No compatible Solana wallet is available in this browser.</p>}
      </div> : <p className="adminMuted">Connected treasury: {connected.account.address} · {connected.wallet.name}</p>}
      {connected && preview.recipientCount > 0 && preview.activeTransactions === 0 &&
        <button className="adminPrimary" type="button" disabled={busy || BigInt(preview.treasuryBalanceAtomic) < BigInt(preview.totalAtomic)}
          onClick={() => void prepare(preview.mainRunExists ? "retry" : "main")}>
          {preview.mainRunExists ? "PREPARE UNPAID RETRY" : "APPROVE & PREPARE PAYOUT"}
        </button>}
    </>}
    {run && <div className="adminPayoutRun"><h3>{run.kind === "main" ? "Main run" : "Retry run"} · {run.transactions.length} transactions</h3>
      <div className="adminLine"><span>Prepared / submitted / confirmed / failed</span><b>{counts.prepared} / {counts.submitted} / {counts.confirmed} / {counts.failed}</b></div>
      {run.transactions.map((transaction) => <div className="adminLine" key={transaction.id}><span>#{transaction.index + 1} · {transaction.recipientCount} recipients</span><b>{transaction.status}{transaction.signature ? ` · ${transaction.signature.slice(0, 12)}…` : ""}</b></div>)}
      {run.transactions.some((transaction) => transaction.failureReason) && <p className="adminMuted">{run.transactions.filter((transaction) => transaction.failureReason).map((transaction) => `#${transaction.index + 1}: ${transaction.failureReason}`).join(" · ")}</p>}
      <div className="adminPayoutActions">
        {connected && counts.prepared > 0 && <button className="adminPrimary" type="button" disabled={busy} onClick={() => void signAndSubmit()}>{busy ? "WORKING…" : "BATCH SIGN & SUBMIT"}</button>}
        <button className="adminTextAction" type="button" disabled={busy} onClick={() => void reconcile()}>RECONCILE RESULTS</button>
      </div>
      {counts.submitted > 0 && <p className="adminMuted">Submitted transfers remain locked until finality is established. An unknown signature cannot be retried automatically.</p>}
    </div>}
    {message && <p className="adminNotice" role="status">{message}</p>}
  </div>;
}
