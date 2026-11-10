"use client";

import { formatCount, formatMoney, formatRate } from "./salesFormat";
import { EmptyState, SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";

// Renewals & Retention, every figure as a percentage with its count beside it.
// Data: overview.retention from super-admin-sales-analytics (see the backend's
// renewalsAndRetention for the exact definitions).

const STATE_COLORS = {
  renewed: "#3FAF58",
  active: "#3FAF58",
  pending: "#F5A524",
  cancellation_scheduled: "#F5A524",
  at_risk: "#E07B39",
  lapsed: "#D9534F",
  ended: "#D9534F",
};

// One horizontal bar split into segments, with a legend of % and counts.
function StackedBreakdown({ label, parts, total }) {
  const shown = parts.filter((p) => p.count > 0);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-2.5 w-full rounded-full bg-[#F0F3F7] overflow-hidden"
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.label} ${formatRate(p.rate)}`).join(", ")}`}
      >
        {total > 0 &&
          shown.map((p) => (
            <div key={p.key} className="h-full" style={{ width: `${(p.count / total) * 100}%`, backgroundColor: STATE_COLORS[p.key] }} />
          ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 min-w-0 text-[11px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATE_COLORS[p.key] }} aria-hidden="true" />
            <span className="text-[#535359] truncate" title={p.hint}>
              {p.label}
            </span>
            <span className="ml-auto text-[#252525] font-semibold tabular-nums">{formatRate(p.rate)}</span>
            <span className="text-[#A1A1A1] tabular-nums w-[34px] text-right">{formatCount(p.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Block({ title, hint, headline, headlineLabel, sub, children }) {
  return (
    <div className="rounded-[12px] border border-[#E1E6ED] p-4 flex flex-col gap-3 min-w-0">
      <div>
        <div className="text-[#252525] text-[13px] font-bold">{title}</div>
        <div className="text-[#A1A1A1] text-[11px]">{hint}</div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[26px] font-bold leading-none text-[#252525] tabular-nums">{headline}</span>
        <span className="text-[#535359] text-[12px]">{headlineLabel}</span>
      </div>
      {sub && <div className="text-[#535359] text-[11px] leading-snug">{sub}</div>}
      {children}
    </div>
  );
}

export default function SalesRetention({ retention, currency, rangeLabel, loading, updating, error, onRetry }) {
  const r = retention?.renewals;
  const c = retention?.cohort;
  const m = retention?.members;

  return (
    <SalesCard
      title="Renewals & Retention"
      subtitle={`Renewal rate for plans that came up for renewal during ${rangeLabel}, and how many members are still with us`}
      action={<UpdatingPill show={updating} />}
    >
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Skeleton className="h-[180px]" />
          <Skeleton className="h-[180px]" />
          <Skeleton className="h-[180px]" />
        </div>
      ) : !retention ? (
        <EmptyState message="Renewal and retention data is not available yet. It appears once the backend update is deployed." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {r ? (
            <Block
              title="Renewal rate"
              hint="Billing periods that ended in this period"
              headline={formatRate(r.renewal_rate)}
              headlineLabel={`renewed (${formatCount(r.renewed)} of ${formatCount(r.due)})`}
              sub={
                <>
                  Renewal revenue <span className="font-semibold text-[#252525]">{formatMoney(r.net_sales, currency)}</span> from{" "}
                  {formatCount(r.payments)} renewal payment{r.payments === 1 ? "" : "s"} ·{" "}
                  <span className="font-semibold text-[#252525]">{formatRate(r.share_of_sales)}</span> of all money collected
                </>
              }
            >
              {r.due > 0 ? (
                <StackedBreakdown
                  label="Renewals due"
                  total={r.due}
                  parts={[
                    { key: "renewed", label: "Renewed", count: r.renewed, rate: r.renewal_rate, hint: "A paid renewal followed" },
                    { key: "pending", label: "Pending", count: r.pending, rate: r.pending_rate, hint: "Plan still live, renewal not paid yet" },
                    { key: "lapsed", label: "Lapsed", count: r.lapsed, rate: r.lapse_rate, hint: "Plan ended without renewing" },
                  ]}
                />
              ) : (
                <p className="text-[#A1A1A1] text-[11px]">No plans came up for renewal in this period.</p>
              )}
            </Block>
          ) : (
            <Block title="Renewal rate" hint="Billing periods that ended in this period" headline="—" headlineLabel="">
              <p className="text-[#A1A1A1] text-[11px]">Renewal payments are not recorded on this environment yet.</p>
            </Block>
          )}

          <Block
            title="This period's buyers today"
            hint="Purchases made in this period, by where they stand now"
            headline={formatRate(c?.active_rate)}
            headlineLabel={`still active (${formatCount(c?.active)} of ${formatCount(c?.purchases)})`}
          >
            {c?.purchases > 0 ? (
              <StackedBreakdown
                label="This period's buyers"
                total={c.purchases}
                parts={[
                  { key: "active", label: "Active", count: c.active, rate: c.active_rate, hint: "Active and renewing" },
                  { key: "cancellation_scheduled", label: "Cancelling", count: c.cancellation_scheduled, rate: c.cancellation_scheduled_rate, hint: "Cancelled; access until period end" },
                  { key: "at_risk", label: "Payment issue", count: c.at_risk, rate: c.at_risk_rate, hint: "Renewal payment failed; Stripe is retrying" },
                  { key: "ended", label: "Ended", count: c.ended, rate: c.ended_rate, hint: "Cancelled or expired" },
                ]}
              />
            ) : (
              <p className="text-[#A1A1A1] text-[11px]">No purchases in this period.</p>
            )}
          </Block>

          <Block
            title="Overall retention"
            hint="Every paid membership sold so far (not limited to this period)"
            headline={formatRate(m?.retention_rate)}
            headlineLabel={`retained · ${formatRate(m?.churn_rate)} churned`}
            sub={`${formatCount((m?.total || 0) - (m?.ended || 0))} of ${formatCount(m?.total)} members still have access`}
          >
            {m?.total > 0 && (
              <StackedBreakdown
                label="All members"
                total={m.total}
                parts={[
                  { key: "active", label: "Active", count: m.active, rate: m.active_rate, hint: "Active and renewing" },
                  { key: "cancellation_scheduled", label: "Cancelling", count: m.cancellation_scheduled, rate: m.cancellation_scheduled_rate, hint: "Cancelled; access until period end" },
                  { key: "at_risk", label: "Payment issue", count: m.at_risk, rate: m.at_risk_rate, hint: "Renewal payment failed; Stripe is retrying" },
                  { key: "ended", label: "Churned", count: m.ended, rate: m.ended_rate, hint: "Cancelled or expired" },
                ]}
              />
            )}
          </Block>
        </div>
      )}
    </SalesCard>
  );
}
