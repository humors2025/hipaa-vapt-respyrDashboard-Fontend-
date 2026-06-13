
"use client"
import Image from "next/image"
import { IoIosArrowForward } from "react-icons/io";
import ClientRisk from "./client-risk";
import DashboardGraph from "./dashboard-graph";
import { useState, useRef, useEffect } from 'react';
import { fetchTestAnalytics } from "../services/authService";
import { cookieManager } from "../lib/cookies";
import DietPlanMonitor from "./diet-plan-monitor";

export default function TestMonitor() {
  // Initialize with today's date in YYYY-MM-DD format
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [showCalendar, setShowCalendar] = useState(false);
  const [testAnalyticsData, setTestAnalyticsData] = useState(null);
 
  const [loading, setLoading] = useState(false);
  const [dieticianId, setDieticianId] = useState("");   

  const datePickerRef = useRef(null);
  const calendarRef = useRef(null);

  // 👇 Get dietician_id from "dietician" cookie on mount
  useEffect(() => {
    const dieticianCookie = cookieManager.getJSON("dietician");

    if (dieticianCookie && dieticianCookie.dietician_id) {
      setDieticianId(dieticianCookie.dietician_id);
    } else {
      console.warn("No dietician cookie found or dietician_id missing");
    }
  }, []);

  // Format date as "Today, 12 April 2025"
  const formatDate = (dateString) => {
    if (!dateString) {
      const today = new Date();
      const day = today.getDate();
      const month = today.toLocaleString('en-US', { month: 'long' });
      const year = today.getFullYear();
      return `Today, ${day} ${month} ${year}`;
    }

    const date = new Date(dateString);
    const today = new Date();
    
    // Check if the date is today
    const isToday = date.toDateString() === today.toDateString();
    
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    
    return isToday ? `Today, ${day} ${month} ${year}` : `${day} ${month} ${year}`;
  };

  // Fetch test analytics data
  const fetchTestAnalyticsData = async (date = "") => {
    if (!dieticianId) return; // wait until cookie is loaded

    setLoading(true);
    try {
   const response = await fetchTestAnalytics(dieticianId, date);
        //const response = await fetchTestAnalytics("Respyrd01", date);
      setTestAnalyticsData(response);
    } catch (error) {
      console.error("Error fetching test analytics:", error);
      setTestAnalyticsData(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals from analytics data for selected date (sum of last 7 days)
  const calculateTotals = () => {
    if (!testAnalyticsData?.days || testAnalyticsData.days.length === 0) {
      return { tested: 0, notTested: 0 };
    }

    // Use today's date if no date is selected (shouldn't happen now, but as fallback)
    const dateToUse = selectedDate || getTodayDateString();

    // Create a map of existing data by date for quick lookup
    const dataMap = new Map();
    testAnalyticsData.days.forEach(day => {
      dataMap.set(day.date, day);
    });

    // Generate all 7 dates (selected date and 6 days before) and sum totals
    const selectedDateObj = new Date(dateToUse);
    let tested = 0;
    let notTested = 0;
    
    for (let i = 6; i >= 0; i--) {
      const currentDate = new Date(selectedDateObj);
      currentDate.setDate(currentDate.getDate() - i);
      
      // Format date as YYYY-MM-DD
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Check if data exists for this date
      const existingData = dataMap.get(dateString);
      
      if (existingData) {
        tested += existingData.tested_clients || 0;
        notTested += existingData.not_tested_clients || 0;
      }
      // If no data, values remain 0 (no need to add anything)
    }

    return { tested, notTested };
  };

  // Get filtered data for DashboardGraph based on selected date (last 7 days ending on selected date)
  const getFilteredGraphData = () => {
    if (!testAnalyticsData?.days) return null;

    // Use today's date if no date is selected (shouldn't happen now, but as fallback)
    const dateToUse = selectedDate || getTodayDateString();

    // Create a map of existing data by date for quick lookup
    const dataMap = new Map();
    testAnalyticsData.days.forEach(day => {
      dataMap.set(day.date, day);
    });

    // Generate all 7 dates (selected date and 6 days before)
    const selectedDateObj = new Date(dateToUse);
    const sevenDays = [];
    
    for (let i = 6; i >= 0; i--) {
      const currentDate = new Date(selectedDateObj);
      currentDate.setDate(currentDate.getDate() - i);
      
      // Format date as YYYY-MM-DD
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Check if data exists for this date
      const existingData = dataMap.get(dateString);
      
      if (existingData) {
        // Use existing data
        sevenDays.push(existingData);
      } else {
        // Create empty entry for missing dates
        sevenDays.push({
          date: dateString,
          tested_clients: 0,
          not_tested_clients: 0
        });
      }
    }

    return {
      ...testAnalyticsData,
      days: sevenDays
    };
  };

  const totals = calculateTotals();
  const filteredGraphData = getFilteredGraphData();

  // Open calendar picker
  const openCalendar = () => {
    if (datePickerRef.current) {
      if (datePickerRef.current.showPicker) {
        datePickerRef.current.showPicker();
      } else {
        datePickerRef.current.click();
      }
    }
  };

  // Handle date selection
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setShowCalendar(false);
    // We don't need to fetch new data, we'll filter the existing data
  };

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch data when dieticianId is available or changes
  useEffect(() => {
    if (dieticianId) {
      fetchTestAnalyticsData(""); // Fetch all data initially
    }
  }, [dieticianId]);

  return (
    <>
      <div className="border border-[#E1E6ED] rounded-[10px] px-[15px] pt-[30px] pb-2">
        <div className="flex justify-between pb-[23px] ">
          <span className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
            Test Analytics
          </span>

          <div className="flex gap-5 items-center relative" ref={calendarRef}>
            <span className="text-[#A1A1A1] text-[12px] font-normal leading-normal tracking-[-0.24px]">
              {formatDate(selectedDate)}
            </span>
            <div
              className="cursor-pointer"
              onClick={openCalendar}
            >
              <Image
                src="/icons/hugeicons_calendar-03.svg"
                alt="hugeicons_calendar-03.svg"
                width={24}
                height={24}
              />
            </div>

            {/* Hidden native date input */}
            <input
              ref={datePickerRef}
              type="date"
              className="sr-only"
              value={selectedDate}
              onChange={handleDateChange}
            />
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <span className="pl-3.5 text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] mt-[30px] hidden">
            Tests Tracking
          </span>

          <div className="flex gap-5">
            <div className="flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 w-full">
              <div className="flex gap-[5px]">
                <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
                  Client Tracked
                </span>
              </div>
              {loading ? (
                <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">...</span>
              ) : (
                <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
                  {totals.tested}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-10 bg-[#F5F7FA] border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 w-full">
              <div className="w-[333px] flex gap-[69px]">
                <div className="flex gap-[5px]">
                  <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
                    Client Not tracked
                  </span>
                </div>
                {/* <div className="flex gap-2.5">
                  <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                    Send Reminder
                  </span>
                  <IoIosArrowForward className="text-[#308BF9]" />
                </div> */}
              </div>
              {loading ? (
                <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">...</span>
              ) : (
                <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
                  {totals.notTested}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-[34px]">
          <DashboardGraph testAnalyticsData={filteredGraphData} />
        </div>

        {/* <div className="flex flex-col gap-[26px]">
          <span className="mt-10 ml-3.5 text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
            Tests Results
          </span>
          <ClientRisk hideDietGoal={true} />
         
        </div> */}
      </div>
    </>
  );
}