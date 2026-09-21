"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchEarningsSummaryService, formatMinor } from "@/services/commissionService";

/**
 * Commission calculator for the current programme: one plan, $29/month,
 * device included; members earn 20¢ off per reading-day (cap $6); commission
 * is the platform rate applied to what is actually charged, split with the
 * facility where a trainer has a split.
 */

const PLAN_MINOR = 2900;
const CREDIT_PER_DAY_MINOR = 20;
const CREDIT_CAP_MINOR = 600;

function Stepper({ label, value, onChange, min = 0, max = 500, hint }) {
  return (
    <div className="bg-white rounded-[10px] p-4 border border-[#E1E6ED] flex flex-col gap-2">
      <div className="text-[#535359] text-[12px] font-semibold">{label}</div>
      {hint && <div className="text-[#A1A1A1] text-[11px]">{hint}</div>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-[8px] bg-[#F5F7FA] text-[#252525] font-bold cursor-pointer">−</button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
          className="w-20 text-center rounded-[8px] border border-[#E1E6ED] py-1.5 text-[14px] font-bold text-[#252525] focus:outline-none focus:border-[#308BF9]"
        />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-8 h-8 rounded-[8px] bg-[#F5F7FA] text-[#252525] font-bold cursor-pointer">+</button>
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const [members, setMembers] = useState(10);
  const [readingDays, setReadingDays] = useState(20);
  const [ratePct, setRatePct] = useState(20);
  const [splitPct, setSplitPct] = useState(null); // null = you keep 100%
  const [role, setRole] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchEarningsSummaryService();
        if (s.rate_pct != null) setRatePct(Number(s.rate_pct));
        if (s.split_pct != null) setSplitPct(Number(s.split_pct));
        setRole(s.role);
      } catch {
        /* defaults stay */
      }
    })();
  }, []);

  const calc = useMemo(() => {
    const credit = Math.min(CREDIT_CAP_MINOR, readingDays * CREDIT_PER_DAY_MINOR);
    const charged = PLAN_MINOR - credit;
    const gymCommission = Math.round((charged * ratePct) / 100);
    const yourShare = splitPct == null ? gymCommission : Math.round((gymCommission * splitPct) / 100);
    return {
      credit,
      charged,
      gymCommission,
      yourShare,
      monthly: yourShare * members,
      annual: yourShare * members * 12,
    };
  }, [members, readingDays, ratePct, splitPct]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Commission Calculator</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          Rysflo membership is $29/month, device included. Commission is {ratePct}% of what each member actually pays
          {splitPct != null ? `, of which you receive ${splitPct}%` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Stepper label="Active members" value={members} onChange={setMembers} hint="Referred through your code(s) and still subscribed" />
        <Stepper
          label="Average reading days per month"
          value={readingDays}
          onChange={setReadingDays}
          max={31}
          hint="Each reading day takes 20¢ off the member's next bill, up to $6"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1">
          <div className="text-[12px] opacity-80">Monthly commission</div>
          <div className="text-[28px] font-bold">{formatMinor(calc.monthly)}</div>
          <div className="text-[11px] opacity-80">{members} member{members === 1 ? "" : "s"} × {formatMinor(calc.yourShare)}</div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Annual projection</div>
          <div className="text-[#252525] text-[28px] font-bold">{formatMinor(calc.annual)}</div>
          <div className="text-[#A1A1A1] text-[11px]">Assumes members stay active all year</div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Per member, per month</div>
          <div className="text-[#252525] text-[28px] font-bold">{formatMinor(calc.yourShare)}</div>
          <div className="text-[#A1A1A1] text-[11px]">{ratePct}% of {formatMinor(calc.charged)} charged{splitPct != null ? ` × ${splitPct}%` : ""}</div>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#E1E6ED] overflow-hidden">
        <table className="w-full text-[12px]">
          <tbody>
            <tr className="border-b border-[#F5F7FA]">
              <td className="py-2.5 px-4 text-[#535359]">Plan price</td>
              <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(PLAN_MINOR)}</td>
            </tr>
            <tr className="border-b border-[#F5F7FA]">
              <td className="py-2.5 px-4 text-[#535359]">Reading credit ({readingDays} days × 20¢, max $6)</td>
              <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">− {formatMinor(calc.credit)}</td>
            </tr>
            <tr className="border-b border-[#F5F7FA]">
              <td className="py-2.5 px-4 text-[#535359]">Member is charged</td>
              <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(calc.charged)}</td>
            </tr>
            <tr className="border-b border-[#F5F7FA]">
              <td className="py-2.5 px-4 text-[#535359]">Commission at {ratePct}%</td>
              <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(calc.gymCommission)}</td>
            </tr>
            {splitPct != null && (
              <tr className="bg-[#F5F7FA]">
                <td className="py-2.5 px-4 text-[#252525] font-semibold">Your share ({splitPct}%)</td>
                <td className="py-2.5 px-4 text-right text-[#252525] font-bold">{formatMinor(calc.yourShare)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[#A1A1A1] text-[11px]">
        Estimates only. Actual commission is calculated on each payment Stripe collects
        {role === "trainer" ? " and your facility's current split" : ""}. Rate shown is the current programme rate.
      </p>
    </div>
  );
}
