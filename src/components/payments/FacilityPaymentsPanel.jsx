"use client";

// Facility admin › Sales & Payments: one row per Stripe invoice (first payment, each
// renewal, failed payments, refunds) for the members who bought through this
// facility — the facility admin's own code (wall QR) or one of their trainers'
// codes, removed trainers included. Read-only.
//
// The backend (facility-admin-payments.js) scopes the rows to the signed-in
// facility admin; the table reuses Super Admin › Orders › Payments' helpers.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FACILITY_PAYMENTS_SEARCH_MIN_LENGTH,
  fetchFacilityPaymentsService,
} from "@/services/facilityAdminPaymentsService";
import { formatDate, formatMoney, humanizeStatus } from "@/components/super-admin/sales/salesFormat";
import { SalesCard, UpdatingPill, StatusBadge } from "@/components/super-admin/sales/SalesUi";
import { SalesPagination } from "@/components/super-admin/sales/PurchaseTable";
import {
  Customer,
  Dash,
  PaymentSummary,
  TableShell,
  describePlan,
  ordinal,
} from "@/components/super-admin/orders/OrdersPayments";

const PAGE_LIMIT = 20;
const DEFAULT_STATUSES = ["paid", "failed", "refunded", "partially_refunded", "open"];
const TYPES = [
  { value: "all", label: "All" },
  { value: "first_payment", label: "First payments" },
  { value: "renewal", label: "Renewals" },
];
const DATE_PERIODS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const pad = (n) => String(n).padStart(2, "0");
// YYYY-MM-DD in this browser's calendar.
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Date filter → { from, to } (inclusive YYYY-MM-DD days, "" = open end).
function dateRange(period, customFrom, customTo) {
  const now = new Date();
  const [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate()];
  const today = ymd(now);
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "last_7_days":
      return { from: ymd(new Date(y, m, d - 6)), to: today };
    case "last_30_days":
      return { from: ymd(new Date(y, m, d - 29)), to: today };
    case "this_month":
      return { from: ymd(new Date(y, m, 1)), to: today };
    case "last_month":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "this_year":
      return { from: ymd(new Date(y, 0, 1)), to: today };
    case "custom":
      return { from: customFrom || "", to: customTo || "" };
    default:
      return { from: "", to: "" };
  }
}

