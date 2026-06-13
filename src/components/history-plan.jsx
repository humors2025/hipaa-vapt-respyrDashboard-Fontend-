


"use client"
import Image from "next/image"
import { ResultEvaluation } from "./result-evaluation"
import { useSelector } from "react-redux"
import { useEffect, useState } from "react"
import { fetchClientLog } from "../services/authService"
import { cookieManager } from "../lib/cookies"

export default function HistoryPlan() {
    
  // Get client profile data from Redux store
  const clientProfile = useSelector((state) => state.clientProfile?.data);
  
  // State for client log data, loading, and error
  const [clientLogData, setClientLogData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to get profile_id from URL parameters
  const getProfileIdFromURL = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('profile_id');
    }
    return null;
  };

  // Function to get dietician_id from cookies
  const getDieticianId = () => {
    return cookieManager.get('dietician');
  };

  // Fetch client log data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const dieticianId = getDieticianId();
        const profileId = getProfileIdFromURL();
        
        // Check if required IDs are available
        if (!dieticianId || !profileId) {
          throw new Error("Missing dietician ID or profile ID");
        }

        // Fetch client log data from API
        const response = await fetchClientLog(dieticianId, profileId);
        setClientLogData(response);
      } catch (err) {
        console.error("Error fetching client log:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Function to get the current plan with proper status handling
  const getCurrentPlan = () => {
    if (!clientProfile?.plans_summary) return null;

    const { active, completed, not_started } = clientProfile.plans_summary;
    
    // Priority order: active > completed > not_started
    // Return active plan if available
    if (active && active.length > 0) {
      return { ...active[0], actualStatus: 'active' };
    }
    
    // Return completed plan if available
    if (completed && completed.length > 0) {
      return { ...completed[0], actualStatus: 'completed' };
    }
    
    // Return not_started plan if available
    if (not_started && not_started.length > 0) {
      // Handle the case where plan_status and status might be inconsistent
      const plan = not_started[0];
      let actualStatus = 'not_started';
      
      // If status is 'active' but in not_started array, use plan_status
      if (plan.status === 'active' && plan.plan_status) {
        actualStatus = plan.plan_status;
      } else if (plan.status) {
        actualStatus = plan.status;
      }
      
      return { ...plan, actualStatus };
    }
    
    return null;
  };

  // Get the current plan
  const currentPlan = getCurrentPlan();
  
  // Function to calculate plan duration
  const getPlanDuration = () => {
    if (!currentPlan?.plan_start_date || !currentPlan?.plan_end_date) return "1-Month Plan";
    
    const startDate = new Date(currentPlan.plan_start_date);
    const endDate = new Date(currentPlan.plan_end_date);
    
    // Calculate total days difference
    const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // Handle plans less than 30 days
    if (daysDiff < 30) {
      return `${daysDiff}-Day Plan`;
    }
    
    // Calculate months difference
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                      (endDate.getMonth() - startDate.getMonth());
    
    if (monthsDiff === 1) {
      return "1-Month Plan";
    } else if (monthsDiff > 1) {
      return `${monthsDiff}-Month Plan`;
    } else {
      return "1-Month Plan";
    }
  };

  // Function to format date range for display
  const getFormattedDateRange = () => {
    if (!currentPlan?.plan_start_date || !currentPlan?.plan_end_date) return "05 July-05 Aug";
    
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'short' 
      });
    };
    
    return `${formatDate(currentPlan.plan_start_date)}-${formatDate(currentPlan.plan_end_date)}`;
  };

  // Function to get status text based on actual status
  const getStatusText = () => {
    if (!currentPlan?.actualStatus) return "Pending";
    
    const statusMap = {
      'active': 'Active',
      'completed': 'Completed', 
      'not_started': 'Not Started',
      'pending': 'Pending'
    };
    
    return statusMap[currentPlan.actualStatus] || 'Pending';
  };

  // Function to get status color based on actual status
  const getStatusColor = () => {
    if (!currentPlan?.actualStatus) return "#DA5747";
    
    const colorMap = {
      'active': '#3FAF58',      // Green for active
      'completed': '#535359',   // Gray for completed
      'not_started': '#DA5747', // Red for not started
      'pending': '#DA5747'      // Red for pending
    };
    
    return colorMap[currentPlan.actualStatus] || '#DA5747';
  };

  // Function to get plan progress based on actual status
  const getPlanProgress = () => {
    if (!clientProfile?.plans_count) return "(0/1)";
    
    const { active, completed, not_started, total } = clientProfile.plans_count;
    
    // Use actualStatus from currentPlan to determine which count to show
    if (currentPlan?.actualStatus === 'active') {
      return `(${active}/${total})`;
    }
    else if (currentPlan?.actualStatus === 'completed') {
      return `(${completed}/${total})`;
    }
    else if (currentPlan?.actualStatus === 'not_started') {
      return `(${not_started}/${total})`;
    }
    else {
      return `(${active || 0}/${total || 1})`;
    }
  };

  // Function to parse goal data safely with error handling
  const getGoalData = () => {
    if (!currentPlan?.goal) return { name: 'Weight Loss', current_stat: '-', target_stat: '-' };
    
    try {
      const goalArray = JSON.parse(currentPlan.goal);
      if (goalArray && goalArray.length > 0) {
        return {
          name: goalArray[0]?.name || 'Weight Loss',
          current_stat: goalArray[0]?.current_stat || '-',
          target_stat: goalArray[0]?.target_stat || '-'
        };
      }
    } catch (error) {
      console.error("Error parsing goal data:", error);
    }
    
    return { name: 'Weight Loss', current_stat: '-', target_stat: '-' };
  };

  // Get parsed goal data
  const goalData = getGoalData();

  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="w-full flex justify-center items-center p-8">
        Loading...
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="w-full flex justify-center items-center p-8 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <>
      <div className="w-full flex flex-col rounded-[10px] bg-white">

        {/* Plan Header Section */}
        <div className="flex justify-between items-start pt-[30px] pl-[30px] pr-[25px]">
          <div className="flex justify-between">
            <div className="flex flex-col gap-[15px]">
              <div className="flex gap-5 justify-between items-center">
                {/* Plan Duration */}
                <span className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
                  {/* {getPlanDuration()} */}
                  {currentPlan?.plan_title || "-"}
                </span>
                {/* Date Range */}
                <span className="items-end text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24]">
                  {getFormattedDateRange()}
                </span>
              </div>
              {/* Plan Status */}
              <div className="flex gap-[3px]">
                <span 
                  className="text-[12px] font-normal leading-normal tracking-[-0.24px]" 
                  style={{ color: getStatusColor() }}
                >
                  Status {getStatusText()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-[20px] mx-[15px] border border-[#E1E6ED]"></div>

        {/* Plan Summary Section */}
        <div className="mx-[15px] mt-4 rounded-[15px] bg-[#F5F7FA]">
          <div className="flex flex-col gap-2.5 pt-[21px] pl-[30px]">
            <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[0.4px]">
              Plan Summary
            </span>
            <div className="flex gap-[3px]">
              <span 
                className="text-[12px] font-normal leading-normal tracking-[-0.24px]" 
                style={{ color: getStatusColor() }}
              >
                {getStatusText()} {getPlanProgress()}
              </span>
            </div>
          </div>
          
          {/* Divider */}
          <div className="my-[20px] mx-[15px] border border-[#E1E6ED]"></div>

          {/* Goal Section */}
          <div className="flex flex-col gap-5">
            <div className="flex gap-[5px] pl-[30px]">
              <Image
                src="/icons/hugeicons_award-01.svg"
                alt="hugeicons_award-01.svg"
                width={15}
                height={15}
              />
              <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[0.24px]">
                Goal
              </span>
            </div>

            <div className="flex justify-between pl-[50px] pr-[99px]">
              <div className="flex flex-col gap-5">
                {/* Goal Name */}
                <span className="text-[#535359] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">
                  {goalData.name}
                </span>

                <div className="flex items-center gap-5">
                  {/* Current Stat */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[#252525] text-[20px] font-bold leading-[126%] tracking-[-0.4px]">
                      {goalData.current_stat}
                    </span>
                    <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                      Past stat
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center h-px my-[7px] w-[205px] border border-[#E1E6ED]"></div>

                  {/* Target Stat */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[#252525] text-[20px] font-bold leading-[126%] tracking-[-0.4px]">
                      {goalData.target_stat}
                    </span>
                    <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                      Target stat
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-[20px] mx-[15px] border border-[#E1E6ED]"></div>

          {/* Approach Section */}
          <div className="flex flex-col gap-[22px] mb-[30px]">
            <div className="flex gap-[5px] pl-[30px]">
              <Image
                src="/icons/hugeicons_sparkles.svg"
                alt="hugeicons_sparkles.svg"
                width={15}
                height={15}
              />
              <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[0.24px]">
                Approach
              </span>
            </div>

            {/* Approach Tags */}
            <div className="flex gap-[5px] ml-[50px]">
              {currentPlan?.approach ? (
                // Render approach tags if available
                currentPlan.approach.split(',').map((approach, index) => (
                  <div 
                    key={index}
                    className={`px-5 py-[5px] rounded-[20px] bg-white text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${
                      index === 0 ? 'text-[#252525]' : 'text-[#535359]'
                    }`}
                  >
                    {approach.trim()}
                  </div>
                ))
              ) : (
                // Fallback if no approach data
                <>
                  <div className="px-5 py-[5px] rounded-[20px] bg-white text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">
                    -
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Client Log Header Section */}
        <div className="flex justify-between items-start pt-[70px] pl-[30px] pr-[25px]">
          <div className="flex justify-between">
            <div className="flex flex-col gap-[10px]">
              <div className="flex gap-5 justify-between items-center">
                <span className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
                  Client Log
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-[20px] mx-[15px] border border-[#E1E6ED]"></div>

        {/* Client Log Statistics Section */}
        <div className="flex flex-col gap-[15px]">
          <div className="flex gap-[442px]">
            {/* Test Log Header */}
            <div className="flex gap-[5px] pl-[30px]">
              <Image
                src="/icons/hugeicons_note-01.svg"
                alt="hugeicons_note-01.svg"
                width={15}
                height={15}
              />
              <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[0.24px]">
                Test Log
              </span>
            </div>

            {/* Meal Log Header */}
            <div className="flex gap-[5px] pl-[30px]">
              <Image
                src="/icons/hugeicons_rice-bowl-01.svg"
                alt="hugeicons_rice-bowl-01"
                width={15}
                height={15}
              />
              <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[0.24px]">
                Meal Log
              </span>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="flex gap-5 mx-5">
            {/* Tests Taken Card */}
            <div className="w-full py-[15px] pl-[15px] pr-[81px] rounded-[10px] bg-[#F5F7FA]">
              <div className="flex items-start flex-col gap-[27px]">
                <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Tests Taken
                </span>
                <div className="flex flex-col gap-[5px]">
                  <span className="text-[#252525] text-[25px] font-semibold leading-[126%] tracking-[-0.5px]">
                    {clientLogData?.data?.[0]?.test_days_till_today || "0"}
                  </span>
                  <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                    out of {clientLogData?.data?.[0]?.tests_total || "-"} tests
                  </span>
                </div>
              </div>
            </div>

            {/* Tests Missed Card */}
            <div className="w-full py-[15px] pl-[15px] pr-[81px] rounded-[10px] bg-[#F5F7FA]">
              <div className="flex items-start flex-col gap-[27px]">
                <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Tests Missed
                </span>
                <div className="flex flex-col gap-[5px]">
                  <span className="text-[#252525] text-[25px] font-semibold leading-[126%] tracking-[-0.5px]">
                    {clientLogData?.data?.[0]?.missed_days_till_today || "0"}
                  </span>
                  <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                    out of {clientLogData?.data?.[0]?.tests_total || "-"} tests
                  </span>
                </div>
              </div>
            </div>

            {/* Days Logged Card */}
            <div className="w-full py-[15px] pl-[15px] pr-[81px] rounded-[10px] bg-[#F5F7FA]">
              <div className="flex items-start flex-col gap-[27px]">
                <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Days Logged
                </span>
                <div className="flex flex-col gap-[5px]">
                  <span className="text-[#252525] text-[25px] font-semibold leading-[126%] tracking-[-0.5px]">
                    {clientLogData?.data?.[0]?.food_log_days || "0"}
                  </span>
                  <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                    out of {clientLogData?.data?.[0]?.tests_total || "-"} tests
                  </span>
                </div>
              </div>
            </div>

            {/* Days Missed Card */}
            <div className="w-full py-[15px] pl-[15px] pr-[81px] rounded-[10px] bg-[#F5F7FA]">
              <div className="flex items-start flex-col gap-[27px]">
                <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Days Missed
                </span>
                <div className="flex flex-col gap-[5px]">
                  <span className="text-[#252525] text-[25px] font-semibold leading-[126%] tracking-[-0.5px]">
                    {clientLogData?.data?.[0]?.food_log_missed_days || "0"}
                  </span>
                  <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                    out of {clientLogData?.data?.[0]?.tests_total || "-"} tests
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Result Evaluation Component */}
        <ResultEvaluation/>
      </div>
    </>
  )
}