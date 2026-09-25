"use client";

// Website (/order) purchases as the Stripe webhook records them:
//   Shipping  one row per purchase: who to ship the device to
//   Payments  one row per Stripe invoice: first payment, renewals, failures, refunds

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ORDERS_SEARCH_MIN_LENGTH,
  fetchPaymentTransactionsService,
  fetchShippingAddressesService,
} from "@/services/superAdminOrdersService";
import { formatDate, formatMoney, humanizeStatus } from "@/components/super-admin/sales/salesFormat";
import { SalesCard, UpdatingPill, Skeleton, EmptyState, SectionError, StatusBadge } from "@/components/super-admin/sales/SalesUi";
import { SalesPagination } from "@/components/super-admin/sales/PurchaseTable";

const PAGE_LIMIT = 20;
const DEFAULT_PAYMENT_STATUSES = ["paid", "failed", "refunded", "partially_refunded", "open"];

const TABS = [
  { value: "shipping", label: "Shipping" },
  { value: "payments", label: "Payments" },
];

const PAYMENT_TYPE_LABEL = { first_payment: "First payment", renewal: "Renewal" };

function errorMessage(err, fallback) {
  return err?.data?.message || err?.message || fallback;
}

const Dash = () => <span className="text-[#A1A1A1]">—</span>;

const th = "py-2.5 px-2.5 font-semibold whitespace-nowrap";
const td = "py-2.5 px-2.5";

