"use client";

import { useEffect, useState } from "react";
import { fetchPaymentTransactionsService } from "@/services/superAdminOrdersService";
import { formatCount, formatMoney, formatPercent, percentChange } from "./salesFormat";
import { Skeleton } from "./SalesUi";

const DELTA_STYLE = {
  up: { plain: "text-[#2E8B47]", accent: "text-white", arrow: "▲" },
  down: { plain: "text-[#B5363A]", accent: "text-white", arrow: "▼" },
  flat: { plain: "text-[#A1A1A1]", accent: "text-white", arrow: "■" },
};

// "▲ +12.5% vs last month" under a KPI value.
function DeltaLine({ delta, label, accent }) {
  if (!delta) return null;
  const s = DELTA_STYLE[delta.direction] || DELTA_STYLE.flat;
  return (
    <div className={`text-[11px] font-semibold tabular-nums truncate ${accent ? s.accent : s.plain}`} title={`${delta.text} ${label}`}>
      <span aria-hidden="true" className="text-[9px] mr-1">
        {s.arrow}
      </span>
      {delta.text} <span className={accent ? "opacity-85 font-normal" : "text-[#A1A1A1] font-normal"}>{label}</span>
    </div>
  );
}

// Same visual language as the Overview KpiCard: white bordered cards, one
// primary-blue accent card.
// amount: optional money line under the main value (e.g. revenue for a count).
// delta: percentChange() result vs the previous period; deltaLabel: "vs last month".
// highlight: amber card (tinted, thick left border, amber value) for a number
// that needs attention, such as renewals still to come.
export function SalesKpiCard({ label, value, amount, hint, accent, highlight, loading, delta, deltaLabel }) {
  const box = accent
    ? "bg-[#308BF9] rounded-[10px] p-4 text-white"
    : highlight
    ? "bg-[#FFF6E5] rounded-[10px] p-4 border border-[#F5C26B] border-l-[4px] border-l-[#E8A33D] shadow-[0_2px_8px_rgba(232,163,61,0.18)]"
    : "bg-white rounded-[10px] p-4 border border-[#E1E6ED] hover:border-[#308BF9] transition-colors";
  return (
    <div className={`${box} flex flex-col gap-1 min-w-0`}>
      <div
        className={
          accent ? "text-[12px] opacity-85" : highlight ? "text-[#8A5A00] text-[12px] font-semibold" : "text-[#535359] text-[12px]"
        }
      >
        {label}
      </div>
      {loading ? (
        <Skeleton className={`h-[26px] w-3/4 mt-1 ${accent ? "!bg-white/25" : ""}`} />
      ) : (
        <div
          className={`text-[22px] xl:text-[24px] font-bold leading-tight mt-1 truncate tabular-nums ${
            accent ? "" : highlight ? "text-[#B86E00]" : "text-[#252525]"
          }`}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </div>
      )}
      {amount !== undefined &&
        (loading ? (
          <Skeleton className="h-[16px] w-1/2" />
        ) : (
          <div className="text-[#252525] text-[13px] font-semibold tabular-nums truncate" title={amount}>
            {amount}
          </div>
        ))}
      {!loading && <DeltaLine delta={delta} label={deltaLabel} accent={accent} />}
      <div
        className={
          accent
            ? "text-[11px] leading-snug opacity-85 break-words"
            : highlight
            ? "text-[#8A5A00] text-[11px] leading-snug break-words"
            : "text-[#A1A1A1] text-[11px] leading-snug break-words"
        }
      >{loading ? " " : hint}</div>
    </div>
  );
}

// previous: the overview summary of the period before (null while loading or
// when it failed — the cards then simply show no change line).
// compareLabel: "vs last month" etc.
// renewals: overview.retention.renewals (null when the environment has no payment rows).
// upcoming: overview.retention.upcoming ({ total }), null on an older backend.
// period: "week" | "month" | "year", for the "this month" wording.
const PERIOD_WORD = { week: "this week", month: "this month", year: "this year" };

