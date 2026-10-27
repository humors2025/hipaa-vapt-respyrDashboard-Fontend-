"use client";

// Website (/order) purchases as the Stripe webhook records them:
//   Shipping    one row per purchase: who to ship the device to
//   Payments    one row per Stripe invoice: first payment, renewals, failures, refunds
//   Renewals    renewals that went through (paid; refunds still shown), with
//               which renewal each is and where the plan stands now
//   Upcoming    plans still set to renew within the next 10 days, soonest first
//   Test codes  super admin only (showTestCodes), behind its own Google
//               Authenticator unlock (same authenticator as Settings)
//
// Rendered by /super-admin/orders and, read-only, by /trainer-admin/orders for
// the trainer admins in src/lib/ordersAccess.js. The table helpers exported
// here are also used by Facility admin › Payments (FacilityPaymentsPanel.jsx).

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import {
  ORDERS_SEARCH_MIN_LENGTH,
  fetchPaymentTransactionsService,
  fetchShippingAddressesService,
  fetchTestCodesService,
  fetchUpcomingRenewalsService,
  generateTestCodesService,
  restoreSubscriptionDiscountService,
} from "@/services/superAdminOrdersService";
import { formatDate, formatMoney, humanizeStatus } from "@/components/super-admin/sales/salesFormat";
import { SalesCard, UpdatingPill, Skeleton, EmptyState, SectionError, StatusBadge } from "@/components/super-admin/sales/SalesUi";
import { SalesPagination } from "@/components/super-admin/sales/PurchaseTable";
import SettingsLockGate, { isTestCodesLocked } from "@/components/super-admin/SettingsLockGate";

const PAGE_LIMIT = 20;
const DEFAULT_PAYMENT_STATUSES = ["paid", "failed", "refunded", "partially_refunded", "open"];
const RENEWED_STATUSES = ["paid", "partially_refunded", "refunded"];
const UPCOMING_DAYS = 10;

const TABS = [
  { value: "shipping", label: "Shipping" },
  { value: "payments", label: "Payments" },
  { value: "renewals", label: "Renewals" },
  { value: "upcoming", label: "Upcoming renewals" },
  { value: "codes", label: "Test codes" },
];

const PAYMENT_TYPE_LABEL = { first_payment: "First payment", renewal: "Renewal" };

// 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd".
export function ordinal(n) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return `${n}${suffix}`;
}

function errorMessage(err, fallback) {
  return err?.data?.message || err?.message || fallback;
}

export const Dash = () => <span className="text-[#A1A1A1]">—</span>;

// Older copy path: select a hidden textarea and copy it. Used where the
// Clipboard API is missing (plain-http LAN dev URL) or refused by the browser.
function copyWithTextarea(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  try {
    ta.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

async function copyText(text, { copied, failed }) {
  let ok = false;
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // permission refused: try the older path below
    }
  }
  if (!ok) ok = copyWithTextarea(text);
  if (ok) toast.success(copied);
  else toast.error(failed);
}

// One line, ready to paste into a courier form or map search:
// "915 W Price Rd, A, Brownsville, TX 78520, US".
function addressLine(a) {
  return [a.line1, a.line2, a.city, [a.state, a.postal_code].filter(Boolean).join(" "), a.country].filter(Boolean).join(", ");
}

