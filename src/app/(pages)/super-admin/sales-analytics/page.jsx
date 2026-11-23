"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  SALES_SEARCH_MIN_LENGTH,
  fetchSuperAdminSalesOverviewService,
  fetchSuperAdminSalesPurchasesService,
  fetchSuperAdminSalesMonthlyService,
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
import SalesHeader from "@/components/super-admin/sales/redesign/SalesHeader";
import SalesHeadline from "@/components/super-admin/sales/redesign/SalesHeadline";
import SalesOverall from "@/components/super-admin/sales/redesign/SalesOverall";
import SalesRetentionPanel from "@/components/super-admin/sales/redesign/SalesRetentionPanel";
import SalesEngagementPanel from "@/components/super-admin/sales/redesign/SalesEngagementPanel";
import SalesTopTrainersPanel from "@/components/super-admin/sales/redesign/SalesTopTrainersPanel";
import SalesPurchasesPanel from "@/components/super-admin/sales/redesign/SalesPurchasesPanel";
import PurchaseDetailsDrawer from "@/components/super-admin/sales/PurchaseDetailsDrawer";
import TrainerPurchasesModal from "@/components/super-admin/sales/TrainerPurchasesModal";

const PAGE_LIMIT = 8;
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

  // ── Overall sales, every month (all time; ignores the period) ────────────
  const [monthly, setMonthly] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [monthlyError, setMonthlyError] = useState(null);
  const monthlyReq = useRef(0);

  const loadMonthly = useCallback(async () => {
    const id = ++monthlyReq.current;
    setMonthlyLoading(true);
    setMonthlyError(null);
    try {
      const res = await fetchSuperAdminSalesMonthlyService({ trainerAdmin });
      if (id !== monthlyReq.current) return;
      if (res?.status === false) throw new Error(res?.message || "Failed to load overall sales");
      setMonthly(res);
    } catch (err) {
      if (id !== monthlyReq.current) return;
      setMonthly(null);
      setMonthlyError(errorMessage(err, "Failed to load overall sales"));
    } finally {
      if (id === monthlyReq.current) setMonthlyLoading(false);
    }
  }, [trainerAdmin]);

  useEffect(() => {
    loadMonthly();
  }, [loadMonthly]);

  // ── Previous period, for the "% vs last …" lines on the KPI cards ─────────
  // While the current period is still running, compare like for like: the same
  // number of days from the start of the previous period (Nov 1–10 vs Oct 1–10).
  const prevRange = useMemo(() => {
    const full = getPeriodRange(period, shiftAnchor(period, anchor, -1));
    if (!nextDisabled) return { ...full, partial: false };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const elapsed = Math.round((today - range.from) / 86400000);
    const to = new Date(full.from.getFullYear(), full.from.getMonth(), full.from.getDate() + elapsed);
    return { from: full.from, to: to < full.to ? to : full.to, partial: true };
  }, [period, anchor, nextDisabled, range]);
  const prevFrom = toISODate(prevRange.from);
  const prevTo = toISODate(prevRange.to);
  const [previousOverview, setPreviousOverview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPreviousOverview(null);
    fetchSuperAdminSalesOverviewService({ period, dateFrom: prevFrom, dateTo: prevTo, trainerAdmin })
      .then((res) => {
        if (!cancelled && res?.status !== false) setPreviousOverview(res);
      })
      // The comparison is extra: on failure the cards just show no change line.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [period, prevFrom, prevTo, trainerAdmin]);

  const compareLabel = prevRange.partial ? `vs same days last ${period}` : `vs last ${period}`;

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

  // Short label for the coloured tags: "Nov 2026", "Week of Nov 17", "2026".
  const periodTag =
    period === "year"
      ? String(range.from.getFullYear())
      : period === "week"
      ? `Week of ${range.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : range.from.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-5 pb-8">
      <SalesHeader
        trainerAdmins={trainerAdmins}
        trainerAdmin={trainerAdmin}
        onTrainerAdminChange={changeView}
        selectedTa={selectedTa}
        mock={isSalesMockData()}
        period={period}
        onPeriodChange={changePeriod}
        rangeLabel={rangeLabel}
        onPrev={() => moveAnchor(-1)}
        onNext={() => moveAnchor(1)}
        nextDisabled={nextDisabled}
      />

      {ovError && !overview && (
        <div role="alert" className="rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[#B91C1C] text-[12px]">{ovError}</span>
          <button
            type="button"
            onClick={loadOverview}
            className="rounded-full bg-white border border-[#FCA5A5] text-[#B91C1C] text-[11px] font-semibold px-3 py-1 hover:bg-[#FEE2E2] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <SalesHeadline
        summary={ovError ? null : summary}
        breakdown={ovError ? null : breakdown}
        retention={ovError ? null : overview?.retention}
        previous={ovError ? null : previousOverview}
        monthly={monthlyError ? null : monthly}
        monthlyLoading={monthlyLoading}
        compareLabel={compareLabel}
        loading={ovInitial}
      />

      <SalesOverall
        monthly={monthly}
        monthlyLoading={monthlyLoading}
        monthlyError={monthlyError}
        onRetryMonthly={loadMonthly}
        buckets={buckets}
        trend={overview?.trend}
        breakdown={breakdown}
        summary={summary}
        period={period}
        rangeLabel={rangeLabel}
        overviewLoading={ovInitial}
        overviewUpdating={ovUpdating}
        overviewError={ovError}
        onRetryOverview={loadOverview}
      />

      <SalesRetentionPanel
        retention={overview?.retention}
        currency={currency}
        periodTag={periodTag}
        loading={ovInitial}
        updating={ovUpdating}
        error={ovError}
        onRetry={loadOverview}
      />

      <SalesEngagementPanel
        key={trainerAdmin || "all"}
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        trainerAdmin={trainerAdmin}
        rangeLabel={rangeLabel}
      />

      <SalesTopTrainersPanel
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

      <SalesPurchasesPanel
        rangeLabel={rangeLabel}
        data={purchases}
        loading={purchasesLoading}
        error={purchasesError}
        onRetry={loadPurchases}
        onSelect={setSelected}
        source={source}
        onSourceChange={resetPage(setSource)}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchMinLength={SALES_SEARCH_MIN_LENGTH}
        subscriptionStatus={subscriptionStatus}
        onSubscriptionStatusChange={resetPage(setSubscriptionStatus)}
        paymentStatus={paymentStatus}
        onPaymentStatusChange={resetPage(setPaymentStatus)}
        subscriptionOptions={subscriptionOptions}
        paymentOptions={paymentOptions}
        page={page}
        pageSize={PAGE_LIMIT}
        onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
        filtersActive={filtersActive}
      />

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