// overall: view=monthly response (all-time totals), undefined while loading.
// Renewable customers: the Orders › Renewals tab total (every paid renewal so far,
// refunded ones included), from the same request as the Orders top cards, so the two
// numbers always match. Not tied to the period or trainer admin picked here.
function useRenewalTotals() {
  const [state, setState] = useState({ loading: true, data: null });
  useEffect(() => {
    let alive = true;
    fetchPaymentTransactionsService({ type: "renewal", paidOnly: true, limit: 1 })
      .then((res) => {
        if (!alive) return;
        if (res?.status === false) throw new Error("failed");
        const byCur = new Map();
        for (const row of res?.summary || []) {
          const cur = row.currency || "usd";
          byCur.set(cur, (byCur.get(cur) || 0) + (Number(row.amount_paid) || 0) - (Number(row.amount_refunded) || 0));
        }
        setState({
          loading: false,
          data: {
            count: res?.pagination?.total || 0,
            amount: [...byCur.entries()].map(([cur, amt]) => formatMoney(amt, cur)).join(" · "),
          },
        });
      })
      .catch(() => alive && setState({ loading: false, data: null }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export default function SalesKpiCards({ summary, breakdown, renewals, upcoming, overall, previous, compareLabel, period, loading }) {
  const renewable = useRenewalTotals();
  const s = summary || {};
  const b = breakdown || {};
  const prev = previous?.summary;
  const prevRenewals = previous?.retention?.renewals;
  const when = PERIOD_WORD[period] || "this period";
  const cur = s.currency;
  const total = s.total_purchases;
  const totalNet = Number(s.net_sales) || 0;
  // A change is only meaningful in the same currency.
  const comparable = prev && (!prev.currency || !cur || prev.currency === cur);
  const change = (now, before) => (comparable ? percentChange(now, before) : null);

  const cards = [
    {
      label: "Total Sales",
      value: formatMoney(s.net_sales, cur),
      hint: "Net of first payments this period",
      accent: true,
      delta: change(s.net_sales, prev?.net_sales),
    },
    {
      label: `Total New Purchases ${when}`,
      value: formatCount(total),
      hint: "New paid memberships (renewals not included)",
      delta: change(total, prev?.total_purchases),
    },
    {
      label: "Direct Website Purchases",
      value: formatCount(s.website_purchases),
      amount: `${formatMoney(b.website?.net_sales, cur)} · ${formatPercent(b.website?.net_sales, totalNet)} of sales`,
      hint: `${formatPercent(s.website_purchases, total)} of purchases`,
      delta: change(s.website_purchases, prev?.website_purchases),
    },
    {
      label: "Trainer Code Purchases",
      value: formatCount(s.trainer_code_purchases),
      amount: `${formatMoney(b.trainer_code?.net_sales, cur)} · ${formatPercent(b.trainer_code?.net_sales, totalNet)} of sales`,
      hint: `${formatPercent(s.trainer_code_purchases, total)} of purchases`,
      delta: change(s.trainer_code_purchases, prev?.trainer_code_purchases),
    },
    {
      label: `Total Renewals ${when}`,
      value: renewals ? formatCount(renewals.payments) : "—",
      amount: renewals ? `${formatMoney(renewals.net_sales, cur)} collected` : undefined,
      hint: renewals ? "Members who paid again for the next month" : "Renewals are not recorded here yet",
      delta: renewals ? change(renewals.payments, prevRenewals?.payments) : null,
    },
    {
      label: `Upcoming Renewals ${when}`,
      value: upcoming ? formatCount(upcoming.total) : "—",
      highlight: true,
      hint: "Plans set to renew from now until the period ends (cancelled plans not counted)",
    },
    {
      label: "Renewable customers",
      value: renewable.data ? formatCount(renewable.data.count) : "—",
      amount: renewable.data?.amount ? `${renewable.data.amount} collected` : undefined,
      hint: renewable.data
        ? "All paid renewals so far, as in Orders › Renewals (all trainer admins)"
        : "Could not load the Orders renewals",
      cardLoading: renewable.loading,
    },
    {
      label: "Overall Sales (all time)",
      value: overall ? formatMoney(overall.totals?.total_sales, overall.currency) : "—",
      amount: overall
        ? `${formatCount(overall.totals?.new_purchases)} new · ${formatCount(overall.totals?.renewals)} renewals`
        : undefined,
      hint: overall ? `All months together · ${formatCount(overall.months?.length)} months` : "All months together",
    },
  ];

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ cardLoading, ...c }) => (
        <SalesKpiCard key={c.label} {...c} deltaLabel={compareLabel} loading={cardLoading ?? loading} />
      ))}
    </div>
  );
}