// What the address copy button puts on the clipboard: a block ready to paste
// into a shipping request.
//   Name: Mayra Alvarado
//   Email: mayraalvarado18@gmail.com
//   Phone: +19565170972
//   Address: 915 W Price Rd, A, Brownsville, TX 78520, US
//
//   Referred by: Meta Training, Ernesto Torres
// Referred by is the facility and its admin; the partner code when the code
// is not under a facility; left out for website purchases. Empty fields are
// left out too.
function shippingDetails(r) {
  const a = r.ship_to || {};
  const f = r.facility;
  const lines = [
    ["Name", a.name || r.customer?.name],
    ["Email", r.customer?.email],
    ["Phone", a.phone],
    ["Address", addressLine(a)],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  const referredBy = f?.name
    ? [f.name, f.admin_name || f.admin_user_id].filter(Boolean).join(", ")
    : r.partner_code;
  if (referredBy) lines.push("", `Referred by: ${referredBy}`);
  return lines.join("\n");
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Status badge + note for a shipping row. The backend already reports "expired"
// for an active plan whose current_period_end has passed; the same rule is
// applied here so the badge never says Active past the end date.
export function describePlan(r) {
  let status = String(r.subscription_status || "").toLowerCase() || null;
  const end = r.current_period_end ? new Date(r.current_period_end) : null;
  const endMs = end && !Number.isNaN(end.getTime()) ? end.getTime() : null;
  const running = status === "active" || status === "trialing" || status === "past_due";
  if (running && endMs !== null && endMs <= Date.now()) status = "expired";

  let note = null;
  if (status === "cancelled" || status === "canceled") {
    note = r.canceled_at ? { text: `Cancelled ${formatDate(r.canceled_at)}`, tone: "text-[#B5363A]" } : null;
  } else if (status === "expired" && endMs !== null) {
    note = { text: `Ended ${formatDate(r.current_period_end)}`, tone: "text-[#535359]" };
  } else if (running && endMs !== null) {
    const daysLeft = Math.ceil((endMs - Date.now()) / DAY_MS);
    note =
      daysLeft <= 7
        ? { text: `Ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, tone: "text-[#A66B00]" }
        : { text: `Renews ${formatDate(r.current_period_end)}`, tone: "text-[#A1A1A1]" };
  }
  return { status, note };
}

const th = "py-2.5 px-2.5 font-semibold whitespace-nowrap";
const td = "py-2.5 px-2.5";

export function TableShell({ loading, error, onRetry, empty, emptyMessage, updating, minWidth, head, children }) {
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

export function Customer({ customer }) {
  return (
    <>
      <div className="text-[#252525] font-semibold truncate">{customer?.name || "—"}</div>
      {customer?.email && <div className="text-[#A1A1A1] text-[11px] truncate">{customer.email}</div>}
      {customer?.profile_id && (
        <div className="font-mono text-[11px] text-[#535359] truncate">{customer.profile_id}</div>
      )}
    </>
  );
}

// Gym behind the partner code. An invited facility that was never set up has
// only the name typed on the invitation.
function FacilityName({ facility }) {
  if (!facility?.name) return <Dash />;
  return (
    <>
      <div className="text-[#252525] font-semibold break-words">{facility.name}</div>
      {facility.status === "invited" && <div className="text-[#A1A1A1] text-[11px]">Invited</div>}
    </>
  );
}

function FacilityAdmin({ facility }) {
  if (!facility?.admin_name && !facility?.admin_user_id) return <Dash />;
  return (
    <>
      <div className="text-[#252525] truncate" title={facility.admin_user_id || undefined}>
        {facility.admin_name || facility.admin_user_id}
      </div>
      {facility.admin_name && facility.admin_user_id && (
        <div className="text-[#A1A1A1] text-[11px] truncate" title={facility.admin_user_id}>
          {facility.admin_user_id}
        </div>
      )}
    </>
  );
}

function ShippingTable({ rows, ...shell }) {
  return (
    <TableShell
      {...shell}
      empty={!rows?.length}
      minWidth="min-w-[1420px]"
      head={
        <>
          <th scope="col" className={th}>Purchased</th>
          <th scope="col" className={th}>Customer</th>
          <th scope="col" className={th}>Ship to</th>
          <th scope="col" className={th}>Phone</th>
          <th scope="col" className={th}>Address</th>
          <th scope="col" className={th}>Code</th>
          <th scope="col" className={th}>Facility</th>
          <th scope="col" className={th}>Facility admin</th>
          <th scope="col" className={th}>Plan period</th>
          <th scope="col" className={th}>Subscription</th>
        </>
      }
    >
      {rows?.map((r) => {
        const a = r.ship_to || {};
        const cityLine = [a.city, a.state, a.postal_code].filter(Boolean).join(", ");
        const plan = describePlan(r);
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
                // Click anywhere on the address to copy the shipping details.
                <button
                  type="button"
                  onClick={() =>
                    copyText(shippingDetails(r), {
                      copied: "Shipping details copied",
                      failed: "Could not copy — select the address and copy manually.",
                    })
                  }
                  title="Copy name, email, phone, address and referrer"
                  aria-label={`Copy shipping details${a.name ? ` for ${a.name}` : ""}`}
                  className="group inline-flex items-start gap-1.5 text-left rounded-[8px] -mx-1.5 -my-1 px-1.5 py-1 hover:bg-[#EEF4FE] cursor-pointer transition-colors"
                >
                  <span className="min-w-0">
                    {a.line1 && <span className="block break-words">{a.line1}</span>}
                    {a.line2 && <span className="block break-words">{a.line2}</span>}
                    {(cityLine || a.country) && (
                      <span className="block text-[#A1A1A1] text-[11px]">{[cityLine, a.country].filter(Boolean).join(" · ")}</span>
                    )}
                  </span>
                  <Copy className="size-3.5 shrink-0 mt-0.5 text-[#A1A1A1] group-hover:text-[#308BF9]" aria-hidden="true" />
                </button>
              ) : (
                <Dash />
              )}
            </td>
            <td className={`${td} whitespace-nowrap`}>
              {r.partner_code ? <span className="font-mono text-[11px] text-[#535359]">{r.partner_code}</span> : <Dash />}
            </td>
            <td className={`${td} max-w-[200px]`}>
              <FacilityName facility={r.facility} />
            </td>
            <td className={`${td} max-w-[200px]`}>
              <FacilityAdmin facility={r.facility} />
            </td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>
              {r.current_period_start || r.current_period_end ? (
                <>
                  <div>{formatDate(r.current_period_start)}</div>
                  <div className="text-[#A1A1A1] text-[11px]">to {formatDate(r.current_period_end)}</div>
                </>
              ) : (
                <Dash />
              )}
            </td>
            <td className={td}>
              <StatusBadge status={plan.status} />
              {plan.note && <div className={`text-[11px] mt-1 whitespace-nowrap ${plan.note.tone}`}>{plan.note.text}</div>}
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
      minWidth="min-w-[1160px]"
      head={
        <>
          <th scope="col" className={th}>Date</th>
          <th scope="col" className={th}>Customer</th>
          <th scope="col" className={th}>Code</th>
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
            <td className={`${td} whitespace-nowrap`}>
              {r.partner_code ? <span className="font-mono text-[11px] text-[#535359]">{r.partner_code}</span> : <Dash />}
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

function RenewalsTable({ rows, ...shell }) {
  return (
    <TableShell
      {...shell}
      empty={!rows?.length}
      minWidth="min-w-[1380px]"
      head={
        <>
          <th scope="col" className={th}>Renewed</th>
          <th scope="col" className={th}>Customer</th>
          <th scope="col" className={th}>Code</th>
          <th scope="col" className={th}>Facility</th>
          <th scope="col" className={th}>Facility admin</th>
          <th scope="col" className={th}>Renewal</th>
          <th scope="col" className={th}>Billing period</th>
          <th scope="col" className={`${th} text-right`}>Paid</th>
          <th scope="col" className={th}>Method</th>
          <th scope="col" className={th}>Status</th>
          <th scope="col" className={th}>Plan now</th>
        </>
      }
    >
      {rows?.map((r) => {
        const cur = r.currency;
        const method = r.payment_method?.type
          ? `${humanizeStatus(r.payment_method.type)}${r.payment_method.last4 ? ` •••• ${r.payment_method.last4}` : ""}`
          : null;
        const plan = describePlan(r.plan || {});
        return (
          <tr key={r.id} className="border-t border-[#F5F7FA] align-top">
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{formatDate(r.date, true)}</td>
            <td className={`${td} max-w-[200px]`}>
              <Customer customer={r.customer} />
            </td>
            <td className={`${td} whitespace-nowrap`}>
              {r.partner_code ? <span className="font-mono text-[11px] text-[#535359]">{r.partner_code}</span> : <Dash />}
            </td>
            <td className={`${td} max-w-[200px]`}>
              <FacilityName facility={r.facility} />
            </td>
            <td className={`${td} max-w-[200px]`}>
              <FacilityAdmin facility={r.facility} />
            </td>
            <td className={`${td} text-[#252525] whitespace-nowrap`}>{r.renewal_number ? ordinal(r.renewal_number) : <Dash />}</td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>
              {r.period_start ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}` : <Dash />}
            </td>
            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>
              <div className="text-[#252525] font-semibold">{formatMoney(r.amount_paid, cur)}</div>
              {Number(r.amount_refunded) > 0 && <div className="text-[#A66B00] text-[11px]">−{formatMoney(r.amount_refunded, cur)} refunded</div>}
            </td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{method || <Dash />}</td>
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

// "Today" / "Tomorrow" / "In 5 days", counted in calendar days on this
// computer's clock.
function renewsIn(iso) {
  const end = iso ? new Date(iso) : null;
  if (!end || Number.isNaN(end.getTime())) return null;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(end) - startOfDay(new Date())) / DAY_MS);
  if (days <= 0) return { text: "Today", tone: "text-[#A66B00]" };
  if (days === 1) return { text: "Tomorrow", tone: "text-[#A66B00]" };
  return { text: `In ${days} days`, tone: "text-[#A1A1A1]" };
}

function UpcomingRenewalsTable({ rows, canRepair = false, ...shell }) {
  // Per-subscription repair state: "working" | "repaired" | "ok" (already had
  // its discount) — keyed by stripe_subscription_id.
  const [repairState, setRepairState] = useState({});

  const restoreDiscount = async (r) => {
    const id = r.stripe_subscription_id;
    setRepairState((s) => ({ ...s, [id]: "working" }));
    try {
      const res = await restoreSubscriptionDiscountService(id);
      if (res?.repaired) {
        setRepairState((s) => ({ ...s, [id]: "repaired" }));
        toast.success(`Discount restored — ${r.customer?.name || id} renews at the referral price.`);
      } else {
        setRepairState((s) => ({ ...s, [id]: "ok" }));
        toast.info(res?.message || "Subscription already has its discount.");
      }
    } catch (err) {
      setRepairState((s) => ({ ...s, [id]: undefined }));
      toast.error(err?.data?.message || err?.message || "Could not restore the discount.");
    }
  };

  return (
    <TableShell
      {...shell}
      empty={!rows?.length}
      minWidth="min-w-[1360px]"
      head={
        <>
          <th scope="col" className={th}>Renews on</th>
          <th scope="col" className={th}>Customer</th>
          <th scope="col" className={th}>Code</th>
          <th scope="col" className={th}>Facility</th>
          <th scope="col" className={th}>Facility admin</th>
          <th scope="col" className={th}>Renewal</th>
          <th scope="col" className={th}>Member since</th>
          <th scope="col" className={`${th} text-right`}>Last paid</th>
          <th scope="col" className={`${th} text-right`}>Renewal amount</th>
          <th scope="col" className={th}>Plan now</th>
        </>
      }
    >
      {rows?.map((r) => {
        const when = renewsIn(r.renews_at);
        const last = r.last_payment;
        const next = r.next_charge;
        const expected = r.expected_charge;
        // Stripe set to charge something other than the member's entitled
        // price (usually a dropped referral coupon) — flag it.
        const mismatch =
          next && expected && Number(next.amount) !== Number(expected.amount);
        // A discount only exists when the member's price is below list price;
        // a code purchase at list price (e.g. the $1 test plan, where list and
        // referred were equal so no coupon was ever created) has nothing to
        // restore.
        const hasRealDiscount =
          expected &&
          r.plan_price?.amount != null &&
          Number(expected.amount) < Number(r.plan_price.amount);
        return (
          <tr key={r.id} className="border-t border-[#F5F7FA] align-top">
            <td className={`${td} whitespace-nowrap`}>
              <div className="text-[#252525] font-semibold">{formatDate(r.renews_at, true)}</div>
              {when && <div className={`text-[11px] ${when.tone}`}>{when.text}</div>}
            </td>
            <td className={`${td} max-w-[200px]`}>
              <Customer customer={r.customer} />
            </td>
            <td className={`${td} whitespace-nowrap`}>
              {r.partner_code ? <span className="font-mono text-[11px] text-[#535359]">{r.partner_code}</span> : <Dash />}
            </td>
            <td className={`${td} max-w-[200px]`}>
              <FacilityName facility={r.facility} />
            </td>
            <td className={`${td} max-w-[200px]`}>
              <FacilityAdmin facility={r.facility} />
            </td>
            <td className={`${td} text-[#252525] whitespace-nowrap`}>{ordinal((Number(r.renewals_so_far) || 0) + 1)}</td>
            <td className={`${td} text-[#535359] whitespace-nowrap`}>{formatDate(r.purchased_at)}</td>
            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>
              {last ? (
                <>
                  <div className="text-[#252525] font-semibold">{formatMoney(last.amount_paid, last.currency)}</div>
                  <div className="text-[#A1A1A1] text-[11px]">
                    {PAYMENT_TYPE_LABEL[last.type] || humanizeStatus(last.type)} · {formatDate(last.date)}
                  </div>
                </>
              ) : (
                <Dash />
              )}
            </td>
            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>
              {expected ? (
                <>
                  <div className="text-[#252525] font-semibold">
                    {formatMoney(expected.amount, expected.currency)}
                  </div>
                  <div className="text-[#A1A1A1] text-[11px]">
                    {expected.discounted && hasRealDiscount ? "referral price" : "list price"}
                  </div>
                  {mismatch && (
                    <div className="text-[#A66B00] text-[11px]">
                      Stripe set to charge {formatMoney(next.amount, next.currency)}
                    </div>
                  )}
                  {canRepair && r.partner_code && hasRealDiscount && (
                    repairState[r.stripe_subscription_id] === "repaired" ? (
                      <div className="text-[#1F7A4A] text-[11px] font-semibold">Discount restored ✓</div>
                    ) : repairState[r.stripe_subscription_id] === "ok" ? (
                      <div className="text-[#A1A1A1] text-[11px]">Discount already on file</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => restoreDiscount(r)}
                        disabled={repairState[r.stripe_subscription_id] === "working"}
                        className="text-[#308BF9] text-[11px] underline underline-offset-2 hover:text-[#1D57A0] disabled:text-[#A1A1A1] disabled:no-underline cursor-pointer disabled:cursor-wait"
                      >
                        {repairState[r.stripe_subscription_id] === "working" ? "Restoring…" : "Restore discount"}
                      </button>
                    )
                  )}
                </>
              ) : next ? (
                <>
                  <div className="text-[#252525] font-semibold">{formatMoney(next.amount, next.currency)}</div>
                  <div className="text-[#A1A1A1] text-[11px]">from Stripe</div>
                </>
              ) : r.plan_price?.amount != null ? (
                <>
                  <div className="text-[#535359] font-semibold">
                    {formatMoney(r.plan_price.amount, r.plan_price.currency)}
                  </div>
                  <div className="text-[#A1A1A1] text-[11px]">list price</div>
                </>
              ) : (
                <Dash />
              )}
            </td>
            <td className={td}>{r.subscription_status ? <StatusBadge status={r.subscription_status} /> : <Dash />}</td>
          </tr>
        );
      })}
    </TableShell>
  );
}

