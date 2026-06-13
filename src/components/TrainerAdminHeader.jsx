"use client";

import React, { useState, useEffect } from "react";
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
  { name: "Earnings",         icon: "/icons/hugeicons_award-01.svg",       path: "/trainer-admin/earnings" },
  { name: "Settings",         icon: "/icons/hugeicons_settings-03.svg",    path: "/trainer-admin/settings" },
];

export default function TrainerAdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [active, setActive] = useState(pathname);

  useEffect(() => {
    setActive(pathname);
  }, [pathname]);

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
      <div className="flex justify-between bg-[#F5F7FA] p-4">
        <div className="flex items-center gap-3">
          <Link href="/trainer-admin/trainers">
            <div className="flex flex-col items-center">
              <img src="/icons/logorespyr.png" alt="logo" width={50} height={50} />
            </div>
          </Link>
        </div>

        <div className="flex gap-2 items-center">
          {MENU.map((m) => {
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
              <div className="absolute right-0 top-full w-48 bg-white rounded-[15px] shadow-lg p-1.5 z-50">
                <button
                  onClick={handleLogout}
                  className="flex items-center cursor-pointer w-full px-4 py-3 text-sm text-[#A1A1A1] hover:bg-gray-100 transition-colors"
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