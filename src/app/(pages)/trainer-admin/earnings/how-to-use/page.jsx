export default function TrainerAdminHowToUsePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">How to Use</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          A walkthrough of override earnings — how they're calculated, when they're paid, and what to do as a Trainer Admin.
        </p>
      </div>

      <ol className="flex flex-col gap-5 text-[13px] text-[#535359]">
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">1. Recruit trainers</span>
          <span>
            Use the <strong>Trainers</strong> tab to invite people you trust to onboard clients
            under your network. Each one signs up with your verification flow.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">2. Earn override</span>
          <span>
            For every client your trainers onboard, you earn <strong>20% override</strong> on
            their subscription, on top of the trainer's own 20% direct commission.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">3. Project earnings</span>
          <span>
            On the <strong>Calculator</strong> tab, model how many active clients across your
            network gives you what monthly and annual override.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">4. Set up payouts</span>
          <span>
            Connect Stripe on the <strong>Payout Setup</strong> tab. Without this, override accrues
            but can't be paid out.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">5. Track performance</span>
          <span>
            The <strong>Overview</strong> tab shows your this-month override, annual projection,
            and per-trainer breakdown so you know who in your network is driving earnings.
          </span>
        </li>
      </ol>

      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px]">
        FAQ + short explainer video placeholder. Add common questions here as Trainer Admins ask them
        during the soft launch.
      </div>
    </div>
  );
}
