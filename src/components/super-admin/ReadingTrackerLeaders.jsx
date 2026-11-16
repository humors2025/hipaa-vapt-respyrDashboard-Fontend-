"use client";

import { useMemo, useState } from "react";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";
import * as Dialog from "@radix-ui/react-dialog";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Reading Tracker "Top clients": four lists from the API's `leaders` block (computed
// over every paid client for the month, ignoring search / filters / paging):
//   most_readings · most_missed · lowest (lowest regularity among clients who tested
//   this month) · most_regular. Each tab shows the top 10 as a bar graph, and the
//   picked client's month as a readings-per-day graph with a taken / missed strip.

const TABS = [
  {
    key: "most_readings",
    label: "Most readings",
    color: "#308BF9",
    hint: "Most breath readings this month (repeat tests count)",
    value: (r) => r.reading_count,
    unit: (v) => `${v} reading${v === 1 ? "" : "s"}`,
    sub: (r) => `${r.taken_days.length} of ${r.counted_days} days`,
  },
  {
    key: "most_missed",
    label: "Most missed",
    color: "#D9534F",
    hint: "Most days with no reading this month",
    value: (r) => r.missed_days.length,
    unit: (v) => `${v} day${v === 1 ? "" : "s"} missed`,
    sub: (r) => `${r.reading_count} reading${r.reading_count === 1 ? "" : "s"} · ${r.regularity}% regular`,
  },
  {
    key: "lowest",
    label: "Lowest usage",
    color: "#F5A524",
    hint: "Tested this month, but on the fewest of their days",
    value: (r) => r.regularity,
    unit: (v) => `${v}% of days`,
    sub: (r) => `${r.taken_days.length} of ${r.counted_days} days · ${r.reading_count} reading${r.reading_count === 1 ? "" : "s"}`,
    percent: true,
  },
  {
    key: "most_regular",
    label: "Most regular",
    color: "#3FAF58",
    hint: "Read on the highest share of their days (at least 7 days counted)",
    value: (r) => r.regularity,
    unit: (v) => `${v}% of days`,
    sub: (r) => `${r.taken_days.length} of ${r.counted_days} days · best streak ${r.streak} day${r.streak === 1 ? "" : "s"}`,
    percent: true,
  },
  // "Waiting" lists: every client (up to 50), longest since buying first. The card
  // shows how many, the graph shows days since buying.
  {
    key: "never_tested",
    label: "Never taken a reading",
    color: "#A86A00",
    hint: "App profile linked, but no breath reading ever",
    waiting: true,
    countField: "never",
    value: (r) => r.days_since_purchase,
    unit: (v) => `${v} day${v === 1 ? "" : "s"} since buying`,
    sub: (r) => `Bought ${shortDate(r.purchased_on)} · ${r.profile_id}`,
  },
  {
    key: "not_onboarded",
    label: "Bought, not onboarded",
    color: "#7A8699",
    hint: "Paid, but never set up an app profile",
    waiting: true,
    countField: "not_linked",
    value: (r) => r.days_since_purchase,
    unit: (v) => `${v} day${v === 1 ? "" : "s"} since buying`,
    sub: (r) => `Bought ${shortDate(r.purchased_on)} · ${r.email || "no email"}`,
  },
];

const tooltipBase = {
  backgroundColor: "#252525",
  padding: 10,
  cornerRadius: 8,
  titleFont: { size: 11, weight: 600 },
  bodyFont: { size: 11 },
};