const CODE_STATE = {
  unused: { label: "Unused", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  redeemed: { label: "Redeemed", cls: "bg-[#E5F6EE] text-[#1F7A4A]" },
  expired: { label: "Expired", cls: "bg-[#F5F7FA] text-[#535359]" },
};

function CodeStateBadge({ state }) {
  const c = CODE_STATE[state] || { label: state || "—", cls: "bg-[#F5F7FA] text-[#535359]" };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${c.cls}`}>{c.label}</span>
  );
}

function CopyableCode({ code }) {
  return (
    <button
      type="button"
      onClick={() => copyText(code, { copied: `${code} copied`, failed: "Could not copy — select the code and copy manually." })}
      title="Copy code"
      className="font-mono text-[12px] font-semibold text-[#252525] bg-[#F5F7FA] hover:bg-[#EEF4FE] rounded-[8px] px-2 py-1 cursor-pointer transition-colors"
    >
      {code}
    </button>
  );
}

function TestCodesTable({ rows, ...shell }) {
  return (
    <TableShell
      {...shell}
      empty={!rows?.length}
      emptyMessage="No test codes yet. Generate one above."
      minWidth="min-w-[880px]"
      head={
        <>
          <th scope="col" className={th}>Code</th>
          <th scope="col" className={th}>Trainer</th>
          <th scope="col" className={th}>Created</th>
          <th scope="col" className={th}>Expires</th>
          <th scope="col" className={th}>Status</th>
          <th scope="col" className={th}>Redeemed by (profile)</th>
          <th scope="col" className={th}>Redeemed</th>
        </>
      }
    >
      {rows?.map((r) => (
        <tr key={r.id} className="border-t border-[#F5F7FA] align-top">
          <td className={`${td} whitespace-nowrap`}>
            <CopyableCode code={r.code} />
          </td>
          <td className={`${td} whitespace-nowrap`}>
            {r.trainer_code ? <span className="font-mono text-[11px] text-[#535359]">{r.trainer_code}</span> : <Dash />}
          </td>
          <td className={`${td} text-[#535359] whitespace-nowrap`}>{formatDate(r.created_at, true)}</td>
          <td className={`${td} text-[#535359] whitespace-nowrap`}>{formatDate(r.expires_at)}</td>
          <td className={td}>
            <CodeStateBadge state={r.state} />
          </td>
          <td className={`${td} whitespace-nowrap`}>
            {r.redeemed_profile_id ? <span className="font-mono text-[11px] text-[#535359]">{r.redeemed_profile_id}</span> : <Dash />}
          </td>
          <td className={`${td} text-[#535359] whitespace-nowrap`}>{r.redeemed_at ? formatDate(r.redeemed_at, true) : <Dash />}</td>
        </tr>
      ))}
    </TableShell>
  );
}

