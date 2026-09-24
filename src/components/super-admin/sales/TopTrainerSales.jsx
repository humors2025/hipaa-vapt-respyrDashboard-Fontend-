"use client";

import { useState } from "react";
import { formatCount, formatMoney, formatPercent } from "./salesFormat";
import { EmptyState, SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";

const COLLAPSED_ROWS = 5;

export default function TopTrainerSales({ trainers, total, trainerNetSales, currency, loading, updating, error, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const list = trainers || [];
  const shown = expanded ? list : list.slice(0, COLLAPSED_ROWS);
  const canExpand = list.length > COLLAPSED_ROWS;

  const action = (
    <div className="flex items-center gap-2">
      <UpdatingPill show={updating} />
      {canExpand && !loading && !error && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 hover:bg-[#DCEAFE] transition-colors cursor-pointer"
        >
          {expanded ? "Show less" : `View all (${formatCount(total ?? list.length)})`}
        </button>
      )}
    </div>
  );

  return (
    <SalesCard title="Top Trainer Codes" subtitle="Trainers ranked by net sales from their codes" action={action}>
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[36px] w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState message="No trainer-code purchases were recorded during this period." />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px] min-w-[680px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th scope="col" className="py-2.5 px-4 font-semibold w-[60px]">Rank</th>
                <th scope="col" className="py-2.5 px-4 font-semibold">Trainer</th>
                <th scope="col" className="py-2.5 px-4 font-semibold">Trainer Code</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-right">Purchases</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-right">Gross Sales</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-right">Net Sales</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-right">% of Trainer Sales</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t, i) => (
                <tr key={t.partner_code || t.trainer_id || i} className="border-t border-[#F5F7FA] hover:bg-[#FAFBFD] transition-colors">
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                        i < 3 ? "bg-[#EEF4FE] text-[#308BF9]" : "bg-[#F5F7FA] text-[#535359]"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[#252525] font-semibold">{t.trainer_name || "—"}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-mono text-[11px] text-[#535359] bg-[#F5F7FA] rounded-[6px] px-2 py-0.5">{t.partner_code || "—"}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[#535359]">{formatCount(t.purchases)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[#535359]">{formatMoney(t.gross_sales, currency)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[#252525] font-semibold">{formatMoney(t.net_sales, currency)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[#535359]">{formatPercent(t.net_sales, trainerNetSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SalesCard>
  );
}
