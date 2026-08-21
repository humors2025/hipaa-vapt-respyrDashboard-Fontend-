

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { saveWeeklyFoodJson, fetchSavedWeeklyFoodJson } from "@/services/authService"; // Add the new import

export default function CreatePlanPopUp({ open,
   onClose,
    onUploaded,
     selectedWeekText,
     dieticianId,
  profileId,
 }) {



  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dayFoods, setDayFoods] = useState({});
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [existingWeekId, setExistingWeekId] = useState(null); // Store week_id if exists
const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);



// ✅ build daysArray exactly like Save as Draft
const buildDaysArray = () => {
  const daysArray = [];
  for (let i = 0; i < 7; i++) {
    const items = Array.isArray(dayFoods[i]) ? dayFoods[i] : [];
    if (items.length > 0) {
      daysArray.push({ day_no: i + 1, items });
    }
  }
  return daysArray;
};

// ✅ convert daysArray -> { day1:[], day2:[], ... day7:[] }
const convertToDaysObject = (daysArray) => {
  const obj = {
    day1: [],
    day2: [],
    day3: [],
    day4: [],
    day5: [],
    day6: [],
    day7: [],
  };

  (Array.isArray(daysArray) ? daysArray : []).forEach((d) => {
    const n = Number(d?.day_no);
    if (n >= 1 && n <= 7) obj[`day${n}`] = Array.isArray(d.items) ? d.items : [];
  });

  return obj;
};





  // Parse start_date and end_date from selectedWeekText
  const parseWeekDates = (weekText) => {
    if (!weekText) return { start_date: "", end_date: "" };
    
    
    // Format: "22 Jan 2026 - 28 Jan 2026"
    const dateRegex = /(\d{1,2}\s+\w+\s+\d{4})\s*-\s*(\d{1,2}\s+\w+\s+\d{4})/;
    const dateMatch = weekText.match(dateRegex);
    
    if (dateMatch) {
      const startDateStr = dateMatch[1];
      const endDateStr = dateMatch[2];
      
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      const formatDate = (date) => {
        if (isNaN(date.getTime())) {
          console.error("Invalid date:", date);
          return "";
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      return {
        start_date: formatDate(startDate),
        end_date: formatDate(endDate)
      };
    }
    
    console.error("Date format not recognized:", weekText);
    return { start_date: "", end_date: "" };
  };

  // Fetch existing food data when modal opens
  // const fetchExistingFoodData = async () => {
  //   if (!profileId || !selectedWeekText) return;
    
  //   const { start_date, end_date } = parseWeekDates(selectedWeekText);
    
  //   if (!start_date || !end_date) {
  //     console.error("Invalid dates for fetching food data");
  //     return;
  //   }
    
  //   setIsLoading(true);
    
  //   try {
  //     const response = await fetchSavedWeeklyFoodJson(profileId, start_date, end_date, dieticianId);
      
  //     if (response.success && response.data) {
  //       // Store the week_id
  //       setExistingWeekId(response.data.week_id);
        
  //       // Transform the food_json data into dayFoods format
  //       if (response.data.food_json && response.data.food_json.days) {
  //         const existingFoods = {};
          
  //         response.data.food_json.days.forEach(day => {
  //           const dayIndex = day.day_no - 1; // Convert to 0-based index
  //           if (day.items && day.items.length > 0) {
  //             existingFoods[dayIndex] = day.items;
  //           }
  //         });
          
  //         setDayFoods(existingFoods);
  //         toast.success("Existing food items loaded");
  //       }
  //     }
  //   } catch (error) {
  //     // If error is "No data found", just ignore - it's fine to start fresh
  //     if (error.message?.includes("No data found") || error.data?.message?.includes("No data found")) {
  //       console.log("No existing food data for this week");
  //       setDayFoods({});
  //       setExistingWeekId(null);
  //     } else {
  //       console.error("Error fetching food data:", error);
  //       toast.error("Failed to load existing food items");
  //     }
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };


// In CreatePlanPopUp component, update the fetchExistingFoodData function:

const fetchExistingFoodData = async () => {
  if (!profileId || !selectedWeekText) return;
  
  const { start_date, end_date } = parseWeekDates(selectedWeekText);
  
  if (!start_date || !end_date) {
    console.error("Invalid dates for fetching food data");
    return;
  }
  
  setIsLoading(true);
  
  try {

    
    const response = await fetchSavedWeeklyFoodJson(
      profileId, 
      start_date, 
      end_date, 
      dieticianId
    );
    

    
    // Check for noData flag first
    if (response.noData) {
   
      setDayFoods({});
      setExistingWeekId(null);
      return;
    }
    
    // Handle successful response with data
    if (response.success && response.data) {
      setExistingWeekId(response.data.week_id);
      
      if (response.data.food_json && response.data.food_json.days) {
        const existingFoods = {};
        
        response.data.food_json.days.forEach(day => {
          const dayIndex = day.day_no - 1;
          if (day.items && day.items.length > 0) {
            existingFoods[dayIndex] = day.items;
          }
        });
        
        setDayFoods(existingFoods);
        // toast.success("Existing food items loaded");
      }
    }
  } catch (error) {
    console.error("Error fetching food data:", error);
    
    // Check if it's a "no data" error (fallback for any errors that still slip through)
    if (error.message?.includes("No data found") || 
        error.data?.message?.includes("No data found")) {
  
      setDayFoods({});
      setExistingWeekId(null);
    } else {
      toast.error(error.message || "Failed to load existing food items");
    }
  } finally {
    setIsLoading(false);
  }
};




  useEffect(() => {
    if (open) {
      setShowUploadModal(true);
      setExpandedDay(null);
      setInputValue("");
      setIsSubmitting(false);
      // Reset dayFoods before fetching to avoid showing stale data
      setDayFoods({});
      setExistingWeekId(null);
      // Fetch existing data
      fetchExistingFoodData();
    } else {
      setShowUploadModal(false);
      setExpandedDay(null);
      setInputValue("");
      setIsSubmitting(false);
      setDayFoods({});
      setExistingWeekId(null);
    }
  }, [open, profileId, selectedWeekText]); // Add dependencies

  const handleAddFood = (dayIndex) => {
    if (!inputValue.trim()) return;

    setDayFoods((prev) => ({
      ...prev,
      [dayIndex]: [...(prev[dayIndex] || []), inputValue.trim()],
    }));

    setInputValue("");
  };

  const handleRemoveFood = (dayIndex, foodIndex) => {
    setDayFoods((prev) => ({
      ...prev,
      [dayIndex]: (prev[dayIndex] || []).filter((_, i) => i !== foodIndex),
    }));
  };

  const totalItems = Object.values(dayFoods).reduce(
    (sum, foodsArray) => sum + (foodsArray?.length || 0),
    0
  );


  const handleSaveAsDraft = async () => {
  if (isSubmitting) return;

  setIsSubmitting(true);

  try {
    const { start_date, end_date } = parseWeekDates(selectedWeekText);


    if (!start_date || !end_date) {
      toast.error("Invalid date format in week selection");
      return;
    }

    // ✅ Build daysArray from current UI state (can be EMPTY)
    const daysArray = [];
    for (let i = 0; i < 7; i++) {
      const items = Array.isArray(dayFoods[i]) ? dayFoods[i] : [];
      if (items.length > 0) {
        daysArray.push({
          day_no: i + 1,
          items,
        });
      }
    }

    // ✅ Allow saving empty draft too (clears previous draft on backend)
    const food_json = { days: daysArray };


    const response = await saveWeeklyFoodJson(
      dieticianId,
      profileId,
      start_date,
      end_date,
      food_json
    );

    // ✅ Toast based on whether it's empty (clear) or normal save
    if (daysArray.length === 0) {
      toast.success("Draft cleared (no food items saved).");
    } else if (response?.action === "inserted") {
      toast.success("Food items inserted successfully!");
    } else if (response?.action === "updated") {
      toast.success("Food items updated successfully!");
    } else {
      toast.success(response?.message || "Draft saved successfully!");
    }

    // ✅ Keep your existing behavior (MealLogged will receive daysArray)
    if (onUploaded) {
      await Promise.resolve(onUploaded(daysArray));
    }

    setTimeout(() => {
      onClose?.();
    }, 500);
  } catch (error) {
    console.error("Error saving draft:", error);
    toast.error(error?.message || "Failed to save draft");
  } finally {
    setIsSubmitting(false);
  }
};



// const handleSubmit = async () => {
//   if (!isSubmitEnabled || isSubmitting || isLoading) return;

//   setIsSubmitting(true);

//   try {
//     const { start_date, end_date } = parseWeekDates(selectedWeekText);

//     if (!start_date || !end_date) {
//       toast.error("Invalid date format in week selection");
//       return;
//     }

//     const daysArray = buildDaysArray(); // can be []

//     // ✅ Allow empty submit ONLY for previous week (to clear backend)
//     const allowEmptyClear = isPreviousWeek;

//     if (daysArray.length === 0 && !allowEmptyClear) {
//       toast.error("Please add at least one food item before submitting.");
//       return;
//     }

//     // ✅ Always save (even empty) so backend removes old foods
//     const saveResp = await saveWeeklyFoodJson(
//       dieticianId,
//       profileId,
//       start_date,
//       end_date,
//       { days: daysArray } // [] means clear
//     );

//     if (daysArray.length === 0) {
//       toast.success("All food items removed for this week.");
//     } else if (saveResp?.action === "inserted") {
//       toast.success("Food items inserted successfully!");
//     } else if (saveResp?.action === "updated") {
//       toast.success("Food items updated successfully!");
//     } else {
//       toast.success(saveResp?.message || "Food submitted successfully!");
//     }

//     // ✅ Let MealLogged refresh (send empty also)
//     await Promise.resolve(onUploaded?.(daysArray));

//     onClose?.();
//   } catch (e) {
//     console.error("Submit error:", e);
//     toast.error(e?.message || "Failed to submit");
//   } finally {
//     setIsSubmitting(false);
//   }
// };


const handleSubmit = async () => {
  if (!isSubmitEnabled || isSubmitting || isLoading) return;

  setIsSubmitting(true);

  try {
    const { start_date, end_date } = parseWeekDates(selectedWeekText);

    if (!start_date || !end_date) {
      toast.error("Invalid date format in week selection");
      return;
    }

    const daysArray = buildDaysArray(); // [{day_no: 1, items: [...]}, ...]
    
    // Allow empty submit ONLY for previous week (to clear backend)
    const allowEmptyClear = isPreviousWeek;

    if (daysArray.length === 0 && !allowEmptyClear) {
      toast.error("Please add at least one food item before submitting.");
      return;
    }

    // FORMAT 1: For save_weekly_food_json.php - expects food_json with days array
    const foodJsonForSave = { days: daysArray };
    

    // Save to database first
    const saveResp = await saveWeeklyFoodJson(
      dieticianId,
      profileId,
      start_date,
      end_date,
      foodJsonForSave // This matches what save_weekly_food_json.php expects
    );

    if (daysArray.length === 0) {
      toast.success("All food items removed for this week.");
    } else if (saveResp?.action === "inserted") {
      toast.success("Food items inserted successfully!");
    } else if (saveResp?.action === "updated") {
      toast.success("Food items updated successfully!");
    } else {
      toast.success(saveResp?.message || "Food submitted successfully!");
    }

    // FORMAT 2: For weekly_analysis_complete1.php - needs days in different format
    // Convert to {day1: [...], day2: [...]} format
    const daysForAnalysis = {};
    daysArray.forEach(day => {
      daysForAnalysis[`day${day.day_no}`] = day.items;
    });
    

    // Pass both formats to MealLogged so it can decide which to use
    // You can modify MealLogged to use the appropriate format based on the API
    await Promise.resolve(onUploaded?.({
      daysArray: daysArray, // For your internal state
      daysForAnalysis: daysForAnalysis // For weekly_analysis_complete1.php
    }));

    onClose?.();
  } catch (e) {
    console.error("Submit error:", e);
    toast.error(e?.message || "Failed to submit");
  } finally {
    setIsSubmitting(false);
  }
};




const checkSubmitAvailability = () => {
  if (!selectedWeekText) return false;

  const { end_date } = parseWeekDates(selectedWeekText);
  if (!end_date) return false;

  const [year, month, day] = end_date.split("-").map(Number);

  // end date at local midnight
  const endLocal = new Date(year, month - 1, day, 0, 0, 0, 0);

  // today at local midnight
  const now = new Date();
  const todayLocalMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0
  );

  // ✅ 1) If selected week is in the past → always enable submit
  if (endLocal < todayLocalMidnight) {
    return true;
  }

  // ✅ 2) If it is today's end_date → enable only after 9 PM
  const isSameDate =
    now.getFullYear() === year &&
    now.getMonth() + 1 === month &&
    now.getDate() === day;

  const isAfter9pm = now.getHours() >= 21;

  return isSameDate && isAfter9pm;
};



  
useEffect(() => {
  if (!open) {
    setIsSubmitEnabled(false);
    return;
  }

  const update = () => {
    setIsSubmitEnabled(checkSubmitAvailability());
  };

  update();

  const interval = setInterval(update, 60000);
  return () => clearInterval(interval);
}, [open, selectedWeekText]);


