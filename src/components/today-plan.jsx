"use client";
import { useSelector } from "react-redux";
import {
  selectTrainerDirectionData,
  selectTrainerDirectionLoading,
} from "../store/trainerDirectionSlice";

export default function TodayPlan() {
  const trainerData = useSelector(selectTrainerDirectionData);
  const loading = useSelector(selectTrainerDirectionLoading);

  const whyTodaysPlan = trainerData?.trainer_direction_elite?.why_todays_plan;
  const summaryLines = whyTodaysPlan?.summary_lines || [];
  const signalsByMarker = whyTodaysPlan?.metabolism_signals_by_marker || {};


  const parseLine0 = (line = "") => {
    // "fat-loss mode — Moderate day, Controlled Fat-Loss Training."
    const [modePart, restPart] = line.split("—").map((s) => s?.trim() || "");
    return { mode: modePart, rest: restPart ? `— ${restPart}` : "" };
  };

  const parseLine1 = (line = "") => {
    // "Primary limiter: Recovery Activity. Secondary: Metabolic Load."
    const primaryMatch = line.match(/Primary limiter:\s*([^.]+)\./i);
    const secondaryMatch = line.match(/Secondary:\s*([^.]+)\./i);
    return {
      primary: primaryMatch ? primaryMatch[1].trim() : "",
      secondary: secondaryMatch ? secondaryMatch[1].trim() : "",
    };
  };

  const parseLine2 = (line = "") => {
    // "Session cap: RPE 7, volume Moderate, length 40-60 minutes."
    const rpeMatch = line.match(/RPE\s*([\d\-]+)/i);
    const afterRpe = line.split(/RPE\s*[\d\-]+/i)[1] || "";
    return {
      rpe: rpeMatch ? rpeMatch[1] : "",
      tail: afterRpe.replace(/^,\s*/, "").replace(/\.$/, "").trim(),
    };
  };

  const parseLine3 = (line = "") => {
    // "Energy: -232 kcal vs TDEE (target 1700, BMR 1610)."
    const kcalMatch = line.match(/(-?\d+)\s*kcal/i);
    const tailMatch = line.match(/kcal\s*(.*)$/i);
    return {
      kcal: kcalMatch ? `${kcalMatch[1]} kcal` : "",
      tail: tailMatch ? tailMatch[1].replace(/\.$/, "").trim() : "",
    };
  };

  const line0 = parseLine0(summaryLines[0]);
  const line1 = parseLine1(summaryLines[1]);
  const line2 = parseLine2(summaryLines[2]);
  const line3 = parseLine3(summaryLines[3]);

  // Helper: get color based on flag/tier
  const getFlagColor = (flag, tier) => {
    if (flag === "ideal" || flag === "strong" || tier === "best") return "#3FAF58";
    if (flag === "moderate" || tier === "mid") return "#3FAF58";
    if (flag === "limiter" || flag === "low" || tier === "limiter") return "#DA5747";
    return "#3FAF58";
  };

  // Helper: extract the trainer interpretation cleanly
  const getInterpretation = (signal) => signal?.trainer_interpretation || "";

  // Helper: get short status label (e.g., "Strong (fat-use dominant)")
  const getStatusLabel = (signal) => signal?.zone_label || "";

  // Helper: get tier label
  const getTierLabel = (signal) => `tier: ${signal?.tier || ""}`;

  // Helper: render a metric card (for Acetone & Ethanol — score-based)
  const renderScoreCard = (signal) => {
    if (!signal) return null;
    const color = getFlagColor(signal.flag, signal.tier);
    const score = signal.score?.toFixed(1) || "—";

    return (
      <div
        className="mt-5 pl-5 pr-[13px] pt-[14px] pb-[37px] border-l-[3px] bg-[#FFFFFF] rounded-[10px]"
        style={{ borderLeftColor: color }}
      >
        <div className="flex justify-between">
          <div className="flex flex-col gap-[5px] justify-start">
            <span className="text-[#252525] font-semibold text-[12px] leading-[100%] tracking-[-2%]">
              {signal.signal}
            </span>
            <div className="flex">
              <span className="text-[#535359] text-[10px] leading-[110%] tracking-[-2%] capitalize">
                {getStatusLabel(signal)}
              </span>
              <span className="text-[#535359] text-[10px] leading-[110%] tracking-[-2%] capitalize ml-2">
                {getTierLabel(signal)}
              </span>
            </div>
          </div>
          <span
            className="font-semibold text-[18px] leading-[110%] tracking-[-2px]"
            style={{ color: color }}
          >
            {score}
          </span>
        </div>

        <div className="mt-[15px] py-[5px]">
          <p className="text-[#738298] text-[9px] font-normal leading-[110%] tracking-[-0.18px]">
            {signal.threshold_rule}
          </p>
        </div>

        <div className="mt-3">
          <p className="text-[#738298] text-[11px] font-normal leading-[130%]">
            {getInterpretation(signal)}
          </p>
        </div>
      </div>
    );
  };

  // Helper: render hydrogen card (with limiter pill instead of score)
  const renderHydrogenCard = (signal) => {
    if (!signal) return null;
    const isLimiter =
      signal.flag === "limiter" ||
      signal.flag === "low" ||
      signal.tier === "limiter";
    const color = getFlagColor(signal.flag, signal.tier);

    return (
      <div
        className="mt-5 pl-5 pr-[13px] pt-[14px] pb-[37px] border-l-[3px] bg-[#FFFFFF] rounded-[10px]"
        style={{ borderLeftColor: color }}
      >
        <div className="flex justify-between">
          <div className="flex flex-col gap-[5px] justify-start">
            <span className="text-[#252525] font-semibold text-[12px] leading-[100%] tracking-[-2%]">
              {signal.signal}
            </span>
            <div className="flex">
              <span className="text-[#535359] text-[10px] leading-[110%] tracking-[-2%] capitalize">
                {getStatusLabel(signal)}
              </span>
              <span className="text-[#535359] text-[10px] leading-[110%] tracking-[-2%] capitalize ml-2">
                {getTierLabel(signal)}
              </span>
            </div>
          </div>
          {isLimiter ? (
            <div
              className="flex items-center px-2.5 py-0.5 rounded-[20px] h-fit"
              style={{ backgroundColor: color }}
            >
              <span className="text-[#FFFFFF] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                Limiter
              </span>
            </div>
          ) : (
            <span
              className="font-semibold text-[18px] leading-[110%] tracking-[-2px]"
              style={{ color: color }}
            >
              {signal.score?.toFixed(1) || "—"}
            </span>
          )}
        </div>

        <div className="mt-[15px] py-[5px]">
          <p className="text-[#738298] text-[9px] font-normal leading-[110%] tracking-[-0.18px]">
            {signal.threshold_rule}
          </p>
        </div>

        <div className="mt-3">
          <p className="text-[#738298] text-[11px] font-normal leading-[130%]">
            {getInterpretation(signal)}
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!whyTodaysPlan) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-[#738298] text-[12px]">No trainer direction data available.</p>
      </div>
    );
  }

  const acetoneSignals = signalsByMarker.acetone || [];
  const ethanolSignals = signalsByMarker.ethanol || [];
  const hydrogenSignals = signalsByMarker.hydrogen || [];

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="pt-[14px] pl-[14px] pr-[14px] pb-[35px] bg-[#F5F7FA] rounded-[15px] ">
          <div className="flex gap-[5px]">
            <span className="text-[#738298] text-[10px] font-semibold leading-normal uppercase">
              TODAY’S PLAN
            </span>
            <span className="text-[#738298] text-[10px] font-semibold leading-normal uppercase">
              4-line summarY
            </span>
          </div>

          <div className="flex flex-col gap-[15px] mt-5">
            <div className="flex justify-between ">
              <div className="flex gap-[15px] justify-start">
                <p className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] capitalize">
                  {line0.mode}
                </p>
                <p className="text-[#738298] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                  {line0.rest}
                </p>
              </div>

              <div className="flex gap-[15px] justify-start">
                <p className="text-[#308BF9] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                  Session cap: RPE ,
                </p>
                <p className="text-[#738298] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] capitalize">
                  {line2.rpe}
                </p>
                <p className="text-[#738298] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                  , {line2.tail}
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <div className="flex gap-[15px] justify-start">
                <p className="text-[#738298] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                  Primary limiter:
                </p>
                <p className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] capitalize">
                  {line1.primary}.
                </p>
                <p className="text-[#738298] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                  Secondary: {line1.secondary}
                </p>
              </div>

              <div className="flex  gap-[15px] justify-start">
                <p className="text-[#738298] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                  Energy:
                </p>
                <p className="text-[#DA5747] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] capitalize">
                  {line3.kcal}
                </p>
                <p className="text-[#738298] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                  {line3.tail}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex gap-[19px]">
            {/* Acetone Column - Fuel & Energy Trends */}
            <div className="px-[15px] py-[15px] bg-[#F5F7FA] rounded-[15px] border border-[#E1E6ED]">
              <div className="flex flex-col gap-1 justify-start pt-[15px] pl-[5px] pr-[13px]">
                <span className="text-[#252525] font-semibold text-[15px] leading-[100%] tracking-[-2%]">
                  Acetone
                </span>
                <span className="text-[#535359] text-[12px] leading-[110%] tracking-[-2%]">
                  Fuel & Energy Trends
                </span>
              </div>

              <div className="flex flex-col gap-[15px]">
                {acetoneSignals.map((signal, idx) => (
                  <div key={`acetone-${idx}`}>{renderScoreCard(signal)}</div>
                ))}
              </div>
            </div>

            {/* Ethanol Column - Metabolic Recovery Trends */}
            <div className="px-[15px] py-[15px] bg-[#F5F7FA] rounded-[15px] border border-[#E1E6ED]">
              <div className="flex flex-col gap-1 justify-start pt-[15px] pl-[5px] pr-[13px]">
                <span className="text-[#252525] font-semibold text-[15px] leading-[100%] tracking-[-2%]">
                  Ethanol
                </span>
                <span className="text-[#535359] text-[12px] leading-[110%] tracking-[-2%]">
                  Metabolic Recovery Trends
                </span>
              </div>

              <div className="flex flex-col gap-[15px]">
                {ethanolSignals.map((signal, idx) => (
                  <div key={`ethanol-${idx}`}>{renderScoreCard(signal)}</div>
                ))}
              </div>
            </div>

            {/* Hydrogen Column - Digestive Balance Trends */}
            <div className="px-[15px] py-[15px] bg-[#F5F7FA] rounded-[15px] border border-[#E1E6ED]">
              <div className="flex flex-col gap-1 justify-start pt-[15px] pl-[5px] pr-[13px]">
                <span className="text-[#252525] font-semibold text-[15px] leading-[100%] tracking-[-2%]">
                  Hydrogen
                </span>
                <span className="text-[#535359] text-[12px] leading-[110%] tracking-[-2%]">
                  Digestive Balance trends
                </span>
              </div>

              <div className="flex flex-col gap-[15px]">
                {hydrogenSignals.map((signal, idx) => (
                  <div key={`hydrogen-${idx}`}>{renderHydrogenCard(signal)}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}