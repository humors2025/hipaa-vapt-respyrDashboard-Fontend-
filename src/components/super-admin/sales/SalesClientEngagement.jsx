"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSuperAdminSalesEngagementService } from "@/services/superAdminSalesService";
import { formatCount, formatDate, formatRate } from "./salesFormat";
import { EmptyState, SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";
import { SalesPagination } from "./PurchaseTable";

// Client Engagement, as in TA Analytics, but only for paying customers: people who
// bought or renewed in the selected period. Rate = days with a breath test ÷ days
// since they first paid (capped at 100%).

const PAGE_SIZE = 10;
const SEARCH_MIN = 3;

const GROUPS = [
  { value: "all", label: "Purchased or renewed" },
  { value: "purchased", label: "Purchased" },
  { value: "renewed", label: "Renewed" },
];

const TIER_COLORS = {
  "90%+": "#2E8B47",
  "70%+": "#3FAF58",
  "50%+": "#308BF9",
  "25%+": "#F5A524",
  "10%+": "#E07B39",
  "<10%": "#D9534F",
};

const GOALS = [
  { key: "fat_loss", label: "Fat Loss", color: "#E07B39" },
  { key: "muscle_gain", label: "Muscle Gain", color: "#3FAF58" },
  { key: "weight_loss", label: "Weight Loss", color: "#D9534F" },
  { key: "other", label: "Not set", color: "#A1A1A1" },
];

function rateColor(pct) {
  if (pct >= 70) return "#2E8B47";
  if (pct >= 40) return "#A66B00";
  return "#B5363A";
}

function goalLabel(g) {
  if (!g) return "—";
  const l = g.toLowerCase();
  if (l.includes("fat")) return "Fat Loss";
  if (l.includes("weight")) return "Weight Loss";
  if (l.includes("muscle") || l.includes("gain")) return "Muscle Gain";
  return g;
}

function goalColor(g) {
  const l = String(g || "").toLowerCase();
  if (l.includes("fat")) return "#E07B39";
  if (l.includes("weight") || l.includes("loss")) return "#D9534F";
  if (l.includes("muscle") || l.includes("gain")) return "#3FAF58";
  return "#A1A1A1";
}

function RateCell({ pct }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-[40px] h-1 rounded-full bg-[#F0F3F7] overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: rateColor(pct) }} />
      </div>
      <span className="font-semibold tabular-nums w-[38px] text-right" style={{ color: rateColor(pct) }}>
        {pct}%
      </span>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`rounded-[10px] p-3 flex flex-col gap-0.5 min-w-0 ${tone === "blue" ? "bg-[#EEF4FE]" : "bg-[#F8FAFC]"}`}>
      <span className={`text-[11px] ${tone === "blue" ? "text-[#308BF9]" : "text-[#535359]"}`}>{label}</span>
      <span className={`text-[22px] font-bold leading-tight tabular-nums ${tone === "blue" ? "text-[#308BF9]" : "text-[#252525]"}`}>{value}</span>
      {sub && <span className="text-[11px] text-[#A1A1A1] truncate">{sub}</span>}
    </div>
  );
}

