"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listFacilityPeopleService, formatMinor } from "@/services/commissionService";

/**
 * Facilities (super admin and trainer admin): the trainers or active members
 * behind a count — the API scopes a trainer admin to their own facilities.
 * FacilityPeopleList renders the list (also used inline by the Trainers /
 * Active members tabs); the default export wraps it in a popup for one
 * facility's counts. facility null = every facility, which adds a Facility
 * column. Escape / overlay / × close the popup.
 */

const STATUS = {
  active: "bg-[#E5F6EE] text-[#1F7A4A]",
  trialing: "bg-[#EEF4FE] text-[#308BF9]",
  past_due: "bg-[#FFF4E0] text-[#A66B00]",
};

const label = (s) => (s ? String(s).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const TH = "py-2.5 px-3 font-semibold whitespace-nowrap";
const TD = "py-2.5 px-3 whitespace-nowrap";
// Rows per page (super-admin-facility-people `limit`).
const PAGE_SIZE = 10;

export function FacilityPeopleList({ facility, view, onCount }) {
  const [items, setItems] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const facilityId = facility?.id ?? null;

  // A different list starts again at page 1, without showing the old rows.
  useEffect(() => {
    setPage(1);
    setItems(null);
    setPagination(null);
  }, [facilityId, view]);

  useEffect(() => {
    if (!view) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listFacilityPeopleService({ facilityId, view, page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items || []);
        setPagination(res.pagination || null);
        onCount?.(res.total ?? (res.items || []).length);
      })
      .catch((err) => !cancelled && setError(err?.message || "Could not load list"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // onCount is a setter from the parent; refetch only when the list or page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, view, page]);

  const isTrainers = view === "trainers";
  const all = !facility;
  const facilityCell = (row) =>
    all && <td className={`${TD} text-[#252525]`}>{row.facility_name || "—"}</td>;

  return (
    <>
      {error ? (
        <div className="rounded-[10px] bg-[#FCEAEB] text-[#B5363A] text-[12px] px-4 py-3">{error}</div>
      ) : !items ? (
        <div className="text-[#A1A1A1] text-[13px] py-10 text-center">Loading&hellip;</div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
          {`No ${isTrainers ? "active trainers" : "active members"} in ${all ? "any facility" : "this facility"}.`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          {isTrainers ? (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className={TH}>Trainer</th>
                  {all && <th className={TH}>Facility</th>}
                  <th className={TH}>Phone</th>
                  <th className={TH}>Code</th>
                  <th className={`${TH} text-right`}>Split</th>
                  <th className={`${TH} text-right`}>Active members</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.user_id} className="border-t border-[#F5F7FA]">
                    <td className={TD}>
                      <div className="text-[#252525]">{t.name || "—"}</div>
                      <div className="text-[#A1A1A1] text-[11px]">{t.user_id}</div>
                    </td>
                    {facilityCell(t)}
                    <td className={`${TD} text-[#535359]`}>{t.phone || "—"}</td>
                    <td className={`${TD} font-mono text-[#535359]`}>{t.partner_code || "—"}</td>
                    <td className={`${TD} text-right text-[#252525]`}>{t.commission_split_pct}%</td>
                    <td className={`${TD} text-right text-[#252525]`}>{t.active_members}</td>
                    <td className={TD}>
                      <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${STATUS[t.status] || "bg-[#F5F7FA] text-[#535359]"}`}>{label(t.status)}</span>
                    </td>
                    <td className={`${TD} text-[#A1A1A1]`}>{fmtDate(t.joined_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className={TH}>Member</th>
                  {all && <th className={TH}>Facility</th>}
                  <th className={TH}>Plan</th>
                  <th className={`${TH} text-right`}>Price</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Plan period</th>
                  <th className={TH}>Code used</th>
                  <th className={TH}>App linked</th>
                  <th className={TH}>Purchased</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-t border-[#F5F7FA]">
                    <td className={TD}>
                      <div className="text-[#252525]">{m.name || "—"}</div>
                      <div className="text-[#A1A1A1] text-[11px]">{m.email || "—"}</div>
                    </td>
                    {facilityCell(m)}
                    <td className={`${TD} text-[#535359]`}>{m.plan_code}</td>
                    <td className={`${TD} text-right text-[#252525]`}>{formatMinor(m.amount_minor, m.currency)}</td>
                    <td className={TD}>
                      <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${STATUS[m.status] || "bg-[#F5F7FA] text-[#535359]"}`}>{label(m.status)}</span>
                    </td>
                    <td className={`${TD} text-[#535359]`}>{m.current_period_start ? `${fmtDate(m.current_period_start)} – ${fmtDate(m.current_period_end)}` : "—"}</td>
                    <td className={TD}>
                      <div className="font-mono text-[#535359]">{m.partner_code || "—"}</div>
                      <div className="text-[#A1A1A1] text-[11px]">{[m.code_owner_name, m.qr_id && `QR ${m.qr_id}`].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className={`${TD} text-[#535359]`}>{m.app_linked ? "Yes" : "No"}</td>
                    <td className={`${TD} text-[#A1A1A1]`}>{fmtDate(m.purchased_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between gap-3 text-[12px] text-[#535359] mt-3">
          <span>
            {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || pagination.page <= 1} className="rounded-full bg-white border border-[#E1E6ED] px-3 py-1 font-semibold disabled:opacity-50 cursor-pointer">
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button type="button" onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))} disabled={loading || pagination.page >= pagination.total_pages} className="rounded-full bg-white border border-[#E1E6ED] px-3 py-1 font-semibold disabled:opacity-50 cursor-pointer">
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function FacilityPeopleDialog({ target, onClose }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!target) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const title = target.view === "trainers" ? "Trainers" : "Active members";
  const all = !target.facility;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${all ? "All facilities" : target.facility.name} ${title}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[15px] shadow-[0_16px_48px_rgba(37,37,37,0.18)] w-full max-w-[900px] max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E1E6ED]">
          <div className="min-w-0">
            <h2 className="text-[#252525] text-[18px] font-bold leading-tight">
              {title}
              {count != null && <span className="ml-1.5 text-[#A1A1A1] font-semibold">({count})</span>}
            </h2>
            <div className="text-[#535359] text-[12px] mt-1">
              {all ? "All facilities" : <>{target.facility.name} · <span className="font-mono">{target.facility.partner_code}</span></>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-1.5 text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#535359] cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <FacilityPeopleList facility={target.facility} view={target.view} onCount={setCount} />
        </div>
      </div>
    </div>
  );
}