const isPreviousWeek = (() => {
  if (!selectedWeekText) return false;

  const { end_date } = parseWeekDates(selectedWeekText);
  if (!end_date) return false;

  const [y, m, d] = end_date.split("-").map(Number);

  const endLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
  const now = new Date();
  const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  return endLocal < todayLocalMidnight; // ✅ past week
})();


const formattedEndDate = (() => {
  if (!selectedWeekText) return "";

  const { end_date } = parseWeekDates(selectedWeekText);
  if (!end_date) return "";

  const [y, m, d] = end_date.split("-").map(Number);
  const endLocal = new Date(y, m - 1, d);

  return endLocal.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
})();




if (!showUploadModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]"
      onClick={() => !isSubmitting && !isLoading && onClose()}
    >
      <div
        className="relative bg-white w-[800px] rounded-[10px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => !isSubmitting && !isLoading && onClose()}
          className="absolute -right-10 top-0 bg-white px-3 py-1 rounded shadow cursor-pointer text-black disabled:opacity-50"
          disabled={isSubmitting || isLoading}
        >
          x
        </button>

        {/* Header */}
        <div className="px-5 pt-[31px]">
          <div className="flex justify-between pb-1">
          <div className="flex flex-col gap-2.5 px-[9px] py-[2px]">
            <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
              {selectedWeekText || "selected week"}
            </p>
            <p className="text-[#252525] text-[25px] font-semibold leading-[110%] tracking-[-0.5px]">
              Add Food
            
            </p>
          </div>

          
             {/* <button
             
              className="rounded-[10px] cursor-pointer text-[#FFFFFF] text-[12px] font-semibold bg-[#308BF9] px-5 py-[15px] hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
             Save as Draft
            </button> */}

            <div className="flex gap-2.5">
               <div className="flex items-center p-2.5">
            <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
              {totalItems} Items added
            </p>
          </div>

