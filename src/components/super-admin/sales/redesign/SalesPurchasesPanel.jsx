"use client";

import { formatCount, formatDate, formatMoney, humanizeStatus } from "../salesFormat";
import { Bone, C, CodeChip, Empty, ErrorBox, Pager, Panel, PanelHeader, SearchBox, UpdatingDot } from "./ui";

// Purchase Details for the selected dates. Paging, search and filters run on the
// server (view=purchases); the page owns that state and passes it in.
// Clicking a row opens PurchaseDetailsDrawer.

const SOURCES = [
  { value: "all", label: "All" },
  { value: "website", label: "Direct Website" },
  { value: "trainer_code", label: "Trainer Code" },
];

const SUB_TONE = {
  active: "text-[#0D9488] bg-[#E0F7F4]",
  trialing: "text-[#308BF9] bg-[#E9F3FF]",
  upcoming: "text-[#308BF9] bg-[#E9F3FF]",
  expired: "text-[#E48326] bg-[#FFF3E6]",
  cancellation_scheduled: "text-[#E48326] bg-[#FFF3E6]",
  past_due: "text-[#E48326] bg-[#FFF3E6]",
  cancelled: "text-[#E74C3C] bg-[#FDE8E8]",
  canceled: "text-[#E74C3C] bg-[#FDE8E8]",
};
const PAY_TONE = {
  paid: "text-[#3FAF58] bg-[#EAFFEF]",
  refunded: "text-[#E74C3C] bg-[#FDE8E8]",
  partially_refunded: "text-[#E48326] bg-[#FFF3E6]",
  failed: "text-[#E74C3C] bg-[#FDE8E8]",
  unpaid: "text-[#E74C3C] bg-[#FDE8E8]",
};

function Pill({ status, tones }) {
  if (!status) return <span className="text-[#A1A1A1]">—</span>;
  const cls = tones[String(status).toLowerCase()] || "text-[#738298] bg-[#F5F7FA]";
  return <span className={`text-[10px] font-medium px-2 py-[3px] rounded-[4px] whitespace-nowrap ${cls}`}>{humanizeStatus(status)}</span>;
}

const ARROW_BG =
  "bg-[url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23738298' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")] bg-no-repeat bg-[position:right_10px_center]";

function StatusSelect({ prefix, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`${prefix} status`}
      className={`h-9 pl-3 pr-7 rounded-[8px] border border-[#E1E6ED] bg-[#F5F7FA] text-[11px] font-medium text-[#535359] tracking-[-0.22px] cursor-pointer appearance-none focus:outline-none focus:border-[#308BF9] ${ARROW_BG}`}
    >
      <option value="all">{prefix}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {humanizeStatus(o)}
        </option>
      ))}
    </select>
  );
}

const HEADERS = [
  "Purchase Date",
  "Customer",
  "Source",
  "Trainer",
  "Trainer Code",
  "Referral Code",
  "Gross",
  "Discount",
  "Net",
  "Subscription",
  "Payment",
  "",
];
const RIGHT = new Set(["Gross", "Discount", "Net"]);

