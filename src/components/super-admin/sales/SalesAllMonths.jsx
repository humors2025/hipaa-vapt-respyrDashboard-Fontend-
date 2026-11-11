"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSuperAdminSalesMonthlyService } from "@/services/superAdminSalesService";
import { formatCount, formatMoney } from "./salesFormat";
import { EmptyState, SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";

// Overall sales: every month since the first sale, newest first, with all-time
// totals. Ignores the page's date filter; follows the Trainer Admin view.
// Data: view=monthly of super-admin-sales-analytics.

const NEW_COLOR = "#308BF9";
const RENEW_COLOR = "#3FAF58";

const monthLabel = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

function Tile({ label, value, sub, accent }) {
  return (
    <div
      className={
        accent
          ? "bg-[#308BF9] rounded-[10px] p-4 text-white flex flex-col gap-1 min-w-0"
          : "bg-white rounded-[10px] p-4 border border-[#E1E6ED] flex flex-col gap-1 min-w-0"
      }
    >
      <div className={accent ? "text-[12px] opacity-85" : "text-[#535359] text-[12px]"}>{label}</div>
      <div className={`text-[22px] font-bold leading-tight tabular-nums truncate ${accent ? "" : "text-[#252525]"}`}>{value}</div>
      <div className={accent ? "text-[11px] opacity-85" : "text-[#A1A1A1] text-[11px]"}>{sub}</div>
    </div>
  );
}

export default function SalesAllMonths({ trainerAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const req = useRef(0);

  const load = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSuperAdminSalesMonthlyService({ trainerAdmin });
      if (id !== req.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load overall sales");
      setData(res);
    } catch (err) {
      if (id !== req.current) return;
      setError(err?.data?.message || err?.message || "Failed to load overall sales");
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [trainerAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const cur = data?.currency;
  const t = data?.totals || {};
  const months = [...(data?.months || [])].reverse();
  const maxSales = Math.max(1, ...months.map((m) => Number(m.total_sales) || 0));
  const showRenewals = data?.renewals_available !== false;

  return (
    <SalesCard
      title={
        <span className="inline-flex items-center gap-2 flex-wrap">
          Overall sales — every month
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#EEF4FF] text-[#308BF9]">
            All time
          </span>
        </span>
      }
      subtitle="Everything we have collected since the first sale, month by month. The date filter above does not change this box."
      action={<UpdatingPill show={loading && Boolean(data)} />}
    >
      {error ? (
        <SectionError message={error} onRetry={load} />
      ) : loading && !data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
          <Skeleton className="h-[160px]" />
        </div>
      ) : !months.length ? (
        <EmptyState message="No sales yet." />
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-3 ${showRenewals ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <Tile
              accent
              label="Total sales (all time)"
              value={formatMoney(t.total_sales, cur)}
              sub={`${formatCount(t.total_payments)} payments in ${formatCount(months.length)} ${months.length === 1 ? "month" : "months"}`}
            />
            <Tile
              label="New purchases (all time)"
              value={formatMoney(t.new_sales, cur)}
              sub={`${formatCount(t.new_purchases)} new memberships`}
            />
            {showRenewals && (
              <Tile
                label="Renewals (all time)"
                value={formatMoney(t.renewal_sales, cur)}
                sub={`${formatCount(t.renewals)} members paid again`}
              />
            )}
          </div>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr className="text-[#A1A1A1] text-[11px] text-left border-b border-[#E1E6ED]">
                  <th className="font-semibold py-2 pr-3">Month</th>
                  <th className="font-semibold py-2 px-3 text-right">New purchases</th>
                  {showRenewals && <th className="font-semibold py-2 px-3 text-right">Renewals</th>}
                  <th className="font-semibold py-2 px-3 text-right">Total sales</th>
                  <th className="font-semibold py-2 pl-3 w-[32%]">
                    <span className="inline-flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NEW_COLOR }} aria-hidden="true" />
                        New
                      </span>
                      {showRenewals && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RENEW_COLOR }} aria-hidden="true" />
                          Renewals
                        </span>
                      )}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const newW = ((Number(m.new_sales) || 0) / maxSales) * 100;
                  const renW = ((Number(m.renewal_sales) || 0) / maxSales) * 100;
                  return (
                    <tr key={m.month} className="border-b border-[#F0F3F7] last:border-0">
                      <td className="py-2.5 pr-3 text-[#252525] font-semibold whitespace-nowrap">{monthLabel(m.month)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="text-[#252525] font-semibold">{formatMoney(m.new_sales, cur)}</div>
                        <div className="text-[#A1A1A1] text-[11px]">{formatCount(m.new_purchases)} bought</div>
                      </td>
                      {showRenewals && (
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          <div className="text-[#252525] font-semibold">{formatMoney(m.renewal_sales, cur)}</div>
                          <div className="text-[#A1A1A1] text-[11px]">{formatCount(m.renewals)} renewed</div>
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="text-[#252525] font-bold">{formatMoney(m.total_sales, cur)}</div>
                        <div className="text-[#A1A1A1] text-[11px]">{formatCount(m.total_payments)} payments</div>
                      </td>
                      <td className="py-2.5 pl-3">
                        <div
                          className="flex h-[10px] w-full rounded-full bg-[#F0F3F7] overflow-hidden"
                          role="img"
                          aria-label={`${monthLabel(m.month)}: new ${formatMoney(m.new_sales, cur)}, renewals ${formatMoney(m.renewal_sales, cur)}`}
                        >
                          <div style={{ width: `${newW}%`, backgroundColor: NEW_COLOR }} />
                          {showRenewals && <div style={{ width: `${renW}%`, backgroundColor: RENEW_COLOR }} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#E1E6ED] bg-[#F8FAFC]">
                  <td className="py-2.5 pr-3 pl-2 text-[#252525] font-bold">All time</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#252525]">
                    {formatMoney(t.new_sales, cur)}
                    <div className="text-[#A1A1A1] text-[11px] font-normal">{formatCount(t.new_purchases)} bought</div>
                  </td>
                  {showRenewals && (
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#252525]">
                      {formatMoney(t.renewal_sales, cur)}
                      <div className="text-[#A1A1A1] text-[11px] font-normal">{formatCount(t.renewals)} renewed</div>
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#308BF9]">
                    {formatMoney(t.total_sales, cur)}
                    <div className="text-[#A1A1A1] text-[11px] font-normal">{formatCount(t.total_payments)} payments</div>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </SalesCard>
  );
}
