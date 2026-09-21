import { Suspense } from "react";
import PayoutSetupPanel from "@/components/earnings/PayoutSetupPanel";
export default function FacilityAdminPayoutSetupPage() {
  return (
    <Suspense fallback={<div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>}>
      <PayoutSetupPanel audience="facility" />
    </Suspense>
  );
}
