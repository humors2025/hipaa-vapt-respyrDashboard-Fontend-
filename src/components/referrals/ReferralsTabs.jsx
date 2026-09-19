"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ReferralsTabs({ base }) {
  const pathname = usePathname();
  const TABS = [
    { id: "qr", label: "My QR code", href: `${base}/referrals/qr` },
    { id: "members", label: "Referred members", href: `${base}/referrals/members` },
    ...(base === "/facility-admin" ? [{ id: "invite", label: "Invite trainer", href: `${base}/referrals/invite` }] : []),
  ];
  return (
    <nav aria-label="Referral sections" className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:w-[220px] lg:flex-shrink-0 pb-2 lg:pb-0 -mx-1 lg:mx-0 px-1">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link key={tab.id} href={tab.href} className={["flex-shrink-0 whitespace-nowrap rounded-[10px] px-4 py-3 text-[13px] font-semibold transition-colors", isActive ? "bg-[#308BF9] text-white" : "bg-white text-[#535359] hover:bg-[#EEF4FE]"].join(" ")}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
