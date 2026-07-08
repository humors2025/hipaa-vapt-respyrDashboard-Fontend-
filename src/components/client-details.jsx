"use client";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { IoChevronBackOutline, IoChevronForwardOutline } from "react-icons/io5";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams, usePathname } from "next/navigation";
import TestAnalysis from "./test-analysis";
import DietAnalysis from "./diet-analysis";
import MacrosAnalysis from "./macros-analysis";
import HabitsAnalysis from "./habits-analysis";
// import TrainerDirection from "./trainer-direction";
import TrainerDirection from "./training-direction/TrainerDirection";
import RightSidebar from "./rightSidebar";
import PDFLoadingModal from "./PDFLoadingModal";
import { exportDietAnalysisPDF } from "../lib/pdfExport";
import {
  getClientIndividualProfile,
  selectClientIndividualProfileData,
} from "../store/clientIndividualProfileSlice";
import {
  getDietAnalysisPlan,
  selectDietAnalysisData,
} from "../store/dietAnalysisSlice";
import {
  getMacroSummary,
  selectMacroSummaryData
} from "../store/macroSummarySlice";
import { getTrainerDirection } from "../store/trainerDirectionSlice";
import {
  fetchClientProfileDatesList,
  fetchClientWeeklyDates,
} from "../services/authService";

