

"use client";
import React, { useMemo, useState, useEffect } from "react";
import { IoChevronBackSharp } from "react-icons/io5";
import { IoIosArrowForward } from "react-icons/io";
import TestEvaluation from "./test-evaluation";
import Trends from "./trends";
import FoodEvaluation from "./food-evaluation";
import MealLogged from "./meal-logged";
import { useSelector } from "react-redux";
import Image from "next/image";
import NoPlans from "./no-plans";
import WeightTracker from "./weight-tracker";
import NoTestData from "./no-test-data";
import ClientReminder from "./client-reminder";
import { fetchScoresInsight } from "../services/authService";
import Cookies from "js-cookie";
import { useSearchParams } from "next/navigation";

// Utility function to pad single digit numbers
function pad2(n) {
  return n.toString().padStart(2, "0");
}

// Utility function to set time to start of day
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Utility function to add/subtract days
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Format date for API
function formatDateForApi(date) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ResultEvaluation = () => {
  const clientData = useSelector((state) => state.clientProfile.data);
  const scoresInsight = useSelector((state) => state.scoresInsight?.data);
  console.log("scoresInsight2424:-", scoresInsight);
  const isLoading = useSelector((state) => state.clientProfile.loading);

  const searchParams = useSearchParams();
  const profileIdFromUrl = searchParams.get("profile_id");

  const today = startOfDay(new Date());
  const VISIBLE_COUNT = 16;

  // 🔹 Extract Join Date from dttm (e.g., "2025-11-27")
  const joinDate = useMemo(() => {
    if (clientData?.dttm) {
      return startOfDay(new Date(clientData.dttm.split(" ")[0]));
    }
    return today;
  }, [clientData?.dttm, today]);

  // Plan Data Logic
  const hasActivePlan = clientData?.plans_summary?.active?.length > 0;
  const hasNotStartedPlan = clientData?.plans_summary?.not_started?.length > 0;
  const hasCompletedPlan = clientData?.plans_summary?.completed?.length > 0;
  const isNoPlan = !hasActivePlan && !hasNotStartedPlan && !hasCompletedPlan;

  const currentPlan = hasActivePlan 
    ? clientData?.plans_summary?.active[0] 
    : hasNotStartedPlan 
    ? clientData?.plans_summary?.not_started[0] 
    : clientData?.plans_summary?.completed[0];

  const planStartDate = currentPlan ? startOfDay(new Date(currentPlan.plan_start_date)) : null;
  // const planEndDate = currentPlan ? startOfDay(new Date(currentPlan.plan_end_date)) : null;
  // console.log("planEndDate2456:-", planEndDate);

  const planEndDate = null;

  // 🔹 Logic to Center Today in the 16-day window

  const getInitialWindowStart = () => {
    // Center Today (offset by ~7 days)
    const middleOffset = Math.floor(VISIBLE_COUNT / 2);
    let idealStart = addDays(today, -middleOffset);

    // Floor the window at the joinDate
    if (idealStart < joinDate) return joinDate;

    // If there is an end date (completed plan), don't overflow past it
    if (planEndDate && today > planEndDate) {
        return addDays(planEndDate, 1 - VISIBLE_COUNT);
    }

    return idealStart;
  };




  const getInitialSelectedDate = () => {
    if (planEndDate && today > planEndDate) return planEndDate;
    if (planStartDate && today < planStartDate) return planStartDate;
    return today;
  };

  const [selectedDate, setSelectedDate] = useState(() => getInitialSelectedDate());
  const [windowStart, setWindowStart] = useState(() => getInitialWindowStart());
  const [scoresInsightResponse, setScoresInsightResponse] = useState(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  const isNoInsightData = scoresInsightResponse?.noData === true;

  // Sync state if clientData loads late
  useEffect(() => {
    if (clientData) {
      setWindowStart(getInitialWindowStart());
      setSelectedDate(getInitialSelectedDate());
    }
  }, [clientData]);

  // API Fetch Effect
  useEffect(() => {
    const dieticianCookie = Cookies.get("dietician");
    let dieticianId = null;
    if (dieticianCookie) {
      try {
        dieticianId = JSON.parse(dieticianCookie).dietician_id;
      } catch (e) { console.error(e); }
    }

    if (!dieticianId || !profileIdFromUrl || !selectedDate) return;

    setIsInsightLoading(true);
    fetchScoresInsight(dieticianId, profileIdFromUrl, formatDateForApi(selectedDate))
      .then((res) => setScoresInsightResponse(res))
      .catch((err) => {
        console.error(err);
        setScoresInsightResponse(null);
      })
      .finally(() => setIsInsightLoading(false));
  }, [profileIdFromUrl, selectedDate]);

  // Calendar dates generation
  const dates = useMemo(() => {
    return Array.from({ length: VISIBLE_COUNT }, (_, i) => {
      const d = startOfDay(addDays(windowStart, i));
      return { date: d, day: pad2(d.getDate()), week: WEEK[d.getDay()] };
    });
  }, [windowStart]);

  // Navigation Logic
  const canGoPrevFinal = startOfDay(windowStart) > joinDate;
  const canGoNextFinal = startOfDay(addDays(windowStart, VISIBLE_COUNT - 1)) < (planEndDate || today);

  const handlePrevClick = () => {
    if (!canGoPrevFinal) return;
    const nextStart = addDays(windowStart, -VISIBLE_COUNT);
    setWindowStart(nextStart < joinDate ? joinDate : nextStart);
  };

  const handleNextClick = () => {
    if (!canGoNextFinal) return;
    const nextStart = addDays(windowStart, VISIBLE_COUNT);
    const limit = planEndDate || today;
    if (addDays(nextStart, VISIBLE_COUNT - 1) > limit) {
      setWindowStart(addDays(limit, 1 - VISIBLE_COUNT));
    } else {
      setWindowStart(nextStart);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  if (isLoading || !clientData) {
    return (
      <div className="w-full bg-white px-[15px] py-[30px] rounded-[15px]">
        <div className="text-center py-10"><p className="text-[#535359] text-[18px]">Loading...</p></div>
      </div>
    );
  }

  // Common Date Row Component to maintain UI consistency
  const RenderDateRow = () => (
    <div className="flex items-center justify-between">
      <IoChevronBackSharp
        className={["w-[52px] h-[52px] py-[13px] pl-2.5", canGoPrevFinal ? "cursor-pointer" : "opacity-40 cursor-not-allowed"].join(" ")}
        onClick={handlePrevClick}
      />
      {dates.map((item, idx) => {
        const isSelected = startOfDay(item.date).getTime() === startOfDay(selectedDate).getTime();
        const isToday = startOfDay(item.date).getTime() === today.getTime();
        const isFuture = item.date > today;
        const isBeforeJoin = item.date < joinDate;
        const isSelectable = !isFuture && !isBeforeJoin;

        return (
          <div
            key={idx}
            onClick={() => isSelectable && setSelectedDate(item.date)}
            className={[
              "flex flex-col px-[7px] py-2 gap-1 rounded-[12px] select-none",
              isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
              isSelected ? "bg-[#308BF9] text-white" : "text-[#535359]",
            ].join(" ")}
          >
            <span className="text-center text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">{item.day}</span>
            <span className="text-center text-[10px] font-normal leading-normal tracking-[-0.2px]">{item.week}</span>
            {isToday && !isSelected && <span className="mx-auto mt-[2px] w-[4px] h-[4px] rounded-full bg-[#308BF9]" />}
          </div>
        );
      })}
      <IoIosArrowForward
        className={["w-[52px] h-[52px] py-[13px] pl-2.5", canGoNextFinal ? "cursor-pointer" : "opacity-40 cursor-not-allowed"].join(" ")}
        onClick={handleNextClick}
      />
    </div>
  );

  // View: Plan Not Started
  if (hasNotStartedPlan && !hasActivePlan) {
    return (
      <div className="w-full bg-white px-[15px] py-[30px] rounded-[15px]">
        <div className="flex justify-start ml-[15px]"><p className="text-[#252525] text-[25px] font-semibold">Result Evaluation</p></div>
        <div className="my-[20px] border border-[#E1E6ED]"></div>
        <div className="text-center py-10">
          <p className="text-[#535359] text-[18px] font-semibold">Plan Will Start On</p>
          <p className="text-[#308BF9] text-[20px] font-bold">{formatDate(currentPlan.plan_start_date)}</p>
        </div>
      </div>
    );
  }

  // View: Active / Completed / No Plan
  return (
    <div className="w-full bg-white px-[15px] py-[30px] rounded-[15px]">
      <div className="flex justify-start ml-[15px]">
        <p className="text-[#252525] text-center text-[25px] font-semibold leading-normal tracking-[-1px]">Result Evaluation</p>
      </div>
      <div className="my-[20px] border border-[#E1E6ED]"></div>

      <div className="flex flex-col gap-[20px]">
        <div className="ml-4">
          <span className="text-[#535359] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">Select a date</span>
        </div>

        <RenderDateRow />

        <div className="my-[20px] border border-[#E1E6ED]"></div>

        {isInsightLoading ? (
          <div className="w-full py-6 text-center"><p className="text-[#535359] text-[16px]">Loading test data...</p></div>
        ) : isNoInsightData ? (
          <ClientReminder selectedDate={selectedDate} isInsightLoading={isInsightLoading} />
        ) : (
          <TestEvaluation />
        )}
      </div>

      <div className="flex flex-col gap-[50px]">
        {!isInsightLoading && !isNoInsightData && (
          <>
            <Trends selectedDate={selectedDate} />
            {/* <FoodEvaluation /> */}
          </>
        )}
        <MealLogged />
      </div>
    </div>
  );
};