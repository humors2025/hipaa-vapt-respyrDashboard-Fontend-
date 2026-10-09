"use client";

// Super Admin › Audit log — the backend's app_auth_logs table: sign-ins,
// token refreshes, API requests and privileged actions, newest first.
//
// GET audit-logs returns a page of rows plus the summary cards and the
// dropdown values. On page 1 with no filters the page also polls
// audit-logs/live every 5 s for rows newer than the last one shown and slides
// them in at the top; the live endpoint writes nothing, so leaving the page
// open costs no audit rows (each full load records one audit_logs_viewed).
//
// Super-admin activity is hidden on purpose — see EXCLUDED_ROLES in the
// service. Rows with no role (anonymous failed logins) stay visible.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AUDIT_LIVE_INTERVAL_MS,
  AUDIT_PAGE_LIMIT,
  AUDIT_SEARCH_MIN_LENGTH,
  fetchAuditLogsLiveService,
  fetchAuditLogsService,
  isHiddenRole,
} from "@/services/superAdminAuditService";
import { formatCount } from "@/components/super-admin/sales/salesFormat";
import { SalesCard, UpdatingPill, Skeleton, EmptyState, SectionError } from "@/components/super-admin/sales/SalesUi";
import { SalesKpiCard } from "@/components/super-admin/sales/SalesKpiCards";
import { SalesPagination } from "@/components/super-admin/sales/PurchaseTable";

const EMPTY_FILTERS = { eventType: "", role: "", outcome: "all", ip: "", dateFrom: "", dateTo: "" };

// Roles the backend writes (app_user_roles.role). Used until the API answers
// with its own distinct list; unknown roles are shown humanised.
const FALLBACK_ROLES = ["admin", "trainer", "facility_admin"];
const ROLE_LABEL = { admin: "Trainer admin", trainer: "Trainer", facility_admin: "Facility admin", super_admin: "Super admin" };
const ROLE_BADGE = {
  admin: "bg-[#EEF4FE] text-[#308BF9]",
  trainer: "bg-[#E5F6EE] text-[#1F7A4A]",
  facility_admin: "bg-[#FFF4E0] text-[#A66B00]",
};

// How long a row that arrived through the live feed stays highlighted.
const NEW_ROW_HIGHLIGHT_MS = 6000;

// "login_failed" → "Login failed". Sentence case reads better than the
// title-cased humanizeStatus for free-text event names.
function humanizeEvent(s) {
  const t = String(s || "").replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

function roleLabel(role) {
  const key = String(role || "").toLowerCase();
  return ROLE_LABEL[key] || humanizeEvent(key);
}

// created_at is "YYYY-MM-DD HH:mm:ss" with no zone: the UTC wall clock (the
// Lambda runs with TZ=UTC and the column defaults to CURRENT_TIMESTAMP).
function parseUtc(raw) {
  if (!raw) return null;
  const s = String(raw);
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(" ", "T")}Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLocalTime(d) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function errorMessage(err, fallback) {
  return err?.data?.message || err?.message || fallback;
}

function maxId(rows) {
  return (rows || []).reduce((m, r) => Math.max(m, Number(r?.id) || 0), 0);
}

// Prepend rows that arrived through the live feed (already newest-first),
// keep the page at its size and bump the counters the new rows belong to.
function mergeLive(prev, fresh) {
  const seen = new Set((prev.logs || []).map((r) => r.id));
  const added = fresh.filter((r) => !seen.has(r.id));
  if (!added.length) return prev;
  const failed = added.filter((r) => !r.success).length;
  const summary = prev.summary || {};
  const pagination = prev.pagination || {};
  const total = (Number(pagination.total) || 0) + added.length;
  return {
    ...prev,
    logs: [...added, ...(prev.logs || [])].slice(0, AUDIT_PAGE_LIMIT),
    summary: {
      ...summary,
      filtered_total: (Number(summary.filtered_total) || 0) + added.length,
      today_total: (Number(summary.today_total) || 0) + added.length,
      security_events: (Number(summary.security_events) || 0) + failed,
    },
    pagination: {
      ...pagination,
      total,
      total_pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_LIMIT)),
    },
  };
}

const Dash = () => <span className="text-[#A1A1A1]">—</span>;

