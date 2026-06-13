"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function Home() {
  return (
    <div
      className="flex items-center pl-[25px] w-full min-h-screen"
      style={{
        backgroundImage: "url('/icons/dietician_image_freepik.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Suspense fallback={<div className="text-lg text-[#252525]">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}