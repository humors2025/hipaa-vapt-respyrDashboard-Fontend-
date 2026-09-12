import ReferralQrCard from "@/components/earnings/ReferralQrCard";
export default function FacilityAdminQrPage() {
  return (
    <div className="bg-white rounded-[15px] p-6">
      <ReferralQrCard
        title="Your facility's QR code"
        subtitle="Print this for the wall and front desk. Every member who signs up through it is credited 100% to the facility."
      />
    </div>
  );
}
