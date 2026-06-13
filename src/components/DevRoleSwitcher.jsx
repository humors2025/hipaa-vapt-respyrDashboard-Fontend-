"use client";

// Dev-only floating role switcher. Visible only when NODE_ENV=development.
// Sets a synthetic `user` cookie + `access_token` and navigates to the role's
// home, so you can preview /super-admin, /trainer-admin, /trainer without
// needing the backend to ship role-aware login.
//
// Multiple identities per role let you test cross-cutting data visibility
// (e.g., Evan should NOT see Derek's trainers).
//
// Removed automatically in production builds (NODE_ENV check).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cookieManager } from "@/lib/cookies";
import { getCurrentUser } from "@/lib/user";

const ROLE_RANK = { super_admin: 3, trainer_admin: 2, trainer: 1 };

const IDENTITIES = [
  {
    id: "connect@respyr.in",
    role: "super_admin",
    label: "Super Admin (connect)",
    section: "Super Admin",
    home: "/super-admin/overview",
    firstName: "Super",
    lastName: "Admin",
    partnerCode: "RespyrD01",
    parentUserId: null,
    color: "#252525",
  },
  {
    id: "connect@respyr.in",
    role: "trainer_admin",
    label: "Trainer Admin (connect)",
    section: "Trainer Admin",
    home: "/trainer-admin/trainers",
    firstName: "Super",
    lastName: "Admin",
    partnerCode: "RespyrD01",
    parentUserId: null,
    color: "#308BF9",
  },
  {
    id: "connect@respyr.in",
    role: "trainer",
    label: "Trainer (connect)",
    section: "Trainer",
    home: "/trainer/dashboard",
    firstName: "Super",
    lastName: "Admin",
    partnerCode: "RespyrD01",
    parentUserId: null,
    color: "#2EAF6A",
  },
  {
    id: "sagar@respyr.in",
    role: "trainer_admin",
    label: "Sagar Hosur",
    section: "Trainer Admin",
    home: "/trainer-admin/trainers",
    firstName: "Sagar",
    lastName: "Hosur",
    partnerCode: "RespyrD03",
    parentUserId: "connect@respyr.in",
    color: "#308BF9",
  },
  {
    id: "ishan@respyr.in",
    role: "trainer_admin",
    label: "Ishan Sinha",
    section: "Trainer Admin",
    home: "/trainer-admin/trainers",
    firstName: "Ishan",
    lastName: "Sinha",
    partnerCode: "ADMBWST6GD",
    parentUserId: "connect@respyr.in",
    color: "#308BF9",
  },
  {
    id: "chandan@respyr.in",
    role: "trainer_admin",
    label: "Chandan Kumar",
    section: "Trainer Admin",
    home: "/trainer-admin/trainers",
    firstName: "Chandan",
    lastName: "Kumar",
    partnerCode: "ADM6BL3L29",
    parentUserId: "connect@respyr.in",
    color: "#308BF9",
  },
  {
    id: "evan.gaudet@gmail.com",
    role: "trainer_admin",
    label: "Evan Gaudet",
    section: "Trainer Admin",
    home: "/trainer-admin/trainers",
    firstName: "Evan",
    lastName: "Gaudet",
    partnerCode: "RespyrD05",
    parentUserId: "connect@respyr.in",
    color: "#308BF9",
  },
  {
    id: "derek.lopez88@gmail.com",
    role: "trainer_admin",
    label: "Derek Lopez",
    section: "Trainer Admin",
    home: "/trainer-admin/trainers",
    firstName: "Derek",
    lastName: "Lopez",
    partnerCode: "RESPYRD06",
    parentUserId: "connect@respyr.in",
    color: "#308BF9",
  },
  {
    id: "harsh@respyr.in",
    role: "trainer_admin",
    label: "Harsh",
    section: "Trainer Admin",
    home: "/trainer-admin/trainers",
    firstName: "Harsh",
    lastName: "",
    partnerCode: "ADM9JQ4CVZ",
    parentUserId: "connect@respyr.in",
    color: "#308BF9",
  },
  {
    id: "sagarhosur814@gmail.com",
    role: "trainer",
    label: "Ankur Jaiswal (Sagar's)",
    section: "Trainer",
    home: "/trainer/dashboard",
    firstName: "Ankur",
    lastName: "Jaiswal",
    partnerCode: "TRAIN0090",
    parentUserId: "sagar@respyr.in",
    color: "#2EAF6A",
  },
  {
    id: "tanner.l.staton@gmail.com",
    role: "trainer",
    label: "Tanner Staton (Evan's)",
    section: "Trainer",
    home: "/trainer/dashboard",
    firstName: "Tanner",
    lastName: "Staton",
    partnerCode: "RESPYRD07",
    parentUserId: "evan.gaudet@gmail.com",
    color: "#2EAF6A",
  },
  {
    id: "teddy@wunderinteractive.com",
    role: "trainer",
    label: "Teddy (Evan's)",
    section: "Trainer",
    home: "/trainer/dashboard",
    firstName: "Teddy",
    lastName: "",
    partnerCode: "RESPYRD08",
    parentUserId: "evan.gaudet@gmail.com",
    color: "#2EAF6A",
  },
  {
    id: "snutwell@yahoo.com",
    role: "trainer",
    label: "Sophia Nutwell (Evan's)",
    section: "Trainer",
    home: "/trainer/dashboard",
    firstName: "Sophia",
    lastName: "Nutwell",
    partnerCode: "RESPYRD10",
    parentUserId: "evan.gaudet@gmail.com",
    color: "#2EAF6A",
  },
];

