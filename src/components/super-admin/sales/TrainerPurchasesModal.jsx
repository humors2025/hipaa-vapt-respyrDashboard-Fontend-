"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { fetchSuperAdminSalesPurchasesService } from "@/services/superAdminSalesService";
import { formatCount, formatMoney } from "./salesFormat";
import PurchaseTable, { SalesPagination } from "./PurchaseTable";
import { UpdatingPill } from "./SalesUi";

const PAGE_LIMIT = 10;

function Stat({ label, value }) {
  return (
    <div className="rounded-[10px] bg-[#F5F7FA] px-3 py-2.5 min-w-0">
      <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-[#252525] text-[15px] font-bold tabular-nums truncate">{value}</div>
    </div>
  );
}

// Every purchase made with one trainer's code in the selected period.
// The page keys this component by trainer code, so switching trainers starts fresh.
// purchaseOpen: the details drawer is showing on top; Escape / clicks then
// belong to the drawer and must not close this popup underneath it.
export default function TrainerPurchasesModal({
  trainer,
  trainerAdmin,
  period,
  dateFrom,
  dateTo,
  rangeLabel,
  currency,
  purchaseOpen,
  onClose,
  onSelectPurchase,
}) {
  const open = Boolean(trainer);
  const code = trainer?.partner_code || "";
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const req = useRef(0);

  const load = useCallback(async () => {
    if (!code) return;
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSuperAdminSalesPurchasesService({
        period,
        dateFrom,
        dateTo,
        trainerAdmin,
        source: "trainer_code",
        partnerCode: code,
        page,
        limit: PAGE_LIMIT,
      });
      if (id !== req.current) return;
      setData(res);
    } catch (err) {
      if (id !== req.current) return;
      const msg = err?.data?.message || err?.message || "Failed to load purchases";
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [code, trainerAdmin, period, dateFrom, dateTo, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pagination = data?.pagination;
  const totalPages = Math.max(1, pagination?.total_pages || 1);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[1080px] max-h-[calc(100vh-48px)] overflow-y-auto bg-white rounded-[15px] shadow-xl p-5 flex flex-col gap-4 focus:outline-none"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => purchaseOpen && e.preventDefault()}
          onPointerDownOutside={(e) => purchaseOpen && e.preventDefault()}
          onFocusOutside={(e) => purchaseOpen && e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-[#252525] text-[16px] font-bold truncate">
                {trainer?.trainer_name || "Trainer"} · Purchases
              </Dialog.Title>
              <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                <span className="font-mono text-[11px] text-[#535359] bg-[#F5F7FA] rounded-[6px] px-2 py-0.5">{code}</span>
                {trainer?.trainer_email && <span className="text-[#A1A1A1]">{trainer.trainer_email}</span>}
                <span className="text-[#A1A1A1]">· {rangeLabel}</span>
                <UpdatingPill show={loading && Boolean(data)} />
              </div>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#252525] transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Dialog.Close>
          </div>

          {trainer && (trainer.facility || trainer.parent_user_id) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] -mt-1">
              {trainer.facility && (
                <span className="text-[#535359]">
                  Facility: <span className="font-semibold text-[#252525]">{trainer.facility.name}</span>
                  {trainer.facility.status === "invited" ? (
                    <span className="text-[#A1A1A1]"> (invited, not set up)</span>
                  ) : (
                    <>
                      {" · admin "}
                      <span className="font-semibold text-[#252525]">{trainer.facility.admin_name || trainer.facility.admin_user_id}</span>
                      {trainer.facility.admin_name && <span className="text-[#A1A1A1]"> ({trainer.facility.admin_user_id})</span>}
                    </>
                  )}
                </span>
              )}
              {trainer.parent_user_id && (
                <span className="text-[#535359]">
                  Parent user: <span className="font-semibold text-[#252525]">{trainer.parent_name || trainer.parent_user_id}</span>
                  {trainer.parent_name && <span className="text-[#A1A1A1]"> ({trainer.parent_user_id})</span>}
                </span>
              )}
            </div>
          )}

          {trainer && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Purchases" value={formatCount(trainer.purchases)} />
              <Stat label="Gross sales" value={formatMoney(trainer.gross_sales, currency)} />
              <Stat label="Net sales" value={formatMoney(trainer.net_sales, currency)} />
            </div>
          )}

          <PurchaseTable
            rows={data?.purchases}
            loading={loading && !data}
            updating={loading && Boolean(data)}
            error={error && !data ? error : null}
            onRetry={load}
            onSelect={onSelectPurchase}
            emptyMessage="No purchases with this code in the selected period."
            hideTrainer
          />
          {data && (
            <SalesPagination
              page={page}
              limit={PAGE_LIMIT}
              total={pagination?.total || 0}
              totalPages={totalPages}
              disabled={loading}
              onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
