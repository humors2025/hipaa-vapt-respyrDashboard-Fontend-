"use client";

import { useState } from "react";

const COMMISSION_RATE = 0.20;

const TIERS = [
  { id: "coach", label: "Coach's Device",                 perMonth: 50, blurb: "Monthly subscription" },
  { id: "lease", label: "Personal Device (Lease to Own)", perMonth: 50, blurb: "3-month term, $50/mo equivalent" },
  { id: "owned", label: "Personal Device (Owned)",        perMonth: 25, blurb: "12-month term, $25/mo equivalent" },
];

const fmtUSD = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Decrease"
        className="w-8 h-8 rounded-[8px] bg-[#F5F7FA] text-[#535359] text-[16px] font-semibold hover:bg-[#E1E6ED]"
      >−</button>
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
        onClick={() => onChange(value + 1)}
        aria-label="Increase"
        className="w-8 h-8 rounded-[8px] bg-[#F5F7FA] text-[#535359] text-[16px] font-semibold hover:bg-[#E1E6ED]"
      >+</button>
    </div>
  );
}

export default function TrainerAdminCalculatorPage() {
  const [counts, setCounts] = useState({ coach: 0, lease: 0, owned: 0 });
  const setCount = (id, n) => setCounts((c) => ({ ...c, [id]: n }));

  const breakdown = TIERS.map((t) => {
    const clients = counts[t.id];
    const overridePerClient = t.perMonth * COMMISSION_RATE;
    const monthly = clients * overridePerClient;
    const annual = monthly * 12;
    return { ...t, clients, overridePerClient, monthly, annual };
  });

  const totalMonthly = breakdown.reduce((s, b) => s + b.monthly, 0);
  const totalAnnual = totalMonthly * 12;
  const totalClients = breakdown.reduce((s, b) => s + b.clients, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Override Commission Calculator</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          Project your override earnings. Enter the total number of active clients{" "}
          <strong>across your trainers' networks</strong>, broken down by tier. Override is{" "}
          <strong>{(COMMISSION_RATE * 100).toFixed(0)}%</strong> of subscription revenue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((t) => (
          <div key={t.id} className="bg-[#F5F7FA] rounded-[10px] p-4 flex flex-col gap-3">
            <div>
              <span className="text-[#252525] text-[13px] font-semibold block">{t.label}</span>
              <span className="text-[#A1A1A1] text-[11px]">{t.blurb}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#535359] text-[12px]">Active clients</span>
              <Stepper value={counts[t.id]} onChange={(n) => setCount(t.id, n)} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white">
          <div className="text-[12px] opacity-80">Monthly override</div>
          <div className="text-[28px] font-bold mt-1">{fmtUSD(totalMonthly)}</div>
          <div className="text-[11px] opacity-80 mt-1">
            {totalClients} active client{totalClients === 1 ? "" : "s"} in network
          </div>
        </div>
        <div className="bg-[#F5F7FA] rounded-[10px] p-5">
          <div className="text-[#535359] text-[12px]">Annual projection</div>
          <div className="text-[#252525] text-[28px] font-bold mt-1">{fmtUSD(totalAnnual)}</div>
          <div className="text-[#A1A1A1] text-[11px] mt-1">If activity persists 12 months</div>
        </div>
        <div className="bg-[#F5F7FA] rounded-[10px] p-5">
          <div className="text-[#535359] text-[12px]">Override rate</div>
          <div className="text-[#252525] text-[28px] font-bold mt-1">{(COMMISSION_RATE * 100).toFixed(0)}%</div>
          <div className="text-[#A1A1A1] text-[11px] mt-1">Flat across all tiers</div>
        </div>
      </div>

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">Per-tier breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#A1A1A1] text-left border-b border-[#E1E6ED]">
                <th className="py-2 pr-3 font-medium">Tier</th>
                <th className="py-2 pr-3 font-medium text-right">Clients</th>
                <th className="py-2 pr-3 font-medium text-right">Override / client / mo</th>
                <th className="py-2 pr-3 font-medium text-right">Monthly</th>
                <th className="py-2 font-medium text-right">Annual</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.id} className="border-b border-[#F5F7FA]">
                  <td className="py-2.5 pr-3 text-[#252525]">{b.label}</td>
                  <td className="py-2.5 pr-3 text-right text-[#535359]">{b.clients}</td>
                  <td className="py-2.5 pr-3 text-right text-[#535359]">{fmtUSD(b.overridePerClient)}</td>
                  <td className="py-2.5 pr-3 text-right text-[#252525] font-semibold">{fmtUSD(b.monthly)}</td>
                  <td className="py-2.5 text-right text-[#252525] font-semibold">{fmtUSD(b.annual)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-3 text-[#252525] font-bold">Total</td>
                <td className="py-3 pr-3 text-right text-[#252525] font-bold">{totalClients}</td>
                <td className="py-3 pr-3" />
                <td className="py-3 pr-3 text-right text-[#252525] font-bold">{fmtUSD(totalMonthly)}</td>
                <td className="py-3 text-right text-[#252525] font-bold">{fmtUSD(totalAnnual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[10px] bg-[#FFF4E0] text-[#A66B00] p-4 text-[12px]">
        <strong>Note:</strong> override is paid on top of the trainer's direct commission. Total channel cost
        is <strong>40%</strong> of subscription revenue (20% direct to the trainer + 20% override to you).
      </div>
    </div>
  );
}
