"use client";

// "Why Today's Plan" tab — narrative justification for today's session.
// Reuses the SignalDetailCard built for the Fat-use Pattern Trend deep-dive
// (PR #7) — same card, different framing.

import SignalDetailCard from "@/components/pop-folder/SignalDetailCard";

const MARKERS = [
  { key: "acetone",  title: "Acetone",  subtitle: "Fuel & Energy" },
  { key: "ethanol",  title: "Ethanol",  subtitle: "Metabolic Recovery" },
  { key: "hydrogen", title: "Hydrogen", subtitle: "Digestive Balance" },
];

const LIMITER_BADGE_SIGNALS = new Set(["Nutrient Utilization", "Digestive Activity"]);

// Defensive grouping — same pattern as the popup. Prefer the engine's
// pre-grouped object; fall back to filtering the flat list by marker_source.
function resolveSignalsByMarker(flat, grouped) {
  const fromGrouped = grouped || {};
  const fromFlat = Array.isArray(flat) ? flat : [];

  return MARKERS.reduce((acc, { key }) => {
    const arr = Array.isArray(fromGrouped[key]) ? fromGrouped[key] : [];
    acc[key] = arr.length > 0 ? arr : fromFlat.filter((s) => s?.marker_source === key);
    return acc;
  }, {});
}

export default function WhyTodaysPlan({ data }) {
  const why = data?.why_todays_plan || {};
  const summaryLines = Array.isArray(why.summary_lines) ? why.summary_lines : [];
  const byMarker = resolveSignalsByMarker(why.metabolism_signals, why.metabolism_signals_by_marker);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <section className="bg-[#308BF9] rounded-[10px] p-5 text-white">
        {summaryLines.length === 0 ? (
          <div className="text-[12px] italic opacity-80">No summary available.</div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px] leading-[1.5]">
            {summaryLines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex-shrink-0 font-bold opacity-80">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3 marker columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MARKERS.map(({ key, title, subtitle }) => {
          const signals = byMarker[key] || [];
          return (
            <section
              key={key}
              className="bg-white rounded-[10px] border border-[#E1E6ED] p-5 flex flex-col gap-4"
            >
              <header>
                <div className="text-[#252525] text-[14px] font-bold tracking-[-0.02em]">{title}</div>
                <div className="text-[#535359] text-[11px] mt-0.5">{subtitle}</div>
              </header>
              <div className="flex flex-col gap-3">
                {signals.length === 0 ? (
                  <div className="rounded-[8px] border border-dashed border-[#E1E6ED] p-4 text-[#A1A1A1] text-[11px] text-center">
                    No {title.toLowerCase()} signals available.
                  </div>
                ) : (
                  signals.map((sig, idx) => (
                    <SignalDetailCard
                      key={`${key}-${sig.signal || idx}`}
                      signalName={sig.signal}
                      zoneLabel={sig.zone_label}
                      tier={sig.tier}
                      flag={sig.flag}
                      score={sig.score}
                      thresholdRule={sig.threshold_rule}
                      interpretation={sig.trainer_interpretation}
                      showLimiterBadge={LIMITER_BADGE_SIGNALS.has(sig.signal)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
