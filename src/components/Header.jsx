

"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { cookieManager } from "../lib/cookies";
import { logoutService } from "../services/authService";
import { toast } from "sonner";
import NotificationModal from "./modal/notification-modal";

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

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

const hideHeaderPaths = [
    "/trainer/updatepassword",
  ];

  if (hideHeaderPaths.includes(pathname)) {
    return null;
  }


  const [active, setActive] = useState(pathname);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
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
    setUserRole(decodeAccessTokenRole());
  }, []);

  const hideTrainerMenu =
    userRole === "super_admin" &&
    pathname?.startsWith("/superadmin-trainer/clients-profile");

  const menu =
    !hideTrainerMenu &&
    (userRole === "trainer" || userRole === "super_admin" || userRole === "admin")
      ? [
          { name: "Dashboard", icon: "/icons/hugeicons_home-05.svg", path: "/trainer/dashboard" },
          { name: "Earnings", icon: "/icons/hugeicons_award-01.svg", path: "/trainer/earnings" },
          { name: "Settings", icon: "/icons/hugeicons_settings-03.svg", path: "/trainer/settings" },
        ]
      : [];

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
    // 1. Revoke refresh session + delete HttpOnly refresh cookie
    await logoutService();

    // 2. Clear frontend-readable session data
    cookieManager.clearAuth();
    localStorage.clear();

    setIsDropdownOpen(false);

    // 3. Return to login
    router.replace("/");
    router.refresh();
  } catch (error) {
    console.error("Error during logout:", error);

    toast.error("Unable to logout. Please try again.");
  }
};


  const handleMenuClick = (menuItem, e) => {
    e.preventDefault();
    setActive(menuItem.path);
    router.push(menuItem.path);
    return false;
  };

  const handleNotificationClick = () => {
    toast.info("Coming Soon");
  };

  const handleSwitchClick = () => {
    if (userRole === "admin") {
      router.push("/trainer-admin/trainers");
    } else if (userRole === "super_admin") {
      router.push("/super-admin/overview");
    }
  };

  const showSwitchButton = userRole === "admin" || userRole === "super_admin";

  const switchBasePath =
    userRole === "admin"
      ? "/trainer-admin"
      : userRole === "super_admin"
      ? "/super-admin"
      : "";
  const isSwitchActive = !!switchBasePath && pathname?.startsWith(switchBasePath);
  const switchColor = isSwitchActive ? "#308BF9" : "#A1A1A1";



  return (
    <>
      <div className="flex justify-between items-center bg-[#F5F7FA] p-4">
        {/* Left: hamburger (tab/mobile only) + logo */}
        <div className="flex items-center gap-3" ref={mobileMenuRef}>
          {(menu.length > 0 || showSwitchButton) && (
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
          )}

          <Link href={userRole === "super_admin" ? "/super-admin/overview" : "/trainer/dashboard"}>
            <div className="flex flex-col items-center">
              <img src="/icons/logorespyr.png" alt="logo" width={50} height={50} />
              {/* <p className="text-[#252525] text-[12px] font-normal">Beta 1.0</p> */}
            </div>
          </Link>

          {/* Mobile / tablet drawer */}
          {isMobileMenuOpen && (
            <div className="xl:hidden absolute left-4 right-4 top-[82px] z-50 bg-white rounded-[15px] shadow-lg border border-gray-100 p-2">
              {menu.map((m) => {
                const isActive =
                  pathname === m.path || pathname?.startsWith(m.path + "/") || active === m.path;
                const color = isActive ? "#308BF9" : "#A1A1A1";

                return (
                  <Link
                    key={m.name}
                    href={m.path}
                    onClick={(e) => {
                      handleMenuClick(m, e);
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

              {showSwitchButton && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSwitchClick();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-[10px] hover:bg-gray-100"
                >
                  <ArrowLeftRight size={18} color={switchColor} />
                  <span className="font-semibold text-[12px]" style={{ color: switchColor }}>
                    Admin Panel
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center: desktop pill nav (hidden below xl) */}
        <div className="hidden xl:flex gap-[15px]">
          {menu.map((m) => {
            const isActive =
              pathname === m.path || pathname?.startsWith(m.path + "/") || active === m.path;
            const color = isActive ? "#308BF9" : "#A1A1A1";

            return (
              <Link href={m.path} key={m.name}>
                <button
                  className="flex items-center gap-1.5 cursor-pointer rounded-[15px] px-[20px] py-[15px] bg-white"
                  onClick={(e) => handleMenuClick(m, e)}
                >
                  <MonoIcon src={m.icon} color={color} alt={m.name} />
                  <span className="font-semibold text-[12px]" style={{ color }}>
                    {m.name}
                  </span>
                </button>
              </Link>
            );
          })}

          {showSwitchButton && (
            <button
              type="button"
              onClick={handleSwitchClick}
              className="flex items-center gap-1.5 cursor-pointer rounded-[15px] px-[20px] py-[15px] bg-white"
            >
              <ArrowLeftRight size={18} color={switchColor} />
              <span className="font-semibold text-[12px]" style={{ color: switchColor }}>
                Admin Panel
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-5">
          <div
            className="flex items-center cursor-pointer rounded-[15px] p-[13px] bg-white"
            onClick={handleNotificationClick}
          >
            <MonoIcon src="/icons/hugeicons_notification-01.svg" color="#A1A1A1" alt="notification" />
          </div>

          <div className="flex items-center gap-5">
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
      </div>

      {/* <NotificationModal open={isModalOpen} onClose={closeModal} /> */}
    </>
  );
}
