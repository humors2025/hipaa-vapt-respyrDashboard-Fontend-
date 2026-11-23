"use client";

import Link from "next/link";
import { formatCount, formatDate, formatMoney, formatRate } from "../salesFormat";
import { Bone, C, ErrorBox, Panel, PanelHeader, UpdatingDot } from "./ui";

// Renewals & Retention: did people pay again (selected dates), how many have we
// kept (all time), and who cancelled (selected dates). Data: overview.retention
// (see the backend's renewalsAndRetention for the definitions).

const AMBER = "#F5A524";
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

function Column({ title, gradient, tag, children, footer, className = "" }) {
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <div className="px-6 py-3.5" style={{ background: gradient }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-white tracking-[-0.26px]">{title}</span>
          <span className="text-[10px] font-semibold text-white/85 tracking-[0.3px] bg-white/20 px-2 py-0.5 rounded-[4px] uppercase whitespace-nowrap">{tag}</span>
        </div>
      </div>
      <div className="px-6 pt-6 pb-5 flex flex-col flex-1">{children}</div>
      {footer}
    </div>
  );
}

function Headline({ value, word }) {
  return (
    <div>
      <span className="text-[36px] font-bold text-[#252525] tracking-[-1.1px] leading-none tabular-nums">{value}</span>
      <span className="text-[12px] text-[#738298] tracking-[-0.24px] ml-2">{word}</span>
    </div>
  );
}

