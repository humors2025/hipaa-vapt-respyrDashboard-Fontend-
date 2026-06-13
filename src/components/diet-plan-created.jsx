

"use client"

import { IoIosArrowDown } from "react-icons/io";
import { IoIosArrowBack } from "react-icons/io";
import { IoIosArrowForward } from "react-icons/io";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import DietEvent from "./modal/diet-event-popup"
import Cookies from "js-cookie";
import { useSelector } from "react-redux";
import { useSearchParams } from "next/navigation";
import { 
  updateDietPlanJsonService, 
  fetchDietPlanJsonService,
  fetchClientProfileData,         
} from "../services/authService"; 
import { toast } from "sonner";
import DietEventPopUp from "./pop-folder/diet-event-popup";
// import Popup from "./cancel-icon";



export default function DietPlanCreated() {
  const [activeDay, setActiveDay] = useState(0);
  const [days, setDays] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdited, setIsEdited] = useState(false);

  const [isPopupOpen, setIsPopupOpen] = useState(false); 
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [planSummary, setPlanSummary] = useState(null);
  const [allDays, setAllDays] = useState([]);
  const [windowStartIndex, setWindowStartIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const popupRef = useRef(null);

  const reduxExtractedData = useSelector((state) => state.extractedData.data);
  const clientProfile = useSelector((state) => state.clientProfile.data);
  const [clientProfileLocal, setClientProfileLocal] = useState(null);   // ⬅️ LOCAL COPY
  const effectiveClientProfile = clientProfileLocal || clientProfile;   // ⬅️ SOURCE OF TRUTH


  const searchParams = useSearchParams();
  const profile_id =
    searchParams.get("profile_id") || effectiveClientProfile?.profile_id;

  const getDieticianIdFromCookies = () => {
    if (typeof window === 'undefined') return null;
    
    const cookieValue = Cookies.get("dietician");
    if (cookieValue) {
      try {
        const parsedCookie = JSON.parse(cookieValue);
        return parsedCookie.dietician_id;
      } catch (e) {
        console.error("Error parsing dietician cookie:", e);
      }
    }
    
    const storedDieticianId = localStorage.getItem("dietician_id");
    if (storedDieticianId) return storedDieticianId;
    
    return null;
  };

  // ---------- LOCAL EXTRACTED DATA INIT (from localStorage) ----------
  const [localExtractedData, setLocalExtractedData] = useState(() => {
    if (typeof window === "undefined") return null;
    
    try {
      const storedData = localStorage.getItem("updatedExtractedData");
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        return parsedData;
      }
    } catch (err) {
      console.error("Failed to get updatedExtractedData from localStorage:", err);
    }
    return null;
  });


  const VISIBLE_COUNT = 6;

  // ---------- SYNC REDUX → LOCAL STORAGE (only when no local edits) ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!reduxExtractedData) return;
    
    try {
      const storedData = localStorage.getItem("updatedExtractedData");
      if (storedData) {
        if (localExtractedData === null) {
          setLocalExtractedData(JSON.parse(storedData));
        }
        return;
      }
    } catch (err) {
      console.error("Failed to check localStorage:", err);
    }
    
    if (localExtractedData !== null) return;

    try {
      localStorage.setItem("updatedExtractedData", JSON.stringify(reduxExtractedData));
      setLocalExtractedData(reduxExtractedData);
    } catch (err) {
      console.error("Failed to save updatedExtractedData to localStorage", err);
    }
  }, [reduxExtractedData, localExtractedData]);

  // ---------- LOAD SAVED DIET PLAN JSON (SERVER → LOCAL) ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!effectiveClientProfile) return;

    const login_id = getDieticianIdFromCookies();
    if (!login_id) return;
    if (!profile_id) return;

    const activePlans = effectiveClientProfile?.plans_summary?.active;
    if (!activePlans || activePlans.length === 0) return;

    const diet_plan_id = activePlans[0]?.id;
 
    if (!diet_plan_id) return;

    const loadDietPlan = async () => {
      try {
    
        const response = await fetchDietPlanJsonService(
          login_id,
          profile_id,
          diet_plan_id
        );


        // ---------- CASE 1: API SUCCESS ----------
        if (response?.success && response?.data?.record?.diet_json) {

          const normalized = { result: response.data.record.diet_json };

          localStorage.setItem("updatedExtractedData", JSON.stringify(normalized));
          setLocalExtractedData(normalized);

          return;
        }

        // ---------- CASE 2: API says "not found" ----------
        if (response?.error_code === "not_found") {
          console.warn("Diet plan JSON not found in DB → falling back to Redux");

          if (reduxExtractedData) {
            const normalized = reduxExtractedData;
            localStorage.setItem("updatedExtractedData", JSON.stringify(normalized));
            setLocalExtractedData(normalized);
          }

          return;
        }

        // ---------- CASE 3: API error ----------
        console.error("API error → fallback to Redux");

        if (reduxExtractedData) {
          localStorage.setItem("updatedExtractedData", JSON.stringify(reduxExtractedData));
          setLocalExtractedData(reduxExtractedData);
        }

      } catch (err) {
        // ---------- CASE 4: Network or code error ----------
        console.error("API exception → fallback to Redux", err);

        if (reduxExtractedData) {
          localStorage.setItem("updatedExtractedData", JSON.stringify(reduxExtractedData));
          setLocalExtractedData(reduxExtractedData);
        }
      }
    };

    loadDietPlan();
  }, [effectiveClientProfile, profile_id, reduxExtractedData]);

  // ---------- PLAN SUMMARY (from localStorage, fallback to effectiveClientProfile.active) ----------
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPlanSummary = localStorage.getItem('planSummary');
      if (storedPlanSummary) {
        setPlanSummary(JSON.parse(storedPlanSummary));
        return;
      }
    }

    const activePlans = effectiveClientProfile?.plans_summary?.active;
    if (activePlans && Array.isArray(activePlans) && activePlans.length > 0) {
      const plan = activePlans[0];
      const summary = {
        plan_title: plan.plan_title,
        plan_start_date: plan.plan_start_date,
        plan_end_date: plan.plan_end_date,
        calories_target: plan.calories_target,
        protein_target: plan.protein_target,
        fiber_target: plan.fiber_target,
        water_target: plan.water_target,
        goal: plan.goal,
        approach: plan.approach,
        status: plan.status,
        plan_status: plan.plan_status,
        diet_plan_id: plan.id,
      };
      setPlanSummary(summary);

      if (typeof window !== 'undefined') {
        localStorage.setItem('planSummary', JSON.stringify(summary));
      }
    }
  }, [effectiveClientProfile]);

  // ---------- EFFECTIVE DATA SOURCE ----------
  const extractedData = localExtractedData || reduxExtractedData;

  // ---------- REFRESH CLIENT PROFILE AFTER PDF EXTRACTION ----------
  const [hasFetchedClientProfile, setHasFetchedClientProfile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasFetchedClientProfile) return;

    const login_id = getDieticianIdFromCookies();
    if (!login_id) return;
    if (!profile_id) return;

    // Run ONLY after PDF extraction result is available
    if (!extractedData || !extractedData.result) return;

    const loadClientProfile = async () => {
      try {
      
        const response = await fetchClientProfileData(login_id, profile_id);

        if (response?.success && response.data) {
          setClientProfileLocal(response.data);
          setHasFetchedClientProfile(true);
        } else {
          console.warn("Failed to refresh client profile:", response);
        }
      } catch (err) {
        console.error("Error fetching client profile:", err);
      }
    };

    loadClientProfile();
  }, [extractedData, profile_id, hasFetchedClientProfile]);

  const visibleDays = allDays.slice(
    windowStartIndex,
    windowStartIndex + VISIBLE_COUNT
  );

  // ---------- HELPERS ----------
  const getDayName = (date) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  const getFullDietPlanData = () => {
    if (!extractedData?.result) {
      return {};
    }
    return extractedData.result;
  };

  const dietPlanData = getFullDietPlanData();


  const getMealDataForDayFromDietPlan = (dayDate) => {
    if (!dietPlanData || Object.keys(dietPlanData).length === 0) {
      return [];
    }

    if (dietPlanData?.error) {
      console.error("PDF Extraction Error:", dietPlanData.error);
      return [];
    }

    const dayName = getDayName(dayDate).toLowerCase();
    const dayData = dietPlanData[dayName];

    if (!dayData?.meals) return [];

    return dayData.meals.map((meal, index) => {
      const timeParts = meal.time.split(" at ");
      const time = timeParts[0];
      const timeRange = timeParts[1] || "";

      const getIcon = (mealTime) => {
        const timeLower = mealTime.toLowerCase();
        if (
          timeLower.includes("waking") ||
          timeLower.includes("wake up") ||
          timeLower.includes("early morning")
        ) {
          return "/icons/hugeicons_bubble-tea-02.svg";
        } else if (timeLower.includes("breakfast")) {
          return "/icons/hugeicons_dish-02.svg";
        } else if (timeLower.includes("lunch")) {
          return "/icons/hugeicons_dish-02.svg";
        } else if (timeLower.includes("dinner")) {
          return "/icons/hugeicons_dish-02.svg";
        } else if (
          timeLower.includes("mid morning") ||
          timeLower.includes("evening") ||
          timeLower.includes("snack")
        ) {
          return "/icons/hugeicons_vegetarian-food.svg";
        } else {
          return "/icons/hugeicons_vegetarian-food.svg";
        }
      };

      const meals = (meal.items || []).map((item, itemIndex) => {
        const details =
          item.details && Array.isArray(item.details) && item.details.length
            ? item.details
            : [
                item.portion ?? "",
                item.calories_kcal != null ? `${item.calories_kcal}kcal` : "",
                item.protein != null ? `Protein: ${item.protein}g` : "",
                item.carbs != null ? `Carbs: ${item.carbs}g` : "",
                item.fat != null ? `Fat: ${item.fat}g` : "",
              ];

        return {
          id: itemIndex + 1,
          icon: getIcon(time),
          number: (itemIndex + 1).toString(),
          status: "100% Filled",
          statusColor: "#E1F6E6",
          textColor: "#3FAF58",
          foodItems: [
            {
              name: item.name,
              details,
            },
          ],
          totals: {
            calories_kcal: item.calories_kcal,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
          },
        };
      });

      return {
        id: index + 1,
        time,
        timeRange,
        foodsCount: `${meal.items.length} food${
          meal.items.length > 1 ? "s" : ""
        } added`,
        meals,
      };
    });
  };

  const generateAllDays = (startDate, endDate) => {
    const list = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    const daysDiff =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    for (let i = 0; i < daysDiff; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);

      list.push({
        id: i,
        day: `Day ${i + 1}`,
        date: date.toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short"
        }),
        fullDate: date
      });
    }

    return list;
  };

  useEffect(() => {
    if (!planSummary) return;

    const start = new Date(planSummary.plan_start_date);
    const end = new Date(planSummary.plan_end_date);

    const generated = generateAllDays(start, end);
    setAllDays(generated);

    setWindowStartIndex(0);
    setActiveDay(0);
  }, [planSummary]);

  const handlePreviousDays = () => {
    if (windowStartIndex === 0) return;

    setWindowStartIndex((prev) => Math.max(prev - VISIBLE_COUNT, 0));
    setActiveDay(windowStartIndex - VISIBLE_COUNT);
  };

  const handleNextDays = () => {
    if (windowStartIndex + VISIBLE_COUNT >= allDays.length) return;

    setWindowStartIndex((prev) =>
      Math.min(prev + VISIBLE_COUNT, allDays.length - VISIBLE_COUNT)
    );
    setActiveDay(windowStartIndex + VISIBLE_COUNT);
  };

  const handleEditClick = (section) => {
    if (!section || !allDays[activeDay]?.fullDate) return;

    const dayObj = allDays[activeDay];
    const dayName = getDayName(dayObj.fullDate).toLowerCase();

    const selected = {
      dayName,
      dayLabel: dayObj.day,
      fullDate: dayObj.fullDate,
      time: section.time,
      timeRange: section.timeRange,
      foodsCount: section.foodsCount,
      meals: section.meals.map((meal) => ({
        id: meal.id,
        number: meal.number,
        foodItems: meal.foodItems,
        totals: meal.totals ?? null,
      })),
    };

    setSelectedMeal(selected);
    
    setIsPopupOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMeal(null);
  };

  const handleSaveFromModal = (updatedData) => {
    if (!extractedData) return;

    try {
      let existingUpdatedData = null;
      try {
        const storedData = localStorage.getItem("updatedExtractedData");
        if (storedData) {
          existingUpdatedData = JSON.parse(storedData);
        }
      } catch (err) {
        console.error("Failed to get existing updatedExtractedData:", err);
      }

      const mergedData = {
        ...extractedData,
        result: {}
      };

      if (extractedData.result) {
        Object.keys(extractedData.result).forEach(dayName => {
          mergedData.result[dayName] = {
            ...extractedData.result[dayName]
          };
        });
      }

      if (existingUpdatedData?.result) {
        Object.keys(existingUpdatedData.result).forEach(dayName => {
          if (!mergedData.result[dayName]) {
            mergedData.result[dayName] = {};
          }
          
          const existingMeals = mergedData.result[dayName].meals || [];
          const updatedMeals = existingUpdatedData.result[dayName].meals || [];
          
          const mergedMeals = [...existingMeals];
          updatedMeals.forEach(updatedMeal => {
            let normalizedTime = updatedMeal.time || "";
            if (updatedMeal.timeRange && !normalizedTime.includes(" at ")) {
              normalizedTime = `${normalizedTime} at ${updatedMeal.timeRange}`;
            }
            
            const normalizedMeal = {
              ...updatedMeal,
              time: normalizedTime
            };
            
            const baseTime = normalizedTime.split(" at ")[0].trim();
            const mealIndex = mergedMeals.findIndex(m => {
              const mBaseTime = (m.time || "").split(" at ")[0].trim();
              return mBaseTime === baseTime;
            });
            
            if (mealIndex !== -1) {
              mergedMeals[mealIndex] = normalizedMeal;
            } else {
              mergedMeals.push(normalizedMeal);
            }
          });
          
          const normalizedMergedMeals = mergedMeals.map(meal => {
            if (meal.timeRange && !meal.time.includes(" at ")) {
              return {
                ...meal,
                time: `${meal.time} at ${meal.timeRange}`
              };
            }
            return meal;
          });
          
          const totals = {
            calories_kcal: 0,
            protein: 0,
            carbs: 0,
            fat: 0
          };
          
          normalizedMergedMeals.forEach(meal => {
            if (meal.items) {
              meal.items.forEach(item => {
                totals.calories_kcal += parseInt(item.calories_kcal) || 0;
                totals.protein += parseFloat(item.protein) || 0;
                totals.carbs += parseFloat(item.carbs) || 0;
                totals.fat += parseFloat(item.fat) || 0;
              });
            }
          });
          
          mergedData.result[dayName] = {
            ...mergedData.result[dayName],
            meals: normalizedMergedMeals,
            totals: totals
          };
        });
      }

      if (updatedData?.result) {
        Object.keys(updatedData.result).forEach(dayName => {
          if (!mergedData.result[dayName]) {
            mergedData.result[dayName] = {};
          }
          
          const existingMeals = mergedData.result[dayName].meals || [];
          const newMeals = updatedData.result[dayName].meals || [];
          
          const mergedMeals = [...existingMeals];
          newMeals.forEach(newMeal => {
            let normalizedTime = newMeal.time || "";
            if (newMeal.timeRange && !normalizedTime.includes(" at ")) {
              normalizedTime = `${normalizedTime} at ${newMeal.timeRange}`;
            }
            
            const normalizedMeal = {
              ...newMeal,
              time: normalizedTime
            };
            
            const baseTime = normalizedTime.split(" at ")[0].trim();
            const mealIndex = mergedMeals.findIndex(m => {
              const mBaseTime = (m.time || "").split(" at ")[0].trim();
              return mBaseTime === baseTime;
            });
            
            if (mealIndex !== -1) {
              mergedMeals[mealIndex] = normalizedMeal;
            } else {
              mergedMeals.push(normalizedMeal);
            }
          });
          
          const normalizedMergedMeals = mergedMeals.map(meal => {
            if (meal.timeRange && !meal.time.includes(" at ")) {
              return {
                ...meal,
                time: `${meal.time} at ${meal.timeRange}`
              };
            }
            return meal;
          });
          
          const totals = {
            calories_kcal: 0,
            protein: 0,
            carbs: 0,
            fat: 0
          };
          
          normalizedMergedMeals.forEach(meal => {
            if (meal.items) {
              meal.items.forEach(item => {
                totals.calories_kcal += parseInt(item.calories_kcal) || 0;
                totals.protein += parseFloat(item.protein) || 0;
                totals.carbs += parseFloat(item.carbs) || 0;
                totals.fat += parseFloat(item.fat) || 0;
              });
            }
          });
          
          mergedData.result[dayName] = {
            ...mergedData.result[dayName],
            meals: normalizedMergedMeals,
            totals: totals
          };
        });
      }

      localStorage.setItem("updatedExtractedData", JSON.stringify(mergedData));
      setLocalExtractedData(mergedData);
      // setIsEdited(true);
    } catch (error) {
      console.error("Failed to merge and save updatedExtractedData:", error);
    }
  };






