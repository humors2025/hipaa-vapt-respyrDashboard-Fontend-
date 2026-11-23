"use client";

import { formatCount, formatMoney, formatPercent } from "../salesFormat";
import { BLUE_GRADIENT, Bone, C, Dot, ErrorBox, Panel, PanelHeader, Tag, UpdatingDot } from "./ui";

// "Overall sales — every month": all-time tiles and the month table (view=monthly,
// ignores the dates), then the revenue chart and source split for the selected
// dates (overview.trend / overview.source_breakdown).

const monthShort = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

// Rounds the chart's top value up to 1, 2, 2.5 or 5 × a power of ten.
function niceMax(v) {
  if (!(v > 0)) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const shortMoney = (v, cur) => formatMoney(v, cur, { compact: v >= 1000 }).replace(/\.00$/, "");

function RevenueChart({ buckets, trend, currency, period }) {
  const byKey = new Map((trend || []).map((t) => [t.bucket, t]));
  const rows = buckets.map((b) => {
    const t = byKey.get(b.key) || {};
    const web = Number(t.website_sales) || 0;
    const tr = Number(t.trainer_sales) || 0;
    return { ...b, web, tr, total: web + tr };
  });
  const top = niceMax(Math.max(0, ...rows.map((r) => r.total)));
  const maxIdx = rows.reduce((best, r, i) => (r.total > (rows[best]?.total || 0) ? i : best), 0);

  const X0 = 34;
  const X1 = 432;
  const Y0 = 180;
  const H = 150;
  const n = rows.length || 1;
  const slot = (X1 - X0) / n;
  const bw = Math.max(4, Math.min(28, slot * 0.6));
  const y = (v) => Y0 - (v / top) * H;

  // Which x labels to print: every bar for week/year, a few days for a month.
  const showLabel = (i) => {
    if (period !== "month") return true;
    const day = i + 1;
    return day === 1 || day % 5 === 0 || i === n - 1;
  };
  const labelText = (r, i) => (period === "month" ? String(i + 1) : r.label);

  return (
    <svg viewBox="0 0 440 214" className="w-full h-auto" role="img" aria-label="Revenue by day for the selected dates">
      <defs>
        <linearGradient id="sa-bar-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ece68" />
          <stop offset="100%" stopColor="#3faf58" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="sa-bar-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4da3ff" />
          <stop offset="100%" stopColor="#308bf9" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={X0 - 4} y1={y(top * f)} x2={X1} y2={y(top * f)} stroke={C.border} strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={X0 - 8} y={y(top * f) + 3} textAnchor="end" fill={C.td} fontSize="8">
            {shortMoney(top * f, currency)}
          </text>
        </g>
      ))}

      {rows.map((r, i) => {
        const x = X0 + i * slot + (slot - bw) / 2;
        if (!r.total) return <rect key={r.key} x={x} y={Y0 - 2} width={bw} height={2} rx="1" fill={C.border} opacity="0.5" />;
        const hTr = (r.tr / top) * H;
        const hWeb = (r.web / top) * H;
        return (
          <g key={r.key}>
            <title>{`${r.tooltip}: ${formatMoney(r.total, currency)} (trainer code ${formatMoney(r.tr, currency)}, website ${formatMoney(r.web, currency)})`}</title>
            {r.tr > 0 && <rect x={x} y={Y0 - hTr} width={bw} height={Math.max(hTr, 2)} rx="3" fill="url(#sa-bar-green)" />}
            {r.web > 0 && <rect x={x} y={Y0 - hTr - hWeb} width={bw} height={Math.max(hWeb, 2)} rx="3" fill="url(#sa-bar-blue)" />}
            {i === maxIdx && (
              <text x={x + bw / 2} y={Y0 - hTr - hWeb - 4} textAnchor="middle" fill={C.ts} fontSize="7" fontWeight="600">
                {shortMoney(r.total, currency)}
              </text>
            )}
          </g>
        );
      })}

      <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke={C.border} strokeWidth="1" />
      {rows.map((r, i) =>
        showLabel(i) ? (
          <text key={`l-${r.key}`} x={X0 + i * slot + slot / 2} y={Y0 + 14} textAnchor="middle" fill={C.td} fontSize="8">
            {labelText(r, i)}
          </text>
        ) : null
      )}
    </svg>
  );
}