const displayName = (r) => r.name || r.email || r.profile_id || "—";
const short = (s, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function shortDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Top-10 horizontal bar graph. Clicking a bar picks that client.
function TopChart({ tab, rows, selected, onSelect }) {
  const data = useMemo(
    () => ({
      labels: rows.map((r, i) => `${i + 1}. ${short(displayName(r))}`),
      datasets: [
        {
          data: rows.map(tab.value),
          backgroundColor: rows.map((r) => (r.row_key === selected ? tab.color : `${tab.color}66`)),
          borderRadius: 4,
          maxBarThickness: 18,
        },
      ],
    }),
    [rows, tab, selected]
  );
  const options = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_e, els) => els[0] && onSelect(rows[els[0].index].row_key),
      onHover: (e, els) => {
        if (e.native?.target) e.native.target.style.cursor = els.length ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase,
          callbacks: {
            title: (items) => displayName(rows[items[0].dataIndex]),
            label: (ctx) => {
              const r = rows[ctx.dataIndex];
              return [` ${tab.unit(tab.value(r))}`, ` ${tab.sub(r)}`];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: tab.percent ? 100 : undefined,
          grid: { color: "#F0F3F7" },
          ticks: {
            color: "#A1A1A1",
            font: { size: 10 },
            precision: 0,
            callback: (v) => (tab.percent ? `${v}%` : tab.waiting ? `${v}d` : v),
          },
        },
        y: { grid: { display: false }, ticks: { color: "#535359", font: { size: 11 } } },
      },
    }),
    [rows, tab, onSelect]
  );
  return (
    <div className="relative" style={{ height: Math.max(140, rows.length * 30 + 30) }}>
      <Bar data={data} options={options} role="img" aria-label={`${tab.label} top ${rows.length} bar graph`} />
    </div>
  );
}

