"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  fetchTrainerAdminListService,
  fetchDownstreamUsersService,
} from "@/services/authService";
import { getCurrentUser } from "@/lib/user";

export default function TrainerAdminDetailPage({ params }) {
  const { id } = use(params);
  const [ta, setTa] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const taRes = await fetchTrainerAdminListService();
      const taList = taRes?.existing || [];

      let foundTa = taList.find(
        (t) =>
          String(t.role_id) === id ||
          t.user_id === id ||
          t.partner_code === id
      );

      if (!foundTa && id === "sa-self") {
        const currentUser = getCurrentUser();
        if (currentUser?.partner_code) {
          const taClientsCount = taList.reduce((sum, t) => sum + (t.clients_count ?? 0), 0);
          const totalClients = taRes?.totals?.total_clients ?? 0;
          foundTa = {
            role_id: "sa-self",
            user_id: currentUser.user_id,
            name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || "Super Admin",
            email: currentUser.email || currentUser.user_id,
            partner_code: currentUser.partner_code,
            dietician_id: currentUser.partner_code,
            trainers_count: taList.length,
            clients_count: Math.max(0, totalClients - taClientsCount),
            status: "active",
            created_at: null,
          };
        }
      }

      if (!foundTa) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTa(foundTa);

      try {
        const trainerRes = await fetchDownstreamUsersService(foundTa.user_id);
        setTrainers(trainerRes?.existing || []);
        setTotals(trainerRes?.totals || null);
      } catch {
        setTrainers([]);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-[#A1A1A1] text-[13px]">Loading...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/super-admin/trainer-admins"
          className="text-[#308BF9] text-[12px] font-semibold inline-flex items-center gap-1"
        >
          &larr; Back to Trainer Admins
        </Link>
        <div className="text-[#A1A1A1] text-[13px]">
          Trainer Admin not found.
        </div>
      </div>
    );
  }

  const trainersCount = totals?.total_trainers ?? trainers.length;
  const clientsCount = totals?.total_clients ?? 0;
  const activeTrainers = trainers.filter((t) => t.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/super-admin/trainer-admins"
        className="text-[#308BF9] text-[12px] font-semibold inline-flex items-center gap-1"
      >
        &larr; Back to Trainer Admins
      </Link>

      <div className="bg-white rounded-[12px] border border-[#E1E6ED] p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[#252525] text-[24px] font-bold tracking-[-0.5px]">
              {ta.name || ta.user_id}
            </h1>
            <span className="rounded-full bg-[#308BF9] text-white text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
              Trainer Admin
            </span>
            <span
              className={`rounded-full text-[11px] font-semibold px-2.5 py-1 ${
                ta.status === "active"
                  ? "bg-[#E5F6EE] text-[#1F7A4A]"
                  : "bg-[#FCEAEB] text-[#B5363A]"
              }`}
            >
              {ta.status}
            </span>
          </div>
          <div className="text-[#535359] text-[13px]">
            {ta.email || ta.user_id}
            {ta.phone_no ? ` · ${ta.phone_no}` : ""}
            {ta.partner_code
              ? ` · partner code `
              : ""}
            {ta.partner_code && (
              <span className="font-mono">{ta.partner_code}</span>
            )}
          </div>
          {ta.location && (
            <div className="text-[#A1A1A1] text-[11px]">
              Location: {ta.location}
            </div>
          )}
          <div className="text-[#A1A1A1] text-[11px]">
            Joined{" "}
            {ta.created_at
              ? new Date(ta.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "-"}
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1">
          <div className="text-[12px] opacity-80">Trainers in network</div>
          <div className="text-[28px] font-bold">
            {trainersCount}
          </div>
          <div className="text-[11px] opacity-80">
            {activeTrainers} active
          </div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">
            Clients under network
          </div>
          <div className="text-[#252525] text-[28px] font-bold">
            {clientsCount}
          </div>
        </div>
      </div>

      {(ta.dietician_id || ta.partner_code) && (
        <div className="bg-[#F5F7FA] rounded-[10px] p-4 flex items-center justify-between">
          <div>
            <div className="text-[#252525] text-[13px] font-semibold">
              Own Trainer View
            </div>
            <div className="text-[#535359] text-[11px]">
              This Trainer Admin is also a trainer with their own clients.
            </div>
          </div>
          <Link
            href={`/super-admin/trainers/${ta.role_id || encodeURIComponent(ta.user_id)}?dietician_id=${encodeURIComponent(ta.dietician_id || ta.partner_code)}&name=${encodeURIComponent(ta.name || ta.user_id)}`}
            className="rounded-[10px] bg-[#2EAF6A] text-white text-[12px] font-semibold px-4 py-2 hover:bg-[#259B5C]"
          >
            View clients
          </Link>
        </div>
      )}

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">
          Trainers in this network
        </h3>

        {trainers.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
            No trainers onboarded yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Name</th>
                  <th className="py-2.5 px-4 font-semibold">Partner code</th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    Clients
                  </th>
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
                        href={`/super-admin/trainers/${t.role_id || encodeURIComponent(t.user_id)}?dietician_id=${encodeURIComponent(t.dietician_id || t.partner_code || "")}&name=${encodeURIComponent(t.name || t.user_id)}`}
                        className="text-[#308BF9] font-semibold hover:underline"
                      >
                        {t.name || t.user_id}
                      </Link>
                      <div className="text-[#A1A1A1] text-[11px]">
                        {t.email || t.user_id}
                      </div>
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
