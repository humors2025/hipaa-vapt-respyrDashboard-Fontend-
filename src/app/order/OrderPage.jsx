"use client";

import { useEffect, useState } from "react";
import {
  fetchOrderPageContextService,
  createCheckoutSessionFromStickerService,
  formatMinor,
} from "@/services/commissionService";

/**
 * Public order page — where every referral QR code, sticker and link lands:
 *   /order/<CODE>   a gym or trainer code — or a sticker ID pasted from the
 *                   QR page; the backend resolves whichever one matches
 *   /q/<ID>         a pre-printed sticker (resolved to whatever it's linked to)
 *   /order          no referral (member may type a code on Stripe's page)
 *
 * Starts Stripe Checkout via the backend with the referral attached
 * server-side. No login, no PHI, nothing stored in the browser.
 */

const BENEFITS = [
  ["Device included", "The Rysflo breath device ships free within the US. It's yours to keep after 12 months."],
  ["Every reading pays you back", "Each day you take a reading, 20¢ comes off next month's bill — up to $6."],
  ["Your trainer sees your progress", "Sign up through your gym's code and your trainer can follow your metabolism scores — only with your consent."],
  ["Cancel any time", "30-day return window on the device; the membership is monthly after that."],
];

export default function OrderPage({ code = "", qrId = "" }) {
  const [ctx, setCtx] = useState(null);
  const [email, setEmail] = useState("");
  const [typedCode, setTypedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // /order/<X> may carry a sticker ID rather than a partner code, so send
        // it as both — a matching sticker's partner code wins server-side.
        const next = await fetchOrderPageContextService({ partnerCode: code, qrId: qrId || code });
        setCtx(next);
        if (next?.referral?.partner_code) setTypedCode(next.referral.partner_code);
      } catch {
        setCtx({ pricing: null, referral: null });
      }
    })();
  }, [code, qrId]);

  const pricing = ctx?.pricing;
  const referral = ctx?.referral;
  const stickerId = qrId || ctx?.qr_id || "";
  const effectiveCode = referral?.partner_code || (typedCode.trim() ? typedCode.trim().toUpperCase() : "");
  const priceMinor = pricing ? (referral ? pricing.referred_price_minor : pricing.list_price_minor) : null;

  const start = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await createCheckoutSessionFromStickerService({ qrId: stickerId, partnerCode: effectiveCode || code, email: email.trim() });
      window.location.assign(res.checkout_url);
    } catch (err) {
      // Backend refuses a second purchase for an email that already has a live
      // membership — that's good news for the member, not an error.
      if (err?.data?.code === "already_member") {
        setNotice(err.message);
      } else {
        setError(err?.message || "Something went wrong starting checkout. Please try again.");
      }
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[920px] grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4 sm:gap-6">
        <section className="bg-white rounded-[16px] p-5 sm:p-8 flex flex-col gap-5 sm:gap-6">
          <div>
            <img src="/icons/rysflo-logo.png" alt="Rysflo" width={140} height={40} className="mb-4 h-9 w-auto sm:h-10" />
            <div className="text-[#308BF9] text-[12px] font-semibold uppercase tracking-wide">Rysflo membership</div>
            <h1 className="text-[#252525] text-[24px] sm:text-[28px] font-bold leading-tight mt-1">Know what your metabolism is doing. Every morning.</h1>
            <p className="text-[#535359] text-[14px] mt-2">One breath a day. Three biomarkers. A plan that adapts to you and your trainer.</p>
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
          {referral && (
            <div className="rounded-[10px] bg-[#EEF4FE] px-4 py-3 text-[12px] text-[#1F4E8C]">
              {referral.facility_name ? <strong>{referral.facility_name}</strong> : <strong>Your trainer</strong>} invited you. Their code{" "}
              <span className="font-mono font-semibold">{referral.partner_code}</span> is applied — {pricing ? `${formatMinor(pricing.list_price_minor - pricing.referred_price_minor)} off every month.` : "discount applied."}
            </div>
          )}
        </section>

        <section className="bg-white rounded-[16px] p-5 sm:p-8 flex flex-col gap-5 self-start">
          <div>
            {pricing ? (
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="text-[#252525] text-[32px] sm:text-[40px] font-bold leading-none">
                  {formatMinor(priceMinor, pricing.currency).replace(/\.00$/, "")}
                  <span className="text-[16px] text-[#535359] font-semibold">/month</span>
                </div>
                {referral && (
                  <div className="text-[#A1A1A1] text-[18px] line-through">{formatMinor(pricing.list_price_minor, pricing.currency).replace(/\.00$/, "")}</div>
                )}
              </div>
            ) : (
              <div className="text-[#252525] text-[32px] sm:text-[40px] font-bold leading-none">—</div>
            )}
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
              <span className="text-[#A1A1A1] text-[11px]">Use the same email you&rsquo;ll use in the Rysflo app.</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">Gym or trainer code (optional)</span>
              <input
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value)}
                readOnly={!!referral}
                placeholder="e.g. TRX1234"
                className={`w-full rounded-[10px] border border-[#E1E6ED] px-3 py-2.5 text-[13px] text-[#252525] font-mono uppercase focus:outline-none focus:border-[#308BF9] ${referral ? "bg-[#F5F7FA]" : ""}`}
              />
              <span className="text-[#A1A1A1] text-[11px]">
                {referral
                  ? `${referral.facility_name ? `${referral.facility_name}'s` : "Your trainer's"} code — applied from your link.`
                  : pricing ? `Brings the price to ${formatMinor(pricing.referred_price_minor, pricing.currency).replace(/\.00$/, "")}/month.` : ""}
              </span>
            </label>

            {error && <div className="rounded-[10px] bg-[#FCEAEB] px-3 py-2 text-[12px] text-[#B5363A]">{error}</div>}
            {notice && (
              <div className="rounded-[10px] bg-[#E5F6EE] px-3 py-2 text-[12px] text-[#1F7A4A]">
                <strong className="font-semibold">You&rsquo;re already a member.</strong> {notice}
              </div>
            )}
            <button type="submit" disabled={busy || !pricing} className="rounded-[10px] bg-[#308BF9] text-white text-[14px] font-semibold px-5 py-3 disabled:opacity-60 cursor-pointer">
              {busy ? "Opening secure checkout…" : "Continue to secure checkout"}
            </button>
            <p className="text-[#A1A1A1] text-[11px] text-center">Payment is handled by Stripe. Rysflo never sees your card details.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
