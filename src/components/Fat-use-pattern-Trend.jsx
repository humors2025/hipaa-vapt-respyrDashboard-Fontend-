"use client";

import Image from "next/image";
import { useSelector } from "react-redux";
import { useState } from "react";
import InfoPopUp from "./pop-folder/info-popup";

function SegmentedProgressBar({
  value = 85,
  totalSegments = 55,
  labels = [0, 50, 70, 100],
  segmentWeights = [80, 82, 172],
  filledColor = "#3FAF58",
  emptyColor = "#E1E6ED",
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  const totalWeight = segmentWeights.reduce((a, b) => a + b, 0);

  const labelLeftPct = [0];
  for (let i = 0; i < segmentWeights.length; i++) {
    labelLeftPct.push(labelLeftPct[i] + (segmentWeights[i] / totalWeight) * 100);
  }

  const zoneSegments = (() => {
    const raw = segmentWeights.map((w) => (w / totalWeight) * totalSegments);
    const base = raw.map((x) => Math.floor(x));
    let used = base.reduce((a, b) => a + b, 0);

    const fracOrder = raw
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => b.frac - a.frac);

    let idx = 0;
    while (used < totalSegments) {
      base[fracOrder[idx % fracOrder.length].i] += 1;
      used += 1;
      idx += 1;
    }
    return base;
  })();

  const ranges = [
    { from: 0, to: 50, weight: segmentWeights[0], segs: zoneSegments[0] },
    { from: 50, to: 70, weight: segmentWeights[1], segs: zoneSegments[1] },
    { from: 70, to: 100, weight: segmentWeights[2], segs: zoneSegments[2] },
  ];

  const filledByRange = ranges.map((r) => {
    const overlap = Math.max(0, Math.min(safeValue, r.to) - r.from);
    const span = r.to - r.from;
    return Math.round((overlap / span) * r.segs);
  });

  return (
    <div className="w-full">
      <div className="relative h-4 mb-[6px] w-full">
        {labels.map((lab, index) => {
          let alignment = "-translate-x-1/2";
          if (index === 0) alignment = "translate-x-0";
          if (index === labels.length - 1) alignment = "-translate-x-full";

          return (
            <span
              key={lab}
              className={`absolute text-[8px] font-normal text-[#535359] leading-[110%] tracking-[-0.16px] ${alignment}`}
              style={{ left: `${labelLeftPct[index]}%` }}
            >
              {lab}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-[3px] w-full">
        {ranges.map((r, ri) => (
          <div
            key={ri}
            className="flex gap-[3px] items-center"
            style={{ width: `${(r.weight / totalWeight) * 100}%` }}
          >
            {Array.from({ length: r.segs }).map((_, si) => {
              const isFilled = si < filledByRange[ri];
              return (
                <div
                  key={si}
                  className="flex-1 h-[40px]"
                  style={{
                    backgroundColor: isFilled ? filledColor : emptyColor,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// One paragraph with its own independent "View all / View less" toggle.
function ExpandableText({ label, body }) {
  const [expanded, setExpanded] = useState(false);

  if (!body) return null;

  return (
    <div className="flex flex-col gap-1 items-start w-full">
      <p
        className={`text-[#738298] text-[12px] font-normal leading-[130%] ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        <b className="font-semibold">{label}</b>
        {body}
      </p>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[-0.24px] underline cursor-pointer"
      >
        {expanded ? "View less" : "View all"}
      </button>
    </div>
  );
}

export default function FatUsePatternTrend() {
  const [showPopup, setShowPopup] = useState(false);

  const clientIndividualProfile = useSelector(
    (state) => state.clientIndividualProfile.data
  );

  const rawJson = clientIndividualProfile?.data?.raw_json || {};

  const trendData =
    rawJson?.Muscle_Gain_Trend ||
    rawJson?.Fat_Use_Pattern_trend ||
    {};


  const value = trendData?.value ?? trendData?.score ?? "NA";
  const status =
    trendData?.zone && trendData?.zone !== ""
      ? trendData.zone
      : "NA";


  // Trainer blocks — bind straight from the trend data
  const trainerState = trendData?.trainer_state || "";
  const trainerMeaning = trendData?.trainer_score_meaning || "";
  const trainerDeepScience = trendData?.trainer_score_deep_science || "";

  const title = rawJson?.Muscle_Gain_Trend
    ? "Muscle Gain Trend"
    : rawJson?.Fat_Use_Pattern_trend
    ? "Fat-use Pattern Trend"
    : "Trend";

  const statusColorMap = {
    Moderate: "#FFBF2D",
    Optimal: "#3FAF58",
    Focus: "#E48326",
  };

  const statusColor = statusColorMap[status] || "#3FAF58";

  return (
    <>
    <div className="w-full flex flex-col gap-[28px] border border-[#E1E6ED] px-5 pt-[18px] pb-5 rounded-[15px] bg-white">
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-[5px] items-center min-w-0">
          <p className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px] whitespace-nowrap">
            {title}
          </p>

          <Image
            src="/icons/hugeicons_information-circle1.svg"
            alt="info"
            width={20}
            height={20}
            onClick={() => setShowPopup(true)}
            className="cursor-pointer flex-shrink-0"
          />
        </div>

        <div
          className="flex-shrink-0 px-[25px] py-1.5 rounded-[24px]"
          style={{ backgroundColor: statusColor }}
        >
          <p className="text-white text-[12px] font-semibold leading-normal tracking-[-0.24px]">
            {status}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-[25px]">
        <SegmentedProgressBar
          value={value}
          totalSegments={55}
          labels={[0, 50, 70, 100]}
          segmentWeights={[80, 82, 172]}
          filledColor={statusColor}
        />

        <div className="flex items-baseline">
          <div className="flex items-baseline gap-[4px]">
            <p className="text-[#252525] text-[72px] font-normal leading-none tracking-[-1.44px]">
              {value !== "NA" && !isNaN(Number(value))
                ? Math.round(Number(value))
                : value}
            </p>

            <p className="text-[#252525] text-[20px] font-semibold leading-none tracking-[-0.4px] pr-[13px]">
              %
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 items-start">
        <ExpandableText body={trainerState} />

        <ExpandableText
          label="Meaning: "
          body={trainerMeaning}
        />

        <ExpandableText
          label="Deep Science: "
          body={trainerDeepScience}
        />
      </div>
    </div>

    {showPopup && (
  <InfoPopUp onClose={() => setShowPopup(false)} />
)}
</>
  );
}