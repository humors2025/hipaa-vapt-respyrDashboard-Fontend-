"use client";

import React, { useEffect, useMemo, useState } from "react";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { useSelector } from "react-redux";
import { fetchWeeklyAnalysisComplete1, fetchSavedWeeklyFoodJson } from "../services/authService";
import { checkWeeklyAnalysisService } from "../services/authService";
import CreatePlanPopUp from "./pop-folder/create-plan-popup";
import MealSidebar from "./meal-sidebar";
import MealTracked from "./meal-tracked";

export default function MealLogged() {
  const [activeFilter, setActiveFilter] = useState("low");

  const [weeklyAnalysisData, setWeeklyAnalysisData] = useState([]);

  const [apiMessage, setApiMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedFoodsTotal, setSavedFoodsTotal] = useState(0);
  // ✅ FIXED: Initialize with 0
  const [visibleWeekStart, setVisibleWeekStart] = useState(0);

  const [selectedWeekIdx, setSelectedWeekIdx] = useState(null);

  // ✅ this is the ONLY thing we need from popup
  const [daysPayload, setDaysPayload] = useState({});

  const clientProfile = useSelector((state) => state.clientProfile.data);
  const visibleWeeksCount = 4;

  const handleFilterChange = (filter) => setActiveFilter(filter);

  // Fixed date utility functions with UTC handling
  const toLocalMidnight = (dateStr) => {
    if (!dateStr) return new Date();
    const [y, m, d] = String(dateStr).split("-").map(Number);
    // Create date in UTC to avoid timezone issues
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  };

  const startOfDay = (d) => {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  };

  const endOfDay = (d) => {
    const date = new Date(d);
    date.setUTCHours(23, 59, 59, 999);
    return date;
  };

  const formatDateForApi = (d) => {
    // Always use UTC for API dates
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const withStartOfDayTime = (dateStr) => {
    return `${dateStr} 00:00:00`;
  };

  const withCurrentTime = (dateStr) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${dateStr} ${hh}:${mm}:${ss}`;
  };

  const fmt = (d) => {
    // Format for display using UTC
    const year = d.getUTCFullYear();
    const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${day} ${month} ${year}`;
  };

  const dataArr = Array.isArray(weeklyAnalysisData) ? weeklyAnalysisData : [];
  console.log("dataArr85:-", dataArr);
  const totalFoods = dataArr.length;

  const avgScore = totalFoods
    ? Math.round(
        dataArr.reduce((sum, item) => sum + (Number(item.metabolic_compatibility_score) || 0), 0) / totalFoods
      )
    : 0;

  const zone = avgScore >= 80 ? "High" : avgScore >= 61 ? "Moderate" : "Low";

  const goalCounts = useMemo(() => {
    return dataArr.reduce((acc, item) => {
      const key = item.goal_alignment || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [dataArr]);

  const { weeks, currentWeekIdx } = useMemo(() => {
    const result = { weeks: [], currentWeekIdx: 0 };

    const dttm = clientProfile?.dttm;
    if (!dttm) return result;

    // Parse the date string in UTC
    const datePart = dttm.split(" ")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    const planStartDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const planStart = startOfDay(planStartDate);

    const today = startOfDay(new Date());
    const durationDays = Math.ceil((today - planStart) / (1000 * 60 * 60 * 24)) + 1;
    const numberOfWeeks = Math.ceil(durationDays / 7);

    const list = [];
    for (let i = 0; i < numberOfWeeks; i++) {
      const start = new Date(planStart);
      start.setUTCDate(planStart.getUTCDate() + i * 7);

      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);

      list.push({
        label: `Week ${i + 1}`,
        startDate: startOfDay(start),
        endDate: endOfDay(end),
      });
    }

    let idx = list.findIndex((w) => today >= w.startDate && today <= w.endDate);
    if (idx === -1) idx = 0;

    result.weeks = list;
    result.currentWeekIdx = idx;
    return result;
  }, [clientProfile]);

  // ✅ ADD THIS: Update visibleWeekStart when weeks is ready
  useEffect(() => {
    if (weeks?.length > 0 && currentWeekIdx !== null) {
      const middlePosition = 2;
      const idealStart = Math.max(0, currentWeekIdx - middlePosition);
      const maxStart = Math.max(0, weeks.length - visibleWeeksCount);
      const newStart = Math.min(idealStart, maxStart);
  
      setVisibleWeekStart(newStart);
    }

  }, [weeks, currentWeekIdx, visibleWeeksCount]);
  

  const getWeekDateRange = (weekIdx) => {
    const w = weeks?.[weekIdx];
    if (!w) return null;
    return { start: w.startDate, end: w.endDate };
  };

  const formatDisplayDate = (date) => {
    // Format: "24 January 2026 9:00 PM"
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    
    return `${day} ${month} ${year} ${formattedHours}:${minutes} ${ampm}`;
  };


  const MSG_NO_WEEKLY_FULL = "No weekly analysis found. Please add food to generate analysis.";
const MSG_NO_WEEKLY_SHORT = "No weekly analysis found.";
const MSG_WEEKLY_ANALYSIS_TIMEOUT =
  "We are unable to process your weekly analysis right now.\nPlease try again in a few moments.";





// const fetchWeeklyAnalysis = async (startDate, endDate, dietPlanId, days) => {
//   setLoading(true);
//   setError(null);
//   setErrorType(null);
//   setApiMessage(null);

//   try {
//     // 🔹 STEP 1: CHECK WEEKLY ANALYSIS
//     const checkResponse = await checkWeeklyAnalysisService(
//       clientProfile?.dietician_id,
//       clientProfile?.profile_id,
//       withStartOfDayTime(startDate),
//       withCurrentTime(endDate)
//     );
    
//     // ✅ CHECK FOR SPECIFIC API RESPONSE: "No record found for the given date range"
//     if (checkResponse?.status === false && 
//         checkResponse?.message === "No record found for the given date range") {
//       setWeeklyAnalysisData([]);
//       // Get the week range for display
//       const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
//       const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      
//       const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
//       const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));
      
//       setApiMessage({ 
//         message: `No data available for ${fmt(startDateObj)} and ${fmt(endDateObj)}` 
//       });
//       setLoading(false);
//       return;
//     }

//     // ✅ CHECK FOR FOOD_LEVEL_EVALUATION IN DATA_JSON
//     if (checkResponse?.status === true && 
//         checkResponse?.data_json?.food_level_evaluation) {
//       console.log("Using existing analysis data from check API");
//       setWeeklyAnalysisData(checkResponse.data_json.food_level_evaluation);
//       setApiMessage(null);
//       setLoading(false);
//       return;
//     }

//     // If we get here, there's no analysis data in checkResponse
//     // Parse end date string to Date object (treat as UTC, then convert to local)
//     const [year, month, day] = endDate.split('-').map(Number);
//     const endDateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    
//     // Get today's date at midnight (local time)
//     const today = new Date();
//     const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
//     // Check if this is the current week (end date is today or in the future)
//     const isCurrentWeek = endDateObj >= todayMidnight;
    
//     // Only proceed to fetchWeeklyAnalysisComplete1 if we have days data
//     if (days && Object.keys(days).length > 0) {
//       console.log("Raw days object:", days);
//   console.log("Type of days:", typeof days);
//   console.log("Is array?", Array.isArray(days));
//       // FIX: Format the days parameter correctly for the API
//       // The API expects days to be an array of objects with day_no and items
//       // const daysArray = Object.entries(days).map(([dayIndex, items]) => ({
//       //   day_no: parseInt(dayIndex) + 1,
//       //   items: items
//       // }));


//       let daysArray = [];

// if (Array.isArray(days)) {
//   // already like: [{day_no: 1, items: [...]}, ...]
//   daysArray = days
//     .filter(d => d && Array.isArray(d.items) && d.items.length > 0)
//     .map(d => ({ day_no: Number(d.day_no), items: d.items }));
// } else {
//   // object like: {0: ["dosa"], 1: ["idli"]} (if ever used)
//   daysArray = Object.entries(days)
//     .map(([dayIndex, items]) => ({
//       day_no: Number(dayIndex) + 1,
//       items: Array.isArray(items) ? items : [],
//     }))
//     .filter(d => d.items.length > 0);
// }

// if (daysArray.length === 0) {
//   setWeeklyAnalysisData([]);
//   setApiMessage({ message: "Please add food to generate analysis." });
//   setLoading(false);
//   return;
// }

//        console.log("Formatted daysArray442:", daysArray);

//       // const requestBody = {
//       //   dietician_id: clientProfile?.dietician_id,
//       //   profile_id: clientProfile?.profile_id,
//       //   start_date: startDate,
//       //   end_date: endDate,
//       //   ...(dietPlanId && { diet_plan_id: dietPlanId }),
//       //   days: daysArray, // Send as array, not object
//       // };



//       // ✅ normalize days safely
// const normalizedDays = (Array.isArray(daysArray) ? daysArray : [])
//   .map(d => ({
//     day_no: Number(d.day_no),
//     items: Array.isArray(d.items) ? d.items : [],
//   }))
//   .filter(d => d.day_no >= 1 && d.day_no <= 7 && d.items.length > 0);

// console.log("normalizedDays463:", normalizedDays);

// // ✅ new request body (PHP compatible)
// const requestBody = {
//   // send both spellings (backend will use whichever it expects)
//   dietician_id: clientProfile?.dietician_id,
//   dietitian_id: clientProfile?.dietician_id,

//   profile_id: clientProfile?.profile_id,
//   start_date: startDate,
//   end_date: endDate,
//   ...(dietPlanId && { diet_plan_id: dietPlanId }),

//   // send in multiple formats (covers PHP $_POST + json_decode cases)
//   days: normalizedDays,
//   days_json: JSON.stringify(normalizedDays),
//   food_json: JSON.stringify({ days: normalizedDays }),
// };

// console.log("Sending request to weekly_analysis_complete1:482", requestBody);



//       const response = await fetchWeeklyAnalysisComplete1(requestBody);

//       // ✅ CHECK FOR SPECIFIC API RESPONSE IN SECOND API CALL TOO
//       if (response?.status === false && 
//           response?.message === "No record found for the given date range") {
//         const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
//         const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
//         const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
//         const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));
        
//         setWeeklyAnalysisData([]);
//         setApiMessage({ 
//           message: `No data available for ${fmt(startDateObj)} and ${fmt(endDateObj)}` 
//         });
//         return;
//       }

//       // ✅ CHECK IF RESPONSE HAS FOOD_LEVEL_EVALUATION IN API_RESPONSE
//       if (response?.api_response?.food_level_evaluation) {
//         setWeeklyAnalysisData(response.api_response.food_level_evaluation);
//         setApiMessage(null);
//       } 
//       // ✅ CUSTOM MESSAGE HANDLING
//       else if (response?.message?.includes("Latest test data is older than 72 hours")) {
//         setWeeklyAnalysisData([]);
//         setApiMessage({
//           message: "No test taken in last 72 hrs, so weekly analysis will not be available.",
//         });
//       }
//       else if (response?.message) {
//         setWeeklyAnalysisData([]);
//         setApiMessage({ message: response.message });
//       } else {
//         setWeeklyAnalysisData([]);
//         setApiMessage({ 
//           message: "No food data available for this week." 
//         });
//       }
//     } else {
//       // No days data and no existing analysis
//       if (isCurrentWeek) {
//         const now = new Date();
      
//         // End date at local midnight
//         const endLocal = new Date(
//           endDateObj.getUTCFullYear(),
//           endDateObj.getUTCMonth(),
//           endDateObj.getUTCDate()
//         );
      
//         const isEndDateToday =
//           endLocal.getFullYear() === now.getFullYear() &&
//           endLocal.getMonth() === now.getMonth() &&
//           endLocal.getDate() === now.getDate();
      
//         const isAfter9PM = now.getHours() >= 21;
      
//         if (isEndDateToday && isAfter9PM) {
//           // ✅ AFTER 9 PM ON LAST DAY
//           setWeeklyAnalysisData([]);
//           // setApiMessage({
//           //   message: "No weekly analysis found. Please add food to generate analysis.",
//           // });

//           setApiMessage({
//   message: MSG_NO_WEEKLY_SHORT,
// });

//         } else {
//           // ❌ BEFORE 9 PM
//           const analysisAvailableDate = new Date(endLocal);
//           analysisAvailableDate.setHours(21, 0, 0, 0);
      
//           const formattedDate = formatDisplayDate(analysisAvailableDate);
//           console.log("formattedDate556:-", formattedDate);
      
//           setWeeklyAnalysisData([]);
//           setApiMessage({
//             message: `Weekly analysis will be available after ${formattedDate}`,
//           });
//         }
//       } else {
//         // For past weeks, show the "Please add food" message
//         setWeeklyAnalysisData([]);
//         const weekIdxToUse = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
// const isPreviousWeek = currentWeekIdx > 0 && weekIdxToUse === currentWeekIdx - 1;

// setApiMessage({
//   message: isPreviousWeek ? MSG_NO_WEEKLY_FULL : MSG_NO_WEEKLY_SHORT,
// });

//       }
//     }

//   } catch (err) {
//     console.error("API Error:", err);
//     setError(err?.message || "Failed to fetch weekly analysis");
//     setWeeklyAnalysisData([]);
//   } finally {
//     setLoading(false);
//   }
// };

 const getTotalFoodsFromSavedJson = (resp) => {
    const days = resp?.data?.food_json?.days;
    if (!Array.isArray(days)) return 0;
    return days.reduce((sum, day) => {
      const items = Array.isArray(day?.items) ? day.items : [];
      return sum + items.length;
    }, 0);
  };



const fetchWeeklyAnalysis = async (startDate, endDate, dietPlanId, daysPayload) => {
  setLoading(true);
  setError(null);
  setErrorType(null);
  setApiMessage(null);

  try {
    // 🔹 STEP 1: CHECK WEEKLY ANALYSIS
    const checkResponse = await checkWeeklyAnalysisService(
      clientProfile?.dietician_id,
      clientProfile?.profile_id,
      withStartOfDayTime(startDate),
      withCurrentTime(endDate)
    );
    
    // ✅ CHECK FOR SPECIFIC API RESPONSE: "No record found for the given date range"
    if (checkResponse?.status === false && 
        checkResponse?.message === "No record found for the given date range") {
      setWeeklyAnalysisData([]);
      // Get the week range for display
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      
      const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));
      
      setApiMessage({ 
        message: `No data available for ${fmt(startDateObj)} and ${fmt(endDateObj)}` 
      });
      setLoading(false);
      return;
    }

    // ✅ CHECK FOR FOOD_LEVEL_EVALUATION IN DATA_JSON
    if (checkResponse?.status === true && 
        checkResponse?.data_json?.food_level_evaluation) {

      setWeeklyAnalysisData(checkResponse.data_json.food_level_evaluation);
      setApiMessage(null);
      setLoading(false);
      return;
    }

    // If we get here, there's no analysis data in checkResponse
    // Parse end date string to Date object (treat as UTC, then convert to local)
    const [year, month, day] = endDate.split('-').map(Number);
    const endDateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    
    // Get today's date at midnight (local time)
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Check if this is the current week (end date is today or in the future)
    const isCurrentWeek = endDateObj >= todayMidnight;
    
    // Only proceed to fetchWeeklyAnalysisComplete1 if we have days data
    if (daysPayload && Object.keys(daysPayload).length > 0) {
   
      // Handle the days payload - it could be in different formats
      let daysForBackend = {}; // Format for weekly_analysis_complete1.php: {day1: [...], day2: [...]}
      let daysArray = []; // Format for internal use: [{day_no: 1, items: [...]}]

      if (daysPayload && typeof daysPayload === 'object') {
        if (daysPayload.daysArray) {
          // New format from CreatePlanPopUp (after our fix)
          daysArray = daysPayload.daysArray;
          daysForBackend = daysPayload.daysForAnalysis || {};
          
  
        } 
        else if (Array.isArray(daysPayload)) {
          // Format: [{day_no: 1, items: [...]}, ...]
          daysArray = daysPayload
            .filter(d => d && Array.isArray(d.items) && d.items.length > 0)
            .map(d => ({ day_no: Number(d.day_no), items: d.items }));
          
          // Convert to backend format {day1: [...], day2: [...]}
          daysArray.forEach(day => {
            daysForBackend[`day${day.day_no}`] = day.items;
          });
          
       
        } 
        else {
          // Might be in {day1: [...], day2: [...]} format already
          daysForBackend = daysPayload;
          
          // Convert to array format for internal use
          daysArray = Object.entries(daysPayload)
            .filter(([key, items]) => key.startsWith('day') && Array.isArray(items) && items.length > 0)
            .map(([key, items]) => ({
              day_no: parseInt(key.replace('day', '')),
              items: items
            }));
          
         
        }
      }

      // Check if we have any valid days data
      if (Object.keys(daysForBackend).length === 0) {
       
        
        // Handle based on week type
        if (isCurrentWeek) {
          const now = new Date();
          const endLocal = new Date(
            endDateObj.getUTCFullYear(),
            endDateObj.getUTCMonth(),
            endDateObj.getUTCDate()
          );
          
          const isEndDateToday =
            endLocal.getFullYear() === now.getFullYear() &&
            endLocal.getMonth() === now.getMonth() &&
            endLocal.getDate() === now.getDate();
          
          const isAfter9PM = now.getHours() >= 21;
          
          if (isEndDateToday && isAfter9PM) {
            setWeeklyAnalysisData([]);
            setApiMessage({
              message: "No weekly analysis found. Please add food to generate analysis.",
            });
          } else {
            const analysisAvailableDate = new Date(endLocal);
            analysisAvailableDate.setHours(21, 0, 0, 0);
            const formattedDate = formatDisplayDate(analysisAvailableDate);
            
            setWeeklyAnalysisData([]);
            setApiMessage({
              message: `Weekly analysis will be available after ${formattedDate}`,
            });
          }
        } else {
          const weekIdxToUse = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
          const isPreviousWeek = currentWeekIdx > 0 && weekIdxToUse === currentWeekIdx - 1;
          
          setWeeklyAnalysisData([]);
          setApiMessage({
            message: isPreviousWeek ? MSG_NO_WEEKLY_FULL : MSG_NO_WEEKLY_SHORT,
          });
        }
        
        setLoading(false);
        return;
      }



      // Prepare request body for weekly_analysis_complete1.php
      const requestBody = {
        // send both spellings (backend will use whichever it expects)
        dietician_id: clientProfile?.dietician_id,
        dietitian_id: clientProfile?.dietician_id,

        profile_id: clientProfile?.profile_id,
        start_date: startDate,
        end_date: endDate,
        ...(dietPlanId && { diet_plan_id: dietPlanId }),

        // Send in the format weekly_analysis_complete1.php expects
        days: daysForBackend, // {day1: [...], day2: [...]}
        
        // Also send other formats for compatibility with other endpoints
        days_json: JSON.stringify(daysArray),
        food_json: JSON.stringify({ days: daysArray }),
      };

      console.log("Sending request to weekly_analysis_complete1:", requestBody);

      const response = await fetchWeeklyAnalysisComplete1(requestBody);

      // ✅ CHECK FOR SPECIFIC API RESPONSE IN SECOND API CALL TOO
      if (response?.status === false && 
          response?.message === "No record found for the given date range") {
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
        const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));
        
        setWeeklyAnalysisData([]);
        setApiMessage({ 
          message: `No data available for ${fmt(startDateObj)} and ${fmt(endDateObj)}` 
        });
        return;
      }

      // ✅ CHECK IF RESPONSE HAS FOOD_LEVEL_EVALUATION IN API_RESPONSE
      if (response?.api_response?.food_level_evaluation) {
        setWeeklyAnalysisData(response.api_response.food_level_evaluation);
        setApiMessage(null);
      } 
      // ✅ CUSTOM MESSAGE HANDLING
      else if (response?.message?.includes("Latest test data is older than 72 hours")) {
        setWeeklyAnalysisData([]);
        setApiMessage({
          message: "No test taken in last 72 hrs, so weekly analysis will not be available.",
        });
      }
      else if (response?.message) {
        setWeeklyAnalysisData([]);
        setApiMessage({ message: response.message });
      } else {
        setWeeklyAnalysisData([]);
        setApiMessage({ 
          message: "No food data available for this week." 
        });
      }
    } else {
      // No days data and no existing analysis
      if (isCurrentWeek) {
        const now = new Date();
      
        // End date at local midnight
        const endLocal = new Date(
          endDateObj.getUTCFullYear(),
          endDateObj.getUTCMonth(),
          endDateObj.getUTCDate()
        );
      
        const isEndDateToday =
          endLocal.getFullYear() === now.getFullYear() &&
          endLocal.getMonth() === now.getMonth() &&
          endLocal.getDate() === now.getDate();
      
        const isAfter9PM = now.getHours() >= 21;
      
        if (isEndDateToday && isAfter9PM) {
          // ✅ AFTER 9 PM ON LAST DAY
          setWeeklyAnalysisData([]);
          setApiMessage({
            message: MSG_NO_WEEKLY_SHORT,
          });
        } else {
          // ❌ BEFORE 9 PM
          const analysisAvailableDate = new Date(endLocal);
          analysisAvailableDate.setHours(21, 0, 0, 0);
      
          const formattedDate = formatDisplayDate(analysisAvailableDate);
          console.log("formattedDate:", formattedDate);
      
          setWeeklyAnalysisData([]);
          setApiMessage({
            message: `Weekly analysis will be available after ${formattedDate}`,
          });
        }
      } else {
        // For past weeks, show the appropriate message
        const weekIdxToUse = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
        const isPreviousWeek = currentWeekIdx > 0 && weekIdxToUse === currentWeekIdx - 1;

        setApiMessage({
          message: isPreviousWeek ? MSG_NO_WEEKLY_FULL : MSG_NO_WEEKLY_SHORT,
        });
      }
    }

  }
  
  // catch (err) {
  //   console.error("API Error:", err);
  //   setError(err?.message || "Failed to fetch weekly analysis");
  //   setWeeklyAnalysisData([]);
  // } 
  catch (err) {
  console.error("API Error:", err);

  const timeoutFromBackend =
    err?.response?.data?.error === "Network error (weekly_analysis API)" &&
    String(err?.response?.data?.details || "").includes("Operation timed out");

  const timeoutFromResponseObject =
    err?.error === "Network error (weekly_analysis API)" &&
    String(err?.details || "").includes("Operation timed out");

  const timeoutFromMessage =
    String(err?.message || "").toLowerCase().includes("timeout") ||
    String(err?.message || "").includes("25002");

  if (timeoutFromBackend || timeoutFromResponseObject || timeoutFromMessage) {
    setWeeklyAnalysisData([]);
    setApiMessage({ message: MSG_WEEKLY_ANALYSIS_TIMEOUT });
    setError(null);
    return;
  }

  setError(err?.message || "Failed to fetch weekly analysis");
  setWeeklyAnalysisData([]);
} finally {
    setLoading(false);
  }
};








