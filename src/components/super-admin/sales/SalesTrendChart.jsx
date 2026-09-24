"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { SOURCE_COLORS, formatCount, formatMoney } from "./salesFormat";
import { EmptyState, SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const SERIES = [
  { key: "total_sales", countKeys: ["website_purchases", "trainer_purchases"], label: "Total Sales", color: SOURCE_COLORS.total, dash: [5, 4], fill: false },
  { key: "website_sales", countKeys: ["website_purchases"], label: "Website Sales", color: SOURCE_COLORS.website, fill: true },
  { key: "trainer_sales", countKeys: ["trainer_purchases"], label: "Trainer Code Sales", color: SOURCE_COLORS.trainer_code, fill: true },
];

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// `buckets` comes from buildBuckets(); `trend` is the API trend[]. Buckets with
// no API row are plotted as zero so the x-axis always covers the full period.
export default function SalesTrendChart({ buckets, trend, currency, loading, updating, error, onRetry, rangeLabel }) {
  const rows = useMemo(() => {
    const byKey = new Map((trend || []).map((t) => [String(t.bucket), t]));
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return buckets.map((b) => {
      // Days/months that haven't happened yet are left unplotted instead of drawn as $0.
      if (b.key > todayKey.slice(0, b.key.length)) return { ...b, future: true };
      const t = byKey.get(b.key) || {};
      return {
        ...b,
        website_sales: Number(t.website_sales) || 0,
        trainer_sales: Number(t.trainer_sales) || 0,
        total_sales: Number(t.total_sales) || (Number(t.website_sales) || 0) + (Number(t.trainer_sales) || 0),
        website_purchases: Number(t.website_purchases) || 0,
        trainer_purchases: Number(t.trainer_purchases) || 0,
      };
    });
  }, [buckets, trend]);

  const hasSales = rows.some((r) => !r.future && r.total_sales > 0);

  const data = useMemo(
    () => ({
      labels: rows.map((r) => r.label),
      datasets: SERIES.map((s) => ({
        label: s.label,
        data: rows.map((r) => (r.future ? null : r[s.key])),
        borderColor: s.color,
        backgroundColor: s.fill ? withAlpha(s.color, 0.08) : s.color,
        borderDash: s.dash,
        fill: s.fill ? "origin" : false,
        cubicInterpolationMode: "monotone",
        borderWidth: 2,
        pointRadius: rows.length > 12 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#fff",
        pointBorderWidth: 2,
      })),
    }),
    [rows]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      animation: { duration: 250 },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, color: "#535359", font: { size: 11, weight: 600 } },
        },
        tooltip: {
          backgroundColor: "#252525",
          padding: 10,
          cornerRadius: 8,
          titleFont: { size: 11, weight: 600 },
          bodyFont: { size: 11 },
          usePointStyle: true,
          callbacks: {
            title: (items) => rows[items[0]?.dataIndex]?.tooltip || "",
            label: (ctx) => {
              const r = rows[ctx.dataIndex];
              if (!r || r.future) return "";
              const s = SERIES[ctx.datasetIndex];
              const count = s.countKeys.reduce((sum, k) => sum + (r?.[k] || 0), 0);
              return ` ${s.label}: ${formatMoney(ctx.parsed.y, currency)} · ${formatCount(count)} purchase${count === 1 ? "" : "s"}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#A1A1A1", font: { size: 10 }, autoSkip: true, maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          suggestedMax: hasSales ? undefined : 100,
          grid: { color: "#F0F3F7" },
          border: { display: false },
          ticks: {
            color: "#A1A1A1",
            font: { size: 10 },
            maxTicksLimit: 6,
            callback: (v) => formatMoney(v, currency, { compact: true }),
          },
        },
      },
    }),
    [rows, currency, hasSales]
  );

  return (
    <SalesCard
      title="Sales Overview"
      subtitle={`Net revenue from new purchases by source · ${rangeLabel}`}
      action={<UpdatingPill show={updating} />}
      className="h-full"
    >
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <div className="relative h-[300px]">
          <Line data={data} options={options} aria-label="Sales trend line chart" role="img" />
          {!hasSales && (
            <div className="absolute inset-0 top-8 flex items-center justify-center pointer-events-none">
              <EmptyState message="No sales found for the selected period." className="bg-white/85" />
            </div>
          )}
        </div>
      )}
    </SalesCard>
  );
}
