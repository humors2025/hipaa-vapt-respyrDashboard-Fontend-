
// "use client";

// import { IoIosArrowDown } from "react-icons/io";
// import { RxCross2 } from "react-icons/rx";
// import React, { useState, useRef, useEffect } from "react";
// import Image from "next/image";
// import { toast } from "sonner";
// import { useSearchParams } from "next/navigation";
// import Cookies from "js-cookie";
// import { fetchClientProfileData } from "../services/authService"; // 🔹 make sure path is correct

// function normalizeNumber(value) {
//   if (value === null || value === undefined || value === "") {
//     return "0";
//   }
//   return String(value);
// }

// export default function Summary({ onConfirmNext }) {
//   const searchParams = useSearchParams();
//   const profileId = searchParams.get("profile_id");

//   // 🔑 unique localStorage key per client
//   const storageKey = profileId ? `planSummary_${profileId}` : "planSummary_default";

//   const [planTitle, setPlanTitle] = useState("");
//   const [approachInput, setApproachInput] = useState("");
//   const [approachTags, setApproachTags] = useState([]);
//   const [goals, setGoals] = useState([{ id: 1, title: "", current: "", target: "" }]);
//   const [goalUnits, setGoalUnits] = useState([
//     { id: 1, currentUnit: "Unit", targetUnit: "Unit" }
//   ]);
//   const [isDiabetic, setIsDiabetic] = useState(false);
//   const [dietType, setDietType] = useState("");
//   const [showDietDropdown, setShowDietDropdown] = useState(false);

//   const dietDropdownRef = useRef(null);

//   const [errors, setErrors] = useState({
//     planTitle: "",
//     fromDate: "",
//     toDate: "",
//     isDiabetic: "",
//     dietType: "",
//     caloriesTarget: "",
//     proteinTarget: "",
//     fiberTarget: "",
//     carbsTarget: "",
//     fatTarget: "",
//     waterTarget: "",
//     approach: "",
//     goals: {}
//   });

//   const [fromDate, setFromDate] = useState("");
//   const [toDate, setToDate] = useState("");
//   const fromPickerRef = useRef(null);
//   const toPickerRef = useRef(null);

//   const [showCurrentDropdown, setShowCurrentDropdown] = useState(null);
//   const [showTargetDropdown, setShowTargetDropdown] = useState(null);

//   const [caloriesTarget, setCaloriesTarget] = useState("");
//   const [proteinTarget, setProteinTarget] = useState("");
//   const [fiberTarget, setFiberTarget] = useState("");
//   const [carbsTarget, setCarbsTarget] = useState("");
//   const [fatTarget, setFatTarget] = useState("");
//   const [waterTarget, setWaterTarget] = useState("");

//   const currentDropdownRef = useRef(null);
//   const targetDropdownRef = useRef(null);

//   const unitOptions = [
//     "kg",
//     "g",
//     "lb",
//     "oz",
//     "cm",
//     "m",
//     "inch",
//     "ft",
//     "%",
//     "bpm",
//     "cal",
//     "kcal"
//   ];

//   // to keep all plans from API (active + completed + not_started)
//   const [allPlans, setAllPlans] = useState([]);


//   const [isSavingDraft, setIsSavingDraft] = useState(false);

//   // ---------- Helpers for date format ----------
//   const ymdToDmy = (v) => {
//     if (!v) return "";
//     const [y, m, d] = v.split("-");
//     return `${d}/${m}/${y}`;
//   };

//   const dmyToYmd = (v) => {
//     if (!v) return "";
//     const [d, m, y] = v.split("/");
//     return `${y}-${m}-${d}`;
//   };

//   const validateToDate = (from, to) => {
//     if (!from || !to) return true;
//     const fromDateLocal = new Date(from.split("/").reverse().join("-"));
//     const toDateLocal = new Date(to.split("/").reverse().join("-"));
//     return toDateLocal > fromDateLocal;
//   };

//   // ---------- Load from localStorage ----------
//   const loadFromLocalStorage = () => {
//     try {
//       const savedData =
//         typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
//       if (savedData) {
//         const data = JSON.parse(savedData);

//         // Basic fields
//         setPlanTitle(data.plan_title || "");
//         setFromDate(ymdToDmy(data.plan_start_date) || "");
//         setToDate(ymdToDmy(data.plan_end_date) || "");

//         // is_diabetic (boolean or "yes"/"no")
//         if (typeof data.is_diabetic === "boolean") {
//           setIsDiabetic(data.is_diabetic);
//         } else if (data.is_diabetic === "yes") {
//           setIsDiabetic(true);
//         } else if (data.is_diabetic === "no") {
//           setIsDiabetic(false);
//         } else {
//           setIsDiabetic(false);
//         }

//         // diet_type -> only set if non-empty to avoid overriding with blank
//         if (data.diet_type && data.diet_type.trim()) {
//           setDietType(data.diet_type);
//         }

//         setCaloriesTarget(normalizeNumber(data.calories_target || ""));
//         setProteinTarget(normalizeNumber(data.protein_target || ""));
//         setFiberTarget(normalizeNumber(data.fiber_target || ""));
//         setCarbsTarget(normalizeNumber(data.carbs_target || ""));
//         setFatTarget(normalizeNumber(data.fat_target || ""));
//         setWaterTarget(normalizeNumber(data.water_target || ""));

//         // approach tags
//         if (data.approach) {
//           setApproachTags(data.approach.split(",").filter((t) => t.trim()));
//         }

//         // goals — can be array or JSON string
//         if (data.goal && data.goal.length > 0) {
//           let goalArray = [];

//           if (Array.isArray(data.goal)) {
//             // Already an array (from this Summary form)
//             goalArray = data.goal;
//           } else if (typeof data.goal === "string") {
//             // Comes as JSON string from backend
//             try {
//               const parsed = JSON.parse(data.goal);
//               if (Array.isArray(parsed)) {
//                 goalArray = parsed;
//               } else {
//                 console.warn("Parsed data.goal is not array:", parsed);
//               }
//             } catch (e) {
//               console.error("Failed to parse data.goal JSON:", e, data.goal);
//             }
//           }

