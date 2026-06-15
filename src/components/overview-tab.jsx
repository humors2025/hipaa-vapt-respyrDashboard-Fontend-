"use client"
import Image from "next/image"
import { useSelector } from "react-redux"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
    selectTrainerDirectionData,
    selectTrainerDirectionLoading,
} from "../store/trainerDirectionSlice"
import { zoneLabel } from "@/lib/utils"

export default function OverviewTab() {

    const trainerData = useSelector(selectTrainerDirectionData);
    const loading = useSelector(selectTrainerDirectionLoading);

    const trainerElite = trainerData?.trainer_direction_elite;
    const realTimeDecisionRule = trainerElite?.real_time_decision_rule;
    const profileData = trainerData?.profile_data;
    const readinessSnapshot = trainerElite?.readiness_snapshot;
    const trainingPrescription = trainerElite?.training_prescription;
    const performanceExpectation = trainerElite?.performance_expectation;
    const exerciseStrategy = trainerElite?.exercise_strategy;
    const whyTodaysPlan = trainerElite?.why_todays_plan;
    const finalMacros = whyTodaysPlan?.final_macros;
    const energyBudget = whyTodaysPlan?.energy_budget;
    const clientSnapshot = whyTodaysPlan?.client_snapshot;
    const foodDirectionSummary = whyTodaysPlan?.food_direction_summary;
    const metabolismSignals = whyTodaysPlan?.metabolism_signals || [];
    const drivers = whyTodaysPlan?.drivers;

    const readinessScore = readinessSnapshot?.training_readiness_score
        ? Math.round(readinessSnapshot.training_readiness_score)
        : 0;

    const summaryDescription = whyTodaysPlan?.summary_lines?.join(" ") || "";

    const getPerformanceValue = (level) => {
        if (!level) return 0;
        const levelLower = level.toLowerCase();
        if (levelLower === "strong" || levelLower === "high" || levelLower === "max") return 90;
        if (levelLower === "good" || levelLower === "moderate" || levelLower === "mid") return 65;
        if (levelLower === "low" || levelLower === "reduced") return 35;
        return 50;
    };

    const getPerformanceColor = (level) => {
        if (!level) return "#A1A1A1";
        const levelLower = level.toLowerCase();
        if (levelLower === "strong" || levelLower === "high") return "#3FAF58";
        if (levelLower === "good" || levelLower === "moderate" || levelLower === "mid") return "#F8B10F";
        return "#DA5747";
    };

    const strengthData = [
        { value: getPerformanceValue(performanceExpectation?.strength_output) },
    ];

    const enduranceData = [
        { value: getPerformanceValue(performanceExpectation?.endurance) },
    ];

    const getFlagColor = (flag, tier) => {
        if (flag === "ideal" || flag === "strong" || tier === "best") return "#3FAF58";
        if (flag === "moderate" || tier === "mid") return "#F8B10F";
        if (flag === "limiter" || flag === "low" || tier === "limiter") return "#DA5747";
        return "#A1A1A1";
    };

    const getFlagLabel = (flag, tier) => {
        if (flag === "ideal") return "Optimal";
        if (flag === "strong") return "Strong";
        if (flag === "moderate" || tier === "mid") return "Mid";
        if (flag === "limiter" || flag === "low") return "Limiter";
        return "—";
    };

    const topDriverName = drivers?.top_positive_driver;

    const renderSignalCard = (signal, isTopDriver = false) => {
        const color = getFlagColor(signal.flag, signal.tier);
        const label = getFlagLabel(signal.flag, signal.tier);
        const score = signal.score ? Math.round(signal.score) : "—";

        if (isTopDriver) {
            return (
                <div className="w-full pl-[14px] pr-5 py-[14px] bg-[#EDF2FF] border border-[#3B5BDB] rounded-[10px]">
                    <div className="flex gap-[7px] items-center">
                        <Image
                            src="/icons/hugeicons_stars.svg"
                            alt="hugeicons_stars.svg"
                            width={15}
                            height={15}
                        />
                        <span className="text-[#3B5BDB] text-[10px] font-semibold leading-normal uppercase">
                            {signal.signal}
                        </span>
                    </div>

                    <div className="flex items-center gap-[39px] py-2.5 border-b border-[#E1E6ED]">
                        <div className="flex flex-col gap-[5px]">
                            <span className="text-[#252525] text-[16px] font-semibold leading-normal tracking-[-0.32px]">
                                {score}
                            </span>

                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">
                                    {signal.marker_source}
                                </span>

                                <div
                                    className="flex items-center rounded-[20px] px-2.5 py-0.5"
                                    style={{ backgroundColor: color }}
                                >
                                    <span className="text-[#FFFFFF] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                                        {label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                className="w-full flex flex-col gap-2.5 p-[14px] border border-[#E1E6ED] rounded-[10px]"
                style={{ boxShadow: `-4px 0 0 0 ${color}` }}
            >
                <span className="text-[#252525] text-[10px] font-semibold leading-normal uppercase">
                    {signal.signal}
                </span>
                <div className="flex flex-col gap-[5px]">
                    <span className="text-[#252525] text-[16px] font-semibold leading-normal tracking-[-0.32px]">
                        {score}
                    </span>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">
                            {signal.marker_source}
                        </span>

                        <div
                            className="flex items-center rounded-[20px] px-2.5 py-0.5"
                            style={{ backgroundColor: color }}
                        >
                            <span className="text-[#FFFFFF] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                                {label}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const sortedSignals = [...metabolismSignals].sort((a, b) => {
        if (a.signal === topDriverName) return -1;
        if (b.signal === topDriverName) return 1;
        return 0;
    });

    const formatKcal = (val) => {
        if (val == null) return "—";
        return val > 0 ? `+${val} kcal` : `${val} kcal`;
    };

    const mainLift = exerciseStrategy?.main_lift;
    const accessories = exerciseStrategy?.accessories || [];
    const conditioning = exerciseStrategy?.conditioning;
    const exclusions = exerciseStrategy?.exclusions || [];

    const clientName = profileData?.email?.split("@")[0] || "Client";
    const formattedClientName = clientName.charAt(0).toUpperCase() + clientName.slice(1);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!trainerElite) {
        return (
            <div className="flex items-center justify-center py-10">
                <p className="text-[#738298] text-[12px]">No trainer direction data available.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* TOP ROW - 3 cards (wraps if not enough space) */}
            <div className='flex gap-5 w-full flex-wrap'>
                {/* Card 1 - Readiness */}
                <div className='flex-1 min-w-[260px] px-3.5 pt-3.5 pb-[50px] bg-[#F5F7FA] rounded-[15px]'>
                    <p className='text-[#738298] text-[10px] font-semibold leading-normal uppercase'>
                        {readinessSnapshot?.training_mode || "RECOVERY-SUPPORT TRAINING"}
                    </p>

                    <div className="flex items-baseline">
                        <div className="flex items-baseline">
                            <p className="text-[#252525] text-[42px] font-normal leading-normal tracking-[-0.84px]">
                                {readinessScore}
                            </p>

                            <p className="text-[#A1A1A1] text-[14px] font-normal leading-normal tracking-[-0.28px]">
                                /100
                            </p>
                        </div>
                    </div>

                    <div className='flex items-center gap-2.5 flex-wrap'>
                        <div className='px-3 py-[5px] bg-[#3B5BDB] rounded-[25px] flex-shrink-0'>
                            <span className='text-[#FFFFFF] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]'>
                                {zoneLabel(readinessSnapshot?.status) || "Building"}
                            </span>
                        </div>

                        <p className='text-[#252525] text-[11px] font-normal leading-[110%] tracking-[-0.22px]'>
                            {readinessSnapshot?.day_focus || "Digestive Comfort Day"}
                        </p>
                    </div>

                    <div className='mt-[15px] border border-[#E1E6ED]'></div>

                    <div className='pt-2.5'>
                        <p className='text-[#738298] font-normal leading-[-0.22px] capitalize text-[11px] break-words'>
                            {readinessSnapshot?.day_focus || ""}, RPE cap {trainingPrescription?.max_rpe || "—"},
                            volume {trainingPrescription?.volume || "—"}. Primary limiter: {readinessSnapshot?.primary_limiter || "—"}.{" "}
                            {formatKcal(energyBudget?.deficit_or_surplus_kcal)} vs TDEE.
                        </p>
                    </div>
                </div>

                {/* Card 2 - Hard Rules */}
                <div className='flex-1 min-w-[260px] px-3.5 pt-3.5 pb-[50px] bg-[#F5F7FA] rounded-[15px]' style={{ boxShadow: '-4px 0 0 0 #DA5747' }}>
                    <p className='text-[#252525] text-[10px] font-semibold leading-normal uppercase'>HARD RULES TODAY</p>

                    <div className='flex flex-col gap-[5px]'>
                        <div className='flex gap-[5px] items-center py-2.5 border-b border-[#E1E6ED] flex-wrap'>
                            <span className='text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]'>Cap RPE at </span>
                            <span className='text-[#252525] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize'>
                                {trainingPrescription?.max_rpe || "—"}-never exceed
                            </span>
                        </div>

                        <div className='flex gap-[5px] items-center py-2.5 border-b border-[#E1E6ED] flex-wrap'>
                            <span className='text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]'>Train To Failure </span>
                            <span className='text-[#252525] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize'>
                                {trainingPrescription?.failure_rule?.toLowerCase().includes("avoid") ||
                                    trainingPrescription?.failure_rule?.toLowerCase().includes("never")
                                    ? "Never"
                                    : "Allowed"}
                            </span>
                        </div>

                        <div className='flex gap-[5px] items-center py-2.5 border-b border-[#E1E6ED] flex-wrap'>
                            <span className='text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]'>Volume </span>
                            <span className='text-[#252525] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize'>
                                {trainingPrescription?.volume || "—"} · {trainingPrescription?.session_length || "—"}
                            </span>
                        </div>

                        <div className='flex gap-[5px] items-center py-2.5 border-b border-[#E1E6ED] flex-wrap'>
                            <span className='text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]'>Conditioning </span>
                            <span className='text-[#252525] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize'>
                                {conditioning?.included ? `${conditioning?.type || ""} ${conditioning?.duration_min || ""} min` : "None today"}
                            </span>
                        </div>

                        <div className='flex gap-[5px] items-center py-2.5 border-b border-[#E1E6ED] flex-wrap'>
                            <span className='text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]'>Progression </span>
                            <span className='text-[#252525] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize'>
                                {trainerElite?.progression_permission?.allowed
                                    ? trainerElite?.progression_permission?.type || "Allowed"
                                    : "Technique Only"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Card 3 - Today's Macros */}
                <div className='flex-1 min-w-[260px] px-3.5 pt-3.5 pb-[50px] bg-[#F5F7FA] rounded-[15px]'>
                    <p className='text-[#252525] text-[10px] font-semibold leading-normal uppercase'>TODAY'S MACROS</p>

                    <div className='pl-[6px] pb-2.5 border-b border-[#E1E6ED] mt-[14px]'>
                        <div className='flex gap-[60px] flex-wrap'>
                            <div className='flex flex-col gap-[5px] justify-start py-[5px]'>
                                <span className='text-[#252525] font-semibold leading-normal tracking-[-0.36px]'>
                                    {finalMacros?.carbs_g ? `${Math.round(finalMacros.carbs_g)}g` : "—"}
                                </span>
                                <div className='flex items-center gap-[5px]'>
                                    <div className='w-[6px] h-[6px] bg-[#5FA7FF] rounded-full'></div>
                                    <span className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>Carbs</span>
                                </div>
                            </div>

                            <div className='flex flex-col gap-[5px] justify-start py-[5px]'>
                                <span className='text-[#252525] font-semibold leading-normal tracking-[-0.36px]'>
                                    {finalMacros?.fat_g ? `${Math.round(finalMacros.fat_g)}g` : "—"}
                                </span>
                                <div className='flex items-center gap-[5px]'>
                                    <div className='w-[6px] h-[6px] bg-[#5FA7FF] rounded-full'></div>
                                    <span className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>Fat</span>
                                </div>
                            </div>
                        </div>

                        <div className='flex gap-[60px] flex-wrap'>
                            <div className='flex flex-col gap-[5px] justify-start py-[5px]'>
                                <span className='text-[#252525] font-semibold leading-normal tracking-[-0.36px]'>
                                    {finalMacros?.protein_g ? `${Math.round(finalMacros.protein_g)}g` : "—"}
                                </span>
                                <div className='flex items-center gap-[5px]'>
                                    <div className='w-[6px] h-[6px] bg-[#E76F51] rounded-full'></div>
                                    <span className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>Protein</span>
                                </div>
                            </div>

                            <div className='flex flex-col gap-[5px] justify-start py-[5px]'>
                                <span className='text-[#252525] font-semibold leading-normal tracking-[-0.36px]'>
                                    {finalMacros?.fiber_g ? `${Math.round(finalMacros.fiber_g)}g` : "—"}
                                </span>
                                <div className='flex items-center gap-[5px]'>
                                    <div className='w-[6px] h-[6px] bg-[#2A9D8F] rounded-full'></div>
                                    <span className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>Fibre</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='flex justify-between mt-2.5 gap-2 flex-wrap'>
                        <div className='flex flex-col gap-[5px]'>
                            <span className='text-[#DA5747] text-[13px] font-semibold leading-normal tracking-[-0.26px]'>
                                {formatKcal(energyBudget?.deficit_or_surplus_kcal)}
                            </span>
                            <span className='text-[#252525] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>
                                vs TDEE {energyBudget?.tdee_kcal || "—"}
                            </span>
                        </div>

                        <div className='flex flex-col gap-[5px]'>
                            <span className='text-[#3FAF58] text-[13px] font-semibold leading-normal tracking-[-0.26px]'>
                                {foodDirectionSummary?.focus_count ?? 0} focus
                            </span>
                            <span className='px-[3px] text-[#252525] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>
                                {foodDirectionSummary?.avoid_count ?? 0} Avoids
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* METABOLISM SIGNALS - wraps to next line if needed */}
            <div className="mt-[18px]">
                <div className="flex gap-2.5 items-center ml-[14px] mb-[14px] flex-wrap">
                    <span className="text-[#252525] text-[10px] font-semibold leading-normal uppercase">
                        {metabolismSignals.length} METABOLISM SIGNALS
                    </span>

                    <div className="flex gap-[5px] items-center bg-[#EDF2FF] rounded-[16px] px-[15px] pt-[7px] pb-1.5">
                        <Image
                            src="/icons/hugeicons_stars.svg"
                            alt="hugeicons_stars.svg"
                            width={15}
                            height={15}
                        />

                        <span className="text-[#3B5BDB] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">TOP DRIVER</span>
                        <span className="text-[#252525] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">
                            {topDriverName || "—"}
                        </span>
                    </div>
                </div>

                <div className="flex gap-5 items-stretch flex-wrap">
                    {sortedSignals.map((signal, idx) => (
                        <div key={`signal-${idx}`} className="flex-1 min-w-[180px] flex">
                            {renderSignalCard(signal, signal.signal === topDriverName)}
                        </div>
                    ))}
                </div>
            </div>

            {/* BOTTOM ROW - 3 cards (wraps if not enough space) */}
            <div className="flex gap-5 mt-5 w-full flex-wrap">
                {/* Today's Plan */}
                <div className="flex-[1.6] min-w-[300px] border border-[#E1E6ED] rounded-[15px] px-[5px] pt-[14px]">
                    <div className="flex gap-[5px] items-center ml-[9px] flex-wrap">
                        <span className="text-[#252525] text-[10px] font-semibold leading-normal uppercase">TODAY'S PLAN</span>
                        <div className="flex items-center gap-[5px]">
                            <div className="bg-[#252525] w-[6px] h-[6px] rounded-full"></div>
                            <span className="text-[10px] text-[#252525] font-semibold leading-normal uppercase">
                                {1 + accessories.length} LIFTS
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-[5px] p-2.5">
                        {/* Main Lift */}
                        {mainLift && (
                            <div className="flex items-center justify-between gap-2 px-2.5 py-2.5 border-b border-[#E1E6ED] flex-wrap">
                                <p className="text-[#252525] text-[12px] font-normal leading-[126%] tracking-[-0.24px] capitalize">
                                    {mainLift.exercise}
                                </p>

                                <div className="flex gap-2.5 items-center flex-wrap">
                                    <div className="px-2.5 py-0.5 border bg-[#B388EB]">
                                        <span className="text-[#FFFFFF] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">MAIN</span>
                                    </div>

                                    <span className="text-[#A1A1A1] text-[11px] font-normal leading-[126%] tracking-[-0.22px]">
                                        {mainLift.sets_reps?.replace(/sets of |reps/g, "").replace(/\s+/g, "").replace("of", "×") || "-"}
                                    </span>

                                    <span className="text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]">
                                        RPE {mainLift.rpe_target}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Accessories */}
                        {accessories.map((acc, idx) => (
                            <div key={`acc-${idx}`} className="flex items-center justify-between gap-2 px-2.5 py-2.5 border-b border-[#E1E6ED] flex-wrap">
                                <p className="text-[#252525] text-[12px] font-normal leading-[126%] tracking-[-0.24px] capitalize">
                                    {acc.exercise}
                                </p>

                                <div className="flex gap-2.5 items-center flex-wrap">
                                    <span className="text-[#A1A1A1] text-[11px] font-normal leading-[126%] tracking-[-0.22px]">
                                        {acc.sets_reps?.replace(/sets of |reps/g, "").replace(/\s+/g, "").replace("of", "×") || "-"}
                                    </span>

                                    <span className="text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]">
                                        RPE {acc.rpe_target}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Conditioning */}
                        <div className="flex items-center justify-between gap-2 px-2.5 py-2.5 border-b border-[#E1E6ED] flex-wrap">
                            <p className="text-[#252525] text-[12px] font-normal leading-[126%] tracking-[-0.24px] capitalize">Conditioning</p>

                            {conditioning?.included ? (
                                <div className="flex gap-2.5 items-center flex-wrap">
                                    <span className="text-[#A1A1A1] text-[11px] font-normal leading-[126%] tracking-[-0.22px]">
                                        {conditioning?.type}
                                    </span>
                                    <span className="text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]">
                                        {conditioning?.duration_min} min
                                    </span>
                                </div>
                            ) : (
                                <div className="px-2.5 py-0.5 border bg-[#D9D9D9]">
                                    <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">Skipped</span>
                                </div>
                            )}
                        </div>

                        {/* Exclusions */}
                        {exclusions.length > 0 && (
                            <div className="flex items-center justify-between gap-2 px-2.5 py-2.5 border-b border-[#E1E6ED] bg-[#FFEFED] flex-wrap">
                                <p className="text-[#252525] text-[12px] font-normal leading-[126%] tracking-[-0.24px] capitalize break-words">
                                    Excluded: {exclusions.join(" · ")}
                                </p>

                                <div className="px-2.5 py-0.5 border bg-[#A82D1E]">
                                    <span className="text-[#FFFFFF] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                                        {exclusions.length} Blocked
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Output Expectations */}
                <div className="flex-1 min-w-[220px] px-[14px] pb-[35px] pt-[14px] border border-[#E1E6ED] rounded-[15px]">
                    <p className="text-[#252525] text-[10px] font-semibold leading-normal uppercase">OUTPUT EXPECTATIONS</p>

                    <div className="flex flex-col gap-5">
                        <div className="mt-4">
                            {/* STRENGTH BAR */}
                            <div>
                                <span className="text-[#535359] text-[10px] font-semibold leading-[126%]">
                                    STRENGTH ({performanceExpectation?.strength_output || "—"})
                                </span>
                                <div className="mt-2">
                                    <div className="w-full" style={{ height: '60px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={strengthData}
                                                layout="vertical"
                                                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis
                                                    type="number"
                                                    domain={[0, 100]}
                                                    tick={{ fontSize: 10, fill: '#535359' }}
                                                    axisLine={{ stroke: '#E1E6ED' }}
                                                    tickLine={false}
                                                    ticks={[0, 50, 100]}
                                                    tickFormatter={(value) => {
                                                        if (value === 0) return 'None';
                                                        if (value === 50) return 'Reduced';
                                                        if (value === 100) return 'Max';
                                                        return '';
                                                    }}
                                                />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    hide
                                                />
                                                <Bar
                                                    dataKey="value"
                                                    fill={getPerformanceColor(performanceExpectation?.strength_output)}
                                                    radius={[0, 4, 4, 0]}
                                                    barSize={20}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* ENDURANCE BAR */}
                            <div className="mt-4">
                                <span className="text-[#535359] text-[10px] font-semibold leading-[126%]">
                                    ENDURANCE ({performanceExpectation?.endurance || "—"})
                                </span>
                                <div className="mt-2">
                                    <div className="w-full" style={{ height: '60px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={enduranceData}
                                                layout="vertical"
                                                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis
                                                    type="number"
                                                    domain={[0, 100]}
                                                    tick={{ fontSize: 10, fill: '#535359' }}
                                                    axisLine={{ stroke: '#E1E6ED' }}
                                                    tickLine={false}
                                                    ticks={[0, 50, 100]}
                                                    tickFormatter={(value) => {
                                                        if (value === 0) return 'None';
                                                        if (value === 50) return 'Low-mid';
                                                        if (value === 100) return 'Max';
                                                        return '';
                                                    }}
                                                />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    hide
                                                />
                                                <Bar
                                                    dataKey="value"
                                                    fill={getPerformanceColor(performanceExpectation?.endurance)}
                                                    radius={[0, 4, 4, 0]}
                                                    barSize={20}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-[14px] pt-[14px] border-t border-[#E1E6ED]">
                            <span className="text-[#252525] font-semibold leading-normal uppercase text-[10px]">LIVE RULES</span>

                            <div className="flex flex-col gap-2.5">
                                <div className="flex gap-2.5 items-start flex-wrap">
                                    <div className="w-[6px] h-[6px] bg-[#3FAF58] rounded-full flex-shrink-0 mt-[5px]"></div>
                                    <span className="text-[#3FAF58] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize">Strong</span>

                                    <p className="text-[#252525] text-[11px] font-normal leading-[130%] tracking-[-0.22px] flex-1 min-w-0">
                                        → {realTimeDecisionRule?.if_client_feels_strong || "-"}
                                    </p>
                                </div>

                                <div className="flex gap-2.5 items-start flex-wrap">
                                    <div className="w-[6px] h-[6px] bg-[#F8B10F] rounded-full flex-shrink-0 mt-[5px]"></div>
                                    <span className="text-[#F8B10F] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize">Fatigued</span>

                                    <p className="text-[#252525] text-[11px] font-normal leading-[130%] tracking-[-0.22px] flex-1 min-w-0">
                                        → {realTimeDecisionRule?.if_client_fatigues_early || "-"}
                                    </p>
                                </div>

                                <div className="flex gap-2.5 items-start flex-wrap">
                                    <div className="w-[6px] h-[6px] bg-[#DA5747] rounded-full flex-shrink-0 mt-[5px]"></div>
                                    <span className="text-[#DA5747] text-[11px] font-semibold leading-[110%] tracking-[-0.22px] capitalize">Discomfort</span>

                                    <p className="text-[#252525] text-[11px] font-normal leading-[130%] tracking-[-0.22px] flex-1 min-w-0">
                                        → {realTimeDecisionRule?.if_discomfort_occurs || "-"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Client & Energy */}
                <div className="flex-1 min-w-[220px] border border-[#E1E6ED] rounded-[15px] px-2.5 pt-[14px] pb-[31px]">
                    <div className="px-1">
                        <span className="text-[#252525] text-[10px] font-semibold leading-normal uppercase">CLIENT & ENERGY</span>

                        <div className="flex gap-[9px] mt-[19px] ml-[5px]">
                            <Image
                                src={`https://humorstech.com/dietitian/api/web/get_profile_image.php?profile_id=${profileData?.profile_id}`}
                                alt="Profile picture"
                                width={40}
                                height={40}
                                className="rounded-full flex-shrink-0"
                            />

                            <div className="flex flex-col gap-[5px] mt-[5px] mb-1 min-w-0">
                                <p className="text-[#535359] text-[13px] font-semibold leading-[110%] tracking-[-0.26px] truncate">
                                    {formattedClientName}
                                </p>
                                <p className="text-[#A1A1A1] text-[11px] font-normal leading-[110%] tracking-[-0.22px] break-words">
                                    {clientSnapshot?.age || profileData?.age || "—"}
                                    {clientSnapshot?.sex === "male" || profileData?.gender === "Male" ? "M" : "F"} ·{" "}
                                    {clientSnapshot?.height_cm || profileData?.height || "—"}cm ·{" "}
                                    {clientSnapshot?.weight_kg || profileData?.weight || "—"}kg ·{" "}
                                    BMI {clientSnapshot?.bmi ? clientSnapshot.bmi.toFixed(1) : "—"}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5 pb-2.5 border-b border-[#E1E6ED] mt-[19px]">
                            <div className="flex gap-2.5">
                                <div className="flex-1 min-w-0 flex flex-col gap-2.5 py-2.5 pl-[14px] pr-3 bg-[#F5F7FA] rounded-[10px]">
                                    <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">BMR</span>
                                    <span className="text-[#252525] text-[16px] font-semibold leading-normal tracking-[-0.32px] ">
                                        {energyBudget?.bmr_kcal || "—"}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col gap-2.5 py-2.5 pl-[14px] pr-3 bg-[#F5F7FA] rounded-[10px]">
                                    <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">TDEE</span>
                                    <span className="text-[#252525] text-[16px] font-semibold leading-normal tracking-[-0.32px] ">
                                        {energyBudget?.tdee_kcal || "—"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2.5">
                                <div className="flex-1 min-w-0 flex flex-col gap-2.5 py-2.5 pl-[14px] pr-3 bg-[#F5F7FA] rounded-[10px]">
                                    <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">Target</span>
                                    <span className="text-[#308BF9] text-[16px] font-semibold leading-normal tracking-[-0.32px] ">
                                        {energyBudget?.target_kcal || "—"}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col gap-2.5 py-2.5 pl-[14px] pr-3 bg-[#F5F7FA] rounded-[10px]">
                                    <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">Deficit</span>
                                    <span className="text-[#DA5747] text-[16px] font-semibold leading-normal tracking-[-0.32px] ">
                                        {energyBudget?.deficit_or_surplus_kcal || "—"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-[27px] mt-[13px] pl-1 flex-wrap">
                            <div className="flex">
                                <span className="text-[#A1A1A1] text-[11px] font-normal leading-normal tracking-[-0.22px] whitespace-nowrap">EA: </span>
                                <span className="text-[#A1A1A1] text-[11px] font-normal leading-normal tracking-[-0.22px] whitespace-nowrap">
                                    {energyBudget?.energy_availability_kcal_per_kg_ffm || "—"} kcal/kg FFM
                                </span>
                            </div>

                            <div className="flex">
                                <span className="text-[#A1A1A1] text-[11px] font-normal leading-normal tracking-[-0.22px] whitespace-nowrap">Mode: </span>
                                <span className="text-[#738298] text-[11px] font-normal leading-normal tracking-[-0.22px] whitespace-nowrap">
                                    {" "}{whyTodaysPlan?.constraints_used?.mode === "fat_loss" ? "Fat-loss" :
                                        whyTodaysPlan?.constraints_used?.mode === "muscle_gain" ? "Muscle-gain" :
                                            whyTodaysPlan?.constraints_used?.mode || "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}