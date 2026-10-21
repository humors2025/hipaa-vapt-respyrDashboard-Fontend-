"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { listFacilityPeopleService, formatMinor } from "@/services/commissionService";

/**
 * Facilities (super admin and trainer admin): the trainers or active members
 * behind a count — the API scopes a trainer admin to their own facilities.
 * FacilityPeopleList renders the list with its search box (also used inline
 * by the Trainers / Active members tabs); the default export wraps it in a
 * popup for one facility's counts. facility null = every facility, which adds
 * a Facility column. Escape / overlay / × close the popup.
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
// Search box → API `search` after this pause, once the trimmed term has
// SEARCH_MIN_LENGTH characters (same 400 ms / 3-char rule as the facilities
// search; the API rejects shorter terms with 422).
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 3;
// What the API's `search` matches on. Also applied client-side to the page
// that came back when the response has no `search` echo, i.e. the API in
// front of us predates the search support — the box still narrows that page.
const SEARCH_FIELDS = {
  trainers: ["name", "user_id", "phone", "partner_code", "facility_name"],
  members: ["name", "email", "partner_code", "qr_id", "code_owner_name", "facility_name"],
};
const rowMatches = (row, fields, term) => fields.some((k) => String(row?.[k] || "").toLowerCase().includes(term));

export function FacilityPeopleList({ facility, view, onCount }) {
  const [items, setItems] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // Search box text, and the trimmed term the list is asked for (after the debounce).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchRef = useRef("");
  // True when this page was narrowed here because the API ignored `search`.
  const [narrowedHere, setNarrowedHere] = useState(false);
  const facilityId = facility?.id ?? null;

  // A different list starts again at page 1 with an empty search, without
  // showing the old rows.
  useEffect(() => {
    setPage(1);
    setItems(null);
    setPagination(null);
    setSearchInput("");
    setSearch("");
    searchRef.current = "";
  }, [facilityId, view]);

  // Debounce the search box. Fewer than SEARCH_MIN_LENGTH characters is not a
  // search yet: the unfiltered list stays (with a hint by the box). A new term
  // always starts from page 1.
  useEffect(() => {
    const trimmed = searchInput.trim();
    const next = trimmed.length >= SEARCH_MIN_LENGTH ? trimmed : "";
    const t = setTimeout(() => {
      if (next === searchRef.current) return;
      searchRef.current = next;
      setSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!view) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listFacilityPeopleService({ facilityId, view, page, limit: PAGE_SIZE, search })
      .then((res) => {
        if (cancelled) return;
        let rows = res.items || [];
        // API without search support (no echo): narrow the page we got.
        const narrow = Boolean(search) && typeof res.search !== "string";
        if (narrow) {
          const term = search.toLowerCase();
          rows = rows.filter((r) => rowMatches(r, SEARCH_FIELDS[view] || [], term));
        }
        setNarrowedHere(narrow);
        setItems(rows);
        setPagination(res.pagination || null);
        // The popup title counts everyone, not the search matches.
        if (!search) onCount?.(res.total ?? rows.length);
      })
      .catch((err) => !cancelled && setError(err?.message || "Could not load list"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // onCount is a setter from the parent; refetch only when the list, page or term changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, view, page, search]);

  const isTrainers = view === "trainers";
  const all = !facility;
  const facilityCell = (row) =>
    all && <td className={`${TD} text-[#252525]`}>{row.facility_name || "—"}</td>;
  const typedLength = searchInput.trim().length;
  const tooShort = typedLength > 0 && typedLength < SEARCH_MIN_LENGTH;
  // Matches for the current term: the API's count when it searched for us,
  // else what is left of this page after the client-side narrowing.
  const matchTotal = narrowedHere ? items?.length ?? 0 : pagination?.total ?? items?.length ?? 0;
  const noun = isTrainers ? "trainer" : "member";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative w-full md:max-w-[440px]">
          <Search className="size-4 text-[#A1A1A1] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              // Escape clears the box first; with nothing typed it closes the popup as before.
              if (e.key === "Escape" && searchInput) {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setSearchInput("");
              }
            }}
            placeholder={
              isTrainers
                ? `Search trainer name, email, phone or code${all ? ", or facility" : ""}`
                : `Search member name, email, code or referrer${all ? ", or facility" : ""}`
            }
            aria-label={isTrainers ? "Search trainers" : "Search members"}
            autoComplete="off"
            className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-9 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
              title="Clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#A1A1A1] hover:bg-[#EEF4FE] hover:text-[#308BF9] cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {tooShort ? (
          <span className="text-[#A1A1A1] text-[12px]" aria-live="polite">
            Type at least {SEARCH_MIN_LENGTH} characters to search.
          </span>
        ) : !!search && !!items && (loading || matchTotal > 0) && (
          <span className="text-[#535359] text-[12px]" aria-live="polite">
            {loading ? (
              "Searching…"
            ) : (
              <>
                {matchTotal} {matchTotal === 1 ? `${noun} matches` : `${noun}s match`}{" "}
                <span className="font-semibold text-[#252525]">&ldquo;{search}&rdquo;</span>
              </>
            )}
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-[10px] bg-[#FCEAEB] text-[#B5363A] text-[12px] px-4 py-3">{error}</div>
      ) : !items ? (
        <div className="text-[#A1A1A1] text-[13px] py-10 text-center">Loading&hellip;</div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
          {search ? (
            <>
              No {isTrainers ? "trainers" : "members"} match &ldquo;{search}&rdquo;.
            </>
          ) : (
            `No ${isTrainers ? "active trainers" : "active members"} in ${all ? "any facility" : "this facility"}.`
          )}
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
                  <th className={`${TH} text-right`}>Gross</th>
                  <th className={`${TH} text-right`}>Discount</th>
                  <th className={`${TH} text-right`}>Net</th>
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
                    {/* Gross (list price) − referral discount = net (what the member paid), as on Sales analytics. */}
                    <td className={`${TD} text-right tabular-nums text-[#535359]`}>{formatMinor(m.amount_minor, m.currency)}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {Number(m.discount_amount_minor) > 0 ? <span className="text-[#A66B00]">−{formatMinor(m.discount_amount_minor, m.currency)}</span> : <span className="text-[#A1A1A1]">—</span>}
                    </td>
                    <td className={`${TD} text-right tabular-nums text-[#252525] font-semibold`}>
                      {m.net_amount_minor != null ? formatMinor(m.net_amount_minor, m.currency) : <span className="text-[#A1A1A1] font-normal">—</span>}
                    </td>
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
