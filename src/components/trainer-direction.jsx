"use client";
import { useState } from 'react';
import { useSelector } from 'react-redux';
import OverviewTab from './overview-tab';
import FoodDirection from './food-direction';
import TodayPlan from './today-plan';
import { selectTrainerDirectionData } from '../store/trainerDirectionSlice';

export default function TrainerDirection() {
    const [activeTab, setActiveTab] = useState('overview');
    const trainerData = useSelector(selectTrainerDirectionData);

    const trainerElite = trainerData?.trainer_direction_elite;
    const readinessSnapshot = trainerElite?.readiness_snapshot;
    const trainingPrescription = trainerElite?.training_prescription;
    const exerciseStrategy = trainerElite?.exercise_strategy;

    // Build training mode short label (e.g., "Recovery-Support", "Controlled Fat-Loss", etc.)
    const getShortTrainingMode = (mode) => {
        if (!mode) return "—";
        // Take first 2 words to keep it compact, or shorten common patterns
        return mode
            .replace(/Training$/i, "")
            .trim();
    };

    const trainingModeLabel = getShortTrainingMode(readinessSnapshot?.training_mode);
    const rpeRange = trainingPrescription?.intensity_rpe || "—";
    const volume = trainingPrescription?.volume || "—";
    const sessionLength = trainingPrescription?.session_length || "—";

    // Format sets_reps and rpe into "Exercise  3×8 @ 4" format
    const formatExerciseLabel = (exercise) => {
        if (!exercise) return "";
        // Convert "3 sets of 8 reps" -> "3×8"
        const setsRepsMatch = exercise.sets_reps?.match(/(\d+)\s*sets?\s*of\s*(\d+)\s*reps?/i);
        const setsReps = setsRepsMatch
            ? `${setsRepsMatch[1]}×${setsRepsMatch[2]}`
            : exercise.sets_reps || "";
        return `${exercise.exercise}  ${setsReps} @ ${exercise.rpe_target}`;
    };

    // Build exercise pills: main lift first, then accessories (limit to top 3 for header space)
    const headerExercises = [];
    if (exerciseStrategy?.main_lift) {
        headerExercises.push({
            label: formatExerciseLabel(exerciseStrategy.main_lift),
            isMain: true,
        });
    }
    if (exerciseStrategy?.accessories?.length > 0) {
        exerciseStrategy.accessories.slice(0, 2).forEach((acc) => {
            headerExercises.push({
                label: formatExerciseLabel(acc),
                isMain: false,
            });
        });
    }

    const tabs = [
        { id: 'overview', label: 'Overview' },
        // { id: 'food', label: 'Food Direction' },
        { id: 'why', label: "Why Today's Plan" }
    ];

    return (
        <div className="flex flex-col h-full">
            {/* FIXED HEADER SECTION */}
            <div className="flex-shrink-0">
                <div className="flex items-center py-[5px] bg-[#E1E6ED]">
                    <div className="pt-1 pb-0.5 pr-[10px] ml-5">
                        <p className="text-[#535359] text-[10px] font-semibold leading-normal tracking-[-0.2px] uppercase">Today</p>
                    </div>

                    <div className="flex gap-[5px] items-center my-1 px-3 pt-[5px] pb-1 border-l border-r border-[#A1A1A1]">
                        <span className="text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]">
                            {trainingModeLabel}
                        </span>
                        <span className="text-[#535359] text-[11px] font-normal leading-[110%] tracking-[-0.22px]">
                            {" "}· RPE {rpeRange} · {volume} vol · {sessionLength}
                        </span>
                    </div>

                    <div className="flex gap-2.5 items-center ml-2.5">
                        {headerExercises.length > 0 ? (
                            headerExercises.map((ex, idx) => (
                                <div
                                    key={`header-ex-${idx}`}
                                    className={`px-3 pt-[9px] pb-2 rounded-[25px] ${
                                        ex.isMain ? "bg-[#535359]" : "bg-[#5353598C]"
                                    }`}
                                >
                                    <p className="text-[#FFFFFF] text-[11px] font-semibold leading-[110%] tracking-[-0.22px]">
                                        {ex.label}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <>
                                <div className="px-3 pt-[9px] pb-2 bg-[#535359] rounded-[25px]">
                                    <p className="text-[#FFFFFF] text-[11px] font-semibold leading-[110%] tracking-[-0.22px]">—</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center border-b border-[#E1E6ED]">
                    {tabs.map((tab) => (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-[25px] py-[11px] cursor-pointer ${activeTab === tab.id
                                ? 'border-b-[3px] border-[#308BF9]'
                                : ''
                                }`}
                        >
                            <span
                                className={`text-[11px] font-semibold leading-[110%] tracking-[-0.22px] ${activeTab === tab.id
                                    ? 'text-[#308BF9]'
                                    : 'text-[#A1A1A1]'
                                    }`}
                            >
                                {tab.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* SCROLLABLE CONTENT SECTION */}
            <div className="flex-1 overflow-y-auto group-hover-scrollbar mt-[15px]">
                {activeTab === 'overview' && <OverviewTab />}
                {/* {activeTab === 'food' && <FoodDirection />} */}
                {activeTab === 'why' && <TodayPlan />}
            </div>
        </div>
    );
}