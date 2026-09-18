import FacilityAdminHeader from "@/components/FacilityAdminHeader";
import PayoutSetupReminder from "@/components/earnings/PayoutSetupReminder";

export default function FacilityAdminLayout({ children }) {
  return (
    <>
      <FacilityAdminHeader />
      <PayoutSetupReminder payoutSetupPath="/facility-admin/earnings/payout-setup" />
      {children}
    </>
  );
}