// One client's month: readings per day (bars) + a strip of taken / missed / today / not counted.
function ClientMonth({ row, month, daysInMonth, today, color }) {
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const taken = new Set(row.taken_days);
    const missed = new Set(row.missed_days);
    const pending = new Set(row.pending_days || []);
    return Array.from({ length: daysInMonth }, (_, i) => {
      const iso = new Date(Date.UTC(y, m - 1, i + 1)).toISOString().slice(0, 10);
      const state = taken.has(iso) ? "taken" : missed.has(iso) ? "missed" : pending.has(iso) ? "pending" : "none";
      return { iso, n: i + 1, state, count: row.reading_times?.[iso]?.length || 0, future: today && iso > today };
    });
  }, [row, month, daysInMonth, today]);

  const data = useMemo(
    () => ({
      labels: days.map((d) => d.n),
      datasets: [
        {
          label: "Readings",
          data: days.map((d) => d.count),
          backgroundColor: color,
          borderRadius: 3,
          maxBarThickness: 16,
        },
      ],
    }),
    [days, color]
  );
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase,
          callbacks: {
            title: (items) => shortDate(days[items[0].dataIndex].iso),
            label: (ctx) => {
              const d = days[ctx.dataIndex];
              if (d.state === "missed") return " Missed";
              if (d.state === "pending") return " No reading yet today";
              if (d.state === "none") return " Not counted (outside plan dates)";
              const times = (row.reading_times?.[d.iso] || []).map((t) => t.slice(0, 5)).join(", ");
              return ` ${d.count} reading${d.count === 1 ? "" : "s"}${times ? `: ${times}` : ""}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#A1A1A1", font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: "#F0F3F7" }, ticks: { color: "#A1A1A1", font: { size: 10 }, precision: 0 } },
      },
    }),
    [days, row]
  );

  const strip = { taken: "bg-[#3FAF58]", missed: "bg-[#D9534F]", pending: "bg-[#C9D2DE]", none: "bg-[#F0F3F7]" };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[180px]">
        <Bar data={data} options={options} role="img" aria-label={`${displayName(row)} readings per day`} />
      </div>
      <div className="grid gap-[3px] pl-[26px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {days.map((d) => (
          <span
            key={d.iso}
            title={`${shortDate(d.iso)}: ${d.state === "taken" ? "took a reading" : d.state === "missed" ? "missed" : d.state === "pending" ? "no reading yet today" : "not counted"}`}
            className={`h-2.5 rounded-[2px] ${strip[d.state]} ${d.future ? "opacity-40" : ""}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#535359] pl-[26px]">
        {[
          ["bg-[#3FAF58]", "Took a reading"],
          ["bg-[#D9534F]", "Missed"],
          ["bg-[#C9D2DE]", "Today, not yet"],
          ["bg-[#F0F3F7]", "Not counted"],
        ].map(([cls, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-[2px] ${cls}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value, tone }) {
  return (
    <div className="rounded-[10px] bg-[#F5F7FA] px-3 py-2 min-w-0">
      <div className="text-[#A1A1A1] text-[10px] font-semibold uppercase tracking-wide truncate">{label}</div>
      <div className="text-[14px] font-bold tabular-nums truncate" style={{ color: tone || "#252525" }}>
        {value}
      </div>
    </div>
  );
}

// Detail for a client on a "waiting" list: nothing to chart per day, so plain facts.
function WaitingDetail({ row, tab }) {
  const status = (row.subscription_status || "unknown").replace(/_/g, " ");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Fact label="Bought on" value={shortDate(row.purchased_on)} />
        <Fact label="Days since buying" value={row.days_since_purchase} tone={tab.color} />
        <Fact label="Plan" value={status.charAt(0).toUpperCase() + status.slice(1)} />
        <Fact label="Plan code" value={row.plan_code || "–"} />
      </div>
      <div className="rounded-[10px] bg-[#F8FAFC] px-3 py-2.5 text-[12px] text-[#535359] leading-relaxed">
        {row.linked
          ? "This client has an app profile but has never taken a breath reading. They may need help setting up the device."
          : "This buyer paid but has not created or linked an app profile yet, so no readings can be tracked. They may need help getting started in the app."}
      </div>
    </div>
  );
}

function formatStamp(value) {
  if (!value) return "–";
  const [d, t] = String(value).split(" ");
  return `${shortDate(d)}${t ? `, ${t.slice(0, 5)}` : ""}`;
}

// Full list behind one card, as a table. Leader lists hold up to 10 rows, the
// "waiting" lists up to 50, so a search box and a scrolling table are enough.
function ListPopup({ tab, rows, total, onClose, onOpenProfile }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term
    ? rows.filter((r) => [r.name, r.email, r.profile_id].some((v) => String(v || "").toLowerCase().includes(term)))
    : rows;
  const th = "py-2.5 px-3 font-semibold whitespace-nowrap";
  const td = "py-2.5 px-3 text-[#535359] whitespace-nowrap tabular-nums";
  const rank = new Map(rows.map((r, i) => [r.row_key, i + 1]));

  return (
    <Dialog.Root open={Boolean(tab)} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[1000px] max-h-[calc(100vh-48px)] overflow-y-auto bg-white rounded-[15px] shadow-xl p-5 flex flex-col gap-4 focus:outline-none"
        >
          {tab && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Dialog.Title className="text-[16px] font-bold" style={{ color: tab.color }}>
                    {tab.label}
                  </Dialog.Title>
                  <div className="text-[12px] text-[#A1A1A1] mt-0.5">
                    {tab.hint}.{" "}
                    {tab.waiting
                      ? `${total} client${total === 1 ? "" : "s"}${rows.length < total ? ` (showing the ${rows.length} waiting longest)` : ""}, longest since buying first.`
                      : `Top ${rows.length} this month.`}
                  </div>
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#252525] cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </Dialog.Close>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, email, or profile ID"
                  aria-label="Search this list"
                  autoComplete="off"
                  className="w-full md:max-w-[320px] rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-[#308BF9]"
                />
                <span className="text-[#A1A1A1] text-[11px]">
                  {shown.length} client{shown.length === 1 ? "" : "s"}
                </span>
              </div>

              {shown.length === 0 ? (
                <div className="rounded-[10px] bg-[#F8FAFC] py-8 text-center text-[#A1A1A1] text-[12px]">
                  {rows.length ? "No clients match." : "No clients for this list this month."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
                  <table className="w-full text-[12px] min-w-[760px]">
                    <thead>
                      <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                        <th className={th}>#</th>
                        <th className={th}>Client</th>
                        {tab.waiting ? (
                          <>
                            <th className={th}>Bought on</th>
                            <th className={`${th} text-center`}>Days since buying</th>
                            <th className={th}>Plan</th>
                            <th className={th}>Plan code</th>
                          </>
                        ) : (
                          <>
                            <th className={`${th} text-center`}>Readings</th>
                            <th className={`${th} text-center`}>Days taken</th>
                            <th className={`${th} text-center`}>Days missed</th>
                            <th className={`${th} text-center`}>Regular</th>
                            <th className={`${th} text-center`}>Best streak</th>
                            <th className={th}>Last reading</th>
                          </>
                        )}
                        <th className={th}>
                          <span className="sr-only">Profile</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.row_key} className="border-t border-[#F5F7FA]">
                          <td className={`${td} text-[#A1A1A1]`}>{rank.get(r.row_key)}</td>
                          <td className="py-2.5 px-3 max-w-[240px]">
                            <div className="text-[#252525] font-semibold truncate">{displayName(r)}</div>
                            <div className="text-[#A1A1A1] text-[11px] truncate">
                              {r.email || "–"} · {r.profile_id || "No app profile yet"}
                            </div>
                          </td>
                          {tab.waiting ? (
                            <>
                              <td className={td}>{shortDate(r.purchased_on)}</td>
                              <td className={`${td} text-center font-semibold`} style={{ color: tab.color }}>
                                {r.days_since_purchase}
                              </td>
                              <td className={`${td} capitalize`}>{(r.subscription_status || "unknown").replace(/_/g, " ")}</td>
                              <td className={td}>{r.plan_code || "–"}</td>
                            </>
                          ) : (
                            <>
                              <td className={`${td} text-center font-semibold text-[#252525]`}>{r.reading_count}</td>
                              <td className={`${td} text-center text-[#2E8B47]`}>{r.taken_days.length}</td>
                              <td className={`${td} text-center text-[#B5363A]`}>{r.missed_days.length}</td>
                              <td className={`${td} text-center`}>{r.regularity}%</td>
                              <td className={`${td} text-center`}>
                                {r.streak} day{r.streak === 1 ? "" : "s"}
                              </td>
                              <td className={td}>{formatStamp(r.last_reading)}</td>
                            </>
                          )}
                          <td className="py-2.5 px-3 text-right">
                            {r.linked && onOpenProfile && (
                              <button
                                type="button"
                                onClick={() => onOpenProfile(r)}
                                className="text-[11px] font-semibold text-[#308BF9] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                Open profile ›
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function ReadingTrackerLeaders({ leaders, summary, month, daysInMonth, today, onOpenProfile }) {
  const [tabKey, setTabKey] = useState(TABS[0].key);
  const [picked, setPicked] = useState({});
  const tab = TABS.find((t) => t.key === tabKey);
  const rows = leaders?.[tabKey] || [];
  const selectedId = rows.some((r) => r.row_key === picked[tabKey]) ? picked[tabKey] : rows[0]?.row_key;
  const selected = rows.find((r) => r.row_key === selectedId);
  const select = (id) => setPicked((p) => ({ ...p, [tabKey]: id }));
  const countOf = (t) => summary?.[t.countField] ?? leaders?.[t.key]?.length ?? 0;
  const [viewKey, setViewKey] = useState(null);
  const viewTab = TABS.find((t) => t.key === viewKey) || null;

  if (!leaders) return null;

  return (
    <section className="bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col gap-4 min-w-0">
      <div>
        <h2 className="text-[#252525] text-[14px] font-bold">Top clients this month</h2>
        <p className="text-[#A1A1A1] text-[11px] mt-0.5">
          Across every paid client this month (search and filters below don&apos;t change it). Click a client to see more.
        </p>
      </div>

      {/* One card per list, showing who is #1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3" role="group" aria-label="Top client lists">
        {TABS.map((t) => {
          const first = leaders[t.key]?.[0];
          const active = t.key === tabKey;
          return (
            <div
              key={t.key}
              className={`rounded-[10px] border transition-colors min-w-0 flex flex-col ${
                active ? "bg-white shadow-sm" : "bg-[#F8FAFC] border-transparent hover:border-[#C9D6E8]"
              }`}
              style={active ? { borderColor: t.color } : undefined}
            >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => setTabKey(t.key)}
              className="text-left p-3 pb-2 cursor-pointer min-w-0 flex-1"
            >
              <div className="text-[12px] font-semibold" style={{ color: t.color }}>
                {t.label}
              </div>
              {t.waiting ? (
                <>
                  <div className="text-[#252525] text-[18px] font-bold tabular-nums leading-tight mt-0.5">
                    {countOf(t)} client{countOf(t) === 1 ? "" : "s"}
                  </div>
                  <div className="text-[#A1A1A1] text-[11px] truncate">
                    {first ? `Longest: ${displayName(first)} · ${first.days_since_purchase} days` : "Nobody right now"}
                  </div>
                </>
              ) : first ? (
                <>
                  <div className="text-[#252525] text-[13px] font-bold truncate mt-0.5">{displayName(first)}</div>
                  <div className="text-[#252525] text-[18px] font-bold tabular-nums leading-tight">{t.unit(t.value(first))}</div>
                  <div className="text-[#A1A1A1] text-[11px] truncate">{t.sub(first)}</div>
                </>
              ) : (
                <div className="text-[#A1A1A1] text-[12px] mt-1">No clients yet</div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewKey(t.key)}
              aria-haspopup="dialog"
              className="mx-3 mb-3 self-start rounded-[8px] border border-[#E1E6ED] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#308BF9] hover:bg-[#EEF4FE] cursor-pointer"
            >
              View
            </button>
            </div>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[10px] bg-[#F8FAFC] py-8 text-center text-[#A1A1A1] text-[12px]">No clients for this list this month.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-5">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">
              {tab.label} · {tab.waiting ? `${rows.length} client${rows.length === 1 ? "" : "s"}, longest since buying first` : `top ${rows.length}`}{" "}
              <span className="normal-case font-normal">· {tab.hint}</span>
            </div>
            {/* keyed by tab: Chart.js keeps the old canvas height when the row count changes */}
            <TopChart key={tabKey} tab={tab} rows={rows} selected={selectedId} onSelect={select} />
          </div>

          {selected && (
            <div className="flex flex-col gap-3 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[#252525] text-[14px] font-bold truncate">{displayName(selected)}</div>
                  <div className="text-[#A1A1A1] text-[11px] truncate">
                    {selected.email || "–"} · {selected.profile_id || "No app profile yet"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Pick a client"
                    value={selectedId}
                    onChange={(e) => select(e.target.value)}
                    className="rounded-[10px] border border-[#E1E6ED] bg-white px-2 py-1.5 text-[11px] max-w-[200px]"
                  >
                    {rows.map((r, i) => (
                      <option key={r.row_key} value={r.row_key}>
                        {i + 1}. {displayName(r)}
                      </option>
                    ))}
                  </select>
                  {onOpenProfile && selected.linked && (
                    <button
                      type="button"
                      onClick={() => onOpenProfile(selected)}
                      className="rounded-[10px] border border-[#E1E6ED] px-3 py-1.5 text-[11px] font-semibold text-[#308BF9] hover:bg-[#EEF4FE] cursor-pointer whitespace-nowrap"
                    >
                      Open profile ›
                    </button>
                  )}
                </div>
              </div>
              {tab.waiting ? (
                <WaitingDetail row={selected} tab={tab} />
              ) : (
                <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Fact label="Readings" value={selected.reading_count} />
                <Fact label="Days taken" value={selected.taken_days.length} tone="#2E8B47" />
                <Fact label="Days missed" value={selected.missed_days.length} tone="#B5363A" />
                <Fact label="Regular" value={`${selected.regularity}%`} />
                <Fact label="Best streak" value={`${selected.streak} day${selected.streak === 1 ? "" : "s"}`} />
              </div>
              <ClientMonth row={selected} month={month} daysInMonth={daysInMonth} today={today} color={tab.color} />
                </>
              )}
            </div>
          )}
        </div>
      )}
      <ListPopup
        key={viewKey || "closed"}
        tab={viewTab}
        rows={viewTab ? leaders[viewTab.key] || [] : []}
        total={viewTab ? (viewTab.waiting ? countOf(viewTab) : (leaders[viewTab.key] || []).length) : 0}
        onClose={() => setViewKey(null)}
        onOpenProfile={onOpenProfile}
      />
    </section>
  );
}
