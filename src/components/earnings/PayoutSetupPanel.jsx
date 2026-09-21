"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  fetchConnectStatusService,
  createConnectOnboardingLinkService,
  createConnectDashboardLinkService,
  formatMinor,
} from "@/services/commissionService";

/**
 * Stripe Connect payout setup, shared by every payee role.
 *
 * The state comes from the backend (partner_payout_accounts, synced from
 * Stripe). When Stripe redirects back here with ?return=1 or ?refresh=1 we
 * force a sync so the page reflects what the user just did on Stripe.
 */

const STATES = {
  not_started: {
    label: "Not set up",
    headline: "Set up payouts to start receiving commission",
    description:
      "Connect with Stripe so we can send your referral commission. Stripe collects your bank details and tax information (W-9) and issues your 1099 at year-end — none of it is stored by Rysflo.",
    cta: "Set up payouts with Stripe",
    tone: "neutral",
  },
  pending: {
    label: "Verification pending",
    headline: "Stripe is verifying your details",
    description:
      "You've submitted your information. Commission keeps accruing and will be paid once Stripe finishes verification, usually within 1–2 business days.",
    cta: "Continue on Stripe",
    tone: "warning",
  },
  verified: {
    label: "Verified",
    headline: "Connected to Stripe",
    description:
      "You're ready to receive payouts. Commission is paid on the 1st of each month for the previous month's paid memberships, to the bank account on file with Stripe.",
    cta: "Manage in Stripe",
    tone: "success",
  },
  action_required: {
    label: "Action required",
    headline: "Stripe needs more information",
    description:
      "Stripe has asked for additional details before payouts can continue. Open Stripe to see exactly what's needed.",
    cta: "Resolve on Stripe",
    tone: "danger",
  },
  disabled: {
    label: "Disabled",
    headline: "Payouts are disabled on this account",
    description: "Stripe has disabled payouts for this account. Contact Rysflo support and we'll help you sort it out.",
    cta: "Open Stripe",
    tone: "danger",
  },
};

const TONE = {
  neutral: { bar: "bg-[#308BF9]", text: "text-[#308BF9]", bg: "bg-[#EEF4FE]" },
  warning: { bar: "bg-[#F2A93B]", text: "text-[#A66B00]", bg: "bg-[#FFF4E0]" },
  success: { bar: "bg-[#2EAF6A]", text: "text-[#1F7A4A]", bg: "bg-[#E5F6EE]" },
  danger: { bar: "bg-[#E5484D]", text: "text-[#B5363A]", bg: "bg-[#FCEAEB]" },
};

function Badge({ tone, label }) {
  const c = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full ${c.bg} ${c.text} text-[11px] font-semibold px-3 py-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.bar}`} />
      {label}
    </span>
  );
}

export default function PayoutSetupPanel({ audience = "trainer" }) {
  const search = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const returnedFromStripe = search?.get("return") === "1" || search?.get("refresh") === "1";

  const load = useCallback(async (force) => {
    setLoading(true);
    try {
      setStatus(await fetchConnectStatusService({ forceSync: force }));
    } catch (err) {
      toast.error(err?.message || "Could not load payout status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(returnedFromStripe);
  }, [load, returnedFromStripe]);

  const state = status?.account?.onboarding_status || "not_started";
  const meta = STATES[state] || STATES.not_started;
  const tone = TONE[meta.tone];
  const canOpenDashboard = state === "verified" || (status?.account?.details_submitted && state !== "disabled");

  // Stripe opens in a new tab so the dashboard stays put. The tab is opened
  // synchronously in the click handler (popup blockers refuse one opened
  // after an await) and pointed at Stripe once the link comes back.
  const onCta = async () => {
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    try {
      const res = canOpenDashboard
        ? await createConnectDashboardLinkService()
        : await createConnectOnboardingLinkService();
      if (tab) tab.location = res.url;
      else window.location.assign(res.url); // popup blocked: fall back to same tab
    } catch (err) {
      tab?.close();
      toast.error(err?.message || "Could not open Stripe");
    } finally {
      setBusy(false);
    }
  };

  // The user finishes on Stripe in the other tab; re-sync when they come back.
  useEffect(() => {
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const currency = "USD";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Payout Setup</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          {audience === "facility"
            ? "Connect your facility's Stripe account to receive the gym's referral commission."
            : "Connect a Stripe account to receive your share of referral commission."}{" "}
          Bank details never touch Rysflo's servers.
        </p>
      </div>

      {returnedFromStripe && !loading && state !== "verified" && (
        <div className="rounded-[10px] bg-[#FFF4E0] px-4 py-3 text-[12px] text-[#A66B00]">
          Welcome back. Stripe may still be verifying — this page updates automatically once it&rsquo;s done.
        </div>
      )}

      <div className="bg-[#F5F7FA] rounded-[10px] p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <Badge tone={meta.tone} label={loading ? "Checking…" : meta.label} />
            <h3 className="text-[#252525] text-[18px] font-bold">{meta.headline}</h3>
          </div>
          <div className={`w-1 self-stretch rounded-full ${tone.bar}`} aria-hidden />
        </div>
        <p className="text-[#535359] text-[13px] leading-[1.5]">{meta.description}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onCta}
            disabled={busy || loading}
            className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60 cursor-pointer"
          >
            {busy ? "Opening Stripe…" : meta.cta}
          </button>
          {state === "verified" && (
            <button
              type="button"
              onClick={() => load(true)}
              className="text-[12px] text-[#535359] hover:text-[#252525] cursor-pointer"
            >
              Refresh status
            </button>
          )}
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-[10px] p-4 border border-[#E1E6ED]">
            <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">Awaiting payout</div>
            <div className="text-[#252525] text-[18px] font-bold mt-1">{formatMinor(status.pending_minor, currency)}</div>
            <div className="text-[#A1A1A1] text-[11px] mt-1">Paid on the 1st of next month</div>
          </div>
          <div className="bg-white rounded-[10px] p-4 border border-[#E1E6ED]">
            <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">On hold</div>
            <div className="text-[#252525] text-[18px] font-bold mt-1">{formatMinor(status.held_minor, currency)}</div>
            <div className="text-[#A1A1A1] text-[11px] mt-1">
              {Number(status.held_minor) > 0 ? "Released as soon as Stripe verifies you" : "Nothing on hold"}
            </div>
          </div>
          <div className="bg-white rounded-[10px] p-4 border border-[#E1E6ED]">
            <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">Paid to date</div>
            <div className="text-[#252525] text-[18px] font-bold mt-1">{formatMinor(status.paid_minor, currency)}</div>
            <div className="text-[#A1A1A1] text-[11px] mt-1">Lifetime, via Stripe</div>
          </div>
        </div>
      )}

      <div className="rounded-[10px] border border-[#E1E6ED] p-5">
        <h4 className="text-[#252525] text-[13px] font-bold mb-2">What Stripe will ask for</h4>
        <ol className="text-[#535359] text-[12px] flex flex-col gap-1.5 list-decimal pl-5">
          <li>
            Whether you&rsquo;re paid as an individual or a business
            {audience === "facility" ? " (most gyms choose their LLC or corporation)" : ""}.
          </li>
          <li>Legal name, address and tax ID (SSN or EIN) — collected and held by Stripe only.</li>
          <li>A US bank account for payouts.</li>
          <li>Stripe verifies in 1–2 business days; commission accrues meanwhile.</li>
          <li>At year-end Stripe issues your 1099 for the commission received.</li>
        </ol>
      </div>
    </div>
  );
}
