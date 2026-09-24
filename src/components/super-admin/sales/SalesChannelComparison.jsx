"use client";

import { SOURCE_COLORS, formatCount, formatMoney, formatPercent } from "./salesFormat";
import { SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";

const CHANNELS = [
  { key: "website", label: "Website", hint: "Direct purchases without trainer attribution" },
  { key: "trainer_code", label: "Trainer Code", hint: "Purchases attributed to a trainer / referral code" },
];

function Metric({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="text-[#252525] text-[16px] font-bold tabular-nums truncate">{value}</span>
    </div>
  );
}

export default function SalesChannelComparison({ breakdown, summary, loading, updating, error, onRetry }) {
  const currency = summary?.currency;
  const totalNet = CHANNELS.reduce((s, c) => s + (Number(breakdown?.[c.key]?.net_sales) || 0), 0);

  return (
    <SalesCard title="Sales Channel Performance" subtitle="Website and trainer-code sales side by side" action={<UpdatingPill show={updating} />}>
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CHANNELS.map((c) => {
            const b = breakdown?.[c.key] || {};
            const purchases = Number(b.purchases) || 0;
            const net = Number(b.net_sales) || 0;
            // AOV uses first payments only; renewals are in Revenue but are not purchases.
            const newNet = Number(b.new_net_sales ?? b.net_sales) || 0;
            const share = totalNet ? (net / totalNet) * 100 : 0;
            return (
              <div key={c.key} className="rounded-[12px] border border-[#E1E6ED] p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[c.key] }} aria-hidden="true" />
                  <div>
                    <div className="text-[#252525] text-[13px] font-bold">{c.label}</div>
                    <div className="text-[#A1A1A1] text-[11px]">{c.hint}</div>
                  </div>
                </div>
                {loading ? (
                  <Skeleton className="h-[88px] w-full" />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <Metric label="Revenue" value={formatMoney(net, currency)} />
                      <Metric label="Purchases" value={formatCount(purchases)} />
                      <Metric label="Avg order value" value={purchases ? formatMoney(newNet / purchases, currency) : "—"} />
                      <Metric label="Share of revenue" value={formatPercent(net, totalNet)} />
                    </div>
                    <div
                      className="h-1.5 w-full rounded-full bg-[#F0F3F7] overflow-hidden"
                      role="progressbar"
                      aria-label={`${c.label} share of revenue`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(share)}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${share}%`, backgroundColor: SOURCE_COLORS[c.key] }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SalesCard>
  );
}
