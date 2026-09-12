"use client";

import { useState } from "react";
import { createCheckoutSessionService } from "@/services/commissionService";

/**
 * Public order page — the destination of every referral QR code and link
 * (/order/<CODE>). Starts Stripe Checkout with the code attached server-side.
 * No login, no PHI, nothing stored in the browser.
 */

const BENEFITS = [
  ["Device included", "The Rysflo breath device ships free within the US. It's yours to keep after 12 months."],
  ["$29 a month", "One plan. No upfront cost. Cancel any time after the 30-day return window."],
  ["Every reading pays you back", "Each day you take a reading, 20¢ comes off next month's bill — up to $6, so a full month costs $23."],
  ["Your trainer sees your progress", "Sign up through your gym's code and your trainer can follow your metabolism scores — only with your consent."],
];

export default function OrderPage({ code }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await createCheckoutSessionService({ partnerCode: code, email: email.trim() });
      window.location.assign(res.checkout_url);
    } catch (err) {
      setError(err?.message || "Something went wrong starting checkout. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[920px] grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="bg-white rounded-[16px] p-8 flex flex-col gap-6">
          <div>
            <div className="text-[#308BF9] text-[12px] font-semibold uppercase tracking-wide">Rysflo membership</div>
            <h1 className="text-[#252525] text-[28px] font-bold leading-tight mt-1">
              Know what your metabolism is doing. Every morning.
            </h1>
            <p className="text-[#535359] text-[14px] mt-2">
              One breath a day. Three biomarkers. A plan that adapts to you and your trainer.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {BENEFITS.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 w-5 h-5 rounded-full bg-[#E5F6EE] text-[#1F7A4A] text-[12px] flex items-center justify-center shrink-0">✓</span>
                <div>
                  <div className="text-[#252525] text-[13px] font-semibold">{t}</div>
                  <div className="text-[#535359] text-[12px]">{d}</div>
                </div>
              </li>
            ))}
          </ul>
          {code && (
            <div className="rounded-[10px] bg-[#EEF4FE] px-4 py-3 text-[12px] text-[#1F4E8C]">
              You&rsquo;re signing up through code <span className="font-mono font-semibold">{code}</span>. Your gym is credited for the referral — it costs you nothing extra.
            </div>
          )}
        </section>

        <section className="bg-white rounded-[16px] p-8 flex flex-col gap-5 self-start">
          <div>
            <div className="text-[#252525] text-[40px] font-bold leading-none">$29<span className="text-[16px] text-[#535359] font-semibold">/month</span></div>
            <div className="text-[#A1A1A1] text-[12px] mt-1">Device included · Free US shipping · 30-day returns</div>
          </div>
          <form onSubmit={start} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[10px] border border-[#E1E6ED] px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
              />
              <span className="text-[#A1A1A1] text-[11px]">Use the same email you&rsquo;ll use in the Rysflo app, so your readings link to your membership.</span>
            </label>
            {error && <div className="rounded-[10px] bg-[#FCEAEB] px-3 py-2 text-[12px] text-[#B5363A]">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-[10px] bg-[#308BF9] text-white text-[14px] font-semibold px-5 py-3 disabled:opacity-60 cursor-pointer"
            >
              {busy ? "Opening secure checkout…" : "Continue to secure checkout"}
            </button>
            <p className="text-[#A1A1A1] text-[11px] text-center">
              Payment is handled by Stripe. Rysflo never sees your card details.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
