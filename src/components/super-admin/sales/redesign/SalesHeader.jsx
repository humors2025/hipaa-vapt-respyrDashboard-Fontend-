"use client";

import { useEffect, useRef, useState } from "react";
import { PERIODS } from "../salesFormat";
import { C } from "./ui";

// "View:" dropdown — Overview (whole network) or one Trainer Admin's network.
// value: null for Overview, otherwise the TA's user_id.
function ViewMenu({ trainerAdmins, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = trainerAdmins.find((t) => t.user_id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (v) => {
    onChange(v);
    setOpen(false);
  };

  const item = (active) =>
    `w-full text-left px-3.5 py-[9px] rounded-[8px] text-[13px] tracking-[-0.26px] cursor-pointer transition-colors ${
      active ? "bg-[#E9F3FF] text-[#308BF9] font-semibold" : "text-[#535359] hover:bg-[#F5F7FA]"
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3.5 py-[5px] rounded-[8px] border border-[#E1E6ED] bg-white text-[13px] tracking-[-0.26px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-[#308BF9] transition-colors"
      >
        <span className="text-[#738298]">View:</span>
        <span className="font-semibold text-[#252525] max-w-[220px] truncate">{current ? current.name : "Overview"}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.tm}
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
          className={`ml-0.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[240px] max-h-[360px] overflow-y-auto bg-white rounded-[12px] border border-[#E1E6ED] shadow-[0_12px_32px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] p-[5px]"
        >
          <button type="button" role="option" aria-selected={!value} onClick={() => choose(null)} className={item(!value)}>
            Overview
          </button>
          {trainerAdmins.length > 0 && (
            <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#A1A1A1]">Trainer Admins</div>
          )}
          {trainerAdmins.map((t) => (
            <button
              key={t.user_id}
              type="button"
              role="option"
              aria-selected={value === t.user_id}
              onClick={() => choose(t.user_id)}
              className={item(value === t.user_id)}
            >
              <span className="block truncate">{t.name}</span>
              <span className="block truncate text-[11px] font-normal text-[#A1A1A1]">{t.user_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavButton({ dir, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? "Previous period" : "Next period"}
      className="w-7 h-7 flex items-center justify-center rounded-[8px] border border-[#E1E6ED] bg-white text-[#738298] hover:bg-[#F5F7FA] hover:text-[#252525] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d={dir < 0 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}

export default function SalesHeader({
  trainerAdmins,
  trainerAdmin,
  onTrainerAdminChange,
  selectedTa,
  mock,
  period,
  onPeriodChange,
  rangeLabel,
  onPrev,
  onNext,
  nextDisabled,
}) {
  return (
    <div className="flex items-start justify-between gap-6 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-bold text-[#252525] tracking-[-0.44px]">Sales Analytics</h1>
          <ViewMenu trainerAdmins={trainerAdmins} value={trainerAdmin} onChange={onTrainerAdminChange} />
          {mock && (
            <span className="rounded-full bg-[#FFF4E0] text-[#A66B00] text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
              Mock data
            </span>
          )}
        </div>
        <p className="text-[13px] text-[#738298] tracking-[-0.26px] mt-1.5 leading-normal max-w-[620px]">
          {selectedTa ? (
            <>
              Sales from <span className="font-semibold text-[#252525]">{selectedTa.name}</span>&apos;s network: trainers and facilities they
              onboarded, and website buyers who later linked one of those trainers.
            </>
          ) : (
            "Revenue, purchases, and subscription activity across all channels."
          )}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2.5 shrink-0">
        <div
          className="flex items-center bg-white rounded-[10px] border border-[#E1E6ED] p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          role="tablist"
          aria-label="Period"
        >
          {PERIODS.map((p) => {
            const active = period === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPeriodChange(p.value)}
                className={`px-5 py-1.5 text-[13px] tracking-[-0.26px] rounded-[7px] transition-colors cursor-pointer ${
                  active ? "bg-[#308BF9] text-white font-semibold" : "text-[#535359] hover:text-[#252525]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <NavButton dir={-1} onClick={onPrev} />
          <span className="text-[13px] font-medium text-[#535359] tracking-[-0.26px] whitespace-nowrap px-1">{rangeLabel}</span>
          <NavButton dir={1} onClick={onNext} disabled={nextDisabled} />
        </div>
      </div>
    </div>
  );
}