// "on Oct 21, 2026", "Oct 1, 2026 – Oct 21, 2026", "from Oct 1, 2026", "until Oct 21, 2026".
function rangeLabel({ from, to }) {
  if (from && to) return from === to ? `on ${formatDate(from)}` : `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `from ${formatDate(from)}`;
  if (to) return `until ${formatDate(to)}`;
  return null;
}

const th = "py-2.5 px-2.5 font-semibold whitespace-nowrap";
const td = "py-2.5 px-2.5";
const fieldCls =
  "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors";

function errorMessage(err, fallback) {
  return err?.data?.message || err?.message || fallback;
}

// "First payment", "2nd renewal".
function typeLabel(r) {
  if (r.type === "first_payment") return "First payment";
  if (r.type === "renewal") return r.renewal_number ? `${ordinal(r.renewal_number)} renewal` : "Renewal";
  return humanizeStatus(r.type);
}

// Option text for the Referred by filter.
function sourceLabel(s) {
  const removed = s.status && s.status !== "active" ? ` (${humanizeStatus(s.status).toLowerCase()})` : "";
  return `${s.name || s.code}${removed}`;
}

function ReferredBy({ row }) {
  const s = row.referred_by;
  if (!s) return row.partner_code ? <span className="font-mono text-[11px] text-[#535359]">{row.partner_code}</span> : <Dash />;
  const inactive = s.status && s.status !== "active";
  return (
    <>
      <div className="text-[#252525] truncate" title={s.user_id || undefined}>
        {s.kind === "facility" ? "Facility QR" : s.name}
      </div>
      <div className="text-[#A1A1A1] text-[11px] truncate">
        {s.kind === "facility" ? "Direct" : "Trainer"}
        {row.partner_code && <span className="font-mono"> · {String(row.partner_code).toUpperCase()}</span>}
        {inactive && <span className="text-[#A66B00]"> · {humanizeStatus(s.status)}</span>}
      </div>
    </>
  );
}

function FacilityPaymentsTable({ rows, ...shell }) {
  return (
    <TableShell
      {...shell}
      empty={!rows?.length}
      minWidth="min-w-[1180px]"
      head={
        <>
          <th scope="col" className={th}>Date</th>
          <th scope="col" className={th}>Member</th>
          <th scope="col" className={th}>Referred by</th>
          <th scope="col" className={th}>Type</th>
          <th scope="col" className={th}>Billing period</th>
          <th scope="col" className={`${th} text-right`}>Paid</th>
          <th scope="col" className={`${th} text-right`}>Refunded</th>
          <th scope="col" className={th}>Status</th>
          <th scope="col" className={th}>Membership now</th>
        </>
      }
    >
      {rows?.map((r) => {
        const cur = r.currency;
        const plan = describePlan(r.plan || {});
        return (
          <tr key={r.id} className="border-t border-[#F5F7FA] align-top">
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{formatDate(r.date, true)}</td>
            <td className={`${td} max-w-[220px]`}>
              <Customer customer={r.customer} />
            </td>
            <td className={`${td} max-w-[200px]`}>
              <ReferredBy row={r} />
            </td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{typeLabel(r)}</td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>
              {r.period_start ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}` : <Dash />}
            </td>
            <td className={`${td} text-right tabular-nums text-[#252525] font-semibold whitespace-nowrap`}>
              {formatMoney(r.amount_paid, cur)}
            </td>
            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>
              {Number(r.amount_refunded) > 0 ? <span className="text-[#A66B00]">−{formatMoney(r.amount_refunded, cur)}</span> : <Dash />}
            </td>
            <td className={td}>
              <StatusBadge status={r.status} />
              {r.failure_message && <div className="text-[#B5363A] text-[11px] mt-1 max-w-[200px]">{r.failure_message}</div>}
            </td>
            <td className={td}>
              {plan.status ? <StatusBadge status={plan.status} /> : <Dash />}
              {plan.note && <div className={`text-[11px] mt-1 whitespace-nowrap ${plan.note.tone}`}>{plan.note.text}</div>}
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

