"use client";

import { useMemo, useState } from "react";
import { formatCount, formatMoney, formatPercent } from "./salesFormat";
import { EmptyState, SalesCard, SectionError, Skeleton, UpdatingPill } from "./SalesUi";
import { SalesPagination } from "./PurchaseTable";

const PAGE_SIZE = 10;
const SEARCH_MIN_LENGTH = 3;

const ROLE_LABEL = { trainer: "Trainer", facility_admin: "Facility admin", admin: "Trainer admin" };

// Name on top, email / code underneath; "—" when there is nothing to show.
function Person({ name, sub, extra }) {
  if (!name && !sub) return <span className="text-[#A1A1A1]">—</span>;
  return (
    <>
      <div className="text-[#252525] font-semibold truncate">{name || "—"}</div>
      {sub && <div className="text-[#A1A1A1] text-[11px] truncate">{sub}</div>}
      {extra && <div className="text-[#A1A1A1] text-[11px] truncate">{extra}</div>}
    </>
  );
}

// Fields the search box matches against (case-insensitive substring).
function searchText(t) {
  return [t.trainer_name, t.trainer_email, t.partner_code, t.facility?.name, t.facility?.admin_name, t.parent_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// The API returns every trainer with sales in the period, ranked by net sales,
// so paging and searching happen here. Rank stays the trainer's overall rank.
export default function TopTrainerSales({ trainers, trainerNetSales, currency, loading, updating, error, onRetry, onSelect }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const ranked = useMemo(() => (trainers || []).map((t, i) => ({ ...t, rank: i + 1 })), [trainers]);
  const query = search.trim().toLowerCase();
  // Filter only once the query is long enough; shorter input keeps the full list.
  const tooShort = query.length > 0 && query.length < SEARCH_MIN_LENGTH;
  const list = query.length >= SEARCH_MIN_LENGTH ? ranked.filter((t) => searchText(t).includes(query)) : ranked;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <SalesCard
      title="Top Trainer Codes"
      subtitle="Trainers ranked by net sales from their codes · click a trainer to see their purchases"
      action={<UpdatingPill show={updating} />}
    >
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[36px] w-full" />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <EmptyState message="No trainer-code purchases were recorded during this period." />
      ) : (
        <>
          <div className="relative w-full md:max-w-[420px] mb-1">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search trainer, email, code, facility or parent user"
              aria-label="Search trainer codes"
              autoComplete="off"
              className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
            />
          </div>
          <p className="text-[#A1A1A1] text-[11px] mb-3 min-h-[16px]">
            {tooShort ? `Type at least ${SEARCH_MIN_LENGTH} characters to search.` : ""}
          </p>
          {list.length === 0 ? (
            <EmptyState message={`No trainers match "${search.trim()}".`} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
                <table className="w-full text-[12px] min-w-[1180px]">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                      <th scope="col" className="py-2.5 px-4 font-semibold w-[60px]">Rank</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Trainer</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Trainer Code</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Facility / Facility Admin</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold">Parent User</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-right">Purchases</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-right">Gross Sales</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-right">Net Sales</th>
                      <th scope="col" className="py-2.5 px-4 font-semibold text-right">% of Trainer Sales</th>
                      <th scope="col" className="py-2.5 px-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((t) => {
                      const rank = t.rank;
                      return (
                        <tr
                          key={t.partner_code || t.trainer_id || rank}
                          onClick={() => onSelect(t)}
                          className="border-t border-[#F5F7FA] hover:bg-[#FAFBFD] cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                                rank <= 3 ? "bg-[#EEF4FE] text-[#308BF9]" : "bg-[#F5F7FA] text-[#535359]"
                              }`}
                            >
                              {rank}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 max-w-[220px]">
                            <Person name={t.trainer_name} sub={t.trainer_email} />
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-[11px] text-[#535359] bg-[#F5F7FA] rounded-[6px] px-2 py-0.5">{t.partner_code || "—"}</span>
                            {t.role && <div className="text-[#A1A1A1] text-[11px] mt-1">{ROLE_LABEL[t.role] || t.role}</div>}
                          </td>
                          <td className="py-2.5 px-4 max-w-[230px]">
                            {t.facility ? (
                              <Person
                                name={t.facility.name}
                                sub={
                                  t.facility.status === "invited"
                                    ? "Invited · facility not set up"
                                    : t.facility.admin_name || t.facility.admin_user_id
                                }
                                extra={t.facility.admin_name ? t.facility.admin_user_id : null}
                              />
                            ) : (
                              <span className="text-[#A1A1A1]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 max-w-[220px]">
                            <Person name={t.parent_name} sub={t.parent_user_id} />
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#535359]">{formatCount(t.purchases)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#535359]">{formatMoney(t.gross_sales, currency)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#252525] font-semibold">{formatMoney(t.net_sales, currency)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#535359]">{formatPercent(t.net_sales, trainerNetSales)}</td>
                          <td className="py-1.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(t);
                              }}
                              aria-label={`View purchases for ${t.trainer_name || t.partner_code}`}
                              title="View purchases"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] text-[#A1A1A1] hover:bg-[#EEF4FE] hover:text-[#308BF9] transition-colors cursor-pointer"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {list.length > PAGE_SIZE && (
                <SalesPagination
                  page={current}
                  limit={PAGE_SIZE}
                  total={list.length}
                  totalPages={totalPages}
                  onPageChange={(p) => p >= 1 && p <= totalPages && setPage(p)}
                  noun="trainers"
                />
              )}
            </>
          )}
        </>
      )}
    </SalesCard>
  );
}