export default function SalesPurchasesPanel({
  rangeLabel,
  data,
  loading,
  error,
  onRetry,
  onSelect,
  source,
  onSourceChange,
  search,
  onSearchChange,
  searchMinLength,
  subscriptionStatus,
  onSubscriptionStatusChange,
  paymentStatus,
  onPaymentStatusChange,
  subscriptionOptions,
  paymentOptions,
  page,
  pageSize,
  onPageChange,
  filtersActive,
}) {
  const rows = data?.purchases || [];
  const total = data?.pagination?.total || 0;
  const trimmed = search.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < searchMinLength;
  const updating = loading && Boolean(data);

  return (
    <Panel>
      <PanelHeader
        className="px-6 sm:px-7 pt-6"
        title="Purchase Details"
        subtitle={`Customers who purchased during ${rangeLabel}`}
        action={<UpdatingDot show={updating} />}
      />

      <div className="flex gap-2 mt-4 px-6 sm:px-7 flex-wrap" role="tablist" aria-label="Purchase source">
        {SOURCES.map((f) => {
          const active = source === f.value;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSourceChange(f.value)}
              className={`h-[30px] px-3.5 rounded-[8px] text-[11px] font-medium tracking-[-0.22px] cursor-pointer transition-colors ${
                active ? "bg-[#308BF9] text-white" : "bg-[#F5F7FA] text-[#738298] hover:text-[#252525]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="px-6 sm:px-7 pt-4 flex items-center gap-3 flex-wrap">
        <SearchBox
          className="flex-[1_1_220px] max-w-[360px]"
          value={search}
          onChange={onSearchChange}
          placeholder="Search customer, email, trainer code, referral code"
          label="Search purchases"
        />
        <div className="flex gap-2 flex-wrap">
          <StatusSelect prefix="Subscription" value={subscriptionStatus} onChange={onSubscriptionStatusChange} options={subscriptionOptions} />
          <StatusSelect prefix="Payment" value={paymentStatus} onChange={onPaymentStatusChange} options={paymentOptions} />
        </div>
        <span className="text-[11px] text-[#738298] tracking-[-0.22px] ml-auto">
          {tooShort ? `Type at least ${searchMinLength} characters to search` : `${formatCount(total)} purchase${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="px-6 sm:px-7 pt-4 pb-6">
        {error ? (
          <ErrorBox message={error} onRetry={onRetry} />
        ) : loading && !data ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Bone key={i} className="h-[48px]" />
            ))}
          </div>
        ) : (
          <>
            <div className="border border-[#E1E6ED] rounded-[12px] overflow-x-auto">
              <table className={`w-full min-w-[1180px] border-collapse transition-opacity ${updating ? "opacity-50" : ""}`} aria-busy={updating}>
                <thead>
                  <tr className="bg-[#F5F7FA]">
                    {HEADERS.map((h, i) => (
                      <th
                        key={h || i}
                        scope="col"
                        className={`px-2.5 py-3 text-[10px] font-medium text-[#738298] tracking-[-0.2px] whitespace-nowrap border-b border-[#E1E6ED] ${
                          RIGHT.has(h) ? "text-right" : "text-left"
                        }`}
                      >
                        {h || <span className="sr-only">Open</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={HEADERS.length}>
                        {filtersActive ? (
                          <Empty title="No purchases match your filters" hint="Try adjusting the search or filter criteria" />
                        ) : (
                          <Empty title="No sales found for the selected period" />
                        )}
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => {
                    const cur = r.currency;
                    const discount = Number(r.discount_amount) || 0;
                    const isTrainer = r.purchase_source === "trainer_code";
                    return (
                      <tr
                        key={r.purchase_id || i}
                        onClick={() => onSelect(r)}
                        className="border-b border-[#E1E6ED] last:border-0 cursor-pointer hover:bg-[#F5F7FA] transition-colors"
                      >
                        <td className="px-2.5 py-3 text-[11px] font-medium text-[#535359] tracking-[-0.22px] whitespace-nowrap">
                          {formatDate(r.purchased_at, true)}
                        </td>
                        <td className="px-2.5 py-3 max-w-[200px]">
                          <div className="text-[12px] font-semibold text-[#252525] tracking-[-0.24px] truncate">{r.customer?.name || "—"}</div>
                          {r.customer?.email && <div className="text-[10px] text-[#738298] mt-0.5 truncate">{r.customer.email}</div>}
                        </td>
                        <td className="px-2.5 py-3">
                          <span
                            className={`text-[10px] font-medium px-2 py-[3px] rounded-[4px] whitespace-nowrap ${
                              isTrainer ? "text-[#3FAF58] bg-[#EAFFEF]" : "text-[#308BF9] bg-[#E9F3FF]"
                            }`}
                          >
                            {isTrainer ? "Trainer Code" : r.purchase_source === "website" ? "Direct Website" : humanizeStatus(r.purchase_source)}
                          </span>
                        </td>
                        <td className="px-2.5 py-3 max-w-[200px]">
                          {isTrainer && (r.trainer?.name || r.trainer?.email) ? (
                            <>
                              <div className="text-[11px] font-medium text-[#252525] tracking-[-0.22px] truncate">{r.trainer.name || "—"}</div>
                              {r.trainer.email && <div className="text-[10px] text-[#738298] mt-0.5 truncate">{r.trainer.email}</div>}
                            </>
                          ) : (
                            <span className="text-[#A1A1A1] text-[12px]">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-3">
                          <CodeChip>{r.attributed_partner_code}</CodeChip>
                        </td>
                        <td className="px-2.5 py-3">
                          <CodeChip>{r.purchase_code}</CodeChip>
                        </td>
                        <td className="px-2.5 py-3 text-right text-[12px] font-medium text-[#535359] tabular-nums whitespace-nowrap">
                          {formatMoney(r.gross_amount, cur)}
                        </td>
                        <td className={`px-2.5 py-3 text-right text-[12px] font-semibold tabular-nums whitespace-nowrap ${discount > 0 ? "text-[#E48326]" : "text-[#A1A1A1]"}`}>
                          {discount > 0 ? `−${formatMoney(discount, cur)}` : "—"}
                        </td>
                        <td className="px-2.5 py-3 text-right text-[12px] font-bold text-[#3FAF58] tabular-nums whitespace-nowrap">
                          {formatMoney(r.net_amount, cur)}
                        </td>
                        <td className="px-2.5 py-3">
                          <Pill status={r.subscription_status} tones={SUB_TONE} />
                        </td>
                        <td className="px-2.5 py-3">
                          <Pill status={r.payment_status} tones={PAY_TONE} />
                        </td>
                        <td className="px-2.5 py-3 w-7">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.td} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={pageSize} total={total} onChange={onPageChange} disabled={loading} noun="purchases" />
          </>
        )}
      </div>
    </Panel>
  );
}