// Generate panel + the codes a generate call just returned (copy them from
// here; they are also first in the table below after the reload).
function GenerateTestCodes({ onGenerated, onLocked, disabled, trainer }) {
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lastBatch, setLastBatch] = useState(null);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await generateTestCodesService({ count });
      if (res?.status === false) throw new Error(res?.message || "Failed to generate codes");
      setLastBatch(res);
      toast.success(`${res.codes.length} code${res.codes.length === 1 ? "" : "s"} generated`);
      onGenerated?.();
    } catch (err) {
      if (isTestCodesLocked(err)) return onLocked?.();
      toast.error(errorMessage(err, "Failed to generate codes"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-[#E1E6ED] bg-[#FBFCFE] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 w-[120px]">
          <span className="text-[#535359] text-[11px] font-semibold">How many</span>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Number of codes"
            className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors cursor-pointer"
          >
            {[1, 2, 3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={busy || disabled || trainer?.found === false}
          className="rounded-[10px] bg-[#308BF9] text-white px-4 py-2 text-[12px] font-semibold hover:bg-[#2578DB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {busy ? "Generating…" : "Generate codes"}
        </button>
        <p className="text-[#A1A1A1] text-[11px] mb-1">
          Each code onboards one app user for free (no payment). Codes expire in 30 days.
        </p>
      </div>
      {trainer && (trainer.found
        ? (
          <p className="text-[#535359] text-[11px]">
            Issued under <span className="font-semibold text-[#252525]">{trainer.name || trainer.email}</span>
            {trainer.name ? ` (${trainer.email})` : ""} · trainer code{" "}
            <span className="font-mono text-[#252525]">{trainer.code}</span> — whoever redeems one becomes that trainer's
            client.
          </p>
        )
        : (
          <p className="text-[#B5363A] text-[11px]">
            No active trainer account for <span className="font-semibold">{trainer.email}</span>. Test codes are issued
            under that trainer, and a code whose trainer the app can't resolve never redeems — so generating is blocked
            until the account exists.
          </p>
        ))}
      {lastBatch?.codes?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#535359] text-[11px] font-semibold">New:</span>
          {lastBatch.codes.map((c) => (
            <CopyableCode key={c} code={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// The Test codes tab once SettingsLockGate has unlocked it. It loads its own
// list so nothing is requested while the tab is still locked; a
// TEST_CODES_LOCKED answer (unlock expired) sends it back to the code screen.
function TestCodesPanel({ onLocked }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTestCodesService({ page, limit: PAGE_LIMIT });
      if (id !== reqId.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load data");
      setData(res);
    } catch (err) {
      if (id !== reqId.current) return;
      if (isTestCodesLocked(err)) return onLocked();
      const msg = errorMessage(err, "Failed to load data");
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, onLocked]);

  useEffect(() => {
    load();
  }, [load]);

  const pagination = data?.pagination;
  const totalPages = Math.max(1, pagination?.total_pages || 1);

  return (
    <>
      <GenerateTestCodes onGenerated={load} onLocked={onLocked} disabled={loading} trainer={data?.trainer} />
      <TestCodesTable
        rows={data?.codes}
        loading={loading && !data}
        updating={loading && Boolean(data)}
        error={error}
        onRetry={load}
      />
      {data && !error && (
        <SalesPagination
          page={page}
          limit={PAGE_LIMIT}
          total={pagination?.total || 0}
          totalPages={totalPages}
          disabled={loading}
          noun="codes"
          onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
        />
      )}
    </>
  );
}

export function PaymentSummary({ summary }) {
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

export default function OrdersPayments({ showTestCodes = false }) {
  const tabs = showTestCodes ? TABS : TABS.filter((t) => t.value !== "codes");
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
    setError(null);
    // TestCodesPanel loads the codes itself, after the unlock.
    if (tab === "codes") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res =
        tab === "shipping"
          ? await fetchShippingAddressesService({ search, page, limit: PAGE_LIMIT })
          : tab === "payments" || tab === "renewals"
            ? await fetchPaymentTransactionsService({
                status,
                type: tab === "renewals" ? "renewal" : "all",
                // Renewals lists members who did renew: no failed / open attempts.
                paidOnly: tab === "renewals",
                search,
                page,
                limit: PAGE_LIMIT,
              })
            : await fetchUpcomingRenewalsService({ days: UPCOMING_DAYS, search, page, limit: PAGE_LIMIT });
      if (id !== reqId.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load data");
      // Renewals come back as view "payments" and upcoming as
      // "upcoming_renewals": tag them with their tab.
      setData(tab === "renewals" || tab === "upcoming" ? { ...res, view: tab } : res);
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
  const statusOptions = current?.status_options || (tab === "renewals" ? RENEWED_STATUSES : DEFAULT_PAYMENT_STATUSES);
  // Renewals is the Payments list narrowed to paid renewal invoices: same
  // search, status filter and summary chips.
  const paymentsLike = tab === "payments" || tab === "renewals";

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
        title={
          tab === "shipping"
            ? "Shipping addresses"
            : tab === "payments"
              ? "Payment transactions"
              : tab === "renewals"
                ? "Renewals"
                : tab === "upcoming"
                  ? "Upcoming renewals"
                  : "Test onboarding codes"
        }
        subtitle={
          tab === "shipping"
            ? "Name, phone and address entered on Stripe Checkout"
            : tab === "payments"
              ? "One row per Stripe invoice. Stripe fee is shown only when it is in the same currency as the payment."
              : tab === "renewals"
                ? "Members whose plan renewed: one row per paid renewal, newest first. Failed renewal attempts are left out (see Payments). Plan now shows where the subscription stands today."
                : tab === "upcoming"
                  ? `Members whose plan renews in the next ${UPCOMING_DAYS} days, soonest first. Cancelled plans are left out. Renewal amount is the member's price: the discounted referral price when they bought with a partner code, list price otherwise.`
                  : "Free single-use codes for testing app onboarding — redeemed like a purchase code, but with no payment, sales or commission behind them."
        }
        action={<UpdatingPill show={loading && Boolean(current)} />}
      >
        <div role="tablist" aria-label="Orders view" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
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

        {paymentsLike && <PaymentSummary summary={current?.summary} />}

        {tab === "upcoming" && current && !search && (
          <div className="flex flex-wrap gap-2">
            <div className="rounded-[10px] bg-[#F5F7FA] px-3 py-2 text-[12px] flex items-center gap-2">
              <span className="text-[#252525] font-semibold tabular-nums">{pagination?.total || 0}</span>
              <span className="text-[#535359]">
                plan{pagination?.total === 1 ? "" : "s"} renewing in the next {current.filters?.days || UPCOMING_DAYS} days
              </span>
            </div>
          </div>
        )}

        {tab === "codes" && (
          <SettingsLockGate kind="testCodes">{(relock) => <TestCodesPanel onLocked={relock} />}</SettingsLockGate>
        )}

        {tab !== "codes" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 w-full md:w-auto md:flex-1 md:max-w-[420px]">
            <span className="text-[#535359] text-[11px] font-semibold">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                tab === "shipping"
                  ? "Search name, email, phone, city, postal code or code"
                  : tab === "upcoming"
                    ? "Search name, email or code"
                    : "Search name, email, invoice or code"
              }
              aria-label="Search"
              className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
            />
          </label>
          {paymentsLike && (
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
        )}
        {tab !== "codes" && tooShort && (
          <p className="text-[#A1A1A1] text-[11px] -mt-2">Type at least {ORDERS_SEARCH_MIN_LENGTH} characters to search.</p>
        )}

        {tab === "shipping" ? (
          <ShippingTable
            rows={current?.addresses}
            {...shell}
            emptyMessage={filtersActive ? "No addresses match this search." : "No shipping addresses recorded yet."}
          />
        ) : tab === "payments" ? (
          <PaymentsTable
            rows={current?.payments}
            {...shell}
            emptyMessage={filtersActive ? "No payments match these filters." : "No payments recorded yet."}
          />
        ) : tab === "renewals" ? (
          <RenewalsTable
            rows={current?.payments}
            {...shell}
            emptyMessage={filtersActive ? "No renewals match these filters." : "No renewals recorded yet."}
          />
        ) : tab === "upcoming" ? (
          <UpcomingRenewalsTable
            rows={current?.upcoming}
            canRepair={showTestCodes}
            {...shell}
            emptyMessage={
              filtersActive ? "No upcoming renewals match this search." : `No plans renew in the next ${UPCOMING_DAYS} days.`
            }
          />
        ) : null}

        {tab !== "codes" && current && !error && (
          <SalesPagination
            page={page}
            limit={PAGE_LIMIT}
            total={pagination?.total || 0}
            totalPages={totalPages}
            disabled={loading}
            noun={
              tab === "shipping" ? "addresses" : tab === "payments" ? "payments" : "renewals"
            }
            onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
          />
        )}
      </SalesCard>
    </div>
  );
}
