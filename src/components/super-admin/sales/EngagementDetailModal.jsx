"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { formatCount, formatDate, formatRate } from "./salesFormat";
import { EmptyState } from "./SalesUi";
import { SalesPagination } from "./PurchaseTable";

// Popup behind the four Client Engagement cards. Everything comes from the
// engagement response the section already loaded (no extra request):
//   usage  – every customer ranked by usage %
//   paying – every paying customer, filterable by new / renewed
//   never  – customers with no breath reading since paying
//   week   – readings per day for the last 7 days + per-customer counts

const PAGE_SIZE = 10;
const SEARCH_MIN = 3;

export const ENGAGEMENT_DETAILS = {
  usage: "How often customers use the device",
  paying: "Paying customers",
  never: "Never used the device",
  week: "Device uses in the last 7 days",
};

// app_onboarded_at is "YYYY-MM-DD HH:MM:SS" as stored in table_clients; show only
// its date, unshifted, as "Oct 10, 2026".
export function storedDay(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw || ""));
  if (!m) return "—";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function rateColor(pct) {
  if (pct >= 70) return "#2E8B47";
  if (pct >= 40) return "#A66B00";
  return "#B5363A";
}

function Badge({ children, tone }) {
  const cls =
    tone === "green" ? "bg-[#E9F7EE] text-[#2E8B47]" : tone === "red" ? "bg-[#FDECEC] text-[#B5363A]" : tone === "grey" ? "bg-[#F0F3F7] text-[#535359]" : "bg-[#EEF4FE] text-[#308BF9]";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

function MiniStat({ label, value, tone }) {
  const color = tone === "green" ? "text-[#2E8B47]" : tone === "red" ? "text-[#B5363A]" : "text-[#252525]";
  return (
    <div className="rounded-[10px] bg-[#F5F7FA] px-3 py-2.5 min-w-0">
      <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide truncate">{label}</div>
      <div className={`text-[15px] font-bold tabular-nums truncate ${color}`}>{value}</div>
    </div>
  );
}

function ClientCell({ c }) {
  return (
    <td className="py-2.5 px-3 max-w-[220px]">
      <div className="text-[#252525] font-semibold truncate">{c.name || "—"}</div>
      <div className="text-[#A1A1A1] text-[11px] truncate">{c.email || c.profile_id}</div>
    </td>
  );
}

function TrainerCell({ c }) {
  return (
    <td className="py-2.5 px-3 max-w-[170px]">
      {c.trainer_name || c.trainer_code ? (
        <>
          <div className="text-[#535359] truncate">{c.trainer_name || "—"}</div>
          {c.trainer_code && <div className="font-mono text-[11px] text-[#A1A1A1]">{c.trainer_code}</div>}
        </>
      ) : (
        <span className="text-[#A1A1A1]">Direct Website</span>
      )}
    </td>
  );
}

function UsageCell({ pct }) {
  return (
    <td className="py-2.5 px-3">
      <div className="flex items-center gap-2 justify-end">
        <div className="w-[40px] h-1 rounded-full bg-[#F0F3F7] overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: rateColor(pct) }} />
        </div>
        <span className="font-semibold tabular-nums w-[38px] text-right" style={{ color: rateColor(pct) }}>
          {pct}%
        </span>
      </div>
    </td>
  );
}

function PlanCell({ c }) {
  const s = String(c.subscription_status || "").toLowerCase();
  const tone = s === "active" ? "green" : s === "ended" || s === "cancelled" ? "red" : "grey";
  const label = s ? s.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) : "—";
  return (
    <td className="py-2.5 px-3">
      <Badge tone={tone}>{label}</Badge>
    </td>
  );
}

const th = "py-2.5 px-3 font-semibold whitespace-nowrap";
const td = "py-2.5 px-3 text-[#535359] whitespace-nowrap";
const num = "py-2.5 px-3 text-center tabular-nums text-[#535359]";

