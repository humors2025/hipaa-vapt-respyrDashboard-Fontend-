"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSuperAdminSalesEngagementService } from "@/services/superAdminSalesService";
import { formatCount, formatDate, formatRate } from "../salesFormat";
import EngagementDetailModal, { storedDay } from "../EngagementDetailModal";
import { Bone, C, Empty, ErrorBox, Pager, Panel, PanelHeader, SearchBox, Segmented, UpdatingDot, initials } from "./ui";

// Client Engagement for paying customers: people who bought or renewed in the
// selected dates and have an app profile. Usage % = days with a breath reading ÷
// days since they first paid (capped at 100%). Data: view=engagement.

const PAGE_SIZE = 8;
const SEARCH_MIN = 3;

const GROUPS = [
  { value: "all", label: "Purchased or renewed" },
  { value: "purchased", label: "Purchased" },
  { value: "renewed", label: "Renewed" },
];

const GOALS = [
  { key: "fat_loss", label: "Fat Loss", color: C.orange },
  { key: "muscle_gain", label: "Muscle Gain", color: C.green },
  { key: "weight_loss", label: "Weight Loss", color: C.red },
  { key: "other", label: "Not set", color: C.td },
];

const TIER_COLORS = {
  "90%+": "#2E8B47",
  "70%+": C.green,
  "50%+": C.blue,
  "25%+": C.orange,
  "10%+": "#D9822B",
  "<10%": C.red,
};

function goalInfo(g) {
  const l = String(g || "").toLowerCase();
  if (!l) return { label: "Not set", color: C.td };
  if (l.includes("fat")) return { label: "Fat Loss", color: C.orange };
  if (l.includes("muscle") || l.includes("gain")) return { label: "Muscle Gain", color: C.green };
  if (l.includes("weight") || l.includes("loss")) return { label: "Weight Loss", color: C.red };
  return { label: g, color: C.td };
}

const usageColor = (v) => (v >= 70 ? C.green : v >= 25 ? C.orange : C.red);

// 21 → "about 2 of every 10 days"
function daysInTen(rate) {
  const n = Math.round((Number(rate) || 0) / 10);
  if (n <= 0) return "less than 1 of every 10 days";
  if (n >= 10) return "almost every day";
  return `about ${n} of every 10 days`;
}

function MetricCard({ label, value, valueClass = "text-[#252525]", lines, linkColor = C.blue, onView, className = "" }) {
  return (
    <div className={`px-6 py-5 min-w-0 flex flex-col ${className}`}>
      <div className="text-[11px] font-medium text-[#738298] tracking-[-0.22px]">{label}</div>
      <div className="mt-3">
        <span className={`text-[36px] font-bold tracking-[-1.1px] leading-none tabular-nums ${valueClass}`}>{value}</span>
      </div>
      {lines}
      <button
        type="button"
        onClick={onView}
        aria-haspopup="dialog"
        className="self-start text-[11px] font-semibold tracking-[-0.22px] mt-auto pt-3 hover:underline cursor-pointer"
        style={{ color: linkColor }}
      >
        View ›
      </button>
    </div>
  );
}