useEffect(() => {
  const activePlan = clientProfile?.plans_summary?.active?.[0];

  let dietPlanId = null;
  let planStart = null;
  let planEnd = null;

  if (activePlan) {
    dietPlanId = activePlan.id;
    planStart = toLocalMidnight(activePlan.plan_start_date);
    planEnd = toLocalMidnight(activePlan.plan_end_date);
  }

  const weekIdxToUse = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
  const range = getWeekDateRange(weekIdxToUse);
  if (!range) return;

  let startDateObj = range.start;
  let endDateObj = range.end;

  if (planStart && startDateObj < planStart) startDateObj = planStart;
  if (planEnd && endDateObj > planEnd) endDateObj = planEnd;

  const startDate = formatDateForApi(startDateObj);
  const endDate = formatDateForApi(endDateObj);

  // ✅ 1) fetch saved weekly food json and compute total items
  (async () => {
    try {
      const resp = await fetchSavedWeeklyFoodJson(
        clientProfile?.profile_id,
        startDate,
        endDate,
        clientProfile?.dietician_id
      );

      const total = getTotalFoodsFromSavedJson(resp);
      setSavedFoodsTotal(total);
    } catch (e) {
      setSavedFoodsTotal(0);
    }
  })();

  // ✅ 2) your existing analysis call
  fetchWeeklyAnalysis(startDate, endDate, dietPlanId, daysPayload);
}, [
  clientProfile,
  selectedWeekIdx,
  currentWeekIdx,
  weeks?.length ?? 0,
  daysPayload
]);




  // useEffect(() => {
  //   const activePlan = clientProfile?.plans_summary?.active?.[0];
  
  //   let dietPlanId = null;
  //   let planStart = null;
  //   let planEnd = null;
  
  //   if (activePlan) {
  //     dietPlanId = activePlan.id;
  //     planStart = toLocalMidnight(activePlan.plan_start_date);
  //     planEnd = toLocalMidnight(activePlan.plan_end_date);
  //   }
  
  //   const weekIdxToUse =
  //     selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
  
  //   const range = getWeekDateRange(weekIdxToUse);
  //   if (!range) return;
  
  //   let startDateObj = range.start;
  //   let endDateObj = range.end;
  
  //   if (planStart && startDateObj < planStart) {
  //     startDateObj = planStart;
  //   }
  
  //   if (planEnd && endDateObj > planEnd) {
  //     endDateObj = planEnd;
  //   }
  
  //   const startDate = formatDateForApi(startDateObj);
  //   const endDate = formatDateForApi(endDateObj);
  //   console.log("endDate822:-", endDate);
  
  //   fetchWeeklyAnalysis(startDate, endDate, dietPlanId, daysPayload);
  // }, [
  //   clientProfile,
  //   selectedWeekIdx,
  //   currentWeekIdx,
  //   weeks?.length ?? 0,
  //   daysPayload
  // ]);
  
  // Clear daysPayload when week changes
  useEffect(() => {
    setDaysPayload({});
  }, [selectedWeekIdx, currentWeekIdx]);

  // useEffect(() => {
  //   if (selectedWeekIdx === null) return;

  //   if (selectedWeekIdx < visibleWeekStart) {
  //     setVisibleWeekStart(selectedWeekIdx);
  //     return;
  //   }

  //   if (selectedWeekIdx >= visibleWeekStart + visibleWeeksCount) {
  //     setVisibleWeekStart(Math.max(0, selectedWeekIdx - (visibleWeeksCount - 1)));
  //   }
  // }, [selectedWeekIdx, visibleWeekStart]);




  useEffect(() => {
  if (selectedWeekIdx === null) return;

  setVisibleWeekStart((prev) => {
    if (selectedWeekIdx < prev) return selectedWeekIdx;
    if (selectedWeekIdx >= prev + visibleWeeksCount) {
      return Math.max(0, selectedWeekIdx - (visibleWeeksCount - 1));
    }
    return prev;
  });
}, [selectedWeekIdx, visibleWeeksCount]);




  const canGoNext = visibleWeekStart + visibleWeeksCount < (weeks?.length || 0);
  const canGoPrev = visibleWeekStart > 0;

  const handleNextWeeks = () => {
    if (canGoNext) {
      setVisibleWeekStart((prev) => {
        const newStart = prev + 1;
        const maxStart = Math.max(0, (weeks?.length || 0) - visibleWeeksCount);
        return Math.min(newStart, maxStart);
      });
    }
  };

  const handlePrevWeeks = () => {
    if (canGoPrev) {
      setVisibleWeekStart((prev) => Math.max(0, prev - 1));
    }
  };

  const visibleWeeks = (weeks || []).slice(visibleWeekStart, visibleWeekStart + visibleWeeksCount); 
  console.log("visibleWeeks888:-", visibleWeeks);

  const handleCreatePlanClick = () => {
    localStorage.clear();
    setIsModalOpen(true);
  };

  const handlePopupClose = () => setIsModalOpen(false);

  const handleFoodUploaded = (days) => {
    setDaysPayload(days || {});
    setIsModalOpen(false);
  };

  const showMessageState = apiMessage && dataArr.length === 0;
  const showNoDataState = !apiMessage && dataArr.length === 0 && !loading && !error;
  const showDataState = dataArr.length > 0;


