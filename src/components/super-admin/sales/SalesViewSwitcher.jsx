"use client";

import { useEffect, useRef, useState } from "react";

const DOT_COLORS = ["#308BF9", "#3FAF58", "#F59E0B", "#7C3AED"];

function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A1A1A1"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// "Overview" + one entry per Trainer Admin, same pattern as TA Analytics.
// value: null for Overview, otherwise the TA's user_id.
export default function SalesViewSwitcher({ trainerAdmins, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = trainerAdmins.find((t) => t.user_id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (v) => {
    onChange(v);
    setOpen(false);
  };

  const item = (active) =>
    `flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[10px] text-[13px] text-left transition-colors cursor-pointer ${
      active ? "bg-[#EEF4FE] text-[#308BF9] font-semibold" : "text-[#535359] hover:bg-[#F5F7FA]"
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-[10px] bg-white border border-[#E1E6ED] px-3 py-1.5 text-[13px] font-semibold text-[#252525] hover:border-[#308BF9] transition-colors cursor-pointer"
      >
        <span className="text-[#A1A1A1] font-medium">View:</span>
        {current ? current.name : "Overview"}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-40 min-w-[240px] bg-white rounded-[12px] border border-[#E1E6ED] shadow-lg p-1.5"
        >
          <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#A1A1A1]">View</div>
          <button type="button" role="option" aria-selected={!value} onClick={() => choose(null)} className={item(!value)}>
            <span
              className={`flex items-center justify-center w-[26px] h-[26px] rounded-[8px] ${!value ? "bg-[#308BF9]/10" : "bg-[#F5F7FA]"}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={!value ? "#308BF9" : "#A1A1A1"} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </span>
            Overview
          </button>

          {trainerAdmins.length > 0 && (
            <>
              <div className="h-px bg-[#E1E6ED] mx-2.5 my-1.5" />
              <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#A1A1A1]">Trainer Admins</div>
            </>
          )}
          {trainerAdmins.map((t, i) => {
            const active = value === t.user_id;
            return (
              <button key={t.user_id} type="button" role="option" aria-selected={active} onClick={() => choose(t.user_id)} className={item(active)}>
                <span
                  className={`flex items-center justify-center shrink-0 w-[26px] h-[26px] rounded-[8px] text-[11px] font-bold ${
                    active ? "bg-gradient-to-br from-[#308BF9] to-[#252525] text-white" : "bg-[#F5F7FA] text-[#535359]"
                  }`}
                >
                  {(t.name || "?")[0]}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{t.name}</span>
                  <span className="block truncate text-[11px] font-normal text-[#A1A1A1]">{t.user_id}</span>
                </span>
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
