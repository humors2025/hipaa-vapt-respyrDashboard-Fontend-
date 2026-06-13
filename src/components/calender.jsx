"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { fetchCalendarData } from "../services/authService";
import { cookieManager } from "../lib/cookies";
import { useDispatch, useSelector  } from "react-redux";
import { setSelectedDate } from "../store/dateSlice";
import { MdArrowBackIosNew } from "react-icons/md";
import { MdArrowForwardIos } from "react-icons/md";

export default function Calender() {
   const today = new Date();
   const dispatch = useDispatch();
const selectedDate = useSelector((state) => state.date.selectedDate);
const summary = useSelector((state) => state.clients.summary);

  const [calendarMonth, setCalendarMonth] = useState(() => ({
    year: today.getFullYear(),
    monthIndex: today.getMonth(),
  }));

  const { year: currentYear, monthIndex: currentMonthIndex } = calendarMonth;

  // ✅ NEW: MIN & MAX MONTH STATE
  const [minMonth, setMinMonth] = useState(null);
  const [maxMonth, setMaxMonth] = useState(null);

  // ✅ SELECTED DATE STATE
  // const [selectedDate, setSelectedDate] = useState(() => {
  //   return {
  //     year: today.getFullYear(),
  //     month: today.getMonth() + 1,
  //     day: today.getDate()
  //   };
  // });


  const [testsByDay, setTestsByDay] = useState({});

  const monthLabel = useMemo(() => {
    const date = new Date(currentYear, currentMonthIndex, 1);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  }, [currentYear, currentMonthIndex]);

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = async () => {
    try {
      const dietician = cookieManager.getJSON("dietician");
      const dieticianId = dietician?.dietician_id;

      if (!dieticianId) return;

      const res = await fetchCalendarData(dieticianId);

      if (res?.status && res?.data) {
        const mapped = {};

        // ✅ NEW: track min & max
        let minDate = null;
        let maxDate = null;

        res.data.forEach((item) => {
          const date = new Date(item.test_date);

          if (!minDate || date < minDate) minDate = date;
          if (!maxDate || date > maxDate) maxDate = date;

          const year = date.getFullYear();
          const month = date.getMonth();
          const day = date.getDate();

          const key = `${year}-${month}`;

          if (!mapped[key]) mapped[key] = {};
          mapped[key][day] = Number(item.total_tests) || 0;
        });

        setTestsByDay(mapped);

        // ✅ SET LIMITS
        if (minDate && maxDate) {
          setMinMonth({
            year: minDate.getFullYear(),
            monthIndex: minDate.getMonth(),
          });

          setMaxMonth({
            year: maxDate.getFullYear(),
            monthIndex: maxDate.getMonth(),
          });
        }
      }
    } catch (e) {
      console.error("Calendar API error:", e);
    }
  };

  const handleDateSelect = (dayNumber) => {
    dispatch(setSelectedDate({
    year: currentYear,
    month: currentMonthIndex + 1,
    day: dayNumber
  }));
  };

  const isDateSelected = (dayNumber) => {
    return (
      selectedDate.year === currentYear &&
      selectedDate.month === currentMonthIndex + 1 &&
      selectedDate.day === dayNumber
    );
  };

  const daysInMonth = useMemo(
    () => new Date(currentYear, currentMonthIndex + 1, 0).getDate(),
    [currentYear, currentMonthIndex]
  );

  const firstDayOfMonth = useMemo(
    () => new Date(currentYear, currentMonthIndex, 1).getDay(),
    [currentYear, currentMonthIndex]
  );

  const mondayStartOffset = useMemo(
    () => (firstDayOfMonth + 6) % 7,
    [firstDayOfMonth]
  );

  const calendarWeeks = useMemo(() => {
    const calendarCells = [];

    for (let i = 0; i < mondayStartOffset; i++) {
      calendarCells.push({ type: "blank" });
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      calendarCells.push({ type: "day", day: dayNumber });
    }

    const weeks = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      weeks.push(calendarCells.slice(i, i + 7));
    }

    const lastWeek = weeks[weeks.length - 1] || [];
    while (lastWeek.length < 7) lastWeek.push({ type: "blank" });

    while (weeks.length < 6) {
      weeks.push(Array.from({ length: 7 }, () => ({ type: "blank" })));
    }

    return weeks;
  }, [mondayStartOffset, daysInMonth]);

  const totalTestsRecorded = useMemo(() => {
    const monthKey = `${currentYear}-${currentMonthIndex}`;
    const currentMonthData = testsByDay?.[monthKey] || {};

    return Object.values(currentMonthData).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
  }, [testsByDay, currentYear, currentMonthIndex]);

  // ✅ UPDATED: NEXT MONTH WITH LIMIT
  const goToNextMonth = () => {
    if (!maxMonth) return;

    const isAtMax =
      currentYear === maxMonth.year &&
      currentMonthIndex === maxMonth.monthIndex;

    if (isAtMax) return;

    setCalendarMonth((prev) => {
      const isDecember = prev.monthIndex === 11;
      return {
        year: isDecember ? prev.year + 1 : prev.year,
        monthIndex: isDecember ? 0 : prev.monthIndex + 1,
      };
    });
  };

  // ✅ UPDATED: PREVIOUS MONTH WITH LIMIT
  const goToPreviousMonth = () => {
    if (!minMonth) return;

    const isAtMin =
      currentYear === minMonth.year &&
      currentMonthIndex === minMonth.monthIndex;

    if (isAtMin) return;

    setCalendarMonth((prev) => {
      const isJanuary = prev.monthIndex === 0;
      return {
        year: isJanuary ? prev.year - 1 : prev.year,
        monthIndex: isJanuary ? 11 : prev.monthIndex - 1,
      };
    });
  };

  const isScrollLockedRef = useRef(false);

  const handleCalendarScroll = (event) => {
    if (isScrollLockedRef.current) return;

    const scrollDelta = event.deltaY;
    const SCROLL_THRESHOLD = 60;

    if (Math.abs(scrollDelta) < SCROLL_THRESHOLD) return;

    isScrollLockedRef.current = true;

    if (scrollDelta > 0) {
      goToNextMonth();
    } else {
      goToPreviousMonth();
    }

    setTimeout(() => {
      isScrollLockedRef.current = false;
    }, 350);
  };

  const getMonthName = (monthNumber) => {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString('en-US', { month: 'long' });
  };


  return (
    <>
      {/* Card */}
      <div className="w-[385px] rounded-[15px] border border-[#E1E6ED] bg-[#F5F7FA] px-2.5 pt-2.5">
        {/* <div className="flex flex-col gap-1 bg-[#DBDFE5] rounded-[15px]">
          <div className="flex justify-between py-5 pl-[18px] pr-14">
            <div className="flex flex-col gap-1.5">
              <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
              {summary.all_total}
              </p>
              <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-normal-[-0.2px]">
                Total Clients
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
                2000/10000
              </p>
              <div className="flex gap-1.5">
                <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-normal-[-0.2px]">
                  Test Usage
                </p>
                <p className="text-[#308BF9] text-[10px] font-normal leading-normal tracking-normal-[-0.2px] underline cursor-pointer">
                  Know more
                </p>
              </div>
            </div>
          </div>
        </div> */}

        <div className="mt-2.5 pl-2 pr-0 flex flex-col gap-5">
          <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <p className="text-[#252525] text-[34px] font-normal leading-normal tracking-[-2.04px]">
              {monthLabel}
            </p>
            <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
              {totalTestsRecorded} Tests Recorded
            </p>
          </div>

<div className="flex gap-5 items-start mr-5 pt-2">
 <MdArrowBackIosNew  
 className="w-[24px] h-[24px] cursor-pointer text-[#738298]"
 onClick={goToPreviousMonth}
 />
  <MdArrowForwardIos  
  className="w-[24px] h-[24px] cursor-pointer text-[#738298]"
    onClick={goToNextMonth}
  />
</div>
</div>

          <div className="flex flex-col gap-2.5 pt-2.5 overflow-y-scroll custom-scrollbar">
            {/* Week header */}
            <div className="grid grid-cols-7 border-b scroll-hide border-[#E1E6ED] pb-2 hide-s">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (dayLabel, dayIndex) => (
                  <div
                    key={dayLabel}
                    className="flex items-center justify-center"
                  >
                    <p
                      className={`text-[10px] font-normal tracking-[-0.2px] ${
                        dayIndex === 6 ? "text-[#DA5747]" : "text-[#252525]"
                      }`}
                    >
                      {dayLabel}
                    </p>
                  </div>
                )
              )}
            </div>

            <div
              className="flex flex-col"
              onWheel={handleCalendarScroll}
              style={{
                height: "500px",
                scrollbarGutter: "stable",
              }}
            >
              {calendarWeeks.map((week, weekIndex) => (
                <div
                  key={weekIndex}
                  className={`grid grid-cols-7 ${
                    weekIndex !== calendarWeeks.length - 1
                      ? "border-b border-[#E1E6ED]"
                      : ""
                  }`}
                >
                  {week.map((cell, dayIndex) => {
                    if (cell.type === "blank") {
                      return (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className="min-h-[90px] px-2 py-2"
                        />
                      );
                    }

                    const dayNumber = cell.day;
                    const selected = isDateSelected(dayNumber);
                    const isSunday = dayIndex === 6;

                    // Get tests count for this day (using 0-indexed month key)
                    const monthKey = `${currentYear}-${currentMonthIndex}`;
                    const currentMonthData =
                      testsByDay?.[monthKey] || {};

                    const testsCount =
                      currentMonthData[dayNumber] ?? null;

                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        onClick={() => handleDateSelect(dayNumber)}
                        className={`min-h-[90px] px-2 py-2 flex flex-col items-center justify-start gap-1 cursor-pointer transition-colors duration-200 ${
                          selected ? 'bg-[#308BF9] rounded-[8px]' : ''
                        }`}
                      >
                        <p
                          className={`text-[10px] font-normal tracking-[-0.2px] ${
                            isSunday && !selected ? "text-[#DA5747]" : 
                            selected ? "text-white" : "text-[#252525]"
                          }`}
                        >
                          {dayNumber}
                        </p>

                        {testsCount ? (
                          <div className="mt-2 flex flex-col items-center">
                            <p
                              className={`text-[11px] font-medium ${
                                isSunday && !selected ? "text-[#DA5747]" : 
                                selected ? "text-white" : "text-[#252525]"
                              }`}
                            >
                              {testsCount}
                            </p>
                            <p
                              className={`text-[10px] font-normal ${
                                isSunday && !selected ? "text-[#DA5747]" : 
                                selected ? "text-white" : "text-[#252525]"
                              }`}
                            >
                              tests
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2 h-[28px]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}



// "use client";

// import { useMemo, useRef, useState } from "react";

// export default function Calender() {
//   const today = new Date();

//   const [calendarMonth, setCalendarMonth] = useState(() => ({
//     year: today.getFullYear(),
//     monthIndex: today.getMonth(),
//   }));

//   const { year: currentYear, monthIndex: currentMonthIndex } = calendarMonth;

//   const monthLabel = useMemo(() => {
//     const date = new Date(currentYear, currentMonthIndex, 1);
//     return date.toLocaleString("en-US", { month: "short", year: "numeric" });
//   }, [currentYear, currentMonthIndex]);

//   const testsByDay = useMemo(
//     () => ({
//       1: 200,
//       2: 200,
//       3: 200,
//       4: 200,
//       5: 200,
//       6: 200,
//       7: 200,
//       9: 200,
//       11: 20012,
//       14: 200,
//       20: 200,
//       22: 200,
//       24: 1200,
//       29: 14200,
//       30: 1200,
//       31: 14500,
//     }),
//     []
//   );

//   const daysInMonth = useMemo(
//     () => new Date(currentYear, currentMonthIndex + 1, 0).getDate(),
//     [currentYear, currentMonthIndex]
//   );

//   const firstDayOfMonth = useMemo(
//     () => new Date(currentYear, currentMonthIndex, 1).getDay(),
//     [currentYear, currentMonthIndex]
//   );

//   const mondayStartOffset = useMemo(
//     () => (firstDayOfMonth + 6) % 7,
//     [firstDayOfMonth]
//   );

//   const calendarWeeks = useMemo(() => {
//     const calendarCells = [];

//     for (let i = 0; i < mondayStartOffset; i++) {
//       calendarCells.push({ type: "blank" });
//     }

//     for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
//       calendarCells.push({ type: "day", day: dayNumber });
//     }

//     const weeks = [];
//     for (let i = 0; i < calendarCells.length; i += 7) {
//       weeks.push(calendarCells.slice(i, i + 7));
//     }

//     const lastWeek = weeks[weeks.length - 1] || [];
//     while (lastWeek.length < 7) lastWeek.push({ type: "blank" });

//     while (weeks.length < 6) {
//       weeks.push(Array.from({ length: 7 }, () => ({ type: "blank" })));
//     }

//     return weeks;
//   }, [mondayStartOffset, daysInMonth]);

//   const totalTestsRecorded = useMemo(() => {
//     return Object.values(testsByDay).reduce(
//       (sum, value) => sum + (Number(value) || 0),
//       0
//     );
//   }, [testsByDay]);

//   const goToNextMonth = () => {
//     setCalendarMonth((prev) => {
//       const isDecember = prev.monthIndex === 11;
//       return {
//         year: isDecember ? prev.year + 1 : prev.year,
//         monthIndex: isDecember ? 0 : prev.monthIndex + 1,
//       };
//     });
//   };

//   const goToPreviousMonth = () => {
//     setCalendarMonth((prev) => {
//       const isJanuary = prev.monthIndex === 0;
//       return {
//         year: isJanuary ? prev.year - 1 : prev.year,
//         monthIndex: isJanuary ? 11 : prev.monthIndex - 1,
//       };
//     });
//   };

//   const isScrollLockedRef = useRef(false);

//   const handleCalendarScroll = (event) => {
//     if (isScrollLockedRef.current) return;

//     const scrollDelta = event.deltaY;
//     const SCROLL_THRESHOLD = 60;

//     if (Math.abs(scrollDelta) < SCROLL_THRESHOLD) return;

//     isScrollLockedRef.current = true;

//     if (scrollDelta > 0) goToNextMonth();
//     else goToPreviousMonth();

//     setTimeout(() => {
//       isScrollLockedRef.current = false;
//     }, 350);
//   };

//   return (
//     <>
//       {/* Card */}
//       <div className="w-full max-w-[400px] rounded-[15px] border border-[#E1E6ED] bg-[#F5F7FA] px-2.5 pt-2.5">
//         <div className="flex flex-col gap-1 bg-[#DBDFE5] rounded-[15px]">
//           <div className="flex justify-between py-5 pl-[18px] pr-14">
//             <div className="flex flex-col gap-1.5">
//               <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
//                 450
//               </p>
//               <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-normal-[-0.2px]">
//                 Total Clients
//               </p>
//             </div>

//             <div className="flex flex-col gap-1.5">
//               <p className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
//                 2000/10000
//               </p>
//               <div className="flex gap-1.5">
//                 <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-normal-[-0.2px]">
//                   Test Usage
//                 </p>
//                 <p className="text-[#308BF9] text-[10px] font-normal leading-normal tracking-normal-[-0.2px] underline cursor-pointer">
//                   Know more
//                 </p>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="mt-2.5 pl-2 pr-0 flex flex-col gap-5">
//           <div className="flex flex-col gap-1">
//             <p className="text-[#252525] text-[34px] font-normal leading-normal tracking-[-2.04px]">
//               {monthLabel}
//             </p>
//             <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
//               {totalTestsRecorded} Tests Recorded
//             </p>
//           </div>

//           <div className="flex flex-col gap-2.5 pt-2.5 overflow-y-scroll custom-scrollbar">
//             {/* Week header */}
//             <div className="grid grid-cols-7 border-b scroll-hide border-[#E1E6ED] pb-2 hide-s">
//               {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
//                 (dayLabel, dayIndex) => (
//                   <div
//                     key={dayLabel}
//                     className="flex items-center justify-center"
//                   >
//                     <p
//                       className={`text-[10px] font-normal tracking-[-0.2px] ${
//                         dayIndex === 6 ? "text-[#DA5747]" : "text-[#252525]"
//                       }`}
//                     >
//                       {dayLabel}
//                     </p>
//                   </div>
//                 )
//               )}
//             </div>

//             {/* ✅ Only change: added "custom-scrollbar" class here */}
//             <div
//               className="flex flex-col  f"
//               onWheel={handleCalendarScroll}
//               style={{
//                 height: "500px",
//                 // overscrollBehavior: "contain",
//                 // overflowX: "hidden",
//                 scrollbarGutter: "stable",
//               }}
//             >
//               {calendarWeeks.map((week, weekIndex) => (
//                 <div
//                   key={weekIndex}
//                   className={`grid grid-cols-7 ${
//                     weekIndex !== calendarWeeks.length - 1
//                       ? "border-b border-[#E1E6ED]"
//                       : ""
//                   }`}
//                 >
//                   {week.map((cell, dayIndex) => {
//                     if (cell.type === "blank") {
//                       return (
//                         <div
//                           key={`${weekIndex}-${dayIndex}`}
//                           className="min-h-[90px] px-2 py-2"
//                         />
//                       );
//                     }

//                     const dayNumber = cell.day;
//                     const testsCount = testsByDay[dayNumber] ?? null;
//                     const isSunday = dayIndex === 6;

//                     return (
//                       <div
//                         key={`${weekIndex}-${dayIndex}`}
//                         className="min-h-[90px] px-2 py-2 flex flex-col items-center justify-start gap-1"
//                       >
//                         <p
//                           className={`text-[10px] font-normal tracking-[-0.2px] ${
//                             isSunday ? "text-[#DA5747]" : "text-[#252525]"
//                           }`}
//                         >
//                           {dayNumber}
//                         </p>

//                         {testsCount ? (
//                           <div className="mt-2 flex flex-col items-center">
//                             <p
//                               className={`text-[11px] font-medium ${
//                                 isSunday ? "text-[#DA5747]" : "text-[#252525]"
//                               }`}
//                             >
//                               {testsCount}
//                             </p>
//                             <p
//                               className={`text-[10px] font-normal ${
//                                 isSunday ? "text-[#DA5747]" : "text-[#252525]"
//                               }`}
//                             >
//                               tests
//                             </p>
//                           </div>
//                         ) : (
//                           <div className="mt-2 h-[28px]" />
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }
