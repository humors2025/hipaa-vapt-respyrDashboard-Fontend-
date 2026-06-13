"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cookieManager } from "@/lib/cookies";
import Header from "@/components/Header";
import TrainerAdminHeader from "@/components/TrainerAdminHeader";
import SuperAdminHeader from "@/components/SuperAdminHeader";

// Decode the role claim straight from the access_token JWT (same approach the
// trainer Header uses).
function decodeAccessTokenRole() {
  try {
    const token = cookieManager.get("access_token");
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload)?.role ?? null;
  } catch {
    return null;
  }
}

// Picks the header shell for /trainer/* screens. Only the Client Directory
// screen adopts the admin header shell, so an admin/super_admin who arrives via
// their "Client Directory" link keeps their own nav. Every other /trainer/*
// screen — including /trainer/dashboard ("View my clients") — keeps the
// original trainer Header (with its Admin Panel switch).
export default function TrainerHeaderSwitch() {
  const pathname = usePathname();
  const [role, setRole] = useState(null);

  useEffect(() => {
    setRole(decodeAccessTokenRole());
  }, []);

  if (pathname?.startsWith("/trainer/client-directory")) {
    if (role === "super_admin") return <SuperAdminHeader />;
    if (role === "admin" || role === "trainer_admin") return <TrainerAdminHeader />;
  }

  return <Header />;
}