function SourceRing({ website, trainer }) {
  const total = website + trainer;
  const r = 70;
  const circ = 2 * Math.PI * r;
  const trLen = total ? circ * (trainer / total) : 0;
  const webLen = total ? circ * (website / total) : 0;
  return (
    <svg width="130" height="130" viewBox="0 0 180 180" role="img" aria-label={`${total} purchases: ${trainer} trainer code, ${website} direct website`}>
      <circle cx="90" cy="90" r={r} fill="none" stroke={C.border} strokeWidth="22" />
      {trLen > 0 && (
        <circle cx="90" cy="90" r={r} fill="none" stroke={C.green} strokeWidth="22" strokeDasharray={`${trLen} ${circ - trLen}`} transform="rotate(-90 90 90)" />
      )}
      {webLen > 0 && (
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={C.blue}
          strokeWidth="22"
          strokeDasharray={`${webLen} ${circ - webLen}`}
          strokeDashoffset={-trLen}
          transform="rotate(-90 90 90)"
        />
      )}
      <text x="90" y="88" textAnchor="middle" fill={C.tp} fontSize="32" fontWeight="700" letterSpacing="-1">
        {formatCount(total)}
      </text>
      <text x="90" y="108" textAnchor="middle" fill={C.tm} fontSize="10">
        Total Purchases
      </text>
    </svg>
  );
}

function Tile({ label, value, sub, accent }) {
  return (
    <div className={`rounded-[12px] px-6 py-5 min-w-0 ${accent ? `${BLUE_GRADIENT} text-white` : "border border-[#E1E6ED]"}`}>
      <span className={`text-[12px] tracking-[-0.24px] ${accent ? "text-white/85" : "text-[#738298]"}`}>{label}</span>
      <div className={`text-[28px] xl:text-[32px] font-bold tracking-[-1px] leading-none mt-1.5 tabular-nums truncate ${accent ? "" : "text-[#252525]"}`}>
        {value}
      </div>
      <span className={`block text-[12px] tracking-[-0.24px] mt-1 ${accent ? "text-white/70" : "text-[#738298]"}`}>{sub}</span>
    </div>
  );
}