// const handleFinishClick = async () => {
//   try {
//     setIsSubmitting(true);

//     const login_id = getDieticianIdFromCookies();
//     const profile_id =
//       searchParams.get("profile_id") || effectiveClientProfile?.profile_id;

//     if (!login_id) {
//       toast.error("Please log in again. Dietician ID not found.");
//       return;
//     }

//     if (!profile_id) {
//       toast.error("Profile ID not found.");
//       return;
//     }

//     // ✅ ALWAYS take active plan from effectiveClientProfile first
//     const activePlans = effectiveClientProfile?.plans_summary?.active;
//     let diet_plan_id =
//       activePlans?.length > 0
//         ? activePlans[0].id
//         : planSummary?.diet_plan_id; // fallback only if no activePlans

//     console.log("diet_plan_id716:-", diet_plan_id);

//     if (!diet_plan_id) {
//       toast.error("No active diet plan found.");
//       return;
//     }

//     // rest of your code stays same...
//     let diet_json = {};
//     try {
//       const storedData = localStorage.getItem("updatedExtractedData");
//       diet_json = storedData ? JSON.parse(storedData) : extractedData || {};
//     } catch (error) {
//       console.error("Error reading diet JSON:", error);
//       diet_json = extractedData || {};
//     }

//     const toastId = toast.loading("Saving diet plan...");

