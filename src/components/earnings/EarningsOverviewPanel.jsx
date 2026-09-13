"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchEarningsSummaryService, formatMinor } from "@/services/commissionService";

/**
 * Earnings › Overview, shared by trainer, facility admin and trainer admin.
 * Everything comes from /earnings-summary; nothing here is hard-coded.
 *
 * `payoutSetupHref` points at the role's own payout-setup page.
 */

function Kpi({ label, value, hint, accent }) {
  if (accent) {
    return (
      <div className="bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1">
        <div className="text-[12px] opacity-80">{label}</div>
        <div className="text-[28px] font-bold leading-none mt-1">{value}</div>
        <div className="text-[11px] opacity-80 mt-1">{hint}</div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
      <div className="text-[#535359] text-[12px]">{label}</div>
      <div className="text-[#252525] text-[28px] font-bold leading-none mt-1">{value}</div>
      <div className="text-[#A1A1A1] text-[11px] mt-1">{hint}</div>
    </div>
  );
}

const STATUS_LABEL = {
  pending: { text: "Awaiting payout", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  scheduled: { text: "In payout", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  held: { text: "On hold", cls: "bg-[#FFF4E0] text-[#A66B00]" },
  paid: { text: "Paid", cls: "bg-[#E5F6EE] text-[#1F7A4A]" },
  reversed: { text: "Refunded", cls: "bg-[#FCEAEB] text-[#B5363A]" },
};

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EarningsOverviewPanel({ payoutSetupHref }) {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setS(await fetchEarningsSummaryService());
      } catch (err) {
        toast.error(err?.message || "Could not load earnings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>;
  if (!s) return <div className="text-[#A1A1A1] text-[13px]">Earnings unavailable right now.</div>;

  const cur = s.currency || "USD";
  const owed = Number(s.pending_minor) + Number(s.scheduled_minor);
  const needsSetup = !s.payout_account || !s.payout_account.payouts_enabled;
  const isFacility = s.role === "facility_admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Overview</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          {isFacility
            ? `${s.facility?.name || "Your facility"} earns ${s.rate_pct}% of every membership payment referred through your codes.`
            : s.split_pct != null
            ? `You receive ${s.split_pct}% of the facility's ${s.rate_pct}% commission on members who sign up under your code.`
            : `You earn ${s.rate_pct}% of every membership payment referred through your code.`}
        </p>
      </div>

      {needsSetup && (
        <div className="rounded-[10px] bg-[#FFF4E0] px-4 py-3 text-[12px] text-[#A66B00] flex items-center justify-between gap-3 flex-wrap">
          <span>
            {Number(s.held_minor) > 0
              ? `${formatMinor(s.held_minor, cur)} is on hold until you finish payout setup.`
              : "Finish payout setup so commission can be paid to you."}
          </span>
          <Link href={payoutSetupHref} className="rounded-full bg-[#F2A93B] text-white text-[11px] font-semibold px-3 py-1">
            Set up payouts
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="This month" value={formatMinor(s.this_month_minor, cur)} hint={`Last month ${formatMinor(s.last_month_minor, cur)}`} accent />
        <Kpi label="Lifetime paid" value={formatMinor(s.lifetime_paid_minor, cur)} hint="Sent to your Stripe account" />
        <Kpi label="Awaiting payout" value={formatMinor(owed, cur)} hint={`Next payout ${fmtDate(s.next_payout_date)}`} />
        <Kpi label="Active members" value={String(s.active_subscriptions)} hint={isFacility ? "Across the facility's codes" : "Signed up under your code"} />
      </div>

      {isFacility && Array.isArray(s.trainers) && s.trainers.length > 0 && (
        <div>
          <h3 className="text-[#252525] text-[14px] font-bold mb-2">Trainer shares this month</h3>
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Trainer</th>
                  <th className="py-2.5 px-4 font-semibold">Split</th>
                  <th className="py-2.5 px-4 font-semibold text-right">This month</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Awaiting payout</th>
                </tr>
              </thead>
              <tbody>
                {s.trainers.map((t) => (
                  <tr key={t.user_id} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525] font-semibold">{t.name || t.user_id}</div>
                      <div className="text-[#A1A1A1] text-[11px] font-mono">{t.partner_code}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">{t.split_pct}%</td>
                    <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(t.this_month_minor, cur)}</td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">{formatMinor(t.pending_minor, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-2">Recent activity</h3>
        {s.recent.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
            No commission yet. Each time a referred member&rsquo;s monthly payment goes through, it appears here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Date</th>
                  <th className="py-2.5 px-4 font-semibold">Referral code</th>
                  <th className="py-2.5 px-4 font-semibold">Your share</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {s.recent.map((r, i) => {
                  const st = STATUS_LABEL[r.status] || { text: r.status, cls: "bg-[#F5F7FA] text-[#535359]" };
                  return (
                    <tr key={i} className="border-t border-[#F5F7FA]">
                      <td className="py-2.5 px-4 text-[#535359]">{fmtDate(r.invoice_paid_at)}</td>
                      <td className="py-2.5 px-4 text-[#535359] font-mono">{r.attributed_partner_code}</td>
                      <td className="py-2.5 px-4 text-[#535359]">{r.share_pct}%</td>
                      <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(r.amount_minor, cur)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${st.cls}`}>{st.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
