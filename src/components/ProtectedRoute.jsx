"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cookieManager } from "../lib/cookies";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const token = cookieManager.get("access_token");

    // If no token → redirect to login
    if (!token) {
      router.replace("/");
      return;
    }

    // Token exists → allow page to show
    setIsVerified(true);
  }, [router]);

  // Optional: loader until redirect or verify
  if (!isVerified) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}