//     const response = await updateDietPlanJsonService(
//       login_id,
//       profile_id,
//       diet_plan_id,
//       diet_json.result
//     );

//     if (response.success) {
//       toast.success("Diet plan saved successfully!", {
//         id: toastId,
//         duration: 3000,
//       });
//       setIsEdited(false);
//     } else {
//       toast.error(
//         `Failed to save diet plan: ${response.message || "Unknown error"}`,
//         {
//           id: toastId,
//           duration: 5000,
//         }
//       );
//     }
//   } catch (error) {
//     console.error("Save error:", error);
//     toast.error(`Error saving diet plan: ${error.message}`);
//   } finally {
//     setIsSubmitting(false);
//   }
// };



const handleFinishClick = async () => {
  // 🔒 HARD GUARD – if disabled state, do nothing
  if (isSubmitting || !isEdited) {
    return;
  }

  try {
    setIsSubmitting(true);

    const login_id = getDieticianIdFromCookies();
    const profile_id =
      searchParams.get("profile_id") || effectiveClientProfile?.profile_id;

    if (!login_id) {
      toast.error("Please log in again. Dietician ID not found.");
      return;
    }

    if (!profile_id) {
      toast.error("Profile ID not found.");
      return;
    }

    const activePlans = effectiveClientProfile?.plans_summary?.active;
    let diet_plan_id =
      activePlans?.length > 0
        ? activePlans[0].id
        : planSummary?.diet_plan_id;

  

    if (!diet_plan_id) {
      toast.error("No active diet plan found.");
      return;
    }

    let diet_json = {};
    try {
      const storedData = localStorage.getItem("updatedExtractedData");
      diet_json = storedData ? JSON.parse(storedData) : extractedData || {};
    } catch (error) {
      console.error("Error reading diet JSON:", error);
      diet_json = extractedData || {};
    }

    const toastId = toast.loading("Saving diet plan...");

    const response = await updateDietPlanJsonService(
      login_id,
      profile_id,
      diet_plan_id,
      diet_json.result
    );

    if (response.success) {
      toast.success("Diet plan saved successfully!", {
        id: toastId,
        duration: 3000,
      });

      // ✅ reset edited flag
      setIsEdited(false);
    } else {
      toast.error(
        `Failed to save diet plan: ${response.message || "Unknown error"}`,
        {
          id: toastId,
          duration: 5000,
        }
      );
    }
  } catch (error) {
    console.error("Save error:", error);
    toast.error(`Error saving diet plan: ${error.message}`);
  } finally {
    setIsSubmitting(false);
  }
};




  const getActiveDayMealsFromDietPlan = () => {
    if (!allDays[activeDay]?.fullDate) {
      return [];
    }

    const currentDay = allDays[activeDay];
    const meals = getMealDataForDayFromDietPlan(currentDay.fullDate);

    return meals;
  };

  const selectedDayObj = allDays.find((d) => d.id === activeDay);
  const formatDisplayDate = (dateObj) => {
    if (!dateObj) return "";
    const ddMon = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const wk = dateObj.toLocaleDateString("en-US", { weekday: "long" });
    return `${ddMon}, ${wk}`;
  };

  const activeDayMeals = getActiveDayMealsFromDietPlan();

  const getDayTotalsFromDietPlan = () => {
    if (!dietPlanData || !allDays[activeDay]?.fullDate) return null;

    const dayName = getDayName(allDays[activeDay].fullDate).toLowerCase();
    const dayData = dietPlanData[dayName];

    return dayData?.totals || null;
  };

  const dayTotals = getDayTotalsFromDietPlan();

  // Add click outside listener when popup is open
  useEffect(() => {
    const handleClickOutSide = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setIsPopupOpen(false);
      }
    };

    if (isPopupOpen) {
      document.addEventListener("mousedown", handleClickOutSide);
      return () => {
        document.removeEventListener("mousedown", handleClickOutSide);
      };
    }
  }, [isPopupOpen]);

  return (
    <>
      <div className='w-full max-w-full min-w-0 overflow-x-hidden relative flex flex-col gap-[310px]'>

        <div className="">
          <div className="flex justify-between pl-[15px] pr-[20px]">
            <p className='text-[#252525] pb-[18px] pt-[23px] text-[20px] font-semibold leading-[110%] tracking-[0.4px] whitespace-nowrap'>Diet Plan</p>
          </div>

          <div className="flex flex-col gap-[15px]">
            <div className="w-full  border-b border-[#E1E6ED]"></div>

            <div className="flex flex-col  bg-[#F5F7FA] rounded-[15px]">
              <div className="flex items-center bg-[#E1E6ED] rounded-[15px] border-4 border-[#F5F7FA]">

                <div className="flex justify-between w-[170px] py-[30px] pl-[26px]">
                  <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">Select a day</span>
                  <IoIosArrowBack
                    className="text-[#252525] cursor-pointer"
                    onClick={handlePreviousDays}
                  />
                </div>

                <div className="flex items-center">
                  {visibleDays.map((day, index) => (
                    <div key={day.id} className="flex items-center">
                      <div
                        className={`flex flex-col w-[140px] gap-2.5 pt-[15px] pb-2.5 pr-2.5 pl-[15px] rounded-[8px] cursor-pointer ${
                          activeDay === day.id ? 'bg-[#308BF9]' : ''
                        }`}
                        onClick={() => {
                          setActiveDay(day.id);
                        }}
                      >
                        <span className={`text-[12px] font-semibold leading-[110%] tracking-[-0.48px] ${
                          activeDay === day.id ? 'text-white' : 'text-[#252525]'
                        }`}>
                          {day.day}
                        </span>
                        <span className={`text-[12px] font-semibold leading-[110%] tracking-[-0.48px] ${
                          activeDay === day.id ? 'text-white' : 'text-[#252525]'
                        }`}>
                          {day.date}
                        </span>
                      </div>

                      {index < visibleDays.length - 1 && (
                        <div className="border-white border-r h-8 mx-2"></div>
                      )}
                    </div>
                  ))}
                  <IoIosArrowForward
                    className="text-[#252525] ml-2 cursor-pointer"
                    onClick={handleNextDays}
                  />
                </div>
              </div> 

              <div className="flex-1 overflow-y-auto max-h-[320px] pr-[10px] pt-4 pb-4  [scrollbar-width:none] 
                [&::-webkit-scrollbar]:hidden">
                <div className="flex flex-col gap-2.5 ml-[30px]">
                  <span className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                    {selectedDayObj?.day ?? `Day ${activeDay + 1}`}
                  </span>
                  <span className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
                    {formatDisplayDate(selectedDayObj?.fullDate)}
                  </span>

                  {dayTotals ? (
                    ""
                  ) : (
                    <div className="flex gap-4 mt-2 p-3 bg-gray-100 rounded-lg">
                      <span className="text-[#252525] text-[12px] font-semibold">
                        No meal data available for this day
                      </span>
                    </div>
                  )}
                </div>

                {activeDayMeals.length > 0 ? (
                  activeDayMeals.map((section) => (
                    <div key={section.id} className="flex py-5 bg-white rounded-[15px] border-4 border-[#F5F7FA]">
                      <div className="flex flex-col gap-[30px] pt-[15px] pl-[15px] pr-2.5 pb-2.5 min-w-[200px]">
                        <div className="flex flex-col gap-2.5">
                          <span className="text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.48px]">{section.time}</span>
                          <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">{section.timeRange}</span>
                        </div>

                        <div className="max-w-fit py-1.5 px-2 rounded-[20px] bg-[#E1E6ED] text-[#535359] text-[10px] font-normal leading-normal tracking-[-0.2px] whitespace-nowrap">
                          {section.foodsCount}
                        </div>
                      </div>

                      <div className="flex items-start justify-between flex-1">
                        <div className="flex flex-col py-5 pl-5 gap-[30px] border-l border-l-[#E1E6ED] flex-1">
                          {section.meals.map((meal) => (
                            <div key={meal.id} className="flex gap-5 justify-between">
                              <div className="flex gap-5 items-start py-[5px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-[#252525] text-[15px] font-bold leading-none tracking-[-0.3px]">{meal.number}</span>
                                </div>
                              </div>

                              <div className="flex gap-[33px] flex-1">
                                <div className="flex-1">
                                  {meal.foodItems.map((foodItem, index) => (
                                    <div key={index} className="mb-4 last:mb-0">
                                      <div className="flex flex-col gap-1">
                                        <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">{foodItem.name}</span>
                                        <div className="flex flex-wrap gap-[5px]">
                                          {foodItem.details.map((detail, detailIndex) => (
                                            <span
                                              key={detailIndex}
                                              className={`text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px] px-2 py-1 rounded ${detailIndex === 0 ? 'bg-white ' : 'bg-gray-100'
                                                }`}
                                            >
                                              {detail}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col ml-[33px] mb-[44px] mr-2.5 gap-2.5 border border-[#D9D9D9] rounded-[10px] py-[15px] px-5 cursor-pointer"
                          //onClick={() => handleEditClick(section)}
                          onClick={() => handleEditClick(section)}
                        >
                          <Image
                            src="/icons/hugeicons_edit-03.svg"
                            alt="hugeicons_edit-03"
                            height={24}
                            width={24}
                          />
                          <span className="text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[0.24px]">Edit</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-center items-center py-10">
                    <span className="text-[#252525] text-[16px] font-normal">
                      {dietPlanData?.error
                        ? `PDF Extraction Error: ${dietPlanData.error}`
                        : planSummary && Object.keys(dietPlanData).length > 0
                          ? `No diet plan data available for ${selectedDayObj?.day}.`
                          : !dietPlanData || Object.keys(dietPlanData).length === 0 ? '-' : 'Please upload the PDF'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
 
            <div className="mt-[30px]">
              <div className="w-full border-b border-[#E1E6ED]"></div>
              <div className="flex justify-end my-[23px] mr-5">
                {/* <button 
                  onClick={handleFinishClick}
                  disabled={isSubmitting}
                  className={`cursor-pointer text-[#FFFFFF] text-[12px] font-semibold leading-normal tracking-[-0.24px] px-5 py-[15px] rounded-[10px] ${
                    isSubmitting ||  !isEdited? 'bg-gray-400' : 'bg-[#308BF9]'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Update'}
                </button> */}


                <button 
  onClick={handleFinishClick}
  disabled={isSubmitting || !isEdited}
  className={`cursor-pointer text-[#FFFFFF] text-[12px] font-semibold leading-normal tracking-[-0.24px] px-5 py-[15px] rounded-[10px] ${
    isSubmitting || !isEdited ? 'bg-gray-400' : 'bg-[#308BF9]'
  }`}
>
  {isSubmitting ? 'Saving...' : 'Update'}
</button>

              </div>
            </div>

          </div>

        </div>
      </div>

      {/* <DietEvent
        open={isModalOpen}
        onClose={handleCloseModal}
        selectedMeal={selectedMeal}
        onSave={handleSaveFromModal}
      /> */}
    {isPopupOpen && (
  <DietEventPopUp
    ref={popupRef}
    onClose={() => setIsPopupOpen(false)}
    selectedMeal={selectedMeal}
    onSave={handleSaveFromModal}
    onEditing={(hasContent) => setIsEdited(hasContent)}  // 🔑 true/false
  />
)}

    </>
  )
}