"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchTrainerAdminClientsListDirService } from "@/services/authService";

const PAGE_LIMIT = 10;

const LEVEL_TONE = {
  "1": "bg-[#E5F6EE] text-[#1F7A4A]",
  "2": "bg-[#FFF4E1] text-[#A66A00]",
  "3": "bg-[#FDECEE] text-[#B02A37]",
};

function formatJoined(value) {
  if (!value) return "-";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function prettify(value) {
  if (!value || value === "NA") return "-";
  return String(value).replace(/_/g, " ");
}

export default function ClientDirectory() {
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    has_more: false,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const searchDebounceRef = useRef(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  const cacheRef = useRef(new Map());

  useEffect(() => {
    cacheRef.current.clear();
  }, [debouncedSearch]);

  const loadClients = useCallback(
    async ({ force = false } = {}) => {
      const cacheKey = `${debouncedSearch}|${page}`;

      if (!force) {
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          setClients(cached.clients);
          setPagination(cached.pagination);
          setError(null);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetchTrainerAdminClientsListDirService({
          page,
          limit: PAGE_LIMIT,
          search: debouncedSearch,
        });

        const nextClients = Array.isArray(res?.clients) ? res.clients : [];
        const nextPagination =
          res?.pagination || {
            page,
            limit: PAGE_LIMIT,
            total: 0,
            has_more: false,
            offset: 0,
          };

        cacheRef.current.set(cacheKey, {
          clients: nextClients,
          pagination: nextPagination,
        });

        setClients(nextClients);
        setPagination(nextPagination);
      } catch (err) {
        const message = err?.message || "Failed to load clients";
        setError(message);
        toast.error(message);
        setClients([]);
      } finally {
        setLoading(false);
      }
    },
    [page, debouncedSearch]
  );

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const totalPages = useMemo(() => {
    if (!pagination?.total) return 1;
    return Math.max(
      1,
      Math.ceil(pagination.total / (pagination.limit || PAGE_LIMIT))
    );
  }, [pagination]);

  const showingFrom =
    pagination?.total > 0
      ? (pagination.offset ?? (pagination.page - 1) * pagination.limit) + 1
      : 0;
  const showingTo =
    pagination?.total > 0
      ? Math.min(
          (pagination.offset ?? (pagination.page - 1) * pagination.limit) +
            clients.length,
          pagination.total
        )
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[#252525] text-[14px] font-semibold">
            All clients
          </span>
          <span className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2 py-0.5">
            {pagination?.total ?? 0}
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[280px] rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9]"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-[10px] border border-[#F5C2C7] bg-[#FDECEE] text-[#B02A37] text-[12px] px-4 py-3">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED] bg-white">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#F5F7FA] text-[#535359] text-left">
              <th className="py-2.5 px-4 font-semibold">Profile ID</th>
              <th className="py-2.5 px-4 font-semibold">Client</th>
              <th className="py-2.5 px-4 font-semibold">Email</th>
              <th className="py-2.5 px-4 font-semibold">Phone</th>
              <th className="py-2.5 px-4 font-semibold">DOB</th>
              <th className="py-2.5 px-4 font-semibold">Age</th>
              <th className="py-2.5 px-4 font-semibold">Gender</th>
              <th className="py-2.5 px-4 font-semibold text-right">Height</th>
              <th className="py-2.5 px-4 font-semibold text-right">Weight</th>
              <th className="py-2.5 px-4 font-semibold">Fitness Goal</th>
              <th className="py-2.5 px-4 font-semibold">Level</th>
              <th className="py-2.5 px-4 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="py-6 px-4 text-center text-[#A1A1A1]">
                  Loading clients&hellip;
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-6 px-4 text-center text-[#A1A1A1]">
                  {debouncedSearch
                    ? "No clients match your search."
                    : "No clients yet."}
                </td>
              </tr>
            ) : (
              clients.map((c) => {
                const levelTone = LEVEL_TONE[c?.level_type] || "bg-[#F5F7FA] text-[#535359]";
                const name = c?.profile_name || c?.client_name || "Unnamed";
                return (
                  <tr
                    key={c?.profile_id}
                    className="border-t border-[#F5F7FA] hover:bg-[#F8FAFC]"
                  >
                    <td className="py-2.5 px-4 text-[#535359] font-mono">
                      {c?.profile_id || "-"}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525] font-semibold">{name}</div>
                      {c?.client_name && c.client_name !== c.profile_name && (
                        <div className="text-[#A1A1A1] text-[11px]">
                          {c.client_name}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c?.email || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c?.phone_no && c.phone_no !== "NA" ? c.phone_no : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c?.dob && c.dob !== "hidden" ? c.dob : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c?.age || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c?.gender || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c?.height ? `${c.height} cm` : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c?.weight ? `${c.weight} kg` : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] capitalize">
                      {prettify(c?.fitness_goal)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${levelTone}`}
                      >
                        L{c?.level_type ?? "-"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#A1A1A1]">
                      {formatJoined(c?.joined_dttm)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination?.total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-[#A1A1A1] text-[11px]">
            Showing{" "}
            <span className="text-[#252525] font-semibold">
              {showingFrom}&ndash;{showingTo}
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
