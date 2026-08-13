"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cookieManager } from "@/lib/cookies";
import { ROLES } from "@/lib/user";
import { toast } from "sonner";
import RoleSwitcher, { isSwitchedView } from "@/components/RoleSwitcher";

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
  { name: "Overview",       icon: "/icons/hugeicons_home-05.svg",         path: "/super-admin/overview" },
  { name: "Trainer Admins", icon: "/icons/hugeicons_user-group.png",      path: "/super-admin/trainer-admins" },
  { name: "Trainers",       icon: "/icons/hugeicons_award-01.svg",        path: "/super-admin/trainers" },
  { name: "Invites Trainers",        icon: "/icons/hugeicons_award-01.svg",        path: "/trainer-admin/invites" },
  {
    name: "Client",
    icon: "/icons/hugeicons_user.svg",
    // path: "/super-admin/client-directory",
    submenu: [
      { name: "Client Directory", path: "/super-admin/client-directory" },
      { name: "All Clients", path: "/super-admin/all-clients" },
    ],
  },
  { name: "TA Analytics",    icon: "/icons/hugeicons_note-01.svg",        path: "/super-admin/analytics" },
];

const DROPDOWN_MENU = [
  { name: "Payouts",   icon: "/icons/hugeicons_file-export.svg",  path: "/super-admin/payouts" },
  { name: "Audit log", icon: "/icons/hugeicons_note-01.svg",      path: "/super-admin/audit-logs" },
  { name: "Settings",  icon: "/icons/hugeicons_settings-03.svg",  path: "/super-admin/settings" },
];

