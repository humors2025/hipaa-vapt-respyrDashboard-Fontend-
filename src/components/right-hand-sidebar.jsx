"use client";

import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "next/navigation";
import { IoChevronBackOutline } from "react-icons/io5";
import { IoIosArrowForward } from "react-icons/io";
import { IoIosArrowRoundBack } from "react-icons/io";
import { getHabitDetail, clearHabitDetail } from "../store/habitDetailSlice";
import { cookieManager } from "../lib/cookies";

const HABIT_COLOR_SCHEMES = {
  "Nutrition Habits": { color: "#91850E", bgColor: "#FCF8CF" },
  "Activity Habits": { color: "#078C21", bgColor: "#CAE8D0" },
  "Sleep & Recovery Habits": { color: "#179C9C", bgColor: "#E1F3F3" },
  "Health / Digestion / Lifestyle": { color: "#B42525", bgColor: "#FFEDED" },
};

const FALLBACK_COLOR_SCHEMES = [
  { color: "#1D57A0", bgColor: "#E4F0FF" },
  { color: "#91850E", bgColor: "#FCF8CF" },
  { color: "#078C21", bgColor: "#CAE8D0" },
];

const getHabitColorScheme = (category, index = 0) =>
  HABIT_COLOR_SCHEMES[category] ||
  FALLBACK_COLOR_SCHEMES[index % FALLBACK_COLOR_SCHEMES.length];

// Parse "YYYY-MM-DD" (or "YYYY-MM-DD HH:MM:SS") as a *local* date at midnight.
// Avoids the timezone shift that `new Date("YYYY-MM-DD")` causes by treating
// the input as UTC.
const parseLocalDate = (raw) => {
  if (!raw) return null;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
};