export default function SalesOverall({
  monthly,
  monthlyLoading,
  monthlyError,
  onRetryMonthly,
  buckets,
  trend,
  breakdown,
  summary,
  period,
  rangeLabel,
  overviewLoading,
  overviewUpdating,
  overviewError,
  onRetryOverview,
}) {
  const cur = monthly?.currency;
  const t = monthly?.totals || {};
  const months = [...(monthly?.months || [])].reverse();
  const showRenewals = monthly?.renewals_available !== false;
  const sCur = summary?.currency;
  const web = Number(summary?.website_purchases) || 0;
  const tr = Number(summary?.trainer_code_purchases) || 0;
  const totalPurchases = web + tr;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        className="px-6 sm:px-8 pt-7"
        title="Overall sales — every month"
        badge={<Tag>All time</Tag>}
        subtitle="Everything we have collected since the first sale, month by month. The date filter above does not change the tiles or the month table."
        action={<UpdatingDot show={(monthlyLoading && Boolean(monthly)) || overviewUpdating} />}
      />

      <div className="px-6 sm:px-8 pt-5 pb-6">
        {monthlyError ? (
          <ErrorBox message={monthlyError} onRetry={onRetryMonthly} />
        ) : monthlyLoading && !monthly ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="h-[100px]" />
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-3 ${showRenewals ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <Tile
              accent
              label="Total sales (all time)"
              value={formatMoney(t.total_sales, cur)}
              sub={`${formatCount(t.total_payments)} payments in ${formatCount(months.length)} ${months.length === 1 ? "month" : "months"}`}
            />
            <Tile label="New purchases (all time)" value={formatMoney(t.new_sales, cur)} sub={`${formatCount(t.new_purchases)} new memberships`} />
            {showRenewals && (
              <Tile label="Renewals (all time)" value={formatMoney(t.renewal_sales, cur)} sub={`${formatCount(t.renewals)} members paid again`} />
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 border-t border-[#E1E6ED]">
        {/* Monthly breakdown (all time) */}
        <div className="p-6 xl:border-r border-[#E1E6ED] min-w-0">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <span className="text-[14px] font-bold text-[#252525] tracking-[-0.28px]">Monthly Breakdown</span>
            <div className="flex items-center gap-2 text-[10px] text-[#535359]">
              <span className="flex items-center gap-1">
                <Dot color={C.blue} size={6} /> New
              </span>
              {showRenewals && (
                <span className="flex items-center gap-1">
                  <Dot color={C.green} size={6} /> Renewals
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[1.2fr_1fr_1fr] py-2 border-b border-[#E1E6ED] text-[10px] font-medium text-[#738298]">
            <span>Month</span>
            <span className="text-right">New</span>
            <span className="text-right">Total</span>
          </div>
          {monthlyLoading && !monthly ? (
            <div className="flex flex-col gap-2 pt-3">
              {[0, 1, 2].map((i) => (
                <Bone key={i} className="h-8" />
              ))}
            </div>
          ) : !months.length ? (
            <p className="text-[12px] text-[#A1A1A1] py-6 text-center">{monthlyError ? "Could not load the months." : "No sales yet."}</p>
          ) : (
            <div className="max-h-[230px] overflow-y-auto">
              {months.map((m) => (
                <div key={m.month} className="grid grid-cols-[1.2fr_1fr_1fr] items-center py-3 border-b border-[#E1E6ED] last:border-0">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[#252525] tracking-[-0.24px]">{monthShort(m.month)}</div>
                    {showRenewals && (
                      <div className="text-[10px] text-[#738298] tabular-nums">
                        {formatCount(m.renewals)} renewed · {formatMoney(m.renewal_sales, cur)}
                      </div>
                    )}
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-[12px] font-semibold text-[#252525]">{formatMoney(m.new_sales, cur)}</div>
                    <div className="text-[10px] text-[#738298]">{formatCount(m.new_purchases)} bought</div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-[12px] font-bold text-[#252525]">{formatMoney(m.total_sales, cur)}</div>
                    <div className="text-[10px] text-[#738298]">{formatCount(m.total_payments)} total</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue chart (selected dates) */}
        <div className="p-6 xl:border-r border-t xl:border-t-0 border-[#E1E6ED] min-w-0">
          <div className="text-[14px] font-bold text-[#252525] tracking-[-0.28px]">{period === "year" ? "Monthly Revenue" : "Daily Revenue"}</div>
          <p className="text-[10px] text-[#738298] mt-0.5">{rangeLabel} · first payments</p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[#535359]">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-[3px] rounded-[2px] bg-[#3FAF58]" /> Trainer Code
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-[3px] rounded-[2px] bg-[#308BF9]" /> Direct Website
            </span>
          </div>
          <div className="mt-3.5">
            {overviewError ? (
              <ErrorBox message={overviewError} onRetry={onRetryOverview} />
            ) : overviewLoading ? (
              <Bone className="h-[180px]" />
            ) : (
              <RevenueChart buckets={buckets} trend={trend} currency={sCur} period={period} />
            )}
          </div>
        </div>

        {/* Sales by source (selected dates) */}
        <div className="p-6 flex flex-col border-t xl:border-t-0 border-[#E1E6ED] min-w-0">
          <div className="text-[14px] font-bold text-[#252525] tracking-[-0.28px]">Sales by Source</div>
          <p className="text-[10px] text-[#738298] mt-0.5">Share of successful purchases · {rangeLabel}</p>
          {overviewError ? (
            <div className="mt-4">
              <ErrorBox message={overviewError} onRetry={onRetryOverview} />
            </div>
          ) : overviewLoading ? (
            <Bone className="h-[200px] mt-4" />
          ) : (
            <>
              <div className="flex justify-center pt-5 pb-4">
                <SourceRing website={web} trainer={tr} />
              </div>
              <div className="border-t border-[#E1E6ED] mt-auto">
                {[
                  { key: "website", label: "Direct Website", color: C.blue, count: web },
                  { key: "trainer_code", label: "Trainer Code", color: C.green, count: tr },
                ].map((row, i) => (
                  <div key={row.key} className={`flex items-center justify-between gap-3 py-3 ${i === 0 ? "border-b border-[#E1E6ED]" : ""}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Dot color={row.color} size={9} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#252525] tracking-[-0.24px]">{row.label}</div>
                        <div className="text-[10px] text-[#738298] tabular-nums">
                          {formatCount(row.count)} purchases · {formatPercent(row.count, totalPurchases)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[14px] font-bold text-[#252525] tracking-[-0.28px] tabular-nums">
                      {formatMoney(breakdown?.[row.key]?.net_sales, sCur)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