{!isPreviousWeek && (
             <button
              onClick={handleSaveAsDraft}
           disabled={isSubmitting || isLoading}
              className="rounded-[10px] cursor-pointer text-[#FFFFFF] text-[12px] font-semibold bg-[#308BF9] px-5 py-[15px] hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? " Save as Draft..." : isLoading ? "Loading..." : " Save as Draft"}
            </button>
            )}
            </div>
          </div>


          <div className="border-b border-[#E1E6ED]"></div>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[500px] overflow-y-auto scroll-hide px-5 pb-7">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#308BF9]"></div>
              <p className="ml-3 text-gray-600">Loading existing food items...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 border border-[#F5F7FA] bg-[#F5F7FA] rounded-[10px] px-[18px] py-7 mt-6">
              {[...Array(7)].map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col bg-white rounded-[15px] transition-all duration-300"
                >
                  {/* Day Header */}
                  <div
                    onClick={() => {
                      if (!isSubmitting && !isLoading) {
                        setExpandedDay(expandedDay === index ? null : index);
                        setInputValue("");
                      }
                    }}
                    className="flex justify-between items-center py-[18px] pl-[38px] pr-7 cursor-pointer"
                  >
                    <div className="flex flex-col gap-2">
                      <p className="text-[#252525] text-[15px] font-normal leading-[110%] tracking-[-0.3px]">
                        Day {index + 1}
                      </p>
                      <p className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">
                        {dayFoods[index]?.length || 0} Items added
                      </p>
                    </div>

                    <div
                      className={`transition-transform duration-200 ${
                        expandedDay === index ? "rotate-180" : ""
                      } ${isSubmitting || isLoading ? "opacity-50" : ""}`}
                    >
                      <Image
                        src="/icons/right-down button.svg"
                        alt="toggle"
                        width={24}
                        height={24}
                      />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedDay === index && (
                    <div className="px-[38px] pb-[18px] animate-in fade-in slide-in-from-top-1">
                      {/* Input Box */}
                      <div className="flex justify-between items-center bg-white border border-[#E1E6ED] rounded-[8px] py-[7px] pl-5 pr-2.5 w-[468px]">
                        <input
                          type="text"
                          placeholder="Enter food"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !isSubmitting && !isLoading && handleAddFood(index)}
                          className="text-[#252525] text-[12px] font-normal outline-none w-full disabled:opacity-50"
                          disabled={isSubmitting || isLoading}
                        />
                        <div
                          onClick={() => !isSubmitting && !isLoading && handleAddFood(index)}
                          className="flex justify-center items-center bg-[#308BF9] rounded-[4px] p-1 cursor-pointer hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                          <Image
                            src="/icons/hugeicons_addplus-01.svg"
                            alt="add"
                            width={20}
                            height={20}
                          />
                        </div>
                      </div>

                      {/* Tags List */}
                      <div className="flex flex-wrap gap-[12px] mt-[13px]">
                        {(dayFoods[index] || []).map((food, foodIndex) => (
                          <div
                            key={foodIndex}
                            className="flex items-center gap-3 py-[5px] pl-3 pr-[7px] bg-[#CAE1FF99] rounded-[8px]"
                          >
                            <p className="text-[#252525] text-[15px] font-normal leading-[130%] tracking-[-0.3px]">
                              {food}
                            </p>
                            <Image
                              src="/icons/close cancel icon.svg"
                              alt="remove"
                              width={16}
                              height={16}
                              className={`cursor-pointer ${isSubmitting || isLoading ? "opacity-50" : ""}`}
                              onClick={() => !isSubmitting && !isLoading && handleRemoveFood(index, foodIndex)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3.5 justify-end items-center px-5 pb-7">
          {!isPreviousWeek && (
          <div className="mt-[23px] p-2.5">
            <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
             Submit button will be active on {formattedEndDate} after 9 PM
            </p>
          </div>
          )}

          <div className="flex justify-end gap-2.5 mt-[23px]">

<button
  onClick={handleSubmit}
  disabled={!isSubmitEnabled || isSubmitting || isLoading}
  className="rounded-[10px] cursor-pointer text-[#FFFFFF] text-[12px] font-semibold bg-[#308BF9] px-5 py-[15px] hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  Submit
</button>
          </div>
        </div>
      </div>
    </div>
  );
}