// Column sets per popup.
const COLUMNS = {
  usage: {
    head: (
      <>
        <th className={th}>#</th>
        <th className={th}>Client</th>
        <th className={th}>Member since</th>
        <th className={`${th} text-center`}>Days</th>
        <th className={`${th} text-center`}>Days used</th>
        <th className={`${th} text-center`}>Readings</th>
        <th className={th}>Last reading</th>
        <th className={`${th} text-right`}>Usage</th>
      </>
    ),
    row: (c, i) => (
      <>
        <td className={`${td} tabular-nums text-[#A1A1A1]`}>{i + 1}</td>
        <ClientCell c={c} />
        <td className={td}>{formatDate(c.member_since)}</td>
        <td className={num}>{formatCount(c.days)}</td>
        <td className={num}>{formatCount(c.reading_days)}</td>
        <td className={num}>{formatCount(c.readings)}</td>
        <td className={td}>{c.last_reading ? formatDate(c.last_reading, true) : "—"}</td>
        <UsageCell pct={c.rate} />
      </>
    ),
  },
  paying: {
    head: (
      <>
        <th className={th}>Client</th>
        <th className={th}>This period</th>
        <th className={th}>Trainer</th>
        <th className={th}>App onboarded</th>
        <th className={th}>Member since</th>
        <th className={th}>Plan</th>
        <th className={`${th} text-right`}>Usage</th>
      </>
    ),
    row: (c) => (
      <>
        <ClientCell c={c} />
        <td className="py-2.5 px-3">
          <div className="flex gap-1 flex-wrap">
            {c.purchased && <Badge>Purchased</Badge>}
            {c.renewed && <Badge tone="green">Renewed</Badge>}
          </div>
        </td>
        <TrainerCell c={c} />
        <td className={td}>{storedDay(c.app_onboarded_at)}</td>
        <td className={td}>{formatDate(c.member_since)}</td>
        <PlanCell c={c} />
        <UsageCell pct={c.rate} />
      </>
    ),
  },
  never: {
    head: (
      <>
        <th className={th}>Client</th>
        <th className={th}>Trainer</th>
        <th className={th}>App onboarded</th>
        <th className={th}>Member since</th>
        <th className={`${th} text-center`}>Days without a reading</th>
        <th className={th}>Plan</th>
      </>
    ),
    row: (c) => (
      <>
        <ClientCell c={c} />
        <TrainerCell c={c} />
        <td className={td}>{storedDay(c.app_onboarded_at)}</td>
        <td className={td}>{formatDate(c.member_since)}</td>
        <td className={`${num} font-semibold text-[#B5363A]`}>{formatCount(c.days)}</td>
        <PlanCell c={c} />
      </>
    ),
  },
  week: {
    head: (
      <>
        <th className={th}>Client</th>
        <th className={th}>Trainer</th>
        <th className={`${th} text-center`}>Last 7 days</th>
        <th className={`${th} text-center`}>7 days before</th>
        <th className={`${th} text-center`}>Change</th>
        <th className={th}>Last reading</th>
      </>
    ),
    row: (c) => {
      const now = c.readings_7d || 0;
      const before = c.readings_prev_7d || 0;
      const diff = now - before;
      return (
        <>
          <ClientCell c={c} />
          <TrainerCell c={c} />
          <td className={`${num} font-semibold text-[#252525]`}>{formatCount(now)}</td>
          <td className={num}>{formatCount(before)}</td>
          <td className={`${num} font-semibold`} style={{ color: diff > 0 ? "#2E8B47" : diff < 0 ? "#B5363A" : "#A1A1A1" }}>
            {diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : "—"}
          </td>
          <td className={td}>{c.last_reading ? formatDate(c.last_reading, true) : "—"}</td>
        </>
      );
    },
  },
};

const PAYING_FILTERS = [
  { value: "all", label: "All" },
  { value: "purchased", label: "New" },
  { value: "renewed", label: "Renewed" },
];

