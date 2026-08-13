"use client"
import { useState, useEffect } from "react";
import Image from "next/image";
import RightHandSidebar from "./right-hand-sidebar";
import { useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { getHabitMonitoringData } from "../store/habitMonitoringSlice";
import { cookieManager } from "../lib/cookies";

 
export default function HabitsMonitoring() {
 const dispatch = useDispatch();
  const searchParams = useSearchParams();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // Add state for selected habit
    const [selectedHabit, setSelectedHabit] = useState(null);

const profileId = searchParams.get("profile_id")
  const dieticianCookie = cookieManager.getJSON("dietician");

  const dietitianId =
    dieticianCookie?.dietitian_id ||
    dieticianCookie?.dietician_id ||
    dieticianCookie?.id ||
    "";


const { loading, response, data, habitList, error } = useSelector(
  (state) => state.habitMonitoring
);


  useEffect(() => {
    if (profileId && dietitianId) {
      dispatch(
        getHabitMonitoringData({
          profileId,
          dietitianId,
        })
      );
    }
  }, [profileId, dietitianId, dispatch]);

    const handleOpenSidebar = () => {
        setIsSidebarOpen(true);
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
        setSelectedHabit(null); // Reset selected habit when closing
    };

    // Helper function to determine color based on category
    const getHabitColorScheme = (category, index) => {
        const colorSchemes = {
            'Nutrition Habits': {
                color: '#91850E',
                bgColor: 'bg-[#FCF8CF]',
                borderColor: 'border-[#91850E]',
                textColor: 'text-[#91850E]',
            },
            'Activity Habits': {
                color: '#078C21',
                bgColor: 'bg-[#CAE8D0]',
                borderColor: 'border-[#078C21]',
                textColor: 'text-[#078C21]',
            },
            'Sleep & Recovery Habits': {
                color: '#179C9C',
                bgColor: 'bg-[#E1F3F3]',
                borderColor: 'border-[#179C9C]',
                textColor: 'text-[#179C9C]',
            },
            'Health / Digestion / Lifestyle': {
                color: '#B42525',
                bgColor: 'bg-[#FFEDED]',
                borderColor: 'border-[#B42525]',
                textColor: 'text-[#B42525]',
            },
        };
        
        // Fallback colors if category not found
        const fallbackColors = [
            { color: '#1D57A0', bgColor: 'bg-[#E4F0FF]', borderColor: 'border-[#1D57A0]', textColor: 'text-[#1D57A0]' },
            { color: '#91850E', bgColor: 'bg-[#FCF8CF]', borderColor: 'border-[#91850E]', textColor: 'text-[#91850E]' },
            { color: '#078C21', bgColor: 'bg-[#CAE8D0]', borderColor: 'border-[#078C21]', textColor: 'text-[#078C21]' },
        ];
        
        return colorSchemes[category] || fallbackColors[index % fallbackColors.length];
    };

    // One dot per weekday (Sun → Sat) for the CURRENT week, driven by the API's
    // `tracking` array. Each entry carries a `status`
    //   1  = completed, 0 = pending (past/today, not done),
    //   2  = future,     -1 = untracked
    // and a `completed_count`. A day is treated as completed whenever
    // completed_count > 0 (count 1, 2, 3 … of completed days), filled when
    // completed, outlined when pending/missed, and left grey for future/untracked.
    const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // A day counts as completed once at least one target unit is logged.
    const isDayCompleted = (entry) => (entry?.completed_count || 0) > 0;

    const renderTrackingDots = (habit, color) => {
        const tracking = habit?.tracking || [];

        // Weekly habits (e.g. "Lift weights 4×/week") are tracked as N sessions
        // per week, not per weekday — show one dot per target session and fill
        // one for each day completed this week (completed_count > 0 → count 1,2,3…).
        if (habit?.frequency_type === "weekly") {
            const target = habit?.target_count || 0;
            const completedThisWeek = tracking.reduce(
                (sum, d) => sum + (isDayCompleted(d) ? 1 : 0),
                0
            );
            const filled = Math.min(completedThisWeek, target);

            return Array.from({ length: target }, (_, i) => {
                const dotStyle = i < filled
                    ? { backgroundColor: color }
                    : { border: `1px solid ${color}`, backgroundColor: 'white' };
                return (
                    <div
                        key={`session-${i}`}
                        className="w-[14px] h-[14px] rounded-full"
                        style={dotStyle}
                    />
                );
            });
        }

        // Daily habits: one dot per day in the week's `tracking` (Sun → Sat).
        return tracking.map((entry) => {
            const dotStyle = isDayCompleted(entry)
                ? { backgroundColor: color }                                     // completed
                : entry?.status === 0
                    ? { border: `1px solid ${color}`, backgroundColor: 'white' } // pending / missed
                    : { border: '1px solid #E1E6ED', backgroundColor: 'white' }; // future / untracked

            return (
                <div
                    key={entry.date}
                    title={`${entry.day} ${entry.date}`}
                    className="w-[14px] h-[14px] rounded-full"
                    style={dotStyle}
                />
            );
        });
    };

    const handleHabitClick = (habit) => {
        setSelectedHabit(habit);
        setIsSidebarOpen(true);
    };

    // Format a Date to a YYYY-MM-DD key using local time (toISOString() would
    // shift across the UTC boundary and mismatch the API's local dates).
    const toDateKey = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    // The current week's seven days (Sunday -> Saturday) as { key, dayName }.
    const getCurrentWeekDates = () => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // back to Sunday

        return WEEK_DAYS.map((dayName, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return { key: toDateKey(d), dayName };
        });
    };

    // Build the current week's range label (Sunday -> Saturday) based on today.
    // e.g. "Weekly (28 Jun - 4 Jul)"
    const getCurrentWeekRange = () => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // back to Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // forward to Saturday

        const fmt = (d) =>
            `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;

        return `Weekly (${fmt(startOfWeek)} - ${fmt(endOfWeek)})`;
    };

    const currentWeekDates = getCurrentWeekDates();

    // Prefer the API's week window (week_start → week_end); fall back to the
    // locally-computed Sunday→Saturday range.
    const formatRangeLabel = (startStr, endStr) => {
        const parse = (s) => {
            const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
            return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
        };
        const start = parse(startStr);
        const end = parse(endStr);
        if (!start || !end) return getCurrentWeekRange();
        const fmt = (d) => `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
        return `Weekly (${fmt(start)} - ${fmt(end)})`;
    };

    const weekRangeLabel = formatRangeLabel(data?.week_start, data?.week_end);

    // Completion rate for the CURRENT week. The API returns it per habit in
    // `week_summary.completion_rate`; fall back to computing it from `tracking`.
    //  - weekly habits  -> completed days this week / target_count
    //  - daily habits   -> days completed this week / 7
    const getWeeklyCompletionPercent = (habit) => {
        const rate = habit?.week_summary?.completion_rate;
        if (rate != null) return Math.round(rate);

        const tracking = habit?.tracking || [];
        const completedThisWeek = tracking.reduce(
            (sum, d) => sum + (isDayCompleted(d) ? 1 : 0),
            0
        );

        if (habit?.frequency_type === "weekly") {
            const target = habit?.target_count || 0;
            if (!target) return 0;
            return Math.min(100, Math.round((completedThisWeek / target) * 100));
        }

        const totalDays = tracking.length || 7;
        return Math.round((completedThisWeek / totalDays) * 100);
    };

    // Get habits from API response or use empty array
    const apiHabits = data?.habits || [];
    const totalHabits = apiHabits.length;

    return (
        <>
            <div className="w-full relative border rounded-[15px] px-3 pt-5 pb-[15px] overflow-hidden">
                <div className="flex flex-col gap-[30px]">
                    <div className="flex justify-between items-center pl-2 flex-wrap gap-2">
                        <p className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px]">
                            Habit Monitoring ({totalHabits})
                        </p>

                            <div className="flex items-center gap-[15px] px-[11px] py-1 cursor-pointer border border-[#E1E6ED] rounded-[4px] "
                              onClick={handleOpenSidebar}
                            >
                            <p className="text-[12px] text-[#535359] font-normal leading-[110%] tracking-[-0.24px]">
                                {weekRangeLabel}
                            </p>

                            <Image
                            src="/icons/right button0356.svg"
                            alt="right arrow"
                            width={20}
                            height={20}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <p className="text-[#535359]">Loading habits...</p>
                        </div>
                    ) : apiHabits.length === 0 ? (
                        <div className="flex justify-center items-center py-10">
                            <p className="text-[#535359]">No habits found</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-[15px]">
                            {/* First row - first 2 habits */}
                            <div className="flex gap-[15px]">
                                {apiHabits.slice(0, 2).map((habit, index) => {
                                    const colorScheme = getHabitColorScheme(habit.category, index);
                                    const weeklyCompletion = getWeeklyCompletionPercent(habit);
                                    return (
                                        <div 
                                            key={habit.selected_habit_id}
                                            className={`group flex flex-col gap-[15px] pt-5 pr-5 pl-[15px] pb-[13px] ${colorScheme.bgColor} rounded-[15px] flex-1`}
                                        >
                                            <div className="flex flex-col gap-[27px]">
                                                <div className="flex flex-col gap-[5px]">
                                                    <p className="text-[#252525] text-[15px] font-normal leading-[110%] tracking-[-0.3px]">
                                                        {habit.title || habit.habit_name}
                                                    </p>
                                                    <p className={`${colorScheme.textColor} text-[10px] font-normal leading-normal tracking-[-0.2px]`}>
                                                        {habit.frequency_type}
                                                    </p>
                                                </div>
                                                <div className="flex gap-[5px] flex-wrap">
                                                    {renderTrackingDots(habit, colorScheme.color)}
                                                </div>
                                            </div>
                                            <div className="flex gap-[109px] max-xl:gap-0 max-xl:justify-between">
                                                <div className="flex flex-col gap-5">
                                                    <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] uppercase whitespace-nowrap">
                                                        Completion Rate
                                                    </p>
                                                    <div>
                                                        <p className="text-[#252525]">
                                                            <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                                                {weeklyCompletion}
                                                            </span>
                                                            <span className="text-center text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">%</span>
                                                        </p>
                                                    </div>
                                                </div>
                                               <div 
                                                    className="w-[32px] h-[32px] flex justify-end self-end items-end pb-[7px]"
                                                    onClick={() => handleHabitClick(habit)}
                                                >
                                                    <Image
                                                        src="/icons/right button0356.svg"
                                                        alt="right button0356.svg"
                                                        width={32}
                                                        height={32}
                                                        className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 pb-[7px]"
                                                    />
                                                </div> 
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>


<div className="flex items-end justify-between">
                            {/* Second row - remaining habits */}
                            {apiHabits.length > 2 && (
                                <div className="flex gap-[15px]">
                                    <div className="flex gap-[15px] flex-wrap">
                                        {apiHabits.slice(2).map((habit, index) => {
                                            const colorScheme = getHabitColorScheme(habit.category, index + 2);
                                            const weeklyCompletion = getWeeklyCompletionPercent(habit);
                                            return (
                                                <div 
                                                    key={habit.selected_habit_id}
                                                    className={`group flex flex-col gap-[15px] pt-5 pr-5 pb-[13px] pl-[15px] ${colorScheme.bgColor} rounded-[15px]`}
                                                >
                                                    <div className="flex flex-col gap-[27px]">
                                                        <div className="flex flex-col gap-[5px]">
                                                            <p className="text-[#252525] text-[15px] font-normal leading-[110%] tracking-[-0.3px]">
                                                                {habit.title || habit.habit_name}
                                                            </p>
                                                            <p className={`${colorScheme.textColor} text-[10px] font-normal leading-normal tracking-[-0.2px]`}>
                                                                {habit.frequency_type}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-[5px] flex-wrap">
                                                            {renderTrackingDots(habit, colorScheme.color)}
                                                        </div>
                                                    </div>
                                                    <div className="flex">
                                                        <div className="flex flex-col gap-5">
                                                            <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] uppercase whitespace-nowrap">
                                                                Completion Rate
                                                            </p>
                                                            <div>
                                                                <p className="text-[#252525]">
                                                                    <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                                                        {weeklyCompletion}
                                                                    </span>
                                                                    <span className="text-center text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">%</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div 
                                                            className="w-[32px] h-[32px] flex justify-end self-end items-end pb-[7px]"
                                                            onClick={() => handleHabitClick(habit)}
                                                        >
                                                            <Image
                                                                src="/icons/right button0356.svg"
                                                                alt="right button0356.svg"
                                                                width={32}
                                                                height={32}
                                                                className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 pb-[7px]"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}


                            <div
                                className="flex flex-col gap-[15px] justify-start cursor-pointer"
                                onClick={handleOpenSidebar}
                            >
                                <Image
                                src="/icons/Frame 383555.svg"
                                alt="Frame 383555.svg"
                                width={33}
                                height={32}
                                className="rounded-full border border-[#252525]"
                                />
                                <span className="text-[#252525] text-[15px] font-normal leading-[110%] tracking-[-0.3px] whitespace-nowrap">View All</span>
                            </div>

                            </div>
                        </div>
                    )}
                </div>

                <RightHandSidebar
                    isOpen={isSidebarOpen}
                    onClose={handleCloseSidebar}
                    selectedHabit={selectedHabit}
                    setSelectedHabit={setSelectedHabit}
                />
            </div>
        </>
    )
}