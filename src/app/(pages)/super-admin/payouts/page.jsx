"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchCommissionOverviewService,
  listPayoutsService,
  runPayoutsService,
  runBreathCreditsService,
  formatMinor,
} from "@/services/commissionService";

/**
 * Super admin › Payouts. Network-wide commission position, the monthly payout
 * run (with dry-run preview), and every Stripe transfer we've made.
 */

const STATUS = {
  scheduled: "bg-[#EEF4FE] text-[#308BF9]",
  processing: "bg-[#EEF4FE] text-[#308BF9]",
  paid: "bg-[#E5F6EE] text-[#1F7A4A]",
  failed: "bg-[#FCEAEB] text-[#B5363A]",
  reversed: "bg-[#FCEAEB] text-[#B5363A]",
};

function Kpi({ label, value, hint, accent }) {
  return (
    <div className={`rounded-[10px] p-5 flex flex-col gap-1 ${accent ? "bg-[#308BF9] text-white" : "bg-white border border-[#E1E6ED]"}`}>
      <div className={`text-[12px] ${accent ? "opacity-80" : "text-[#535359]"}`}>{label}</div>
      <div className={`text-[26px] font-bold leading-none mt-1 ${accent ? "" : "text-[#252525]"}`}>{value}</div>
      <div className={`text-[11px] mt-1 ${accent ? "opacity-80" : "text-[#A1A1A1]"}`}>{hint}</div>
    </div>
  );
}

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PayoutsPage() {
  const [overview, setOverview] = useState(null);
  const [payouts, setPayouts] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([fetchCommissionOverviewService(), listPayoutsService({ limit: 50 })]);
      setOverview(o);
      setPayouts(p);
    } catch (err) {
      toast.error(err?.message || "Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dryRun = async () => {
    setRunning(true);
    try {
      const res = await runPayoutsService({ dryRun: true });
      setPreview(res.summary);
    } catch (err) {
      toast.error(err?.message || "Preview failed");
    } finally {
      setRunning(false);
    }
  };

  const runForReal = async () => {
    if (!preview) return;
    const payable = preview.items.filter((i) => !i.skipped);
    if (!window.confirm(`Send ${payable.length} Stripe transfer${payable.length === 1 ? "" : "s"} totalling ${formatMinor(payable.reduce((a, i) => a + i.net_minor, 0))}?`)) return;
    setRunning(true);
    try {
      const res = await runPayoutsService({ dryRun: false });
      toast.success(`Payout run finished: ${res.summary.paid} paid, ${res.summary.errors} failed`);
      setPreview(null);
      load();
    } catch (err) {
      toast.error(err?.message || "Payout run failed");
    } finally {
      setRunning(false);
    }
  };

  const runCredits = async () => {
    setRunning(true);
    try {
      const res = await runBreathCreditsService({ dryRun: false });
      toast.success(`Breath credits: ${res.summary.credited} credited, ${res.summary.zero} with no readings, ${res.summary.unlinked} unlinked`);
    } catch (err) {
      toast.error(err?.message || "Credit run failed");
    } finally {
      setRunning(false);
    }
  };

  const t = overview?.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Payouts</h1>
          <p className="text-[#535359] text-[13px] mt-1">Commission owed and paid across every facility, and the monthly Stripe transfer run.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={runCredits} disabled={running} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer">
            Run breath credits now
          </button>
          <button type="button" onClick={dryRun} disabled={running} className="rounded-full bg-[#308BF9] text-white text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer">
            {running ? "Working…" : "Preview payout run"}
          </button>
          <button type="button" onClick={load} disabled={loading} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer">
            Refresh
          </button>
        </div>
      </div>

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi label="Owed (pending)" value={formatMinor(t.pending_minor)} hint="Ready for the next run" accent />
          <Kpi label="On hold" value={formatMinor(t.held_minor)} hint="Payee hasn't finished Stripe setup" />
          <Kpi label="Paid to date" value={formatMinor(t.paid_minor)} hint="Transferred via Stripe" />
          <Kpi label="Attributed net sales" value={formatMinor(t.attributed_net_sales_minor)} hint="Member payments with a referral" />
          <Kpi label="Referred subscriptions" value={String(t.subscriptions)} hint="With at least one paid invoice" />
        </div>
      )}

      {preview && (
        <div className="rounded-[10px] border border-[#308BF9] bg-[#EEF4FE] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[#1F4E8C] text-[13px] font-semibold">
              Preview — entries paid before {preview.period_end}: {preview.payees} payee{preview.payees === 1 ? "" : "s"}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={runForReal} disabled={running || !preview.items.some((i) => !i.skipped)} className="rounded-full bg-[#308BF9] text-white text-[11px] font-semibold px-3 py-1.5 disabled:opacity-50 cursor-pointer">
                Send transfers
              </button>
              <button type="button" onClick={() => setPreview(null)} className="text-[11px] text-[#535359] cursor-pointer">Dismiss</button>
            </div>
          </div>
          {preview.items.length === 0 ? (
            <div className="text-[12px] text-[#535359]">Nothing to pay.</div>
          ) : (
            <table className="w-full text-[12px]">
              <tbody>
                {preview.items.map((i) => (
                  <tr key={i.payee} className="border-t border-white/60">
                    <td className="py-1.5 pr-4 text-[#252525]">{i.payee}</td>
                    <td className="py-1.5 pr-4 text-[#535359]">{i.entries} entr{i.entries === 1 ? "y" : "ies"}</td>
                    <td className="py-1.5 pr-4 text-right text-[#252525] font-semibold">{formatMinor(i.net_minor, i.currency)}</td>
                    <td className="py-1.5 text-[#A66B00]">{i.skipped || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {overview?.facilities?.length > 0 && (
        <div>
          <h2 className="text-[#252525] text-[14px] font-bold mb-2">By facility</h2>
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold">Code</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Subscriptions</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Owed</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {overview.facilities.map((f) => (
                  <tr key={f.facility_id} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4 text-[#252525] font-semibold">{f.name}</td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">{f.partner_code}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525]">{f.subscriptions}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(f.owed_minor)}</td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">{formatMinor(f.paid_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[#252525] text-[14px] font-bold mb-2">Transfers</h2>
        {loading && payouts.items.length === 0 ? (
          <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
        ) : payouts.items.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">No payouts yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Payee</th>
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold">Period</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Stripe transfer</th>
                  <th className="py-2.5 px-4 font-semibold">Paid</th>
                </tr>
              </thead>
              <tbody>
                {payouts.items.map((p) => (
                  <tr key={p.id} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525] font-semibold">{p.payee_user_id}</div>
                      <div className="text-[#A1A1A1] text-[11px]">{p.payee_role}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">{p.facility_name || "—"}</td>
                    <td className="py-2.5 px-4 text-[#535359]">{fmt(p.period_start)} – {fmt(p.period_end)}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(p.amount_minor, p.currency)}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${STATUS[p.status] || ""}`}>{p.status}</span>
                      {p.failure_reason && <div className="text-[#B5363A] text-[10px] mt-1 max-w-[260px]">{p.failure_reason}</div>}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono text-[11px]">{p.stripe_transfer_id || "—"}</td>
                    <td className="py-2.5 px-4 text-[#535359]">{fmt(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
