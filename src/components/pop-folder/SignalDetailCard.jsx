"use client";

// Reusable card that renders one sub-score breakdown (signal name, zone label,
// tier, threshold rule, score/limiter badge, trainer interpretation).
// Used by:
//   - info-popup.jsx (Fat-use Pattern Trend — shows all 6 sub-scores)
//   - some-info-popup.jsx (per-trend popups — shows one sub-score)

const COLOR = {
  green:  "#3FAF58",
  yellow: "#F8B10F",
  red:    "#DA5747",
};

// Map flag/tier → semantic color. Mirrors the engine's _classify_pattern:
//   Pattern A (higher_is_better): >=80 best / 70-79 mid / <70 limiter
//   Pattern B (lower_is_better):  <=20 best / 21-30 mid / >30 limiter
//
// Tier is the canonical 3-bucket classifier and is the safest input here.
// Flag is a legacy compat token (strong/ideal/moderate/low_limiter/high_limiter)
// and is checked only as a fallback when tier is missing or non-standard.
export function colorForSignal(flag, tier) {
  if (tier === "best")     return COLOR.green;
  if (tier === "mid")      return COLOR.yellow;
  if (tier === "limiter")  return COLOR.red;

  // Tier missing — fall back to flag.
  if (flag === "strong" || flag === "ideal")    return COLOR.green;
  if (flag === "moderate")                       return COLOR.yellow;
  if (flag === "low" || flag === "low_limiter" || flag === "high_limiter") return COLOR.red;

  // Unknown — render as neutral yellow so it visibly stands out for review.
  return COLOR.yellow;
}

const isLimiter = (flag, tier) =>
  flag === "high_limiter" || flag === "low_limiter" || tier === "limiter";

export default function SignalDetailCard({
  signalName,
  zoneLabel,
  tier,
  flag,
  score,
  thresholdRule,
  interpretation,
  showLimiterBadge = false, // when true, shows "Limiter" pill instead of score number
}) {
  const accent = colorForSignal(flag, tier);
  const showLimiter = showLimiterBadge && isLimiter(flag, tier);

  return (
    <div
      className="rounded-[10px] bg-white border-l-[3px] pl-4 pr-4 pt-3.5 pb-4"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[#252525] font-semibold text-[12px] leading-[100%] tracking-[-0.02em]">
            {signalName}
          </span>
          {zoneLabel && (
            <span className="text-[#535359] text-[10px] leading-[1.3] capitalize">
              {zoneLabel}
            </span>
          )}
          {tier && (
            <span className="text-[#A1A1A1] text-[10px] leading-[1.3] uppercase tracking-wide">
              tier · {String(tier).replace(/_/g, " ")}
            </span>
          )}
        </div>

        {showLimiter ? (
          <div className="flex-shrink-0 rounded-full bg-[#DA5747] px-2.5 py-0.5">
            <span className="text-white text-[10px] font-semibold leading-[1.1] tracking-[-0.02em]">
              Limiter
            </span>
          </div>
        ) : (
          <span
            className="flex-shrink-0 font-semibold text-[18px] leading-[1.1] tracking-[-0.02em]"
            style={{ color: accent }}
          >
            {score ?? "—"}
          </span>
        )}
      </div>

      {thresholdRule && (
        <p className="mt-3 text-[#A1A1A1] text-[10px] font-normal leading-[1.4]">
          {thresholdRule}
        </p>
      )}

      {interpretation && (
        <p className="mt-2 text-[#535359] text-[11px] font-normal leading-[1.5]">
          {interpretation}
        </p>
      )}
    </div>
  );
}