//           if (goalArray.length > 0) {
//             const loadedGoals = [];
//             const loadedGoalUnits = [];

//             goalArray.forEach((goalItem, index) => {
//               const goalId = index + 1;

//               // Matches e.g. "125kg" → ["125kg", "125", "kg"]
//               const currentMatch =
//                 goalItem.current_stat?.toString().match(/(\d*\.?\d*)(.*)/) ||
//                 ["", "", "Unit"];
//               const targetMatch =
//                 goalItem.target_stat?.toString().match(/(\d*\.?\d*)(.*)/) ||
//                 ["", "", "Unit"];

//               // 🔹 Use stored unit as fallback (this comes from prepareFormData -> unit)
//               const fallbackUnit = goalItem.unit || "";

//               loadedGoals.push({
//                 id: goalId,
//                 title: goalItem.name || "",
//                 current: currentMatch[1] || "",
//                 target: targetMatch[1] || ""
//               });

//               loadedGoalUnits.push({
//                 id: goalId,
//                 currentUnit:
//                   (currentMatch[2] || fallbackUnit || "Unit").trim() || "Unit",
//                 targetUnit:
//                   (targetMatch[2] || fallbackUnit || "Unit").trim() || "Unit"
//               });
//             });

//             setGoals(loadedGoals);
//             setGoalUnits(loadedGoalUnits);
//           }
//         }
//       }
//     } catch (error) {
//       console.error("Error loading from localStorage:", error);
//     }
//   };

//   // ---------- On mount: prefer draft, else fetch from API ----------
//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     // 1️⃣ If there's a local draft for THIS profile, load and exit
//     const saved = localStorage.getItem(storageKey);
//     if (saved) {
//       loadFromLocalStorage();
//       return;
//     }

//     // 2️⃣ Else fetch from API using profile_id + dietician cookie
//     const profileIdLocal = searchParams.get("profile_id");
//     const dieticianCookie = Cookies.get("dietician");
//     let dieticianId = null;

//     if (dieticianCookie) {
//       try {
//         const dietician = JSON.parse(dieticianCookie);
//         dieticianId = dietician?.dietician_id;
//       } catch (e) {
//         console.error("Error parsing dietician cookie:", e);
//       }
//     }

//     if (!profileIdLocal || !dieticianId) {
//       console.warn("Missing profile_id or login_id for fetchClientProfileData");
//       return;
//     }

//     const fetchProfile = async () => {
//       try {
//         const res = await fetchClientProfileData(dieticianId, profileIdLocal);
//         if (!res?.success) {
//           console.warn("fetchClientProfileData failed:", res);
//           return;
//         }

//         const data = res.data;
//         const plansSummary = data?.plans_summary || {};

//         const activePlans = plansSummary.active || [];
//         const completedPlans = plansSummary.completed || [];
//         const notStartedPlans = plansSummary.not_started || [];

//         const all = [...activePlans, ...completedPlans, ...notStartedPlans];
//         setAllPlans(all);

//         if (!all.length) {
//           // no plans at all
//           return;
//         }

//         // Priority for Summary: active → not_started → completed
//         const selectedPlan =
//           activePlans[0] || notStartedPlans[0] || completedPlans[0];

//         if (!selectedPlan) return;

//         // Basic fields
//         setPlanTitle(selectedPlan.plan_title || "");
//         setFromDate(ymdToDmy(selectedPlan.plan_start_date) || "");
//         setToDate(ymdToDmy(selectedPlan.plan_end_date) || "");

//         setCaloriesTarget(normalizeNumber(selectedPlan.calories_target));
//         setProteinTarget(normalizeNumber(selectedPlan.protein_target));
//         setFiberTarget(normalizeNumber(selectedPlan.fiber_target));
//         setCarbsTarget(normalizeNumber(selectedPlan.carbs_target));
//         setFatTarget(normalizeNumber(selectedPlan.fat_target));
//         setWaterTarget(normalizeNumber(selectedPlan.water_target));
//         setDietType(selectedPlan.diet_type || ""); // 🔹 bind diet_type from API

//         // is_diabetic from API (boolean or yes/no)
//         let isDiabeticValue = false;
//         if (typeof selectedPlan.is_diabetic === "boolean") {
//           isDiabeticValue = selectedPlan.is_diabetic;
//         } else if (selectedPlan.is_diabetic === "yes") {
//           isDiabeticValue = true;
//         } else if (selectedPlan.is_diabetic === "no") {
//           isDiabeticValue = false;
//         }
//         setIsDiabetic(isDiabeticValue);

//         // Approach
//         if (selectedPlan.approach) {
//           setApproachTags(
//             selectedPlan.approach.split(",").filter((t) => t.trim())
//           );
//         }

//         // Goals: JSON string → array
//         if (selectedPlan.goal) {
//           try {
//             const parsedGoals = JSON.parse(selectedPlan.goal);
//             if (Array.isArray(parsedGoals) && parsedGoals.length > 0) {
//               const loadedGoals = [];
//               const loadedGoalUnits = [];

//               parsedGoals.forEach((goalItem, index) => {
//                 const goalId = index + 1;

//                 const currentMatch =
//                   goalItem.current_stat?.toString().match(/(\d*\.?\d*)(.*)/) ||
//                   ["", "", "Unit"];
//                 const targetMatch =
//                   goalItem.target_stat?.toString().match(/(\d*\.?\d*)(.*)/) ||
//                   ["", "", "Unit"];

//                 loadedGoals.push({
//                   id: goalId,
//                   title: goalItem.name || "",
//                   current: currentMatch[1] || "0",
//                   target: targetMatch[1] || "0"
//                 });

//                 const fallbackUnit = goalItem.unit || "";
//                 loadedGoalUnits.push({
//                   id: goalId,
//                   currentUnit:
//                     (currentMatch[2] || fallbackUnit || "Unit").trim() || "Unit",
//                   targetUnit:
//                     (targetMatch[2] || fallbackUnit || "Unit").trim() || "Unit"
//                 });
//               });

//               setGoals(loadedGoals);
//               setGoalUnits(loadedGoalUnits);
//             }
//           } catch (e) {
//             console.error("Error parsing selectedPlan.goal:", e, selectedPlan.goal);
//           }
//         }

