"use client";

import { formatCount, formatMoney, formatPercent } from "./salesFormat";
import { Skeleton } from "./SalesUi";

// Same visual language as the Overview KpiCard: white bordered cards, one
// primary-blue accent card.
export function SalesKpiCard({ label, value, hint, accent, loading }) {
  return (
    <div
      className={
        accent
          ? "bg-[#308BF9] rounded-[10px] p-4 text-white flex flex-col gap-1 min-w-0"
          : "bg-white rounded-[10px] p-4 border border-[#E1E6ED] flex flex-col gap-1 min-w-0 hover:border-[#308BF9] transition-colors"
      }
    >
      <div className={accent ? "text-[12px] opacity-85" : "text-[#535359] text-[12px]"}>{label}</div>
      {loading ? (
        <Skeleton className={`h-[26px] w-3/4 mt-1 ${accent ? "!bg-white/25" : ""}`} />
      ) : (
        <div
          className={`text-[22px] xl:text-[24px] font-bold leading-tight mt-1 truncate tabular-nums ${accent ? "" : "text-[#252525]"}`}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </div>
      )}
      <div className={accent ? "text-[11px] opacity-85 truncate" : "text-[#A1A1A1] text-[11px] truncate"}>{loading ? " " : hint}</div>
    </div>
  );
}

export default function SalesKpiCards({ summary, loading }) {
  const s = summary || {};
  const cur = s.currency;
  const total = s.total_purchases;

  const cards = [
    {
      label: "Total Sales",
      value: formatMoney(s.net_sales, cur),
      hint: Number(s.renewal_net_sales) > 0 ? `incl. ${formatMoney(s.renewal_net_sales, cur)} renewals` : "Net revenue this period",
      accent: true,
    },
    { label: "Total Purchases", value: formatCount(total), hint: "New paid memberships" },
    {
      label: "Website Purchases",
      value: formatCount(s.website_purchases),
      hint: `${formatPercent(s.website_purchases, total)} of purchases`,
    },
    {
      label: "Trainer Code Purchases",
      value: formatCount(s.trainer_code_purchases),
      hint: `${formatPercent(s.trainer_code_purchases, total)} of purchases`,
    },
    { label: "Average Order Value", value: formatMoney(s.average_order_value, cur), hint: "First payment ÷ purchases" },
    { label: "Active Paid Subscribers", value: formatCount(s.active_paid_subscribers), hint: "Currently active" },
  ];

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <SalesKpiCard key={c.label} {...c} loading={loading} />
      ))}
    </div>
  );
}