export default function SuperAdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [active, setActive] = useState(pathname);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = useState(null);

  const profileRef = useRef(null);
  const submenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    setActive(pathname);
    // close everything on navigation
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
    setOpenSubmenu(null);
  }, [pathname]);

  // close dropdowns / drawer when tapping outside (needed for touch devices)
  useEffect(() => {
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
      if (submenuRef.current && !submenuRef.current.contains(e.target)) {
        setOpenSubmenu(null);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

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

  const isItemActive = (path) =>
    pathname === path || pathname?.startsWith(path + "/") || active === path;

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

          <Link href="/super-admin/overview">
            <div className="flex flex-col items-center">
              <img src="/icons/logorespyr.png" alt="logo" width={50} height={50} />
            </div>
          </Link>

          {/* Mobile / tablet drawer */}
          {isMobileMenuOpen && (
            <div className="xl:hidden absolute left-4 right-4 top-[82px] z-50 bg-white rounded-[15px] shadow-lg border border-gray-100 p-2">
              {MENU.map((m) => {
                if (m.submenu) {
                  const isOpen = mobileSubmenuOpen === m.name;
                  return (
                    <div key={m.name}>
                      <button
                        type="button"
                        className="flex items-center justify-between w-full px-4 py-3 rounded-[10px] hover:bg-gray-100"
                        onClick={() => setMobileSubmenuOpen(isOpen ? null : m.name)}
                      >
                        <span className="flex items-center gap-3">
                          <MonoIcon src={m.icon} color="#A1A1A1" alt={m.name} />
                          <span className="font-semibold text-[12px] text-[#A1A1A1]">{m.name}</span>
                        </span>
                        <svg
                          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path stroke="#A1A1A1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen &&
                        m.submenu.map((sub) => {
                          const subActive = isItemActive(sub.path);
                          return (
                            <Link
                              key={sub.name}
                              href={sub.path}
                              onClick={() => {
                                setActive(sub.path);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`flex items-center w-full pl-12 pr-4 py-2.5 rounded-[10px] hover:bg-gray-100 font-semibold text-[12px] ${
                                subActive ? "text-[#308BF9]" : "text-[#A1A1A1]"
                              }`}
                            >
                              {sub.name}
                            </Link>
                          );
                        })}
                    </div>
                  );
                }

                const itemActive = isItemActive(m.path);
                const color = itemActive ? "#308BF9" : "#A1A1A1";
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

        {/* Center: desktop pill nav (unchanged above lg, hidden below) */}
        <div className="flex gap-2 items-center">
          <div className="hidden xl:flex gap-2 items-center">
            {MENU.map((m) => {
              const itemActive = isItemActive(m.path);
              const color = itemActive ? "#308BF9" : "#A1A1A1";

              if (m.submenu) {
                const isOpen = openSubmenu === m.name;
                return (
                  <div
                    key={m.name}
                    className="relative"
                    ref={submenuRef}
                    onMouseEnter={() => setOpenSubmenu(m.name)}
                    onMouseLeave={() => setOpenSubmenu(null)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (m.path) {
                          setActive(m.path);
                          router.push(m.path);
                        } else {
                          // tap fallback for touch devices where hover doesn't fire
                          setOpenSubmenu(isOpen ? null : m.name);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 cursor-pointer rounded-[15px] px-[16px] py-[12px] bg-white whitespace-nowrap"
                    >
                      <MonoIcon src={m.icon} color={color} alt={m.name} />
                      <span className="font-semibold text-[12px]" style={{ color }}>
                        {m.name}
                      </span>
                      <svg
                        className={`w-3 h-3 ms-1 -me-0.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                        style={{ color }}
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="m19 9-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 top-full z-50 bg-white border border-gray-100 rounded-[15px] shadow-lg w-48">
                        <ul className="p-2 text-sm font-medium">
                          {m.submenu.map((sub) => {
                            const subActive = isItemActive(sub.path);
                            return (
                              <li key={sub.name}>
                                <Link
                                  href={sub.path}
                                  onClick={() => {
                                    setActive(sub.path);
                                    setOpenSubmenu(null);
                                  }}
                                  className={`inline-flex items-center w-full p-2 rounded hover:bg-gray-100 font-semibold text-[12px] ${
                                    subActive ? "text-[#308BF9]" : "text-[#A1A1A1] hover:text-[#252525]"
                                  }`}
                                >
                                  {sub.name}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link href={m.path} key={m.name}>
                  <button
                    className="flex items-center gap-1.5 cursor-pointer rounded-[15px] px-[16px] py-[12px] bg-white whitespace-nowrap"
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
          <RoleSwitcher currentRole={ROLES.SUPER_ADMIN} />
        </div>

        {/* Right: notification + profile */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center cursor-pointer rounded-[15px] p-[13px] bg-white"
            onClick={handleNotificationClick}
          >
            <MonoIcon src="/icons/hugeicons_notification-01.svg" color="#A1A1A1" alt="notification" />
          </div>

          <div
            className="relative"
            ref={profileRef}
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <button
              type="button"
              aria-label="Account menu"
              className="flex items-center cursor-pointer rounded-[15px] p-[13px] bg-white"
              onClick={() => setIsDropdownOpen((v) => !v)}
            >
              <MonoIcon src="/icons/hugeicons_user.svg" color="#A1A1A1" size={20} alt="user" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full w-48 bg-white rounded-[15px] shadow-lg p-1.5 z-50">
                {DROPDOWN_MENU.map((m) => {
                  const itemActive = isItemActive(m.path);
                  const color = itemActive ? "#308BF9" : "#A1A1A1";

                  return (
                    <Link href={m.path} key={m.name} onClick={() => setActive(m.path)}>
                      <button className="flex items-center gap-3 cursor-pointer w-full px-4 py-3 text-sm hover:bg-gray-100 rounded-[10px] transition-colors">
                        <MonoIcon src={m.icon} color={color} alt={m.name} />
                        <span className="font-semibold text-[12px]" style={{ color }}>
                          {m.name}
                        </span>
                      </button>
                    </Link>
                  );
                })}

                <div className="my-1 border-t border-gray-100" />

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
        <span className="inline-block rounded-full bg-[#252525] text-white text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide whitespace-nowrap">
          Super Admin
        </span>
      </div>
    </>
  );
}