export default function DevRoleSwitcher() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  const currentUser = getCurrentUser();
  const currentRole = currentUser?.role || "super_admin";
  const currentRank = ROLE_RANK[currentRole] ?? 0;

  const switchTo = (identity) => {
    const user = {
      user_id: identity.id,
      role: identity.role,
      first_name: identity.firstName,
      last_name: identity.lastName,
      email: `${identity.firstName.toLowerCase()}@demo.respyr.ai`,
      partner_code: identity.partnerCode,
      parent_user_id: identity.parentUserId,
      is_reset_password: 1,
    };
    cookieManager.set("access_token", "demo-token");
    cookieManager.set("user", JSON.stringify(user));
    cookieManager.set(
      "dietician",
      JSON.stringify({
        dietician_id: identity.partnerCode || identity.id,
        name: `${identity.firstName} ${identity.lastName}`,
        email: user.email,
        is_reset_password: 1,
      })
    );
    cookieManager.remove("original_user");
    setIsOpen(false);
    router.push(identity.home);
    setTimeout(() => router.refresh(), 50);
  };

  const visibleIdentities = IDENTITIES.filter(
    (ident) => (ROLE_RANK[ident.role] ?? 0) <= currentRank
  );

  const sections = visibleIdentities.reduce((acc, ident) => {
    (acc[ident.section] ||= []).push(ident);
    return acc;
  }, {});

  const isActive = (ident) =>
    currentUser?.user_id === ident.id && currentRole === ident.role;

  const showReset = currentRole !== "super_admin";

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999]"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {isOpen && (
        <div className="mb-2 bg-white rounded-[12px] shadow-2xl border border-[#E1E6ED] p-2 w-[260px] max-h-[400px] overflow-y-auto">
          <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold px-2 pt-1 pb-2">
            Switch identity (dev only)
          </div>
          {Object.entries(sections).map(([section, idents]) => (
            <div key={section} className="mb-2 last:mb-0">
              <div className="text-[#252525] text-[10px] font-bold uppercase tracking-wide px-2 py-1">
                {section}
              </div>
              {idents.map((r) => (
                <button
                  key={`${r.id}-${r.role}`}
                  onClick={() => switchTo(r)}
                  disabled={isActive(r)}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-[8px] text-left ${
                    isActive(r)
                      ? "bg-[#EEF4FE] border border-[#308BF9]/30 opacity-70 cursor-default"
                      : "hover:bg-[#F5F7FA]"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.color }}
                    aria-hidden
                  />
                  <span className="text-[#252525] text-[12px] font-semibold flex-1">
                    {r.label}
                    {isActive(r) && (
                      <span className="text-[#308BF9] text-[10px] font-normal ml-1">(active)</span>
                    )}
                  </span>
                  {r.partnerCode && (
                    <span className="text-[#A1A1A1] text-[10px] font-mono">
                      {r.partnerCode}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
          {showReset && (
            <div className="mt-2 pt-2 border-t border-[#E1E6ED]">
              <button
                onClick={() => switchTo(IDENTITIES[0])}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-[8px] hover:bg-[#F5F7FA] text-left"
              >
                <span className="text-[#A1A1A1] text-[11px]">↩</span>
                <span className="text-[#A1A1A1] text-[11px]">
                  Reset to Super Admin (dev)
                </span>
              </button>
            </div>
          )}
        </div>
      )}
      {/* <button
        onClick={() => setIsOpen((v) => !v)}
        className="bg-[#252525] text-white text-[11px] font-semibold rounded-full px-4 py-2 shadow-lg hover:bg-[#404040]"
      >
        {isOpen ? "Close" : "Switch role"}
      </button> */}
    </div>
  );
}
