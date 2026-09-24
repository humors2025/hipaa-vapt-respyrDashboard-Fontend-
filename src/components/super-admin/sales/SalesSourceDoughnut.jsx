"use client";

import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { SOURCE_COLORS, formatCount, formatMoney, formatPercent } from "./salesFormat";
import { SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";

ChartJS.register(ArcElement, Tooltip);

const SOURCES = [
  { key: "website", label: "Website", hint: "Direct website purchase" },
  { key: "trainer_code", label: "Trainer Code", hint: "Attributed to a trainer code" },
];

export default function SalesSourceDoughnut({ breakdown, currency, loading, updating, error, onRetry }) {
  const rows = useMemo(
    () =>
      SOURCES.map((s) => ({
        ...s,
        color: SOURCE_COLORS[s.key],
        purchases: Number(breakdown?.[s.key]?.purchases) || 0,
        net: breakdown?.[s.key]?.net_sales,
      })),
    [breakdown]
  );
  const total = rows.reduce((sum, r) => sum + r.purchases, 0);

  const data = useMemo(
    () => ({
      labels: rows.map((r) => r.label),
      datasets: [
        {
          // An all-zero doughnut renders nothing; show a neutral ring instead.
          data: total ? rows.map((r) => r.purchases) : [1],
          backgroundColor: total ? rows.map((r) => r.color) : ["#F0F3F7"],
          borderWidth: 0,
          hoverOffset: total ? 4 : 0,
        },
      ],
    }),
    [rows, total]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: total > 0,
          backgroundColor: "#252525",
          padding: 10,
          cornerRadius: 8,
          bodyFont: { size: 11 },
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCount(ctx.parsed)} purchases (${formatPercent(ctx.parsed, total)})`,
          },
        },
      },
    }),
    [total]
  );

  return (
    <SalesCard title="Sales by Source" subtitle="Share of successful purchases" action={<UpdatingPill show={updating} />} className="h-full">
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-[180px] w-[180px] !rounded-full" />
          <Skeleton className="h-[52px] w-full" />
          <Skeleton className="h-[52px] w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative h-[180px]">
            <Doughnut data={data} options={options} aria-label="Purchases by source doughnut chart" role="img" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[#252525] text-[24px] font-bold leading-none tabular-nums">{formatCount(total)}</span>
              <span className="text-[#A1A1A1] text-[11px] mt-1">Total Purchases</span>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 rounded-[10px] bg-[#F5F7FA] px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[#252525] text-[12px] font-semibold">{r.label}</div>
                    <div className="text-[#A1A1A1] text-[11px] tabular-nums">
                      {formatCount(r.purchases)} purchases · {formatPercent(r.purchases, total)}
                    </div>
                  </div>
                </div>
                <span className="text-[#252525] text-[13px] font-bold tabular-nums whitespace-nowrap">{formatMoney(r.net, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SalesCard>
  );
}
