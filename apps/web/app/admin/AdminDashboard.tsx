"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminPayoutPanel } from "./AdminPayoutPanel";

type Lifecycle = "scheduled" | "active" | "ended" | "cancelled";
type Campaign = {
  seasonId: string; title: string; startsAt: string; endsAt: string; cancelledAt: string | null;
  lifecycle: Lifecycle; parentRewardAtomic: string; newSeekerRewardAtomic: string;
  budgetAtomic: string; tokenMint: string; decimals: number; fundedBirths: string;
  committedAtomic: string; remainingAtomic: string;
  budgetUsageBps: number;
};
type CampaignDetail = Campaign & {
  qualifyingBirths: number; uniqueRewardedSgts: number; parentRewards: number; newSeekerRewards: number;
  parentRewardTotalAtomic: string; newSeekerRewardTotalAtomic: string;
  payoutCounts: Record<string, number>; points: { total: number; direct: number; lineage: number };
};
type Overview = {
  totalPopulation: string; births: number; directReproduction: { last30Days: number; uniqueParents: number };
  pointsTotal: number; payoutCounts: Record<string, number>; campaignCounts: Record<Lifecycle, number>;
  activeCampaign: CampaignDetail | null; nextScheduled: Campaign | null;
  topDescendants: { organismNumber: string; totalDescendants: number }[];
};
type Reward = {
  id: string; campaignId: string; campaignTitle: string; birth: string; recipientSgtMint: string;
  role: "parent" | "newSeeker"; amountAtomic: string; decimals: number;
  payoutStatus: string; createdAt: string;
};
type Ledger = { rows: Reward[]; total: number; page: number; limit: number };
type Tab = "overview" | "campaigns" | "rewards" | "history";
type FormState = {
  title: string; startsAt: string; endsAt: string; parentReward: string;
  newSeekerReward: string; budget: string; tokenMint: string; decimals: string;
};
const emptyForm: FormState = {
  title: "", startsAt: "", endsAt: "", parentReward: "", newSeekerReward: "",
  budget: "", tokenMint: "", decimals: "6",
};

function formatAtomic(value: string, decimals: number) {
  if (!/^\d+$/.test(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return value;
  const padded = value.padStart(decimals + 1, "0");
  if (!decimals) return padded;
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}
function localInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 19);
}
function compact(value: string) {
  return value.length > 23 ? `${value.slice(0, 11)}…${value.slice(-8)}` : value;
}

