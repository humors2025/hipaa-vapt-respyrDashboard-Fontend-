"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchTrainerAdminListService,
  fetchDownstreamUsersService,
} from "@/services/authService";
import { getCurrentUser } from "@/lib/user";

export default function SuperAdminClientsPage() {
  const [trainerAdmins, setTrainerAdmins] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [taFilter, setTaFilter] = useState("all");

  const fetchClientsForDietician = async (did) => {
    const result = [];
    let page = 1;
    while (true) {
      const res = await fetch("/api/admin/trainer-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietician_id: did, page }),
      });
      const data = await res.json();
      const batch = data?.clients || [];
      result.push(...batch);
      if (batch.length < 10) break;
      page++;
    }
    return result;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const taRes = await fetchTrainerAdminListService();
      const taList = taRes?.existing || [];

      const currentUser = getCurrentUser();
      const fullTaList = [...taList];
      if (currentUser?.role === "super_admin" && currentUser?.partner_code) {
        const alreadyInList = taList.some(
          (ta) => ta.user_id === currentUser.user_id || ta.partner_code === currentUser.partner_code
        );
        if (!alreadyInList) {
          fullTaList.unshift({
            user_id: currentUser.user_id,
            name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || "Super Admin",
            email: currentUser.email || currentUser.user_id,
            partner_code: currentUser.partner_code,
            dietician_id: currentUser.partner_code,
          });
        }
      }

      setTrainerAdmins(fullTaList);

      const clients = [];

      for (const ta of fullTaList) {
        const did = ta.dietician_id || ta.partner_code;
        if (!did) continue;

        try {
          const taClients = await fetchClientsForDietician(did);
          clients.push(
            ...taClients.map((c) => ({
              ...c,
              trainer_name: ta.name || ta.user_id,
              trainer_code: did,
              ta_name: ta.name || ta.user_id,
              ta_user_id: ta.user_id,
            }))
          );
        } catch {}

        try {
          const trainerRes = await fetchDownstreamUsersService(ta.user_id);
          for (const trainer of trainerRes?.existing || []) {
            const trainerDid = trainer.dietician_id || trainer.partner_code;
            if (!trainerDid) continue;
            try {
              const trainerClients = await fetchClientsForDietician(trainerDid);
              clients.push(
                ...trainerClients.map((c) => ({
                  ...c,
                  trainer_name: trainer.name || trainer.user_id,
                  trainer_code: trainerDid,
                  ta_name: ta.name || ta.user_id,
                  ta_user_id: ta.user_id,
                }))
              );
            } catch {}
          }
        } catch {}
      }

      const unique = [];
      const seen = new Set();
      for (const c of clients) {
        if (!seen.has(c.profile_id)) {
          seen.add(c.profile_id);
          unique.push(c);
        }
      }

      setAllClients(unique);
    } catch (err) {
      toast.error(err?.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allClients.filter((c) => {
      if (taFilter !== "all" && c.ta_user_id !== taFilter) return false;
      if (!needle) return true;
      return (
        (c.client_name || "").toLowerCase().includes(needle) ||
        (c.email || "").toLowerCase().includes(needle) ||
        (c.profile_id || "").toLowerCase().includes(needle)
      );
    });
  }, [allClients, q, taFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            Clients
          </h1>
          <p className="text-[#535359] text-[13px] mt-1">
            All clients across the network.
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

      {!loading && (
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or profile ID"
            className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] flex-1 min-w-[240px] focus:outline-none focus:border-[#308BF9]"
          />
          <select
            value={taFilter}
            onChange={(e) => setTaFilter(e.target.value)}
            className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px]"
          >
            <option value="all">All Trainer Admins</option>
            {trainerAdmins.map((ta) => (
              <option key={ta.user_id} value={ta.user_id}>
                {ta.name || ta.user_id}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-[#A1A1A1] text-[13px]">
          Loading clients across all trainers...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">Name</th>
                <th className="py-2.5 px-4 font-semibold">Email</th>
                <th className="py-2.5 px-4 font-semibold">Profile ID</th>
                <th className="py-2.5 px-4 font-semibold">Trainer</th>
                <th className="py-2.5 px-4 font-semibold">Referral Code</th>
                <th className="py-2.5 px-4 font-semibold">Fitness Goal</th>
                <th className="py-2.5 px-4 font-semibold text-right">Score</th>
                <th className="py-2.5 px-4 font-semibold">Zone</th>
                <th className="py-2.5 px-4 font-semibold">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.profile_id}
                  className="border-t border-[#F5F7FA] hover:bg-[#F5F7FA]"
                >
                  <td className="py-2.5 px-4 text-[#252525] font-semibold">
                    {c.client_name || "-"}
                  </td>
                  <td className="py-2.5 px-4 text-[#535359]">
                    {c.email || "-"}
                  </td>
                  <td className="py-2.5 px-4 text-[#535359] font-mono">
                    {c.profile_id || "-"}
                  </td>
                  <td className="py-2.5 px-4 text-[#535359]">
                    {c.trainer_name || "-"}
                  </td>
                  <td className="py-2.5 px-4 text-[#535359] font-mono">
                    {c.trainer_code || "-"}
                  </td>
                  <td className="py-2.5 px-4 text-[#535359]">
                    {c.fitness_goal_display || "-"}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {c.metabolism_score != null ? (
                      <span className="text-[#252525] font-semibold">
                        {c.metabolism_score}
                      </span>
                    ) : (
                      <span className="text-[#A1A1A1]">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {c.zone ? (
                      <span
                        className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${
                          c.zone === "Optimal"
                            ? "bg-[#E5F6EE] text-[#1F7A4A]"
                            : c.zone === "Moderate"
                            ? "bg-[#FFF4E0] text-[#A66B00]"
                            : "bg-[#FCEAEB] text-[#B5363A]"
                        }`}
                      >
                        {c.zone}
                      </span>
                    ) : (
                      <span className="text-[#A1A1A1]">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-[#A1A1A1]">
                    {c.last_logged || "-"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 px-4 text-center text-[#A1A1A1] text-[12px]"
                  >
                    {allClients.length === 0
                      ? "No clients found in the network."
                      : "No clients match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
