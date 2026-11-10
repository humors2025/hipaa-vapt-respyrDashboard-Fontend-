"use client";

import { useMemo, useState } from "react";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Reading Tracker charts: a stacked bar per day (took / missed / never tested /
// no reading yet today) and a pie of clients for the month. Data comes from the
// API's `charts` block, computed over every paid client (no search or filters).

const SERIES = [
  { key: "took", label: "Took a reading", color: "#3FAF58" },
  { key: "missed", label: "Missed (has tested before)", color: "#D9534F" },
  { key: "never", label: "Missed (never tested)", color: "#F5A524" },
  { key: "pending", label: "No reading yet today", color: "#C9D2DE" },
];

const SLICES = [
  { key: "took", label: "Took readings this month", color: "#3FAF58", hint: "At least one reading this month" },
  { key: "missed", label: "Missed the whole month", color: "#D9534F", hint: "Tested before, but not this month" },
  { key: "never", label: "Never taken a reading", color: "#F5A524", hint: "Linked app profile, no test ever" },
  { key: "not_linked", label: "Not linked yet", color: "#C9D2DE", hint: "Paid, no app profile connected" },
];

const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "0.0%");

function shortDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function ReadingTrackerCharts({ charts, today }) {
  const [mode, setMode] = useState("count");
  const daily = charts?.daily ?? [];
  const groups = charts?.groups ?? {};

  // Days after today have nothing to show yet.
  const days = useMemo(() => daily.filter((d) => !today || d.day <= today), [daily, today]);

  const totals = useMemo(() => {
    const t = { took: 0, missed: 0, never: 0 };
    for (const d of days) {
      t.took += d.took;
      t.missed += d.missed;
      t.never += d.never;
    }
    return t;
  }, [days]);
  const dayTotal = (d) => d.took + d.missed + d.never + d.pending;
  const totalClients = SLICES.reduce((s, x) => s + (groups[x.key] || 0), 0);
  const counted = totals.took + totals.missed + totals.never;

  const barData = useMemo(
    () => ({
      labels: days.map((d) => Number(d.day.slice(8))),
      datasets: SERIES.map((s) => ({
        label: s.label,
        backgroundColor: s.color,
        borderRadius: 3,
        maxBarThickness: 22,
        data: days.map((d) => {
          const v = d[s.key];
          if (mode === "count") return v;
          const t = dayTotal(d);
          return t ? Math.round((v / t) * 1000) / 10 : 0;
        }),
      })),
    }),
    [days, mode]
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#252525",
          padding: 10,
          cornerRadius: 8,
          titleFont: { size: 11, weight: 600 },
          bodyFont: { size: 11 },
          callbacks: {
            title: (items) => {
              const d = days[items[0]?.dataIndex];
              return d ? `${shortDate(d.day)} · ${dayTotal(d)} clients` : "";
            },
            label: (ctx) => {
              const d = days[ctx.dataIndex];
              const s = SERIES[ctx.datasetIndex];
              const v = d?.[s.key] || 0;
              if (!v) return null;
              return ` ${s.label}: ${v} (${pct(v, dayTotal(d))})`;
            },
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: "#A1A1A1", font: { size: 10 } } },
        y: {
          stacked: true,
          beginAtZero: true,
          max: mode === "percent" ? 100 : undefined,
          grid: { color: "#F0F3F7" },
          ticks: {
            color: "#A1A1A1",
            font: { size: 10 },
            precision: 0,
            callback: (v) => (mode === "percent" ? `${v}%` : v),
          },
        },
      },
    }),
    [days, mode]
  );

  const pieData = useMemo(
    () => ({
      labels: SLICES.map((s) => s.label),
      datasets: [
        {
          data: SLICES.map((s) => groups[s.key] || 0),
          backgroundColor: SLICES.map((s) => s.color),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    }),
    [groups]
  );

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#252525",
          padding: 10,
          cornerRadius: 8,
          bodyFont: { size: 11 },
          callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} clients (${pct(ctx.parsed, totalClients)})` },
        },
      },
    }),
    [totalClients]
  );

  if (!charts) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Bar graph per day */}
      <section className="xl:col-span-2 bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col gap-3 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[#252525] text-[14px] font-bold">Readings per day</h2>
            <p className="text-[#A1A1A1] text-[11px] mt-0.5">
              Each bar is one day: paid clients who took a reading, who missed it, and who have never tested.
            </p>
          </div>
          <div className="inline-flex rounded-[10px] border border-[#E1E6ED] p-0.5" role="tablist" aria-label="Show as">
            {[
              ["count", "Clients"],
              ["percent", "Percentage"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={`px-3 py-1 rounded-[8px] text-[11px] font-semibold cursor-pointer ${
                  mode === value ? "bg-[#308BF9] text-white" : "text-[#535359] hover:bg-[#F5F7FA]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#535359]">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.label}
              {s.key !== "pending" && (
                <span className="text-[#252525] font-semibold tabular-nums">
                  {totals[s.key]} <span className="text-[#A1A1A1] font-normal">({pct(totals[s.key], counted)} of client-days)</span>
                </span>
              )}
            </span>
          ))}
        </div>

        <div className="relative h-[260px]">
          {days.length ? (
            <Bar data={barData} options={barOptions} aria-label="Readings per day bar graph" role="img" />
          ) : (
            <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px]">No days to show yet.</div>
          )}
        </div>
      </section>

      {/* Pie of clients for the month */}
      <section className="bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col gap-3 min-w-0">
        <div>
          <h2 className="text-[#252525] text-[14px] font-bold">Clients this month</h2>
          <p className="text-[#A1A1A1] text-[11px] mt-0.5">Each paid client counted once.</p>
        </div>
        <div className="relative h-[180px]">
          {totalClients ? (
            <Pie data={pieData} options={pieOptions} aria-label="Clients this month pie chart" role="img" />
          ) : (
            <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px]">No paid clients this month.</div>
          )}
        </div>
        <ul className="flex flex-col gap-1.5">
          {SLICES.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[11px]" title={s.hint}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} aria-hidden="true" />
              <span className="text-[#535359] flex-1 min-w-0 truncate">{s.label}</span>
              <span className="text-[#252525] font-semibold tabular-nums">{pct(groups[s.key] || 0, totalClients)}</span>
              <span className="text-[#A1A1A1] tabular-nums w-[28px] text-right">{groups[s.key] || 0}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