//         // Also store normalized planSummary in localStorage for THIS profile
//         const formData = {
//           plan_id: selectedPlan.id,
//           plan_title: selectedPlan.plan_title || "",
//           plan_start_date: selectedPlan.plan_start_date || "",
//           plan_end_date: selectedPlan.plan_end_date || "",
//           is_diabetic: isDiabeticValue,
//           diet_type: selectedPlan.diet_type || "",
//           calories_target: selectedPlan.calories_target || "",
//           protein_target: selectedPlan.protein_target || "",
//           fiber_target: selectedPlan.fiber_target || "",
//           carbs_target: selectedPlan.carbs_target || "",
//           fat_target: selectedPlan.fat_target || "",
//           water_target: selectedPlan.water_target || "",
//           goal: selectedPlan.goal,
//           approach: selectedPlan.approach || ""
//         };

//         localStorage.setItem(storageKey, JSON.stringify(formData));
//       } catch (error) {
//         console.error("Error fetching client profile:", error);
//       }
//     };

//     fetchProfile();
//   }, [searchParams, storageKey]);

//   // -------- Click outside handlers --------
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (
//         currentDropdownRef.current &&
//         !currentDropdownRef.current.contains(event.target)
//       ) {
//         setShowCurrentDropdown(null);
//       }
//       if (
//         targetDropdownRef.current &&
//         !targetDropdownRef.current.contains(event.target)
//       ) {
//         setShowTargetDropdown(null);
//       }
//       if (dietDropdownRef.current && !dietDropdownRef.current.contains(event.target)) {
//         setShowDietDropdown(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   // --------- Tag helpers ----------
//   const addTag = () => {
//     const t = approachInput.trim();
//     if (!t) return;
//     const exists = approachTags.some((a) => a.toLowerCase() === t.toLowerCase());
//     if (!exists) {
//       setApproachTags((prev) => [...prev, t]);
//       setErrors((prev) => ({ ...prev, approach: "" }));
//     }
//     setApproachInput("");
//   };

//   const removeTag = (i) =>
//     setApproachTags((prev) => prev.filter((_, idx) => idx !== i));

//   const handleKeyDown = (e) => {
//     if (e.key === "Enter" || e.key === ",") {
//       e.preventDefault();
//       addTag();
//     }
//   };

//   // --------- Goal / unit helpers ----------
//   const handleUnitSelect = (unit, type, goalId) => {
//     setGoalUnits((prev) =>
//       prev.map((goalUnit) =>
//         goalUnit.id === goalId
//           ? {
//               ...goalUnit,
//               [type]: unit
//             }
//           : goalUnit
//       )
//     );
//     if (type === "currentUnit") setShowCurrentDropdown(null);
//     else setShowTargetDropdown(null);
//   };

//   const toggleCurrentDropdown = (goalId) => {
//     setShowCurrentDropdown(goalId);
//     setShowTargetDropdown(null);
//   };
//   const toggleTargetDropdown = (goalId) => {
//     setShowTargetDropdown(goalId);
//     setShowCurrentDropdown(null);
//   };

//   const handleDietSelect = (type) => {
//     setDietType(type);
//     setShowDietDropdown(false);
//     setErrors((prev) => ({ ...prev, dietType: "" }));
//   };

//   const openFromPicker = () => {
//     fromPickerRef.current?.showPicker?.() || fromPickerRef.current?.click();
//   };
//   const openToPicker = () => {
//     toPickerRef.current?.showPicker?.() || toPickerRef.current?.click();
//   };

//   const updateGoal = (goalId, field, value) => {
//     setGoals((prev) =>
//       prev.map((goal) =>
//         goal.id === goalId ? { ...goal, [field]: value } : goal
//       )
//     );
//     setErrors((prev) => ({
//       ...prev,
//       goals: {
//         ...prev.goals,
//         [goalId]: { ...(prev.goals[goalId] || {}), [field]: "" }
//       }
//     }));
//   };

//   const addNewGoal = () => {
//     const newGoalId = goals.length > 0 ? Math.max(...goals.map((g) => g.id)) + 1 : 1;
//     setGoals((prev) => [
//       ...prev,
//       { id: newGoalId, title: "", current: "", target: "" }
//     ]);
//     setGoalUnits((prev) => [
//       ...prev,
//       { id: newGoalId, currentUnit: "Unit", targetUnit: "Unit" }
//     ]);
//   };

//   const removeGoal = (goalId) => {
//     if (goals.length > 1) {
//       setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
//       setGoalUnits((prev) => prev.filter((goalUnit) => goalUnit.id !== goalId));
//       setErrors((prev) => {
//         const g = { ...prev.goals };
//         delete g[goalId];
//         return { ...prev, goals: g };
//       });
//     }
//   };

//   const markGoalError = (curr, key, message) => ({ ...(curr || {}), [key]: message });

//   // --------- Validation ----------
//   const validateForm = () => {
//     const nextErrors = {
//       planTitle: "",
//       fromDate: "",
//       toDate: "",
//       isDiabetic: "",
//       dietType: "",
//       caloriesTarget: "",
//       proteinTarget: "",
//       fiberTarget: "",
//       carbsTarget: "",
//       fatTarget: "",
//       waterTarget: "",
//       approach: "",
//       goals: {}
//     };

//     if (!planTitle.trim()) nextErrors.planTitle = "Enter plan title";
//     if (!fromDate) nextErrors.fromDate = "Select start date";
//     if (!toDate) nextErrors.toDate = "Select end date";

//     if (fromDate && toDate && !validateToDate(fromDate, toDate)) {
//       nextErrors.toDate = "To date must be after From date";
//     }

//     // Only mark error if literally undefined/null; false is a valid value (No)
//     if (isDiabetic === undefined || isDiabetic === null) {
//       nextErrors.isDiabetic = "Please select diabetic status";
//     }

//     if (!dietType) nextErrors.dietType = "Please select diet type";
//     if (!caloriesTarget) nextErrors.caloriesTarget = "Enter calories target";
//     if (!proteinTarget) nextErrors.proteinTarget = "Enter protein target";
//     if (!fiberTarget) nextErrors.fiberTarget = "Enter fiber target";
//     if (!carbsTarget) nextErrors.carbsTarget = "Enter carbs target";
//     if (!fatTarget) nextErrors.fatTarget = "Enter fat target";
//     if (!waterTarget) nextErrors.waterTarget = "Enter water target";

//     if (approachTags.length === 0) nextErrors.approach = "Add at least one approach";

//     goals.forEach((g) => {
//       let ge = nextErrors.goals[g.id] || {};
//       if (!g.title.trim()) ge = markGoalError(ge, "title", "Enter goal title");
//       if (!g.current) ge = markGoalError(ge, "current", "Enter current stat");
//       if (!g.target) ge = markGoalError(ge, "target", "Enter target stat");

//       const goalUnit = goalUnits.find((gu) => gu.id === g.id) || {
//         currentUnit: "Unit",
//         targetUnit: "Unit"
//       };
//       if (goalUnit.currentUnit === "Unit")
//         ge = markGoalError(ge, "currentUnit", "Select current unit");
//       if (goalUnit.targetUnit === "Unit")
//         ge = markGoalError(ge, "targetUnit", "Select target unit");

//       if (Object.keys(ge).length) nextErrors.goals[g.id] = ge;
//     });

//     setErrors(nextErrors);

//     const hasTopLevel =
//       nextErrors.planTitle ||
//       nextErrors.fromDate ||
//       nextErrors.toDate ||
//       nextErrors.isDiabetic ||
//       nextErrors.dietType ||
//       nextErrors.caloriesTarget ||
//       nextErrors.proteinTarget ||
//       nextErrors.fiberTarget ||
//       nextErrors.carbsTarget ||
//       nextErrors.fatTarget ||
//       nextErrors.waterTarget ||
//       nextErrors.approach;

//     const hasGoalLevel = Object.keys(nextErrors.goals).length > 0;

//     if (hasTopLevel || hasGoalLevel) {
//       toast.error("Please fix the highlighted fields");
//       return false;
//     }
//     return true;
//   };

//   const prepareFormData = () => {
//     return {
//       plan_title: planTitle,
//       plan_start_date: dmyToYmd(fromDate),
//       plan_end_date: dmyToYmd(toDate),
//       is_diabetic: isDiabetic,
//       diet_type: dietType,
//       calories_target: caloriesTarget,
//       protein_target: proteinTarget,
//       fiber_target: fiberTarget,
//       carbs_target: carbsTarget,
//       fat_target: fatTarget,
//       water_target: waterTarget,
//       goal: goals.map((goal) => {
//         const goalUnit = goalUnits.find((gu) => gu.id === goal.id) || {
//           currentUnit: "Unit",
//           targetUnit: "Unit"
//         };
//         const unit =
//           goalUnit.currentUnit !== "Unit" ? goalUnit.currentUnit : goalUnit.targetUnit;

//         return {
//           name: goal.title,
//           current_stat: goal.current || "",
//           target_stat: goal.target || "",
//           unit: unit !== "Unit" ? unit : ""
//         };
//       }),
//       approach: approachTags.join(",")
//     };
//   };

//   const saveToLocalStorage = (isDraft = false) => {
//     if (!isDraft && !validateForm()) return;
//     const formData = prepareFormData();
//     if (isDraft) formData.isDraft = true;
//     localStorage.setItem(storageKey, JSON.stringify(formData));
//     if (isDraft) {
//       // optional toast here
//     } else {
//       onConfirmNext?.();
//     }
//   };

//   // const handleSaveAsDraft = () => saveToLocalStorage(true);
//   const handleSaveAsDraft = () => {
//   setIsSavingDraft(true);

//   setTimeout(() => {
//     saveToLocalStorage(true);
//     setIsSavingDraft(false);
//     toast.success("Draft saved"); 
//   }, 600); 
// };


//   const handleConfirmNext = () => saveToLocalStorage(false);

//   const onChangeAndClear = (setter, key) => (e) => {
//     setter(e.target.value);
//     setErrors((prev) => ({ ...prev, [key]: "" }));
//   };

  

//   return (
//     <div className="w-full">
//       <div className="pt-[23px]">
//         <div className="flex justify-between items-center">
//           <p className="text-[#252525] pb-[18px] pt-[23px] text-[20px] font-semibold leading-[110%] tracking-[0.4px] whitespace-nowrap">
//             Plan Summary
//           </p>
//         </div>

//         <div className="w-full border-b border-[#E1E6ED]"></div>

        
//       </div>


//       <div className="mt-[15px]">
//           <div className="flex gap-5 items-end">
//             <div className="relative flex-1">
//               <input
//                 type="text"
//                 value={planTitle}
//                 onChange={(e) => {
//                   setPlanTitle(e.target.value);
//                   setErrors((prev) => ({ ...prev, planTitle: "" }));
//                 }}
//                 className={`block py-[15px] pl-[19px] pr-[13px] w-full text-[14px] text-[#252525] bg-white rounded-[8px] border appearance-none focus:outline-none focus:ring-0 ${
//                   errors.planTitle ? "border-[#DA5747]" : "border-[#E1E6ED]"
//                 } focus:border-blue-600 peer`}
//                 placeholder=""
//                 id="plan-title-input"
//               />
//               <label
//                 htmlFor="plan-title-input"
//                 className="absolute text-[14px] text-[#9CA3AF] duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 start-1"
//               >
//                 Name of the plan
//               </label>
//               {errors.planTitle ? (
//                 <div className="flex gap-[5px] items-center mt-1">
//                   <Image
//                     src="/icons/hugeicons_information-circle-redd.png"
//                     alt="info"
//                     width={15}
//                     height={15}
//                   />
//                   <span className="text-[#DA5747] text-[10px]">
//                     {errors.planTitle}
//                   </span>
//                 </div>
//               ) : null}
//             </div>

//             <div className="flex-1">
//               <span className="px-[9px] text-[#252525] text-[12px] leading-normal font-semibold tracking-[-0.24px]">
//                 Duration
//               </span>

//               <div className="flex gap-2 mt-2">
//                 <div className="relative flex-1">
//                   <span className="absolute -top-2 left-4 bg-white px-[9px] text-[12px] font-medium text-[#535359]">
//                     From
//                   </span>
//                   <div
//                     className={`flex py-[15px] pl-[19px] pr-[13px] rounded-[8px] bg-white ${
//                       errors.fromDate ? "border border-[#DA5747]" : "border border-[#E1E6ED]"
//                     }`}
//                   >
//                     <input
//                       type="text"
//                       readOnly
//                       value={fromDate}
//                       onClick={openFromPicker}
//                       placeholder="DD/MM/YYYY"
//                       className="w-full outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] placeholder:text-[#9CA3AF] cursor-pointer"
//                     />
//                     <button
//                       type="button"
//                       onClick={openFromPicker}
//                       className="cursor-pointer"
//                     >
//                       <Image
//                         src="/icons/hugeicons_calendar-03.svg"
//                         alt="calendar"
//                         width={20}
//                         height={20}
//                       />
//                     </button>
//                     <input
//                       ref={fromPickerRef}
//                       type="date"
//                       className="sr-only"
//                       onChange={(e) => {
//                         setFromDate(ymdToDmy(e.target.value));
//                         setErrors((prev) => ({ ...prev, fromDate: "" }));
//                       }}
//                     />
//                   </div>
//                   {errors.fromDate ? (
//                     <div className="flex gap-[5px] items-center mt-1">
//                       <Image
//                         src="/icons/hugeicons_information-circle-redd.png"
//                         alt="info"
//                         width={15}
//                         height={15}
//                       />
//                       <span className="text-[#DA5747] text-[10px]">
//                         {errors.fromDate}
//                       </span>
//                     </div>
//                   ) : null}
//                 </div>

//                 <div className="relative flex-1">
//                   <span className="absolute -top-2 left-4 bg-white px-[9px] text-[12px] font-medium text-[#535359]">
//                     To
//                   </span>
//                   <div
//                     className={`flex py-[15px] pl-[19px] pr-[13px] rounded-[8px] bg-white ${
//                       errors.toDate ? "border border-[#DA5747]" : "border border-[#E1E6ED]"
//                     }`}
//                   >
//                     <input
//                       type="text"
//                       readOnly
//                       value={toDate}
//                       onClick={openToPicker}
//                       placeholder="DD/MM/YYYY"
//                       className="w-full outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] placeholder:text-[#9CA3AF] cursor-pointer"
//                     />
//                     <button
//                       type="button"
//                       onClick={openToPicker}
//                       className="cursor-pointer flex items-center justify-center"
//                       title="Open calendar"
//                     >
//                       <Image
//                         src="/icons/hugeicons_calendar-03.svg"
//                         alt="calendar"
//                         width={20}
//                         height={20}
//                       />
//                     </button>
//                     <input
//                       ref={toPickerRef}
//                       type="date"
//                       className="sr-only"
//                       onChange={(e) => {
//                         const newToDate = ymdToDmy(e.target.value);
//                         setToDate(newToDate);

//                         if (fromDate && !validateToDate(fromDate, newToDate)) {
//                           setErrors((prev) => ({
//                             ...prev,
//                             toDate: "To date must be after From date"
//                           }));
//                         } else {
//                           setErrors((prev) => ({ ...prev, toDate: "" }));
//                         }
//                       }}
//                     />
//                   </div>
//                   {errors.toDate ? (
//                     <div className="flex gap-[5px] items-center mt-1">
//                       <Image
//                         src="/icons/hugeicons_information-circle-redd.png"
//                         alt="info"
//                         width={15}
//                         height={15}
//                       />
//                       <span className="text-[#DA5747] text-[10px]">
//                         {errors.toDate}
//                       </span>
//                     </div>
//                   ) : null}
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="flex items-center gap-5 mt-[15px]">
//             <div className="flex-1">
//               <div className="px-[9px] pt-[5px] pb-[12px] text-[#252525] text-[12px] leading-normal font-semibold tracking-[-0.24px]">
//                 Choose your diet type
//               </div>
//               <div className="relative" ref={dietDropdownRef}>
//                 <div
//                   className={`flex justify-between items-center py-[15px] pl-[19px] pr-[13px] rounded-[8px] bg-white border cursor-pointer ${
//                     errors.dietType ? "border-[#DA5747]" : "border-[#E1E6ED]"
//                   }`}
//                   onClick={() => setShowDietDropdown(!showDietDropdown)}
//                 >
//                   <span
//                     className={`text-[14px] ${
//                       dietType ? "text-[#252525]" : "text-[#9CA3AF]"
//                     }`}
//                   >
//                     {dietType || "Select diet type"}
//                   </span>
//                   <IoIosArrowDown
//                     className={`text-[#A1A1A1] transition-transform ${
//                       showDietDropdown ? "rotate-180" : ""
//                     }`}
//                   />
//                 </div>

//                 {showDietDropdown && (
//                   <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E1E6ED] rounded-[8px] shadow-lg z-10">
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525] border-b border-[#E1E6ED]"
//                       onClick={() => handleDietSelect("Vegetarian")}
//                     >
//                       Vegetarian
//                     </div>
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525] border-b border-[#E1E6ED]"
//                       onClick={() => handleDietSelect("Non-Vegetarian")}
//                     >
//                       Non-Vegetarian
//                     </div>
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525] border-b border-[#E1E6ED]"
//                       onClick={() => handleDietSelect("Eggitarian")}
//                     >
//                       Eggitarian
//                     </div>
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525] border-b border-[#E1E6ED]"
//                       onClick={() => handleDietSelect("Fishitarian")}
//                     >
//                       Fishitarian
//                     </div>
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525] border-b border-[#E1E6ED]"
//                       onClick={() => handleDietSelect("Vegan")}
//                     >
//                       Vegan
//                     </div>
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525] border-b border-[#E1E6ED]"
//                       onClick={() => handleDietSelect("Lacto-Ovo Vegetarian")}
//                     >
//                       Lacto-Ovo Vegetarian
//                     </div>
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525] border-b border-[#E1E6ED]"
//                       onClick={() => handleDietSelect("Pescatarian")}
//                     >
//                       Pescatarian
//                     </div>
//                     <div
//                       className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-[14px] text-[#252525]"
//                       onClick={() => handleDietSelect("Flexitarian")}
//                     >
//                       Flexitarian
//                     </div>
//                   </div>
//                 )}

//                 {errors.dietType && (
//                   <div className="flex gap-[5px] items-center mt-1">
//                     <Image
//                       src="/icons/hugeicons_information-circle-redd.png"
//                       alt="info"
//                       width={15}
//                       height={15}
//                     />
//                     <span className="text-[#DA5747] text-[10px]">
//                       {errors.dietType}
//                     </span>
//                   </div>
//                 )}
//               </div>
//             </div>

//             <div className="flex-1">
//               {/* Diabetic radio UI commented out in your code */}
//               {errors.isDiabetic && (
//                 <div className="flex gap-[5px] items-center mt-1">
//                   <Image
//                     src="/icons/hugeicons_information-circle-redd.png"
//                     alt="info"
//                     width={15}
//                     height={15}
//                   />
//                   <span className="text-[#DA5747] text-[10px]">
//                     {errors.isDiabetic}
//                   </span>
//                 </div>
//               )}
//             </div>
//           </div>

//           <div className="mt-[15px]">
//             <div className="px-[9px] pt-[5px] pb-[12px] text-[#252525] text-[12px] leading-normal font-semibold tracking-[-0.24px]">
//               Nutrition Target (Per day)
//             </div>
//             <div className="grid grid-cols-1 md:grid-cols-4 gap-[10px]">
//               <div className="relative">
//                 <input
//                   type="number"
//                   min="0"
//                   value={caloriesTarget}
//                   onChange={onChangeAndClear(setCaloriesTarget, "caloriesTarget")}
//                   placeholder=""
//                   className={`peer block w-full py-[15px] pl-[19px] pr-[48px] text-[14px] text-[#252525] bg-white rounded-[8px] outline-none placeholder-transparent ${
//                     errors.caloriesTarget
//                       ? "border border-[#DA5747]"
//                       : "border border-[#E1E6ED]"
//                   } focus:border-blue-600`}
//                 />
//                 <label className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
//                   Calories Target
//                 </label>
//                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#535359]">
//                   kcal
//                 </span>
//                 {errors.caloriesTarget ? (
//                   <div className="flex gap-[5px] items-center mt-1">
//                     <Image
//                       src="/icons/hugeicons_information-circle-redd.png"
//                       alt="info"
//                       width={15}
//                       height={15}
//                     />
//                     <span className="text-[#DA5747] text-[10px]">
//                       {errors.caloriesTarget}
//                     </span>
//                   </div>
//                 ) : null}
//               </div>

//               <div className="relative">
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.1"
//                   value={proteinTarget}
//                   onChange={onChangeAndClear(setProteinTarget, "proteinTarget")}
//                   placeholder=""
//                   className={`peer block w-full py-[15px] pl-[19px] pr-[48px] text-[14px] text-[#252525] bg-white rounded-[8px] outline-none placeholder-transparent ${
//                     errors.proteinTarget
//                       ? "border border-[#DA5747]"
//                       : "border border-[#E1E6ED]"
//                   } focus:border-blue-600`}
//                 />
//                 <label className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
//                   Protein Target
//                 </label>
//                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#535359]">
//                   g
//                 </span>
//                 {errors.proteinTarget ? (
//                   <div className="flex gap-[5px] items-center mt-1">
//                     <Image
//                       src="/icons/hugeicons_information-circle-redd.png"
//                       alt="info"
//                       width={15}
//                       height={15}
//                     />
//                     <span className="text-[#DA5747] text-[10px]">
//                       {errors.proteinTarget}
//                     </span>
//                   </div>
//                 ) : null}
//               </div>

//               <div className="relative">
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.1"
//                   value={fiberTarget}
//                   onChange={onChangeAndClear(setFiberTarget, "fiberTarget")}
//                   placeholder=""
//                   className={`peer block w-full py-[15px] pl-[19px] pr-[48px] text-[14px] text-[#252525] bg-white rounded-[8px] outline-none placeholder-transparent ${
//                     errors.fiberTarget
//                       ? "border border-[#DA5747]"
//                       : "border border-[#E1E6ED]"
//                   } focus:border-blue-600`}
//                 />
//                 <label className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
//                   Fiber Target
//                 </label>
//                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#535359]">
//                   g
//                 </span>
//                 {errors.fiberTarget ? (
//                   <div className="flex gap-[5px] items-center mt-1">
//                     <Image
//                       src="/icons/hugeicons_information-circle-redd.png"
//                       alt="info"
//                       width={15}
//                       height={15}
//                     />
//                     <span className="text-[#DA5747] text-[10px]">
//                       {errors.fiberTarget}
//                     </span>
//                   </div>
//                 ) : null}
//               </div>

//               <div className="relative">
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.1"
//                   value={carbsTarget}
//                   onChange={onChangeAndClear(setCarbsTarget, "carbsTarget")}
//                   placeholder=""
//                   className={`peer block w-full py-[15px] pl-[19px] pr-[48px] text-[14px] text-[#252525] bg-white rounded-[8px] outline-none placeholder-transparent ${
//                     errors.carbsTarget
//                       ? "border border-[#DA5747]"
//                       : "border border-[#E1E6ED]"
//                   } focus:border-blue-600`}
//                 />
//                 <label className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
//                   Carbs Target
//                 </label>
//                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#535359]">
//                   g
//                 </span>
//                 {errors.carbsTarget ? (
//                   <div className="flex gap-[5px] items-center mt-1">
//                     <Image
//                       src="/icons/hugeicons_information-circle-redd.png"
//                       alt="info"
//                       width={15}
//                       height={15}
//                     />
//                     <span className="text-[#DA5747] text-[10px]">
//                       {errors.carbsTarget}
//                     </span>
//                   </div>
//                 ) : null}
//               </div>

//               <div className="relative">
//                 <input
//                   type="number"
//                   min="0"
//                   step="0.1"
//                   value={fatTarget}
//                   onChange={onChangeAndClear(setFatTarget, "fatTarget")}
//                   placeholder=""
//                   className={`peer block w-full py-[15px] pl-[19px] pr-[48px] text-[14px] text-[#252525] bg-white rounded-[8px] outline-none placeholder-transparent ${
//                     errors.fatTarget
//                       ? "border border-[#DA5747]"
//                       : "border border-[#E1E6ED]"
//                   } focus:border-blue-600`}
//                 />
//                 <label className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
//                   Fat Target
//                 </label>
//                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#535359]">
//                   g
//                 </span>
//                 {errors.fatTarget ? (
//                   <div className="flex gap-[5px] items-center mt-1">
//                     <Image
//                       src="/icons/hugeicons_information-circle-redd.png"
//                       alt="info"
//                       width={15}
//                       height={15}
//                     />
//                     <span className="text-[#DA5747] text-[10px]">
//                       {errors.fatTarget}
//                     </span>
//                   </div>
//                 ) : null}
//               </div>

//               <div className="relative">
//                 <input
//                   type="number"
//                   min="0"
//                   step="50"
//                   value={waterTarget}
//                   onChange={onChangeAndClear(setWaterTarget, "waterTarget")}
//                   placeholder=""
//                   className={`peer block w-full py-[15px] pl-[19px] pr-[48px] text-[14px] text-[#252525] bg-white rounded-[8px] outline-none placeholder-transparent ${
//                     errors.waterTarget
//                       ? "border border-[#DA5747]"
//                       : "border border-[#E1E6ED]"
//                   } focus:border-blue-600`}
//                 />
//                 <label className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
//                   Water Target
//                 </label>
//                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#535359]">
//                   ml
//                 </span>
//                 {errors.waterTarget ? (
//                   <div className="flex gap-[5px] items-center mt-1">
//                     <Image
//                       src="/icons/hugeicons_information-circle-redd.png"
//                       alt="info"
//                       width={15}
//                       height={15}
//                     />
//                     <span className="text-[#DA5747] text-[10px]">
//                       {errors.waterTarget}
//                     </span>
//                   </div>
//                 ) : null}
//               </div>
//             </div>
//           </div>

//           {goals.map((goal, index) => {
//             const goalUnit =
//               goalUnits.find((gu) => gu.id === goal.id) || {
//                 currentUnit: "Unit",
//                 targetUnit: "Unit"
//               };
//             const gErr = errors.goals[goal.id] || {};
//             return (
//               <div key={goal.id} className="mt-4">
//                 <div className="flex justify-between items-center">
//                   <div className="px-[9px] pt-[5px] pb-[12px] text-[#252525] text-[12px] leading-normal font-semibold tracking-[-0.24px]">
//                     Goal {index + 1}
//                   </div>
//                   {goals.length > 1 && (
//                     <button
//                       onClick={() => removeGoal(goal.id)}
//                       className="text-red-500 text-[10px] font-semibold"
//                     >
//                       Remove
//                     </button>
//                   )}
//                 </div>

//                 <div className="flex gap-[7px]">
//                   <div className="relative flex-1">
//                     <input
//                       value={goal.title}
//                       onChange={(e) => updateGoal(goal.id, "title", e.target.value)}
//                       placeholder=""
//                       className={`peer block w-full py-[15px] pl-[19px] pr-[13px] text-[14px] text-[#252525] bg-white rounded-[8px] outline-none placeholder-transparent ${
//                         gErr.title
//                           ? "border border-[#DA5747]"
//                           : "border border-[#E1E6ED]"
//                       } focus:border-blue-600`}
//                     />
//                     <label className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
//                       Goal Title
//                     </label>
//                     {gErr.title ? (
//                       <div className="flex gap-[5px] items-center mt-1">
//                         <Image
//                           src="/icons/hugeicons_information-circle-redd.png"
//                           alt="info"
//                           width={15}
//                           height={15}
//                         />
//                         <span className="text-[#DA5747] text-[10px]">
//                           {gErr.title}
//                         </span>
//                       </div>
//                     ) : null}
//                   </div>

//                   <div className="flex gap-10">
//                     <div className="flex flex-col" ref={currentDropdownRef}>
//                       <div
//                         className={`flex items-center py-[15px] pl-[19px] pr-[15px] rounded-[8px] bg-white relative ${
//                           gErr.current || gErr.currentUnit
//                             ? "border border-[#DA5747]"
//                             : "border border-[#E1E6ED]"
//                         } focus:border-blue-600`}
//                       >
//                         <input
//                           type="number"
//                           min="0"
//                           step="0.1"
//                           value={goal.current}
//                           onChange={(e) =>
//                             updateGoal(goal.id, "current", e.target.value)
//                           }
//                           placeholder="Current Stat"
//                           className="w-full max-w-[90px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] placeholder:text-[#A1A1A1]"
//                         />
//                         <div className="h-[20px] border-l border-[#E1E6ED] mx-3"></div>
//                         <div
//                           className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded"
//                           onClick={() => toggleCurrentDropdown(goal.id)}
//                         >
//                           <span className="text-[12px] text-[#252525]">
//                             {goalUnit.currentUnit}
//                           </span>
//                           <IoIosArrowDown
//                             className={`transition-transform ${
//                               showCurrentDropdown === goal.id
//                                 ? "rotate-180"
//                                 : ""
//                             } text-[#A1A1A1]`}
//                           />
//                         </div>
//                         {showCurrentDropdown === goal.id && (
//                           <div className="absolute top-full right-0 mt-1 bg-white border border-[#E1E6ED] rounded-[8px] shadow-lg z-10 min-w-[100px] max-h-40 overflow-y-auto">
//                             {unitOptions.map((unit) => (
//                               <div
//                                 key={unit}
//                                 className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-[12px]"
//                                 onClick={() => {
//                                   handleUnitSelect(unit, "currentUnit", goal.id);
//                                   handleUnitSelect(unit, "targetUnit", goal.id);
//                                 }}
//                               >
//                                 {unit}
//                               </div>
//                             ))}
//                           </div>
//                         )}
//                       </div>
//                       {(gErr.current || gErr.currentUnit) && (
//                         <div className="flex gap-[5px] items-center mt-1">
//                           <Image
//                             src="/icons/hugeicons_information-circle-redd.png"
//                             alt="info"
//                             width={15}
//                             height={15}
//                           />
//                           <span className="text-[#DA5747] text-[10px]">
//                             {gErr.currentUnit || gErr.current}
//                           </span>
//                         </div>
//                       )}
//                     </div>

//                     <div className="flex flex-col" ref={targetDropdownRef}>
//                       <div
//                         className={`flex items-center py-[15px] pl-[19px] pr-[15px] rounded-[8px] bg-white relative ${
//                           gErr.target || gErr.targetUnit
//                             ? "border border-[#DA5747]"
//                             : "border border-[#E1E6ED]"
//                         } focus:border-blue-600`}
//                       >
//                         <input
//                           type="number"
//                           min="0"
//                           step="0.1"
//                           value={goal.target}
//                           onChange={(e) =>
//                             updateGoal(goal.id, "target", e.target.value)
//                           }
//                           placeholder="Target Stat"
//                           className="w-full max-w-[90px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] placeholder:text-[#A1A1A1]"
//                         />
//                         <div className="h-[20px] border-l border-[#E1E6ED] mx-3"></div>
//                         <div
//                           className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded"
//                           onClick={() => toggleTargetDropdown(goal.id)}
//                         >
//                           <span className="text-[12px] text-[#252525]">
//                             {goalUnit.targetUnit}
//                           </span>
//                           <IoIosArrowDown
//                             className={`transition-transform ${
//                               showTargetDropdown === goal.id
//                                 ? "rotate-180"
//                                 : ""
//                             } text-[#A1A1A1]`}
//                           />
//                         </div>
//                         {showTargetDropdown === goal.id && (
//                           <div className="absolute top-full right-0 mt-1 bg-white border border-[#E1E6ED] rounded-[8px] shadow-lg z-10 min-w-[100px] max-h-40 overflow-y-auto">
//                             {unitOptions.map((unit) => (
//                               <div
//                                 key={unit}
//                                 className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-[12px]"
//                                 onClick={() => {
//                                   handleUnitSelect(unit, "targetUnit", goal.id);
//                                   handleUnitSelect(unit, "currentUnit", goal.id);
//                                 }}
//                               >
//                                 {unit}
//                               </div>
//                             ))}
//                           </div>
//                         )}
//                       </div>
//                       {(gErr.target || gErr.targetUnit) && (
//                         <div className="flex gap-[5px] items-center mt-1">
//                           <Image
//                             src="/icons/hugeicons_information-circle-redd.png"
//                             alt="info"
//                             width={15}
//                             height={15}
//                           />
//                           <span className="text-[#DA5747] text-[10px]">
//                             {gErr.targetUnit || gErr.target}
//                           </span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//       <div className="px-5 py-[15px]">
//         <span
//           className="text-[#308BF9] font-semibold text-[12px] cursor-pointer"
//           onClick={addNewGoal}
//         >
//           Add Another Goal
//         </span>
//       </div>

//       <div className="flex flex-col gap-3.5">
//         <div
//           className={`flex justify-between pr-[15px] items-center py-[15px] pl-5 rounded-[8px] ${
//             errors.approach ? "border border-[#DA5747]" : "border border-[#E1E6ED]"
//           } bg-white`}
//         >
//           <input
//             value={approachInput}
//             onChange={(e) => {
//               setApproachInput(e.target.value);
//               if (approachTags.length)
//                 setErrors((prev) => ({ ...prev, approach: "" }));
//             }}
//             onKeyDown={handleKeyDown}
//             onBlur={addTag}
//             placeholder="Enter approach (Ex. Low GI, High Proteins, Calories Deficit)"
//             className="flex-1 outline-none text-[#252525] text-[14px] placeholder:text-[#9CA3AF]"
//           />
//           <IoIosArrowDown
//             className="text-[#A1A1A1] cursor-pointer"
//             onClick={addTag}
//           />
//         </div>
//         {errors.approach ? (
//           <div className="flex gap-[5px] items-center mt-1 pl-5">
//             <Image
//               src="/icons/hugeicons_information-circle-redd.png"
//               alt="info"
//               width={15}
//               height={15}
//             />
//             <span className="text-[#DA5747] text-[10px]">
//               {errors.approach}
//             </span>
//           </div>
//         ) : null}

//         <div className="flex flex-wrap gap-2">
//           {approachTags.map((tag, idx) => (
//             <div
//               key={idx}
//               className="flex items-center gap-2.5 px-5 py-2.5 rounded-[20px] border border-[#E48326] bg-[#FFF7F0]"
//             >
//               <span className="text-[#E48326] text-[12px] font-semibold">
//                 {tag}
//               </span>
//               <button onClick={() => removeTag(idx)}>
//                 <RxCross2 className="text-[#252525] cursor-pointer" />
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>

    

//       <div className="w-full border-b border-[#E1E6ED] mt-[30px]"></div>

//       <div className="py-[23px]">
//         <div className="flex gap-5 justify-end">
//           {/* <div
//             className="px-5 py-[15px] bg-white border border-[#D9D9D9] rounded-[10px] cursor-pointer"
//             onClick={handleSaveAsDraft}
//           >
//             <span className="text-[#308BF9] text-[12px] font-semibold">
//               Save as draft
//             </span>
//           </div> */}

// {/* <div
//   className={`px-5 py-[15px] border rounded-[10px] cursor-pointer flex items-center justify-center
//     ${isSavingDraft ? "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed" : "bg-white border-[#D9D9D9]"}`}
//   onClick={!isSavingDraft ? handleSaveAsDraft : undefined}
// >
//   {isSavingDraft ? (
//     <span className="text-[#308BF9] text-[12px] font-semibold flex items-center gap-2">
//       <svg className="animate-spin h-4 w-4 text-[#308BF9]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
//       </svg>
//       Saving…
//     </span>
//   ) : (
//     <span className="text-[#308BF9] text-[12px] font-semibold">
//       Save as draft
//     </span>
//   )}
// </div> */}


//           <div
//             className="px-5 py-[15px] bg-[#308BF9] rounded-[10px] cursor-pointer"
//             onClick={handleConfirmNext}
//           >
//             <span className="text-white text-[12px] font-semibold">
//               Confirm &amp; Next
//             </span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
