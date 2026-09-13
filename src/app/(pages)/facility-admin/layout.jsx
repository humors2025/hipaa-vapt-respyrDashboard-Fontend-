import FacilityAdminHeader from "@/components/FacilityAdminHeader";

export default function FacilityAdminLayout({ children }) {
  return (
    <>
      <FacilityAdminHeader />
      {children}
    </>
  );
}
