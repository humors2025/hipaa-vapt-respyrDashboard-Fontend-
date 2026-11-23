"use client";

import { useMemo, useState } from "react";
import { formatCount, formatMoney, formatPercent } from "../salesFormat";
import { Bone, C, CodeChip, Empty, ErrorBox, Pager, Panel, PanelHeader, SearchBox, UpdatingDot } from "./ui";

// Trainers ranked by net sales from their codes in the selected dates
// (overview.top_trainers, all of them; paging and search happen here).
// Clicking a row opens that trainer's purchases (TrainerPurchasesModal).

const PAGE_SIZE = 10;
const SEARCH_MIN = 3;
const ROLE_LABEL = { trainer: "Trainer", facility_admin: "Facility admin", admin: "Trainer admin" };

const searchText = (t) =>
  [t.trainer_name, t.trainer_email, t.partner_code, t.facility?.name, t.facility?.admin_name, t.parent_name, t.parent_user_id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const HEADERS = [
  { label: "Rank" },
  { label: "Trainer" },
  { label: "Trainer Code" },
  { label: "Facility / Facility Admin" },
  { label: "Parent User" },
  { label: "Purchases", right: true },
  { label: "Gross Sales", right: true },
  { label: "Net Sales", right: true },
  { label: "% of Trainer Sales", right: true },
  { label: "", sr: "Open" },
];

export default function SalesTopTrainersPanel({ trainers, trainerNetSales, currency, loading, updating, error, onRetry, onSelect }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const ranked = useMemo(() => (trainers || []).map((t, i) => ({ ...t, rank: i + 1 })), [trainers]);
  const q = search.trim().toLowerCase();
  const tooShort = q.length > 0 && q.length < SEARCH_MIN;
  const list = q.length >= SEARCH_MIN ? ranked.filter((t) => searchText(t).includes(q)) : ranked;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <Panel>
      <PanelHeader
        className="px-6 sm:px-7 pt-6"
        title="Top Trainer Codes"
        subtitle="Trainers ranked by net sales from their codes · click a trainer to see their purchases"
        action={<UpdatingDot show={updating} />}
      />

      <div className="px-6 sm:px-7 pt-4 flex items-center gap-3 flex-wrap">
        <SearchBox
          className="w-full max-w-[400px]"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search trainer, email, code, facility or parent user"
          label="Search trainer codes"
        />
        {tooShort && <span className="text-[11px] text-[#A1A1A1]">Type at least {SEARCH_MIN} characters to search.</span>}
      </div>

      <div className="px-6 sm:px-7 pt-4 pb-6">
        {error ? (
          <ErrorBox message={error} onRetry={onRetry} />
        ) : loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} className="h-[52px]" />
            ))}
          </div>
        ) : (
          <>
            <div className="border border-[#E1E6ED] rounded-[12px] overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead>
                  <tr className="bg-[#F5F7FA]">
                    {HEADERS.map((h) => (
                      <th
                        key={h.label || h.sr}
                        scope="col"
                        className={`px-3.5 py-3 text-[10px] font-medium text-[#738298] tracking-[-0.2px] whitespace-nowrap border-b border-[#E1E6ED] ${
                          h.right ? "text-right" : "text-left"
                        }`}
                      >
                        {h.sr ? <span className="sr-only">{h.sr}</span> : h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={HEADERS.length}>
                        {ranked.length === 0 ? (
                          <Empty title="No trainer-code purchases in these dates" />
                        ) : (
                          <Empty title="No trainers match your search" hint="Try a different search term" />
                        )}
                      </td>
                    </tr>
                  )}
                  {shown.map((t) => (
                    <tr
                      key={t.partner_code || t.trainer_id || t.rank}
                      onClick={() => onSelect(t)}
                      className="border-b border-[#E1E6ED] last:border-0 cursor-pointer hover:bg-[#F5F7FA] transition-colors"
                    >
                      <td className="px-3.5 py-4 w-[50px]">
                        <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${t.rank <= 3 ? "bg-[#E9F3FF]" : "bg-[#F5F7FA]"}`}>
                          <span className={`text-[12px] font-semibold ${t.rank <= 3 ? "text-[#308BF9]" : "text-[#535359]"}`}>{t.rank}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-4 max-w-[220px]">
                        <div className="text-[12px] font-semibold text-[#252525] tracking-[-0.24px] truncate">{t.trainer_name || "—"}</div>
                        {t.trainer_email && <div className="text-[10px] text-[#738298] mt-0.5 truncate">{t.trainer_email}</div>}
                      </td>
                      <td className="px-3.5 py-4">
                        <CodeChip>{t.partner_code}</CodeChip>
                        {t.role && <div className="text-[10px] text-[#738298] mt-1">{ROLE_LABEL[t.role] || t.role}</div>}
                      </td>
                      <td className="px-3.5 py-4 max-w-[240px]">
                        {t.facility ? (
                          <>
                            <div className="text-[11px] font-semibold text-[#252525] uppercase truncate">{t.facility.name || "—"}</div>
                            <div className="text-[10px] text-[#535359] mt-0.5 truncate">
                              {t.facility.status === "invited" ? "Invited · facility not set up" : t.facility.admin_name || "—"}
                            </div>
                            {t.facility.admin_user_id && <div className="text-[10px] text-[#738298] mt-px truncate">{t.facility.admin_user_id}</div>}
                          </>
                        ) : (
                          <span className="text-[#A1A1A1] text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-4 max-w-[220px]">
                        {t.parent_name || t.parent_user_id ? (
                          <>
                            <div className="text-[12px] font-semibold text-[#252525] truncate">{t.parent_name || "—"}</div>
                            {t.parent_user_id && <div className="text-[10px] text-[#738298] mt-0.5 truncate">{t.parent_user_id}</div>}
                          </>
                        ) : (
                          <span className="text-[#A1A1A1] text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-4 text-right text-[13px] font-semibold text-[#252525] tabular-nums">{formatCount(t.purchases)}</td>
                      <td className="px-3.5 py-4 text-right text-[12px] font-medium text-[#535359] tabular-nums">{formatMoney(t.gross_sales, currency)}</td>
                      <td className="px-3.5 py-4 text-right text-[13px] font-bold text-[#3FAF58] tabular-nums">{formatMoney(t.net_sales, currency)}</td>
                      <td className="px-3.5 py-4 text-right text-[12px] font-medium text-[#535359] tabular-nums">
                        {formatPercent(t.net_sales, trainerNetSales)}
                      </td>
                      <td className="px-3.5 py-4 w-8">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.td} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageSize={PAGE_SIZE} total={list.length} onChange={(p) => p >= 1 && p <= totalPages && setPage(p)} noun="trainers" />
          </>
        )}
      </div>
    </Panel>
  );
}
