"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatDate, formatMoney } from "./salesFormat";
import { SourceBadge, StatusBadge } from "./SalesUi";

function truncateMiddle(s, keep = 10) {
  const v = String(s);
  return v.length <= keep * 2 + 1 ? v : `${v.slice(0, keep)}…${v.slice(-6)}`;
}

function CopyableId({ value }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!value) return <span className="text-[#A1A1A1]">—</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-[11px] text-[#252525] truncate" title={String(value)}>
        {truncateMiddle(value)}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy ID"}
        className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
          copied ? "bg-[#E5F6EE] text-[#1F7A4A]" : "bg-[#F5F7FA] text-[#535359] hover:bg-[#EEF4FE] hover:text-[#308BF9]"
        }`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-[12px] border border-[#E1E6ED] p-4">
      <h3 className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide mb-3">{title}</h3>
      <dl className="flex flex-col gap-2.5">{children}</dl>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[12px]">
      <dt className="text-[#535359] shrink-0">{label}</dt>
      <dd className="text-[#252525] font-semibold text-right min-w-0 break-words">{children ?? <span className="text-[#A1A1A1] font-normal">—</span>}</dd>
    </div>
  );
}

export default function PurchaseDetailsDrawer({ purchase, onClose }) {
  const open = Boolean(purchase);
  const p = purchase || {};
  const cur = p.currency;
  const isTrainer = p.purchase_source === "trainer_code";
  const discount = Number(p.discount_amount) || 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="bg-[#F5F7FA] w-full sm:max-w-[440px] p-0 gap-0 overflow-y-auto border-l-[#E1E6ED]">
        <div className="bg-white border-b border-[#E1E6ED] px-5 py-4 pr-12">
          <SheetTitle className="text-[#252525] text-[16px] font-bold">Purchase details</SheetTitle>
          <SheetDescription className="text-[#A1A1A1] text-[12px] mt-0.5">
            {p.purchased_at ? formatDate(p.purchased_at, true) : ""}
          </SheetDescription>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <SourceBadge source={p.purchase_source} />
            <StatusBadge status={p.payment_status} />
          </div>
        </div>

        {open && (
          <div className="flex flex-col gap-3 p-4">
            <Section title="Customer">
              <Row label="Name">{p.customer?.name}</Row>
              <Row label="Email">{p.customer?.email}</Row>
              <Row label="Profile ID">{p.customer?.profile_id ? <CopyableId value={p.customer.profile_id} /> : null}</Row>
            </Section>

            <Section title="Purchase">
              <Row label="Purchase date">{formatDate(p.purchased_at, true)}</Row>
              <Row label="Gross amount">{formatMoney(p.gross_amount, cur)}</Row>
              <Row label="Discount">{discount > 0 ? `−${formatMoney(discount, cur)}` : formatMoney(0, cur)}</Row>
              <Row label="Net amount">{formatMoney(p.net_amount, cur)}</Row>
              {p.amount_source === "price" && (
                <p className="text-[#A1A1A1] text-[11px] -mt-1 text-right">Calculated from the price and code used at checkout</p>
              )}
              <Row label="Currency">{cur ? String(cur).toUpperCase() : null}</Row>
              <Row label="Coupon">{p.coupon_code}</Row>
            </Section>

            <Section title="Attribution">
              <Row label="Source">
                <SourceBadge source={p.purchase_source} />
              </Row>
              <Row label="Trainer">{isTrainer ? p.trainer?.name : null}</Row>
              <Row label="Trainer email">{isTrainer ? p.trainer?.email : null}</Row>
              <Row label="Trainer ID">{isTrainer && p.trainer?.trainer_id ? <CopyableId value={p.trainer.trainer_id} /> : null}</Row>
              <Row label="Trainer code">{p.attributed_partner_code}</Row>
              <Row label="Referral code">{p.purchase_code ? <CopyableId value={p.purchase_code} /> : null}</Row>
              {p.linked_partner_code && (
                <Row label="Linked later in app">
                  {p.linked_trainer_name ? `${p.linked_trainer_name} (${p.linked_partner_code})` : p.linked_partner_code}
                  {p.linked_trainer_email && <div className="font-normal text-[#A1A1A1]">{p.linked_trainer_email}</div>}
                </Row>
              )}
            </Section>

            <Section title="Subscription">
              <Row label="Status">
                <StatusBadge status={p.subscription_status} />
              </Row>
              <Row label="Start date">{p.subscription_start ? formatDate(p.subscription_start) : null}</Row>
              <Row label="Renewal / end date">{p.subscription_end ? formatDate(p.subscription_end) : null}</Row>
            </Section>

            <Section title="Payment reference">
              <Row label="Checkout session">{p.stripe?.checkout_session_id ? <CopyableId value={p.stripe.checkout_session_id} /> : null}</Row>
              <Row label="Subscription">{p.stripe?.subscription_id ? <CopyableId value={p.stripe.subscription_id} /> : null}</Row>
              <Row label="Invoice">{p.stripe?.invoice_id ? <CopyableId value={p.stripe.invoice_id} /> : null}</Row>
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
