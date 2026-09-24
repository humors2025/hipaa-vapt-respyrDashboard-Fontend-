"use client";

import { humanizeStatus } from "./salesFormat";

const SOURCE_TABS = [
  { value: "all", label: "All" },
  { value: "website", label: "Website" },
  { value: "trainer_code", label: "Trainer Code" },
];

const selectClass =
  "w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-3 pr-8 py-2 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors cursor-pointer appearance-none";

function StatusSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 min-w-[150px] flex-1 sm:flex-none">
      <span className="text-[#535359] text-[11px] font-semibold">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-label={label}>
          <option value="all">All</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {humanizeStatus(o)}
            </option>
          ))}
        </select>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <path d="m6 9 6 6 6-6" stroke="#A1A1A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}

export default function PurchaseFilters({
  source,
  onSourceChange,
  search,
  onSearchChange,
  searchMinLength,
  subscriptionStatus,
  onSubscriptionStatusChange,
  paymentStatus,
  onPaymentStatusChange,
  subscriptionStatusOptions,
  paymentStatusOptions,
}) {
  const trimmed = search.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < searchMinLength;

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Purchase source" className="flex flex-wrap gap-2">
        {SOURCE_TABS.map((t) => {
          const active = source === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSourceChange(t.value)}
              className={`rounded-[10px] px-3.5 py-2 text-[12px] font-semibold transition-colors cursor-pointer ${
                active ? "bg-[#308BF9] text-white" : "bg-[#F5F7FA] text-[#535359] hover:bg-[#EEF4FE]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 w-full md:w-auto md:flex-1 md:max-w-[420px]">
          <span className="text-[#535359] text-[11px] font-semibold">Search</span>
          <div className="relative">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search customer, email, referral code or trainer code"
              aria-label="Search purchases"
              className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] transition-colors"
            />
          </div>
        </label>
        <StatusSelect
          label="Subscription status"
          value={subscriptionStatus}
          onChange={onSubscriptionStatusChange}
          options={subscriptionStatusOptions}
        />
        <StatusSelect label="Payment status" value={paymentStatus} onChange={onPaymentStatusChange} options={paymentStatusOptions} />
      </div>
      {tooShort && <p className="text-[#A1A1A1] text-[11px] -mt-1">Type at least {searchMinLength} characters to search.</p>}
    </div>
  );
}