// which week is currently being viewed
const effectiveWeekIdx = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;

// previous week index from current week
const prevWeekIdx = currentWeekIdx > 0 ? currentWeekIdx - 1 : null;

// check exact message
const messageNoWeeklyAnalysis =
  apiMessage?.message?.includes("No weekly analysis found.");


const isPreviousWeek = prevWeekIdx !== null && effectiveWeekIdx === prevWeekIdx;

const isFullNoWeeklyMessage =
  apiMessage?.message === MSG_NO_WEEKLY_FULL;

const allowAddFoodForThisMessage =
  isPreviousWeek && isFullNoWeeklyMessage;


// final hide logic
const hideAddFoodButton =
  apiMessage?.message?.includes("No test taken in last 72 hrs") ||
  apiMessage?.end_date ||
  apiMessage?.message?.includes("No data available for") ||
  // (messageNoWeeklyAnalysis && !allowAddFoodForThisMessage);
  (messageNoWeeklyAnalysis && apiMessage?.message !== MSG_NO_WEEKLY_SHORT && !allowAddFoodForThisMessage);


  const shouldHideAddFoodBecauseSavedItems = Number(savedFoodsTotal) > 0;

  const showAddFoodButton = !hideAddFoodButton && !shouldHideAddFoodBecauseSavedItems;



  

  // const hideAddFoodButton =
  // apiMessage?.message?.includes("No test taken in last 72 hrs") ||
  // // apiMessage?.message?.includes("Weekly analysis will be available after") ||
  // apiMessage?.end_date ||
  // // ✅ ALSO HIDE ADD FOOD BUTTON FOR THE NEW MESSAGE
  // apiMessage?.message?.includes("No data available for");

  // const showAddFoodButton = !hideAddFoodButton;

  //const effectiveWeekIdx = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
  const selectedWeek = weeks?.[effectiveWeekIdx] || null;

  const selectedWeekText = selectedWeek
    ? `${fmt(selectedWeek.startDate)} - ${fmt(selectedWeek.endDate)}`
    : "";

  return (
    <>
      <div className="flex flex-col gap-[25px] mt-[42px] bg-[#F5F7FA] rounded-[15px] pt-[25px] pl-[30px] pr-7 pb-2.5">
        <div className="flex justify-between">
          <span className="text-[#252525] text-[20px] font-semibold tracking-[-0.3] leading-[110%]">
            Weekly Food Analysis
          </span>
        </div>

        <div className="w-full border-b border-[#E1E6ED]"></div>

        <div className="flex flex-col gap-9 bg-[#F5F7FA] rounded-[15px]">
          <div className="flex items-center bg-[#E1E6ED] rounded-[15px] border-4 border-[#F5F7FA]">
            <div className="flex justify-between w-[170px] py-[30px] pl-[30px]">
              <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap">
                Select a Week
              </span>

              <IoIosArrowBack
                className={`${canGoPrev ? "text-[#252525] cursor-pointer" : "text-[#A1A1A1] cursor-not-allowed"}`}
                onClick={canGoPrev ? handlePrevWeeks : undefined}
              />
            </div>

            <div className="flex items-center">
              <div className="flex items-center">
                {visibleWeeks.map((w, idx) => {
                  const actualIndex = visibleWeekStart + idx;
                  const effectiveIdx = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;

                  const today = new Date();
                  const todayStart = startOfDay(today);
                  const range = getWeekDateRange(actualIndex);

                  const isDisabled = !!(range && range.start > todayStart);
                  const isSelected = actualIndex === effectiveIdx && !isDisabled;

                  const wrapBase =
                    "flex flex-col w-full gap-2.5 pt-[15px] pb-2.5 pr-2.5 pl-[15px] rounded-[8px]";
                  const wrapClass = isDisabled
                    ? `${wrapBase} bg-transparent cursor-not-allowed`
                    : isSelected
                    ? `${wrapBase} bg-[#308BF9] cursor-pointer`
                    : `${wrapBase} bg-transparent cursor-pointer`;

                  const titleClass = isDisabled
                    ? "text-[#A1A1A1] text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap"
                    : isSelected
                    ? "text-white text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap"
                    : "text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap";

                  const dateClass = isDisabled
                    ? "text-[#A1A1A1] text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap"
                    : isSelected
                    ? "text-white text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap"
                    : "text-[#252525] text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap";

                  return (
                    <React.Fragment key={w.label}>
                      <div
                        className={wrapClass}
                        onClick={() => {
                          if (!isDisabled) setSelectedWeekIdx(actualIndex);
                        }}
                      >
                        <span className={titleClass}>{w.label}</span>
                        <span className={dateClass}>
                          {fmt(w.startDate)} - {fmt(w.endDate)}
                        </span>
                      </div>

                      {idx !== visibleWeeks.length - 1 && <div className="border-white border-r h-8 mx-2"></div>}
                    </React.Fragment>
                  );
                })}
              </div>

              <IoIosArrowForward
                className={`ml-2 ${canGoNext ? "text-[#252525] cursor-pointer" : "text-[#A1A1A1] cursor-not-allowed"}`}
                onClick={canGoNext ? handleNextWeeks : undefined}
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
            <p className="text-[#535359] text-[16px] font-semibold">Loading...</p>
          </div>
        )}

        {/* {error && (
          <div className="px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
            <p className="text-red-600 text-[14px] font-semibold">{error}</p>
          </div>
        )} */}

        {showDataState && (
          <div className="flex justify-between bg-[#E1E6ED] rounded-[15px] px-5 py-[19px] ml-[59px] mr-[59px]">
            <div className="flex flex-col justify-between w-[170px] bg-white rounded-[8px] py-[19px] pl-5 pr-10">
              <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
                {totalFoods}
              </span>
              <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
                Total Foods
              </p>
            </div>

            {/* <div className="flex gap-20 bg-white rounded-[8px] py-[19px] px-5">
              <div className="flex flex-col justify-between">
                <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
                  {goalCounts.Support || 0}
                </span>
                <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
                  Foods Consumed
                </span>
              </div>

              <div className="flex flex-col justify-between">
                <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
                  {goalCounts.Low || 0}
                </span>
                <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
                  Foods Missed
                </span>
              </div>
            </div> */}

            <div className="flex flex-col gap-[12px] bg-white rounded-[8px] py-[19px] pl-5 pr-10">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#252525] text-[18px] font-semibold tracking-[-0.5px] leading-[126%]">
                    {avgScore}
                  </span>
                  <div className="w-px h-4 bg-[#D9D9D9]" />
                  <span className="text-[#252525] text-[18px] font-semibold tracking-[-0.36px] leading-[126%]">
                    {zone}
                  </span>
                </div>
                <div className="flex justify-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="117"
                    height="6"
                    viewBox="0 0 117 6"
                    fill="none"
                  >
                    <path
                      d="M3 3H114"
                      stroke="#D9D9D9"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <path
                      d={`M3 3H${Math.max(
                        3,
                        Math.min(
                          114,
                          Math.round((avgScore / 100) * 111) + 3
                        )
                      )}`}
                      stroke="#FFBF2D"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Overall Metabolic Compatibility Score
                </p>
              </div>
            </div>
          </div>
        )}

        {showMessageState && (
          <div className="flex justify-between items-center px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
            <p className="text-[16px] font-semibold leading-[110%] tracking-[-0.4px] text-[#535359]">
              {apiMessage?.message}
            </p>
            {showAddFoodButton && (
              <button
                onClick={handleCreatePlanClick}
                className="w-[146px] font-semibold text-[#308BF9] text-[12px] px-5 py-[15px] cursor-pointer rounded-[10px] bg-[#FFFFFF] border border-[#308BF9]"
              >
                Add Food
              </button>
            )}


     
   {Number(savedFoodsTotal) > 0 && (
<div className="flex flex-col gap-[15px] bg-white px-5 py-[19px] rounded-[8px]">
    <p className="text-[#252525] text-[25px] font-semibold leading-[126%] tracking-[0.5px]">{savedFoodsTotal}</p>
<div className="flex gap-[15px]">
  <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">Food Added</p>
  <p 
  className="text-[#308BF9] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] cursor-pointer"
   onClick={handleCreatePlanClick}
  >View</p>
</div>
</div>
      )}    
          </div>

        )}

        {showNoDataState && (
          <div className="flex justify-between items-center px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
            <p className="text-[16px] font-semibold leading-[110%] tracking-[-0.4px] text-[#535359]">
              No food added for this week.
            </p>
            {showAddFoodButton && (
              <button
                onClick={handleCreatePlanClick}
                className="w-[146px] font-semibold text-[#308BF9] text-[12px] px-5 py-[15px] cursor-pointer rounded-[10px] bg-[#FFFFFF] border border-[#308BF9]"
              >
                Add Food
              </button>
            )}
          </div>
        )}

        {showDataState && (
          <div className="flex gap-[5px]">
            <MealSidebar
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              weeklyAnalysisData={dataArr}
            />
            <div className="w-full max-h-[600px] overflow-y-auto hide-scrollbar">
              <MealTracked
                activeFilter={activeFilter}
                weeklyAnalysisData={dataArr}
              />
            </div>
          </div>
        )}
      </div>

      <CreatePlanPopUp 
      open={isModalOpen} 
      onClose={handlePopupClose} 
      onUploaded={handleFoodUploaded}  
      selectedWeekText={selectedWeekText}
      dieticianId={clientProfile?.dietician_id}
      profileId={clientProfile?.profile_id}
      />
    </>
  );
}














