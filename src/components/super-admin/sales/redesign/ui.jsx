"use client";

// Shared look for the redesigned Sales Analytics page (Nov 2026 design zip):
// white 15px cards on the light page, Poppins sizes, blue / green / red accents.

import { percentChange } from "../salesFormat";

export const C = {
  dark: "#252525",
  blue: "#308BF9",
  blueLight: "#E9F3FF",
  green: "#3FAF58",
  greenLight: "#EAFFEF",
  red: "#E74C3C",
  orange: "#E48326",
  tp: "#252525",
  ts: "#535359",
  tm: "#738298",
  td: "#A1A1A1",
  border: "#E1E6ED",
  surface: "#F5F7FA",
};

export const CARD_SHADOW = "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]";
export const BLUE_GRADIENT = "bg-[linear-gradient(135deg,#4da3ff_0%,#308bf9_40%,#1a6fe0_100%)]";

// White rounded panel used by every section.
export function Panel({ children, className = "" }) {
  return (
    <section className={`bg-white rounded-[15px] border border-[#E1E6ED] ${CARD_SHADOW} min-w-0 ${className}`}>{children}</section>
  );
}

// Big section title + grey description, optional controls on the right.
export function PanelHeader({ title, badge, subtitle, action, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold text-[#252525] tracking-[-0.36px]">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-[12px] text-[#738298] tracking-[-0.24px] mt-1 leading-relaxed max-w-[720px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Tag({ children, tone = "green" }) {
  const cls = tone === "green" ? "text-[#3FAF58] bg-[#EAFFEF]" : "text-[#308BF9] bg-[#E9F3FF]";
  return <span className={`text-[10px] font-semibold uppercase tracking-[0.5px] px-2.5 py-[3px] rounded-[4px] ${cls}`}>{children}</span>;
}

export function Bone({ className = "" }) {
  return <div className={`animate-pulse rounded-[8px] bg-[#EEF1F5] ${className}`} />;
}

export function Dot({ color, size = 8 }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, backgroundColor: color }} aria-hidden="true" />;
}

// "▲ +12.5% vs same days last month". delta = percentChange() result.
export function Delta({ current, previous, label, white = false }) {
  const d = percentChange(current, previous);
  if (!d) return null;
  const color = white
    ? d.direction === "up"
      ? "text-[#A8F0B8]"
      : d.direction === "down"
      ? "text-[#FFB4B4]"
      : "text-white/60"
    : d.direction === "up"
    ? "text-[#3FAF58]"
    : d.direction === "down"
    ? "text-[#E74C3C]"
    : "text-[#738298]";
  const arrow = d.direction === "up" ? "▲" : d.direction === "down" ? "▼" : "■";
  const text = d.text === "New" ? "New" : d.text;
  return (
    <div className={`flex items-center gap-1.5 text-[13px] tracking-[-0.26px] ${color}`}>
      <span className={d.direction === "flat" ? "text-[8px]" : "text-[10px]"} aria-hidden="true">
        {arrow}
      </span>
      <span>
        {text} {label}
      </span>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, label, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.tm} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
        autoComplete="off"
        className="w-full h-9 rounded-[8px] border border-[#E1E6ED] bg-[#F5F7FA] pl-[34px] pr-3 text-[12px] text-[#252525] tracking-[-0.24px] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
      />
    </div>
  );
}

// Segmented pill toggle (blue active pill on a light track).
export function Segmented({ options, value, onChange, label, size = "sm" }) {
  const pad = size === "md" ? "px-5 py-1.5 text-[13px]" : "px-3.5 py-1.5 text-[11px]";
  return (
    <div className="inline-flex flex-wrap bg-[#F5F7FA] rounded-[8px] p-[3px] gap-[2px]" role="tablist" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`${pad} rounded-[6px] font-medium tracking-[-0.22px] transition-colors cursor-pointer ${
              active ? "bg-[#308BF9] text-white" : "text-[#738298] hover:text-[#252525]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Page numbers with ellipses: 1 … 4 5 6 … 19
function pageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

// 1-based page. Hidden when everything fits on one page.
export function Pager({ page, pageSize, total, onChange, disabled, noun = "" }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const arrow = (dir) => {
    const off = dir < 0 ? page <= 1 : page >= totalPages;
    return (
      <button
        type="button"
        onClick={() => onChange(page + dir)}
        disabled={disabled || off}
        aria-label={dir < 0 ? "Previous page" : "Next page"}
        className="w-7 h-7 rounded-[6px] border border-[#E1E6ED] bg-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.ts} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d={dir < 0 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
        </svg>
      </button>
    );
  };
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-[#E1E6ED]">
      <span className="text-[11px] text-[#738298] tracking-[-0.22px]">
        Showing {from}–{to} of {total.toLocaleString("en-US")} {noun}
      </span>
      <nav className="flex items-center gap-1 flex-wrap" aria-label="Pages">
        {arrow(-1)}
        {pageItems(page, totalPages).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="px-1 text-[11px] text-[#A1A1A1]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              disabled={disabled}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-7 h-7 px-1.5 rounded-[6px] text-[11px] tracking-[-0.22px] cursor-pointer transition-colors ${
                p === page ? "bg-[#252525] text-white font-semibold" : "text-[#738298] hover:bg-[#F5F7FA]"
              }`}
            >
              {p}
            </button>
          )
        )}
        {arrow(1)}
      </nav>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-[#B91C1C] text-[12px]">{message || "Something went wrong."}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white border border-[#FCA5A5] text-[#B91C1C] text-[11px] font-semibold px-3 py-1 hover:bg-[#FEE2E2] cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint }) {
  return (
    <div className="py-12 px-5 text-center">
      <div className="text-[13px] font-medium text-[#738298] tracking-[-0.26px]">{title}</div>
      {hint && <div className="text-[11px] text-[#A1A1A1] mt-1 tracking-[-0.22px]">{hint}</div>}
    </div>
  );
}

export function UpdatingDot({ show }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F3FF] px-2.5 py-1 text-[10px] font-semibold text-[#308BF9]">
      <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="#CFE2FD" strokeWidth="4" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#308BF9" strokeWidth="4" strokeLinecap="round" />
      </svg>
      Updating
    </span>
  );
}

// Small grey code chip (trainer / referral codes).
export function CodeChip({ children }) {
  if (!children) return <span className="text-[#A1A1A1]">—</span>;
  return (
    <span className="inline-block text-[10px] font-medium text-[#535359] bg-[#F5F7FA] border border-[#E1E6ED] px-2 py-[3px] rounded-[4px] tracking-[0.3px] whitespace-nowrap">
      {children}
    </span>
  );
}

export function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || "")
    .join("")
    .toUpperCase();
}
