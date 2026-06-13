"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { fetchTrainerClientsOverviewForSuperAdminService } from "@/services/authService";

const PAGE_LIMIT = 10;

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export default function TrainerDetailPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const trainerId = decodeURIComponent(id);

  const handleClientNameClick = useCallback(
    (profileId, partnerCode) => {
      if (!profileId) return;
      const token = Cookies.get("access_token");
      const decoded = token ? decodeJwt(token) : null;
      if (decoded?.role === "super_admin") {
        const params = new URLSearchParams({ profile_id: profileId });
        if (partnerCode) params.set("partner_code", partnerCode);
        router.push(`/superadmin-trainer/clients-profile?${params.toString()}`);
      }
    },
    [router]
  );

  const [trainer, setTrainer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    has_more: false,
  });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  const searchDebounceRef = useRef(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [q]);

  const cacheRef = useRef(new Map());

  const buildCacheKey = useCallback(
    (p) => `${debouncedQ}|${p}`,
    [debouncedQ]
  );

  const applyEntry = useCallback((entry) => {
    setTrainer(entry.trainer);
    setSummary(entry.summary);
    setPagination(entry.pagination);
    setClients(entry.clients);
  }, []);

  const loadClients = useCallback(
    async ({ force = false } = {}) => {
      if (!trainerId) {
        setLoading(false);
        return;
      }

      const key = buildCacheKey(page);

      if (!force) {
        const cached = cacheRef.current.get(key);
        if (cached) {
          applyEntry(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        const res = await fetchTrainerClientsOverviewForSuperAdminService({
          trainerId,
          page,
          limit: PAGE_LIMIT,
          search: debouncedQ,
        });

        const entry = {
          trainer: res?.trainer || null,
          summary: res?.summary || null,
          pagination:
            res?.pagination || {
              page,
              limit: PAGE_LIMIT,
              total: 0,
              has_more: false,
            },
          clients: Array.isArray(res?.data) ? res.data : [],
        };

        cacheRef.current.set(key, entry);
        applyEntry(entry);
      } catch (err) {
        toast.error(err?.message || "Failed to load clients");
      } finally {
        setLoading(false);
      }
    },
    [trainerId, page, debouncedQ, buildCacheKey, applyEntry]
  );

  useEffect(() => {
    cacheRef.current.clear();
  }, [debouncedQ, trainerId]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleRefresh = useCallback(() => {
    cacheRef.current.clear();
    loadClients({ force: true });
  }, [loadClients]);

  const totalPages = useMemo(() => {
    if (!pagination?.total) return 1;
    return Math.max(
      1,
      Math.ceil(pagination.total / (pagination.limit || PAGE_LIMIT))
    );
  }, [pagination]);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-[#308BF9] text-[12px] font-semibold inline-flex items-center gap-1 cursor-pointer w-fit"
      >
        &larr; Back
      </button>

      <div className="bg-white rounded-[12px] border border-[#E1E6ED] p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[#252525] text-[24px] font-bold tracking-[-0.5px]">
              {trainer?.name || trainerId}
            </h1>
            <span className="rounded-full bg-[#2EAF6A] text-white text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
              {trainer?.display_role || "Trainer"}
            </span>
          </div>
          {trainer?.email && (
            <div className="text-[#535359] text-[13px]">{trainer.email}</div>
          )}
          {trainer?.partner_code && (
            <div className="text-[#535359] text-[13px]">
              Partner code:{" "}
              <span className="font-mono">{trainer.partner_code}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 cursor-pointer disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Total clients</div>
          <div className="text-[#252525] text-[28px] font-bold">
            {summary?.total_clients ?? 0}
          </div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Tested</div>
          <div className="text-[#252525] text-[28px] font-bold">
            {summary?.tested_clients ?? 0}
          </div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Missed</div>
          <div className="text-[#252525] text-[28px] font-bold">
            {summary?.missed_clients ?? 0}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients"
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] flex-1 min-w-[240px] focus:outline-none focus:border-[#308BF9]"
        />
      </div>

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">
          Clients ({pagination?.total ?? 0})
        </h3>

        {loading ? (
          <div className="text-[#A1A1A1] text-[13px]">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
            No clients found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Name</th>
                  <th className="py-2.5 px-4 font-semibold">Email</th>
                  <th className="py-2.5 px-4 font-semibold">Profile ID</th>
                  <th className="py-2.5 px-4 font-semibold">Fitness Goal</th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    Metabolism Score
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    Acetone (ppm)
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    Ethanol (ppm)
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    H2 (ppm)
                  </th>
                 
                  <th className="py-2.5 px-4 font-semibold">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.profile_id}
                    className="border-t border-[#F5F7FA] hover:bg-[#F5F7FA]"
                  >
                    <td
                      className="py-2.5 px-4 text-[#252525] font-semibold cursor-pointer hover:text-[#308BF9]"
                      onClick={() =>
                        handleClientNameClick(
                          c.profile_id,
                          c.partner_code || trainer?.partner_code
                        )
                      }
                    >
                      {c.name || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c.email || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">
                      {c.profile_id || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c.fitness_goal
                        ? c.fitness_goal.replace(/_/g, " ")
                        : "-"}
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
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c.biomarkers?.acetone_ppm ?? "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c.biomarkers?.ethanol_ppm ?? "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c.biomarkers?.h2_ppm ?? "-"}
                    </td>
                   
                    <td className="py-2.5 px-4 text-[#A1A1A1]">
                      {c.last_active || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination?.total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-[#A1A1A1] text-[11px]">
            Showing{" "}
            <span className="text-[#252525] font-semibold">
              {(pagination.offset ?? (pagination.page - 1) * pagination.limit) +
                1}
              {"–"}
              {Math.min(
                (pagination.offset ??
                  (pagination.page - 1) * pagination.limit) + clients.length,
                pagination.total
              )}
            </span>{" "}
            of{" "}
            <span className="text-[#252525] font-semibold">
              {pagination.total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1 disabled:opacity-40 cursor-pointer"
            >
              Prev
            </button>
            <span className="text-[#535359] text-[11px]">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={!pagination.has_more || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