// "use client";

// import React, { useEffect, useMemo, useState } from "react";
// import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
// import { useSelector } from "react-redux";
// import { fetchWeeklyAnalysisComplete1 } from "../services/authService";
// import { checkWeeklyAnalysisService } from "../services/authService";
// import CreatePlanPopUp from "./pop-folder/create-plan-popup";
// import MealSidebar from "./meal-sidebar";
// import MealTracked from "./meal-tracked";

// export default function MealLogged() {
//   const [activeFilter, setActiveFilter] = useState("low");
//   const [weeklyAnalysisData, setWeeklyAnalysisData] = useState([]);
//   const [apiMessage, setApiMessage] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [errorType, setErrorType] = useState(null);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   // ✅ FIXED: Initialize with 0
//   const [visibleWeekStart, setVisibleWeekStart] = useState(0);

//   const [selectedWeekIdx, setSelectedWeekIdx] = useState(null);
//   console.log("selectedWeekIdx1399:-", selectedWeekIdx);

//   // ✅ this is the ONLY thing we need from popup
//   const [daysPayload, setDaysPayload] = useState({});

//   const clientProfile = useSelector((state) => state.clientProfile.data);
//   const visibleWeeksCount = 4;

//   const handleFilterChange = (filter) => setActiveFilter(filter);

//   // Fixed date utility functions with UTC handling
//   const toLocalMidnight = (dateStr) => {
//     if (!dateStr) return new Date();
//     const [y, m, d] = String(dateStr).split("-").map(Number);
//     // Create date in UTC to avoid timezone issues
//     return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
//   };

//   const startOfDay = (d) => {
//     const date = new Date(d);
//     date.setUTCHours(0, 0, 0, 0);
//     return date;
//   };

//   const endOfDay = (d) => {
//     const date = new Date(d);
//     date.setUTCHours(23, 59, 59, 999);
//     return date;
//   };

//   const formatDateForApi = (d) => {
//     // Always use UTC for API dates
//     const year = d.getUTCFullYear();
//     const month = String(d.getUTCMonth() + 1).padStart(2, "0");
//     const day = String(d.getUTCDate()).padStart(2, "0");
//     return `${year}-${month}-${day}`;
//   };

//   const withStartOfDayTime = (dateStr) => {
//     return `${dateStr} 00:00:00`;
//   };

//   const withCurrentTime = (dateStr) => {
//     const now = new Date();
//     const hh = String(now.getHours()).padStart(2, "0");
//     const mm = String(now.getMinutes()).padStart(2, "0");
//     const ss = String(now.getSeconds()).padStart(2, "0");
//     return `${dateStr} ${hh}:${mm}:${ss}`;
//   };

//   const fmt = (d) => {
//     // Format for display using UTC
//     const year = d.getUTCFullYear();
//     const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
//     const day = String(d.getUTCDate()).padStart(2, '0');
//     return `${day} ${month} ${year}`;
//   };

//   const dataArr = Array.isArray(weeklyAnalysisData) ? weeklyAnalysisData : [];
//   const totalFoods = dataArr.length;

//   const avgScore = totalFoods
//     ? Math.round(
//         dataArr.reduce((sum, item) => sum + (Number(item.metabolic_compatibility_score) || 0), 0) / totalFoods
//       )
//     : 0;

