"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { getAdminGroups, selectAdminGroupsRaw, selectPrimaryGroupName } from "@/store/adminGroupsSlice";
import { fetchGroupPeriodReadersService } from "@/services/authService";

const PAGE_LIMIT = 20;
const R = {
  dark: "#252525", blue: "#308bf9", blueLight: "#e9f3ff",
  green: "#3faf58", greenLight: "#eaffef", red: "#e74c3c", orange: "#e48326", amber: "#ffbf2d",
  tp: "#252525", ts: "#535359", tm: "#738298", td: "#a1a1a1",
  border: "#e1e6ed", surface: "#f5f7fa", white: "#ffffff",
  rCard: "15px", rBadge: "6px", rPill: "33px",
};
const CS = {
  backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #EEF2F6",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "trainers", label: "Trainers" },
  { key: "clients", label: "Clients" },
];
const EMPTY_TOTALS = {
  trainer_readings: 0, client_readings: 0, total_readings: 0, trainer_readers: 0, client_readers: 0,
};

function fmtDay(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d)) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d)) return s;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
// Local-date parts → "YYYY-MM-DD" (no UTC shift), the format the API's
// overview_from / overview_to expect and the value a native date input uses.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayYMD() { return ymd(new Date()); }
function badgeStyle(bg, fg) {
  return { display: "inline-block", padding: "3px 10px", borderRadius: R.rBadge, backgroundColor: bg, color: fg, fontSize: "11px", fontWeight: 600, letterSpacing: "-0.22px", whiteSpace: "nowrap" };
}
function roleLabel(role) {
  if (!role) return "—";
  const l = String(role).toLowerCase();
  if (l === "admin") return "Trainer-Admin";
  if (l === "trainer") return "Trainer";
  if (l === "super_admin") return "Super Admin";
  return role;
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2" style={{ padding: "48px 16px", color: R.tm }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: R.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>—</div>
      <div style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "-0.26px" }}>{text}</div>
    </div>
  );
}

