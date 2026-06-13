"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { fetchTrainerClientInvitesService } from "@/services/authService";

function getLoggedInUserFromCookie() {
  const token = Cookies.get("access_token");
  if (token) {
    try {
      const payload = token.split(".")[1];
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64).split("").map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`).join("")
      );
      return JSON.parse(jsonPayload);
    } catch { /* fall through */ }
  }
  const userCookie = Cookies.get("user");
  if (userCookie) {
    try { return JSON.parse(userCookie); } catch { return null; }
  }
  return null;
}

function getActorUserIdFromCookie() {
  const decoded = getLoggedInUserFromCookie();
  return decoded?.user_id ?? decoded?.email ?? null;
}

export default function TrainerAdminTrainersPage() {
  const [user, setUser] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [totals, setTotals] = useState({ 
    total_trainers: 0, 
    total_clients: 0 
  });
  const [actorInfo, setActorInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const actorUserId = getActorUserIdFromCookie();
    if (!actorUserId) return;

    setLoading(true);
    try {
      const res = await fetchTrainerClientInvitesService({ actorUserId });
      
      if (res?.ok) {
        // Set actor info
        setActorInfo(res.actor);
        
        // Map trainers data from network.trainers
        const networkTrainers = res?.network?.trainers || [];
        
        // Add the actor (yourself) to the trainers list if not already present
        const actorTrainer = {
          user_id: res.actor.user_id,
          name: res.actor.name,
          email: res.actor.email,
          role: res.actor.role,
          actual_role: "admin",
          partner_code: res.actor.partner_code,
          dietician_id: res.actor.partner_code,
          clients_count: res.overview.own_clients_count,
          is_self: true
        };
        
        // Check if actor is already in the trainers list
        const actorExists = networkTrainers.some(t => t.user_id === res.actor.user_id);
        
        const allTrainers = actorExists 
          ? networkTrainers.map(t => ({
              ...t,
              is_self: t.user_id === res.actor.user_id
            }))
          : [actorTrainer, ...networkTrainers];
        
        setTrainers(allTrainers);
        
        // Set totals from overview
        setTotals({
          total_trainers: res.overview.accepted_trainers_count + 1, // +1 for yourself
          total_clients: res.overview.total_clients_in_network
        });
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load trainers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUser(getLoggedInUserFromCookie());
    loadData();
  }, [loadData]);

  if (!user) return <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>;

  const totalTrainers = totals.total_trainers;
  const totalClients = totals.total_clients;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            Overview
          </h1>
          <p className="text-[#535359] text-[13px] mt-1">
            Trainers in your network and their client activity.
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1">
          <div className="text-[12px] opacity-80">Trainers in network</div>
          <div className="text-[28px] font-bold">{totalTrainers}</div>
          {/* <div className="text-[11px] opacity-80">
            {actorInfo?.accepted_trainers_count || 0} accepted + you
          </div> */}
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Total clients in Network</div>
          <div className="text-[#252525] text-[28px] font-bold">{totalClients}</div>
          <div className="text-[#A1A1A1] text-[11px]">Across all trainers</div>
        </div>
      </div>

      {/* Trainers table */}
      {loading ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : trainers.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
          No trainers in your network yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">Name</th>
                <th className="py-2.5 px-4 font-semibold">Partner code</th>
                <th className="py-2.5 px-4 font-semibold">Role</th>
                <th className="py-2.5 px-4 font-semibold text-right">Clients</th>
                <th className="py-2.5 px-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => {
                const clients = t.clients_count ?? 0;
                const roleStr = String(t.actual_role || t.role || "").toLowerCase();
                const isAdmin = roleStr.includes("admin");
                return (
                  <tr
                    key={t.user_id}
                    className={`border-t border-[#F5F7FA] ${t.is_self ? "bg-[#EEF4FE]/50" : ""}`}
                  >
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525] font-semibold">
                        {t.name || t.user_id}
                        {t.is_self && (
                          <span className="text-[#308BF9] text-[10px] font-normal ml-1.5">(you)</span>
                        )}
                      </div>
                      <div className="text-[#A1A1A1] text-[11px]">{t.email || t.user_id}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">
                      {t.partner_code || t.dietician_id || "-"}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${
                        isAdmin
                          ? "bg-[#EEF4FE] text-[#308BF9]"
                          : "bg-[#E5F6EE] text-[#1F7A4A]"
                      }`}>
                        {t.is_self ? "You (Trainer Admin)" : isAdmin ? "Trainer Admin" : "Trainer"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">
                      {clients}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-[#A1A1A1] text-[11px]">
                        {clients} client{clients !== 1 ? "s" : ""} referred
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}