function RoleBadge({ role }) {
  if (!role) return <Dash />;
  const cls = ROLE_BADGE[String(role).toLowerCase()] || "bg-[#F5F7FA] text-[#535359]";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${cls}`}>
      {roleLabel(role)}
    </span>
  );
}

function ResultBadge({ success }) {
  return success ? (
    <span className="inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[#E5F6EE] text-[#1F7A4A]">
      Success
    </span>
  ) : (
    <span className="inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[#FCEAEB] text-[#B5363A]">
      Failed
    </span>
  );
}

function LiveIndicator({ enabled, active, reason, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? (active ? "Live updates on — click to pause" : reason) : "Live updates paused — click to resume"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
        active ? "bg-[#E5F6EE] text-[#1F7A4A]" : "bg-[#F5F7FA] text-[#535359] hover:bg-[#EEF4FE]"
      }`}
    >
      <span className="relative inline-flex h-2 w-2" aria-hidden="true">
        {active && <span className="absolute inline-flex h-full w-full rounded-full bg-[#1F7A4A] opacity-60 animate-ping" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? "bg-[#1F7A4A]" : "bg-[#A1A1A1]"}`} />
      </span>
      {active ? "Live" : enabled ? "Live (waiting)" : "Live paused"}
    </button>
  );
}

const th = "py-2.5 px-2.5 font-semibold whitespace-nowrap";
const td = "py-2.5 px-2.5";

function AuditTable({ rows, newIds, loading, updating, error, onRetry, emptyMessage, onPickEvent, onPickUser }) {
  if (error) return <SectionError message={error} onRetry={onRetry} />;
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[44px] w-full" />
        ))}
      </div>
    );
  }
  if (!rows?.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="relative overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      <table className={`w-full text-[12px] min-w-[1040px] transition-opacity ${updating ? "opacity-50" : "opacity-100"}`} aria-busy={updating}>
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">
            <th scope="col" className={th}>Time</th>
            <th scope="col" className={th}>Event</th>
            <th scope="col" className={th}>User</th>
            <th scope="col" className={th}>Role</th>
            <th scope="col" className={th}>Code</th>
            <th scope="col" className={th}>Result</th>
            <th scope="col" className={th}>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const when = parseUtc(r.created_at);
            const isNew = newIds.has(r.id);
            return (
              <tr
                key={r.id}
                className={`border-t border-[#F5F7FA] align-top transition-colors duration-700 ${isNew ? "bg-[#EEF4FE]" : "bg-transparent"}`}
              >
                <td className={`${td} text-[#535359] whitespace-nowrap tabular-nums`}>
                  {when ? (
                    <span title={`${r.created_at} UTC`}>{formatLocalTime(when)}</span>
                  ) : (
                    r.created_at || <Dash />
                  )}
                  {isNew && <div className="text-[#308BF9] text-[10px] font-semibold">New</div>}
                </td>
                <td className={`${td} max-w-[280px]`}>
                  <button
                    type="button"
                    onClick={() => onPickEvent(r.event_type)}
                    title="Show only this event type"
                    className="text-left cursor-pointer group min-w-0"
                  >
                    <div className="text-[#252525] font-semibold group-hover:text-[#308BF9] transition-colors break-words">
                      {humanizeEvent(r.event_type) || <Dash />}
                    </div>
                    <div className="font-mono text-[10px] text-[#A1A1A1] break-all">{r.event_type}</div>
                  </button>
                </td>
                <td className={`${td} max-w-[240px]`}>
                  {r.user_id ? (
                    <button
                      type="button"
                      onClick={() => onPickUser(r.user_id)}
                      title="Search for this user"
                      className="text-left text-[#252525] hover:text-[#308BF9] transition-colors cursor-pointer break-all"
                    >
                      {r.user_id}
                    </button>
                  ) : (
                    <span className="text-[#A1A1A1] italic">anonymous</span>
                  )}
                </td>
                <td className={td}>
                  <RoleBadge role={r.role} />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {r.partner_code ? <span className="font-mono text-[11px] text-[#535359]">{r.partner_code}</span> : <Dash />}
                </td>
                <td className={`${td} max-w-[300px]`}>
                  <ResultBadge success={Boolean(r.success)} />
                  {r.failure_reason && (
                    <div className={`text-[11px] mt-1 break-words ${r.success ? "text-[#A1A1A1]" : "text-[#B5363A]"}`}>
                      {r.failure_reason}
                    </div>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {r.ip_hash ? (
                    <span
                      className="font-mono text-[10px] text-[#A1A1A1]"
                      title={`Hashed IP address ${r.ip_hash}\nThe same value means the same address.`}
                    >
                      {String(r.ip_hash).slice(0, 10)}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const inputClass =
  "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors";
const selectClass = `${inputClass} cursor-pointer`;

function Field({ label, className = "", children }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[#535359] text-[11px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

export default function AuditLogsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { message, status }

  const [live, setLive] = useState(true);
  const [newIds, setNewIds] = useState(() => new Set());

  const reqId = useRef(0);
  const cursorRef = useRef(0); // highest app_auth_logs.id the page knows about
  const pollingRef = useRef(false);
  const liveFailures = useRef(0);

  const filtersActive =
    Boolean(search) ||
    Boolean(filters.eventType) ||
    Boolean(filters.role) ||
    filters.outcome !== "all" ||
    Boolean(filters.ip) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);
  const dateInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);

  // Debounced search (same 400 ms / 3-char rule as Orders and Sales Analytics).
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length > 0 && trimmed.length < AUDIT_SEARCH_MIN_LENGTH) return undefined;
    const t = setTimeout(() => {
      setSearch((prev) => {
        if (prev !== trimmed) setPage(1);
        return trimmed;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (dateInvalid) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogsService({
        page,
        limit: AUDIT_PAGE_LIMIT,
        search,
        event_type: filters.eventType,
        role: filters.role,
        success: filters.outcome === "all" ? "" : filters.outcome,
        ip_address: filters.ip,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
      });
      if (id !== reqId.current) return;
      const logs = (res?.logs || []).filter((r) => !isHiddenRole(r.role));
      setData({ ...res, logs });
      setNewIds(new Set());
      // The live cursor is the newest id the backend returned — hidden rows
      // included, so the feed never re-reads them.
      cursorRef.current = page === 1 && !filtersActive ? maxId(res?.logs) : 0;
      liveFailures.current = 0;
    } catch (err) {
      if (id !== reqId.current) return;
      const msg = errorMessage(err, "Failed to load the audit log");
      setError({ message: msg, status: err?.status });
      if (err?.status !== 403) toast.error(msg);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, search, filters, filtersActive, dateInvalid]);

  useEffect(() => {
    load();
  }, [load]);

  // One live poll: everything newer than the cursor, draining has_more.
  const poll = useCallback(async () => {
    if (pollingRef.current || cursorRef.current <= 0) return;
    pollingRef.current = true;
    const seq = reqId.current;
    try {
      for (let round = 0; round < 5; round += 1) {
        const res = await fetchAuditLogsLiveService({ after_id: cursorRef.current });
        if (seq !== reqId.current) return; // a full reload happened meanwhile
        cursorRef.current = Math.max(cursorRef.current, Number(res?.next_after_id) || 0, maxId(res?.logs));
        const fresh = (res?.logs || []).filter((r) => !isHiddenRole(r.role)).reverse(); // newest first
        if (fresh.length) {
          setData((prev) => (prev ? mergeLive(prev, fresh) : prev));
          const ids = fresh.map((r) => r.id);
          setNewIds((prev) => new Set([...prev, ...ids]));
          setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              ids.forEach((i) => next.delete(i));
              return next;
            });
          }, NEW_ROW_HIGHLIGHT_MS);
        }
        liveFailures.current = 0;
        if (!res?.has_more) break;
      }
    } catch (err) {
      if (seq !== reqId.current) return;
      liveFailures.current += 1;
      if (err?.status === 401 || err?.status === 403 || liveFailures.current >= 3) {
        setLive(false);
        toast.error(`Live updates stopped: ${errorMessage(err, "could not reach the audit feed")}`);
      }
    } finally {
      pollingRef.current = false;
    }
  }, []);

  const liveActive = live && page === 1 && !filtersActive && !error && Boolean(data) && !dateInvalid;

  useEffect(() => {
    if (!liveActive) return undefined;
    let cancelled = false;
    let timer = null;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") await poll();
      if (!cancelled) timer = setTimeout(tick, AUDIT_LIVE_INTERVAL_MS);
    };
    timer = setTimeout(tick, AUDIT_LIVE_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [liveActive, poll]);

  const setFilter = (key, value) => {
    setFilters((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const summary = data?.summary;
  const pagination = data?.pagination;
  const totalPages = Math.max(1, pagination?.total_pages || 1);
  const trimmed = searchInput.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < AUDIT_SEARCH_MIN_LENGTH;
  const forbidden = error?.status === 403;

  const eventTypes = data?.event_types || [];
  const eventOptions = filters.eventType && !eventTypes.includes(filters.eventType) ? [filters.eventType, ...eventTypes] : eventTypes;
  const roleSource = (data?.roles?.length ? data.roles : FALLBACK_ROLES).filter((r) => !isHiddenRole(r));
  const roleOptions = filters.role && !roleSource.includes(filters.role) ? [filters.role, ...roleSource] : roleSource;

  const liveReason = dateInvalid
    ? "Fix the date range to resume live updates"
    : filtersActive
      ? "Live updates pause while filters are applied"
      : page !== 1
        ? "Live updates run on page 1 only"
        : "Waiting for the first load";

  const shell = {
    loading: loading && !data,
    updating: loading && Boolean(data),
    error: forbidden ? null : error?.message,
    onRetry: load,
  };

  const cards = [
    { label: "Events today", value: formatCount(summary?.today_total), hint: "Since midnight UTC", accent: true },
    { label: "Failed events", value: formatCount(summary?.security_events), hint: "Rejected sign-ins and denied actions, all time" },
    { label: "Event types", value: formatCount(summary?.unique_event_types), hint: "Distinct kinds of event recorded" },
    {
      label: "Matching events",
      value: formatCount(summary?.filtered_total),
      hint: filtersActive ? "With the current filters" : "All recorded events",
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="max-w-[720px]">
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Audit log</h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Every sign-in, token refresh, API request and privileged action the backend records — who did it, from where,
          and whether it succeeded. Super-admin activity is not shown here.
        </p>
      </div>

      {forbidden ? (
        <div role="alert" className="rounded-[10px] border border-[#FCD9A0] bg-[#FFF8EB] p-4 text-[12px] text-[#7A4F00] max-w-[720px]">
          <p className="font-semibold">This account can&apos;t view the audit log.</p>
          <p className="mt-1">
            The backend only serves it to active super admins whose email is on its AUDIT_LOG_ALLOWED_EMAILS list
            (connect@respyr.in unless the Lambda sets otherwise). Add this account&apos;s email there, or sign in with an
            allowed one. The attempt itself has been recorded.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map((c) => (
              <SalesKpiCard key={c.label} {...c} loading={loading && !data} />
            ))}
          </div>

          <SalesCard
            title="Events"
            subtitle="Newest first. Times are shown in your local time zone; hover a time for the stored UTC value."
            action={
              <div className="flex items-center gap-2 flex-wrap">
                <UpdatingPill show={loading && Boolean(data)} />
                <LiveIndicator enabled={live} active={liveActive} reason={liveReason} onToggle={() => setLive((v) => !v)} />
                <button
                  type="button"
                  onClick={load}
                  disabled={loading || dateInvalid}
                  className="rounded-full border border-[#E1E6ED] bg-white px-3 py-1 text-[10px] font-semibold text-[#535359] hover:bg-[#F5F7FA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Refresh
                </button>
              </div>
            }
          >
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Search" className="w-full md:w-auto md:flex-1 md:min-w-[240px] md:max-w-[360px]">
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Event, user email, role, code or reason"
                  aria-label="Search"
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
              <Field label="Event" className="min-w-[180px]">
                <select value={filters.eventType} onChange={(e) => setFilter("eventType", e.target.value)} aria-label="Event type" className={selectClass}>
                  <option value="">All events</option>
                  {eventOptions.map((t) => (
                    <option key={t} value={t}>
                      {humanizeEvent(t)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Role" className="min-w-[140px]">
                <select value={filters.role} onChange={(e) => setFilter("role", e.target.value)} aria-label="Role" className={selectClass}>
                  <option value="">All roles</option>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Result" className="min-w-[120px]">
                <select value={filters.outcome} onChange={(e) => setFilter("outcome", e.target.value)} aria-label="Result" className={selectClass}>
                  <option value="all">All</option>
                  <option value="1">Success</option>
                  <option value="0">Failed</option>
                </select>
              </Field>
              <Field label="From" className="min-w-[150px]">
                <input
                  type="date"
                  value={filters.dateFrom}
                  max={filters.dateTo || undefined}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  aria-label="From date"
                  className={inputClass}
                />
              </Field>
              <Field label="To" className="min-w-[150px]">
                <input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  aria-label="To date"
                  className={inputClass}
                />
              </Field>
              <Field label="IP address" className="min-w-[150px]">
                <input
                  type="text"
                  value={filters.ip}
                  onChange={(e) => setFilter("ip", e.target.value.trim())}
                  placeholder="e.g. 203.0.113.9"
                  aria-label="IP address"
                  title="Matched against the stored hash of the address"
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
              {(filtersActive || searchInput) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-[10px] border border-[#E1E6ED] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#535359] hover:bg-[#F5F7FA] transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
            {tooShort && <p className="text-[#A1A1A1] text-[11px] -mt-2">Type at least {AUDIT_SEARCH_MIN_LENGTH} characters to search.</p>}
            {dateInvalid && <p className="text-[#B5363A] text-[11px] -mt-2">The From date is after the To date.</p>}

            <AuditTable
              rows={data?.logs}
              newIds={newIds}
              {...shell}
              emptyMessage={filtersActive ? "No events match these filters." : "No events recorded yet."}
              onPickEvent={(t) => setFilter("eventType", t)}
              onPickUser={(u) => setSearchInput(u)}
            />

            {data && !error && (
              <SalesPagination
                page={page}
                limit={AUDIT_PAGE_LIMIT}
                total={pagination?.total || 0}
                totalPages={totalPages}
                disabled={loading}
                noun="events"
                onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
              />
            )}
          </SalesCard>
        </>
      )}
    </div>
  );
}
