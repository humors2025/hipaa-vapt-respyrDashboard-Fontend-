"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cookieManager } from "@/lib/cookies";
import { toast } from "sonner";

const MonoIcon = ({ src, size = 20, color = "#A1A1A1", alt = "" }) => (
  <span
    role="img"
    aria-label={alt}
    style={{
      width: size,
      height: size,
      display: "inline-block",
      backgroundColor: color,
      WebkitMaskImage: `url(${src})`,
      maskImage: `url(${src})`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskPosition: "center",
      maskPosition: "center",
    }}
  />
);

const MENU = [
  { name: "Overview",         icon: "/icons/hugeicons_home-05.svg",        path: "/trainer-admin/trainers" },
  { name: "View my clients",  icon: "/icons/hugeicons_user-group.png",     path: "/trainer/dashboard" },
  { name: "Client Directory", icon: "/icons/hugeicons_user-circle-02.svg", path: "/trainer/client-directory" },
  { name: "Invites Trainer",  icon: "/icons/hugeicons_award-01.svg",       path: "/trainer-admin/invites" },
  { name: "TA Analytics",     icon: "/icons/hugeicons_view.svg",           path: "/trainer-admin/analytics" },
  { name: "Earnings",         icon: "/icons/hugeicons_award-01.svg",       path: "/trainer-admin/earnings" },
];

// The "TA Analytics" tab is hidden when the manage_admin_groups.php response
// returned an empty `groups` array at login. Login sets the
// "ta_analytics_enabled" cookie to "1" only when there is at least one group.
const TA_ANALYTICS_PATH = "/trainer-admin/analytics";

export default function TrainerAdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [active, setActive] = useState(pathname);
  // Whether the TA Analytics tab is visible. Read from the cookie in an effect
  // (js-cookie is client-only) so the first render matches the server and we
  // avoid a hydration mismatch. Defaults to hidden until the flag is confirmed.
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const mobileMenuRef = useRef(null);

  useEffect(() => {
    setActive(pathname);
    // close everything on navigation
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [pathname]);

  // close the drawer when tapping outside (needed for touch devices)
  useEffect(() => {
    const handleOutside = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  useEffect(() => {
    setShowAnalytics(cookieManager.get("ta_analytics_enabled") === "1");
  }, []);

  const menu = showAnalytics
    ? MENU
    : MENU.filter((m) => m.path !== TA_ANALYTICS_PATH);

  const handleLogout = () => {
    try {
      cookieManager.clearAuth();
      localStorage.clear();
      setIsDropdownOpen(false);
      router.push("/");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const handleNotificationClick = () => {
    toast.info("Coming Soon");
  };

  return (
    <>
      <div className="flex justify-between items-center bg-[#F5F7FA] p-4">
        {/* Left: hamburger (tab/mobile only) + logo */}
        <div className="flex items-center gap-3" ref={mobileMenuRef}>
          <button
            type="button"
            aria-label="Open menu"
            className="xl:hidden flex items-center cursor-pointer rounded-[15px] p-[13px] bg-white"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
          >
            {isMobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6l12 12M18 6L6 18" stroke="#252525" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="#252525" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <Link href="/trainer-admin/trainers">
            <div className="flex flex-col items-center">
              <img src="/icons/logorespyr.png" alt="logo" width={50} height={50} />
            </div>
          </Link>

          {/* Mobile / tablet drawer */}
          {isMobileMenuOpen && (
            <div className="xl:hidden absolute left-4 right-4 top-[82px] z-50 bg-white rounded-[15px] shadow-lg border border-gray-100 p-2">
              {menu.map((m) => {
                const isActive =
                  pathname === m.path ||
                  pathname?.startsWith(m.path + "/") ||
                  active === m.path;
                const color = isActive ? "#308BF9" : "#A1A1A1";

                return (
                  <Link
                    key={m.name}
                    href={m.path}
                    onClick={() => {
                      setActive(m.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-[10px] hover:bg-gray-100"
                  >
                    <MonoIcon src={m.icon} color={color} alt={m.name} />
                    <span className="font-semibold text-[12px]" style={{ color }}>
                      {m.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Center: desktop pill nav (hidden below xl) */}
        <div className="hidden xl:flex gap-2 items-center">
          {menu.map((m) => {
            const isActive =
              pathname === m.path ||
              pathname?.startsWith(m.path + "/") ||
              active === m.path;
            const color = isActive ? "#308BF9" : "#A1A1A1";

            return (
              <Link href={m.path} key={m.name}>
                <button
                  className="flex items-center gap-1.5 cursor-pointer rounded-[15px] px-[20px] py-[15px] bg-white"
                  onClick={() => setActive(m.path)}
                >
                  <MonoIcon src={m.icon} color={color} alt={m.name} />
                  <span className="font-semibold text-[12px]" style={{ color }}>
                    {m.name}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center cursor-pointer rounded-[15px] p-[13px] bg-white"
            onClick={handleNotificationClick}
          >
            <MonoIcon src="/icons/hugeicons_notification-01.svg" color="#A1A1A1" alt="notification" />
          </div>

          <div
            className="relative"
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <div className="flex items-center cursor-pointer rounded-[15px] p-[13px] bg-white">
              <MonoIcon src="/icons/hugeicons_user.svg" color="#A1A1A1" size={20} alt="user" />
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full w-48 bg-white rounded-[15px] shadow-lg p-1.5 z-50 ">
                <Link href="/trainer-admin/settings">
                  <button
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center cursor-pointer w-full px-4 py-3 text-sm text-[#A1A1A1] hover:bg-gray-100 transition-colors rounded-[12px]"
                  >
                    <MonoIcon src="/icons/hugeicons_settings-03.svg" color="#A1A1A1" size={18} alt="settings" />
                    <span className="ml-3 cursor-pointer">Settings</span>
                  </button> 
                </Link>

                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="flex items-center cursor-pointer w-full px-4 py-3 text-sm text-[#A1A1A1] hover:bg-gray-100 transition-colors rounded-[12px]"
                >
                  <span className="ml-3 cursor-pointer">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#F5F7FA] pb-4">
        <span className="inline-block rounded-full bg-[#308BF9] text-white text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide whitespace-nowrap">
          Trainer Admin
        </span>
      </div>
    </>
  );
}