function Badge({ renewed }) {
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] shrink-0 ${
        renewed ? "text-[#308BF9] bg-[#E9F3FF]" : "text-[#3FAF58] bg-[#EAFFEF]"
      }`}
    >
      {renewed ? "Renewed" : "Purchased"}
    </span>
  );
}

function HoverCard({ c }) {
  const goal = goalInfo(c.fitness_goal);
  const field = (label, value) => (
    <div className="min-w-0">
      <div className="text-[10px] text-[#A1A1A1] mb-0.5">{label}</div>
      <div className="text-[#535359] font-medium break-words">{value || "—"}</div>
    </div>
  );
  const period = [c.purchased && "Purchased", c.renewed && "Renewed"].filter(Boolean).join(" + ");
  return (
    <div className="hidden group-hover:block absolute left-3 top-[calc(100%-4px)] z-20 w-[300px] bg-white rounded-[12px] px-5 py-4 border border-[#E1E6ED] shadow-[0_12px_32px_rgba(37,37,37,0.16),0_2px_8px_rgba(37,37,37,0.06)] whitespace-normal">
      <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-[#E1E6ED]">
        <div className="w-9 h-9 rounded-[10px] bg-[linear-gradient(135deg,#308bf922,#308bf944)] flex items-center justify-center shrink-0">
          <span className="text-[13px] font-semibold text-[#308BF9]">{initials(c.name || c.email)}</span>
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#252525] truncate">{c.name || "—"}</div>
          <div className="text-[10px] text-[#738298] truncate">{c.email}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 text-[11px] tracking-[-0.22px]">
        {field("Profile ID", c.profile_id)}
        {field("Goal", goal.label)}
        {field("Trainer", c.trainer_name || c.trainer_code ? `${c.trainer_name || "—"}${c.trainer_code ? ` (${c.trainer_code})` : ""}` : "Direct Website")}
        {field("Period", period)}
        {field("Member since", formatDate(c.member_since))}
        {field("App onboarded", storedDay(c.app_onboarded_at))}
      </div>
    </div>
  );
}

export default function SalesEngagementPanel({ period, dateFrom, dateTo, trainerAdmin, rangeLabel }) {
  const [group, setGroup] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState(null);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
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
  const cohorts = s?.cohorts || [];
  const maxTier = Math.max(1, ...cohorts.map((c) => c.count));
  const goalTotal = s?.clients || 0;
  const weekChange = s?.readings_week_change;

  return (
    <Panel>
      <PanelHeader
        className="px-6 sm:px-7 pt-6"
        title="Client Engagement"
        subtitle={`Are paying customers using the device? Covers people who bought or renewed during ${rangeLabel} and have signed up in the app. Usage % = days with a breath reading ÷ days since they first paid.`}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <UpdatingDot show={loading && Boolean(data)} />
            <Segmented options={GROUPS} value={group} onChange={setGroup} label="Which customers" />
          </div>
        }
      />

      {error ? (
        <div className="px-6 sm:px-7 py-5">
          <ErrorBox message={error} onRetry={load} />
        </div>
      ) : loading && !data ? (
        <div className="px-6 sm:px-7 py-5 flex flex-col gap-4">
          <Bone className="h-[150px]" />
          <Bone className="h-[260px]" />
        </div>
      ) : !s || s.clients === 0 ? (
        <Empty
          title={
            group === "renewed" && data?.renewals_available === false
              ? "Renewal payments are not recorded on this environment yet."
              : "No paying customers with an app profile in this period."
          }
        />
      ) : (
        <>
          {/* Four headline numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mx-6 sm:mx-7 mt-5 border border-[#E1E6ED] rounded-[12px] overflow-hidden">
            <MetricCard
              className="border-b sm:border-r xl:border-b-0 border-[#E1E6ED]"
              label="How often customers use the device"
              value={`${s.avg_rate}%`}
              valueClass="text-[#308BF9]"
              onView={() => setDetail("usage")}
              lines={
                <>
                  <div className="text-[11px] text-[#738298] tracking-[-0.22px] mt-2">On average, {daysInTen(s.avg_rate)}</div>
                  <div className="text-[11px] text-[#738298] tracking-[-0.22px] mt-1">
                    Best customer <span className="font-semibold text-[#252525]">{s.high_rate}%</span> · Lowest{" "}
                    <span className="font-semibold text-[#252525]">{s.low_rate}%</span>
                  </div>
                </>
              }
            />
            <MetricCard
              className="border-b xl:border-b-0 xl:border-r border-[#E1E6ED]"
              label="Customers on the app"
              value={formatCount(s.clients)}
              linkColor={C.orange}
              onView={() => setDetail("paying")}
              lines={
                <>
                  <div className="text-[11px] text-[#738298] tracking-[-0.22px] mt-2">
                    <span className="font-semibold text-[#252525]">{formatCount(s.purchased)}</span> new ·{" "}
                    <span className="font-semibold text-[#252525]">{formatCount(s.renewed)}</span> renewed
                  </div>
                  <div className="text-[10px] text-[#A1A1A1] tracking-[-0.2px] mt-1 leading-normal">
                    People who paid in these dates and have signed up in the app, each counted once.
                  </div>
                </>
              }
            />
            <MetricCard
              className="border-b sm:border-b-0 sm:border-r border-[#E1E6ED]"
              label="Never used the device"
              value={formatRate(s.never_tested_rate)}
              linkColor={C.orange}
              onView={() => setDetail("never")}
              lines={
                <>
                  <div className="text-[11px] text-[#738298] tracking-[-0.22px] mt-2">
                    <span className="font-semibold text-[#252525]">{formatCount(s.never_tested)}</span> of {formatCount(s.clients)} customers
                  </div>
                  <div className="text-[10px] text-[#A1A1A1] tracking-[-0.2px] mt-1">No breath reading at all since paying</div>
                </>
              }
            />
            <MetricCard
              label="Device uses in the last 7 days"
              value={formatCount(s.readings_this_week)}
              onView={() => setDetail("week")}
              lines={
                <>
                  <div
                    className={`text-[12px] tracking-[-0.24px] mt-2 ${
                      weekChange > 0 ? "text-[#3FAF58]" : weekChange < 0 ? "text-[#E74C3C]" : "text-[#738298]"
                    }`}
                  >
                    {weekChange == null ? (
                      `${formatCount(s.readings_last_week)} in the 7 days before`
                    ) : (
                      <>
                        <span className="text-[10px] mr-1" aria-hidden="true">
                          {weekChange > 0 ? "▲" : weekChange < 0 ? "▼" : "■"}
                        </span>
                        {weekChange > 0 ? "+" : ""}
                        {weekChange.toFixed(1)}% vs the 7 days before ({formatCount(s.readings_last_week)})
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-[#A1A1A1] tracking-[-0.2px] mt-1">Every breath reading counts</div>
                </>
              }
            />
          </div>

          {/* Goals + usage spread */}
          <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-4 px-6 sm:px-7 pt-4">
            <div className="bg-[#F5F7FA] rounded-[12px] px-5 py-4">
              <div className="text-[11px] font-semibold text-[#252525] tracking-[-0.22px] mb-3">Clients by Goal</div>
              <div className="flex h-2.5 rounded-[5px] overflow-hidden gap-[2px] mb-3 bg-white">
                {GOALS.filter((g) => (s.goals?.[g.key] || 0) > 0).map((g) => (
                  <div key={g.key} className="rounded-[5px]" style={{ flex: s.goals[g.key], backgroundColor: g.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                {GOALS.map((g) => {
                  const n = s.goals?.[g.key] || 0;
                  return (
                    <div key={g.key} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: g.color }} aria-hidden="true" />
                      <span className="text-[11px] font-medium text-[#535359]">{g.label}</span>
                      <span className="text-[11px] font-bold text-[#252525] tabular-nums">{formatCount(n)}</span>
                      <span className="text-[10px] text-[#A1A1A1] tabular-nums">({formatRate(goalTotal ? (n / goalTotal) * 100 : 0)})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#F5F7FA] rounded-[12px] px-5 py-4">
              <div className="text-[11px] font-semibold text-[#252525] tracking-[-0.22px] mb-3">
                Usage Distribution <span className="font-normal text-[#A1A1A1]">· click a row to filter the list</span>
              </div>
              <div className="flex flex-col gap-1">
                {cohorts.map((t) => {
                  const active = tier === t.tier;
                  const color = TIER_COLORS[t.tier] || C.td;
                  return (
                    <button
                      key={t.tier}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setTier(active ? null : t.tier);
                        setPage(1);
                      }}
                      className={`flex items-center gap-2 rounded-[6px] px-1 py-[3px] cursor-pointer transition-colors ${
                        active ? "bg-white ring-1 ring-[#308BF9]" : "hover:bg-white/70"
                      }`}
                    >
                      <span className="text-[10px] font-medium text-[#738298] w-8 text-right shrink-0">{t.tier}</span>
                      <span className="flex-1 h-[7px] rounded-[4px] bg-white overflow-hidden">
                        {t.count > 0 && (
                          <span className="block h-full rounded-[4px]" style={{ width: `${(t.count / maxTier) * 100}%`, backgroundColor: color }} />
                        )}
                      </span>
                      <span className="text-[10px] font-semibold text-[#252525] w-5 text-right shrink-0 tabular-nums">{formatCount(t.count)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Client list */}
          <div className="px-6 sm:px-7 pt-4 pb-5">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <SearchBox
                className="flex-1 min-w-[220px]"
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search client, email, profile ID or trainer"
                label="Search clients"
              />
              {tier && (
                <button
                  type="button"
                  onClick={() => setTier(null)}
                  className="rounded-full bg-[#E9F3FF] text-[#308BF9] text-[11px] font-semibold px-3 py-1 cursor-pointer"
                >
                  Usage {tier} ✕
                </button>
              )}
              <span className="text-[11px] font-medium text-[#738298] tracking-[-0.22px] shrink-0">
                {tooShort ? `Type at least ${SEARCH_MIN} characters` : `${formatCount(rows.length)} client${rows.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {/* Scrolls sideways on narrow screens; on wide screens it fits, and staying
                overflow-visible lets the hover card hang below the last rows. */}
            <div className="overflow-x-auto lg:overflow-visible">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E1E6ED]">
                    {["Client", "Goal", "Days", "Tests", "Score", "Usage"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-3 py-2 text-[10px] font-medium text-[#738298] tracking-[-0.2px] whitespace-nowrap ${
                          ["Days", "Tests", "Score"].includes(h) ? "text-center" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <Empty title="No clients match your filters" hint="Try adjusting the search or filter criteria" />
                      </td>
                    </tr>
                  )}
                  {shown.map((c) => {
                    const goal = goalInfo(c.fitness_goal);
                    const usage = Number(c.rate) || 0;
                    const uc = usageColor(usage);
                    return (
                      <tr key={c.profile_id} className="group border-b border-[#E1E6ED] hover:bg-[#F5F7FA] transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap relative">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-[8px] bg-[linear-gradient(135deg,#308bf922,#308bf944)] flex items-center justify-center shrink-0">
                              <span className="text-[12px] font-semibold text-[#308BF9]">{initials(c.name || c.email)}</span>
                            </div>
                            <div className="min-w-0 max-w-[240px]">
                              <div className="text-[12px] font-semibold text-[#252525] tracking-[-0.24px] truncate">{c.name || "—"}</div>
                              <div className="text-[10px] text-[#738298] mt-px truncate">{c.email}</div>
                            </div>
                            {c.purchased && <Badge />}
                            {c.renewed && <Badge renewed />}
                          </div>
                          <HoverCard c={c} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="text-[10px] font-medium px-2 py-[3px] rounded-[4px] whitespace-nowrap"
                            style={{ color: goal.color, backgroundColor: `${goal.color}14` }}
                          >
                            {goal.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-[12px] font-semibold text-[#252525] tabular-nums">{formatCount(c.days)}</td>
                        <td
                          className="px-3 py-2.5 text-center text-[12px] font-semibold text-[#252525] tabular-nums"
                          title={`${c.readings} readings on ${c.reading_days} days`}
                        >
                          {formatCount(c.reading_days)}
                        </td>
                        <td className="px-3 py-2.5 text-center text-[12px] font-semibold text-[#252525] tabular-nums">
                          {c.metabolism_score != null ? Math.round(c.metabolism_score) : <span className="text-[#A1A1A1]">—</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-[52px] h-1.5 rounded-[3px] bg-[#E1E6ED]/40 overflow-hidden">
                              <div className="h-full rounded-[3px]" style={{ width: `${Math.min(usage, 100)}%`, backgroundColor: uc }} />
                            </div>
                            <span className="text-[11px] font-semibold tabular-nums" style={{ color: uc }}>
                              {usage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageSize={PAGE_SIZE} total={rows.length} onChange={(p) => p >= 1 && p <= totalPages && setPage(p)} noun="clients" />
          </div>
        </>
      )}
      <EngagementDetailModal key={detail || "closed"} kind={detail} data={data} rangeLabel={rangeLabel} onClose={() => setDetail(null)} />
    </Panel>
  );
}
