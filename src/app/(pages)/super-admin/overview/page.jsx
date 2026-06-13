"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import {
  getSuperAdminOverview,
  selectSuperAdminActor,
  selectSuperAdminOverview,
  selectSuperAdminNetwork,
  selectSuperAdminOverviewTitle,
  selectSuperAdminOverviewLoading,
  selectSuperAdminOverviewError,
} from "@/store/superAdminOverviewSlice";

function KpiCard({ label, value, hint, accent, pending, href }) {
  const content = (
    <>
      <div className={accent ? "text-[12px] opacity-80" : "text-[#535359] text-[12px]"}>{label}</div>
      <div className={`text-[28px] font-bold leading-none mt-1 ${accent ? "" : "text-[#252525]"}`}>
        {pending ? "—" : value}
      </div>
      <div className={accent ? "text-[11px] opacity-80 mt-1" : "text-[#A1A1A1] text-[11px] mt-1"}>{hint}</div>
    </>
  );

  const className = accent
    ? "bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1 hover:bg-[#1a76e8] transition-colors"
    : "bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1 hover:border-[#308BF9] transition-colors";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function StatTile({ label, value, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "text-[#10B981]"
      : tone === "warning"
      ? "text-[#F59E0B]"
      : tone === "danger"
      ? "text-[#EF4444]"
      : "text-[#252525]";

  return (
    <div className="bg-white rounded-[10px] p-4 border border-[#E1E6ED] flex flex-col gap-1">
      <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-[22px] font-bold mt-1 ${toneClass}`}>{value ?? "—"}</div>
    </div>
  );
}

export default function SuperAdminOverview() {
  const dispatch = useDispatch();
  const actor = useSelector(selectSuperAdminActor);
  const overview = useSelector(selectSuperAdminOverview);


  const loading = useSelector(selectSuperAdminOverviewLoading);
  const error = useSelector(selectSuperAdminOverviewError);

  const loadData = useCallback(() => {
    dispatch(getSuperAdminOverview())
      .unwrap()
      .catch((err) => {
        toast.error(err || "Failed to load overview");
      });
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAdmins = overview?.total_admins ?? 0;
  const totalTrainers = overview?.total_trainers_in_network ?? 0;
  const totalClients = overview?.total_clients_in_network ?? 0;
  const ownClients = overview?.own_clients_count ?? 0;


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
        Overview
          </h1>
          <p className="text-[#535359] text-[13px] mt-1">
            A full-network snapshot — trainer admins, trainers, clients, and invites.
          </p>
    
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 disabled:opacity-60 cursor-pointer"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] rounded-[10px] p-3 text-[12px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Trainer Admins"
          value={String(totalAdmins)}
          hint="Active in the network"
          accent
          pending={loading && !overview}
          href="/super-admin/trainer-admins"
        />
        <KpiCard
          label="Trainers"
          value={String(totalTrainers)}
          hint="Across all Trainer Admins"
          pending={loading && !overview}
          href="/super-admin/trainers"
        />

         <KpiCard
          label="Own Clients"
          value={String(ownClients)}
          hint="Directly onboarded by you"
          pending={loading && !overview}
            href="/trainer/dashboard"
        />

        <KpiCard
          label="All Clients in network"
          value={String(totalClients)}
          hint="Total in network"
          pending={loading && !overview}
          href="/super-admin/all-clients"
        />
       
      </div>

      <div className="bg-[#F5F7FA] rounded-[10px] p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-[#252525] text-[14px] font-bold">
            Conversion funnel
          </h3>
          {/* <span className="text-[#A1A1A1] text-[11px]">
            Trainer Admin → Trainer → Client
          </span> */}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            {
              label: "Trainer Admins",
              value: String(totalAdmins),
              // href: "/super-admin/trainer-admins",
            },
            {
              label: "Trainers onboarded",
              value: String(totalTrainers),
              // href: "/super-admin/trainers",
            },
            {
              label: "Clients onboarded",
              value: String(totalClients),
              // href: "/super-admin/clients",
            },
          ].map((s, i) => {
            const inner = (
              <>
                <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">
                  Step {i + 1}
                </div>
                <div className="text-[#535359] text-[12px]">{s.label}</div>
                <div className="text-[#252525] text-[22px] font-bold mt-1">
                  {s.value}
                </div>
              </>
            );

            return s.href ? (
              <Link
                key={s.label}
                href={s.href}
                className="bg-white rounded-[10px] p-4 border border-[#E1E6ED] flex flex-col gap-1 hover:border-[#308BF9] transition-colors"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={s.label}
                className="bg-white rounded-[10px] p-4 border border-[#E1E6ED] flex flex-col gap-1"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
