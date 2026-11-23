"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCancellationsService } from "@/services/superAdminOrdersService";
import { formatCount, formatMoney, formatPercent } from "../salesFormat";
import { BLUE_GRADIENT, Bone, C, CARD_SHADOW, Delta, Dot } from "./ui";

// Top of the page: Total Sales banner, the three purchase numbers, then
// Subscription Activity (renewals / upcoming) and Performance (cancellations /
// average month).
//
// summary / breakdown / retention: overview response for the selected dates.
// previous: overview response for the period before (for the change lines).
// monthly: view=monthly response (all time). Cancellations come from the Orders
// cancellations view so the number matches the Orders tab exactly.

// Everyone who cancelled (still active until the paid month ends, or ended),
// the same request as the Orders top cards. Not tied to the dates or TA view.
function useCancellationTotals() {
  const [state, setState] = useState({ loading: true, data: null });
  useEffect(() => {
    let alive = true;
    fetchCancellationsService({ limit: 1 })
      .then((res) => {
        if (!alive) return;
        if (res?.status === false) throw new Error("failed");
        setState({
          loading: false,
          data: {
            count: res?.summary?.total ?? res?.pagination?.total ?? 0,
            scheduled: res?.summary?.scheduled || 0,
            ended: res?.summary?.ended || 0,
          },
        });
      })
      .catch(() => alive && setState({ loading: false, data: null }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const Label = ({ children, className = "" }) => (
  <span className={`text-[13px] font-medium text-[#738298] tracking-[-0.26px] leading-tight ${className}`}>{children}</span>
);
const Big = ({ children, className = "" }) => (
  <span className={`text-[32px] xl:text-[36px] font-bold text-[#252525] tracking-[-1.1px] leading-none mt-2.5 tabular-nums truncate ${className}`}>
    {children}
  </span>
);
const Sub = ({ children, className = "" }) => (
  <span className={`text-[13px] text-[#535359] tracking-[-0.26px] mt-1 tabular-nums ${className}`}>{children}</span>
);
const Muted = ({ children }) => <span className="text-[12px] text-[#738298] tracking-[-0.24px] leading-snug mt-1">{children}</span>;

function OrdersLink({ href, children = "View in Orders →", className = "text-[#308BF9]" }) {
  return (
    <Link href={href} className={`text-[13px] font-semibold tracking-[-0.26px] mt-auto pt-3 hover:underline ${className}`}>
      {children}
    </Link>
  );
}

function Strip({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-[15px] border border-[#E1E6ED] ${CARD_SHADOW} overflow-hidden min-w-0 ${className}`}>{children}</div>
  );
}

function Cell({ children, className = "" }) {
  return <div className={`px-6 xl:px-7 py-6 flex flex-col min-w-0 ${className}`}>{children}</div>;
}

// failedRenewals: useFailedRenewals() state, loaded once by the page and shared
// with Renewals & Retention.
export default function SalesHeadline({
  summary,
  breakdown,
  retention,
  previous,
  monthly,
  monthlyLoading,
  failedRenewals = { loading: true, data: null },
  compareLabel,
  loading,
}) {
  const cancellations = useCancellationTotals();
  const s = summary || {};
  const b = breakdown || {};
  const cur = s.currency;
  const prev = previous?.summary;
  // A change line only makes sense in the same currency.
  const comparable = prev && (!prev.currency || !cur || prev.currency === cur);
  const was = (v) => (comparable ? v : undefined);

  const totalNet = Number(s.net_sales) || 0;
  const total = s.total_purchases;
  const renewals = retention?.renewals;
  const prevRenewals = comparable ? previous?.retention?.renewals : null;
  const upcoming = retention?.upcoming;

  const months = monthly?.months?.length || 0;
  const t = monthly?.totals || {};
  const perMonth = (v) => (months ? (Number(v) || 0) / months : 0);
  const showRenewals = monthly?.renewals_available !== false;

  return (
    <div className="flex flex-col gap-5">
      {/* Total Sales banner */}
      <div
        className={`${BLUE_GRADIENT} rounded-[15px] px-7 sm:px-9 py-8 text-white flex items-center justify-between gap-6 flex-wrap shadow-[0_4px_20px_rgba(48,139,249,0.22)]`}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-white/90 tracking-[-0.26px]">Total Sales</span>
          {loading ? (
            <Bone className="h-[44px] w-[220px] mt-2 !bg-white/25" />
          ) : (
            <span className="text-[40px] sm:text-[44px] font-bold tracking-[-1.3px] leading-none mt-2 tabular-nums">{formatMoney(s.net_sales, cur)}</span>
          )}
          <div className="mt-3 min-h-[20px]">
            {!loading && <Delta current={s.net_sales} previous={was(prev?.net_sales)} label={compareLabel} white />}
          </div>
        </div>
        <span className="text-[12px] text-white/70 tracking-[-0.24px] max-w-[220px] sm:text-right leading-normal">
          Net of first payments this period
        </span>
      </div>

      {/* New purchases · Direct website · Trainer code */}
      <Strip className="grid grid-cols-1 md:grid-cols-3">
        <Cell>
          <Label>New Purchases</Label>
          {loading ? <Bone className="h-9 w-20 mt-2.5" /> : <Big>{formatCount(total)}</Big>}
          <div className="mt-3">{!loading && <Delta current={total} previous={was(prev?.total_purchases)} label={compareLabel} />}</div>
          <Muted>Paid memberships (renewals excluded)</Muted>
        </Cell>
        <Cell className="border-t md:border-t-0 md:border-x border-[#E1E6ED]">
          <Label>Direct Website</Label>
          {loading ? <Bone className="h-9 w-20 mt-2.5" /> : <Big>{formatCount(s.website_purchases)}</Big>}
          {!loading && (
            <Sub>
              {formatMoney(b.website?.net_sales, cur)} · {formatPercent(b.website?.net_sales, totalNet)} of sales
            </Sub>
          )}
          <div className="mt-2">
            {!loading && <Delta current={s.website_purchases} previous={was(prev?.website_purchases)} label={compareLabel} />}
          </div>
          <Muted>{formatPercent(s.website_purchases, total)} of purchases</Muted>
        </Cell>
        <Cell className="border-t md:border-t-0 border-[#E1E6ED]">
          <Label>Trainer Code</Label>
          {loading ? <Bone className="h-9 w-20 mt-2.5" /> : <Big>{formatCount(s.trainer_code_purchases)}</Big>}
          {!loading && (
            <Sub>
              {formatMoney(b.trainer_code?.net_sales, cur)} · {formatPercent(b.trainer_code?.net_sales, totalNet)} of sales
            </Sub>
          )}
          <div className="mt-2">
            {!loading && <Delta current={s.trainer_code_purchases} previous={was(prev?.trainer_code_purchases)} label={compareLabel} />}
          </div>
          <Muted>{formatPercent(s.trainer_code_purchases, total)} of purchases</Muted>
        </Cell>
      </Strip>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Subscription Activity */}
        <Strip>
          <div className="px-7 pt-4 pb-3 border-b border-[#E1E6ED]">
            <span className="text-[14px] font-semibold text-[#252525] tracking-[-0.28px]">Subscription Activity</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <Cell className="sm:border-r border-[#E1E6ED]">
              <div className="flex items-center gap-2">
                <Dot color={C.green} />
                <Label className="!font-semibold !text-[#535359]">Renewals</Label>
              </div>
              {loading ? (
                <Bone className="h-9 w-16 mt-2.5" />
              ) : (
                <>
                  <Big>{renewals ? formatCount(renewals.payments) : "—"}</Big>
                  <Sub>{renewals ? `${formatMoney(renewals.net_sales, cur)} collected` : "Renewals are not recorded here yet"}</Sub>
                  <div className="mt-2">
                    {renewals && <Delta current={renewals.payments} previous={prevRenewals?.payments} label={compareLabel} />}
                  </div>
                </>
              )}
              <OrdersLink href="/super-admin/orders?tab=renewals" />
            </Cell>
            <Cell className="bg-[#FFFBF0] border-t sm:border-t-0 sm:border-r border-[#E1E6ED]">
              <div className="flex items-center gap-2">
                <Dot color="#D4A017" />
                <span className="text-[13px] font-semibold text-[#9A7613] tracking-[-0.26px]">Upcoming</span>
              </div>
              {loading ? (
                <Bone className="h-9 w-16 mt-2.5 !bg-[#F6EDD2]" />
              ) : (
                <Big className="!text-[#6B5B1A]">{upcoming ? formatCount(upcoming.total) : "—"}</Big>
              )}
              <span className="text-[12px] text-[#8B7D3A] tracking-[-0.24px] leading-normal mt-2">
                Set to renew from now until the period ends (cancelled plans not counted)
              </span>
              <OrdersLink href="/super-admin/orders?tab=upcoming" className="text-[#7A6A1A]" />
            </Cell>
            <Cell className="bg-[#FFF5F5] border-t sm:border-t-0 border-[#E1E6ED]">
              <div className="flex items-center gap-2">
                <Dot color={C.red} />
                <span className="text-[13px] font-semibold text-[#B5363A] tracking-[-0.26px]">Failed renewals</span>
              </div>
              {failedRenewals.loading ? (
                <Bone className="h-9 w-16 mt-2.5 !bg-[#F8E1E1]" />
              ) : (
                <Big className={failedRenewals.data?.count > 0 ? "!text-[#B5363A]" : ""}>
                  {failedRenewals.data ? formatCount(failedRenewals.data.count) : "—"}
                </Big>
              )}
              <span className="text-[12px] text-[#9B4A4A] tracking-[-0.24px] leading-normal mt-2">
                {failedRenewals.data
                  ? `${formatCount(failedRenewals.data.declined)} declined · ${formatCount(failedRenewals.data.pending)} not paid yet · all time, as in Orders`
                  : failedRenewals.loading
                  ? "Renewal payments that did not go through"
                  : "Could not load the Orders failed renewals"}
              </span>
              <OrdersLink href="/super-admin/orders?tab=failed" className="text-[#B5363A]" />
            </Cell>
          </div>
        </Strip>

        {/* Performance */}
        <Strip>
          <div className="px-7 pt-4 pb-3 border-b border-[#E1E6ED]">
            <span className="text-[14px] font-semibold text-[#252525] tracking-[-0.28px]">Performance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <Cell className="sm:border-r border-[#E1E6ED]">
              <div className="flex items-center gap-2">
                <Dot color={C.red} />
                <Label className="!font-semibold !text-[#535359]">Cancellations</Label>
              </div>
              {cancellations.loading ? (
                <Bone className="h-9 w-16 mt-2.5" />
              ) : (
                <>
                  <Big>{cancellations.data ? formatCount(cancellations.data.count) : "—"}</Big>
                  <span className="text-[12px] text-[#738298] tracking-[-0.24px] leading-normal mt-2">
                    {cancellations.data ? (
                      <>
                        {formatCount(cancellations.data.scheduled)} active, won&apos;t renew
                        <br />
                        {formatCount(cancellations.data.ended)} ended · all time, as in Orders
                      </>
                    ) : (
                      "Could not load the Orders cancellations"
                    )}
                  </span>
                </>
              )}
              <OrdersLink href="/super-admin/orders?tab=cancellations" />
            </Cell>
            <Cell className="border-t sm:border-t-0 border-[#E1E6ED]">
              <div className="flex items-center gap-2">
                <Dot color={C.blue} />
                <Label className="!font-semibold !text-[#535359]">Avg Monthly</Label>
              </div>
              {!monthly && monthlyLoading ? (
                <Bone className="h-9 w-28 mt-2.5" />
              ) : !monthly ? (
                <>
                  <Big>—</Big>
                  <Muted>Could not load the monthly totals</Muted>
                </>
              ) : (
                <>
                  <Big>{formatMoney(perMonth(t.total_sales), monthly.currency)}</Big>
                  <Sub className="!font-semibold">
                    {Math.round(perMonth(t.new_purchases))} new
                    {showRenewals && <> · {Math.round(perMonth(t.renewals))} renewals</>}
                  </Sub>
                  <Muted>
                    avg per month ({formatCount(months)} {months === 1 ? "month" : "months"})
                  </Muted>
                </>
              )}
            </Cell>
          </div>
        </Strip>
      </div>
    </div>
  );
}
