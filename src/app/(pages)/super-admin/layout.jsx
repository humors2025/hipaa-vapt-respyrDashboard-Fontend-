import SuperAdminHeader from "@/components/SuperAdminHeader";

export default function SuperAdminLayout({ children }) {
  return (
    <>
      <SuperAdminHeader />
      {children}
    </>
  );
}
