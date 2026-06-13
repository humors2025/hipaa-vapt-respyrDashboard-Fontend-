"use client";
import { useState } from "react";
import { IoIosArrowForward } from "react-icons/io";
import { useSelector } from "react-redux";
import DigestiveBalanceTrends from "./digestive-balance-trends";
import FuelEnergyTrends from "./fuel-energy-trends";
import MetabolicRecoveryTrends from "./metabolic-recovery-trends";
import TrendPopUp from "./pop-folder/trend-popup";


export default function TrendBreakdown() {
    const clientIndividualProfile = useSelector((state) => state.clientIndividualProfile.data);


    const [activeTab, setActiveTab] = useState("digestive");
    const [showPopup, setShowPopup] = useState(false);

    const rawTrendBreakdownData = clientIndividualProfile?.data?.trend_breakdown || {};

    // Real score/zone/text values live in raw_json.Metabolism_Score_Analysis
    const metabolismScores =
        clientIndividualProfile?.data?.raw_json?.Metabolism_Score_Analysis || {};

    // Map each visible trend title to its raw_json key
    const rawJsonKeyByTitle = {
        "Digestive Activity Trend": "Digestive_Activity_Trend",
        "Fuel Utilization Trend": "Fuel_Utilization_Trend",
        "Metabolic Load Trend": "Metabolic_Load_Trend",
    };

    // Overlay raw_json values onto the trend_breakdown items
    const bindFromRawJson = (section) => {
        if (!section) return section;
        return {
            ...section,
            items: (section.items || []).map((item) => {
                const rawKey = rawJsonKeyByTitle[item?.title];
                const raw = rawKey ? metabolismScores[rawKey] : null;
                if (!raw) return item;
                return {
                    ...item,
                    score: raw.value ?? raw.score ?? item.score,
                    zone: raw.zone || item.zone,
                    short_text: raw.client_state || item.short_text,
                    trainer_state: raw.trainer_state || item.trainer_state,
                    trainer_score_meaning: raw.trainer_score_meaning || item.trainer_score_meaning,
                    trainer_score_deep_science: raw.trainer_score_deep_science || item.trainer_score_deep_science,
                };
            }),
        };
    };

    // Titles to hide from the trend breakdown
    const hiddenTitles = [
        "Nutrient Utilization Trend",
        "Energy Source Trend",
        "Recovery Activity Trend",
    ];

    const filterItems = (section) => {
        if (!section) return section;
        return {
            ...section,
            items: (section.items || []).filter(
                (item) => !hiddenTitles.includes(item?.title)
            ),
        };
    };

    const trendBreakdownData = {
        ...rawTrendBreakdownData,
        digestive_balance_trend: bindFromRawJson(filterItems(rawTrendBreakdownData.digestive_balance_trend)),
        fuel_and_energy_trend: bindFromRawJson(filterItems(rawTrendBreakdownData.fuel_and_energy_trend)),
        metabolic_recovery_trend: bindFromRawJson(filterItems(rawTrendBreakdownData.metabolic_recovery_trend)),
    };


    const getZoneColor = (zone) => {
        switch (String(zone).toLowerCase()) {
            case "optimal":
            case "strong":
                return "#3FAF58";
            case "moderate":
            case "steady":
                return "#FFBF2D";
            case "focus":
            case "building":
            case "attention":
            case "weak":
                return "#E48326";
            default:
                return "#A1A1A1";
        }
    };


    const getTabZone = (items = []) => {
        if (!items.length) return "";

        // Only consider real zones the API returned (ignore "NA"/empty)
        const present = new Set(
            items.map((item) => item?.zone).filter((zone) => zone && zone !== "NA")
        );

        // worst-first priority — the dot reflects the zone needing most attention
        const priority = [
            "Focus",
            "Building",
            "Attention",
            "Weak",
            "Moderate",
            "Steady",
            "Optimal",
            "Strong",
        ];

        return priority.find((zone) => present.has(zone)) || "";
    };

    const digestiveZone = getTabZone(
        trendBreakdownData?.digestive_balance_trend?.items
    );
    const fuelZone = getTabZone(
        trendBreakdownData?.fuel_and_energy_trend?.items
    );
    const metabolicZone = getTabZone(
        trendBreakdownData?.metabolic_recovery_trend?.items
    );


    const renderComponent = () => {
        if (activeTab === "digestive") {
            return <DigestiveBalanceTrends data={trendBreakdownData.digestive_balance_trend} />;
        }
        if (activeTab === "fuel") {
            return <FuelEnergyTrends data={trendBreakdownData.fuel_and_energy_trend} />;
        }
        if (activeTab === "metabolic") {
            return <MetabolicRecoveryTrends data={trendBreakdownData.metabolic_recovery_trend} />;
        }
    };


    return (
        <>
            <div className="w-full border border-[#E1E6ED] rounded-[15px] px-5 pt-[18px] pb-6">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <p className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px]">
                        Trend Breakdown
                    </p>

                    <div
                        onClick={() => setShowPopup(true)}
                        className="flex gap-[15px] items-center px-[11px] py-1 border border-[#E1E6ED] rounded-[4px] cursor-pointer">
                        <p className="text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
                            See Detailed Analysis
                        </p>
                        <IoIosArrowForward className="text-[#308BF9] w-5 h-5" />
                    </div>
                </div>


                {/* Tabs */}
                <div className="flex w-full gap-[25px] mt-[18px] border-b border-[#E1E6ED]">

                    {/* Digestive */}
                    <button
                        onClick={() => setActiveTab("digestive")}
                        className={`flex gap-2 items-center pb-[13px] pl-[5px] cursor-pointer
                        ${activeTab === "digestive" ? "border-b-2 border-[#308BF9]" : ""}`}
                    >
                        <span
                            className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap
                            ${activeTab === "digestive" ? "text-[#308BF9]" : "text-[#A1A1A1]"}`}
                        >
                            Digestive Activity Trend
                        </span>
                        <div
                            className="w-[6px] h-[6px] rounded-full"
                            style={{ backgroundColor: getZoneColor(digestiveZone) }}
                        />
                    </button>


                    {/* Fuel */}
                    <button
                        onClick={() => setActiveTab("fuel")}
                        className={`flex gap-2 items-center pb-[13px] pl-[5px] cursor-pointer
                        ${activeTab === "fuel" ? "border-b-2 border-[#308BF9]" : ""}`}
                    >
                        <span
                            className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px]  whitespace-nowrap
                            ${activeTab === "fuel" ? "text-[#308BF9]" : "text-[#A1A1A1]"}`}
                        >
                            Fuel Utilization Trend
                        </span>
                        <div
                            className="w-[6px] h-[6px] rounded-full"
                            style={{ backgroundColor: getZoneColor(fuelZone) }}
                        />
                    </button>


                    {/* Metabolic */}
                    <button
                        onClick={() => setActiveTab("metabolic")}
                        className={`flex gap-2 items-center pb-[13px] pl-[5px] cursor-pointer
                        ${activeTab === "metabolic" ? "border-b-2 border-[#308BF9]" : ""}`}
                    >
                        <span
                            className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px]  whitespace-nowrap
                            ${activeTab === "metabolic" ? "text-[#308BF9]" : "text-[#A1A1A1]"}`}
                        >
                            Metabolic Load Trend
                        </span>
                        <div
                            className="w-[6px] h-[6px] rounded-full"
                            style={{ backgroundColor: getZoneColor(metabolicZone) }}
                        />
                    </button>

                </div>


                {/* Component Render */}
                <div className="mt-[18px]">
                    {renderComponent()}
                </div>

            </div>
            {showPopup && (
                <TrendPopUp
                    closePopup={() => setShowPopup(false)}
                    profileId={clientIndividualProfile?.data?.profile_details?.profile_id}
                />
            )}
        </>
    );
}