export function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const read = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(path, { cache: "no-store", ...init });
    if (response.status === 401) { router.replace("/admin/login"); throw new Error("Admin session expired."); }
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message ?? result?.error ?? "Request failed.");
    return result as T;
  }, [router]);

  const refresh = useCallback(async () => {
    const [overviewResult, campaignResult] = await Promise.all([
      read<{ overview: Overview }>("/api/admin/overview"),
      read<{ campaigns: Campaign[] }>("/api/admin/campaigns"),
    ]);
    setOverview(overviewResult.overview);
    setCampaigns(campaignResult.campaigns);
  }, [read]);

  useEffect(() => {
    let alive = true;
    void refresh().catch((error) => { if (alive) setMessage(error.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refresh]);

  useEffect(() => {
    if (tab !== "rewards") return;
    const query = new URLSearchParams({ page: String(page) });
    if (filterCampaign) query.set("campaignId", filterCampaign);
    if (filterStatus) query.set("status", filterStatus);
    if (filterRole) query.set("role", filterRole);
    let alive = true;
    void read<{ ledger: Ledger }>(`/api/admin/rewards?${query}`).then((result) => {
      if (alive) setLedger(result.ledger);
    }).catch((error) => { if (alive) setMessage(error.message); });
    return () => { alive = false; };
  }, [tab, page, filterCampaign, filterStatus, filterRole, read]);

  async function openCampaign(id: string) {
    setMessage(""); setConfirmCancel(false); setDetail(null);
    try { setDetail((await read<{ campaign: CampaignDetail }>(`/api/admin/campaigns/${id}`)).campaign); return true; }
    catch (error) { setMessage((error as Error).message); return false; }
  }

  function startCreate() { setEditingId(null); setForm(emptyForm); setShowForm(true); setDetail(null); setMessage(""); }
  function startEdit(campaign: CampaignDetail) {
    setEditingId(campaign.seasonId);
    setForm({
      title: campaign.title, startsAt: localInput(campaign.startsAt), endsAt: localInput(campaign.endsAt),
      parentReward: formatAtomic(campaign.parentRewardAtomic, campaign.decimals),
      newSeekerReward: formatAtomic(campaign.newSeekerRewardAtomic, campaign.decimals),
      budget: formatAtomic(campaign.budgetAtomic, campaign.decimals),
      tokenMint: campaign.tokenMint, decimals: String(campaign.decimals),
    });
    setShowForm(true); setMessage("");
  }

  async function saveCampaign(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const payload = {
        title: form.title,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        parentReward: form.parentReward, newSeekerReward: form.newSeekerReward,
        budget: form.budget, tokenMint: form.tokenMint, decimals: Number(form.decimals),
      };
      const path = editingId ? `/api/admin/campaigns/${editingId}` : "/api/admin/campaigns";
      const result = await read<{ campaign: Campaign }>(path, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setShowForm(false); setEditingId(null);
      await refresh();
      if (await openCampaign(result.campaign.seasonId)) setMessage("Campaign saved.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function cancelActive() {
    if (!detail || detail.lifecycle !== "active") return;
    setBusy(true); setMessage("");
    try {
      await read(`/api/admin/campaigns/${detail.seasonId}/cancel`, { method: "POST" });
      await refresh(); setTab("history");
      if (await openCampaign(detail.seasonId)) setMessage("Campaign cancelled. Earlier qualifying births remain eligible.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); setConfirmCancel(false); }
  }

  const historical = campaigns.filter((campaign) => campaign.lifecycle === "ended" || campaign.lifecycle === "cancelled");
  const current = campaigns.filter((campaign) => campaign.lifecycle === "active" || campaign.lifecycle === "scheduled")
    .sort((a, b) => a.lifecycle === b.lifecycle ? a.startsAt.localeCompare(b.startsAt) : a.lifecycle === "active" ? -1 : 1);
  return (
    <div className="adminDashboard">
      <nav className="adminNav" aria-label="Admin sections">
        {(["overview", "campaigns", "rewards", "history"] as Tab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? "isActive" : ""}
            onClick={() => { setTab(item); setMessage(""); setShowForm(false); setDetail(null); }}>
            {item.toUpperCase()}
          </button>
        ))}
      </nav>
      {message && <p className="adminNotice" role="status">{message}</p>}
      {loading && <p className="adminEmpty">Loading indexed data…</p>}
      {!loading && tab === "overview" && overview && <>
        <SectionTitle eyebrow="SPECIES STATE" title="Overview" note="Canonical indexed state · live campaign lifecycle" />
        <div className="adminMetrics">
          <Metric label="TOTAL POPULATION" value={overview.totalPopulation} />
          <Metric label="BIRTHS" value={String(overview.births)} />
          <Metric label="DIRECT BIRTHS · 30D" value={String(overview.directReproduction.last30Days)} />
          <Metric label="REPRODUCING PARENTS" value={String(overview.directReproduction.uniqueParents)} />
        </div>
        <div className="adminColumns">
          <section className="adminSurface"><h3>Campaign state</h3>
            <div className="adminStateGrid">{(["active", "scheduled", "ended", "cancelled"] as Lifecycle[]).map((state) =>
              <div key={state}><span>{state}</span><strong>{overview.campaignCounts[state]}</strong></div>)}</div>
            {overview.activeCampaign && <button className="adminTextAction" type="button" onClick={() => { setTab("campaigns"); void openCampaign(overview.activeCampaign!.seasonId); }}>OPEN ACTIVE CAMPAIGN →</button>}
            {overview.activeCampaign && <div className="adminOverviewCampaign">
              <div className="adminLine"><span>Qualifying / funded births</span><b>{overview.activeCampaign.qualifyingBirths} / {overview.activeCampaign.fundedBirths}</b></div>
              <div className="adminLine"><span>Parent / new-Seeker rewards</span><b>{overview.activeCampaign.parentRewards} / {overview.activeCampaign.newSeekerRewards}</b></div>
              <div className="adminLine"><span>SKR committed</span><b>{formatAtomic(overview.activeCampaign.committedAtomic, overview.activeCampaign.decimals)}</b></div>
              <div className="adminLine"><span>SKR remaining</span><b>{formatAtomic(overview.activeCampaign.remainingAtomic, overview.activeCampaign.decimals)}</b></div>
            </div>}
            {!overview.activeCampaign && overview.nextScheduled && <p className="adminMuted">Next: {overview.nextScheduled.title} · {dateTime(overview.nextScheduled.startsAt)}</p>}
          </section>
          <section className="adminSurface"><h3>Rewards & points</h3>
            <div className="adminLine"><span>Pending rewards</span><b>{overview.payoutCounts.pending}</b></div>
            <div className="adminLine"><span>Paid rewards</span><b>{overview.payoutCounts.paid}</b></div>
            <div className="adminLine"><span>Failed rewards</span><b>{overview.payoutCounts.failed}</b></div>
            <div className="adminLine"><span>Legacy outbreak points</span><b>{overview.pointsTotal}</b></div>
          </section>
        </div>
        <section className="adminSurface"><h3>Descendant rank</h3>
          {overview.topDescendants.length ? overview.topDescendants.map((item, index) =>
            <div className="adminLine" key={item.organismNumber}><span>#{index + 1} · Seeker {item.organismNumber}</span><b>{item.totalDescendants} descendants</b></div>)
            : <p className="adminMuted">No ranked descendants yet.</p>}
        </section>
      </>}
      {!loading && (tab === "campaigns" || tab === "history") && <>
        <SectionTitle eyebrow={tab === "campaigns" ? "REWARD WINDOWS" : "ARCHIVE"} title={tab === "campaigns" ? "Campaigns" : "History"}
          note={tab === "campaigns" ? "One active window · fixed rewards and budget" : "Ended and cancelled reward windows"} />
        {tab === "campaigns" && <button className="adminPrimary" type="button" onClick={startCreate}>+ CREATE CAMPAIGN</button>}
        {showForm && tab === "campaigns" && <form className="adminCampaignForm adminSurface" onSubmit={saveCampaign}>
          <div className="adminSectionHead"><h3>{editingId ? "Edit scheduled campaign" : "New campaign"}</h3><button className="adminTextAction" type="button" onClick={() => setShowForm(false)}>CLOSE</button></div>
          <div className="adminFormGrid">
            <Field label="NAME / TITLE" value={form.title} onChange={(value) => setForm({ ...form, title: value })} maxLength={80} />
            <Field label="SKR MINT" value={form.tokenMint} onChange={(value) => setForm({ ...form, tokenMint: value })} maxLength={44} />
            <Field label="START TIME" type="datetime-local" step="1" value={form.startsAt} onChange={(value) => setForm({ ...form, startsAt: value })} />
            <Field label="END TIME" type="datetime-local" step="1" value={form.endsAt} onChange={(value) => setForm({ ...form, endsAt: value })} />
            <Field label="PARENT · SKR" value={form.parentReward} onChange={(value) => setForm({ ...form, parentReward: value })} inputMode="decimal" />
            <Field label="NEW SEEKER · SKR" value={form.newSeekerReward} onChange={(value) => setForm({ ...form, newSeekerReward: value })} inputMode="decimal" />
            <Field label="TOTAL BUDGET · SKR" value={form.budget} onChange={(value) => setForm({ ...form, budget: value })} inputMode="decimal" />
            <Field label="TOKEN DECIMALS" type="number" value={form.decimals} onChange={(value) => setForm({ ...form, decimals: value })} min="0" max="18" />
          </div>
          <p className="adminMuted">Amounts are entered in SKR. The API stores exact token base units and enforces window, lock, and budget rules.</p>
          <button className="adminPrimary" disabled={busy} type="submit">{busy ? "SAVING…" : editingId ? "SAVE CAMPAIGN" : "CREATE CAMPAIGN"}</button>
        </form>}
        <div className="adminColumns adminCampaignLayout">
          <section className="adminSurface"><h3>{tab === "campaigns" ? "Current & scheduled" : "Past campaigns"}</h3>
            {(tab === "campaigns" ? current : historical).length ? (tab === "campaigns" ? current : historical).map((campaign) =>
              <button key={campaign.seasonId} type="button" className={`adminCampaignRow ${detail?.seasonId === campaign.seasonId ? "isSelected" : ""}`} onClick={() => void openCampaign(campaign.seasonId)}>
                <span><strong>{campaign.title}</strong><small>{dateTime(campaign.startsAt)} → {dateTime(campaign.endsAt)}</small></span><em>{campaign.lifecycle}</em>
              </button>) : <p className="adminMuted">No campaigns in this section.</p>}
          </section>
          <section className="adminSurface"><h3>Campaign detail</h3>
            {detail ? <><CampaignDetailView detail={detail} onEdit={() => startEdit(detail)}
              onCancel={() => setConfirmCancel(true)} confirmCancel={confirmCancel} busy={busy}
              onConfirmCancel={() => void cancelActive()} onDismissCancel={() => setConfirmCancel(false)} />
              {(detail.lifecycle === "ended" || detail.lifecycle === "cancelled") &&
                <AdminPayoutPanel key={detail.seasonId} campaignId={detail.seasonId} decimals={detail.decimals}
                  onProgress={() => {
                    void read<{ campaign: CampaignDetail }>(`/api/admin/campaigns/${detail.seasonId}`).then((result) => setDetail(result.campaign)).catch(() => {});
                    void refresh().catch(() => {});
                  }} />}</>
              : <p className="adminMuted">Select a campaign to inspect its window, rewards, points, and payout state.</p>}
          </section>
        </div>
      </>}
      {!loading && tab === "rewards" && <>
        <SectionTitle eyebrow="SGT LEDGER" title="Rewards" note="Recorded obligations · payouts in campaign review" />
        <div className="adminFilters">
          <label>CAMPAIGN<select value={filterCampaign} onChange={(event) => { setFilterCampaign(event.target.value); setPage(1); }}><option value="">All campaigns</option>{campaigns.map((campaign) => <option key={campaign.seasonId} value={campaign.seasonId}>{campaign.title}</option>)}</select></label>
          <label>STATUS<select value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option></select></label>
          <label>ROLE<select value={filterRole} onChange={(event) => { setFilterRole(event.target.value); setPage(1); }}><option value="">Both roles</option><option value="parent">Parent</option><option value="newSeeker">New Seeker</option></select></label>
        </div>
        <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>CAMPAIGN</th><th>BIRTH</th><th>RECIPIENT SGT</th><th>ROLE</th><th>SKR</th><th>STATUS</th><th>RECORDED</th></tr></thead><tbody>
          {ledger?.rows.map((reward) => <tr key={reward.id}><td>{reward.campaignTitle}</td><td title={reward.birth}>{compact(reward.birth)}</td><td title={reward.recipientSgtMint}>{compact(reward.recipientSgtMint)}</td><td>{reward.role === "newSeeker" ? "New Seeker" : "Parent"}</td><td>{formatAtomic(reward.amountAtomic, reward.decimals)}</td><td><span className="adminStatus">{reward.payoutStatus}</span></td><td>{dateTime(reward.createdAt)}</td></tr>)}
          {ledger?.rows.length === 0 && <tr><td colSpan={7}>No reward records match these filters.</td></tr>}
        </tbody></table></div>
        {ledger && <div className="adminPagination"><span>{ledger.total} records · page {ledger.page}</span><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>PREVIOUS</button><button type="button" disabled={page * ledger.limit >= ledger.total} onClick={() => setPage(page + 1)}>NEXT</button></div>}
      </>}
    </div>
  );
}

function SectionTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return <div className="adminSectionTitle"><div><p className="adminEyebrow">{eyebrow}</p><h2>{title}</h2></div><p>{note}</p></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="adminMetric"><span>{label}</span><strong>{value}</strong></div>;
}
function Field({ label, value, onChange, type = "text", ...props }: {
  label: string; value: string; onChange: (value: string) => void; type?: string;
  maxLength?: number; inputMode?: "decimal"; min?: string; max?: string; step?: string;
}) {
  return <label className="adminField">{label}<input {...props} type={type} value={value} onChange={(event) => onChange(event.target.value)} required /></label>;
}
function CampaignDetailView({ detail, onEdit, onCancel, confirmCancel, busy, onConfirmCancel, onDismissCancel }: {
  detail: CampaignDetail; onEdit: () => void; onCancel: () => void; confirmCancel: boolean; busy: boolean;
  onConfirmCancel: () => void; onDismissCancel: () => void;
}) {
  return <div className="adminDetail">
    <div className="adminDetailTitle"><strong>{detail.title}</strong><em>{detail.lifecycle}</em></div>
    <div className="adminLine"><span>Starts</span><b>{dateTime(detail.startsAt)}</b></div>
    <div className="adminLine"><span>Ends</span><b>{dateTime(detail.endsAt)}</b></div>
    {detail.cancelledAt && <div className="adminLine"><span>Cancelled</span><b>{dateTime(detail.cancelledAt)}</b></div>}
    <div className="adminLine"><span>Parent reward</span><b>{formatAtomic(detail.parentRewardAtomic, detail.decimals)} SKR</b></div>
    <div className="adminLine"><span>New Seeker reward</span><b>{formatAtomic(detail.newSeekerRewardAtomic, detail.decimals)} SKR</b></div>
    <div className="adminLine"><span>Budget</span><b>{formatAtomic(detail.budgetAtomic, detail.decimals)} SKR</b></div>
    <div className="adminLine"><span>Mint / decimals</span><b title={detail.tokenMint}>{compact(detail.tokenMint)} · {detail.decimals}</b></div>
    <div className="adminDetailBreak" />
    <div className="adminLine"><span>Qualifying births</span><b>{detail.qualifyingBirths}</b></div>
    <div className="adminLine"><span>Fully funded births</span><b>{detail.fundedBirths}</b></div>
    <div className="adminLine"><span>Unique rewarded SGTs</span><b>{detail.uniqueRewardedSgts}</b></div>
    <div className="adminLine"><span>Parent rewards</span><b>{detail.parentRewards} · {formatAtomic(detail.parentRewardTotalAtomic, detail.decimals)} SKR</b></div>
    <div className="adminLine"><span>New Seeker rewards</span><b>{detail.newSeekerRewards} · {formatAtomic(detail.newSeekerRewardTotalAtomic, detail.decimals)} SKR</b></div>
    <div className="adminLine"><span>SKR committed</span><b>{formatAtomic(detail.committedAtomic, detail.decimals)} SKR</b></div>
    <div className="adminLine"><span>Budget remaining</span><b>{formatAtomic(detail.remainingAtomic, detail.decimals)} SKR</b></div>
    <div className="adminLine"><span>Budget usage</span><b>{(detail.budgetUsageBps / 100).toFixed(2)}% · {detail.fundedBirths} full pairs</b></div>
    <div className="adminDetailBreak" />
    <div className="adminLine"><span>Points · total / direct / lineage</span><b>{detail.points.total} / {detail.points.direct} / {detail.points.lineage}</b></div>
    <div className="adminLine"><span>Rewards · pending / paid / failed</span><b>{detail.payoutCounts.pending} / {detail.payoutCounts.paid} / {detail.payoutCounts.failed}</b></div>
    {detail.lifecycle === "scheduled" && <button className="adminPrimary" type="button" onClick={onEdit}>EDIT SCHEDULED CAMPAIGN</button>}
    {detail.lifecycle === "active" && (confirmCancel ? <div className="adminCancelConfirm"><p>Cancellation is permanent. Earlier verified births remain eligible.</p><button type="button" disabled={busy} onClick={onConfirmCancel}>{busy ? "CANCELLING…" : "CONFIRM CANCELLATION"}</button><button type="button" onClick={onDismissCancel}>KEEP ACTIVE</button></div> : <button className="adminDanger" type="button" onClick={onCancel}>CANCEL ACTIVE CAMPAIGN</button>)}
  </div>;
}
