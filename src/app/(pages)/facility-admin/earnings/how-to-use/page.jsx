export default function FacilityAdminHowToUsePage() {
  return (
    <div className="flex flex-col gap-6 text-[13px] text-[#535359] leading-[1.6]">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">How the referral programme works</h2>
        <p className="mt-1">Members pay Rysflo directly. Rysflo pays your facility a commission. You decide how much of it your trainers keep.</p>
      </div>
      <ol className="flex flex-col gap-3 list-decimal pl-5">
        <li>
          <strong className="text-[#252525]">Put your QR code up.</strong> Your facility&rsquo;s code (QR Code tab) goes on the wall and the front desk.
          Each trainer also gets their own code in their app.
        </li>
        <li>
          <strong className="text-[#252525]">A member signs up.</strong> They scan a code, subscribe to Rysflo ($29/month, device included) and the
          sale is credited to whichever code they used.
        </li>
        <li>
          <strong className="text-[#252525]">Commission accrues every month.</strong> Rysflo pays the facility a percentage of every monthly payment
          the member actually makes — for as long as they stay subscribed. Readings the member takes reduce their bill (20¢ per day, up to $6),
          and commission is calculated on the amount actually charged.
        </li>
        <li>
          <strong className="text-[#252525]">You set each trainer&rsquo;s share.</strong> On the Trainers page, choose 0–100% per trainer for
          members who signed up under that trainer&rsquo;s code. Members who used the facility&rsquo;s own code pay 100% to the facility.
          Changes apply to future payments.
        </li>
        <li>
          <strong className="text-[#252525]">Payouts on the 1st.</strong> Each month Rysflo transfers the previous month&rsquo;s commission to the
          Stripe account you connected under Payout Setup. Trainers with a share are paid to their own Stripe accounts. Stripe handles W-9s and 1099s.
        </li>
        <li>
          <strong className="text-[#252525]">If a trainer leaves,</strong> remove them on the Trainers page. Their members, and the commission from
          those members, move to the facility immediately.
        </li>
      </ol>
    </div>
  );
}