function Badge({ children, tone }) {
  const cls = tone === "green" ? "bg-[#E9F7EE] text-[#2E8B47]" : "bg-[#EEF4FE] text-[#308BF9]";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

export default function SalesClientEngagement({ period, dateFrom, dateTo, trainerAdmin, rangeLabel }) {
  const [group, setGroup] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState(null);
  const [page, setPage] = useState(1);
  const req = useRef(0);

  const load = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSuperAdminSalesEngagementService({ period, dateFrom, dateTo, trainerAdmin, group });
      if (id !== req.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load client engagement");
      setData(res);
    } catch (err) {
      if (id !== req.current) return;
      setError(err?.data?.message || err?.message || "Failed to load client engagement");
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [period, dateFrom, dateTo, trainerAdmin, group]);

  useEffect(() => {
    load();
    setPage(1);
    setTier(null);
  }, [load]);

  const s = data?.summary;
  const term = search.trim().toLowerCase();
  const tooShort = term.length > 0 && term.length < SEARCH_MIN;

  const rows = useMemo(() => {
    let list = data?.clients || [];
    if (tier) list = list.filter((c) => c.cohort === tier);
    if (term.length >= SEARCH_MIN) {
      list = list.filter((c) =>
        [c.name, c.email, c.profile_id, c.trainer_name, c.trainer_code].some((v) => String(v || "").toLowerCase().includes(term))
      );
    }
    return list;
  }, [data, tier, term]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const weekChange = s?.readings_week_change;
  const maxTier = Math.max(1, ...(s?.cohorts || []).map((c) => c.count));

  return (
    <SalesCard
      title="Client Engagement"
      subtitle={`Are paying customers engaged and consistent? Customers who bought or renewed during ${rangeLabel}. Rate = days with a breath test ÷ days since they first paid.`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <UpdatingPill show={loading && Boolean(data)} />
          <div className="inline-flex rounded-[10px] border border-[#E1E6ED] p-0.5 bg-white" role="tablist" aria-label="Which customers">
            {GROUPS.map((g) => (
              <button
                key={g.value}
                type="button"
                role="tab"
                aria-selected={group === g.value}
                onClick={() => setGroup(g.value)}
                className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors cursor-pointer ${
                  group === g.value ? "bg-[#308BF9] text-white" : "text-[#535359] hover:bg-[#F5F7FA]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {error ? (
        <SectionError message={error} onRetry={load} />
      ) : loading && !data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[76px]" />
            ))}
          </div>
          <Skeleton className="h-[220px]" />
        </div>
      ) : !s || s.clients === 0 ? (
        <EmptyState
          message={
            group === "renewed" && data?.renewals_available === false
              ? "Renewal payments are not recorded on this environment yet."
              : "No paying customers with an app profile in this period."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat
              tone="blue"
              label="Avg reading rate"
              value={`${s.avg_rate}%`}
              sub={
                <>
                  <span className="text-[#2E8B47] font-semibold">{s.high_rate}%</span> high ·{" "}
                  <span className="text-[#B5363A] font-semibold">{s.low_rate}%</span> low
                </>
              }
            />
            <Stat
              label="Paying customers"
              value={formatCount(s.clients)}
              sub={`${formatCount(s.purchased)} purchased · ${formatCount(s.renewed)} renewed`}
            />
            <Stat
              label="Never tested"
              value={formatRate(s.never_tested_rate)}
              sub={`${formatCount(s.never_tested)} of ${formatCount(s.clients)} have no reading since paying`}
            />
            <Stat
              label="Readings this week"
              value={formatCount(s.readings_this_week)}
              sub={
                weekChange == null ? (
                  `${formatCount(s.readings_last_week)} last week`
                ) : (
                  <span className={weekChange > 0 ? "text-[#2E8B47]" : weekChange < 0 ? "text-[#B5363A]" : ""}>
                    {weekChange > 0 ? "▲ +" : weekChange < 0 ? "▼ " : ""}
                    {weekChange.toFixed(1)}% vs last 7 days
                  </span>
                )
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
            {/* Goals */}
            <div className="flex flex-col gap-2">
              <span className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">Clients by goal</span>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map((g) => (
                  <div key={g.key} className="rounded-[8px] bg-[#F8FAFC] px-3 py-2" style={{ borderLeft: `3px solid ${g.color}` }}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[16px] font-bold text-[#252525] tabular-nums">{formatCount(s.goals?.[g.key] || 0)}</span>
                      <span className="text-[11px] text-[#535359] tabular-nums">{formatRate(s.clients ? ((s.goals?.[g.key] || 0) / s.clients) * 100 : null)}</span>
                    </div>
                    <div className="text-[10px] text-[#A1A1A1]">{g.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reading-rate cohorts */}
            <div className="flex flex-col gap-2">
              <span className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">
                Reading rate cohorts <span className="normal-case font-normal">· click one to filter the list</span>
              </span>
              <div className="flex flex-col gap-1">
                {(s.cohorts || []).map((c) => {
                  const active = tier === c.tier;
                  return (
                    <button
                      key={c.tier}
                      type="button"
                      onClick={() => {
                        setTier(active ? null : c.tier);
                        setPage(1);
                      }}
                      aria-pressed={active}
                      className={`grid grid-cols-[48px_1fr_92px] items-center gap-2 rounded-[8px] px-2 py-1 text-left transition-colors cursor-pointer ${
                        active ? "bg-[#EEF4FE]" : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <span className="text-[11px] font-semibold" style={{ color: TIER_COLORS[c.tier] }}>
                        {c.tier}
                      </span>
                      <span className="h-1.5 rounded-full bg-[#F0F3F7] overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${c.count ? Math.max(4, (c.count / maxTier) * 100) : 0}%`, backgroundColor: TIER_COLORS[c.tier] }}
                        />
                      </span>
                      <span className="text-[11px] text-right tabular-nums">
                        <span className="font-semibold text-[#252525]">{formatCount(c.count)}</span>{" "}
                        <span className="text-[#A1A1A1]">({formatRate(c.rate)})</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Search + table */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full md:max-w-[360px]">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search client, email, profile ID or trainer"
                aria-label="Search clients"
                autoComplete="off"
                className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
              />
            </div>
            {tier && (
              <button
                type="button"
                onClick={() => setTier(null)}
                className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 cursor-pointer"
              >
                Rate {tier} ✕
              </button>
            )}
            <span className="text-[#A1A1A1] text-[11px]">
              {tooShort ? `Type at least ${SEARCH_MIN} characters to search.` : `${formatCount(rows.length)} client${rows.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState message="No clients match." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
                <table className="w-full text-[12px] min-w-[980px]">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                      <th scope="col" className="py-2.5 px-4 font-semibold">Client</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Profile ID</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">This period</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Trainer</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Goal</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Paying since</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-center">Days</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-center">Tests</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-center">Score</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <tr key={c.profile_id} className="border-t border-[#F5F7FA]">
                        <td className="py-2.5 px-4 max-w-[220px]">
                          <div className="text-[#252525] font-semibold truncate">{c.name || "—"}</div>
                          {c.email && <div className="text-[#A1A1A1] text-[11px] truncate">{c.email}</div>}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[#535359]">{c.profile_id}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {c.purchased && <Badge>Purchased</Badge>}
                            {c.renewed && <Badge tone="green">Renewed</Badge>}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 max-w-[180px]">
                          {c.trainer_name || c.trainer_code ? (
                            <>
                              <div className="text-[#535359] truncate">{c.trainer_name || "—"}</div>
                              {c.trainer_code && <div className="font-mono text-[11px] text-[#A1A1A1]">{c.trainer_code}</div>}
                            </>
                          ) : (
                            <span className="text-[#A1A1A1]">Direct Website</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {c.fitness_goal ? (
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                              style={{ color: goalColor(c.fitness_goal), backgroundColor: `${goalColor(c.fitness_goal)}1A` }}
                            >
                              {goalLabel(c.fitness_goal)}
                            </span>
                          ) : (
                            <span className="text-[#A1A1A1]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-[#535359] whitespace-nowrap">{formatDate(c.member_since)}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-[#535359]">{formatCount(c.days)}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-[#535359]" title={`${c.readings} readings on ${c.reading_days} days`}>
                          {formatCount(c.reading_days)}
                        </td>
                        <td className="py-2.5 px-4 text-center tabular-nums">
                          {c.metabolism_score != null ? (
                            <span className="font-semibold text-[#252525]">{Math.round(c.metabolism_score)}</span>
                          ) : (
                            <span className="text-[#A1A1A1]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <RateCell pct={c.rate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > PAGE_SIZE && (
                <SalesPagination
                  page={current}
                  limit={PAGE_SIZE}
                  total={rows.length}
                  totalPages={totalPages}
                  onPageChange={(p) => p >= 1 && p <= totalPages && setPage(p)}
                  noun="clients"
                />
              )}
            </>
          )}
        </>
      )}
    </SalesCard>
  );
}
