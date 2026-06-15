"use client";

import Image from "next/image";
import { useState } from "react";
import SomeInfoPopup from "./pop-folder/some-info-popup";
import ExpandableText from "./ExpandableText";

// Score value + trainer-state line, with Meaning / Deep Science tabs underneath.
// Each instance owns its tab state, so the two cards switch independently.
function TrendInsightTabs({
  score,
  trainerState,
  trainerMeaning,
  trainerDeepScience,
}) {
  const [activeTab, setActiveTab] = useState("meaning");

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-[4px]">
          <p className="text-[#252525] text-[72px] font-normal leading-none tracking-[-1.44px]">
            {score}
          </p>

          <p className="text-[#252525] text-[20px] font-semibold leading-none tracking-[-0.4px] pr-[13px]">
            %
          </p>
        </div>

        <ExpandableText body={trainerState} />
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
    </>
  );
}

function SegmentedProgressBar({
  value = 85,
  totalSegments = 55,
  labels = [0, 50, 70, 100],
  segmentWeights = [80, 82, 172],
  filledColor = "#FFBF2D",
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

const getZoneColor = (zone) => {
  switch (zone?.toLowerCase()) {
    case "optimal":
    case "strong":
      return "#3FAF58";
    case "moderate":
    case "steady":
      return "#FFBF2D";
    case "focus":
    case "building":
      return "#E48326";
    default:
      return "#3FAF58";
  }
};

const getZoneDisplay = (zone) => {
  switch (zone?.toLowerCase()) {
    case "optimal":
    case "strong":
      return { text: "Strong", color: "#3FAF58" };
    case "moderate":
    case "steady":
      return { text: "Steady", color: "#FFBF2D" };
    case "focus":
    case "building":
      return { text: "Building", color: "#E48326" };
    default:
      return { text: zone || "Strong", color: "#3FAF58" };
  }
};

export default function DigestiveBalanceTrends({ data }) {
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState(null);

  const nutrientUtilization = data?.items?.find(
    (item) => item.title === "Nutrient Utilization Trend"
  );

  const digestiveActivity = data?.items?.find(
    (item) => item.title === "Digestive Activity Trend"
  );
  

  const nutrientScore = nutrientUtilization ? Math.round(nutrientUtilization.score) : "NA";
  const digestiveScore = digestiveActivity ? Math.round(digestiveActivity.score) : "NA";

  const nutrientZone = nutrientUtilization?.zone || "Strong";
  const digestiveZone = digestiveActivity?.zone || "Strong";

  const nutrientZoneInfo = getZoneDisplay(nutrientZone);
  const digestiveZoneInfo = getZoneDisplay(digestiveZone);

  return (
    <>
      <div className="flex gap-[97px] ">
        {nutrientUtilization && (
        <div className="flex flex-col gap-[25px] w-full">
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-[5px] items-center">
              <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                {nutrientUtilization?.title || "Nutrient Utilization Trend"}
              </p>
              <Image
                src="/icons/hugeicons_information-circle1.svg"
                alt="info"
                width={20}
                height={20}
               onClick={() => {
    setPopupType("nutrient");
    setShowPopup(true);
  }}
                className="cursor-pointer"
              />
            </div>

            <div
              className="w-[100px] flex items-center justify-center px-[25px] py-1.5 rounded-[24px]"
              style={{ backgroundColor: nutrientZoneInfo.color }}
            >
              <p className="text-[#FFFFFF] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
                {nutrientZoneInfo.text}
              </p>
            </div>
          </div>

          <SegmentedProgressBar
            value={nutrientScore}
            totalSegments={55}
            labels={[0, 50, 70, 100]}
            segmentWeights={[80, 82, 172]}
            filledColor={getZoneColor(nutrientZone)}
          />

          <TrendInsightTabs
            score={nutrientScore}
            trainerState={nutrientUtilization?.trainer_state}
            trainerMeaning={nutrientUtilization?.trainer_score_meaning}
            trainerDeepScience={nutrientUtilization?.trainer_score_deep_science}
          />
        </div>
        )}

        <div className="flex flex-col gap-[25px] w-full">
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-[5px] items-center">
              <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                {digestiveActivity?.title || "Digestive Activity Trend"}
              </p>
              <Image
                src="/icons/hugeicons_information-circle1.svg"
                alt="info"
                width={20}
                height={20}
                onClick={() => {
                  setPopupType("digestive");
                  setShowPopup(true);
                }}
                className="cursor-pointer"
              />
            </div>

            <div
              className="w-[100px] flex items-center justify-center px-[25px] py-1.5 rounded-[24px]"
              style={{ backgroundColor: digestiveZoneInfo.color }}
            >
              <p className="text-[#FFFFFF] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
                {digestiveZoneInfo.text}
              </p>
            </div>
          </div>

          <SegmentedProgressBar
            value={digestiveScore}
            totalSegments={55}
            labels={[0, 50, 70, 100]}
            segmentWeights={[80, 82, 172]}
            filledColor={getZoneColor(digestiveZone)}
          />

          <TrendInsightTabs
            score={digestiveScore}
            trainerState={digestiveActivity?.trainer_state}
            trainerMeaning={digestiveActivity?.trainer_score_meaning}
            trainerDeepScience={digestiveActivity?.trainer_score_deep_science}
          />
        </div>
      </div>

      {showPopup && (
  <div
    className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
    onClick={() => setShowPopup(false)}
  >
    <SomeInfoPopup 
     type={popupType} 
    onClose={() => setShowPopup(false)} />
  </div>
)}
    </>
  );
}