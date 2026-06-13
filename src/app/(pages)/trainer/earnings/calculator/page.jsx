"use client";

import { Fragment, useState } from "react";

const COMMISSION_RATE = 0.20;

const TIERS = [
  {
    id: "coach",
    label: "Coach's Device",
    price: 50,
    termMonths: 1,
    perMonth: 50,
    blurb: "Monthly subscription, no personal device shipped.",
  },
  {
    id: "lease",
    label: "Personal Device (Lease to Own)",
    price: 150,
    termMonths: 3,
    perMonth: 50,
    blurb: "3-month term. Personal device shipped, returned after term.",
  },
  {
    id: "owned",
    label: "Personal Device (Owned)",
    price: 300,
    termMonths: 12,
    perMonth: 25,
    blurb: "12-month term. Client owns the device and tests at home.",
  },
];

const COMPARISON_ROWS = [
  { group: "Pricing", rows: [
    { label: "Price", values: ["$50", "$150", "$300"] },
    { label: "Per month equivalent", values: ["$50/mo", "$50/mo", "$25/mo"] },
    { label: "Savings vs monthly", values: ["—", "20%", "50%"] },
  ]},
  { group: "Metabolic Tracking", rows: [
    { label: "Fasted morning breath tests", values: ["No*", "Yes", "Yes"] },
    { label: "Three biomarker readings", values: ["Yes", "Yes", "Yes"] },
    { label: "App access with metabolic scores", values: ["Yes", "Yes", "Yes"] },
    { label: "Two-week rolling trend tracking", values: ["Yes", "Yes", "Yes"] },
  ]},
  { group: "Nutrition", rows: [
    { label: "AI-generated nutrition plan", values: ["Yes", "Yes", "Yes"] },
    { label: "Trainer review and delivery", values: ["Yes", "Yes", "Yes"] },
    { label: "Monthly plan refinement", values: ["Yes", "Yes", "Yes"] },
    { label: "Weekly plan refinement", values: ["Yes", "Yes", "Yes"] },
  ]},
  { group: "Device", rows: [
    { label: "Coach device (trainer sessions)", values: ["Yes", "Yes", "Yes"] },
    { label: "Personal device shipped", values: ["No", "Yes", "Yes, included"] },
    { label: "Test at home without trainer", values: ["No", "No", "Yes"] },
  ]},
  { group: "Support", rows: [
    { label: "Trainer dashboard access", values: ["Yes", "Yes", "Yes"] },
    { label: "Progress reports", values: ["Monthly", "Daily", "Daily"] },
  ]},
];

const fmtUSD = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Stepper({ value, onChange }) {
  const dec = () => onChange(Math.max(0, value - 1));
  const inc = () => onChange(value + 1);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={dec}
        aria-label="Decrease"
        className="w-8 h-8 rounded-[8px] bg-[#F5F7FA] text-[#535359] text-[16px] font-semibold hover:bg-[#E1E6ED]"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(Number.isFinite(v) && v >= 0 ? v : 0);
        }}
        className="w-16 h-8 text-center rounded-[8px] border border-[#E1E6ED] text-[#252525] text-[13px] font-semibold"
      />
      <button
        type="button"
        onClick={inc}
        aria-label="Increase"
        className="w-8 h-8 rounded-[8px] bg-[#F5F7FA] text-[#535359] text-[16px] font-semibold hover:bg-[#E1E6ED]"
      >
        +
      </button>
    </div>
  );
}

