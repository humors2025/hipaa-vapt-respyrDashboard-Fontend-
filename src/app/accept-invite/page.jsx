"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  useEffect(() => {
    const params = new URLSearchParams();

    if (token) {
      params.set("token", token);
    }

    // Pass through any invite metadata from the URL
    for (const key of ["email", "role", "first_name", "last_name"]) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }

    router.replace(`/signup?${params.toString()}`);
  }, [token, searchParams, router]);

  return (
    <div className="bg-white shadow-lg rounded-[12px] p-8 max-w-md w-full text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#308BF9] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#535359] text-[13px]">Redirecting to signup...</p>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-svh w-full flex items-center justify-center p-6 bg-[#F5F7FA]">
      <Suspense
        fallback={
          <div className="bg-white shadow-lg rounded-[12px] p-8 max-w-md w-full text-center">
            <p className="text-[#A1A1A1] text-[13px]">Loading...</p>
          </div>
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
