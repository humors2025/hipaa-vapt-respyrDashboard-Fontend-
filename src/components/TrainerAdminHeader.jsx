"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cookieManager } from "@/lib/cookies";
import { toast } from "sonner";
import { logoutService } from "@/services/authService";
import { decodeAccessTokenRole } from "@/components/Header";
import { getCurrentUser } from "@/lib/user";
import { ORDERS_TRAINER_ADMIN_PATH, isOrdersViewer } from "@/lib/ordersAccess";

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
  {
    name: "Facilities",
    icon: "/icons/hugeicons_home-05.svg",
    path: "/trainer-admin/facilities",
    // Dropdown only for orders viewers; everyone else gets a plain tab.
    submenu: [
      { name: "Facilities", path: "/trainer-admin/facilities" },
      { name: "Orders & Payments", path: ORDERS_TRAINER_ADMIN_PATH },
    ],
  },
  { name: "QR codes",         icon: "/icons/hugeicons_view.svg",           path: "/trainer-admin/qr-codes" },
  { name: "TA Analytics",     icon: "/icons/hugeicons_view.svg",           path: "/trainer-admin/analytics" },
  { name: "Earnings",         icon: "/icons/hugeicons_award-01.svg",       path: "/trainer-admin/earnings" },
];

// The "TA Analytics" tab is hidden when the manage_admin_groups.php response
// returned an empty `groups` array at login. Login sets the
// "ta_analytics_enabled" cookie to "1" only when there is at least one group.
const TA_ANALYTICS_PATH = "/trainer-admin/analytics";

// Earnings is hidden for trainer admins whose token role is "admin".
const EARNINGS_PATH = "/trainer-admin/earnings";

export default function TrainerAdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [active, setActive] = useState(pathname);
  // Whether the TA Analytics tab is visible. Read from the cookie in an effect
  // (js-cookie is client-only) so the first render matches the server and we
  // avoid a hydration mismatch. Defaults to hidden until the flag is confirmed.
  const [showAnalytics, setShowAnalytics] = useState(false);
  // Same pattern: hidden until the token role is read on the client.
  const [showEarnings, setShowEarnings] = useState(false);
  // Orders & Payments (under the Facilities dropdown): only the trainer
  // admins in src/lib/ordersAccess.js.
  const [showOrders, setShowOrders] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = useState(null);

  const mobileMenuRef = useRef(null);
  // One element per dropdown, keyed by menu name (see SuperAdminHeader).
  const submenuRefs = useRef({});

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
      const insideSubmenu = Object.values(submenuRefs.current).some(
        (el) => el && el.contains(e.target)
      );
      if (!insideSubmenu) {
        setOpenSubmenu(null);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  useEffect(() => {
    setShowAnalytics(cookieManager.get("ta_analytics_enabled") === "1");
    setShowEarnings(decodeAccessTokenRole() !== "admin");
    // A login that returns only an access_token leaves the user cookie's
    // email blank; user_id is the same lowercased email (and is what the
    // middleware checks), so fall back to it.
    const me = getCurrentUser();
    setShowOrders(isOrdersViewer(decodeAccessTokenRole(), me?.email || me?.user_id));
  }, []);

  const menu = MENU.filter(
    (m) =>
      (showAnalytics || m.path !== TA_ANALYTICS_PATH) &&
      (showEarnings || m.path !== EARNINGS_PATH)
  ).map((m) => {
    if (!m.submenu) return m;
    const submenu = m.submenu.filter((s) => showOrders || s.path !== ORDERS_TRAINER_ADMIN_PATH);
    if (submenu.length > 1) return { ...m, submenu };
    // A dropdown holding only the tab's own page is just a link.
    const { submenu: _unused, ...link } = m;
    return link;
  });

  const isItemActive = (path) =>
    pathname === path || pathname?.startsWith(path + "/") || active === path;

  // A dropdown tab stays lit on any of its pages, e.g. Facilities on Orders.
  const isMenuActive = (m) =>
    isItemActive(m.path) || (m.submenu || []).some((s) => isItemActive(s.path));

  // const handleLogout = () => {
  //   try {
  //     cookieManager.clearAuth();
  //     localStorage.clear();
  //     setIsDropdownOpen(false);
  //     router.push("/");
  //   } catch (error) {
  //     console.error("Error during logout:", error);
  //   }
  // };

const handleLogout = async () => {
  try {
    await logoutService();

    cookieManager.clearAuth();
    localStorage.clear();

    setIsDropdownOpen(false);

    router.replace("/");
    router.refresh();
  } catch (error) {
    console.error("Error during logout:", error);

    toast.error("Unable to logout. Please try again.");
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
                const color = isMenuActive(m) ? "#308BF9" : "#A1A1A1";

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
                          <MonoIcon src={m.icon} color={color} alt={m.name} />
                          <span className="font-semibold text-[12px]" style={{ color }}>
                            {m.name}
                          </span>
                        </span>
                        <svg
                          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen &&
                        m.submenu.map((sub) => (
                          <Link
                            key={sub.name}
                            href={sub.path}
                            onClick={() => {
                              setActive(sub.path);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`flex items-center w-full pl-12 pr-4 py-2.5 rounded-[10px] hover:bg-gray-100 font-semibold text-[12px] ${
                              isItemActive(sub.path) ? "text-[#308BF9]" : "text-[#A1A1A1]"
                            }`}
                          >
                            {sub.name}
                          </Link>
                        ))}
                    </div>
                  );
                }

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
            const color = isMenuActive(m) ? "#308BF9" : "#A1A1A1";

            if (m.submenu) {
              const isOpen = openSubmenu === m.name;
              return (
                <div
                  key={m.name}
                  className="relative"
                  ref={(el) => {
                    submenuRefs.current[m.name] = el;
                  }}
                  onMouseEnter={() => setOpenSubmenu(m.name)}
                  onMouseLeave={() => setOpenSubmenu(null)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActive(m.path);
                      router.push(m.path);
                    }}
                    className="flex items-center gap-1.5 cursor-pointer rounded-[15px] px-[20px] py-[15px] bg-white"
                  >
                    <MonoIcon src={m.icon} color={color} alt={m.name} />
                    <span className="font-semibold text-[12px]" style={{ color }}>
                      {m.name}
                    </span>
                    <svg
                      className={`w-3 h-3 ms-1 -me-0.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="absolute left-0 top-full z-50 bg-white border border-gray-100 rounded-[15px] shadow-lg w-48">
                      <ul className="p-2 text-sm font-medium">
                        {m.submenu.map((sub) => (
                          <li key={sub.name}>
                            <Link
                              href={sub.path}
                              onClick={() => {
                                setActive(sub.path);
                                setOpenSubmenu(null);
                              }}
                              className={`inline-flex items-center w-full p-2 rounded hover:bg-gray-100 font-semibold text-[12px] ${
                                isItemActive(sub.path) ? "text-[#308BF9]" : "text-[#A1A1A1] hover:text-[#252525]"
                              }`}
                            >
                              {sub.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            }

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