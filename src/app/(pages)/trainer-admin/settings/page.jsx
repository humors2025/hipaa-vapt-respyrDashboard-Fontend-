export default function TrainerAdminSettingsPage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[#252525] text-[20px] font-bold">Settings</h1>
      <p className="text-[#535359] text-[13px]">
        Profile, payout setup (Stripe Connect), notification preferences.
      </p>
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        Coming in a follow-up PR.
      </div>
    </div>
  );
}