//   const zone = avgScore >= 80 ? "High" : avgScore >= 61 ? "Moderate" : "Low";

//   const goalCounts = useMemo(() => {
//     return dataArr.reduce((acc, item) => {
//       const key = item.goal_alignment || "Unknown";
//       acc[key] = (acc[key] || 0) + 1;
//       return acc;
//     }, {});
//   }, [dataArr]);

//   const { weeks, currentWeekIdx } = useMemo(() => {
//     const result = { weeks: [], currentWeekIdx: 0 };

//     const dttm = clientProfile?.dttm;
//     if (!dttm) return result;

//     // Parse the date string in UTC
//     const datePart = dttm.split(" ")[0];
//     const [year, month, day] = datePart.split("-").map(Number);
//     const planStartDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
//     const planStart = startOfDay(planStartDate);

//     const today = startOfDay(new Date());
//     const durationDays = Math.ceil((today - planStart) / (1000 * 60 * 60 * 24)) + 1;
//     const numberOfWeeks = Math.ceil(durationDays / 7);

//     const list = [];
//     for (let i = 0; i < numberOfWeeks; i++) {
//       const start = new Date(planStart);
//       start.setUTCDate(planStart.getUTCDate() + i * 7);

//       const end = new Date(start);
//       end.setUTCDate(start.getUTCDate() + 6);

//       list.push({
//         label: `Week ${i + 1}`,
//         startDate: startOfDay(start),
//         endDate: endOfDay(end),
//       });
//     }

//     let idx = list.findIndex((w) => today >= w.startDate && today <= w.endDate);
//     if (idx === -1) idx = 0;

//     result.weeks = list;
//     result.currentWeekIdx = idx;
//     return result;
//   }, [clientProfile]);

//   // ✅ ADD THIS: Update visibleWeekStart when weeks is ready
//   useEffect(() => {
//     if (weeks?.length > 0 && currentWeekIdx !== null) {
//       const middlePosition = 2;
//       const idealStart = Math.max(0, currentWeekIdx - middlePosition);
//       const maxStart = Math.max(0, weeks.length - visibleWeeksCount);
//       const newStart = Math.min(idealStart, maxStart);
  
//       setVisibleWeekStart(newStart);
//     }

//   }, [weeks, currentWeekIdx, visibleWeeksCount]);
  

//   const getWeekDateRange = (weekIdx) => {
//     const w = weeks?.[weekIdx];
//     if (!w) return null;
//     return { start: w.startDate, end: w.endDate };
//   };

//   const formatDisplayDate = (date) => {
//     // Format: "24 January 2026 9:00 PM"
//     const day = date.getDate();
//     const month = date.toLocaleString('en-US', { month: 'long' });
//     const year = date.getFullYear();
//     const hours = date.getHours();
//     const minutes = date.getMinutes().toString().padStart(2, '0');
//     const ampm = hours >= 12 ? 'PM' : 'AM';
//     const formattedHours = hours % 12 || 12;
    
//     return `${day} ${month} ${year} ${formattedHours}:${minutes} ${ampm}`;
//   };

//   const fetchWeeklyAnalysis = async (startDate, endDate, dietPlanId, days) => {
//     setLoading(true);
//     setError(null);
//     setErrorType(null);
//     setApiMessage(null);
  
//     try {
//       // 🔹 STEP 1: CHECK WEEKLY ANALYSIS
//       const checkResponse = await checkWeeklyAnalysisService(
//         clientProfile?.dietician_id,
//         clientProfile?.profile_id,
//         withStartOfDayTime(startDate),
//         withCurrentTime(endDate)
//       );
      
//       // ✅ CHECK FOR SPECIFIC API RESPONSE: "No record found for the given date range"
//       if (checkResponse?.status === false && 
//           checkResponse?.message === "No record found for the given date range") {
//         setWeeklyAnalysisData([]);
//         // Get the week range for display
//         const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
//         const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
//         const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
//         const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));
        
//         setApiMessage({ 
//           message: `No data available for ${fmt(startDateObj)} and ${fmt(endDateObj)}` 
//         });
//         setLoading(false);
//         return;
//       }

//       // ✅ CHECK FOR FOOD_LEVEL_EVALUATION IN DATA_JSON
//       if (checkResponse?.status === true && 
//           checkResponse?.data_json?.food_level_evaluation) {
//         console.log("Using existing analysis data from check API");
//         setWeeklyAnalysisData(checkResponse.data_json.food_level_evaluation);
//         setApiMessage(null);
//         setLoading(false);
//         return;
//       }

//       // If we get here, there's no analysis data in checkResponse
//       // Parse end date string to Date object (treat as UTC, then convert to local)
//       const [year, month, day] = endDate.split('-').map(Number);
//       const endDateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      
//       // Get today's date at midnight (local time)
//       const today = new Date();
//       const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
//       // Check if this is the current week (end date is today or in the future)
//       const isCurrentWeek = endDateObj >= todayMidnight;
      
//       // Only proceed to fetchWeeklyAnalysisComplete1 if we have days data
//       if (days && Object.keys(days).length > 0) {
//         const requestBody = {
//           dietician_id: clientProfile?.dietician_id,
//           profile_id: clientProfile?.profile_id,
//           start_date: startDate,
//           end_date: endDate,
//           ...(dietPlanId && { diet_plan_id: dietPlanId }),
//           days: days || {},
//         };

//         const response = await fetchWeeklyAnalysisComplete1(requestBody);

//         // ✅ CHECK FOR SPECIFIC API RESPONSE IN SECOND API CALL TOO
//         if (response?.status === false && 
//             response?.message === "No record found for the given date range") {
//           const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
//           const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
          
//           const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
//           const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));
          
//           setWeeklyAnalysisData([]);
//           setApiMessage({ 
//             message: `No data available for ${fmt(startDateObj)} and ${fmt(endDateObj)}` 
//           });
//           return;
//         }

//         // ✅ CHECK IF RESPONSE HAS FOOD_LEVEL_EVALUATION IN API_RESPONSE
//         if (response?.api_response?.food_level_evaluation) {
//           setWeeklyAnalysisData(response.api_response.food_level_evaluation);
//           setApiMessage(null);
//         } 
//         // ✅ CUSTOM MESSAGE HANDLING
//         else if (response?.message?.includes("Latest test data is older than 72 hours")) {
//           setWeeklyAnalysisData([]);
//           setApiMessage({
//             message: "No test taken in last 72 hrs, so weekly analysis will not be available.",
//           });
//         }
//         else if (response?.message) {
//           setWeeklyAnalysisData([]);
//           setApiMessage({ message: response.message });
//         } else {
//           setWeeklyAnalysisData([]);
//           setApiMessage({ 
//             message: "No food data available for this week." 
//           });
//         }
//       } else {
//         // No days data and no existing analysis
//         if (isCurrentWeek) {
//           // For current week, show the "Weekly analysis will be available after" message
//           const analysisAvailableDate = new Date(endDateObj);
//           analysisAvailableDate.setHours(21, 0, 0, 0); // 9:00 PM local time
          
//           const formattedDate = formatDisplayDate(analysisAvailableDate);
//           setWeeklyAnalysisData([]);
//           setApiMessage({ 
//             message: `Weekly analysis will be available after ${formattedDate}` 
//           });
//         } else {
//           // For past weeks, show the "Please add food" message
//           setWeeklyAnalysisData([]);
//           setApiMessage({ 
//             message: "No weekly analysis found. Please add food to generate analysis." 
//           });
//         }
//       }

//     } catch (err) {
//       console.error("API Error:", err);
//       setError(err?.message || "Failed to fetch weekly analysis");
//       setWeeklyAnalysisData([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     const activePlan = clientProfile?.plans_summary?.active?.[0];
  
//     let dietPlanId = null;
//     let planStart = null;
//     let planEnd = null;
  
//     if (activePlan) {
//       dietPlanId = activePlan.id;
//       planStart = toLocalMidnight(activePlan.plan_start_date);
//       planEnd = toLocalMidnight(activePlan.plan_end_date);
//     }
  
//     const weekIdxToUse =
//       selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
  
//     const range = getWeekDateRange(weekIdxToUse);
//     if (!range) return;
  
//     let startDateObj = range.start;
//     let endDateObj = range.end;
  
//     if (planStart && startDateObj < planStart) {
//       startDateObj = planStart;
//     }
  
//     if (planEnd && endDateObj > planEnd) {
//       endDateObj = planEnd;
//     }
  
//     const startDate = formatDateForApi(startDateObj);
//     const endDate = formatDateForApi(endDateObj);
  
//     fetchWeeklyAnalysis(startDate, endDate, dietPlanId, daysPayload);
//   }, [
//     clientProfile,
//     selectedWeekIdx,
//     currentWeekIdx,
//     weeks?.length ?? 0,
//     daysPayload
//   ]);
  
//   // Clear daysPayload when week changes
//   useEffect(() => {
//     setDaysPayload({});
//   }, [selectedWeekIdx, currentWeekIdx]);

//   useEffect(() => {
//     if (selectedWeekIdx === null) return;

//     if (selectedWeekIdx < visibleWeekStart) {
//       setVisibleWeekStart(selectedWeekIdx);
//       return;
//     }

//     if (selectedWeekIdx >= visibleWeekStart + visibleWeeksCount) {
//       setVisibleWeekStart(Math.max(0, selectedWeekIdx - (visibleWeeksCount - 1)));
//     }
//   }, [selectedWeekIdx, visibleWeekStart]);

//   const canGoNext = visibleWeekStart + visibleWeeksCount < (weeks?.length || 0);
//   const canGoPrev = visibleWeekStart > 0;

//   const handleNextWeeks = () => {
//     if (canGoNext) {
//       setVisibleWeekStart((prev) => {
//         const newStart = prev + 1;
//         const maxStart = Math.max(0, (weeks?.length || 0) - visibleWeeksCount);
//         return Math.min(newStart, maxStart);
//       });
//     }
//   };

//   const handlePrevWeeks = () => {
//     if (canGoPrev) {
//       setVisibleWeekStart((prev) => Math.max(0, prev - 1));
//     }
//   };

//   const visibleWeeks = (weeks || []).slice(visibleWeekStart, visibleWeekStart + visibleWeeksCount);

//   const handleCreatePlanClick = () => {
//     localStorage.clear();
//     setIsModalOpen(true);
//   };

