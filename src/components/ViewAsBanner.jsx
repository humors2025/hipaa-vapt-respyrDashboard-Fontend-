"use client";

// Orange ribbon shown on every page while a super-admin "View as" session is
// active (the access token carries impersonated_by — see lib/viewAs.js).
// Renders above the role header in (pages)/layout.jsx. "Exit view" restores
// the super admin's own session and returns to the View as page.
//
// The view token expires on its own (VIEW_AS_TTL server-side); when the silent
// refresh swaps the super admin's token back in, the next render finds no
// impersonated_by claim, cleans up the saved copies and the ribbon disappears.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { getViewAsInfo, exitViewAs, cleanupStaleViewAs } from "@/lib/viewAs";

const ROLE_LABEL = {
  admin: "Trainer admin",
  trainer_admin: "Trainer admin",
  facility_admin: "Facility admin",
  trainer: "Trainer",
};

export default function ViewAsBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [info, setInfo] = useState(null);

  // Cookies exist only in the browser: resolve after mount (and on every
  // navigation) so server HTML and first client render agree.
  useEffect(() => {
    cleanupStaleViewAs();
    setInfo(getViewAsInfo());
  }, [pathname]);

  // Catch in-place expiry (silent refresh restored the admin token without a
  // navigation) so the ribbon doesn't outlive the view session.
  useEffect(() => {
    if (!info) return undefined;
    const t = setInterval(() => {
      const current = getViewAsInfo();
      if (!current) cleanupStaleViewAs();
      setInfo(current);
    }, 30000);
    return () => clearInterval(t);
  }, [info]);

  if (!info) return null;

  const handleExit = () => {
    exitViewAs();
    setInfo(null);
    router.push("/super-admin/view-as");
    setTimeout(() => router.refresh(), 50);
  };

  const roleLabel = ROLE_LABEL[String(info.role || "").toLowerCase()] || info.role;

  return (
    <div className="sticky top-0 z-[10000] bg-[#E97F0F] text-white px-[25px] py-2 flex items-center justify-between gap-3 flex-wrap shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <Eye size={16} aria-hidden />
        <span className="text-[12px] font-semibold truncate">
          Viewing as {info.name || info.email}
          {roleLabel ? ` (${roleLabel})` : ""} — read-only, changes are disabled
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        className="flex items-center gap-1.5 bg-white text-[#E97F0F] text-[12px] font-bold rounded-[8px] px-3 py-1.5 hover:bg-[#FFF4E8] cursor-pointer flex-shrink-0"
      >
        <LogOut size={14} aria-hidden />
        Exit view
      </button>
    </div>
  );
}
