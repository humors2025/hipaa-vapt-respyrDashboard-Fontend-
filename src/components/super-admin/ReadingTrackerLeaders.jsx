"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import * as Dialog from "@radix-ui/react-dialog";

// Reading Tracker "Top clients": lists from the API's `leaders` block (computed
// over every paid client for the month, ignoring search / filters / paging):
//   most_readings · most_missed · lowest (lowest regularity among clients who tested
//   this month) · most_regular, plus the never_tested / not_onboarded / renewed lists.
// Each card picks a ranking shown as a bar graph; the picked client's month is shown
// as a readings-per-day graph with a taken / missed strip. "See full list" opens all rows.

// color: strong tone (labels, picked bar); bar: light tone (other bars).
const TONES = {
  green: { color: "#3FAF58", bar: "#C3E8CB" },
  red: { color: "#E74C3C", bar: "#F5C2C7" },
  orange: { color: "#E48326", bar: "#F5D8B6" },
  blue: { color: "#308BF9", bar: "#B8D9FB" },
  muted: { color: "#738298", bar: "#D4D8DE" },
};

const TABS = [
  {
    key: "most_readings",
    label: "Most readings",
    tone: "green",
    chartTitle: "Most readings · top 10",
    hint: "Most breath readings this month (repeat tests count)",
    barUnit: "readings",
    value: (r) => r.reading_count,
    unit: (v) => `${v} reading${v === 1 ? "" : "s"}`,
    sub: (r) => `${r.taken_days.length} of ${r.counted_days} days`,
  },
  {
    key: "most_missed",
    label: "Most missed",
    tone: "red",
    chartTitle: "Most missed · top 10",
    hint: "Most days with no reading this month",
    barUnit: "days missed",
    value: (r) => r.missed_days.length,
    unit: (v) => `${v} day${v === 1 ? "" : "s"} missed`,
    sub: (r) => `${r.reading_count} reading${r.reading_count === 1 ? "" : "s"} · ${r.regularity}% regular`,
  },
  {
    key: "lowest",
    label: "Lowest usage",
    tone: "orange",
    chartTitle: "Lowest usage · top 10",
    hint: "Tested this month, but on the fewest of their days",
    barUnit: "% regular",
    value: (r) => r.regularity,
    unit: (v) => `${v}% of days`,
    sub: (r) => `${r.taken_days.length} of ${r.counted_days} days · ${r.reading_count} reading${r.reading_count === 1 ? "" : "s"}`,
    percent: true,
  },
  {
    key: "most_regular",
    label: "Most regular",
    tone: "green",
    chartTitle: "Most regular · top 10",
    hint: "Read on the highest share of their days (at least 7 days counted)",
    barUnit: "% regular",
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
    tone: "red",
    chartTitle: "Never taken a reading",
    hint: "App profile linked, but no breath reading ever",
    barUnit: "days since purchase",
    waiting: true,
    countField: "never",
    value: (r) => r.days_since_purchase,
    unit: (v) => `${v} day${v === 1 ? "" : "s"} since buying`,
    sub: (r) => `Bought ${shortDate(r.purchased_on)} · ${r.profile_id}`,
  },
  {
    key: "not_onboarded",
    label: "Bought, not onboarded",
    tone: "muted",
    chartTitle: "Not onboarded",
    hint: "Paid, but never set up an app profile",
    barUnit: "days since purchase",
    waiting: true,
    countField: "not_linked",
    value: (r) => r.days_since_purchase,
    unit: (v) => `${v} day${v === 1 ? "" : "s"} since buying`,
    sub: (r) => `Bought ${shortDate(r.purchased_on)} · ${r.email || "no email"}`,
  },
  // Clients whose plan has renewed (paid again), latest renewal first. The graph
  // shows how regularly each one reads this month.
  {
    key: "renewed",
    label: "Renewed plan",
    tone: "blue",
    chartTitle: "Renewed plan",
    hint: "Paid again when their plan renewed; bars show % of days with a reading this month",
    barUnit: "% regular",
    renewal: true,
    countField: "renewed",
    value: (r) => r.regularity,
    unit: (v) => `${v}% of days`,
    sub: (r) => `Renewed ${r.renewals}× · last ${shortDate(r.last_renewed)}`,
    percent: true,
  },
].map((t) => ({ ...t, color: TONES[t.tone].color, bar: TONES[t.tone].bar }));

