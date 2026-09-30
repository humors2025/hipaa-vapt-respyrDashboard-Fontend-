"use client";

import { formatCount, formatDate, formatMoney } from "./salesFormat";
import { EmptyState, SectionError, Skeleton, SourceBadge, StatusBadge } from "./SalesUi";

const COLUMNS = [
  { label: "Purchase Date" },
  { label: "Customer" },
  { label: "Source", trainer: true },
  { label: "Trainer", trainer: true },
  { label: "Trainer Code", trainer: true },
  { label: "Referral Code" },
  { label: "Gross", align: "right" },
  { label: "Discount", align: "right" },
  { label: "Net", align: "right" },
  { label: "Subscription" },
  { label: "Payment" },
  { label: "", sr: "Actions" },
];

// Page list with ellipses: 1 … 4 5 6 … 19
function pageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export function SalesPagination({ page, limit, total, totalPages, onPageChange, disabled, noun = "purchases" }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const btn =
    "min-w-[32px] h-8 px-2.5 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-[#A1A1A1] text-[12px]">
        Showing {formatCount(from)}–{formatCount(to)} of {formatCount(total)} {noun}
      </span>
      <nav aria-label={`${noun} pages`} className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          className={`${btn} border border-[#E1E6ED] text-[#535359] hover:bg-[#F5F7FA]`}
        >
          Previous
        </button>
        {pageItems(page, totalPages).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="px-1 text-[#A1A1A1] text-[12px]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={disabled}
              aria-current={p === page ? "page" : undefined}
              className={`${btn} ${p === page ? "bg-[#308BF9] text-white" : "text-[#535359] hover:bg-[#F5F7FA]"}`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className={`${btn} border border-[#E1E6ED] text-[#535359] hover:bg-[#F5F7FA]`}
        >
          Next
        </button>
      </nav>
    </div>
  );
}

const Dash = () => <span className="text-[#A1A1A1]">—</span>;

// hideTrainer: used inside a single trainer's popup, where source/trainer/code repeat on every row.
export default function PurchaseTable({ rows, loading, updating, error, onRetry, onSelect, emptyMessage, hideTrainer = false }) {
  const columns = hideTrainer ? COLUMNS.filter((c) => !c.trainer) : COLUMNS;
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

  if (!rows?.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="relative overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      <table className={`w-full text-[12px] ${hideTrainer ? "min-w-[860px]" : "min-w-[1100px]"} transition-opacity ${updating ? "opacity-50" : "opacity-100"}`} aria-busy={updating}>
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">
            {columns.map((c, i) => (
              <th key={i} scope="col" className={`py-2.5 px-2.5 font-semibold whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}>
                {c.sr ? <span className="sr-only">{c.sr}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const cur = r.currency;
            const discount = Number(r.discount_amount) || 0;
            return (
              <tr
                key={r.purchase_id || i}
                onClick={() => onSelect(r)}
                className="border-t border-[#F5F7FA] align-top hover:bg-[#FAFBFD] cursor-pointer transition-colors"
              >
                <td className="py-2.5 px-2.5 text-[#535359] whitespace-nowrap">{formatDate(r.purchased_at, true)}</td>
                <td className="py-2.5 px-2.5 max-w-[190px]">
                  <div className="text-[#252525] font-semibold truncate">{r.customer?.name || "—"}</div>
                  {r.customer?.email && <div className="text-[#A1A1A1] text-[11px] truncate">{r.customer.email}</div>}
                </td>
                {!hideTrainer && (
                  <>
                    <td className="py-2.5 px-2.5">
                      <SourceBadge source={r.purchase_source} />
                    </td>
                    <td className="py-2.5 px-2.5 max-w-[190px]">
                      {r.purchase_source === "trainer_code" && (r.trainer?.name || r.trainer?.email) ? (
                        <>
                          <div className="text-[#535359] font-semibold truncate">{r.trainer.name || "—"}</div>
                          {r.trainer.email && <div className="text-[#A1A1A1] text-[11px] truncate">{r.trainer.email}</div>}
                        </>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      {r.attributed_partner_code ? <span className="font-mono text-[11px] text-[#535359]">{r.attributed_partner_code}</span> : <Dash />}
                    </td>
                  </>
                )}
                <td className="py-2.5 px-2.5 whitespace-nowrap">
                  {r.purchase_code ? <span className="font-mono text-[11px] text-[#535359]">{r.purchase_code}</span> : <Dash />}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums text-[#535359] whitespace-nowrap">{formatMoney(r.gross_amount, cur)}</td>
                <td className="py-2.5 px-2.5 text-right tabular-nums whitespace-nowrap">
                  {discount > 0 ? <span className="text-[#A66B00]">−{formatMoney(discount, cur)}</span> : <Dash />}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums text-[#252525] font-semibold whitespace-nowrap">{formatMoney(r.net_amount, cur)}</td>
                <td className="py-2.5 px-2.5">
                  <StatusBadge status={r.subscription_status} />
                </td>
                <td className="py-2.5 px-2.5">
                  <StatusBadge status={r.payment_status} />
                </td>
                <td className="py-1.5 px-2 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(r);
                    }}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] text-[#A1A1A1] hover:bg-[#EEF4FE] hover:text-[#308BF9] transition-colors cursor-pointer"
                    aria-label={`View details for ${r.customer?.name || "purchase"}`}
                    title="View details"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
