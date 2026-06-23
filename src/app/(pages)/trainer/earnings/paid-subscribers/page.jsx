"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { fetchTrainerSalesAnalyticsService } from "@/services/authService";

// Decodes the JWT payload (no verification — we only read claims client-side).
function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Reads the trainer's partner_code from the access_token cookie.
function getPartnerCodeFromToken() {
  const token = Cookies.get("access_token");
  if (!token) return "";
  const decoded = decodeJwt(token);
  return decoded?.partner_code || decoded?.dietician_id || "";
}

// Backend enforces a minimum search length (search_min_length: 3).
const SEARCH_MIN_LENGTH = 3;

// Time-window filters, shown as a dropdown.
const PURCHASE_FILTERS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "yearly", label: "This year" },
  { value: "custom", label: "Custom range" },
];

// User-state tabs. `countKey` maps to the API's tab_counts object.
const USER_STATES = [
  { value: "all", label: "All", countKey: "all" },
  { value: "active", label: "Active", countKey: "active" },
  { value: "expired", label: "Expired", countKey: "expired" },
  { value: "attention_for_renewal", label: "Renewal due", countKey: "attention_for_renewal" },
  { value: "upcoming", label: "Upcoming", countKey: "upcoming" },
];

const RENEWAL_DAY_OPTIONS = [7, 15];

// Reads the first present key from a row, returning fallback when none match.
function pick(row, keys, fallback = null) {
  for (const k of keys) {
    if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== "") {
      return row[k];
    }
  }
  return fallback;
}

