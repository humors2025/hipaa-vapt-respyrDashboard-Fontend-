"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Cookies from "js-cookie";
import { toast } from "sonner";
import {
  fetchConnectStatusService,
  createConnectOnboardingLinkService,
} from "@/services/commissionService";

/**
 * Login nudge for payees who haven't finished Stripe Connect onboarding.
 *
 * Mount it in a role layout; on first render it checks the payout status and,
 * when onboarding is still not_started (or Stripe kicked it back with
 * action_required), shows a blocking popup whose CTA jumps straight into the
 * Stripe onboarding flow.
 *
 * The payee role is read from the access_token JWT, so the same component
 * works in the trainer, trainer-admin and facility-admin layouts (and stays
 * quiet for non-payees like super admins, who also render those layouts).
 *
 * Dismissal is keyed to the login session id (the `sid` claim of the
 * access_token JWT): "I'll do this later" silences it for the current login
 * only, so every fresh login shows the popup again until payouts are set up.
 */

const DISMISS_KEY = "respyr_payout_reminder_dismissed_sid";

// Where each payee role's payout-setup page lives. Roles not listed here
// (super_admin, client) never see the reminder.
const SETUP_PATHS = {
  facility_admin: "/facility-admin/earnings/payout-setup",
  trainer_admin: "/trainer-admin/earnings/payout-setup",
  admin: "/trainer-admin/earnings/payout-setup",
  trainer: "/trainer/earnings/payout-setup",
  dietician: "/trainer/earnings/payout-setup",
};

// Claims of the current access token, or null when it can't be read (then we
// stay quiet rather than nag someone we can't identify).
function tokenClaims() {
  try {
    const token = Cookies.get("access_token");
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// The `sid` claim — a new value on every login, stable across in-session
// token refreshes.
function currentLoginSid() {
  const sid = tokenClaims()?.sid;
  return sid != null ? String(sid) : null;
}

function payoutSetupPathForToken() {
  const role = String(tokenClaims()?.role || "").trim().toLowerCase();
  return SETUP_PATHS[role] || null;
}

export default function PayoutSetupReminder() {
  const pathname = usePathname();
  const [state, setState] = useState(null); // "not_started" | "action_required"
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [payoutSetupPath, setPayoutSetupPath] = useState(null);

  // Don't nag on the payout-setup page itself (any role's — also covers the
  // ?return=1 redirect back from Stripe, which lands there).
  const onSetupPage = pathname?.includes("/earnings/payout-setup");

  useEffect(() => {
    if (onSetupPage) return;
    // Cookies only exist client-side, so resolve the role in the effect
    // (never during SSR/hydration).
    const setupPath = payoutSetupPathForToken();
    if (!setupPath) return; // not a payee (e.g. super admin) or no token
    setPayoutSetupPath(setupPath);
    try {
      const sid = currentLoginSid();
      // Dismissed during THIS login session → stay quiet. A new login has a
      // new sid, so the stored value no longer matches and we check again.
      if (sid && sessionStorage.getItem(DISMISS_KEY) === sid) return;
    } catch {
      /* private mode: just check every time */
    }
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchConnectStatusService();
        const s = status?.account?.onboarding_status || "not_started";
        if (!cancelled && (s === "not_started" || s === "action_required")) {
          setState(s);
        }
      } catch {
        // Silent: the reminder is best-effort, the earnings page still shows
        // the real status.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onSetupPage]);

  if (!state || dismissed || onSetupPage) return null;

  const dismiss = () => {
    try {
      const sid = currentLoginSid();
      if (sid) sessionStorage.setItem(DISMISS_KEY, sid);
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  // Stripe opens in a new tab so the dashboard stays put. The tab is opened
  // synchronously in the click handler (popup blockers refuse one opened
  // after an await) and pointed at Stripe once the link comes back. The
  // reminder then dismisses itself for this login; the earnings page shows
  // the real status once they're done.
  const onSetup = async () => {
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    try {
      const res = await createConnectOnboardingLinkService();
      if (tab) {
        tab.location = res.url;
        dismiss();
      } else {
        window.location.assign(res.url); // popup blocked: fall back to same tab
      }
    } catch (err) {
      tab?.close();
      toast.error(err?.message || "Could not open Stripe");
    } finally {
      setBusy(false);
    }
  };

  const copy =
    state === "action_required"
      ? {
          headline: "Stripe needs more information",
          body: "Stripe has asked for additional details before your referral commission can be paid out. It only takes a couple of minutes to resolve.",
          cta: "Resolve on Stripe",
        }
      : {
          headline: "Set up payouts to receive your commission",
          body: "Your referral commission is accruing, but we can't pay it out until you connect with Stripe. Stripe collects your bank details securely — nothing is stored by Rysflo.",
          cta: "Set up payouts with Stripe",
        };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Payout setup reminder"
    >
      <div className="w-full max-w-[420px] bg-white rounded-[15px] p-6 flex flex-col gap-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF4E0] text-[#A66B00] text-[11px] font-semibold px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F2A93B]" />
            Payout setup incomplete
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={dismiss}
            className="text-[#A1A1A1] hover:text-[#252525] cursor-pointer leading-none text-[18px]"
          >
            &times;
          </button>
        </div>

        <div>
          <h3 className="text-[#252525] text-[18px] font-bold">{copy.headline}</h3>
          <p className="text-[#535359] text-[13px] leading-[1.5] mt-2">{copy.body}</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSetup}
            disabled={busy}
            className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60 cursor-pointer"
          >
            {busy ? "Opening Stripe…" : copy.cta}
          </button>
          <div className="flex items-center justify-between">
            {payoutSetupPath ? (
              <Link
                href={payoutSetupPath}
                onClick={dismiss}
                className="text-[12px] text-[#308BF9] hover:underline"
              >
                View payout details
              </Link>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={dismiss}
              className="text-[12px] text-[#535359] hover:text-[#252525] cursor-pointer"
            >
              I&rsquo;ll do this later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
