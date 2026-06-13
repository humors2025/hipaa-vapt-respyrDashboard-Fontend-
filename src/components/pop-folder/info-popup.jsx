"use client";

import { useSelector } from "react-redux";
import SignalDetailCard from "./SignalDetailCard";

// Deep-dive popup for Fat-use Pattern Trend. Shows ALL 6 sub-scores grouped
// by their breath marker (acetone / ethanol / hydrogen).
//
// IMPORTANT: backend response shape varies. Sometimes both `metabolism_signals`
// (flat) AND `metabolism_signals_by_marker` (grouped) are present; sometimes
// only the flat list is populated; sometimes the grouped form is partial
// (e.g., ethanol populated, acetone/hydrogen empty). To be robust:
//   1. Read both fields.
//   2. If a marker's grouped array is empty/missing, rebuild it from the flat
//      list filtered by signal.marker_source.
//   3. Iterate the resulting arrays directly — don't assume a fixed signal at
//      a fixed index. Whatever signals the engine returns gets rendered.
//
// Reference: trainer_direction_2tabs.html (engineer's canonical UI) does the
// same thing — it iterates byMrk.acetone, .ethanol, .hydrogen as arrays.

const MARKERS = [
  { key: "acetone",  title: "Acetone",  subtitle: "Fuel & Energy" },
  { key: "ethanol",  title: "Ethanol",  subtitle: "Metabolic Recovery" },
  { key: "hydrogen", title: "Hydrogen", subtitle: "Digestive Balance" },
];

// Mark these signals' UI as a "Limiter" badge (instead of a numeric score)
// when they're flagged as a limiter — matches the original popup behaviour
// only Hydrogen-derived signals were treated as limiter-style cards.
const LIMITER_BADGE_SIGNALS = new Set([
  "Nutrient Utilization",
  "Digestive Activity",
]);

// Only these signals should be rendered in the popup.
const VISIBLE_SIGNALS = new Set([
  "Digestive Activity",
  "Fuel Utilization",
  "Metabolic Load",
]);

// Resolve a marker-grouped view of the signals from the response.
// Prefers the engine's pre-grouped object; falls back to filtering the flat
// list. Always returns { acetone: [], ethanol: [], hydrogen: [] }.
function resolveSignalsByMarker(metabolismSignals, signalsByMarker) {
  const fromGrouped = signalsByMarker || {};
  const fromFlat = Array.isArray(metabolismSignals) ? metabolismSignals : [];

  return MARKERS.reduce((acc, { key }) => {
    const grouped = Array.isArray(fromGrouped[key]) ? fromGrouped[key] : [];
    const source = grouped.length > 0
      ? grouped
      : fromFlat.filter((s) => s?.marker_source === key);
    acc[key] = source.filter((s) => VISIBLE_SIGNALS.has(s?.signal));
    return acc;
  }, {});
}

// Fallback source: when trainer_direction_elite.why_todays_plan is "NA"/absent,
// this endpoint still returns the sub-scores under raw_json.Metabolism_Score_Analysis.
// Map each trend to its breath marker and reshape into signal cards.
const TREND_TO_MARKER = {
  Fuel_Utilization_Trend:     { marker: "acetone",  signal: "Fuel Utilization" },
  Energy_Source_Trend:        { marker: "acetone",  signal: "Energy Source" },
  Metabolic_Load_Trend:       { marker: "ethanol",  signal: "Metabolic Load" },
  Recovery_Activity_Trend:    { marker: "ethanol",  signal: "Recovery Activity" },
  Digestive_Activity_Trend:   { marker: "hydrogen", signal: "Digestive Activity" },
  Nutrient_Utilization_Trend: { marker: "hydrogen", signal: "Nutrient Utilization" },
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

function buildSignalsByMarkerFromMetabolism(metabolismScores) {
  const grouped = { acetone: [], ethanol: [], hydrogen: [] };
  if (!metabolismScores || typeof metabolismScores !== "object") return grouped;

  Object.entries(TREND_TO_MARKER).forEach(([key, { marker, signal }]) => {
    const t = metabolismScores[key];
    if (!t || typeof t !== "object") return;

    const rawScore = t.score ?? t.value;
    const zone = t.zone || "";

    grouped[marker].push({
      signal,
      marker_source: marker,
      zone_label: zone,
      tier: ZONE_TO_TIER[String(zone).toLowerCase()] || "",
      flag: "",
      score: rawScore == null ? null : Math.round(Number(rawScore)),
      threshold_rule: t.what_is_this_score || "",
      trainer_interpretation:
        t.interpretation || t.trainer_score_meaning || t.client_state || "",
    });
  });

  return grouped;
}

export default function InfoPopUp({ onClose }) {
  const clientIndividualProfile = useSelector(
    (state) => state.clientIndividualProfile.data
  );

  const rawJson = clientIndividualProfile?.data?.raw_json || {};

  // Title follows whichever composite trend the response carries.
  const trendLabel = rawJson?.Muscle_Gain_Trend
    ? "Muscle Gain Trend"
    : "Fat-use Pattern Trend";

  const why =
    rawJson?.trainer_direction_elite?.why_todays_plan || {};

  const fromWhy = resolveSignalsByMarker(
    why.metabolism_signals,
    why.metabolism_signals_by_marker
  );

  // If the elite/why_todays_plan source has no signals, fall back to the
  // Metabolism_Score_Analysis sub-scores this endpoint always returns.
  const hasWhySignals = MARKERS.some(
    ({ key }) => (fromWhy[key] || []).length > 0
  );

  const byMarker = hasWhySignals
    ? fromWhy
    : resolveSignalsByMarker(
        null,
        buildSignalsByMarkerFromMetabolism(
          clientIndividualProfile?.data?.raw_json?.Metabolism_Score_Analysis
        )
      );

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="relative bg-white rounded-[16px] shadow-xl max-w-[980px] w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E1E6ED] px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
              {trendLabel} — breakdown
            </h2>
            <p className="text-[#535359] text-[12px] mt-1">
              All sub-scores across the three breath markers powering this trend.
            </p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {MARKERS.map(({ key, title, subtitle }) => {
            const signals = byMarker[key] || [];
            return (
              <div
                key={key}
                className="bg-[#F5F7FA] rounded-[12px] border border-[#E1E6ED] p-4 flex flex-col gap-4"
              >
                <div>
                  <div className="text-[#252525] font-semibold text-[14px] tracking-[-0.02em]">
                    {title}
                  </div>
                  <div className="text-[#535359] text-[11px] mt-0.5">
                    {subtitle}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {signals.length === 0 ? (
                    <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-4 text-[#A1A1A1] text-[11px] text-center">
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
