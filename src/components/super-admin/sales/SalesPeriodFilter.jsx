"use client";

import { PERIODS } from "./salesFormat";

function Arrow({ dir }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Week | Month | Year segmented control with ← range → navigation underneath.
export default function SalesPeriodFilter({ period, onPeriodChange, rangeLabel, onPrev, onNext, nextDisabled }) {
  const navBtn =
    "flex items-center justify-center w-7 h-7 rounded-[8px] text-[#535359] hover:bg-white hover:text-[#308BF9] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#535359]";

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2">
      <div role="radiogroup" aria-label="Sales period" className="inline-flex self-start sm:self-auto rounded-[12px] bg-white border border-[#E1E6ED] p-1">
        {PERIODS.map((p) => {
          const active = period === p.value;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPeriodChange(p.value)}
              className={`px-4 py-1.5 rounded-[9px] text-[12px] font-semibold transition-colors cursor-pointer ${
                active ? "bg-[#308BF9] text-white" : "text-[#535359] hover:bg-[#F5F7FA]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1 self-start sm:self-auto">
        <button type="button" onClick={onPrev} aria-label="Previous period" className={navBtn}>
          <Arrow dir="left" />
        </button>
        <span className="text-[#252525] text-[12px] font-semibold tabular-nums min-w-[150px] text-center" aria-live="polite">
          {rangeLabel}
        </span>
        <button type="button" onClick={onNext} disabled={nextDisabled} aria-label="Next period" className={navBtn}>
          <Arrow dir="right" />
        </button>
      </div>
    </div>
  );
}
