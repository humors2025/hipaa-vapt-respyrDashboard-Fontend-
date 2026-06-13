export default function SuperAdminSettingsPage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[#252525] text-[20px] font-bold">Settings</h1>
      <p className="text-[#535359] text-[13px]">
        System-wide configuration: commission rates, invite expiry, feature flags,
        and audit log access.
      </p>
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        Coming in Phase 7. Reads/writes the <code>config</code> table.
      </div>
    </div>
  );
}
