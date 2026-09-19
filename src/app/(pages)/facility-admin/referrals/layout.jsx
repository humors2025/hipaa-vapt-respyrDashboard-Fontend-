import ReferralsTabs from "@/components/referrals/ReferralsTabs";

export default function ReferralsLayout({ children }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Referrals</h1>
        <p className="text-[#535359] text-[13px] mt-1">Your facility's referral codes, the members they brought in, and who's linked the app.</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <ReferralsTabs base="/facility-admin" />
        <section className="flex-1 min-w-0 bg-white rounded-[15px] p-6">{children}</section>
      </div>
    </div>
  );
}