//   const handlePopupClose = () => setIsModalOpen(false);

//   const handleFoodUploaded = (days) => {
//     setDaysPayload(days || {});
//     setIsModalOpen(false);
//   };

//   const showMessageState = apiMessage && dataArr.length === 0;
//   const showNoDataState = !apiMessage && dataArr.length === 0 && !loading && !error;
//   const showDataState = dataArr.length > 0;

//   const hideAddFoodButton =
//   apiMessage?.message?.includes("No test taken in last 72 hrs") ||
//   apiMessage?.message?.includes("Weekly analysis will be available after") ||
//   apiMessage?.end_date ||
//   // ✅ ALSO HIDE ADD FOOD BUTTON FOR THE NEW MESSAGE
//   apiMessage?.message?.includes("No data available for");

//   const showAddFoodButton = !hideAddFoodButton;

//   const effectiveWeekIdx = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
//   const selectedWeek = weeks?.[effectiveWeekIdx] || null;

//   const selectedWeekText = selectedWeek
//     ? `${fmt(selectedWeek.startDate)} - ${fmt(selectedWeek.endDate)}`
//     : "";

//   return (
//     <>
//       <div className="flex flex-col gap-[25px] mt-[42px] bg-[#F5F7FA] rounded-[15px] pt-[25px] pl-[30px] pr-7 pb-2.5">
//         <div className="flex justify-between">
//           <span className="text-[#252525] text-[20px] font-semibold tracking-[-0.3] leading-[110%]">
//             Weekly Food Analysis
//           </span>
//         </div>

//         <div className="w-full border-b border-[#E1E6ED]"></div>

//         <div className="flex flex-col gap-9 bg-[#F5F7FA] rounded-[15px]">
//           <div className="flex items-center bg-[#E1E6ED] rounded-[15px] border-4 border-[#F5F7FA]">
//             <div className="flex justify-between w-[170px] py-[30px] pl-[30px]">
//               <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap">
//                 Select a Week
//               </span>

//               <IoIosArrowBack
//                 className={`${canGoPrev ? "text-[#252525] cursor-pointer" : "text-[#A1A1A1] cursor-not-allowed"}`}
//                 onClick={canGoPrev ? handlePrevWeeks : undefined}
//               />
//             </div>

//             <div className="flex items-center">
//               <div className="flex items-center">
//                 {visibleWeeks.map((w, idx) => {
//                   const actualIndex = visibleWeekStart + idx;
//                   const effectiveIdx = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;

//                   const today = new Date();
//                   const todayStart = startOfDay(today);
//                   const range = getWeekDateRange(actualIndex);

//                   const isDisabled = !!(range && range.start > todayStart);
//                   const isSelected = actualIndex === effectiveIdx && !isDisabled;

//                   const wrapBase =
//                     "flex flex-col w-full gap-2.5 pt-[15px] pb-2.5 pr-2.5 pl-[15px] rounded-[8px]";
//                   const wrapClass = isDisabled
//                     ? `${wrapBase} bg-transparent cursor-not-allowed`
//                     : isSelected
//                     ? `${wrapBase} bg-[#308BF9] cursor-pointer`
//                     : `${wrapBase} bg-transparent cursor-pointer`;

//                   const titleClass = isDisabled
//                     ? "text-[#A1A1A1] text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap"
//                     : isSelected
//                     ? "text-white text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap"
//                     : "text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap";

//                   const dateClass = isDisabled
//                     ? "text-[#A1A1A1] text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap"
//                     : isSelected
//                     ? "text-white text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap"
//                     : "text-[#252525] text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap";

//                   return (
//                     <React.Fragment key={w.label}>
//                       <div
//                         className={wrapClass}
//                         onClick={() => {
//                           if (!isDisabled) setSelectedWeekIdx(actualIndex);
//                         }}
//                       >
//                         <span className={titleClass}>{w.label}</span>
//                         <span className={dateClass}>
//                           {fmt(w.startDate)} - {fmt(w.endDate)}
//                         </span>
//                       </div>

//                       {idx !== visibleWeeks.length - 1 && <div className="border-white border-r h-8 mx-2"></div>}
//                     </React.Fragment>
//                   );
//                 })}
//               </div>

//               <IoIosArrowForward
//                 className={`ml-2 ${canGoNext ? "text-[#252525] cursor-pointer" : "text-[#A1A1A1] cursor-not-allowed"}`}
//                 onClick={canGoNext ? handleNextWeeks : undefined}
//               />
//             </div>
//           </div>
//         </div>

//         {loading && (
//           <div className="px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-[#535359] text-[16px] font-semibold">Loading...</p>
//           </div>
//         )}

//         {error && (
//           <div className="px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-red-600 text-[14px] font-semibold">{error}</p>
//           </div>
//         )}

//         {showDataState && (
//           <div className="flex justify-between bg-[#E1E6ED] rounded-[15px] px-5 py-[19px] ml-[59px] mr-[59px]">
//             <div className="flex flex-col justify-between w-[170px] bg-white rounded-[8px] py-[19px] pl-5 pr-10">
//               <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
//                 {totalFoods}
//               </span>
//               <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
//                 Total Foods
//               </p>
//             </div>

//             {/* <div className="flex gap-20 bg-white rounded-[8px] py-[19px] px-5">
//               <div className="flex flex-col justify-between">
//                 <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
//                   {goalCounts.Support || 0}
//                 </span>
//                 <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
//                   Foods Consumed
//                 </span>
//               </div>

//               <div className="flex flex-col justify-between">
//                 <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
//                   {goalCounts.Low || 0}
//                 </span>
//                 <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
//                   Foods Missed
//                 </span>
//               </div>
//             </div> */}

//             <div className="flex flex-col gap-[12px] bg-white rounded-[8px] py-[19px] pl-5 pr-10">
//               <div className="flex flex-col gap-5">
//                 <div className="flex items-center gap-2.5">
//                   <span className="text-[#252525] text-[18px] font-semibold tracking-[-0.5px] leading-[126%]">
//                     {avgScore}
//                   </span>
//                   <div className="w-px h-4 bg-[#D9D9D9]" />
//                   <span className="text-[#252525] text-[18px] font-semibold tracking-[-0.36px] leading-[126%]">
//                     {zone}
//                   </span>
//                 </div>
//                 <div className="flex justify-start">
//                   <svg
//                     xmlns="http://www.w3.org/2000/svg"
//                     width="117"
//                     height="6"
//                     viewBox="0 0 117 6"
//                     fill="none"
//                   >
//                     <path
//                       d="M3 3H114"
//                       stroke="#D9D9D9"
//                       strokeWidth="5"
//                       strokeLinecap="round"
//                     />
//                     <path
//                       d={`M3 3H${Math.max(
//                         3,
//                         Math.min(
//                           114,
//                           Math.round((avgScore / 100) * 111) + 3
//                         )
//                       )}`}
//                       stroke="#FFC412"
//                       strokeWidth="5"
//                       strokeLinecap="round"
//                     />
//                   </svg>
//                 </div>
//               </div>
//               <div>
//                 <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
//                   Overall Metabolic Compatibility Score
//                 </p>
//               </div>
//             </div>
//           </div>
//         )}

//         {showMessageState && (
//           <div className="flex justify-between items-center px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-[16px] font-semibold leading-[110%] tracking-[-0.4px] text-[#535359]">
//               {apiMessage?.message}
//             </p>
//             {showAddFoodButton && (
//               <button
//                 onClick={handleCreatePlanClick}
//                 className="w-[146px] font-semibold text-[#308BF9] text-[12px] px-5 py-[15px] cursor-pointer rounded-[10px] bg-[#FFFFFF] border border-[#308BF9]"
//               >
//                 Add Food
//               </button>
//             )}
//           </div>
//         )}

//         {showNoDataState && (
//           <div className="flex justify-between items-center px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-[16px] font-semibold leading-[110%] tracking-[-0.4px] text-[#535359]">
//               No food added for this week.
//             </p>
//             {showAddFoodButton && (
//               <button
//                 onClick={handleCreatePlanClick}
//                 className="w-[146px] font-semibold text-[#308BF9] text-[12px] px-5 py-[15px] cursor-pointer rounded-[10px] bg-[#FFFFFF] border border-[#308BF9]"
//               >
//                 Add Food
//               </button>
//             )}
//           </div>
//         )}

//         {showDataState && (
//           <div className="flex gap-[5px]">
//             <MealSidebar
//               activeFilter={activeFilter}
//               onFilterChange={handleFilterChange}
//               weeklyAnalysisData={dataArr}
//             />
//             <div className="w-full max-h-[600px] overflow-y-auto hide-scrollbar">
//               <MealTracked
//                 activeFilter={activeFilter}
//                 weeklyAnalysisData={dataArr}
//               />
//             </div>
//           </div>
//         )}
//       </div>

//       <CreatePlanPopUp open={isModalOpen} onClose={handlePopupClose} onUploaded={handleFoodUploaded}  selectedWeekText={selectedWeekText}/>
//     </>
//   );
// }









// "use client";

// import React, { useEffect, useMemo, useState } from "react";
// import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
// import { useSelector } from "react-redux";
// import { fetchWeeklyAnalysisComplete1 } from "../services/authService";
// import { checkWeeklyAnalysisService } from "../services/authService";
// import CreatePlanPopUp from "./pop-folder/create-plan-popup";
// import MealSidebar from "./meal-sidebar";
// import MealTracked from "./meal-tracked";

// export default function MealLogged() {
//   const [activeFilter, setActiveFilter] = useState("low");
//   const [weeklyAnalysisData, setWeeklyAnalysisData] = useState([]);
//   const [apiMessage, setApiMessage] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [errorType, setErrorType] = useState(null);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   // ✅ FIXED: Initialize with 0
//   const [visibleWeekStart, setVisibleWeekStart] = useState(0);

//   const [selectedWeekIdx, setSelectedWeekIdx] = useState(null);
//   console.log("selectedWeekIdx1399:-", selectedWeekIdx);

//   // ✅ this is the ONLY thing we need from popup
//   const [daysPayload, setDaysPayload] = useState({});

//   const clientProfile = useSelector((state) => state.clientProfile.data);
//   const visibleWeeksCount = 4;

//   const handleFilterChange = (filter) => setActiveFilter(filter);

