"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  SALES_SEARCH_MIN_LENGTH,
  fetchSuperAdminSalesOverviewService,
  fetchSuperAdminSalesPurchasesService,
  getSalesDataSource,
  syncSuperAdminSalesFromStripeService,
} from "@/services/superAdminSalesService";
import {
  buildBuckets,
  formatRangeLabel,
  getPeriodRange,
  isCurrentOrFuturePeriod,
  shiftAnchor,
  toISODate,
} from "@/components/super-admin/sales/salesFormat";
import SalesPeriodFilter from "@/components/super-admin/sales/SalesPeriodFilter";
import SalesKpiCards from "@/components/super-admin/sales/SalesKpiCards";
import SalesTrendChart from "@/components/super-admin/sales/SalesTrendChart";
import SalesSourceDoughnut from "@/components/super-admin/sales/SalesSourceDoughnut";
import SalesChannelComparison from "@/components/super-admin/sales/SalesChannelComparison";
import TopTrainerSales from "@/components/super-admin/sales/TopTrainerSales";
import PurchaseFilters from "@/components/super-admin/sales/PurchaseFilters";
import PurchaseTable, { SalesPagination } from "@/components/super-admin/sales/PurchaseTable";
import PurchaseDetailsDrawer from "@/components/super-admin/sales/PurchaseDetailsDrawer";
import { SalesCard, UpdatingPill } from "@/components/super-admin/sales/SalesUi";

const PAGE_LIMIT = 10;
// Used until the API returns filter_options (the backend's own status list wins).
const DEFAULT_SUBSCRIPTION_STATUSES = ["active", "expired", "cancelled", "upcoming"];
const DEFAULT_PAYMENT_STATUSES = ["paid", "refunded", "failed"];

function errorMessage(err, fallback) {
  return err?.data?.message || err?.message || fallback;
}

// The backend answers 503 + code "sales_table_missing" until migration 006 is run.
const isSetupMissing = (err) => err?.data?.code === "sales_table_missing";