function Pager({ pagination, onPage }) {
  if (!pagination) return null;
  const { page = 1, limit = PAGE_LIMIT, total = 0, has_more = false } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const btn = (disabled) => ({
    borderRadius: R.rPill, border: `1px solid ${R.border}`, background: disabled ? R.surface : R.white,
    color: disabled ? R.td : R.tp, fontSize: "12px", fontWeight: 600, padding: "6px 16px",
    cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "-0.24px",
  });
  return (
    <div className="flex items-center justify-between" style={{ padding: "12px 18px", borderTop: `1px solid ${R.border}` }}>
      <div style={{ fontSize: "12px", color: R.tm }}>Showing {from}–{to} of {total}</div>
      <div className="flex items-center gap-2">
        <button style={btn(page <= 1)} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <button style={btn(!has_more)} disabled={!has_more} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

// On the "all" tab the API pages both lists with one shared `page` (and caps the
// trainer side at its own limit), so per-list Prev/Next isn't possible there.
// Instead, a truncated list links to its dedicated tab, where Pager works.
function ViewAllFooter({ pagination, noun, onView }) {
  if (!pagination) return null;
  const { limit = PAGE_LIMIT, total = 0, has_more = false } = pagination;
  if (!has_more && total <= limit) return null;
  return (
    <div className="flex items-center justify-between" style={{ padding: "12px 18px", borderTop: `1px solid ${R.border}` }}>
      <div style={{ fontSize: "12px", color: R.tm }}>Showing first {Math.min(limit, total)} of {total} {noun}</div>
      <button
        onClick={onView}
        className="cursor-pointer"
        style={{ borderRadius: R.rPill, border: "none", background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "6px 16px", letterSpacing: "-0.24px" }}
      >
        View all {total} →
      </button>
    </div>
  );
}

function Table({ cols, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={{ textAlign: c.align || "left", padding: "10px 18px", fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: `1px solid ${R.border}`, whiteSpace: "nowrap" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.profile_id || row.partner_code || row.dietitian_id || row.dietician_id || i} style={{ borderBottom: `1px solid ${R.border}` }}>
              {cols.map(c => (
                <td key={c.key} style={{ textAlign: c.align || "left", padding: "12px 18px", color: R.tp, letterSpacing: "-0.25px", whiteSpace: "nowrap" }}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodReadersContent() {
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useDispatch();
  const adminGroupsRaw = useSelector(selectAdminGroupsRaw);
  const primaryGroupName = useSelector(selectPrimaryGroupName);

  // Scope comes from the analytics Reading Split row that linked here.
  const member = params.get("member") || "";
  const groupFromUrl = params.get("group") || "";
  const periodLabel = params.get("label") || "";

  // The window seeds from the linking card (or today, when opened directly) but
  // is editable here — the date inputs / presets below re-query the API and the
  // URL is kept in sync so a refresh or shared link reopens the same window.
  const [overviewFrom, setOverviewFrom] = useState(() => params.get("from") || todayYMD());
  const [overviewTo, setOverviewTo] = useState(() => params.get("to") || params.get("from") || todayYMD());
  // The window the page was opened with — once the user edits the dates, the
  // source card's wording ("today", "this week") no longer describes them.
  const [openedWith] = useState(() => ({
    from: params.get("from") || todayYMD(),
    to: params.get("to") || params.get("from") || todayYMD(),
  }));
  const windowEdited = overviewFrom !== openedWith.from || overviewTo !== openedWith.to;
  const today = todayYMD();

  const [type, setType] = useState(() => {
    const t = params.get("type");
    return TABS.some(x => x.key === t) ? t : "all";
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map());
  // Scope-wide counters (both sides), kept apart from the tab-filtered response.
  const [scopeTotals, setScopeTotals] = useState(null);
  const totalsCacheRef = useRef(new Map());

  const groupName = groupFromUrl || primaryGroupName || "";

  // The group name normally arrives with the login payload; re-fetch it if the
  // in-memory store was reset (hard refresh / direct link into this page).
  useEffect(() => {
    if (!groupFromUrl && !adminGroupsRaw) dispatch(getAdminGroups());
  }, [groupFromUrl, adminGroupsRaw, dispatch]);

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedQ(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [search]);

  // Mirror the chosen window back into the URL so refresh / back / a shared link
  // reopens it. replace (not push) keeps "Back to Analytics" one step away.
  useEffect(() => {
    if (params.get("from") === overviewFrom && params.get("to") === overviewTo) return;
    const qs = new URLSearchParams(params.toString());
    qs.set("from", overviewFrom);
    qs.set("to", overviewTo);
    router.replace(`?${qs.toString()}`, { scroll: false });
  }, [overviewFrom, overviewTo, params, router]);

  // from ≤ to always: moving one end past the other drags the other with it.
  const onFromChange = (v) => {
    if (!v) return;
    setOverviewFrom(v);
    if (v > overviewTo) setOverviewTo(v);
    setPage(1);
  };
  const onToChange = (v) => {
    if (!v) return;
    setOverviewTo(v);
    if (v < overviewFrom) setOverviewFrom(v);
    setPage(1);
  };
  const PRESETS = [
    { key: "today", label: "Today" },
    { key: "7d", label: "Last 7 Days" },
    { key: "30d", label: "Last 30 Days" },
    { key: "month", label: "This Month" },
  ];
  // Every preset ends today; only the start moves. Also used to highlight the
  // preset button that matches the current window.
  const presetRange = (key) => {
    const n = new Date();
    const end = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    let start = end;
    if (key === "7d") { start = new Date(end); start.setDate(end.getDate() - 6); }
    if (key === "30d") { start = new Date(end); start.setDate(end.getDate() - 29); }
    if (key === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { from: ymd(start), to: ymd(end) };
  };
  const applyPreset = (key) => {
    const r = presetRange(key);
    setOverviewFrom(r.from);
    setOverviewTo(r.to);
    setPage(1);
  };

  // Everything the counters depend on — the tab a user is looking at is not part
  // of it, so the counts survive a tab switch.
  const scopeKey = `${groupName}|${overviewFrom}|${overviewTo}|${member}|${debouncedQ}`;

  const load = useCallback(async ({ force = false } = {}) => {
    if (!groupName) { setLoading(true); return; }
    const key = `${scopeKey}|${type}|${page}`;
    if (!force && cacheRef.current.has(key)) { setData(cacheRef.current.get(key)); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGroupPeriodReadersService({
        groupName, overviewFrom, overviewTo, overviewMember: member, type, page, limit: PAGE_LIMIT, search: debouncedQ,
      });
      cacheRef.current.set(key, res);
      // An "all" response carries both sides' counters, so it doubles as the
      // scope-wide snapshot the tab badges read from.
      if (type === "all" && res?.totals) {
        totalsCacheRef.current.set(scopeKey, res.totals);
        setScopeTotals(res.totals);
      }
      setData(res);
    } catch (e) {
      setError(e?.message || "Failed to load readers");
      toast.error(e?.message || "Failed to load readers");
    } finally {
      setLoading(false);
    }
  }, [groupName, scopeKey, overviewFrom, overviewTo, type, member, page, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  // The API scopes `totals` to the requested `type` — a trainers-only response
  // reports client_readers: 0 and vice versa. So the badges can never come from
  // the filtered response; pull the scope's real split with one unfiltered call
  // per window (skipped on the All tab, where load() already has it).
  const loadScopeTotals = useCallback(async ({ force = false, signal } = {}) => {
    if (!groupName) return;
    if (!force) {
      const cached = totalsCacheRef.current.get(scopeKey);
      if (cached) { setScopeTotals(cached); return; }
      setScopeTotals(null);
      if (type === "all") return; // load() will fill it in from its own response
    }
    try {
      const res = await fetchGroupPeriodReadersService({
        groupName, overviewFrom, overviewTo, overviewMember: member,
        type: "all", page: 1, limit: PAGE_LIMIT, search: debouncedQ,
      });
      if (signal?.cancelled || !res?.totals) return;
      cacheRef.current.set(`${scopeKey}|all|1`, res);
      totalsCacheRef.current.set(scopeKey, res.totals);
      setScopeTotals(res.totals);
    } catch {
      // Counts fall back to the active tab's own numbers; the list itself is
      // unaffected and load() already surfaces a real failure.
    }
  }, [groupName, scopeKey, overviewFrom, overviewTo, member, debouncedQ, type]);

  useEffect(() => {
    const signal = { cancelled: false };
    loadScopeTotals({ signal });
    return () => { signal.cancelled = true; };
  }, [loadScopeTotals]);

  const refresh = useCallback(() => {
    cacheRef.current.clear();
    totalsCacheRef.current.clear();
    load({ force: true });
    if (type !== "all") loadScopeTotals({ force: true });
  }, [load, loadScopeTotals, type]);

  const trainerReaders = data?.trainer_readers || [];
  const clientReaders = data?.client_readers || [];
  const showTrainers = type === "all" || type === "trainers";
  const showClients = type === "all" || type === "clients";

  // Counters for the tabs and the summary cards describe the whole window, not
  // the active tab. Start from the unfiltered snapshot and overlay only the side
  // the current response is authoritative for — that side is the freshest, and
  // the overlay keeps the numbers right while the snapshot is still in flight.
  const countTotals = useMemo(() => {
    const base = scopeTotals || EMPTY_TOTALS;
    const t = data?.totals;
    if (!t) return base;
    if (type === "all") return t;
    if (type === "trainers") {
      return { ...base, trainer_readings: t.trainer_readings ?? 0, trainer_readers: t.trainer_readers ?? 0 };
    }
    return { ...base, client_readings: t.client_readings ?? 0, client_readers: t.client_readers ?? 0 };
  }, [scopeTotals, data, type]);
  const totalReadings = (countTotals.trainer_readings ?? 0) + (countTotals.client_readings ?? 0);
  const totalReaders = (countTotals.trainer_readers ?? 0) + (countTotals.client_readers ?? 0);

  const trainerCols = useMemo(() => [
    { key: "name", label: "Trainer", render: r => <span style={{ fontWeight: 600 }}>{r.trainer_name || r.profile_name || r.name || "—"}</span> },
    { key: "code", label: "Code", render: r => <span style={{ color: R.tm }}>{r.dietitian_id || r.dietician_id || r.partner_code || "—"}</span> },
    { key: "email", label: "Email", render: r => <span style={{ color: R.ts }}>{r.email || "—"}</span> },
    { key: "role", label: "Role", render: r => <span style={badgeStyle(R.blueLight, R.blue)}>{roleLabel(r.trainer_role || r.role)}</span> },
    { key: "reads", label: "Readings", align: "right", render: r => <span style={{ fontWeight: 700 }}>{r.reads ?? 0}</span> },
    { key: "first", label: "First Reading", render: r => <span style={{ color: R.ts }}>{fmtDateTime(r.first_reading_at)}</span> },
    { key: "last", label: "Last Reading", render: r => <span style={{ color: R.ts }}>{fmtDateTime(r.last_reading_at)}</span> },
  ], []);

  const clientCols = useMemo(() => [
    { key: "name", label: "Client", render: r => <span style={{ fontWeight: 600 }}>{r.profile_name || "—"}</span> },
    { key: "email", label: "Email", render: r => <span style={{ color: R.ts }}>{r.email || "—"}</span> },
    { key: "trainer", label: "Trainer", render: r => <span style={{ color: R.ts }}>{r.trainer_name || r.dietitian_id || "—"}</span> },
    { key: "role", label: "Owner Role", render: r => <span style={badgeStyle(R.surface, R.tm)}>{roleLabel(r.trainer_role)}</span> },
    { key: "code", label: "Code", render: r => <span style={{ color: R.tm }}>{r.dietitian_id || "—"}</span> },
    { key: "reads", label: "Readings", align: "right", render: r => <span style={{ fontWeight: 700 }}>{r.reads ?? 0}</span> },
    { key: "first", label: "First Reading", render: r => <span style={{ color: R.ts }}>{fmtDateTime(r.first_reading_at)}</span> },
    { key: "last", label: "Last Reading", render: r => <span style={{ color: R.ts }}>{fmtDateTime(r.last_reading_at)}</span> },
  ], []);

  const period = data?.period || { date_from: overviewFrom, date_to: overviewTo };
  const windowLabel = period.date_from === period.date_to
    ? fmtDay(period.date_from)
    : `${fmtDay(period.date_from)} – ${fmtDay(period.date_to)}`;
  // "today" / "this week" wording for the empty states, driven by the source card
  // — but only while the window is still the one that card linked to.
  const whenLabel = (!windowEdited && periodLabel) || (overviewFrom === overviewTo ? "on this day" : "in this period");

  return (
    <div className="overflow-y-scroll custom-scrollbar" style={{ height: "calc(100vh - 130px)", fontFamily: "'Poppins', sans-serif", backgroundColor: R.surface }}>
      <div className="sticky top-0 z-10" style={{ backgroundColor: R.surface, padding: "18px 24px 12px", borderBottom: `1px solid ${R.border}` }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <button
              onClick={() => router.back()}
              className="cursor-pointer"
              style={{ border: "none", background: "transparent", color: R.blue, fontSize: "12px", fontWeight: 600, padding: 0, marginBottom: "6px", letterSpacing: "-0.24px" }}
            >
              ← Back to Analytics
            </button>
            <div style={{ fontSize: "20px", fontWeight: 700, color: R.tp, letterSpacing: "-0.6px" }}>Reading Split</div>
            <div style={{ fontSize: "12px", color: R.tm, marginTop: "2px", letterSpacing: "-0.24px" }}>
              {data?.group_name || groupName || "—"} · {windowLabel}
              {member ? ` · ${member}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              style={{ borderRadius: R.rPill, border: `1px solid ${R.border}`, background: R.white, padding: "8px 16px", fontSize: "12px", outline: "none", width: "220px", letterSpacing: "-0.24px" }}
            />
            <button
              onClick={refresh}
              className="cursor-pointer"
              style={{ borderRadius: R.rPill, border: "none", background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 18px", letterSpacing: "-0.24px" }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Window picker — from / to plus quick presets. Every change re-queries
            get_group_period_readers with the new overview_from / overview_to. */}
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: "14px" }}>
          <span style={{ fontSize: "11px", color: R.tm, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Period</span>
          <input
            type="date"
            value={overviewFrom}
            max={today}
            onChange={e => onFromChange(e.target.value)}
            style={{ borderRadius: "10px", border: `1px solid ${R.border}`, background: R.white, padding: "7px 12px", fontSize: "12px", color: R.tp, outline: "none", letterSpacing: "-0.24px" }}
          />
          <span style={{ fontSize: "12px", color: R.tm }}>→</span>
          <input
            type="date"
            value={overviewTo}
            min={overviewFrom}
            max={today}
            onChange={e => onToChange(e.target.value)}
            style={{ borderRadius: "10px", border: `1px solid ${R.border}`, background: R.white, padding: "7px 12px", fontSize: "12px", color: R.tp, outline: "none", letterSpacing: "-0.24px" }}
          />
          <div style={{ width: "1px", height: "20px", backgroundColor: R.border, margin: "0 4px" }} />
          {PRESETS.map(p => {
            const r = presetRange(p.key);
            const active = overviewFrom === r.from && overviewTo === r.to;
            return (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className="cursor-pointer"
                style={{ borderRadius: R.rPill, border: `1px solid ${active ? R.blue : R.border}`, background: active ? R.blueLight : R.white, color: active ? R.blue : R.ts, fontSize: "11px", fontWeight: 600, padding: "6px 14px", letterSpacing: "-0.22px" }}
              >
                {p.label}
              </button>
            );
          })}
          {windowEdited && (
            <button
              onClick={() => { setOverviewFrom(openedWith.from); setOverviewTo(openedWith.to); setPage(1); }}
              className="cursor-pointer"
              style={{ border: "none", background: "transparent", color: R.blue, fontSize: "11px", fontWeight: 600, padding: "0 4px", letterSpacing: "-0.22px" }}
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: "12px" }}>
          {TABS.map(t => {
            const active = type === t.key;
            const n = t.key === "trainers" ? countTotals.trainer_readers : t.key === "clients" ? countTotals.client_readers : totalReaders;
            return (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setPage(1); }}
                className="cursor-pointer"
                style={{ borderRadius: R.rPill, border: `1px solid ${active ? R.blue : R.border}`, background: active ? R.blue : R.white, color: active ? R.white : R.ts, fontSize: "12px", fontWeight: 600, padding: "7px 18px", letterSpacing: "-0.24px" }}
              >
                {t.label} {data ? `(${n ?? 0})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "20px 24px 40px" }}>
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ padding: "80px 0" }}>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: R.blue, animation: `loaderBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
            <div style={{ fontSize: "13px", color: R.ts, fontWeight: 500 }}>Loading readers…</div>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-3" style={{ padding: "60px 0" }}>
            <div className="max-w-md text-center" style={{ background: "#fef2f2", border: `1px solid ${R.red}30`, color: R.red, borderRadius: R.rCard, padding: "16px", fontSize: "13px" }}>{error}</div>
            <button onClick={refresh} className="cursor-pointer" style={{ borderRadius: R.rPill, background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 20px", border: "none" }}>Retry</button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="flex flex-col gap-5">
            {/* Summary — readings (tests taken) and readers (distinct people) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              {[
                { label: "Trainer Readings", val: countTotals.trainer_readings ?? 0, sub: `${countTotals.trainer_readers ?? 0} trainers`, color: R.blue },
                { label: "Client Readings", val: countTotals.client_readings ?? 0, sub: `${countTotals.client_readers ?? 0} clients`, color: R.green },
                { label: "Total Readings", val: totalReadings, sub: `${totalReaders} readers`, color: R.dark },
              ].map(s => (
                <div key={s.label} style={{ ...CS, padding: "18px 20px", borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-1px", color: R.tp, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: "11px", color: R.tm, marginTop: "6px", letterSpacing: "-0.22px" }}>{s.label}</div>
                  <div style={{ fontSize: "11px", color: R.td, marginTop: "2px", letterSpacing: "-0.22px" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {showTrainers && (
              <div style={CS}>
                <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${R.border}` }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: R.tp, letterSpacing: "-0.3px" }}>Trainers</div>
                  <span style={badgeStyle(R.blueLight, R.blue)}>{data.trainer_readers_pagination?.total ?? countTotals.trainer_readers ?? trainerReaders.length}</span>
                </div>
                {trainerReaders.length === 0
                  ? <EmptyState text={`No trainer readings ${whenLabel}`} />
                  : <>
                      <Table cols={trainerCols} rows={trainerReaders} />
                      {type === "trainers"
                        ? <Pager pagination={data.trainer_readers_pagination} onPage={setPage} />
                        : <ViewAllFooter pagination={data.trainer_readers_pagination} noun="trainers" onView={() => { setType("trainers"); setPage(1); }} />}
                    </>}
              </div>
            )}

            {showClients && (
              <div style={CS}>
                <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${R.border}` }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: R.tp, letterSpacing: "-0.3px" }}>Clients</div>
                  <span style={badgeStyle(R.greenLight, R.green)}>{data.client_readers_pagination?.total ?? countTotals.client_readers ?? clientReaders.length}</span>
                </div>
                {clientReaders.length === 0
                  ? <EmptyState text={`No client readings ${whenLabel}`} />
                  : <>
                      <Table cols={clientCols} rows={clientReaders} />
                      {type === "clients"
                        ? <Pager pagination={data.client_readers_pagination} onPage={setPage} />
                        : <ViewAllFooter pagination={data.client_readers_pagination} noun="clients" onView={() => { setType("clients"); setPage(1); }} />}
                    </>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Drill-down behind the analytics "Reading Split" card (get_group_period_readers).
// Shared by /super-admin/readers and /trainer-admin/readers — both link here from
// their analytics Reading Split rows with the same query params, and the group
// scope the backend returns is already role-aware (actor_user_id from the token).
export default function GroupPeriodReaders() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <PeriodReadersContent />
    </Suspense>
  );
}
