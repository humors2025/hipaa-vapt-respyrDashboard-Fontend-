"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { id: "overview",     label: "Overview",     href: "/facility-admin/earnings/overview" },
  { id: "payout-setup", label: "Payout Setup", href: "/facility-admin/earnings/payout-setup" },
  { id: "how-to-use",   label: "How it works", href: "/facility-admin/earnings/how-to-use" },
];

export default function FacilityAdminEarningsTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Earnings sections"
      className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:w-[220px] lg:flex-shrink-0 pb-2 lg:pb-0 -mx-1 lg:mx-0 px-1"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={[
              "flex-shrink-0 whitespace-nowrap rounded-[10px] px-4 py-3 text-[13px] font-semibold transition-colors",
              isActive ? "bg-[#308BF9] text-white" : "bg-white text-[#535359] hover:bg-[#EEF4FE]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