export default function SuperAdminSalesAnalyticsPage() {
  const dataSource = getSalesDataSource();
  const connected = dataSource !== "unavailable";

  // ── Global period ─────────────────────────────────────────────────────────
  const [period, setPeriod] = useState("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const range = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);
  const dateFrom = toISODate(range.from);
  const dateTo = toISODate(range.to);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const buckets = useMemo(() => buildBuckets(period, range.from, range.to), [period, range]);
  const nextDisabled = isCurrentOrFuturePeriod(period, anchor);

  const changePeriod = (p) => {
    if (p === period) return;
    setPeriod(p);
    setAnchor(new Date());
    setPage(1);
  };

  const moveAnchor = (dir) => {
    if (dir > 0 && nextDisabled) return;
    setAnchor((a) => shiftAnchor(period, a, dir));
    setPage(1);
  };

  // ── Overview (KPIs, charts, channels, top trainers) ───────────────────────
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(connected);
  const [overviewError, setOverviewError] = useState(null);
  const [setupMissing, setSetupMissing] = useState(false);
  const overviewReq = useRef(0);

  const loadOverview = useCallback(async () => {
    if (!connected) return;
    const id = ++overviewReq.current;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetchSuperAdminSalesOverviewService({ period, dateFrom, dateTo });
      if (id !== overviewReq.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load sales analytics");
      setOverview(res);
    } catch (err) {
      if (id !== overviewReq.current) return;
      if (isSetupMissing(err)) {
        setSetupMissing(true);
        return;
      }
      const msg = errorMessage(err, "Failed to load sales analytics");
      setOverviewError(msg);
      toast.error(msg);
    } finally {
      if (id === overviewReq.current) setOverviewLoading(false);
    }
  }, [connected, period, dateFrom, dateTo]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // ── Purchases table ───────────────────────────────────────────────────────
  const [source, setSource] = useState("all");
  const [subscriptionStatus, setSubscriptionStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [purchases, setPurchases] = useState(null);
  const [purchasesLoading, setPurchasesLoading] = useState(connected);
  const [purchasesError, setPurchasesError] = useState(null);
  const [selected, setSelected] = useState(null);
  const purchasesReq = useRef(0);

  // Filter setters that also go back to page 1 (batched → a single fetch).
  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  // Debounced search (same 400 ms / 3-char rule as Paid Subscribers).
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length > 0 && trimmed.length < SALES_SEARCH_MIN_LENGTH) return;
    const t = setTimeout(() => {
      setSearch(trimmed);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadPurchases = useCallback(async () => {
    if (!connected) return;
    const id = ++purchasesReq.current;
    setPurchasesLoading(true);
    setPurchasesError(null);
    try {
      const res = await fetchSuperAdminSalesPurchasesService({
        period,
        dateFrom,
        dateTo,
        source,
        subscriptionStatus,
        paymentStatus,
        search,
        page,
        limit: PAGE_LIMIT,
      });
      if (id !== purchasesReq.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load purchases");
      setPurchases(res);
    } catch (err) {
      if (id !== purchasesReq.current) return;
      if (isSetupMissing(err)) {
        setSetupMissing(true);
        return;
      }
      const msg = errorMessage(err, "Failed to load purchases");
      setPurchasesError(msg);
      toast.error(msg);
    } finally {
      if (id === purchasesReq.current) setPurchasesLoading(false);
    }
  }, [connected, period, dateFrom, dateTo, source, subscriptionStatus, paymentStatus, search, page]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  // ── Sync past invoices from Stripe ────────────────────────────────────────
  const [syncProgress, setSyncProgress] = useState(null);
  const syncing = syncProgress !== null;

  const runSync = async () => {
    if (syncing) return;
    setSyncProgress({ processed: 0, total: 0 });
    try {
      const res = await syncSuperAdminSalesFromStripeService(setSyncProgress);
      toast.success(`Synced ${res?.subscriptions_total ?? 0} memberships from Stripe`);
      loadOverview();
      loadPurchases();
    } catch (err) {
      toast.error(errorMessage(err, "Sync from Stripe failed"));
    } finally {
      setSyncProgress(null);
    }
  };

  const pagination = purchases?.pagination;
  const totalPages = Math.max(1, pagination?.total_pages || Math.ceil((pagination?.total || 0) / PAGE_LIMIT) || 1);
  const subscriptionOptions = purchases?.filter_options?.subscription_status || DEFAULT_SUBSCRIPTION_STATUSES;
  const paymentOptions = purchases?.filter_options?.payment_status || DEFAULT_PAYMENT_STATUSES;
  const filtersActive = source !== "all" || subscriptionStatus !== "all" || paymentStatus !== "all" || Boolean(search);

  // ── Derived overview props ────────────────────────────────────────────────
  const summary = overview?.summary;
  const breakdown = overview?.source_breakdown;
  const currency = summary?.currency;
  const ovInitial = overviewLoading && !overview;
  const ovUpdating = overviewLoading && Boolean(overview);
  const ovError = overviewError;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-[640px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Sales Analytics</h1>
            {dataSource === "mock" && (
              <span className="rounded-full bg-[#FFF4E0] text-[#A66B00] text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
                Mock data
              </span>
            )}
          </div>
          <p className="text-[#535359] text-[13px] mt-1">
            Monitor revenue, purchases, subscription activity, and sales attribution across direct website purchases
            and trainer-referred purchases.
          </p>
        </div>
        <div className="flex items-start gap-3 flex-wrap">
          {dataSource === "api" && !setupMissing && (
            <button
              type="button"
              onClick={runSync}
              disabled={syncing}
              title="Load past invoices, refunds and failed payments from Stripe"
              className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 mt-1 hover:bg-[#DCEAFE] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {syncing
                ? `Syncing${syncProgress.total ? ` ${syncProgress.processed}/${syncProgress.total}` : "…"}`
                : "Sync from Stripe"}
            </button>
          )}
        <SalesPeriodFilter
          period={period}
          onPeriodChange={changePeriod}
          rangeLabel={rangeLabel}
          onPrev={() => moveAnchor(-1)}
          onNext={() => moveAnchor(1)}
          nextDisabled={nextDisabled}
        />
        </div>
      </div>

      {setupMissing ? (
        <SalesCard>
          <div className="flex flex-col items-center text-center gap-2 py-10">
            <div className="text-[#252525] text-[14px] font-bold">Sales data isn&apos;t set up on this environment yet</div>
            <p className="text-[#535359] text-[12px] max-w-[560px]">
              The backend is deployed but its sales table has not been created. Once the <code>sales_invoices</code> table
              exists, reload this page and use <strong>Sync from Stripe</strong> to load past payments.
            </p>
          </div>
        </SalesCard>
      ) : !connected ? (
        <SalesCard>
          <div className="flex flex-col items-center text-center gap-2 py-10">
            <div className="text-[#252525] text-[14px] font-bold">Sales data isn&apos;t connected yet</div>
            <p className="text-[#535359] text-[12px] max-w-[520px]">
              Network-wide sales analytics needs the Super Admin sales endpoint on the backend. Once it is deployed,
              this page will show revenue, purchases and attribution for the selected period.
            </p>
          </div>
        </SalesCard>
      ) : (
        <>
          <SalesKpiCards summary={ovError ? null : summary} loading={ovInitial} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 min-w-0">
              <SalesTrendChart
                buckets={buckets}
                trend={overview?.trend}
                currency={currency}
                loading={ovInitial}
                updating={ovUpdating}
                error={ovError}
                onRetry={loadOverview}
                rangeLabel={rangeLabel}
              />
            </div>
            <div className="min-w-0">
              <SalesSourceDoughnut
                breakdown={breakdown}
                currency={currency}
                loading={ovInitial}
                updating={ovUpdating}
                error={ovError}
                onRetry={loadOverview}
              />
            </div>
          </div>

          <SalesChannelComparison
            breakdown={breakdown}
            summary={summary}
            loading={ovInitial}
            updating={ovUpdating}
            error={ovError}
            onRetry={loadOverview}
          />

          <TopTrainerSales
            key={`${period}-${dateFrom}`}
            trainers={overview?.top_trainers}
            total={overview?.top_trainers_total}
            trainerNetSales={breakdown?.trainer_code?.net_sales}
            currency={currency}
            loading={ovInitial}
            updating={ovUpdating}
            error={ovError}
            onRetry={loadOverview}
          />

          <SalesCard
            title="Purchase Details"
            subtitle={`Customers who purchased during ${rangeLabel}`}
            action={<UpdatingPill show={purchasesLoading && Boolean(purchases)} />}
          >
            <PurchaseFilters
              source={source}
              onSourceChange={resetPage(setSource)}
              search={searchInput}
              onSearchChange={setSearchInput}
              searchMinLength={SALES_SEARCH_MIN_LENGTH}
              subscriptionStatus={subscriptionStatus}
              onSubscriptionStatusChange={resetPage(setSubscriptionStatus)}
              paymentStatus={paymentStatus}
              onPaymentStatusChange={resetPage(setPaymentStatus)}
              subscriptionStatusOptions={subscriptionOptions}
              paymentStatusOptions={paymentOptions}
            />
            <PurchaseTable
              rows={purchases?.purchases}
              loading={purchasesLoading && !purchases}
              updating={purchasesLoading && Boolean(purchases)}
              error={purchasesError}
              onRetry={loadPurchases}
              onSelect={setSelected}
              emptyMessage={filtersActive ? "No purchases match these filters." : "No sales found for the selected period."}
            />
            {purchases && !purchasesError && (
              <SalesPagination
                page={page}
                limit={PAGE_LIMIT}
                total={pagination?.total || 0}
                totalPages={totalPages}
                disabled={purchasesLoading}
                onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
              />
            )}
          </SalesCard>
        </>
      )}

      <PurchaseDetailsDrawer purchase={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
