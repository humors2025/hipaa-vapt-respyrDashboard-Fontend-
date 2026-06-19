"use client";

import Image from "next/image";
import { useSelector } from "react-redux";
import { useState } from "react";
import InfoPopUp from "./pop-folder/info-popup";
import { zoneLabel } from "@/lib/utils";

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

// One paragraph of trainer/insight text.
function ExpandableText({ label, body }) {
  if (!body) return null;

  return (
    <div className="flex flex-col gap-1 items-start w-full">
      <p className="text-[#738298] text-[12px] font-normal leading-[130%]">
        <b className="font-semibold">{label}</b>
        {body}
      </p>
    </div>
  );
}

export default function FatUsePatternTrend() {
  const [showPopup, setShowPopup] = useState(false);
  const [activeTab, setActiveTab] = useState("meaning");

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
    Steady: "#FFBF2D",
    Optimal: "#3FAF58",
    Strong: "#3FAF58",
    Focus: "#E48326",
    Building: "#E48326",
  };

  const statusColor = statusColorMap[status] || "#3FAF58";

  // Scroll the TestAnalysis panel down to the bottom row (Progress / Trainer Note).
  // We scroll ONLY the inner scroll container (.scroll-target) instead of using
  // scrollIntoView, which would also nudge outer/ancestor scroll positions and
  // leave the panel unable to scroll all the way back to the top.
  const handleScrollToTrends = () => {
    const target = document.getElementById("test-analysis-bottom-row");
    if (!target) return;

    const container = target.closest(".scroll-target");
    if (!container) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const top =
      container.scrollTop +
      (target.getBoundingClientRect().top -
        container.getBoundingClientRect().top);

    container.scrollTo({ top, behavior: "smooth" });
  };

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

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleScrollToTrends}
            className="px-[18px] py-1.5 rounded-[24px] bg-[#308BF9] text-white text-[12px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer transition-colors hover:bg-[#2678e0]"
          >
            Trends
          </button>

          <div
            className="px-[25px] py-1.5 rounded-[24px]"
            style={{ backgroundColor: statusColor }}
          >
            <p className="text-white text-[12px] font-semibold leading-normal tracking-[-0.24px]">
              {zoneLabel(status)}
            </p>
          </div>
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

        <div className="flex items-center">
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

          <ExpandableText body={trainerState} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 items-start">
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={() => setActiveTab("meaning")}
            className={`text-[12px] font-semibold leading-normal tracking-[-0.24px] px-[18px] py-1.5 rounded-[24px] cursor-pointer transition-colors ${
              activeTab === "meaning"
                ? "bg-[#308BF9] text-white"
                : "bg-[#F2F5F9] text-[#738298]"
            }`}
          >
            Meaning
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("deepScience")}
            className={`text-[12px] font-semibold leading-normal tracking-[-0.24px] px-[18px] py-1.5 rounded-[24px] cursor-pointer transition-colors ${
              activeTab === "deepScience"
                ? "bg-[#308BF9] text-white"
                : "bg-[#F2F5F9] text-[#738298]"
            }`}
          >
            Deep Science
          </button>
        </div>

        {activeTab === "meaning" ? (
          <ExpandableText body={trainerMeaning} />
        ) : (
          <ExpandableText body={trainerDeepScience} />
        )}
      </div>
    </div>

    {showPopup && (
  <InfoPopUp onClose={() => setShowPopup(false)} />
)}
</>
  );
}