export default function FacilityPaymentsPanel() {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [code, setCode] = useState("all");
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  // Debounced search (same 400 ms / 3-char rule as Orders & Payments).
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length > 0 && trimmed.length < FACILITY_PAYMENTS_SEARCH_MIN_LENGTH) return;
    const t = setTimeout(() => {
      setSearch(trimmed);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const range = useMemo(() => dateRange(period, customFrom, customTo), [period, customFrom, customTo]);
  // A custom range typed backwards is not sent; the hint below the filters says why.
  const rangeBackwards = Boolean(range.from && range.to && range.from > range.to);

  const load = useCallback(async () => {
    if (rangeBackwards) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFacilityPaymentsService({
        status,
        type,
        code,
        dateFrom: range.from,
        dateTo: range.to,
        search,
        page,
        limit: PAGE_LIMIT,
      });
      if (id !== reqId.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load payments");
      setData(res);
    } catch (err) {
      if (id !== reqId.current) return;
      const msg = errorMessage(err, "Failed to load payments");
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [status, type, code, range.from, range.to, rangeBackwards, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Filter changes start again from page 1.
  const pick = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const pagination = data?.pagination;
  const totalPages = Math.max(1, pagination?.total_pages || 1);
  const trimmed = searchInput.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < FACILITY_PAYMENTS_SEARCH_MIN_LENGTH;
  const filtersActive = Boolean(search) || status !== "all" || type !== "all" || code !== "all" || Boolean(range.from || range.to);
  const activeRange = rangeLabel(range);
  const statusOptions = data?.status_options || DEFAULT_STATUSES;
  const sources = data?.sources || [];

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="max-w-[640px]">
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Sales &amp; Payments</h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Every payment from members who bought through your facility QR or your trainers&apos; codes: first payments,
          renewals, failed payments and refunds.
        </p>
      </div>

      <SalesCard
        title="Member payments"
        subtitle="One row per payment, newest first. The totals follow the Type, Date and Referred by filters. Membership now shows where each member's plan stands today."
        action={<UpdatingPill show={loading && Boolean(data)} />}
      >
        <PaymentSummary summary={data?.summary} />

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 w-full md:w-auto md:flex-1 md:max-w-[360px]">
            <span className="text-[#535359] text-[11px] font-semibold">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search member name, email or code"
              aria-label="Search"
              className={`${fieldCls} placeholder:text-[#A1A1A1]`}
            />
          </label>
          <label className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-[#535359] text-[11px] font-semibold">Type</span>
            <select value={type} onChange={pick(setType)} aria-label="Payment type" className={`${fieldCls} cursor-pointer`}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-[#535359] text-[11px] font-semibold">Date</span>
            <select value={period} onChange={pick(setPeriod)} aria-label="Payment date" className={`${fieldCls} cursor-pointer`}>
              {DATE_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {period === "custom" && (
            <>
              <label className="flex flex-col gap-1 w-[150px]">
                <span className="text-[#535359] text-[11px] font-semibold">From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={pick(setCustomFrom)}
                  aria-label="From date"
                  className={`${fieldCls} cursor-pointer`}
                />
              </label>
              <label className="flex flex-col gap-1 w-[150px]">
                <span className="text-[#535359] text-[11px] font-semibold">To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={pick(setCustomTo)}
                  aria-label="To date"
                  className={`${fieldCls} cursor-pointer`}
                />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-[#535359] text-[11px] font-semibold">Status</span>
            <select value={status} onChange={pick(setStatus)} aria-label="Payment status" className={`${fieldCls} cursor-pointer`}>
              <option value="all">All</option>
              {statusOptions.map((o) => (
                <option key={o} value={o}>
                  {humanizeStatus(o)}
                </option>
              ))}
            </select>
          </label>
          {sources.length > 1 && (
            <label className="flex flex-col gap-1 min-w-[200px]">
              <span className="text-[#535359] text-[11px] font-semibold">Referred by</span>
              <select value={code} onChange={pick(setCode)} aria-label="Referred by" className={`${fieldCls} cursor-pointer`}>
                <option value="all">Everyone</option>
                {sources.map((s) => (
                  <option key={s.code} value={s.code}>
                    {sourceLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {tooShort && (
          <p className="text-[#A1A1A1] text-[11px] -mt-2">Type at least {FACILITY_PAYMENTS_SEARCH_MIN_LENGTH} characters to search.</p>
        )}
        {rangeBackwards ? (
          <p className="text-[#B5363A] text-[11px] -mt-2">The To date must be on or after the From date.</p>
        ) : (
          activeRange && <p className="text-[#535359] text-[11px] -mt-2">Showing payments made {activeRange}.</p>
        )}

        <FacilityPaymentsTable
          rows={data?.payments}
          loading={loading && !data}
          updating={loading && Boolean(data)}
          error={error}
          onRetry={load}
          emptyMessage={
            filtersActive
              ? "No payments match these filters."
              : "No payments yet. They show here once a member buys through your facility QR or a trainer's code."
          }
        />

        {data && !error && (
          <SalesPagination
            page={page}
            limit={PAGE_LIMIT}
            total={pagination?.total || 0}
            totalPages={totalPages}
            disabled={loading}
            noun="payments"
            onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
          />
        )}
      </SalesCard>
    </div>
  );
}
