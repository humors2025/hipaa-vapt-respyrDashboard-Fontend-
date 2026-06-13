"use client";

import { useSelector } from "react-redux";
import SignalDetailCard from "./SignalDetailCard";

// Per-trend deep-dive popup. Shows ONE sub-score breakdown for the trend the
// user clicked into. The `type` prop maps to a signal name we look up in
// metabolism_signals_by_marker. Used by:
//   - Fuel & Energy Trends:        type="fuel"     | type="energy"
//   - Metabolic Recovery Trends:   type="metabolic"| type="recovery"
//   - Digestive Balance Trends:    type="nutrient" | type="digestive"

const TYPES = {
  fuel:      { signalName: "Fuel Utilization",    title: "Fuel Utilization breakdown",    subtitle: "Acetone — fuel & energy",      limiterBadge: false },
  energy:    { signalName: "Energy Source",        title: "Energy Source breakdown",       subtitle: "Acetone — fuel & energy",      limiterBadge: false },
  metabolic: { signalName: "Metabolic Load",       title: "Metabolic Load breakdown",      subtitle: "Ethanol — metabolic recovery", limiterBadge: false },
  recovery:  { signalName: "Recovery Activity",    title: "Recovery Activity breakdown",   subtitle: "Ethanol — metabolic recovery", limiterBadge: false },
  nutrient:  { signalName: "Nutrient Utilization", title: "Nutrient Utilization breakdown",subtitle: "Hydrogen — digestive balance", limiterBadge: true  },
  digestive: { signalName: "Digestive Activity",   title: "Digestive Activity breakdown",  subtitle: "Hydrogen — digestive balance", limiterBadge: true  },
};

// Fallback source: map each signal name to its raw_json.Metabolism_Score_Analysis key.
const SIGNAL_TO_TREND_KEY = {
  "Fuel Utilization":     "Fuel_Utilization_Trend",
  "Energy Source":        "Energy_Source_Trend",
  "Metabolic Load":       "Metabolic_Load_Trend",
  "Recovery Activity":    "Recovery_Activity_Trend",
  "Nutrient Utilization": "Nutrient_Utilization_Trend",
  "Digestive Activity":   "Digestive_Activity_Trend",
};

const ZONE_TO_TIER = {
  optimal: "best",
  strong: "best",
  moderate: "mid",
  steady: "mid",
  focus: "limiter",
  building: "limiter",
  attention: "limiter",
  weak: "limiter",
};

export default function SomeInfoPopup({ onClose, type }) {
  const clientIndividualProfile = useSelector(
    (state) => state.clientIndividualProfile.data
  );

  const meta = TYPES[type];

  // Look up the signal by NAME, not by index. Backend response may put the
  // grouped form (metabolism_signals_by_marker) under partial / missing data,
  // so we also fall back to the flat metabolism_signals list. Whichever
  // source has the named signal wins.
  const findSignal = (signalName) => {
    const why =
      clientIndividualProfile?.data?.raw_json?.trainer_direction_elite
        ?.why_todays_plan;

    if (why) {
      const grouped = why.metabolism_signals_by_marker || {};
      for (const marker of Object.keys(grouped)) {
        const hit = grouped[marker]?.find((s) => s?.signal === signalName);
        if (hit) return hit;
      }

      const flat = why.metabolism_signals;
      if (Array.isArray(flat)) {
        const hit = flat.find((s) => s?.signal === signalName);
        if (hit) return hit;
      }
    }

    // Fallback: this endpoint returns the sub-scores under Metabolism_Score_Analysis.
    const metab =
      clientIndividualProfile?.data?.raw_json?.Metabolism_Score_Analysis || {};
    const key = SIGNAL_TO_TREND_KEY[signalName];
    const t = key ? metab[key] : null;
    if (t) {
      const rawScore = t.score ?? t.value;
      const zone = t.zone || "";
      return {
        signal: signalName,
        zone_label: zone,
        tier: ZONE_TO_TIER[String(zone).toLowerCase()] || "",
        flag: "",
        score: rawScore == null ? null : Math.round(Number(rawScore)),
        threshold_rule: t.what_is_this_score || "",
        trainer_interpretation:
          t.interpretation || t.trainer_score_meaning || t.client_state || "",
      };
    }

    return null;
  };

  const signal = meta ? findSignal(meta.signalName) : null;

  return (
    <div
      className="relative bg-white rounded-[16px] shadow-xl max-w-[480px] w-[90vw] max-h-[90vh] overflow-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E1E6ED] flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[#252525] text-[16px] font-bold leading-tight tracking-[-0.3px]">
            {meta?.title || "Signal breakdown"}
          </h2>
          {meta?.subtitle && (
            <p className="text-[#535359] text-[11px] mt-0.5">{meta.subtitle}</p>
          )}
        </div>
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F5F7FA] hover:bg-[#E1E6ED] text-[#535359] text-[16px] font-semibold flex items-center justify-center"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="p-5">
        {!meta ? (
          <p className="text-[#A1A1A1] text-[12px]">Unknown signal type.</p>
        ) : !signal ? (
          <p className="text-[#A1A1A1] text-[12px]">
            No data available for this signal.
          </p>
        ) : (
          <SignalDetailCard
            signalName={signal.signal || meta.signalName}
            zoneLabel={signal.zone_label}
            tier={signal.tier}
            flag={signal.flag}
            score={signal.score}
            thresholdRule={signal.threshold_rule}
            interpretation={signal.trainer_interpretation}
            showLimiterBadge={meta.limiterBadge}
          />
        )}
      </div>
    </div>
  );
}