// Formats a major-unit amount with its currency (falls back to a plain number).
function formatMoney(amount, currency) {
  const value = Number(amount || 0);
  const code = (currency || "").toUpperCase();
  try {
    if (code) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 2,
      }).format(value);
    }
  } catch {
    // Unknown currency code — fall through to plain formatting.
  }
  return `${code ? `${code} ` : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatDate(raw, withTime = false) {
  if (!raw) return "-";
  const d = new Date(String(raw).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// Picks a single currency to display in the summary cards when the result set
// uses exactly one currency; otherwise returns "" so amounts stay code-less.
function summaryCurrency(summary) {
  const currencies = summary?.currencies;
  if (Array.isArray(currencies) && currencies.length === 1) {
    return currencies[0];
  }
  return "";
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="rounded-[12px] border border-[#E1E6ED] bg-white p-4 flex flex-col gap-1">
      <span className="text-[#A1A1A1] text-[11px] uppercase tracking-wide font-semibold">
        {label}
      </span>
      <span className={`text-[18px] font-bold ${accent || "text-[#252525]"}`}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ state }) {
  const config = {
    active: { bg: "bg-[#E5F6EE]", text: "text-[#1F7A4A]", label: "Active" },
    expired: { bg: "bg-[#FCEAEB]", text: "text-[#B5363A]", label: "Expired" },
    attention_for_renewal: { bg: "bg-[#FFF4E0]", text: "text-[#A66B00]", label: "Renewal due" },
    upcoming: { bg: "bg-[#EEF4FE]", text: "text-[#308BF9]", label: "Upcoming" },
  };
  const c = config[state];
  if (!c) {
    return state ? <span className="text-[#A1A1A1] text-[12px]">{state}</span> : <span className="text-[#A1A1A1]">-</span>;
  }
  return (
    <span className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// Derives a user-state for a row from explicit fields if the backend provides
// them; otherwise infers from subscription_end_date relative to now.
function deriveRowState(row) {
  const explicit = pick(row, ["user_state", "state", "status_state"]);
  if (explicit) return explicit;
  const end = pick(row, ["subscription_end_date", "end_date", "expiry_date"]);
  if (!end) return null;
  const endDate = new Date(String(end).replace(" ", "T"));
  if (Number.isNaN(endDate.getTime())) return null;
  return endDate.getTime() >= Date.now() ? "active" : "expired";
}

function SubscribersTable({ rows, isLoading }) {
  // Full-block loader only on the very first load (no rows yet). Subsequent
  // fetches keep the table mounted and just dim it.
  const isInitialLoading = isLoading && (!rows || rows.length === 0);

  if (isInitialLoading) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        Loading subscribers...
      </div>
    );
  }

  if (!isLoading && (!rows || rows.length === 0)) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        No paid subscribers found for this period.
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#535359] shadow-sm border border-[#E1E6ED]">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#E1E6ED" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="#308BF9" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Updating...
          </span>
        </div>
      )}
      <table className={`w-full text-[12px] transition-opacity ${isLoading ? "opacity-50" : "opacity-100"}`}>
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">
            <th className="py-2.5 px-4 font-semibold">Client</th>
            <th className="py-2.5 px-4 font-semibold">Plan</th>
            <th className="py-2.5 px-4 font-semibold">Net</th>
            <th className="py-2.5 px-4 font-semibold">Gross</th>
            <th className="py-2.5 px-4 font-semibold">Coupon</th>
            <th className="py-2.5 px-4 font-semibold">Start</th>
            <th className="py-2.5 px-4 font-semibold">Expires</th>
            <th className="py-2.5 px-4 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const name = pick(row, ["client_name", "name", "full_name"], "-");
            const email = pick(row, ["client_email", "email"]);
            const phone = pick(row, ["client_phone", "phone", "mobile"]);
            const planName = pick(row, ["plan_name", "plan_code", "plan"], "-");
            const currency = pick(row, ["currency"], "");
            const net = pick(row, ["net_sales", "net_amount", "amount_net", "amount"]);
            const gross = pick(row, ["gross_sales", "gross_amount", "amount_gross", "amount"]);
            const coupon = pick(row, ["coupon_code", "coupon"]);
            const start = pick(row, ["subscription_start_date", "start_date", "purchased_at", "created_at"]);
            const end = pick(row, ["subscription_end_date", "end_date", "expiry_date"]);
            const key =
              pick(row, ["profile_id", "client_id", "stripe_subscription_id", "session_id"]) ??
              `row-${index}`;

            return (
              <tr key={key} className="border-t border-[#F5F7FA] align-top">
                <td className="py-2.5 px-4">
                  <div className="flex flex-col">
                    <span className="text-[#252525] font-semibold">{name}</span>
                    {email && <span className="text-[#A1A1A1] text-[11px]">{email}</span>}
                    {phone && <span className="text-[#A1A1A1] text-[11px]">{phone}</span>}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-[#535359]">{planName}</td>
                <td className="py-2.5 px-4 text-[#252525] font-semibold">
                  {net != null ? formatMoney(net, currency) : "-"}
                </td>
                <td className="py-2.5 px-4 text-[#535359]">
                  {gross != null ? formatMoney(gross, currency) : "-"}
                </td>
                <td className="py-2.5 px-4">
                  {coupon ? (
                    <span className="inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[#F3EEFE] text-[#6B45BC]">
                      {coupon}
                    </span>
                  ) : (
                    <span className="text-[#A1A1A1]">-</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-[#535359]">{formatDate(start)}</td>
                <td className="py-2.5 px-4 text-[#535359]">{formatDate(end)}</td>
                <td className="py-2.5 px-4">
                  <StatusBadge state={deriveRowState(row)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PaidSubscribersPage() {
  const [partnerCode, setPartnerCode] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tabCounts, setTabCounts] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [filtersMeta, setFiltersMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [purchaseFilter, setPurchaseFilter] = useState("this_month");
  const [userState, setUserState] = useState("all");
  const [renewalDays, setRenewalDays] = useState(7);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const limit = 10;

  // Caches already-fetched pages (keyed by page) so navigating "Previous" serves
  // from memory. Cleared whenever any filter changes.
  const pageCacheRef = useRef({});

  // Bind partner_code from the access_token cookie on mount.
  useEffect(() => {
    setPartnerCode(getPartnerCodeFromToken());
  }, []);

  // Any filter change invalidates cached pages.
  useEffect(() => {
    pageCacheRef.current = {};
  }, [debouncedSearch, partnerCode, purchaseFilter, userState, renewalDays, dateFrom, dateTo]);

  // Debounce search; reset to page 1. Only 0 chars or >= min length trigger a fetch.
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH) return;

    const t = setTimeout(() => {
      setDebouncedSearch(trimmed);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to page 1 when a non-search filter changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [purchaseFilter, userState, renewalDays, dateFrom, dateTo]);

  const fetchAnalytics = useCallback(
    async (page = 1, search = "") => {
      // Wait until partner_code has been read from the access_token cookie;
      // firing without it makes the backend reject the request.
      if (!partnerCode) return;

      // For custom range, wait until both dates are set before hitting the API.
      if (purchaseFilter === "custom" && (!dateFrom || !dateTo)) {
        setRows([]);
        setSummary(null);
        setTabCounts(null);
        setPagination(null);
        return;
      }

      const cacheKey = page;
      const cached = pageCacheRef.current[cacheKey];
      if (cached) {
        setRows(cached.data || []);
        setSummary(cached.summary || null);
        setTabCounts(cached.tab_counts || null);
        setPagination(cached.pagination || null);
        setFiltersMeta(cached.filters || null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetchTrainerSalesAnalyticsService(page, limit, {
          partnerCode,
          purchaseFilter,
          userState,
          renewalDays: userState === "attention_for_renewal" ? renewalDays : undefined,
          dateFrom: purchaseFilter === "custom" ? dateFrom : "",
          dateTo: purchaseFilter === "custom" ? dateTo : "",
          search: search.length >= SEARCH_MIN_LENGTH ? search : "",
        });

        if (response?.status || response?.ok) {
          pageCacheRef.current[cacheKey] = response;
          setRows(response.data || []);
          setSummary(response.summary || null);
          setTabCounts(response.tab_counts || null);
          setPagination(response.pagination || null);
          setFiltersMeta(response.filters || null);
        } else {
          toast.error(response?.message || "Failed to fetch subscribers");
        }
      } catch (error) {
        const msg = error?.data?.message || error?.message || "Failed to fetch subscribers";
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [partnerCode, purchaseFilter, userState, renewalDays, dateFrom, dateTo]
  );

  useEffect(() => {
    fetchAnalytics(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, fetchAnalytics]);

  const totalPages = Math.max(
    1,
    pagination?.total_pages || Math.ceil((pagination?.total || 0) / limit) || 1
  );

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (newPage === currentPage) return;
    if (isLoading) return;
    setCurrentPage(newPage);
  };

  const curr = summaryCurrency(summary);

  const inputClass =
    "rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Paid Subscribers</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          Track paid client subscriptions and sales for your partner code, filter by
          period, and keep an eye on renewals.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <SummaryCard
          label="Net sales"
          value={formatMoney(summary?.net_sales, curr)}
          accent="text-[#1F7A4A]"
        />
        <SummaryCard label="Gross sales" value={formatMoney(summary?.gross_sales, curr)} />
        <SummaryCard label="Discounts" value={formatMoney(summary?.discount, curr)} />
        <SummaryCard
          label="Total payments"
          value={(summary?.total_payments ?? 0).toLocaleString("en-US")}
        />
        <SummaryCard
          label="Paid clients"
          value={(summary?.total_purchased_clients ?? 0).toLocaleString("en-US")}
        />
      </div>

      {/* Filters: period + custom range + search */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[#535359] text-[12px] font-semibold">Period</label>
          <select
            value={purchaseFilter}
            onChange={(e) => setPurchaseFilter(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            {PURCHASE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {purchaseFilter === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[#535359] text-[12px] font-semibold">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[#535359] text-[12px] font-semibold">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              />
            </div>
          </>
        )}

        {userState === "attention_for_renewal" && (
          <div className="flex flex-col gap-1">
            <label className="text-[#535359] text-[12px] font-semibold">Expiring within</label>
            <select
              value={renewalDays}
              onChange={(e) => setRenewalDays(Number(e.target.value))}
              className={`${inputClass} cursor-pointer`}
            >
              {RENEWAL_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Next {d} days
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1 ml-auto w-full sm:w-64">
          <label className="text-[#535359] text-[12px] font-semibold">Search</label>
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Client, email, plan, coupon..."
              className={`${inputClass} w-full pl-9`}
            />
          </div>
        </div>
      </div>

      {searchTerm.trim().length > 0 && searchTerm.trim().length < SEARCH_MIN_LENGTH && (
        <p className="text-[#A1A1A1] text-[11px] -mt-3">
          Type at least {SEARCH_MIN_LENGTH} characters to search.
        </p>
      )}

      {/* User-state tabs with counts */}
      <div className="flex flex-wrap gap-2 border-b border-[#F5F7FA] pb-3">
        {USER_STATES.map((s) => {
          const isActive = userState === s.value;
          const count = tabCounts?.[s.countKey];
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setUserState(s.value)}
              className={`rounded-[10px] px-3.5 py-2 text-[12px] font-semibold transition-colors cursor-pointer ${
                isActive
                  ? "bg-[#308BF9] text-white"
                  : "bg-[#F5F7FA] text-[#535359] hover:bg-[#EEF4FE]"
              }`}
            >
              {s.label}
              {count != null && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? "bg-white/25 text-white" : "bg-white text-[#A1A1A1]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtersMeta?.period_label && (
        <p className="text-[#A1A1A1] text-[11px] -mt-2">
          Showing period: <span className="font-semibold text-[#535359]">{filtersMeta.period_label}</span>
        </p>
      )}

      <SubscribersTable rows={rows} isLoading={isLoading} />

      {/* Pagination */}
      {pagination && (pagination.total || 0) > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-[#A1A1A1] text-[12px]">
            Page {currentPage} of {totalPages}
            {pagination.total != null && (
              <span className="ml-2">({pagination.total} total)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="rounded-[8px] border border-[#E1E6ED] px-3 py-1.5 text-[12px] font-semibold text-[#535359] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.has_more || currentPage >= totalPages || isLoading}
              className="rounded-[8px] border border-[#E1E6ED] px-3 py-1.5 text-[12px] font-semibold text-[#535359] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
