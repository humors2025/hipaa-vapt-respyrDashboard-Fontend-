"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { fetchAllTrainersForSuperAdminService } from "@/services/authService";

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

export default function SuperAdminTrainersPage() {
  const [trainers, setTrainers] = useState([]);
  const [trainerAdminOptions, setTrainerAdminOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    has_more: false,
  });
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [taFilter, setTaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [currentRole, setCurrentRole] = useState(null);

  useEffect(() => {
    const token = Cookies.get("access_token");
    const decoded = token ? decodeJwt(token) : null;
    setCurrentRole(decoded?.role || null);
  }, []);

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
    (p) => `${debouncedQ}|${taFilter}|${statusFilter}|${p}`,
    [debouncedQ, taFilter, statusFilter]
  );

  const applyResult = useCallback((entry, fallbackPage) => {
    setTrainers(entry.data);
    setTrainerAdminOptions(entry.trainerAdminOptions);
    setSummary(entry.summary);
    setPagination(
      entry.pagination || {
        page: fallbackPage,
        limit: PAGE_LIMIT,
        total: 0,
        has_more: false,
      }
    );
  }, []);

  const loadData = useCallback(
    async ({ force = false } = {}) => {
      const key = buildCacheKey(page);

      if (!force) {
        const cached = cacheRef.current.get(key);
        if (cached) {
          applyResult(cached, page);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        const res = await fetchAllTrainersForSuperAdminService({
          page,
          limit: PAGE_LIMIT,
          search: debouncedQ,
          trainerAdminUserId: taFilter,
          status: statusFilter,
        });

        const entry = {
          data: Array.isArray(res?.data) ? res.data : [],
          trainerAdminOptions: Array.isArray(res?.trainer_admin_options)
            ? res.trainer_admin_options
            : [],
          summary: res?.summary || null,
          pagination: res?.pagination || null,
        };

        cacheRef.current.set(key, entry);
        applyResult(entry, page);
      } catch (err) {
        toast.error(err?.message || "Failed to load trainers");
      } finally {
        setLoading(false);
      }
    },
    [page, debouncedQ, taFilter, statusFilter, buildCacheKey, applyResult]
  );

  useEffect(() => {
    cacheRef.current.clear();
  }, [debouncedQ, taFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    cacheRef.current.clear();
    loadData({ force: true });
  }, [loadData]);

  const totalPages = useMemo(() => {
    if (!pagination?.total) return 1;
    return Math.max(1, Math.ceil(pagination.total / (pagination.limit || PAGE_LIMIT)));
  }, [pagination]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            Trainers
          </h1>
          <p className="text-[#535359] text-[13px] mt-1">
            All trainers in the network. Filter by Trainer Admin or status, search by name / email / partner code.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, or code"
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] flex-1 min-w-[240px] focus:outline-none focus:border-[#308BF9]"
        />
        {/* <select
          value={taFilter}
          onChange={(e) => {
            setTaFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px]"
        >
          <option value="">All Trainer Admins</option>
          {trainerAdminOptions.map((ta) => (
            <option key={ta.user_id} value={ta.user_id}>
              {ta.name || ta.user_id}
              {ta.is_self ? " (You)" : ""}
            </option>
          ))}
        </select> */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#F5F7FA] text-[#535359] text-left">
              <th className="py-2.5 px-4 font-semibold">Name</th>
              <th className="py-2.5 px-4 font-semibold">Trainer Admin</th>
              <th className="py-2.5 px-4 font-semibold">Partner code</th>
              <th className="py-2.5 px-4 font-semibold text-right">Clients</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-[#A1A1A1] text-[12px]">
                  Loading...
                </td>
              </tr>
            ) : trainers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-[#A1A1A1] text-[12px]">
                  No trainers match your filters.
                </td>
              </tr>
            ) : (
              trainers.map((t) => {
                const rowKey =
                  t.role_id ?? t.invitation_id ?? `${t.user_id}-${t.source}`;
                return (
                  <tr
                    key={rowKey}
                    className="border-t border-[#F5F7FA] hover:bg-[#F5F7FA]"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.actual_role === "super_admin" ? (
                          <span className="text-[#252525] font-semibold">
                            {t.name || t.user_id}
                          </span>
                        ) : (
                          <Link
                            href={`/super-admin/trainers/${encodeURIComponent(
                              t.partner_code
                            )}`}
                            className="text-[#308BF9] font-semibold hover:underline"
                          >
                            {t.name || t.user_id}
                          </Link>
                        )}
                        {currentRole === "super_admin" &&
                          t.actual_role === "super_admin" && (
                            <Link
                              href="/trainer/dashboard"
                              className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#DCE9FD]"
                            >
                              View my clients
                            </Link>
                          )}
                      </div>
                      <div className="text-[#A1A1A1] text-[11px]">
                        {t.email || t.user_id}
                      </div>
                      {/* {t.display_role && t.display_role !== "trainer" && (
                        <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide mt-0.5">
                          {t.display_role.replace(/_/g, " ")}
                        </div>
                      )} */}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {t.trainer_admin_name || t.trainer_admin?.name || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">
                      {t.partner_code || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#252525]">
                      {t.clients_count ?? 0}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-2.5 px-4 text-[#A1A1A1]">
                      {t.joined
                        ? new Date(t.joined).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "-"}
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
              {(pagination.offset ?? (pagination.page - 1) * pagination.limit) + 1}
              {"–"}
              {Math.min(
                (pagination.offset ?? (pagination.page - 1) * pagination.limit) +
                  trainers.length,
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

function SummaryCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "text-[#1F7A4A]"
      : tone === "warning"
      ? "text-[#A86A00]"
      : tone === "danger"
      ? "text-[#B5363A]"
      : tone === "muted"
      ? "text-[#A1A1A1]"
      : "text-[#252525]";
  return (
    <div className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5">
      <div className="text-[#A1A1A1] text-[11px]">{label}</div>
      <div className={`text-[16px] font-bold mt-0.5 ${toneClass}`}>
        {value ?? 0}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-[#E5F6EE] text-[#1F7A4A]"
      : s === "pending"
      ? "bg-[#FFF4E0] text-[#A86A00]"
      : s === "expired"
      ? "bg-[#F1F3F5] text-[#535359]"
      : s === "revoked"
      ? "bg-[#FCEAEB] text-[#B5363A]"
      : "bg-[#F1F3F5] text-[#535359]";
  return (
    <span
      className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${cls}`}
    >
      {status || "—"}
    </span>
  );
}
