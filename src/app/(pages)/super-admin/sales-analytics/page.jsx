"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  SALES_SEARCH_MIN_LENGTH,
  fetchSuperAdminSalesOverviewService,
  fetchSuperAdminSalesPurchasesService,
  fetchSalesTrainerAdminsService,
  isSalesMockData,
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
import TrainerPurchasesModal from "@/components/super-admin/sales/TrainerPurchasesModal";
import SalesViewSwitcher from "@/components/super-admin/sales/SalesViewSwitcher";
import { SalesCard, UpdatingPill } from "@/components/super-admin/sales/SalesUi";

const PAGE_LIMIT = 10;
// Used until the API returns filter_options (the backend's own status list wins).
const DEFAULT_SUBSCRIPTION_STATUSES = ["active", "expired", "cancelled", "upcoming"];
const DEFAULT_PAYMENT_STATUSES = ["paid", "refunded", "failed"];

function errorMessage(err, fallback) {
  return err?.data?.message || err?.message || fallback;
}

export default function SuperAdminSalesAnalyticsPage() {
  // ── View: network-wide Overview, or one Trainer Admin's network ───────────
  const [trainerAdmins, setTrainerAdmins] = useState([]);
  const [trainerAdmin, setTrainerAdmin] = useState(null);
  const selectedTa = trainerAdmins.find((t) => t.user_id === trainerAdmin) || null;

  useEffect(() => {
    fetchSalesTrainerAdminsService()
      .then(setTrainerAdmins)
      .catch(() => setTrainerAdmins([]));
  }, []);

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
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);
  const overviewReq = useRef(0);

  const loadOverview = useCallback(async () => {
    const id = ++overviewReq.current;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetchSuperAdminSalesOverviewService({ period, dateFrom, dateTo, trainerAdmin });
      if (id !== overviewReq.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load sales analytics");
      setOverview(res);
    } catch (err) {
      if (id !== overviewReq.current) return;
      const msg = errorMessage(err, "Failed to load sales analytics");
      setOverviewError(msg);
      toast.error(msg);
    } finally {
      if (id === overviewReq.current) setOverviewLoading(false);
    }
  }, [period, dateFrom, dateTo, trainerAdmin]);

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
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [purchasesError, setPurchasesError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
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
    const id = ++purchasesReq.current;
    setPurchasesLoading(true);
    setPurchasesError(null);
    try {
      const res = await fetchSuperAdminSalesPurchasesService({
        period,
        dateFrom,
        dateTo,
        trainerAdmin,
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
      const msg = errorMessage(err, "Failed to load purchases");
      setPurchasesError(msg);
      toast.error(msg);
    } finally {
      if (id === purchasesReq.current) setPurchasesLoading(false);
    }
  }, [period, dateFrom, dateTo, trainerAdmin, source, subscriptionStatus, paymentStatus, search, page]);

  // Switching view starts clean: no numbers from the previous view, filters reset.
  const changeView = (value) => {
    if (value === trainerAdmin) return;
    setTrainerAdmin(value);
    setOverview(null);
    setPurchases(null);
    setSource("all");
    setSubscriptionStatus("all");
    setPaymentStatus("all");
    setSearchInput("");
    setSearch("");
    setPage(1);
    setSelectedTrainer(null);
    setSelected(null);
  };

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

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
            <SalesViewSwitcher trainerAdmins={trainerAdmins} value={trainerAdmin} onChange={changeView} />
            {isSalesMockData() && (
              <span className="rounded-full bg-[#FFF4E0] text-[#A66B00] text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
                Mock data
              </span>
            )}
          </div>
          <p className="text-[#535359] text-[13px] mt-1">
            {selectedTa ? (
              <>
                Sales from <span className="font-semibold text-[#252525]">{selectedTa.name}</span>&apos;s network: trainers and
                facilities they onboarded, and website buyers who later linked one of those trainers.
              </>
            ) : (
              "Monitor revenue, purchases, subscription activity, and sales attribution across direct website purchases and trainer-referred purchases."
            )}
          </p>
        </div>
        <SalesPeriodFilter
          period={period}
          onPeriodChange={changePeriod}
          rangeLabel={rangeLabel}
          onPrev={() => moveAnchor(-1)}
          onNext={() => moveAnchor(1)}
          nextDisabled={nextDisabled}
        />
      </div>

      <>
          <SalesKpiCards summary={ovError ? null : summary} breakdown={ovError ? null : breakdown} loading={ovInitial} />

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
            websiteHint={selectedTa ? "Bought on the website, later linked a trainer in this network" : undefined}
            breakdown={breakdown}
            summary={summary}
            loading={ovInitial}
            updating={ovUpdating}
            error={ovError}
            onRetry={loadOverview}
          />

          <TopTrainerSales
            key={`${trainerAdmin || "all"}-${period}-${dateFrom}`}
            trainers={overview?.top_trainers}
            onSelect={setSelectedTrainer}
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

      <TrainerPurchasesModal
        key={selectedTrainer?.partner_code || "none"}
        trainer={selectedTrainer}
        trainerAdmin={trainerAdmin}
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        rangeLabel={rangeLabel}
        currency={currency}
        purchaseOpen={Boolean(selected)}
        onClose={() => setSelectedTrainer(null)}
        onSelectPurchase={setSelected}
      />
      <PurchaseDetailsDrawer purchase={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
