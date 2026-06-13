"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchTrainerAdminOverviewService } from "@/services/authService";

export default function TrainersList({ trainerAdmin, onBack }) {
  const [trainers, setTrainers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [actor, setActor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const actorUserId = trainerAdmin?.email || trainerAdmin?.user_id;

  const loadTrainers = useCallback(async () => {
    if (!actorUserId) return;
    setIsLoading(true);
    try {
      const res = await fetchTrainerAdminOverviewService(actorUserId);
      setTrainers(res?.network?.trainers || []);
      setOverview(res?.overview || null);
      setActor(res?.actor || null);
    } catch (error) {
      toast.error(error?.message || "Failed to load trainers");
      setTrainers([]);
      setOverview(null);
      setActor(null);
    } finally {
      setIsLoading(false);
    }
  }, [actorUserId]);

  useEffect(() => {
    loadTrainers();
  }, [loadTrainers]);

  const trainersCount = overview?.total_trainers ?? trainers.length;
  const clientsCount = overview?.total_clients_in_network ?? 0;
  const ownClientsCount = overview?.own_clients_count ?? 0;
  const activeTrainers =
    overview?.accepted_trainers_count ??
    trainers.filter((t) => t.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="text-[#308BF9] text-[12px] font-semibold inline-flex items-center gap-1 cursor-pointer w-fit"
      >
        &larr; Back to Trainer Admins
      </button>

      <div className="bg-white rounded-[12px] border border-[#E1E6ED] p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[#252525] text-[24px] font-bold tracking-[-0.5px]">
              {actor?.name || trainerAdmin.name || trainerAdmin.user_id}
            </h1>
            <span className="rounded-full bg-[#308BF9] text-white text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
              Trainer Admin
            </span>
            <span
              className={`rounded-full text-[11px] font-semibold px-2.5 py-1 ${
                trainerAdmin.status === "active"
                  ? "bg-[#E5F6EE] text-[#1F7A4A]"
                  : "bg-[#FCEAEB] text-[#B5363A]"
              }`}
            >
              {trainerAdmin.status || "active"}
            </span>
          </div>
          <div className="text-[#535359] text-[13px]">
            {actor?.email || trainerAdmin.email || trainerAdmin.user_id}
            {trainerAdmin.phone_no ? ` · ${trainerAdmin.phone_no}` : ""}
            {(actor?.partner_code || trainerAdmin.partner_code)
              ? ` · partner code `
              : ""}
            {(actor?.partner_code || trainerAdmin.partner_code) && (
              <span className="font-mono">
                {actor?.partner_code || trainerAdmin.partner_code}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={loadTrainers}
          disabled={isLoading}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1">
          <div className="text-[12px] opacity-80">Trainers in network</div>
          <div className="text-[28px] font-bold">{trainersCount}</div>
          <div className="text-[11px] opacity-80">{activeTrainers} active</div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Clients under network</div>
          <div className="text-[#252525] text-[28px] font-bold">{clientsCount}</div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Own clients</div>
          <div className="text-[#252525] text-[28px] font-bold">{ownClientsCount}</div>
        </div>
      </div>

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">
          Trainers in this network
        </h3>

        {isLoading ? (
          <div className="rounded-[10px] border border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
            Loading trainers...
          </div>
        ) : trainers.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
            No trainers onboarded yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Name</th>
                  <th className="py-2.5 px-4 font-semibold">Phone</th>
                  <th className="py-2.5 px-4 font-semibold">Location</th>
                  <th className="py-2.5 px-4 font-semibold">Partner code</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Clients</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map((t) => (
                  <tr
                    key={t.role_id || t.user_id}
                    className="border-t border-[#F5F7FA] hover:bg-[#F5F7FA]"
                  >
                    <td className="py-2.5 px-4">
                    <Link
                        href={`/super-admin/trainers/${encodeURIComponent(t.partner_code)}`}
                        className="text-[#308BF9] font-semibold hover:underline"
                      >
                        {t.name || t.user_id}
                      </Link> 
                      {/* <p className="text-[#308BF9] font-semibold hover:underline"> {t.name || t.user_id}</p> */}
                      <div className="text-[#A1A1A1] text-[11px]">
                        {t.email || t.user_id}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {t.phone_no && t.phone_no !== "-" ? t.phone_no : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {t.location || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">
                      {t.partner_code || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#252525]">
                      {t.clients_count ?? 0}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${
                          t.status === "active"
                            ? "bg-[#E5F6EE] text-[#1F7A4A]"
                            : "bg-[#FCEAEB] text-[#B5363A]"
                        }`}
                      >
                        {t.status || "active"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#A1A1A1]">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