export default function CalculatorPage() {
  const [counts, setCounts] = useState({ coach: 0, lease: 0, owned: 0 });
  const setCount = (id, n) => setCounts((c) => ({ ...c, [id]: n }));

  const breakdown = TIERS.map((t) => {
    const clients = counts[t.id];
    const monthlyCommissionPerClient = t.perMonth * COMMISSION_RATE;
    const monthly = clients * monthlyCommissionPerClient;
    const annual = monthly * 12;
    return { ...t, clients, monthlyCommissionPerClient, monthly, annual };
  });

  const totalMonthly = breakdown.reduce((s, b) => s + b.monthly, 0);
  const totalAnnual = totalMonthly * 12;
  const totalClients = breakdown.reduce((s, b) => s + b.clients, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Commission Calculator</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          Enter how many active clients you have at each tier. Commission is{" "}
          <strong>{(COMMISSION_RATE * 100).toFixed(0)}%</strong> of recurring
          revenue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((t) => (
          <div
            key={t.id}
            className="bg-[#F5F7FA] rounded-[10px] p-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[#252525] text-[13px] font-semibold">
                {t.label}
              </span>
              <span className="text-[#A1A1A1] text-[11px]">{t.blurb}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[#252525] text-[20px] font-bold">
                {fmtUSD(t.price)}
              </span>
              <span className="text-[#535359] text-[11px]">
                / {t.termMonths === 1 ? "month" : `${t.termMonths} months`}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[#535359] text-[12px]">Active clients</span>
              <Stepper
                value={counts[t.id]}
                onChange={(n) => setCount(t.id, n)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white">
          <div className="text-[12px] opacity-80">Monthly commission</div>
          <div className="text-[28px] font-bold mt-1">{fmtUSD(totalMonthly)}</div>
          <div className="text-[11px] opacity-80 mt-1">
            {totalClients} active client{totalClients === 1 ? "" : "s"}
          </div>
        </div>
        <div className="bg-[#F5F7FA] rounded-[10px] p-5">
          <div className="text-[#535359] text-[12px]">Annual projection</div>
          <div className="text-[#252525] text-[28px] font-bold mt-1">
            {fmtUSD(totalAnnual)}
          </div>
          <div className="text-[#A1A1A1] text-[11px] mt-1">
            Assumes all clients stay active for 12 months
          </div>
        </div>
        <div className="bg-[#F5F7FA] rounded-[10px] p-5">
          <div className="text-[#535359] text-[12px]">Commission rate</div>
          <div className="text-[#252525] text-[28px] font-bold mt-1">
            {(COMMISSION_RATE * 100).toFixed(0)}%
          </div>
          <div className="text-[#A1A1A1] text-[11px] mt-1">Flat across all tiers</div>
        </div>
      </div>

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">
          Per-tier breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#A1A1A1] text-left border-b border-[#E1E6ED]">
                <th className="py-2 pr-3 font-medium">Tier</th>
                <th className="py-2 pr-3 font-medium text-right">Clients</th>
                <th className="py-2 pr-3 font-medium text-right">Per client / mo</th>
                <th className="py-2 pr-3 font-medium text-right">Monthly</th>
                <th className="py-2 font-medium text-right">Annual</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.id} className="border-b border-[#F5F7FA]">
                  <td className="py-2.5 pr-3 text-[#252525]">{b.label}</td>
                  <td className="py-2.5 pr-3 text-right text-[#535359]">{b.clients}</td>
                  <td className="py-2.5 pr-3 text-right text-[#535359]">
                    {fmtUSD(b.monthlyCommissionPerClient)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-[#252525] font-semibold">
                    {fmtUSD(b.monthly)}
                  </td>
                  <td className="py-2.5 text-right text-[#252525] font-semibold">
                    {fmtUSD(b.annual)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-3 text-[#252525] font-bold">Total</td>
                <td className="py-3 pr-3 text-right text-[#252525] font-bold">
                  {totalClients}
                </td>
                <td className="py-3 pr-3" />
                <td className="py-3 pr-3 text-right text-[#252525] font-bold">
                  {fmtUSD(totalMonthly)}
                </td>
                <td className="py-3 text-right text-[#252525] font-bold">
                  {fmtUSD(totalAnnual)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">
          Detailed tier comparison
        </h3>
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA]">
                <th className="text-left text-[#535359] font-semibold py-3 px-4 w-[40%]">
                  Feature
                </th>
                {TIERS.map((t) => (
                  <th
                    key={t.id}
                    className="text-left text-[#535359] font-semibold py-3 px-4"
                  >
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((group) => (
                <Fragment key={group.group}>
                  <tr className="bg-[#308BF9]">
                    <td
                      colSpan={4}
                      className="text-white text-[11px] uppercase tracking-wide font-semibold py-2.5 px-4"
                    >
                      {group.group}
                    </td>
                  </tr>
                  {group.rows.map((r) => (
                    <tr key={`${group.group}-${r.label}`} className="border-t border-[#F5F7FA]">
                      <td className="py-2.5 px-4 text-[#535359]">{r.label}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className="py-2.5 px-4 text-[#252525]">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[#A1A1A1] text-[11px] mt-2">
          *Coach's Device clients can come to the gym fasted for the pre-workout
          test and bring simple carbs to consume immediately before/after.
        </p>
      </div>
    </div>
  );
}
