"use client";

export default function PayoutsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
          Payouts
        </h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Pending and paid commissions across the network.
        </p>
      </div>

      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-8 text-center">
        <p className="text-[#A1A1A1] text-[13px]">
          Payouts require a dedicated API and Stripe Connect integration.
        </p>
        <p className="text-[#A1A1A1] text-[11px] mt-2">
          Needed: monthly commission pipeline API, per-recipient payout
          amounts, payout status tracking (pending/paid), Stripe Transfer
          webhook handler.
        </p>
      </div>
    </div>
  );
}
