"use client";

import { formatCount, formatDate, formatMoney, formatRate } from "./salesFormat";
import { EmptyState, SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";

// Renewals & Retention, written as three plain questions, each with a ring chart:
//   1. Did people pay again?          (plans whose paid month ended in the period)
//   2. Are this period's buyers still with us?   (people who bought in the period)
//   3. How many members have we kept? (everyone ever, ignores the date filter)
// Data: overview.retention from super-admin-sales-analytics (see the backend's
// renewalsAndRetention for the exact definitions).

const GREEN = "#3FAF58";
const AMBER = "#F5A524";
const ORANGE = "#E07B39";
const RED = "#D9534F";
const TRACK = "#F0F3F7";

const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
const people = (n) => `${formatCount(n)} ${Number(n) === 1 ? "person" : "people"}`;

// Ring chart: one coloured arc per part, the headline % in the middle.
function Ring({ parts, total, center, centerLabel, ariaLabel }) {
  const size = 132;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        {total > 0 &&
          parts
            .filter((p) => p.count > 0)
            .map((p) => {
              const len = (p.count / total) * circ;
              const el = (
                <circle
                  key={p.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                >
                  <title>{`${p.label}: ${people(p.count)}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-[24px] font-bold leading-none text-[#252525] tabular-nums">{center}</span>
        <span className="text-[11px] text-[#535359] mt-1 leading-tight max-w-[80px]">{centerLabel}</span>
      </div>
    </div>
  );
}

function Legend({ parts }) {
  return (
    <ul className="flex flex-col gap-1.5 min-w-0 flex-1">
      {parts.map((p) => (
        <li key={p.key} className="flex items-center gap-2 min-w-0 text-[12px]">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
          <span className="text-[#535359] truncate">{p.label}</span>
          <span className="ml-auto text-[#252525] font-semibold tabular-nums">{formatCount(p.count)}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ tag, tagTone, question, parts, total, center, centerLabel, sentence, note, empty, footer }) {
  // Hide empty states except the main one, so the list stays short.
  const shown = parts.filter((p, i) => i === 0 || p.count > 0);
  return (
    <div className="rounded-[12px] border border-[#E1E6ED] p-4 flex flex-col gap-3 min-w-0">
      <div className="flex flex-col gap-1.5">
        <span
          className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            tagTone === "all" ? "bg-[#EEF4FF] text-[#308BF9]" : "bg-[#F0F3F7] text-[#535359]"
          }`}
        >
          {tag}
        </span>
        <div className="text-[#252525] text-[14px] font-bold leading-snug">{question}</div>
      </div>

      {empty ? (
        <p className="text-[#A1A1A1] text-[12px] py-6 text-center">{empty}</p>
      ) : (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <Ring
              parts={parts}
              total={total}
              center={center}
              centerLabel={centerLabel}
              ariaLabel={`${question} ${parts.map((p) => `${p.label} ${p.count}`).join(", ")}`}
            />
            <Legend parts={shown} />
          </div>
          <p className="text-[#252525] text-[12px] leading-relaxed">{sentence}</p>
        </>
      )}

      {note && <p className="text-[#A1A1A1] text-[11px] leading-snug">{note}</p>}
      {footer}
    </div>
  );
}

// Who cancelled in the selected dates: ring (still has access vs gone) + names.
function Cancellations({ data, rangeLabel }) {
  const total = data?.total || 0;
  const parts = [
    { key: "scheduled", label: "Leaving at month end", count: data?.scheduled || 0, color: AMBER },
    { key: "ended", label: "Already gone", count: data?.ended || 0, color: RED },
  ];
  const list = data?.list || [];

  return (
    <div className="rounded-[12px] border border-[#E1E6ED] p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <span className="self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#F0F3F7] text-[#535359]">
            {rangeLabel}
          </span>
          <div className="text-[#252525] text-[14px] font-bold leading-snug">Who cancelled in these dates?</div>
        </div>
        <a
          href="/super-admin/orders?tab=cancellations"
          className="text-[12px] font-semibold text-[#308BF9] hover:underline whitespace-nowrap"
        >
          See all cancellations →
        </a>
      </div>

      {!total ? (
        <p className="text-[#A1A1A1] text-[12px] py-6 text-center">Nobody cancelled in these dates. 🎉</p>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 min-w-0">
          <div className="flex flex-col gap-3 lg:w-[320px] shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <Ring
                parts={parts}
                total={total}
                center={formatCount(total)}
                centerLabel="cancelled"
                ariaLabel={`Cancellations: ${parts.map((p) => `${p.label} ${p.count}`).join(", ")}`}
              />
              <Legend parts={parts} />
            </div>
            <p className="text-[#252525] text-[12px] leading-relaxed">
              <b>{people(total)}</b> cancelled in these dates.{" "}
              {data.scheduled > 0 && (
                <>
                  <b>{formatCount(data.scheduled)}</b> can still use it until their paid month ends, so there is still time to win
                  them back.
                </>
              )}
            </p>
          </div>

          <div className="flex-1 min-w-0 rounded-[10px] border border-[#E1E6ED] overflow-hidden">
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC] text-[#535359] sticky top-0">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Member</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Cancelled on</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Access until</th>
                    <th className="text-left font-semibold px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="border-t border-[#F0F3F7]">
                      <td className="px-3 py-2 min-w-[160px]">
                        <div className="text-[#252525] font-semibold truncate">{c.name || c.email || "—"}</div>
                        {c.name && c.email && <div className="text-[#A1A1A1] text-[11px] truncate">{c.email}</div>}
                      </td>
                      <td className="px-3 py-2 text-[#535359] whitespace-nowrap">{formatDate(c.canceled_at)}</td>
                      <td className="px-3 py-2 text-[#535359] whitespace-nowrap">{formatDate(c.access_ends)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                            c.state === "scheduled" ? "bg-[#FFF6E5] text-[#B7791F]" : "bg-[#FDECEC] text-[#C0392B]"
                          }`}
                        >
                          {c.state === "scheduled" ? "Leaving at month end" : "Already gone"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > list.length && (
              <div className="border-t border-[#F0F3F7] px-3 py-2 text-[11px] text-[#A1A1A1]">
                Showing the newest {formatCount(list.length)} of {formatCount(total)}. Use “See all cancellations” for the rest.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesRetention({ retention, currency, rangeLabel, loading, updating, error, onRetry }) {
  const r = retention?.renewals;
  const c = retention?.cohort;
  const m = retention?.members;

  // Box 1 — renewals due in the period.
  const renewParts = r
    ? [
        { key: "renewed", label: "Paid again", count: r.renewed, color: GREEN },
        { key: "pending", label: "Payment not in yet", count: r.pending, color: AMBER },
        { key: "cancelled", label: "Cancelled, won't renew", count: r.cancelled || 0, color: ORANGE },
        { key: "lapsed", label: "Did not pay, left", count: r.lapsed, color: RED },
      ]
    : [];

  // Boxes 2 and 3 — "still with us" = everyone who has not ended (same rule as the backend's retention_rate).
  const stateParts = (o) => [
    { key: "active", label: "Still subscribed", count: o?.active || 0, color: GREEN },
    { key: "cancelling", label: "Leaving at month end", count: o?.cancellation_scheduled || 0, color: AMBER },
    { key: "at_risk", label: "Card failed, retrying", count: o?.at_risk || 0, color: ORANGE },
    { key: "ended", label: "Left", count: o?.ended || 0, color: RED },
  ];
  const cTotal = c?.purchases || 0;
  const cKept = cTotal - (c?.ended || 0);
  const mTotal = m?.total || 0;
  const mKept = mTotal - (m?.ended || 0);

  return (
    <SalesCard
      title="Renewals & Retention"
      subtitle="Are customers staying and paying again? Hover a ring for details."
      action={<UpdatingPill show={updating} />}
    >
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
        </div>
      ) : !retention ? (
        <EmptyState message="Renewal and retention data is not available yet. It appears once the backend update is deployed." />
      ) : (
        <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Block
            tag={rangeLabel}
            question="Did people pay again when their month ended?"
            parts={renewParts}
            total={r?.due || 0}
            center={formatRate(r?.renewal_rate)}
            centerLabel="paid again"
            empty={
              !r
                ? "Renewal payments are not recorded on this environment yet."
                : !r.due
                  ? "Nobody's paid month ended in these dates, and nobody due later has cancelled."
                  : null
            }
            sentence={
              r?.due ? (
                <>
                  <b>{formatCount(r.renewed)} of {people(r.due)}</b> whose paid month was up in these dates paid for the next one.
                  {r.cancelled > 0 && (
                    <>
                      {" "}
                      <b>{formatCount(r.cancelled)}</b> already cancelled, so they won&apos;t pay again even though their month
                      is not over yet.
                    </>
                  )}
                </>
              ) : null
            }
            footer={
              r && r.payments > 0 ? (
                <div className="rounded-[8px] bg-[#F6FBF7] px-3 py-2 text-[12px] text-[#252525]">
                  Money from renewals: <b>{formatMoney(r.net_sales, currency)}</b>
                  <span className="text-[#535359]"> ({formatRate(r.share_of_sales)} of all money collected)</span>
                </div>
              ) : null
            }
          />

          <Block
            tag={rangeLabel}
            question="Are the people who bought in these dates still with us?"
            parts={stateParts(c)}
            total={cTotal}
            center={formatRate(pct(cKept, cTotal))}
            centerLabel="still with us"
            empty={cTotal ? null : "Nobody bought in these dates."}
            sentence={
              <>
                <b>{formatCount(cKept)} of {people(cTotal)}</b> who bought in these dates are still with us today.
              </>
            }
          />

          <Block
            tag="All time"
            tagTone="all"
            question="Of everyone who ever bought, how many have we kept?"
            parts={stateParts(m)}
            total={mTotal}
            center={formatRate(pct(mKept, mTotal))}
            centerLabel="kept"
            empty={mTotal ? null : "No members yet."}
            sentence={
              <>
                <b>{formatCount(mKept)} of {people(mTotal)}</b> who ever bought still have access. {formatCount(m?.ended)} have left.
              </>
            }
            note="This box always counts everyone, so it does not change with the dates above."
          />
          </div>
          {retention.cancellations && <Cancellations data={retention.cancellations} rangeLabel={rangeLabel} />}
        </div>
      )}
    </SalesCard>
  );
}