export default function RightHandSidebar({ isOpen, onClose, selectedHabit, setSelectedHabit }) {
  const dispatch = useDispatch();
  const searchParams = useSearchParams();

  const { habitList, loading: listLoading } = useSelector(
    (state) => state.habitMonitoring
  );
  const {
    habit: detailHabit,
    data: detailData,
    loading: detailLoading,
    error: detailError,
  } = useSelector((state) => state.habitDetail);

  const habits = habitList || [];

  const profileId = searchParams.get("profile_id");
  const dieticianCookie = cookieManager.getJSON("dietician");
  const dietitianId =
    dieticianCookie?.dietitian_id ||
    dieticianCookie?.dietician_id ||
    dieticianCookie?.id ||
    "";

  const fetchHabit = (habit) => {
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

  const handleClose = () => {
    onClose();
  };

  const handleBackToList = () => {
    if (setSelectedHabit) {
      setSelectedHabit(null);
    }
    dispatch(clearHabitDetail());
  };

  /* ---------------- DETAIL VIEW DATA ---------------- */
  // Prefer fresh API data; fall back to the habit object from the list
  // (so we render something immediately while the detail call is in flight).
  const activeHabit = detailHabit || selectedHabit;
  const activeScheme = activeHabit
    ? getHabitColorScheme(activeHabit.category)
    : null;
  const activeColor = activeScheme?.color || "#1D57A0";
  const activeBgColor = activeScheme?.bgColor || "#E4F0FF";

  const weekTracking = activeHabit?.week_tracking || [];

  /* ---------------- CALENDAR LOCKED TO WEEK_TRACKING MONTH ---------------- */
  const calendarAnchor = useMemo(() => {
    const firstDateStr = weekTracking[0]?.date || detailData?.today;
    return parseLocalDate(firstDateStr) || new Date();
  }, [weekTracking, detailData?.today]);

  const currentMonth = calendarAnchor.getMonth();
  const currentYear = calendarAnchor.getFullYear();

  const monthTitle = calendarAnchor.toLocaleString("default", {
    month: "short",
    year: "numeric",
  });

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

  let startDay = firstDay.getDay(); // Sun=0
  startDay = startDay === 0 ? 6 : startDay - 1; // Mon=0

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= lastDate; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const rows = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    rows.push(calendarDays.slice(i, i + 7));
  }

  const todayDate = useMemo(
    () => parseLocalDate(detailData?.today),
    [detailData?.today]
  );

  // Split week_tracking entries (within the displayed month) into completed
  // vs. missed. "Missed" = past day with is_completed=false.
  const { completedDays, missedDays } = (() => {
    const completed = [];
    const missed = [];
    weekTracking.forEach((entry) => {
      const d = parseLocalDate(entry?.date);
      if (!d) return;
      if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return;

      const dayNum = d.getDate();
      if (entry.is_completed) {
        completed.push(dayNum);
      } else if (todayDate && d.getTime() < todayDate.getTime()) {
        missed.push(dayNum);
      }
    });
    return { completedDays: completed, missedDays: missed };
  })();

  const getDayState = (num) => {
    if (num === null) return "empty";
    const cellDate = new Date(currentYear, currentMonth, num);
    cellDate.setHours(0, 0, 0, 0);

    if (todayDate) {
      if (cellDate.getTime() > todayDate.getTime()) return "future";
      if (cellDate.getTime() === todayDate.getTime()) return "today";
    }
    if (completedDays.includes(num)) return "completed";
    if (missedDays.includes(num)) return "missed";
    return "past";
  };

  return (
    <>
      {isOpen && (
        <div
          className="absolute inset-0 z-40 rounded-[15px] bg-[#252525] opacity-80"
          onClick={handleClose}
        />
      )}

      <div
        className={`absolute top-0 right-0 h-full z-50 flex items-start gap-3 transition-all duration-300 ${isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
          }`}
      >
        <button
          type="button"
          onClick={handleClose}
          className="mt-4 cursor-pointer text-black bg-white border border-[#E1E6ED] rounded-full w-10 h-10 flex items-center justify-center shadow-sm hover:bg-gray-50 z-50"
        >
          ✕
        </button>

        <div className="flex flex-col h-full w-[450px] bg-white shadow-lg rounded-r-[15px] overflow-hidden pt-[26px]">
          <div className="flex gap-1.5 ml-[25px] mb-[29px] items-center">
            <IoIosArrowRoundBack
              onClick={handleBackToList}
              className="w-[33px] h-8 cursor-pointer"
            />

            <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
              {activeHabit
                ? activeHabit.title || activeHabit.habit_name
                : `All Habits (${habits.length})`}
            </span>
          </div>

          {!selectedHabit ? (
            <div className="group flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto group-hover-scrollbar">
                <div className="flex flex-col gap-[15px] px-[15px] pb-4">
                  {listLoading ? (
                    <div className="flex justify-center items-center py-10">
                      <p className="text-[#535359] text-[13px]">Loading habits...</p>
                    </div>
                  ) : habits.length === 0 ? (
                    <div className="flex justify-center items-center py-10">
                      <p className="text-[#535359] text-[13px]">No habits found</p>
                    </div>
                  ) : (
                    habits.map((habit, index) => {
                      const scheme = getHabitColorScheme(habit.category, index);
                      return (
                        <div
                          key={habit.selected_habit_id ?? index}
                          onClick={() => {
                            if (setSelectedHabit) {
                              setSelectedHabit(habit);
                            }
                            fetchHabit(habit);
                          }}
                          className="flex justify-between bg-[#F5F7FA] rounded-[12px] pl-5 pr-[22px] pt-[18px] pb-[23px] border-l-[12px] cursor-pointer"
                          style={{ borderLeftColor: scheme.color }}
                        >
                          <div className="flex flex-col gap-[5px]">
                            <p className="text-[#252525] text-[15px] font-normal leading-[110%] tracking-[-0.3px]">
                              {habit.title || habit.habit_name}
                            </p>

                            <p
                              className="text-[10px] font-normal leading-normal tracking-[-0.2px]"
                              style={{ color: scheme.color }}
                            >
                              {habit.frequency_type}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1.5 items-end">
                            <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
                              {habit.weekly_completion_rate ?? 0}%
                            </p>

                            <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                              {habit.frequency_type}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-[17px] px-[15px]">
              {detailLoading && !detailHabit ? (
                <div className="flex justify-center items-center py-10">
                  <p className="text-[#535359] text-[13px]">Loading habit details...</p>
                </div>
              ) : detailError && !detailHabit ? (
                <div className="flex justify-center items-center py-10">
                  <p className="text-[#DA5747] text-[13px]">{detailError}</p>
                </div>
              ) : activeHabit ? (
                <>
                  <div
                    className="flex flex-col gap-5 rounded-[12px] pl-5 pr-[22px] pt-[18px] pb-[23px]"
                    style={{
                      backgroundColor: "#F5F7FA",
                      borderLeft: `12px solid ${activeColor}`,
                    }}
                  >
                    <div className="flex flex-col gap-[5px]">
                      <p className="text-[#252525] text-[15px] font-normal leading-[110%] tracking-[-0.3px]">
                        {activeHabit.title || activeHabit.habit_name}
                      </p>

                      <p
                        className="text-[10px] font-normal leading-normal tracking-[-0.2px]"
                        style={{ color: activeColor }}
                      >
                        {activeHabit.frequency_type}
                      </p>
                    </div>

                    <div className="flex justify-between">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
                          {activeHabit.weekly_completion_rate ?? 0}%
                        </p>

                        <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                          Completion Rate
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
                          {activeHabit.completed_days ?? 0}
                        </p>

                        <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                          Completed Days
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
                          {activeHabit.total_days ?? 0}
                        </p>

                        <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                          Total Days
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CALENDAR LOCKED TO WEEK_TRACKING MONTH */}
                  <div>
                    <div className="flex justify-between items-center py-[15px] px-[12px]">
                      <span className="text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
                        {monthTitle}
                      </span>

                      <div className="flex gap-5 items-center mx-[27px]">
                        <IoChevronBackOutline className="w-6 h-6 text-[#C5CAD1]" />
                        <IoIosArrowForward className="w-6 h-6 text-[#C5CAD1]" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-[9px] mx-5">
                      <div className="grid grid-cols-7 gap-2.5 border-b border-[#E1E6ED] pb-1">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          (day, index) => (
                            <div
                              key={day}
                              className="flex justify-center px-3.5 py-1.5"
                            >
                              <span
                                className={`text-[10px] font-normal leading-normal tracking-[-0.2px] ${index === 6
                                    ? "text-[#DA5747]"
                                    : "text-[#252525]"
                                  }`}
                              >
                                {day}
                              </span>
                            </div>
                          )
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {rows.map((week, rowIndex) => (
                          <div key={rowIndex} className="grid grid-cols-7 gap-2.5">
                            {week.map((num, i) => {
                              const state = getDayState(num);

                              let cellStyle = {};
                              let cellBgClass = "";

                              if (state === "completed") {
                                cellStyle = { backgroundColor: activeBgColor };
                              } else if (state === "missed") {
                                cellStyle = {
                                  border: `1px solid ${activeColor}`,
                                  backgroundColor: "#FFFFFF",
                                };
                              } else if (state === "past") {
                                cellBgClass = "bg-[#E4F0FF]";
                              }

                              const textColor =
                                state === "future" ? "#A1A1A1" : "#252525";

                              return (
                                <div
                                  key={i}
                                  className={`h-[30px] flex items-center justify-center rounded-[25px] px-[7px] py-[5px] ${cellBgClass}`}
                                  style={cellStyle}
                                >
                                  {num !== null && (
                                    <span
                                      className="text-[10px] font-normal leading-normal tracking-[-0.2px]"
                                      style={{ color: textColor }}
                                    >
                                      {num}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
