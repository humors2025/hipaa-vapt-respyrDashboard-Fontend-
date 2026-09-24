"use client";

// Small presentational pieces shared by the Sales Analytics sections.

import { humanizeStatus } from "./salesFormat";

export function SalesCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`bg-white rounded-[15px] border border-[#E1E6ED] p-5 flex flex-col gap-4 min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            {title && <h2 className="text-[#252525] text-[14px] font-bold">{title}</h2>}
            {subtitle && <p className="text-[#A1A1A1] text-[11px] mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-[8px] bg-[#F0F3F7] ${className}`} />;
}

export function EmptyState({ message, className = "" }) {
  return (
    <div
      className={`rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center flex items-center justify-center ${className}`}
    >
      {message}
    </div>
  );
}

export function SectionError({ message, onRetry, className = "" }) {
  return (
    <div
      role="alert"
      className={`rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 flex items-center justify-between gap-3 flex-wrap ${className}`}
    >
      <span className="text-[#B91C1C] text-[12px]">{message || "Something went wrong."}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white border border-[#FCA5A5] text-[#B91C1C] text-[11px] font-semibold px-3 py-1 hover:bg-[#FEE2E2] transition-colors cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function UpdatingPill({ show }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF4FE] px-2.5 py-1 text-[10px] font-semibold text-[#308BF9]">
      <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="#CFE2FD" strokeWidth="4" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#308BF9" strokeWidth="4" strokeLinecap="round" />
      </svg>
      Updating
    </span>
  );
}

const SOURCE_BADGE = {
  website: { label: "Website", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  trainer_code: { label: "Trainer Code", cls: "bg-[#E9F7EC] text-[#2E8B45]" },
};

export function SourceBadge({ source }) {
  const c = SOURCE_BADGE[source];
  if (!c) return <span className="text-[#A1A1A1]">{source ? humanizeStatus(source) : "—"}</span>;
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${c.cls}`}>
      {c.label}
    </span>
  );
}

// Colours follow the paid-subscribers StatusBadge. Unknown backend values are
// shown humanised on a neutral badge rather than hidden.
const STATUS_BADGE = {
  active: "bg-[#E5F6EE] text-[#1F7A4A]",
  paid: "bg-[#E5F6EE] text-[#1F7A4A]",
  upcoming: "bg-[#EEF4FE] text-[#308BF9]",
  expired: "bg-[#F5F7FA] text-[#535359]",
  cancelled: "bg-[#FCEAEB] text-[#B5363A]",
  canceled: "bg-[#FCEAEB] text-[#B5363A]",
  failed: "bg-[#FCEAEB] text-[#B5363A]",
  refunded: "bg-[#FFF4E0] text-[#A66B00]",
  partially_refunded: "bg-[#FFF4E0] text-[#A66B00]",
  past_due: "bg-[#FFF4E0] text-[#A66B00]",
  unpaid: "bg-[#FCEAEB] text-[#B5363A]",
  trialing: "bg-[#EEF4FE] text-[#308BF9]",
};

export function StatusBadge({ status }) {
  if (!status) return <span className="text-[#A1A1A1]">—</span>;
  const cls = STATUS_BADGE[String(status).toLowerCase()] || "bg-[#F5F7FA] text-[#535359]";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${cls}`}>
      {humanizeStatus(status)}
    </span>
  );
}
