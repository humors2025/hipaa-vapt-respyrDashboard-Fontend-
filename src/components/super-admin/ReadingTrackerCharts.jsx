"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

// Reading Tracker charts: a stacked bar per day (took / missed / never tested /
// no reading yet today) and a donut of clients for the month. Data comes from the
// API's `charts` block, computed over every paid client (no search or filters).

const SERIES = [
  { key: "took", label: "Took a reading", color: "#3FAF58" },
  { key: "missed", label: "Missed (has tested before)", color: "#E74C3C" },
  { key: "never", label: "Missed (never tested)", color: "#E48326" },
  { key: "pending", label: "No reading yet today", color: "#C4C9D2" },
];

const SLICES = [
  { key: "took", label: "Took readings this month", color: "#3FAF58", hint: "At least one reading this month" },
  { key: "missed", label: "Missed the whole month", color: "#E74C3C", hint: "Tested before, but not this month" },
  { key: "never", label: "Never taken a reading", color: "#E48326", hint: "Linked app profile, no test ever" },
  { key: "not_linked", label: "Not linked yet", color: "#C4C9D2", hint: "Paid, no app profile connected" },
];

const AXIS_TICK = { fontSize: 11, fill: "#738298", fontFamily: "'Poppins', sans-serif" };
const AXIS_LABEL = { fontSize: 11, fill: "#738298", fontFamily: "'Poppins', sans-serif", letterSpacing: "-0.22px" };
const TIP = "bg-white rounded-[10px] border border-[#E1E6ED] shadow-[0_4px_12px_rgba(37,37,37,0.12)] px-3.5 py-2.5";

const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "0.0%");

function shortDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function DayTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={TIP}>
      <div className="text-[#252525] text-[11px] font-semibold tracking-[-0.22px] mb-1.5">
        {shortDate(d.iso)} · {d.total} clients
      </div>
      {SERIES.filter((s) => d[`n_${s.key}`] > 0).map((s) => (
        <div key={s.key} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
          <span className="text-[#535359] text-[10px] tracking-[-0.2px] flex-1 whitespace-nowrap">{s.label}</span>
          <span className="text-[#252525] text-[10px] font-semibold tabular-nums ml-3">
            {mode === "percent" ? `${d[s.key]}%` : d[s.key]}
          </span>
        </div>
      ))}
    </div>
  );
}

function SliceTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className={TIP}>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.payload?.color }} />
        <span className="text-[#252525] text-[11px] font-semibold tracking-[-0.22px]">{d.name}</span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-[#535359] text-[10px]">{pct(d.value, total)}</span>
        <span className="text-[#252525] text-[10px] font-semibold tabular-nums">
          {d.value} {d.value === 1 ? "client" : "clients"}
        </span>
      </div>
    </div>
  );
}

export default function ReadingTrackerCharts({ charts, today }) {
  const [mode, setMode] = useState("count");
  const daily = charts?.daily ?? [];
  const groups = charts?.groups ?? {};

  // Days after today have nothing to show yet.
  const days = useMemo(() => daily.filter((d) => !today || d.day <= today), [daily, today]);

  const totals = useMemo(() => {
    const t = { took: 0, missed: 0, never: 0, pending: 0 };
    for (const d of days) for (const s of SERIES) t[s.key] += d[s.key] || 0;
    t.all = t.took + t.missed + t.never + t.pending;
    return t;
  }, [days]);

  const barData = useMemo(
    () =>
      days.map((d) => {
        const total = SERIES.reduce((s, x) => s + (d[x.key] || 0), 0);
        const row = { label: String(Number(d.day.slice(8))), iso: d.day, total };
        for (const s of SERIES) {
          const v = d[s.key] || 0;
          row[`n_${s.key}`] = v;
          row[s.key] = mode === "count" ? v : total ? Math.round((v / total) * 1000) / 10 : 0;
        }
        return row;
      }),
    [days, mode]
  );

  const pieData = SLICES.map((s) => ({ name: s.label, value: groups[s.key] || 0, color: s.color, hint: s.hint }));
  const totalClients = pieData.reduce((s, d) => s + d.value, 0);

  if (!charts) return null;

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-stretch">
      {/* Stacked bar per day */}
      <section className="xl:flex-[2] min-w-0 bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <div>
            <h2 className="text-[#252525] text-[15px] font-semibold tracking-[-0.3px]">Readings per day</h2>
            <p className="text-[#738298] text-[11px] tracking-[-0.22px] mt-0.5">
              Each bar is one day: paid clients who took a reading, who missed it, and who have never tested.
            </p>
          </div>
          <div className="flex rounded-[8px] bg-[#F5F7FA] p-0.5 shrink-0" role="tablist" aria-label="Show as">
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
                className={`px-3 py-1.5 rounded-[6px] text-[11px] font-semibold tracking-[-0.22px] transition-all cursor-pointer ${
                  mode === value ? "bg-white text-[#252525] shadow-[0_1px_3px_rgba(37,37,37,0.1)]" : "text-[#738298] hover:text-[#535359]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 mb-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[#535359] text-[11px] tracking-[-0.22px]">{s.label}</span>
              <span className="text-[#252525] text-[11px] font-semibold tabular-nums">{totals[s.key]}</span>
              <span className="text-[#738298] text-[10px] tracking-[-0.2px]">({pct(totals[s.key], totals.all)})</span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-[260px]">
          {days.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barCategoryGap="16%" maxBarSize={22}>
                <CartesianGrid stroke="#F0F1F3" strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: "#E1E6ED", strokeWidth: 1 }}
                  label={{ value: "Day of month", position: "insideBottom", offset: -4, style: AXIS_LABEL }}
                  height={40}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={mode === "percent" ? 48 : 44}
                  allowDecimals={false}
                  domain={mode === "percent" ? [0, 100] : [0, "auto"]}
                  ticks={mode === "percent" ? [0, 25, 50, 75, 100] : undefined}
                  tickFormatter={(v) => (mode === "percent" ? `${v}%` : v)}
                  label={{
                    value: mode === "percent" ? "% of clients" : "No. of clients",
                    angle: -90,
                    position: "insideLeft",
                    offset: 4,
                    style: AXIS_LABEL,
                  }}
                />
                <RechartsTooltip content={<DayTooltip mode={mode} />} cursor={{ fill: "rgba(48,139,249,0.04)" }} />
                {SERIES.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="a"
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-[#A1A1A1] text-[12px]">No days to show yet.</div>
          )}
        </div>
      </section>

      {/* Donut of clients for the month */}
      <section className="xl:flex-1 min-w-0 bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col">
        <div className="mb-2">
          <h2 className="text-[#252525] text-[15px] font-semibold tracking-[-0.3px]">Clients this month</h2>
          <p className="text-[#738298] text-[11px] tracking-[-0.22px] mt-0.5">Each paid client counted once.</p>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-[180px]">
          {totalClients ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={2} dataKey="value" stroke="#ffffff" strokeWidth={2}>
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<SliceTooltip total={totalClients} />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-[#A1A1A1] text-[12px]">No paid clients this month.</div>
          )}
        </div>
        <ul className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-[#F5F7FA]">
          {pieData.map((d) => (
            <li key={d.name} className="flex items-center gap-2.5" title={d.hint}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-[#535359] text-[12px] tracking-[-0.24px] flex-1 min-w-0 truncate">{d.name}</span>
              <span className="text-[#252525] text-[12px] font-semibold tabular-nums">{pct(d.value, totalClients)}</span>
              <span className="text-[#738298] text-[11px] tabular-nums w-7 text-right">{d.value}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
