import Header from "@/components/Header";

export default function SuperAdminTrainerLayout({ children }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
