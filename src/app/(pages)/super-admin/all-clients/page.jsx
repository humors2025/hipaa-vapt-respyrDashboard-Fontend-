"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import {
  getSuperAdminAllClients,
  hydrateSuperAdminAllClients,
  selectAllClientsActor,
  selectAllClientsFilters,
  selectAllClientsSummary,
  selectAllClientsPagination,
  selectAllClientsList,
  selectAllClientsLoading,
  selectAllClientsError,
} from "@/store/superAdminAllClientsSlice";
import { zoneLabel } from "@/lib/utils";

const PAGE_LIMIT = 10;

const TYPE_OPTIONS = [
  { value: "all", label: "All clients" },
  { value: "tested", label: "Tested on date" },
  { value: "missed", label: "Missed on date" },
  { value: "never_tested", label: "Never tested" },
];

function todayISO() {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
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
    s === "tested"
      ? "bg-[#E5F6EE] text-[#1F7A4A]"
      : s === "missed"
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

function ZoneBadge({ zone }) {
  if (!zone) return <span className="text-[#A1A1A1]">-</span>;
  const cls =
    zone === "Optimal" || zone === "Strong"
      ? "bg-[#E5F6EE] text-[#1F7A4A]"
      : zone === "Moderate" || zone === "Steady"
      ? "bg-[#FFF4E0] text-[#A66B00]"
      : "bg-[#FCEAEB] text-[#B5363A]";
  return (
    <span
      className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${cls}`}
    >
      {zoneLabel(zone)}
    </span>
  );
}

export default function SuperAdminAllClientsPage() {
  const dispatch = useDispatch();

  const actor = useSelector(selectAllClientsActor);
  const filters = useSelector(selectAllClientsFilters);
  const summary = useSelector(selectAllClientsSummary);
  const pagination = useSelector(selectAllClientsPagination);
  const clients = useSelector(selectAllClientsList);
  const loading = useSelector(selectAllClientsLoading);
  const error = useSelector(selectAllClientsError);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);

  // Debounce the search box, reset to first page on a new term.
  const searchDebounceRef = useRef(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [q]);

  // Cache each fetched page keyed by the active filters so paging back to an
  // already-loaded page is served from memory instead of re-hitting the API.
  const cacheRef = useRef(new Map());
  const buildCacheKey = useCallback(
    (p) => `${debouncedQ}|${date}|${type}|${p}`,
    [debouncedQ, date, type]
  );

  // Any filter change invalidates the cache (the dataset is different).
  useEffect(() => {
    cacheRef.current.clear();
  }, [debouncedQ, date, type]);

  const loadData = useCallback(
    ({ force = false } = {}) => {
      const key = buildCacheKey(page);

      if (!force) {
        const cached = cacheRef.current.get(key);
        if (cached) {
          dispatch(hydrateSuperAdminAllClients(cached));
          return;
        }
      }

      dispatch(
        getSuperAdminAllClients({
          page,
          limit: PAGE_LIMIT,
          search: debouncedQ,
          date,
          type,
          dietitianId: "",
        })
      )
        .unwrap()
        .then((res) => {
          cacheRef.current.set(key, res);
        })
        .catch((err) => {
          toast.error(err || "Failed to load network clients");
        });
    },
    [dispatch, page, debouncedQ, date, type, buildCacheKey]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    cacheRef.current.clear();
    loadData({ force: true });
  }, [loadData]);

  const totalPages = useMemo(() => {
    if (!pagination?.total) return 1;
    return Math.max(
      1,
      Math.ceil(pagination.total / (pagination.limit || PAGE_LIMIT))
    );
  }, [pagination]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            All Clients in network
          </h1>
          <p className="text-[#535359] text-[13px] mt-1">
            Every client across the network with their test status for the
            selected date.
            {actor?.partner_code ? (
              <span className="text-[#A1A1A1]"> · {actor.partner_code}</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
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

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Total clients" value={summary.total_clients} />
          <SummaryCard
            label="Tested"
            value={summary.tested_clients}
            tone="success"
          />
          <SummaryCard
            label="Missed"
            value={summary.missed_clients}
            tone="danger"
          />
          <SummaryCard
            label="Never tested"
            value={summary.never_tested_clients}
            tone="muted"
          />
          <SummaryCard
            label="Tested anytime"
            value={summary.tested_anytime_clients}
          />
          <SummaryCard
            label="Missed (tested before)"
            value={summary.missed_but_tested_before}
            tone="warning"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or profile ID"
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] flex-1 min-w-[240px] focus:outline-none focus:border-[#308BF9]"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-[#308BF9]"
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px]"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#F5F7FA] text-[#535359] text-left">
              <th className="py-2.5 px-4 font-semibold">Name</th>
              <th className="py-2.5 px-4 font-semibold">Profile ID</th>
              <th className="py-2.5 px-4 font-semibold">Trainer</th>
              <th className="py-2.5 px-4 font-semibold">Fitness goal</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold text-right">Score</th>
              <th className="py-2.5 px-4 font-semibold">Zone</th>
              <th className="py-2.5 px-4 font-semibold text-right">Acetone</th>
              <th className="py-2.5 px-4 font-semibold text-right">Ethanol</th>
              <th className="py-2.5 px-4 font-semibold text-right">H₂</th>
              <th className="py-2.5 px-4 font-semibold">Diet plan</th>
              <th className="py-2.5 px-4 font-semibold">Last active</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={12}
                  className="py-8 px-4 text-center text-[#A1A1A1] text-[12px]"
                >
                  Loading clients...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="py-8 px-4 text-center text-[#A1A1A1] text-[12px]"
                >
                  No clients match your filters.
                </td>
              </tr>
            ) : (
              clients.map((c) => {
                const status = c.selected_date_status?.status;
                return (
                  <tr
                    key={c.profile_id}
                    className="border-t border-[#F5F7FA] hover:bg-[#F5F7FA]"
                  >
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525] font-semibold">
                        {c.name || "-"}
                      </div>
                      <div className="text-[#A1A1A1] text-[11px]">
                        {c.email || "-"}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">
                      {c.profile_id || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      <div>{c.associated_dietitian?.name || "-"}</div>
                      <div className="text-[#A1A1A1] text-[11px] font-mono">
                        {c.dietitian_id || c.partner_code || "-"}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {c.fitness_goal
                        ? c.fitness_goal.replace(/_/g, " ")
                        : "-"}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={status} />
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
                      <ZoneBadge zone={c.zone} />
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c.acetone_ppm ?? "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c.ethanol_ppm ?? "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">
                      {c.h2_ppm ?? "-"}
                    </td>
                    <td className="py-2.5 px-4">
                      {c.diet_plan?.generated ? (
                        <span className="inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[#E5F6EE] text-[#1F7A4A]">
                          Generated
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[#F1F3F5] text-[#535359]">
                          None
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-[#A1A1A1]">
                      {c.last_active || "-"}
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