function TableShell({ loading, error, onRetry, empty, emptyMessage, updating, minWidth, head, children }) {
  if (error) return <SectionError message={error} onRetry={onRetry} />;
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[44px] w-full" />
        ))}
      </div>
    );
  }
  if (empty) return <EmptyState message={emptyMessage} />;
  return (
    <div className="relative overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      <table className={`w-full text-[12px] ${minWidth} transition-opacity ${updating ? "opacity-50" : "opacity-100"}`} aria-busy={updating}>
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Customer({ customer }) {
  return (
    <>
      <div className="text-[#252525] font-semibold truncate">{customer?.name || "—"}</div>
      {customer?.email && <div className="text-[#A1A1A1] text-[11px] truncate">{customer.email}</div>}
    </>
  );
}

function ShippingTable({ rows, ...shell }) {
  return (
    <TableShell
      {...shell}
      empty={!rows?.length}
      minWidth="min-w-[980px]"
      head={
        <>
          <th scope="col" className={th}>Purchased</th>
          <th scope="col" className={th}>Customer</th>
          <th scope="col" className={th}>Ship to</th>
          <th scope="col" className={th}>Phone</th>
          <th scope="col" className={th}>Address</th>
          <th scope="col" className={th}>Code</th>
          <th scope="col" className={th}>Subscription</th>
        </>
      }
    >
      {rows?.map((r) => {
        const a = r.ship_to || {};
        const cityLine = [a.city, a.state, a.postal_code].filter(Boolean).join(", ");
        return (
          <tr key={r.id} className="border-t border-[#F5F7FA] align-top">
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{formatDate(r.purchased_at, true)}</td>
            <td className={`${td} max-w-[200px]`}>
              <Customer customer={r.customer} />
            </td>
            <td className={`${td} text-[#252525] whitespace-nowrap`}>{a.name || <Dash />}</td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{a.phone || <Dash />}</td>
            <td className={`${td} text-[#535359] max-w-[320px]`}>
              {a.line1 || cityLine ? (
                <>
                  {a.line1 && <div className="break-words">{a.line1}</div>}
                  {a.line2 && <div className="break-words">{a.line2}</div>}
                  {(cityLine || a.country) && (
                    <div className="text-[#A1A1A1] text-[11px]">{[cityLine, a.country].filter(Boolean).join(" · ")}</div>
                  )}
                </>
              ) : (
                <Dash />
              )}
            </td>
            <td className={`${td} whitespace-nowrap`}>
              {r.partner_code ? <span className="font-mono text-[11px] text-[#535359]">{r.partner_code}</span> : <Dash />}
            </td>
            <td className={td}>
              <StatusBadge status={r.subscription_status} />
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function PaymentsTable({ rows, ...shell }) {
  return (
    <TableShell
      {...shell}
      empty={!rows?.length}
      minWidth="min-w-[1080px]"
      head={
        <>
          <th scope="col" className={th}>Date</th>
          <th scope="col" className={th}>Customer</th>
          <th scope="col" className={th}>Type</th>
          <th scope="col" className={th}>Billing period</th>
          <th scope="col" className={`${th} text-right`}>Paid</th>
          <th scope="col" className={`${th} text-right`}>Refunded</th>
          <th scope="col" className={`${th} text-right`}>Stripe fee</th>
          <th scope="col" className={th}>Method</th>
          <th scope="col" className={th}>Status</th>
          <th scope="col" className={th}>Invoice</th>
        </>
      }
    >
      {rows?.map((r) => {
        const cur = r.currency;
        const method = r.payment_method?.type
          ? `${humanizeStatus(r.payment_method.type)}${r.payment_method.last4 ? ` •••• ${r.payment_method.last4}` : ""}`
          : null;
        return (
          <tr key={r.id} className="border-t border-[#F5F7FA] align-top">
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{formatDate(r.date, true)}</td>
            <td className={`${td} max-w-[200px]`}>
              <Customer customer={r.customer} />
            </td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{PAYMENT_TYPE_LABEL[r.type] || humanizeStatus(r.type)}</td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>
              {r.period_start ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}` : <Dash />}
            </td>
            <td className={`${td} text-right tabular-nums text-[#252525] font-semibold whitespace-nowrap`}>{formatMoney(r.amount_paid, cur)}</td>
            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>
              {Number(r.amount_refunded) > 0 ? <span className="text-[#A66B00]">−{formatMoney(r.amount_refunded, cur)}</span> : <Dash />}
            </td>
            <td className={`${td} text-right tabular-nums text-[#535359] whitespace-nowrap`}>
              {r.fee != null ? formatMoney(r.fee, cur) : <Dash />}
            </td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{method || <Dash />}</td>
            <td className={td}>
              <StatusBadge status={r.status} />
              {r.failure_message && <div className="text-[#B5363A] text-[11px] mt-1 max-w-[200px]">{r.failure_message}</div>}
            </td>
            <td className={`${td} whitespace-nowrap`}>
              <span className="font-mono text-[11px] text-[#A1A1A1]">{r.stripe?.invoice_id}</span>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function PaymentSummary({ summary }) {
  if (!summary?.length) return null;
  // One chip per status and currency, e.g. "Paid · 12 · $348.00".
  return (
    <div className="flex flex-wrap gap-2">
      {summary.map((s) => (
        <div key={`${s.status}-${s.currency}`} className="rounded-[10px] bg-[#F5F7FA] px-3 py-2 text-[12px] flex items-center gap-2">
          <StatusBadge status={s.status} />
          <span className="text-[#535359]">{s.count}</span>
          <span className="text-[#252525] font-semibold tabular-nums">{formatMoney(s.amount_paid, s.currency)}</span>
          {Number(s.amount_refunded) > 0 && <span className="text-[#A66B00] tabular-nums">−{formatMoney(s.amount_refunded, s.currency)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function SuperAdminOrdersPage() {
  const [tab, setTab] = useState("shipping");
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  // Debounced search (same 400 ms / 3-char rule as Sales Analytics).
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length > 0 && trimmed.length < ORDERS_SEARCH_MIN_LENGTH) return;
    const t = setTimeout(() => {
      setSearch(trimmed);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res =
        tab === "shipping"
          ? await fetchShippingAddressesService({ search, page, limit: PAGE_LIMIT })
          : await fetchPaymentTransactionsService({ status, search, page, limit: PAGE_LIMIT });
      if (id !== reqId.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load data");
      setData(res);
    } catch (err) {
      if (id !== reqId.current) return;
      const msg = errorMessage(err, "Failed to load data");
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [tab, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const changeTab = (value) => {
    if (value === tab) return;
    setTab(value);
    setData(null);
    setStatus("all");
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  // Rows from the other tab must never render in this tab's table.
  const current = data?.view === tab ? data : null;
  const pagination = current?.pagination;
  const totalPages = Math.max(1, pagination?.total_pages || 1);
  const trimmed = searchInput.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < ORDERS_SEARCH_MIN_LENGTH;
  const filtersActive = Boolean(search) || status !== "all";
  const statusOptions = current?.status_options || DEFAULT_PAYMENT_STATUSES;

  const shell = {
    loading: loading && !current,
    updating: loading && Boolean(current),
    error,
    onRetry: load,
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="max-w-[640px]">
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Orders &amp; Payments</h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Website purchases: where to ship each device, and every payment, renewal, failed payment and refund recorded from Stripe.
        </p>
      </div>

      <SalesCard
        title={tab === "shipping" ? "Shipping addresses" : "Payment transactions"}
        subtitle={
          tab === "shipping"
            ? "Name, phone and address entered on Stripe Checkout"
            : "One row per Stripe invoice. Stripe fee is shown only when it is in the same currency as the payment."
        }
        action={<UpdatingPill show={loading && Boolean(current)} />}
      >
        <div role="tablist" aria-label="Orders view" className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(t.value)}
                className={`rounded-[10px] px-3.5 py-2 text-[12px] font-semibold transition-colors cursor-pointer ${
                  active ? "bg-[#308BF9] text-white" : "bg-[#F5F7FA] text-[#535359] hover:bg-[#EEF4FE]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "payments" && <PaymentSummary summary={current?.summary} />}

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 w-full md:w-auto md:flex-1 md:max-w-[420px]">
            <span className="text-[#535359] text-[11px] font-semibold">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tab === "shipping" ? "Search name, email, phone, city, postal code or code" : "Search name, email, invoice or code"}
              aria-label="Search"
              className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
            />
          </label>
          {tab === "payments" && (
            <label className="flex flex-col gap-1 min-w-[170px]">
              <span className="text-[#535359] text-[11px] font-semibold">Status</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                aria-label="Payment status"
                className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors cursor-pointer"
              >
                <option value="all">All</option>
                {statusOptions.map((o) => (
                  <option key={o} value={o}>
                    {humanizeStatus(o)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {tooShort && <p className="text-[#A1A1A1] text-[11px] -mt-2">Type at least {ORDERS_SEARCH_MIN_LENGTH} characters to search.</p>}

        {tab === "shipping" ? (
          <ShippingTable
            rows={current?.addresses}
            {...shell}
            emptyMessage={filtersActive ? "No addresses match this search." : "No shipping addresses recorded yet."}
          />
        ) : (
          <PaymentsTable
            rows={current?.payments}
            {...shell}
            emptyMessage={filtersActive ? "No payments match these filters." : "No payments recorded yet."}
          />
        )}

        {current && !error && (
          <SalesPagination
            page={page}
            limit={PAGE_LIMIT}
            total={pagination?.total || 0}
            totalPages={totalPages}
            disabled={loading}
            noun={tab === "shipping" ? "addresses" : "payments"}
            onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
          />
        )}
      </SalesCard>
    </div>
  );
}
