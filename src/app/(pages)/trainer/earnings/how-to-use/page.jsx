export default function HowToUsePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">How to Use</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          A walkthrough of the referrals and payout flow. Each step links to
          the section where you can take action.
        </p>
      </div>

      <ol className="flex flex-col gap-5 text-[13px] text-[#535359]">
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">1. Get your partner code</span>
          <span>
            Find your unique code on the <strong>Referrals</strong> tab. Share
            it verbally, by message, or via the invite form.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">2. Invite clients</span>
          <span>
            Use the invite form on the <strong>Referrals</strong> tab to send
            an automated WhatsApp + Email with a deep link to the app — your
            partner code is attached automatically.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">3. See projected earnings</span>
          <span>
            On the <strong>Calculator</strong> tab, enter how many clients
            you have at each tier to project monthly and annual payout.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">4. Set up payouts</span>
          <span>
            Connect your account on the <strong>Payout Setup</strong> tab.
            Without this, commissions accrue but can't be paid out.
          </span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="text-[#252525] font-semibold">5. Track performance</span>
          <span>
            The <strong>Overview</strong> tab shows this-month commission,
            pending payout, and active referred clients.
          </span>
        </li>
      </ol>

      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px]">
        FAQ + short explainer video placeholder. Add common questions here as
        trainers ask them during the soft launch.
      </div>
    </div>
  );
}