//   // Fixed date utility functions with UTC handling
//   const toLocalMidnight = (dateStr) => {
//     if (!dateStr) return new Date();
//     const [y, m, d] = String(dateStr).split("-").map(Number);
//     // Create date in UTC to avoid timezone issues
//     return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
//   };

//   const startOfDay = (d) => {
//     const date = new Date(d);
//     date.setUTCHours(0, 0, 0, 0);
//     return date;
//   };

//   const endOfDay = (d) => {
//     const date = new Date(d);
//     date.setUTCHours(23, 59, 59, 999);
//     return date;
//   };

//   const formatDateForApi = (d) => {
//     // Always use UTC for API dates
//     const year = d.getUTCFullYear();
//     const month = String(d.getUTCMonth() + 1).padStart(2, "0");
//     const day = String(d.getUTCDate()).padStart(2, "0");
//     return `${year}-${month}-${day}`;
//   };

//   const withStartOfDayTime = (dateStr) => {
//     return `${dateStr} 00:00:00`;
//   };

//   const withCurrentTime = (dateStr) => {
//     const now = new Date();
//     const hh = String(now.getHours()).padStart(2, "0");
//     const mm = String(now.getMinutes()).padStart(2, "0");
//     const ss = String(now.getSeconds()).padStart(2, "0");
//     return `${dateStr} ${hh}:${mm}:${ss}`;
//   };

//   const fmt = (d) => {
//     // Format for display using UTC
//     const year = d.getUTCFullYear();
//     const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
//     const day = String(d.getUTCDate()).padStart(2, '0');
//     return `${day} ${month} ${year}`;
//   };

//   const dataArr = Array.isArray(weeklyAnalysisData) ? weeklyAnalysisData : [];
//   const totalFoods = dataArr.length;

//   const avgScore = totalFoods
//     ? Math.round(
//         dataArr.reduce((sum, item) => sum + (Number(item.metabolic_compatibility_score) || 0), 0) / totalFoods
//       )
//     : 0;

//   const zone = avgScore >= 80 ? "High" : avgScore >= 61 ? "Moderate" : "Low";

//   const goalCounts = useMemo(() => {
//     return dataArr.reduce((acc, item) => {
//       const key = item.goal_alignment || "Unknown";
//       acc[key] = (acc[key] || 0) + 1;
//       return acc;
//     }, {});
//   }, [dataArr]);

//   const { weeks, currentWeekIdx } = useMemo(() => {
//     const result = { weeks: [], currentWeekIdx: 0 };

//     const dttm = clientProfile?.dttm;
//     if (!dttm) return result;

//     // Parse the date string in UTC
//     const datePart = dttm.split(" ")[0];
//     const [year, month, day] = datePart.split("-").map(Number);
//     const planStartDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
//     const planStart = startOfDay(planStartDate);

//     const today = startOfDay(new Date());
//     const durationDays = Math.ceil((today - planStart) / (1000 * 60 * 60 * 24)) + 1;
//     const numberOfWeeks = Math.ceil(durationDays / 7);

//     const list = [];
//     for (let i = 0; i < numberOfWeeks; i++) {
//       const start = new Date(planStart);
//       start.setUTCDate(planStart.getUTCDate() + i * 7);

//       const end = new Date(start);
//       end.setUTCDate(start.getUTCDate() + 6);

//       list.push({
//         label: `Week ${i + 1}`,
//         startDate: startOfDay(start),
//         endDate: endOfDay(end),
//       });
//     }

//     let idx = list.findIndex((w) => today >= w.startDate && today <= w.endDate);
//     if (idx === -1) idx = 0;

//     result.weeks = list;
//     result.currentWeekIdx = idx;
//     return result;
//   }, [clientProfile]);

//   // ✅ ADD THIS: Update visibleWeekStart when weeks is ready
//   useEffect(() => {
//     if (weeks?.length > 0 && currentWeekIdx !== null) {
//       const middlePosition = 2;
//       const idealStart = Math.max(0, currentWeekIdx - middlePosition);
//       const maxStart = Math.max(0, weeks.length - visibleWeeksCount);
//       const newStart = Math.min(idealStart, maxStart);
  
//       setVisibleWeekStart(newStart);
//     }

//   }, [weeks, currentWeekIdx, visibleWeeksCount]);
  

//   const getWeekDateRange = (weekIdx) => {
//     const w = weeks?.[weekIdx];
//     if (!w) return null;
//     return { start: w.startDate, end: w.endDate };
//   };

//   const formatDisplayDate = (date) => {
//     // Format: "24 January 2026 9:00 PM"
//     const day = date.getDate();
//     const month = date.toLocaleString('en-US', { month: 'long' });
//     const year = date.getFullYear();
//     const hours = date.getHours();
//     const minutes = date.getMinutes().toString().padStart(2, '0');
//     const ampm = hours >= 12 ? 'PM' : 'AM';
//     const formattedHours = hours % 12 || 12;
    
//     return `${day} ${month} ${year} ${formattedHours}:${minutes} ${ampm}`;
//   };

//   const fetchWeeklyAnalysis = async (startDate, endDate, dietPlanId, days) => {
//     setLoading(true);
//     setError(null);
//     setErrorType(null);
//     setApiMessage(null);
  
//     try {
//       // 🔹 STEP 1: CHECK WEEKLY ANALYSIS
//       const checkResponse = await checkWeeklyAnalysisService(
//         clientProfile?.dietician_id,
//         clientProfile?.profile_id,
//         withStartOfDayTime(startDate),
//         withCurrentTime(endDate)  
//         // startDate,
//         // endDate
//       );
  
//       // Check if analysis exists based on the actual response structure
//       const hasAnalysisData = checkResponse?.status === true && 
//                              checkResponse?.data_json?.food_level_evaluation;
  
//       // Parse end date string to Date object (treat as UTC, then convert to local)
//       const [year, month, day] = endDate.split('-').map(Number);
//       const endDateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      
//       // Get today's date at midnight (local time)
//       const today = new Date();
//       const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
//       // Check if this is the current week (end date is today or in the future)
//       const isCurrentWeek = endDateObj >= todayMidnight;
      
//       if (!hasAnalysisData) {
//         // Only proceed to fetchWeeklyAnalysisComplete1 if we have days data
//         if (days && Object.keys(days).length > 0) {
//           const requestBody = {
//             dietician_id: clientProfile?.dietician_id,
//             profile_id: clientProfile?.profile_id,
//             start_date: startDate,
//             end_date: endDate,
//             ...(dietPlanId && { diet_plan_id: dietPlanId }),
//             days: days || {},
//           };
  
//           const response = await fetchWeeklyAnalysisComplete1(requestBody);
  
//           // ✅ CUSTOM MESSAGE HANDLING
//           const apiMsg = response?.message || "";
  
//           if (apiMsg.includes("Latest test data is older than 72 hours")) {
//             setWeeklyAnalysisData([]);
//             setApiMessage({
//               message:
//                 "No test taken in last 72 hrs, so weekly analysis will not be available.",
//             });
//             return;
//           }
  
//           if (response?.api_response?.food_level_evaluation) {
//             setWeeklyAnalysisData(response.api_response.food_level_evaluation);
//             setApiMessage(null);
//           } else if (response?.message) {
//             setWeeklyAnalysisData([]);
//             setApiMessage({ message: response.message });
//           } else {
//             setWeeklyAnalysisData([]);
//             setApiMessage({ 
//               message: "No food data available for this week." 
//             });
//           }
//         } else {
//           // No days data and no existing analysis
//           if (isCurrentWeek) {
//             // For current week, show the "Weekly analysis will be available after" message
//             // Use the exact end date (not incremented by 1)
//             const analysisAvailableDate = new Date(endDateObj);
//             // Set to 9:00 PM on the end date
//             analysisAvailableDate.setHours(21, 0, 0, 0); // 9:00 PM local time
            
//             const formattedDate = formatDisplayDate(analysisAvailableDate);
//             setWeeklyAnalysisData([]);
//             setApiMessage({ 
//               message: `Weekly analysis will be available after ${formattedDate}` 
//             });
//           } else {
//             // For past weeks, show the "Please add food" message
//             setWeeklyAnalysisData([]);
//             setApiMessage({ 
//               message: "No weekly analysis found. Please add food to generate analysis." 
//             });
//           }
//         }
//         return;
//       }
  
//       // 🔹 If we have existing analysis data from check API, use it
//       console.log("Using existing analysis data from check API");
//       setWeeklyAnalysisData(checkResponse.data_json.food_level_evaluation);
//       setApiMessage(null);
  
//     } catch (err) {
//       console.error("API Error:", err);
//       setError(err?.message || "Failed to fetch weekly analysis");
//       setWeeklyAnalysisData([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     const activePlan = clientProfile?.plans_summary?.active?.[0];
  
//     let dietPlanId = null;
//     let planStart = null;
//     let planEnd = null;
  
//     if (activePlan) {
//       dietPlanId = activePlan.id;
//       planStart = toLocalMidnight(activePlan.plan_start_date);
//       planEnd = toLocalMidnight(activePlan.plan_end_date);
//     }
  
//     const weekIdxToUse =
//       selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
  
//     const range = getWeekDateRange(weekIdxToUse);
//     if (!range) return;
  
//     let startDateObj = range.start;
//     let endDateObj = range.end;
  
//     if (planStart && startDateObj < planStart) {
//       startDateObj = planStart;
//     }
  
//     if (planEnd && endDateObj > planEnd) {
//       endDateObj = planEnd;
//     }
  
//     const startDate = formatDateForApi(startDateObj);
//     const endDate = formatDateForApi(endDateObj);
  
//     fetchWeeklyAnalysis(startDate, endDate, dietPlanId, daysPayload);
//   }, [
//     clientProfile,
//     selectedWeekIdx,
//     currentWeekIdx,
//     weeks?.length ?? 0,
//     daysPayload
//   ]);
  
//   // Clear daysPayload when week changes
//   useEffect(() => {
//     setDaysPayload({});
//   }, [selectedWeekIdx, currentWeekIdx]);

//   useEffect(() => {
//     if (selectedWeekIdx === null) return;

//     if (selectedWeekIdx < visibleWeekStart) {
//       setVisibleWeekStart(selectedWeekIdx);
//       return;
//     }