// Thin stacked bar + the matching list. Parts with a zero count are hidden from
// the list unless `always` is set.
function Breakdown({ parts }) {
  const shown = parts.filter((p) => p.always || p.count > 0);
  return (
    <>
      <div className="w-full h-2 rounded-[4px] flex overflow-hidden gap-[2px] mt-4 bg-[#E1E6ED]/20">
        {parts
          .filter((p) => p.count > 0)
          .map((p) => (
            <div key={p.key} style={{ flex: p.count, backgroundColor: p.color }} title={`${p.label}: ${p.count}`} />
          ))}
      </div>
      <div className="w-full mt-4 flex flex-col gap-2">
        {shown.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
              <span className="text-[12px] text-[#535359] tracking-[-0.24px] truncate">{p.label}</span>
            </div>
            <span className="text-[14px] font-bold text-[#252525] tracking-[-0.28px] tabular-nums">{formatCount(p.count)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const Note = ({ children }) => <p className="text-[11px] text-[#738298] tracking-[-0.22px] leading-normal mt-auto pt-3">{children}</p>;
const EmptyNote = ({ children }) => <p className="text-[12px] text-[#A1A1A1] py-8 text-center">{children}</p>;

// Failed renewal payments (all time, newest first), from Orders' view=failed_renewals.
// failed: useFailedRenewals() state from the page.
function FailedColumn({ failed }) {
  const f = failed?.data;
  const parts = [
    { key: "declined", label: "Card declined", count: f?.declined || 0, color: C.red, always: true },
    { key: "pending", label: "Not paid yet", count: f?.pending || 0, color: C.orange, always: true },
  ];
  const rows = f?.rows || [];
  return (
    <Column
      title="Failed renewals"
      gradient="linear-gradient(135deg, #f0a04b 0%, #e48326 100%)"
      tag="All time"
      className="border-t xl:border-t-0 border-[#E1E6ED]"
      footer={
        <div className="px-6 py-3 border-t border-[#E1E6ED]">
          <Link href="/super-admin/orders?tab=failed" className="text-[12px] font-semibold text-[#308BF9] tracking-[-0.24px] hover:underline">
            See all failed renewals →
          </Link>
        </div>
      }
    >
      {failed?.loading ? (
        <Bone className="h-[220px]" />
      ) : !f ? (
        <EmptyNote>Could not load the failed renewals from Orders.</EmptyNote>
      ) : (
        <>
          <Headline value={formatCount(f.count)} word="failed" />
          <Breakdown parts={parts} />
          {!f.count ? (
            <Note>No renewal payment has failed.</Note>
          ) : (
            <div className="mt-4 flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
              {rows.map((r) => {
                const declined = r.state === "failed";
                const reason = r.reason?.label || r.reason?.message || r.failure_message;
                return (
                  <div key={r.id} className="w-full p-3 rounded-[8px] bg-[#F5F7FA] border border-[#E1E6ED]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#252525] tracking-[-0.24px] truncate">
                          {r.customer?.name || r.customer?.email || "—"}
                        </div>
                        {r.customer?.name && r.customer?.email && <div className="text-[10px] text-[#738298] truncate">{r.customer.email}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap ${
                            declined ? "text-[#E74C3C] bg-[#E74C3C]/[0.08]" : "text-[#B7791F] bg-[#FFF6E5]"
                          }`}
                        >
                          {declined ? "Declined" : "Not paid yet"}
                        </span>
                        {r.amount_due && (
                          <span className="text-[11px] font-semibold text-[#252525] tabular-nums">
                            {formatMoney(r.amount_due.amount, r.amount_due.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    {reason && <div className="text-[10px] font-medium text-[#E74C3C] mt-1 break-words">{reason}</div>}
                    <div className="flex gap-2 mt-1.5 text-[10px] text-[#738298] flex-wrap">
                      <span>Failed: {formatDate(r.failed_at)}</span>
                      {r.next_retry_at && (
                        <>
                          <span>·</span>
                          <span>Retry: {formatDate(r.next_retry_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {f.count > rows.length && (
                <p className="text-[10px] text-[#A1A1A1]">
                  Showing the newest {formatCount(rows.length)} of {formatCount(f.count)}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Column>
  );
}

export default function SalesRetentionPanel({ retention, currency, periodTag, failedRenewals, loading, updating, error, onRetry }) {
  const r = retention?.renewals;
  const m = retention?.members;
  const cx = retention?.cancellations;

  const renewParts = [
    { key: "renewed", label: "Paid again", count: r?.renewed || 0, color: C.green, always: true },
    { key: "pending", label: "Pending", count: r?.pending || 0, color: C.orange, always: true },
    { key: "cancelled", label: "Cancelled, won't renew", count: r?.cancelled || 0, color: "#B7791F" },
    { key: "lapsed", label: "Left", count: r?.lapsed || 0, color: C.red, always: true },
  ];

  const mTotal = m?.total || 0;
  const keepParts = [
    { key: "active", label: "Subscribed", count: m?.active || 0, color: C.green, always: true },
    { key: "cancelling", label: "Leaving at month end", count: m?.cancellation_scheduled || 0, color: AMBER },
    { key: "at_risk", label: "Card failed", count: m?.at_risk || 0, color: C.orange, always: true },
    { key: "ended", label: "Left", count: m?.ended || 0, color: C.red, always: true },
  ];

  const cancelParts = [
    { key: "scheduled", label: "Month end", count: cx?.scheduled || 0, color: C.orange, always: true },
    { key: "ended", label: "Already gone", count: cx?.ended || 0, color: C.red, always: true },
  ];
  const list = cx?.list || [];

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        className="px-6 sm:px-8 pt-7 pb-5"
        title="Renewals & Retention"
        subtitle="Are customers staying and paying again?"
        action={<UpdatingDot show={updating} />}
      />

      {error ? (
        <div className="px-6 sm:px-8 pb-6">
          <ErrorBox message={error} onRetry={onRetry} />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 px-6 sm:px-8 pb-6">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-[300px]" />
          ))}
        </div>
      ) : !retention ? (
        <div className="px-6 sm:px-8 pb-6">
          <EmptyNote>Renewal and retention data is not available on this environment yet.</EmptyNote>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 border-t border-[#E1E6ED]">
          {/* Renewals in the selected dates */}
          <Column
            title="Renewals"
            gradient="linear-gradient(135deg, #4ece68 0%, #3faf58 100%)"
            tag={periodTag}
            className="lg:border-r border-[#E1E6ED]"
            footer={
              r && r.payments > 0 ? (
                <div className="bg-[#F5F7FA] px-6 py-3 border-t border-[#E1E6ED]">
                  <span className="text-[11px] text-[#535359] tracking-[-0.22px]">
                    Revenue: <strong>{formatMoney(r.net_sales, currency)}</strong> · {formatRate(r.share_of_sales)} of total
                  </span>
                </div>
              ) : null
            }
          >
            {!r ? (
              <EmptyNote>Renewal payments are not recorded on this environment yet.</EmptyNote>
            ) : !r.due ? (
              <EmptyNote>Nobody&apos;s paid month ended in these dates.</EmptyNote>
            ) : (
              <>
                <Headline value={formatRate(r.renewal_rate)} word="paid again" />
                <Breakdown parts={renewParts} />
                <Note>
                  <strong>
                    {formatCount(r.renewed)}/{formatCount(r.due)}
                  </strong>{" "}
                  whose paid month was up paid for the next month
                </Note>
              </>
            )}
          </Column>

          {/* Everyone who ever bought */}
          <Column
            title="Retention"
            gradient="linear-gradient(135deg, #4da3ff 0%, #308bf9 100%)"
            tag="All time"
            className="xl:border-r border-t lg:border-t-0 border-[#E1E6ED]"
            footer={
              <div className="bg-[#F5F7FA] px-6 py-3 border-t border-[#E1E6ED]">
                <span className="text-[11px] text-[#738298] tracking-[-0.22px] italic">Counts everyone, not filtered by dates</span>
              </div>
            }
          >
            {!mTotal ? (
              <EmptyNote>No members yet.</EmptyNote>
            ) : (
              <>
                <Headline value={formatRate(pct(m.active || 0, mTotal))} word="kept" />
                <Breakdown parts={keepParts} />
                <Note>
                  <strong>
                    {formatCount(m.active || 0)}/{formatCount(mTotal)}
                  </strong>{" "}
                  total buyers still subscribed
                </Note>
              </>
            )}
          </Column>

          {/* Who cancelled in the selected dates */}
          <Column
            title="Cancellations"
            gradient="linear-gradient(135deg, #f07056 0%, #e74c3c 100%)"
            tag={periodTag}
            className="lg:border-r border-t xl:border-t-0 border-[#E1E6ED]"
            footer={
              <div className="px-6 py-3 border-t border-[#E1E6ED]">
                <Link href="/super-admin/orders?tab=cancellations" className="text-[12px] font-semibold text-[#308BF9] tracking-[-0.24px] hover:underline">
                  See all cancellations →
                </Link>
              </div>
            }
          >
            {!cx ? (
              <EmptyNote>Cancellations are not available on this environment yet.</EmptyNote>
            ) : (
              <>
                <Headline value={formatCount(cx.total || 0)} word="cancelled" />
                <Breakdown parts={cancelParts} />
                {!cx.total ? (
                  <Note>Nobody cancelled in these dates.</Note>
                ) : (
                  <div className="mt-4 flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                    {list.map((c) => (
                      <div key={c.id || c.email} className="w-full p-3 rounded-[8px] bg-[#F5F7FA] border border-[#E1E6ED]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-[#252525] tracking-[-0.24px] truncate">{c.name || c.email || "—"}</div>
                            {c.name && c.email && <div className="text-[10px] text-[#738298] truncate">{c.email}</div>}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap ${
                              c.state === "scheduled" ? "text-[#B7791F] bg-[#FFF6E5]" : "text-[#E74C3C] bg-[#E74C3C]/[0.08]"
                            }`}
                          >
                            {c.state === "scheduled" ? "Month end" : "Already gone"}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-1.5 text-[10px] text-[#738298] flex-wrap">
                          <span>Left: {formatDate(c.canceled_at)}</span>
                          <span>·</span>
                          <span>Until: {formatDate(c.access_ends)}</span>
                        </div>
                      </div>
                    ))}
                    {cx.total > list.length && (
                      <p className="text-[10px] text-[#A1A1A1]">
                        Showing the newest {formatCount(list.length)} of {formatCount(cx.total)}.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </Column>

          <FailedColumn failed={failedRenewals} />
        </div>
      )}
    </Panel>
  );
}