import { cookieManager } from "../lib/cookies";
import { zoneLabel } from "../lib/utils";

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export default function ClientDetails() {
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isMaskingRoute = pathname?.startsWith("/superadmin-trainer");

  const individualProfileData = useSelector(selectClientIndividualProfileData);

  const dietAnalysisData = useSelector(selectDietAnalysisData);

  const [profileDates, setProfileDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesError, setDatesError] = useState(null);

  const [weeklyDates, setWeeklyDates] = useState([]);
  const [weeklyDatesLoading, setWeeklyDatesLoading] = useState(false);
  const [weeklyDatesError, setWeeklyDatesError] = useState(null);
  const [isDietAnalysisAvailable, setIsDietAnalysisAvailable] = useState(true);
  const [isLoadingWeeklyData, setIsLoadingWeeklyData] = useState(true);
  const [isPDFExporting, setIsPDFExporting] = useState(false);

  const [activeTab, setActiveTab] = useState("test");
  const [activeIndex, setActiveIndex] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  const cardRef = useRef(null);

  // Forward wheel scrolling from the non-scrollable areas (header, tabs,
  // date selector) down to whichever content panel is currently visible,
  // so the user can scroll TestAnalysis (or any active tab) from anywhere
  // on the card.
  const handleCardWheel = (e) => {
    const card = cardRef.current;
    if (!card) return;

    const scrollTarget = card.querySelector(".scroll-target:not(.hidden)");
    if (!scrollTarget) return;

    // If the cursor is already over the scrollable panel, let the browser
    // scroll it natively to avoid double-scrolling.
    if (scrollTarget.contains(e.target)) return;

    scrollTarget.scrollTop += e.deltaY;
  };

  useEffect(() => {
    const token = cookieManager.get("access_token");
    const decoded = token ? decodeJwt(token) : null;
    setIsSuperAdmin(decoded?.role === "super_admin");
    setRoleChecked(true);
  }, []);

  const showWhenNotSuperAdmin = roleChecked && !isSuperAdmin;
  // const showProfileInfo = roleChecked && (!isSuperAdmin || isMaskingRoute);

  const profileId = searchParams.get("profile_id");
  const dietitianData = cookieManager.getJSON("dietician");
  const dietitianId = dietitianData?.dietician_id || null;

  const formatGoal = (goal) => {
    if (!goal || goal === "NA") return "NA";
    return goal
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

const transformDatesToDisplay = () => {
  if (!profileDates || profileDates.length === 0) return [];

  return profileDates.map((dateObj) => ({
    date: dateObj.display_date,
    rawDate: dateObj.date,
    score: dateObj.fat_loss_metabolism_score
      ? `${dateObj.fat_loss_metabolism_score}%`
      : "NA",
    status: zoneLabel(dateObj.zone) || "NA",
    kcal: dateObj.final_macro_summary?.calories
      ? `${dateObj.final_macro_summary.calories} Kcal`
      : "NA",
  }));
};


  const transformWeeklyDatesToDisplay = () => {
    if (!weeklyDates || weeklyDates.length === 0) return [];

    return weeklyDates.map((weekObj) => ({
      week: weekObj.week_label,
      range: weekObj.week_range,
      weekStartDate: weekObj.week_start_date,
      weekEndDate: weekObj.week_end_date,
      monthLabel: weekObj.month_label,
      weekNoInMonth: weekObj.week_no_in_month,
    }));
  };

  const testDateData = transformDatesToDisplay();
  const weekData = transformWeeklyDatesToDisplay();

  const getSelectedWeekInfo = () => {
    if (activeTab === "diet" && weekData[activeIndex]) {
      return weekData[activeIndex].week;
    }
    return "report";
  };

  const profileDetails = individualProfileData?.data?.profile_details || {};
  const userHabits = individualProfileData?.data?.user_habits;

  const handleExportPDF = async () => {
    if (activeTab !== "diet") {
      toast.warning("PDF export is only available for Weekly Diet Analysis tab");
      return;
    }

    if (!dietAnalysisData?.data?.food_json) {
      toast.error("Diet analysis data is not available yet.");
      return;
    }

    setIsPDFExporting(true);
    try {
      const clientName = profileDetails?.profile_name || "client";
      const selectedWeek = getSelectedWeekInfo();

      await exportDietAnalysisPDF(clientName, selectedWeek, dietAnalysisData);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsPDFExporting(false);
    }
  };

  useEffect(() => {
    const loadProfileDates = async () => {
      if (!profileId) return;

      setDatesLoading(true);
      setDatesError(null);
      setProfileDates([]);
      setActiveIndex(0);
      setStartIndex(0);

      try {
        const response = await fetchClientProfileDatesList(profileId, dietitianId);
        if (response.status && response.data) {
          const dates = response.data.dates || [];
          setProfileDates(dates);

          if (dates.length > 0) {
            dispatch(
              getClientIndividualProfile({
                profileId,
                date: dates[0].date,
                dietitianId: dietitianId,
                masking: isMaskingRoute,
              })
            );
          }
        } else {
          setProfileDates([]);
        }
      } catch (error) {
        console.error("Error fetching profile dates:", error);
        setDatesError(error.message || "Failed to load dates");
        setProfileDates([]);
      } finally {
        setDatesLoading(false);
      }
    };

    if (dietitianId) {
      loadProfileDates();
    }
  }, [profileId, dispatch, dietitianId, isMaskingRoute]);

  useEffect(() => {
    const loadWeeklyDates = async () => {
      if (!profileId) return;

      setWeeklyDatesLoading(true);
      setIsLoadingWeeklyData(true);
      setWeeklyDatesError(null);
      setWeeklyDates([]);
      setIsDietAnalysisAvailable(true);

      try {
        const response = await fetchClientWeeklyDates(profileId, dietitianId);

        if (
          response &&
          response.status === false &&
          response.message?.includes("No weekly data")
        ) {
          setIsDietAnalysisAvailable(false);
          setWeeklyDates([]);

          if (activeTab === "diet") {
            setActiveTab("test");
          }
        } else if (response && response.status === true && response.data) {
          const weeks = response.data || [];
          setWeeklyDates(weeks);
          setIsDietAnalysisAvailable(true);

          if (weeks.length > 0) {
            const firstWeek = weeks[0];
            dispatch(
              getDietAnalysisPlan({
                profileId,
                weekStartDate: firstWeek.week_start_date,
                weekEndDate: firstWeek.week_end_date,
              })
            );
          }
        } else {
          setWeeklyDates([]);
          setIsDietAnalysisAvailable(true);
        }
      } catch (error) {
        console.error("Error fetching weekly dates:", error);

        if (error.message?.includes("No weekly data")) {
          setIsDietAnalysisAvailable(false);
          setWeeklyDates([]);

          if (activeTab === "diet") {
            setActiveTab("test");
          }
        } else {
          setWeeklyDatesError(error.message || "Failed to load weekly dates");
          setWeeklyDates([]);
          setIsDietAnalysisAvailable(true);
        }
      } finally {
        setWeeklyDatesLoading(false);
        setIsLoadingWeeklyData(false);
      }
    };

    loadWeeklyDates();
  }, [profileId, dispatch, activeTab, dietitianId]);


  useEffect(() => {
  if (activeTab === "trainer" && profileDates.length > 0 && dietitianId) {
    const selectedDate = profileDates[activeIndex] || profileDates[0];
    if (selectedDate?.date) {
      dispatch(
        getTrainerDirection({
          profileId,
          dietitianId,
          date: selectedDate.date,
        })
      );
    }
  }
}, [activeTab, profileDates, activeIndex, profileId, dietitianId, dispatch]);



  const formatJoinedDate = (dateString) => {
    if (!dateString || dateString === "NA") return "NA";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "NA";
    return date.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  };

  const ITEMS_TO_SHOW = 4;
  const currentData =
    activeTab === "diet" ? weekData : testDateData;

  const handleBack = () => {
    if (startIndex > 0) {
      const newStartIndex = startIndex - 1;
      setStartIndex(newStartIndex);
      if (
        !(
          activeIndex >= newStartIndex &&
          activeIndex < newStartIndex + ITEMS_TO_SHOW
        )
      ) {
        setActiveIndex(newStartIndex);
      }
    }
  };

  const handleForward = () => {
    if (startIndex + ITEMS_TO_SHOW < currentData.length) {
      const newStartIndex = startIndex + 1;
      setStartIndex(newStartIndex);
      if (
        !(
          activeIndex >= newStartIndex &&
          activeIndex < newStartIndex + ITEMS_TO_SHOW
        )
      ) {
        setActiveIndex(newStartIndex);
      }
    }
  };

  const handleTabChange = (tab) => {
    if (tab === "diet" && !isDietAnalysisAvailable) {
      return;
    }
    setActiveTab(tab);
    setActiveIndex(0);
    setStartIndex(0);
  };

  const handleDateSelect = (actualIndex) => {
    setActiveIndex(actualIndex);
    const selectedDate = testDateData[actualIndex];

    if (selectedDate?.rawDate) {
      dispatch(
        getClientIndividualProfile({
          profileId,
          date: selectedDate.rawDate,
          dietitianId: dietitianId,
          masking: isMaskingRoute,
        })
      );

      // Fetch macro summary for the selected date
      dispatch(
        getMacroSummary({
          profileId,
          date: selectedDate.rawDate,
          dietitianId,
        })
      );
    }
  };



  useEffect(() => {
    if (activeTab === "macros" && profileDates.length > 0) {
      const selectedDate = profileDates[activeIndex] || profileDates[0];
      if (selectedDate?.date) {
        dispatch(
          getMacroSummary({
            profileId,
            date: selectedDate.date,
            dietitianId,
          })
        );
      }
    }
  }, [activeTab, profileDates, activeIndex, profileId, dispatch]);


  const handleWeekSelect = (actualIndex) => {
    setActiveIndex(actualIndex);
    const selectedWeek = weekData[actualIndex];

    if (selectedWeek?.weekStartDate && selectedWeek?.weekEndDate) {
      dispatch(
        getDietAnalysisPlan({
          profileId,
          weekStartDate: selectedWeek.weekStartDate,
          weekEndDate: selectedWeek.weekEndDate,
        })
      );
    }
  };

  const visibleItems = currentData.slice(startIndex, startIndex + ITEMS_TO_SHOW);

  if (isLoadingWeeklyData) {
    return (
      <div className="w-full h-[calc(88vh-24px)] bg-white rounded-[15px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading client data...</p>
        </div>
      </div>
    );
  }

  if (
    (datesLoading && (activeTab === "test" || activeTab === "macros")) ||
    (weeklyDatesLoading && activeTab === "diet")
  ) {
    return (
      <div className="w-full h-[calc(88vh-24px)] bg-white rounded-[15px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {activeTab === "diet" ? "Loading weeks..." : "Loading dates..."}
          </p>
        </div>
      </div>
    );
  }

  if (
    (datesError && (activeTab === "test" || activeTab === "macros")) ||
    (weeklyDatesError && activeTab === "diet")
  ) {
    return (
      // <div className="w-full h-[calc(88vh-24px)] bg-white rounded-[15px] flex items-center justify-center">
      //   <div className="text-center">
      //     <div className="text-red-500 text-4xl mb-4">⚠️</div>
      //     <p className="text-red-600 mb-2">
      //       {activeTab === "diet"
      //         ? "Failed to load weeks"
      //         : "Failed to load dates"}
      //     </p>
      //     <button
      //       onClick={() => window.location.reload()}
      //       className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
      //     >
      //       Retry
      //     </button>
      //   </div>
      // </div>


      <div className="w-full h-[calc(88vh-24px)] bg-white rounded-[15px] flex items-center justify-center">
  <div className="flex flex-col gap-2.5 text-center">
    <div className="flex items-center justify-center">
      <Image
      src="/icons/freepic-sad.png"
      alt="freepic-sad.png"
      width={80}
      height={80}
      />
  </div>
  <div className="flex flex-col">
    <p className="text-gray-600 font-medium mb-1">
      Client hasn't taken their first test yet
    </p>
    <p className="text-gray-500 text-sm">
      Data will appear after the first test is completed.
    </p>
    </div>
  
    </div>
</div>
    );
  }

  return (
    <>
      <PDFLoadingModal isOpen={isPDFExporting} />

      <div className="w-full relative overflow-hidden">
        {isSidebarOpen && (
          <div
            className="absolute inset-0 bg-black/30 z-40 transition-all duration-300 rounded-[15px]"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div
          ref={cardRef}
          onWheel={handleCardWheel}
          className={`w-full h-full bg-white px-[15px] pt-[23px] pb-5 rounded-[15px] flex flex-col overflow-hidden transition-all duration-300 relative ${isSidebarOpen ? "opacity-90" : "opacity-100"
            }`}
        >
          <div className="flex justify-between items-center pb-[22px] border-b border-[#E1E6ED]">
            <div className="flex gap-[15px]">
             
                <div className="rounded-full w-12 h-12 flex items-center justify-center overflow-hidden">
                  {profileDetails?.profile_image &&
                    profileDetails?.profile_image !== "NA" ? (
                    <Image
                      // src={profileDetails.profile_image}
                         src="/icons/hugeicons_user-circle-02.svg"
                      alt={profileDetails?.profile_name || "user"}
                      width={48}
                      height={48}
                      className="rounded-full object-cover w-[48px] h-[48px]"
                    />
                  ) : (
                    <Image
                      src="/icons/hugeicons_user-circle-02.svg"
                      alt="user"
                      width={48}
                      height={48}
                    />
                  )}
                </div>
            

              <div className="flex flex-col gap-3">
                <div className="flex gap-3 items-center">
                
                    <p className="text-[#252525] text-[20px] font-semibold tracking-[-0.4px] leading-[110%]">
                      {profileDetails?.profile_name || "NA"}
                    </p>
                 
                  {profileDetails?.level_type && profileDetails?.level_type !== "NA" && (
                    <div
                      className="flex items-center px-2.5 py-2 rounded-[5px]"
                      style={{
                        backgroundColor:
                          profileDetails.level_type === "1" ? "#E9F3FF" :
                            profileDetails.level_type === "2" ? "#FFFAF0" :
                              profileDetails.level_type === "3" ? "#EAFFEF" : "#E9F3FF",
                        color:
                          profileDetails.level_type === "1" ? "#006FFF" :
                            profileDetails.level_type === "2" ? "#F6AD0B" :
                              profileDetails.level_type === "3" ? "#3FAF58" : "#006FFF"
                      }}
                    >
                      <p
                        className="text-[10px] font-semibold tracking-[-0.4px] leading-[126%] capitalize"
                        style={{
                          color:
                            profileDetails.level_type === "1" ? "#006FFF" :
                              profileDetails.level_type === "2" ? "#F6AD0B" :
                                profileDetails.level_type === "3" ? "#3FAF58" : "#006FFF"
                        }}
                      >
                        LEVEL {profileDetails.level_type}
                      </p>
                    </div>
                  )}

                  <p className="text-[#535359] text-[12px] font-semibold tracking-[-0.4px] leading-[110%]">
                    {formatGoal(userHabits?.goal)}
                  </p>


                  <p className="text-[#535359] text-[12px] font-normal tracking-[-0.24px] leading-normal">
                    {individualProfileData?.data?.total_test_taken ?? "—"} test completed, including re-tests
                  </p>
                </div>

                <div className="flex gap-1.5 items-center">
                
                    <p className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                      {profileDetails?.age || "NA"} years,{" "}
                      {profileDetails?.gender || "NA"}
                    </p>
                

                  <div className="mx-1.5">
                    <Image
                      src="/icons/Ellipse 765.svg"
                      width={3}
                      height={3}
                      alt="dot"
                    />
                  </div>

                  <p className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                    Joined on {formatJoinedDate(profileDetails?.joined_dttm)}
                  </p>
                </div>
              </div>
            </div>

            {/* {showWhenNotSuperAdmin && ( */}
              <div className="flex gap-[30px]">
                <Image
                  src="/icons/hugeicons_file-export.svg"
                  width={26}
                  height={26}
                  alt="export"
                  className="cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={handleExportPDF}
                />

                <Image
                  src="/icons/right button.svg"
                  width={26}
                  height={26}
                  alt="right"
                  className="cursor-pointer"
                  onClick={() => setIsSidebarOpen(true)}
                />
              </div>
            {/* )} */}
          </div>

          <div className="flex py-[11px] pl-[5px]">
            <div className="flex bg-[#F5F7FA] rounded-[6px]">
              <div
                onClick={() => handleTabChange("test")}
                className={`flex items-center rounded-[6px] py-[11px] px-[31px] cursor-pointer ${activeTab === "test"
                  ? "bg-[#252525] cursor-pointer hover:bg-[#3a3a3a]"
                  : "bg-[#F5F7FA] cursor-pointer hover:bg-[#e8eaed]"
                  }`}
              >
                <p
                  className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${activeTab === "test" ? "text-white" : "text-[#535359]"
                    }`}
                >
                  Test Analysis
                </p>
              </div>

              <div
                onClick={() => handleTabChange("macros")}
                className={`flex items-center gap-2.5 rounded-[6px] py-[11px] px-[31px] transition-all duration-200 ${activeTab === "macros"
                  ? "bg-[#252525] cursor-pointer hover:bg-[#3a3a3a]"
                  : "bg-[#F5F7FA] cursor-pointer hover:bg-[#e8eaed]"
                  }`}
              >
                <p
                  className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${activeTab === "macros" ? "text-white" : "text-[#535359]"
                    }`}
                >
                  Macros Analysis
                </p>
              </div>

              <div
                onClick={() => handleTabChange("diet")}
                className={`flex items-center gap-2.5 rounded-[6px] py-[11px] px-[31px] transition-all duration-200 ${!isDietAnalysisAvailable
                  ? "opacity-50 cursor-not-allowed bg-[#F5F7FA]"
                  : activeTab === "diet"
                    ? "bg-[#252525] cursor-pointer hover:bg-[#3a3a3a]"
                    : "bg-[#F5F7FA] cursor-pointer hover:bg-[#e8eaed]"
                  }`}
                title={
                  !isDietAnalysisAvailable
                    ? "No diet analysis data available for this client"
                    : ""
                }
              >
                <p
                  className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${!isDietAnalysisAvailable
                    ? "text-[#A1A1A1]"
                    : activeTab === "diet"
                      ? "text-white"
                      : "text-[#535359]"
                    }`}
                >
                  Weekly Diet Analysis
                </p>

                {/* <Image
                  src="/icons/hugeicons_information-circle1.svg"
                  alt="info"
                  width={20}
                  height={20}
                  className={`${!isDietAnalysisAvailable ? "opacity-50" : ""}`}
                /> */}
              </div>

              <div
                onClick={() => handleTabChange("habits")}
                className={`flex items-center gap-2.5 rounded-[6px] py-[11px] px-[31px] transition-all duration-200 ${activeTab === "habits"
                  ? "bg-[#252525] cursor-pointer hover:bg-[#3a3a3a]"
                  : "bg-[#F5F7FA] cursor-pointer hover:bg-[#e8eaed]"
                  }`}
              >
                <p
                  className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${activeTab === "habits" ? "text-white" : "text-[#535359]"
                    }`}
                >
                  Habits Analysis
                </p>

                {/* <Image
                  src="/icons/hugeicons_information-circle1.svg"
                  alt="info"
                  width={20}
                  height={20}
                  className=""
                /> */}
              </div>

             {/* <div
  onClick={() => handleTabChange("trainer")}
  className={`flex items-center gap-2.5 rounded-[6px] py-[11px] px-[31px] transition-all duration-200 ${
    activeTab === "trainer"
      ? "bg-[#252525] cursor-pointer hover:bg-[#3a3a3a]"
      : "bg-[#F5F7FA] cursor-pointer hover:bg-[#e8eaed]"
  }`}
>
  <p
    className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${
      activeTab === "trainer" ? "text-white" : "text-[#535359]"
    }`}
  >
    Trainer Direction
  </p>
</div>  */}
              {/* <div
                onClick={() => handleTabChange("trainer-direction")}
                className={`flex items-center gap-2.5 rounded-[6px] py-[11px] px-[31px] transition-all duration-200 ${activeTab === "trainer-direction"
                  ? "bg-[#252525] cursor-pointer hover:bg-[#3a3a3a]"
                  : "bg-[#F5F7FA] cursor-pointer hover:bg-[#e8eaed]"
                  }`}
              >
                <p
                  className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${activeTab === "trainer-direction" ? "text-white" : "text-[#535359]"
                    }`}
                >
                  Trainer Direction
                </p>
              </div> */}
            </div>
          </div>

          {activeTab === "habits" ? (
            <div className="border-b border-[#E1E6ED]"></div>
          ) : (
            <div className="flex items-center gap-[26px] border-t border-b border-[#E1E6ED] pl-[38px] py-[5px]">
              <p className="text-[#535359] text-[15px] font-semibold whitespace-nowrap">
                {activeTab === "diet" ? "Select a week" : "Select a date"}
              </p>

              <div className="flex gap-3 items-center w-full">
                <IoChevronBackOutline
                  onClick={handleBack}
                  className={`text-[#252525] w-6 h-6 cursor-pointer ${startIndex === 0 || currentData.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                    }`}
                />

                <div className="w-full flex gap-[5px] items-center overflow-x-auto no-scrollbar">
                  {currentData.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 w-full">
                      {activeTab === "diet"
                        ? "No weeks available"
                        : "No test dates available"}
                    </div>
                  ) : (
                    visibleItems.map((item, index) => {
                      const actualIndex = startIndex + index;
                      return (
                        <div
                          key={actualIndex}
                          onClick={() =>
                            activeTab === "diet"
                              ? handleWeekSelect(actualIndex)
                              : handleDateSelect(actualIndex)
                          }
                          className={`flex flex-col gap-[5px] rounded-[8px] pl-[15px] pt-[15px] pr-[15px] pb-[15px] cursor-pointer min-w-[160px] ${activeIndex === actualIndex ? "bg-[#308BF9]" : ""
                            }`}
                        >
                          {activeTab === "diet" ? (
                            <>
                              <p
                                className={`${activeIndex === actualIndex
                                  ? "text-white"
                                  : "text-[#535359]"
                                  } text-[12px] font-semibold`}
                              >
                                {item.week}
                              </p>

                              <p
                                className={`${activeIndex === actualIndex
                                  ? "text-white"
                                  : "text-[#535359]"
                                  } text-[10px] font-normal leading-[126%] tracking-[-0.2px]`}
                              >
                                {item.range}
                              </p>
                            </>
                          ) : activeTab === "macros" ? (
                            <>
                              <p
                                className={`${activeIndex === actualIndex
                                  ? "text-white"
                                  : "text-[#535359]"
                                  } text-[12px] font-semibold`}
                              >
                                {item.date}
                              </p>

                              <div className="flex items-center">
                                <p
                                  className={`${activeIndex === actualIndex
                                    ? "text-white"
                                    : "text-[#535359]"
                                    } text-[10px] font-normal leading-[126%] tracking-[-0.2px]`}
                                >
                                  {item.kcal}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <p
                                className={`${activeIndex === actualIndex
                                  ? "text-white"
                                  : "text-[#535359]"
                                  } text-[12px] font-semibold`}
                              >
                                {item.date}
                              </p>

                              <div className="flex items-center">
                                <p
                                  className={`${activeIndex === actualIndex
                                    ? "text-white"
                                    : "text-[#535359]"
                                    } text-[10px] font-normal leading-[126%] tracking-[-0.2px]`}
                                >
                                  {item.score || "—"}
                                </p>

                                <div
                                  className={`mx-2.5 border-r h-[13px] ${activeIndex === actualIndex
                                    ? "border-white"
                                    : "border-[#A1A1A1]"
                                    }`}
                                ></div>

                                <p
                                  className={`${activeIndex === actualIndex
                                    ? "text-white"
                                    : "text-[#535359]"
                                    } text-[10px] font-normal leading-[126%] tracking-[-0.2px]`}
                                >
                                  {item.status || "Pending"}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end">
                  <IoChevronForwardOutline
                    onClick={handleForward}
                    className={`text-[#252525] w-6 h-6 cursor-pointer ${startIndex + ITEMS_TO_SHOW >= currentData.length ||
                      currentData.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                      }`}
                  />
                </div>
              </div>
            </div>
          )}

          <div
            className={`scroll-target ${activeTab === "test" ? "flex-1 overflow-y-auto scroll-hide" : "hidden"
              }`}
          >
            <TestAnalysis />
          </div>

          <div
            className={`scroll-target ${activeTab === "macros" ? "flex-1 overflow-y-auto scroll-hide" : "hidden"
              }`}
          >
            <MacrosAnalysis activeTab={activeTab} />
          </div>

          <div
            className={`scroll-target ${activeTab === "diet" ? "flex-1 overflow-y-auto scroll-hide" : "hidden"
              }`}
          >
            <DietAnalysis />
          </div>

          <div
            className={`scroll-target ${activeTab === "habits" ? "flex-1 overflow-y-auto scroll-hide" : "hidden"
              }`}
          >

            <HabitsAnalysis />
          </div>

           <div
            className={`${activeTab === "trainer" ? "flex-1 overflow-y-auto scroll-hide" : "hidden"
              }`}
          >

          <div
            className={`${activeTab === "trainer-direction" ? "flex-1 overflow-y-auto scroll-hide" : "hidden"
              }`}
          >
            <TrainerDirection />
          </div>
        </div>
         </div>

        <RightSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          profileId={profileId}
          dietitianId={dietitianId}
        />
      </div>
    </>
  );
}