const AXIS_TICK = { fontSize: 11, fill: "#738298", fontFamily: "'Poppins', sans-serif" };
const TIP = "bg-white rounded-[10px] border border-[#E1E6ED] shadow-[0_4px_12px_rgba(37,37,37,0.12)] px-3.5 py-2";

const displayName = (r) => r.name || r.email || r.profile_id || "—";
const short = (s, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function shortDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function TopTooltip({ active, payload, tab }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload.row;
  return (
    <div className={TIP}>
      <div className="text-[#252525] text-[11px] font-semibold tracking-[-0.22px]">{displayName(r)}</div>
      <div className="text-[12px] font-bold tracking-[-0.24px] mt-0.5" style={{ color: tab.color }}>
        {tab.unit(tab.value(r))}
      </div>
      <div className="text-[#738298] text-[10px] mt-0.5">{tab.sub(r)}</div>
    </div>
  );
}

// Ranked horizontal bar graph. Clicking a bar picks that client.
function TopChart({ tab, rows, selected, onSelect }) {
  const data = useMemo(
    () => rows.map((r, i) => ({ name: `${i + 1}. ${short(displayName(r))}`, value: tab.value(r), key: r.row_key, row: r })),
    [rows, tab]
  );
  return (
    <div style={{ height: Math.max(180, rows.length * 34 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <CartesianGrid stroke="#F0F1F3" strokeWidth={1} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "#E1E6ED", strokeWidth: 1 }}
            allowDecimals={false}
            domain={tab.percent ? [0, 100] : [0, "auto"]}
            tickFormatter={(v) => (tab.percent ? `${v}%` : tab.waiting ? `${v}d` : v)}
          />
          <YAxis type="category" dataKey="name" width={140} tick={{ ...AXIS_TICK, fill: "#535359" }} tickLine={false} axisLine={false} />
          <RechartsTooltip content={<TopTooltip tab={tab} />} cursor={{ fill: `${tab.color}10` }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} cursor="pointer" onClick={(d) => onSelect(d.key)}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.key === selected ? tab.color : tab.bar} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const STRIP = {
  taken: { color: "#3FAF58", label: "Took a reading" },
  missed: { color: "#E74C3C", label: "Missed" },
  pending: { color: "#C4C9D2", label: "Today, not yet" },
  none: { color: "#E8ECF0", label: "Not counted" },
};

function DayTooltip({ active, payload, row }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const times = (row.reading_times?.[d.iso] || []).map((t) => t.slice(0, 5)).join(", ");
  const text =
    d.state === "missed"
      ? "Missed"
      : d.state === "pending"
      ? "No reading yet today"
      : d.state === "none"
      ? "Not counted (outside plan dates)"
      : `${d.count} reading${d.count === 1 ? "" : "s"}${times ? `: ${times}` : ""}`;
  return (
    <div className={TIP}>
      <div className="text-[#252525] text-[11px] font-semibold tracking-[-0.22px]">{shortDate(d.iso)}</div>
      <div className={`text-[12px] font-bold tracking-[-0.24px] mt-0.5 ${d.state === "taken" ? "text-[#308BF9]" : "text-[#738298]"}`}>{text}</div>
    </div>
  );
}

// One client's month: readings per day (bars) + a strip of taken / missed / today / not counted.
function ClientMonth({ row, month, daysInMonth, today }) {
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const taken = new Set(row.taken_days);
    const missed = new Set(row.missed_days);
    const pending = new Set(row.pending_days || []);
    return Array.from({ length: daysInMonth }, (_, i) => {
      const iso = new Date(Date.UTC(y, m - 1, i + 1)).toISOString().slice(0, 10);
      const state = taken.has(iso) ? "taken" : missed.has(iso) ? "missed" : pending.has(iso) ? "pending" : "none";
      return { iso, day: String(i + 1), state, count: row.reading_times?.[iso]?.length || 0, future: Boolean(today && iso > today) };
    });
  }, [row, month, daysInMonth, today]);

  return (
    <div className="flex flex-col">
      <div style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} barCategoryGap="6%" maxBarSize={14}>
            <CartesianGrid stroke="#F0F1F3" strokeWidth={1} vertical={false} />
            <XAxis dataKey="day" tick={{ ...AXIS_TICK, fontSize: 9 }} tickLine={false} axisLine={{ stroke: "#E1E6ED", strokeWidth: 1 }} interval={0} />
            <YAxis tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
            <RechartsTooltip content={<DayTooltip row={row} />} cursor={{ fill: "rgba(48,139,249,0.04)" }} />
            <Bar dataKey="count" fill="#A8D4FE" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-[3px] mt-3 pl-[24px]" aria-hidden="true">
        {days.map((d) => (
          <div
            key={d.iso}
            className={`flex-1 h-[14px] rounded-[3px] ${d.future ? "opacity-40" : ""}`}
            style={{ background: STRIP[d.state].color }}
            title={`${shortDate(d.iso)}: ${STRIP[d.state].label}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pl-[24px]">
        {Object.values(STRIP).map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-[10px] h-[10px] rounded-[2px] shrink-0" style={{ background: s.color }} />
            <span className="text-[#738298] text-[10px] tracking-[-0.2px]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "#252525" }) {
  return (
    <div className="bg-[#F5F7FA] rounded-[10px] px-3 py-2.5 border border-[#E1E6ED] min-w-0">
      <div className="text-[#738298] text-[9px] font-medium uppercase tracking-[0.4px] truncate">{label}</div>
      <div className="text-[16px] font-bold tracking-[-0.32px] mt-0.5 leading-tight tabular-nums truncate" style={{ color }}>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatBox label="Bought on" value={shortDate(row.purchased_on)} />
        <StatBox label="Days since buying" value={row.days_since_purchase} color={tab.color} />
        <StatBox label="Plan" value={status.charAt(0).toUpperCase() + status.slice(1)} />
        <StatBox label="Plan code" value={row.plan_code || "–"} />
      </div>
      <div className="rounded-[10px] bg-[#F5F7FA] px-3 py-2.5 text-[12px] text-[#535359] leading-relaxed">
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
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[1180px] max-h-[calc(100vh-48px)] overflow-y-auto overflow-x-hidden bg-white rounded-[15px] shadow-xl p-5 flex flex-col gap-4 focus:outline-none"
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
                      : tab.renewal
                        ? `${total} client${total === 1 ? "" : "s"}${rows.length < total ? ` (showing the latest ${rows.length})` : ""}, latest renewal first.`
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
                            {tab.renewal && (
                              <>
                                <th className={`${th} text-center`}>Renewals</th>
                                <th className={th}>Last renewed</th>
                              </>
                            )}
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
                              {tab.renewal && (
                                <>
                                  <td className={`${td} text-center font-semibold`} style={{ color: tab.color }}>
                                    {r.renewals}×
                                  </td>
                                  <td className={td}>
                                    {shortDate(r.last_renewed)}
                                    {r.renewed_this_month && (
                                      <span className="ml-1.5 rounded-full bg-[#E9F3FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#308BF9]">
                                        this month
                                      </span>
                                    )}
                                  </td>
                                </>
                              )}
                              <td className={`${td} text-center font-semibold text-[#252525]`}>{r.reading_count}</td>
                              <td className={`${td} text-center text-[#3FAF58]`}>{r.taken_days.length}</td>
                              <td className={`${td} text-center text-[#E74C3C]`}>{r.missed_days.length}</td>
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
    <section className="flex flex-col gap-5 min-w-0">
      <div>
        <h2 className="text-[#252525] text-[18px] font-semibold tracking-[-0.36px]">Top clients this month</h2>
        <p className="text-[#535359] text-[13px] mt-1 tracking-[-0.26px]">
          Click a category card to change the ranking. Click a bar to see that client&apos;s detail. Covers every paid client
          this month.
        </p>
      </div>

      {/* One card per list, showing who is #1 */}
      <div className="flex gap-3 overflow-x-auto p-1 pb-3" role="group" aria-label="Top client lists">
        {TABS.map((t) => {
          const first = leaders[t.key]?.[0];
          const active = t.key === tabKey;
          const count = countOf(t);
          let name = null;
          let stat;
          let sub;
          if (t.waiting || t.renewal) {
            stat = `${count} client${count === 1 ? "" : "s"}`;
            sub = first
              ? t.renewal
                ? `Latest: ${displayName(first)} · ${shortDate(first.last_renewed)}`
                : `Longest: ${displayName(first)} · ${first.days_since_purchase} days`
              : "Nobody right now";
          } else if (first) {
            name = displayName(first);
            stat = t.unit(t.value(first));
            sub = t.sub(first);
          } else {
            stat = "—";
            sub = "No clients yet";
          }
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => setTabKey(t.key)}
              className="min-w-[172px] max-w-[220px] flex-shrink-0 bg-white rounded-[15px] border border-[#E1E6ED] text-left transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col"
              style={{
                borderTop: `2.5px solid ${t.color}`,
                ...(active ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${t.color}` } : {}),
              }}
            >
              <div className="p-4 pb-3 flex flex-col flex-1 min-w-0 w-full">
                <span className="text-[10px] font-semibold uppercase tracking-[0.3px]" style={{ color: t.color }}>
                  {t.label}
                </span>
                {name && <span className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px] mt-1.5 leading-tight truncate">{name}</span>}
                <span className="text-[#252525] text-[18px] font-bold tracking-[-0.36px] mt-1 leading-none tabular-nums">{stat}</span>
                <span className="text-[#738298] text-[11px] tracking-[-0.22px] mt-1.5 line-clamp-2">{sub}</span>
              </div>
              <div className="w-full px-4 py-2.5 border-t border-[#F5F7FA] rounded-b-[15px]" style={{ background: active ? `${t.color}0D` : undefined }}>
                <span className="text-[11px] font-semibold tracking-[-0.22px]" style={{ color: t.color }}>
                  {active ? "Active" : "View"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-[15px] border border-[#E1E6ED] py-10 text-center text-[#A1A1A1] text-[12px]">
          No clients for this list this month.
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-5 items-stretch">
          {/* Left: ranked bar graph */}
          <div className="flex-1 min-w-0 bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: tab.color }}>
                  {tab.waiting || tab.renewal ? `${tab.chartTitle} · ${rows.length}` : tab.chartTitle}
                </h3>
                <p className="text-[#738298] text-[11px] tracking-[-0.22px] mt-0.5">{tab.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewKey(tab.key)}
                aria-haspopup="dialog"
                className="shrink-0 text-[11px] font-semibold text-[#308BF9] hover:underline cursor-pointer whitespace-nowrap"
              >
                See full list ›
              </button>
            </div>
            {/* keyed by tab so the graph height follows the row count */}
            <TopChart key={tabKey} tab={tab} rows={rows} selected={selectedId} onSelect={select} />
            <div className="text-[#738298] text-[10px] text-right mt-1">{tab.barUnit}</div>
          </div>

          {/* Right: the picked client's detail */}
          {selected && (
            <div className="flex-1 min-w-0 bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-[#252525] text-[16px] font-semibold tracking-[-0.32px] truncate">{displayName(selected)}</h3>
                  <span className="text-[#738298] text-[11px] tracking-[-0.22px] break-all">
                    {selected.email || "–"} · {selected.profile_id || "No app profile yet"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label="Pick a client"
                    value={selectedId}
                    onChange={(e) => select(e.target.value)}
                    className="rounded-[8px] border border-[#E1E6ED] bg-white text-[12px] text-[#252525] px-3 py-1.5 cursor-pointer focus:outline-none focus:border-[#308BF9] tracking-[-0.24px] max-w-[200px]"
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
                      className="text-[#308BF9] text-[12px] font-semibold tracking-[-0.24px] whitespace-nowrap cursor-pointer hover:underline"
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
                  {tab.renewal && (
                    <div className="grid grid-cols-3 gap-2.5 mb-2.5">
                      <StatBox label="Renewals" value={`${selected.renewals}×`} color={tab.color} />
                      <StatBox label="Last renewed" value={shortDate(selected.last_renewed)} />
                      <StatBox label="First bought" value={shortDate(selected.purchased_on)} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
                    <StatBox label="Readings" value={selected.reading_count} />
                    <StatBox label="Days taken" value={selected.taken_days.length} color="#3FAF58" />
                    <StatBox
                      label="Days missed"
                      value={selected.missed_days.length}
                      color={selected.missed_days.length > 0 ? "#E74C3C" : "#252525"}
                    />
                    <StatBox label="Regular" value={`${selected.regularity}%`} />
                    <StatBox label="Best streak" value={`${selected.streak} day${selected.streak === 1 ? "" : "s"}`} />
                  </div>
                  <ClientMonth row={selected} month={month} daysInMonth={daysInMonth} today={today} />
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
        total={viewTab ? (viewTab.waiting || viewTab.renewal ? countOf(viewTab) : (leaders[viewTab.key] || []).length) : 0}
        onClose={() => setViewKey(null)}
        onOpenProfile={onOpenProfile}
      />
    </section>
  );
}