const WEEK_FILTERS = [
  { value: "used", label: "Used it" },
  { value: "not_used", label: "Didn't use it" },
  { value: "all", label: "All" },
];

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-[10px] border border-[#E1E6ED] p-0.5 bg-white" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors cursor-pointer ${
            value === o.value ? "bg-[#308BF9] text-white" : "text-[#535359] hover:bg-[#F5F7FA]"
          }`}
        >
          {o.label}
          {o.count != null && <span className="ml-1 opacity-80">({formatCount(o.count)})</span>}
        </button>
      ))}
    </div>
  );
}

function WeekChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.readings));
  return (
    <div className="rounded-[10px] border border-[#E1E6ED] p-3">
      <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide mb-2">Readings per day</div>
      <div className="grid grid-cols-7 gap-2 items-end h-[120px]">
        {days.map((d) => (
          <div key={d.date} className="flex flex-col items-center justify-end h-full gap-1" title={`${d.readings} readings by ${d.clients} customers`}>
            <span className="text-[11px] font-semibold text-[#252525] tabular-nums">{formatCount(d.readings)}</span>
            <div className="w-full max-w-[44px] rounded-t-[6px] bg-[#308BF9]" style={{ height: `${d.readings ? Math.max(4, (d.readings / max) * 80) : 2}px`, opacity: d.readings ? 1 : 0.25 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 mt-1.5">
        {days.map((d) => (
          <div key={d.date} className="text-center leading-tight">
            <div className="text-[10px] text-[#535359]">{dayLabel(d.date)}</div>
            <div className="text-[10px] text-[#A1A1A1]">{formatCount(d.clients)} customer{d.clients === 1 ? "" : "s"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// kind: one of ENGAGEMENT_DETAILS' keys, or null when closed.
export default function EngagementDetailModal({ kind, data, rangeLabel, onClose }) {
  const open = Boolean(kind);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(kind === "week" ? "used" : "all");
  const [page, setPage] = useState(1);

  const s = data?.summary || {};
  const all = useMemo(() => data?.clients || [], [data]);
  const term = search.trim().toLowerCase();
  const tooShort = term.length > 0 && term.length < SEARCH_MIN;

  const base = useMemo(() => {
    if (kind === "never") return all.filter((c) => c.reading_days === 0).sort((a, b) => b.days - a.days);
    if (kind === "paying") return filter === "all" ? all : all.filter((c) => c[filter]);
    if (kind === "week") {
      const sorted = [...all].sort((a, b) => (b.readings_7d || 0) - (a.readings_7d || 0) || (b.readings_prev_7d || 0) - (a.readings_prev_7d || 0));
      if (filter === "used") return sorted.filter((c) => c.readings_7d > 0);
      if (filter === "not_used") return sorted.filter((c) => !c.readings_7d);
      return sorted;
    }
    return all; // usage: already ranked by usage %
  }, [kind, all, filter]);

  const rows = useMemo(() => {
    if (term.length < SEARCH_MIN) return base;
    return base.filter((c) =>
      [c.name, c.email, c.profile_id, c.trainer_name, c.trainer_code].some((v) => String(v || "").toLowerCase().includes(term))
    );
  }, [base, term]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const cols = COLUMNS[kind] || COLUMNS.usage;
  // Rank (#) in the usage popup is the position in the full ranked list, even when searching.
  const rankOf = useMemo(() => new Map(all.map((c, i) => [c.profile_id, i])), [all]);

  const usedThisWeek = all.filter((c) => c.readings_7d > 0).length;

  let stats = null;
  let note = null;
  if (kind === "usage") {
    stats = (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniStat label="Average usage" value={`${s.avg_rate ?? 0}%`} />
        <MiniStat label="Best customer" value={`${s.high_rate ?? 0}%`} tone="green" />
        <MiniStat label="Lowest" value={`${s.low_rate ?? 0}%`} tone="red" />
        <MiniStat label="Use it 70%+ of days" value={formatCount(all.filter((c) => c.rate >= 70).length)} />
      </div>
    );
    note = "Usage % = days with at least one breath reading ÷ days since the customer first paid. Highest first.";
  } else if (kind === "paying") {
    stats = (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniStat label="Paying customers" value={formatCount(s.clients)} />
        <MiniStat label="New" value={formatCount(s.purchased)} />
        <MiniStat label="Renewed" value={formatCount(s.renewed)} tone="green" />
        <MiniStat label="Both" value={formatCount(s.both)} />
      </div>
    );
    note = "Customers who paid in these dates and have an app profile.";
  } else if (kind === "never") {
    stats = (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MiniStat label="Never used" value={formatCount(s.never_tested)} tone="red" />
        <MiniStat label="Of all customers" value={formatRate(s.never_tested_rate)} />
        <MiniStat label="Paying customers" value={formatCount(s.clients)} />
      </div>
    );
    note = "No breath reading at all since they first paid. Longest-waiting first.";
  } else if (kind === "week") {
    const change = s.readings_week_change;
    stats = (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniStat label="Readings, last 7 days" value={formatCount(s.readings_this_week)} />
        <MiniStat label="7 days before" value={formatCount(s.readings_last_week)} />
        <MiniStat
          label="Change"
          value={change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
          tone={change > 0 ? "green" : change < 0 ? "red" : undefined}
        />
        <MiniStat label="Customers who used it" value={`${formatCount(usedThisWeek)} of ${formatCount(all.length)}`} />
      </div>
    );
    note = "Every breath reading counts, including several on the same day.";
  }

  const filters =
    kind === "paying"
      ? PAYING_FILTERS.map((f) => ({ ...f, count: f.value === "all" ? all.length : all.filter((c) => c[f.value]).length }))
      : kind === "week"
        ? WEEK_FILTERS.map((f) => ({
            ...f,
            count: f.value === "used" ? usedThisWeek : f.value === "not_used" ? all.length - usedThisWeek : all.length,
          }))
        : null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[1080px] max-h-[calc(100vh-48px)] overflow-y-auto bg-white rounded-[15px] shadow-xl p-5 flex flex-col gap-4 focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-[#252525] text-[16px] font-bold">{ENGAGEMENT_DETAILS[kind] || ""}</Dialog.Title>
              <div className="text-[12px] text-[#A1A1A1] mt-0.5">
                {rangeLabel}
                {note && <> · {note}</>}
              </div>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#252525] transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Dialog.Close>
          </div>

          {stats}
          {kind === "week" && Array.isArray(s.week_days) && s.week_days.length > 0 && <WeekChart days={s.week_days} />}

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search client, email, profile ID or trainer"
              aria-label="Search clients in this list"
              autoComplete="off"
              className="w-full md:max-w-[320px] rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
            />
            {filters && (
              <Segmented
                options={filters}
                value={filter}
                label="Filter customers"
                onChange={(v) => {
                  setFilter(v);
                  setPage(1);
                }}
              />
            )}
            <span className="text-[#A1A1A1] text-[11px]">
              {tooShort ? `Type at least ${SEARCH_MIN} characters to search.` : `${formatCount(rows.length)} client${rows.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState message={kind === "never" && !term ? "Every customer has used the device at least once." : "No clients match."} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
                <table className="w-full text-[12px] min-w-[860px]">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">{cols.head}</tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <tr key={c.profile_id} className="border-t border-[#F5F7FA]">
                        {cols.row(c, rankOf.get(c.profile_id) ?? 0)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SalesPagination
                page={current}
                limit={PAGE_SIZE}
                total={rows.length}
                totalPages={totalPages}
                noun="clients"
                onPageChange={(p) => p >= 1 && p <= totalPages && setPage(p)}
              />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
