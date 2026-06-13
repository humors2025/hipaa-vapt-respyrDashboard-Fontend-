"use client"
import { useState, useEffect } from "react";
import Image from "next/image";
import RightHandSidebar from "./right-hand-sidebar";
import { useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { getHabitMonitoringData } from "../store/habitMonitoringSlice";
import { getHabitDetail, clearHabitDetail } from "../store/habitDetailSlice";
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
        dispatch(clearHabitDetail());
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

    // Render week tracking dots
    const renderWeekTracking = (weekTracking, color, today) => {
        return weekTracking.map((day, index) => {
            const isMissedPastDay =
                !day.is_completed &&
                day.completed_count === 0 &&
                today &&
                day.date < today;

            const dotStyle = day.is_completed
                ? { backgroundColor: color }
                : day.completed_count > 0 || isMissedPastDay
                    ? { border: `1px solid ${color}`, backgroundColor: 'white' }
                    : { backgroundColor: 'white' };

            return (
                <div
                    key={index}
                    className="w-[14px] h-[14px] rounded-full"
                    style={dotStyle}
                />
            );
        });
    };

    const handleHabitClick = (habit) => {
        setSelectedHabit(habit);
        setIsSidebarOpen(true);
        if (profileId && dietitianId && habit?.selected_habit_id) {
            dispatch(
                getHabitDetail({
                    profileId,
                    dietitianId,
                    selectedHabitId: habit.selected_habit_id,
                })
            );
        }
    };

    // Get habits from API response or use empty array
    const apiHabits = data?.habits || [];
    const totalHabits = apiHabits.length;

    return (
        <>
            <div className="w-full relative border rounded-[15px] px-3 pt-5 pb-[15px] overflow-hidden">
                <div className="flex flex-col gap-[30px]">
                    <div className="flex justify-between items-center pl-2">
                        <p className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px]">
                            Habit Monitoring ({totalHabits})
                        </p>
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
                                                <div className="flex gap-[5px]">
                                                    {renderWeekTracking(habit.week_tracking, colorScheme.color, data?.today)}
                                                </div>
                                            </div>
                                            <div className="flex gap-[109px]">
                                                <div className="flex flex-col gap-5">
                                                    <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] uppercase whitespace-nowrap">
                                                        Weekly Completion Rate
                                                    </p>
                                                    <div>
                                                        <p className="text-[#252525]">
                                                            <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                                                {habit.weekly_completion_rate}
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
                                                        <div className="flex gap-[5px]">
                                                            {renderWeekTracking(habit.week_tracking, colorScheme.color, data?.today)}
                                                        </div>
                                                    </div>
                                                    <div className="flex">
                                                        <div className="flex flex-col gap-5">
                                                            <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] uppercase whitespace-nowrap">
                                                                Weekly Completion Rate
                                                            </p>
                                                            <div>
                                                                <p className="text-[#252525]">
                                                                    <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                                                        {habit.weekly_completion_rate}
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