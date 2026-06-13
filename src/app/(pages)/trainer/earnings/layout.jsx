import EarningsTabs from "@/components/earnings/EarningsTabs";

export default function EarningsLayout({ children }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
          Referrals & Payout
        </h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Manage your partner code, track commissions, and set up how you get paid.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <EarningsTabs />
        <section className="flex-1 min-w-0 bg-white rounded-[15px] p-6">
          {children}
        </section>
      </div>
    </div>
  );
}
