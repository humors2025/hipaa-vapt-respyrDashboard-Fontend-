import { Suspense } from "react";
import SuccessContent from "./SuccessContent";

export const metadata = { title: "Welcome to Rysflo" };

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F5F7FA]" />}>
      <SuccessContent />
    </Suspense>
  );
}
