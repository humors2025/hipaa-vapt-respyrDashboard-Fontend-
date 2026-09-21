import FacilityAdminEarningsTabs from "@/components/earnings/FacilityAdminEarningsTabs";

export default function FacilityAdminEarningsLayout({ children }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Earnings</h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Your facility&rsquo;s referral commission, trainer shares, and payouts.
        </p>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <FacilityAdminEarningsTabs />
        <section className="flex-1 min-w-0 bg-white rounded-[15px] p-6">{children}</section>
      </div>
    </div>
  );
}