//     if (selectedWeekIdx >= visibleWeekStart + visibleWeeksCount) {
//       setVisibleWeekStart(Math.max(0, selectedWeekIdx - (visibleWeeksCount - 1)));
//     }
//   }, [selectedWeekIdx, visibleWeekStart]);

//   const canGoNext = visibleWeekStart + visibleWeeksCount < (weeks?.length || 0);
//   const canGoPrev = visibleWeekStart > 0;

//   const handleNextWeeks = () => {
//     if (canGoNext) {
//       setVisibleWeekStart((prev) => {
//         const newStart = prev + 1;
//         const maxStart = Math.max(0, (weeks?.length || 0) - visibleWeeksCount);
//         return Math.min(newStart, maxStart);
//       });
//     }
//   };

//   const handlePrevWeeks = () => {
//     if (canGoPrev) {
//       setVisibleWeekStart((prev) => Math.max(0, prev - 1));
//     }
//   };

//   const visibleWeeks = (weeks || []).slice(visibleWeekStart, visibleWeekStart + visibleWeeksCount);

//   const handleCreatePlanClick = () => {
//     localStorage.clear();
//     setIsModalOpen(true);
//   };

//   const handlePopupClose = () => setIsModalOpen(false);

//   const handleFoodUploaded = (days) => {
//     setDaysPayload(days || {});
//     setIsModalOpen(false);
//   };

//   const showMessageState = apiMessage && dataArr.length === 0;
//   const showNoDataState = !apiMessage && dataArr.length === 0 && !loading && !error;
//   const showDataState = dataArr.length > 0;

//   const hideAddFoodButton =
//   apiMessage?.message?.includes("No test taken in last 72 hrs") ||
//   apiMessage?.message?.includes("Weekly analysis will be available after") ||
//   apiMessage?.end_date;

//   const showAddFoodButton = !hideAddFoodButton;

//   const effectiveWeekIdx = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;
//   const selectedWeek = weeks?.[effectiveWeekIdx] || null;

//   const selectedWeekText = selectedWeek
//     ? `${fmt(selectedWeek.startDate)} - ${fmt(selectedWeek.endDate)}`
//     : "";

//   return (
//     <>
//       <div className="flex flex-col gap-[25px] mt-[42px] bg-[#F5F7FA] rounded-[15px] pt-[25px] pl-[30px] pr-7 pb-2.5">
//         <div className="flex justify-between">
//           <span className="text-[#252525] text-[20px] font-semibold tracking-[-0.3] leading-[110%]">
//             Weekly Food Analysis
//           </span>
//         </div>

//         <div className="w-full border-b border-[#E1E6ED]"></div>

//         <div className="flex flex-col gap-9 bg-[#F5F7FA] rounded-[15px]">
//           <div className="flex items-center bg-[#E1E6ED] rounded-[15px] border-4 border-[#F5F7FA]">
//             <div className="flex justify-between w-[170px] py-[30px] pl-[30px]">
//               <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap">
//                 Select a Week
//               </span>

//               <IoIosArrowBack
//                 className={`${canGoPrev ? "text-[#252525] cursor-pointer" : "text-[#A1A1A1] cursor-not-allowed"}`}
//                 onClick={canGoPrev ? handlePrevWeeks : undefined}
//               />
//             </div>

//             <div className="flex items-center">
//               <div className="flex items-center">
//                 {visibleWeeks.map((w, idx) => {
//                   const actualIndex = visibleWeekStart + idx;
//                   const effectiveIdx = selectedWeekIdx === null ? currentWeekIdx : selectedWeekIdx;

//                   const today = new Date();
//                   const todayStart = startOfDay(today);
//                   const range = getWeekDateRange(actualIndex);

//                   const isDisabled = !!(range && range.start > todayStart);
//                   const isSelected = actualIndex === effectiveIdx && !isDisabled;

//                   const wrapBase =
//                     "flex flex-col w-full gap-2.5 pt-[15px] pb-2.5 pr-2.5 pl-[15px] rounded-[8px]";
//                   const wrapClass = isDisabled
//                     ? `${wrapBase} bg-transparent cursor-not-allowed`
//                     : isSelected
//                     ? `${wrapBase} bg-[#308BF9] cursor-pointer`
//                     : `${wrapBase} bg-transparent cursor-pointer`;

//                   const titleClass = isDisabled
//                     ? "text-[#A1A1A1] text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap"
//                     : isSelected
//                     ? "text-white text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap"
//                     : "text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.48px] whitespace-nowrap";

//                   const dateClass = isDisabled
//                     ? "text-[#A1A1A1] text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap"
//                     : isSelected
//                     ? "text-white text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap"
//                     : "text-[#252525] text-[10px] font-normal leading-[110%] tracking-[-0.2px] whitespace-nowrap";

//                   return (
//                     <React.Fragment key={w.label}>
//                       <div
//                         className={wrapClass}
//                         onClick={() => {
//                           if (!isDisabled) setSelectedWeekIdx(actualIndex);
//                         }}
//                       >
//                         <span className={titleClass}>{w.label}</span>
//                         <span className={dateClass}>
//                           {fmt(w.startDate)} - {fmt(w.endDate)}
//                         </span>
//                       </div>

//                       {idx !== visibleWeeks.length - 1 && <div className="border-white border-r h-8 mx-2"></div>}
//                     </React.Fragment>
//                   );
//                 })}
//               </div>

//               <IoIosArrowForward
//                 className={`ml-2 ${canGoNext ? "text-[#252525] cursor-pointer" : "text-[#A1A1A1] cursor-not-allowed"}`}
//                 onClick={canGoNext ? handleNextWeeks : undefined}
//               />
//             </div>
//           </div>
//         </div>

//         {loading && (
//           <div className="px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-[#535359] text-[16px] font-semibold">Loading...</p>
//           </div>
//         )}

//         {error && (
//           <div className="px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-red-600 text-[14px] font-semibold">{error}</p>
//           </div>
//         )}

//         {showDataState && (
//           <div className="flex justify-between bg-[#E1E6ED] rounded-[15px] px-5 py-[19px] ml-[59px] mr-[59px]">
//             <div className="flex flex-col justify-between w-[170px] bg-white rounded-[8px] py-[19px] pl-5 pr-10">
//               <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
//                 {totalFoods}
//               </span>
//               <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
//                 Total Foods
//               </p>
//             </div>

//             <div className="flex gap-20 bg-white rounded-[8px] py-[19px] px-5">
//               <div className="flex flex-col justify-between">
//                 <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
//                   {goalCounts.Support || 0}
//                 </span>
//                 <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
//                   Foods Consumed
//                 </span>
//               </div>

//               <div className="flex flex-col justify-between">
//                 <span className="text-[#252525] text-[25px] font-semibold tracking-[-0.5px] leading-[126%]">
//                   {goalCounts.Low || 0}
//                 </span>
//                 <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[0.2px]">
//                   Foods Missed
//                 </span>
//               </div>
//             </div>

//             <div className="flex flex-col gap-[12px] bg-white rounded-[8px] py-[19px] pl-5 pr-10">
//               <div className="flex flex-col gap-5">
//                 <div className="flex items-center gap-2.5">
//                   <span className="text-[#252525] text-[18px] font-semibold tracking-[-0.5px] leading-[126%]">
//                     {avgScore}
//                   </span>
//                   <div className="w-px h-4 bg-[#D9D9D9]" />
//                   <span className="text-[#252525] text-[18px] font-semibold tracking-[-0.36px] leading-[126%]">
//                     {zone}
//                   </span>
//                 </div>
//                 <div className="flex justify-start">
//                   <svg
//                     xmlns="http://www.w3.org/2000/svg"
//                     width="117"
//                     height="6"
//                     viewBox="0 0 117 6"
//                     fill="none"
//                   >
//                     <path
//                       d="M3 3H114"
//                       stroke="#D9D9D9"
//                       strokeWidth="5"
//                       strokeLinecap="round"
//                     />
//                     <path
//                       d={`M3 3H${Math.max(
//                         3,
//                         Math.min(
//                           114,
//                           Math.round((avgScore / 100) * 111) + 3
//                         )
//                       )}`}
//                       stroke="#FFC412"
//                       strokeWidth="5"
//                       strokeLinecap="round"
//                     />
//                   </svg>
//                 </div>
//               </div>
//               <div>
//                 <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
//                   Overall Metabolic Compatibility Score
//                 </p>
//               </div>
//             </div>
//           </div>
//         )}

//         {showMessageState && (
//           <div className="flex justify-between items-center px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-[16px] font-semibold leading-[110%] tracking-[-0.4px] text-[#535359]">
//               {apiMessage?.message}
//             </p>
//             {showAddFoodButton && (
//               <button
//                 onClick={handleCreatePlanClick}
//                 className="w-[146px] font-semibold text-[#308BF9] text-[12px] px-5 py-[15px] cursor-pointer rounded-[10px] bg-[#FFFFFF] border border-[#308BF9]"
//               >
//                 Add Food
//               </button>
//             )}
//           </div>
//         )}

//         {showNoDataState && (
//           <div className="flex justify-between items-center px-5 py-[19px] bg-[#E1E6ED] rounded-[15px]">
//             <p className="text-[16px] font-semibold leading-[110%] tracking-[-0.4px] text-[#535359]">
//               No food added for this week.
//             </p>
//             {showAddFoodButton && (
//               <button
//                 onClick={handleCreatePlanClick}
//                 className="w-[146px] font-semibold text-[#308BF9] text-[12px] px-5 py-[15px] cursor-pointer rounded-[10px] bg-[#FFFFFF] border border-[#308BF9]"
//               >
//                 Add Food
//               </button>
//             )}
//           </div>
//         )}

//         {showDataState && (
//           <div className="flex gap-[5px]">
//             <MealSidebar
//               activeFilter={activeFilter}
//               onFilterChange={handleFilterChange}
//               weeklyAnalysisData={dataArr}
//             />
//             <div className="w-full max-h-[600px] overflow-y-auto hide-scrollbar">
//               <MealTracked
//                 activeFilter={activeFilter}
//                 weeklyAnalysisData={dataArr}
//               />
//             </div>
//           </div>
//         )}
//       </div>

//       <CreatePlanPopUp open={isModalOpen} onClose={handlePopupClose} onUploaded={handleFoodUploaded}  selectedWeekText={selectedWeekText}/>
//     </>
//   );
// }

