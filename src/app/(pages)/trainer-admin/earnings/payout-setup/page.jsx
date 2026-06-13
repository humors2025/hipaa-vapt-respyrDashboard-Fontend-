"use client";

import { useState } from "react";
import { toast } from "sonner";

const STATES = {
  not_started: {
    headline: "Set up payouts to start earning",
    description:
      "Connect a Stripe account so we can send your override commission. Stripe handles bank verification, ID, and year-end tax forms — we never see your bank details.",
    cta: "Connect with Stripe",
    tone: "neutral",
  },
  pending: {
    headline: "Stripe onboarding in progress",
    description:
      "You started setup but haven't finished verifying your account. Override commission is accruing, but no payouts will be sent until verification completes.",
    cta: "Continue setup",
    tone: "warning",
  },
  verified: {
    headline: "Connected to Stripe",
    description:
      "Your account is verified and ready to receive override payouts. Commissions are paid out monthly to the bank account on file with Stripe.",
    cta: "Manage in Stripe",
    tone: "success",
  },
  action_required: {
    headline: "Stripe needs more information",
    description:
      "Stripe has flagged your account and requires additional information (often tax ID or address verification) before payouts can resume.",
    cta: "Resolve in Stripe",
    tone: "danger",
  },
};

const TONE_CLASSES = {
  neutral: { bar: "bg-[#308BF9]", text: "text-[#308BF9]", bg: "bg-[#EEF4FE]" },
  warning: { bar: "bg-[#F2A93B]", text: "text-[#A66B00]", bg: "bg-[#FFF4E0]" },
  success: { bar: "bg-[#2EAF6A]", text: "text-[#1F7A4A]", bg: "bg-[#E5F6EE]" },
  danger:  { bar: "bg-[#E5484D]", text: "text-[#B5363A]", bg: "bg-[#FCEAEB]" },
};

async function startStripeOnboarding() {
  await new Promise((r) => setTimeout(r, 300));
  toast.info("Stripe Connect onboarding will open in a new tab once backend wiring is complete.");
}

function StatusBadge({ tone, label }) {
  const c = TONE_CLASSES[tone];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full ${c.bg} ${c.text} text-[11px] font-semibold px-3 py-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.bar}`} />
      {label}
    </span>
  );
}

function StateCard({ state }) {
  const meta = STATES[state];
  const tone = TONE_CLASSES[meta.tone];
  const stateLabels = {
    not_started: "Not set up",
    pending: "Verification pending",
    verified: "Verified",
    action_required: "Action required",
  };

  const onClick = async () => {
    if (state === "verified" || state === "action_required") {
      toast.info("Will deep-link to the Stripe Express dashboard once backend wires the account ID.");
      return;
    }
    await startStripeOnboarding();
  };

  return (
    <div className="bg-[#F5F7FA] rounded-[10px] p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2">
          <StatusBadge tone={meta.tone} label={stateLabels[state]} />
          <h3 className="text-[#252525] text-[18px] font-bold">{meta.headline}</h3>
        </div>
        <div className={`w-1 self-stretch rounded-full ${tone.bar}`} aria-hidden />
      </div>
      <p className="text-[#535359] text-[13px] leading-[1.5]">{meta.description}</p>
      <div>
        <button
          type="button"
          onClick={onClick}
          className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5"
        >
          {meta.cta}
        </button>
      </div>
    </div>
  );
}

export default function TrainerAdminPayoutSetupPage() {
  const [state, setState] = useState("not_started");
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Payout Setup</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          Connect a Stripe account so we can send override commission. Stripe Connect Express
          handles bank, ID, and year-end tax forms — bank details never touch our servers.
        </p>
      </div>

      <StateCard state={state} />

      <div className="rounded-[10px] border border-[#E1E6ED] p-5">
        <h4 className="text-[#252525] text-[13px] font-bold mb-2">What happens after you connect</h4>
        <ol className="text-[#535359] text-[12px] flex flex-col gap-1.5 list-decimal pl-5">
          <li>Stripe asks for legal name, date of birth, address, and SSN/EIN.</li>
          <li>You add a US bank account (routing + account number).</li>
          <li>Stripe verifies in 1–2 business days.</li>
          <li>Once verified, your monthly override commission is paid to that account.</li>
          <li>At year-end, Stripe issues a 1099-NEC for your taxes.</li>
        </ol>
      </div>

      {isDev && (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-4">
          <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide mb-2">
            Dev preview — switch state
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(STATES).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                className={[
                  "rounded-[8px] px-3 py-1.5 text-[11px] font-semibold border transition-colors",
                  state === s ? "bg-[#308BF9] text-white border-[#308BF9]" : "bg-white text-[#535359] border-[#E1E6ED] hover:bg-[#F5F7FA]",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
