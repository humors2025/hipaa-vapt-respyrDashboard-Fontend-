"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "sonner";
import EditDietPopup from "./pop-folder/edit-diet-popup";
import ApproveConfirmationPopup from "./pop-folder/approve-confirmation-popup";
import DiscardConfirmationPopup from "./pop-folder/discard-confirmation-popup";
import FoodEditPanel from "./pop-folder/food-edit-panel";
import FoodSearchModal from "./pop-folder/food-search-modal";
import {
  selectDietAnalysisData,
  selectDietAnalysisError,
  selectDietAnalysisLoading,
  setWeeklyJsonData,
  updateEditedDays,
} from "../store/dietAnalysisSlice";
import {
  approveDietPlanService,
  updateDietPlanFoodService,
} from "../services/authService";
import { buildAddPayload, buildDeletePayload, buildUpdatePayload } from "../lib/food-update";
import { cookieManager } from "../lib/cookies";

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

export default function DietPlan() {
  const [activeDay, setActiveDay] = useState(1);
  const [activeMeal, setActiveMeal] = useState("Breakfast");
  const [showPopup, setShowPopup] = useState(false);
  const [showApprovePopup, setShowApprovePopup] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Edit state — no toggle needed, edit controls are always visible on unapproved plans
  const [editedPlan, setEditedPlan] = useState(null);
  const [editingFoodIndex, setEditingFoodIndex] = useState(null);
  // Snapshot of the food being edited, taken when the panel opens, so live
  // edits can be reverted if the trainer hits "Cancel".
  const editSnapshotRef = useRef(null);
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingOps, setPendingOps] = useState([]);
  const [showDiscardPopup, setShowDiscardPopup] = useState(false);

  // status_value (approval) only controls mobile app visibility — trainer
  // dashboard editing must work for both status=0 (draft) and status=1 (approved).
  const canEdit = !isSuperAdmin;
  const hasEdits = pendingOps.length > 0;

  useEffect(() => {
    const token = cookieManager.get("access_token");
    const decoded = token ? decodeJwt(token) : null;
    setIsSuperAdmin(decoded?.role === "super_admin");
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = searchParams.get("profile_id");

  const dispatch = useDispatch();
  const dietAnalysisData = useSelector(selectDietAnalysisData);
  const dietAnalysisLoading = useSelector(selectDietAnalysisLoading);
  const dietAnalysisError = useSelector(selectDietAnalysisError);

  const originalDaysRef = useRef(null);

  const weeklyPlanData = dietAnalysisData?.data?.food_json || {
    days: [],
    weekly_json_data: {},
  };

  const planDays = weeklyPlanData?.days || [];

  const meals = [
    { name: "Breakfast", time: "08:00-09:00AM", key: "breakfast" },
    { name: "Lunch", time: "12:30-01:30PM", key: "lunch" },
    { name: "Snacks", time: "04:00-05:00PM", key: "snacks" },
    { name: "Dinner", time: "08:00-09:00PM", key: "dinner" },
  ];

  const days = useMemo(() => {
    return planDays.map((dayItem, index) => ({
      label: `D${index + 1}`,
      dayCode: dayItem?.day_code || `d${index + 1}`,
      dayName: dayItem?.day || "",
      data: dayItem,
    }));
  }, [planDays]);

  useEffect(() => {
    if (days.length > 0 && activeDay > days.length) {
      setActiveDay(1);
    }
  }, [days, activeDay]);

  useEffect(() => {
    setActiveDay(1);
    setActiveMeal("Breakfast");
    const statusValue = dietAnalysisData?.data?.status_value;
    setIsApproved(statusValue === 1);
    setShowPopup(false);
    setShowApprovePopup(false);
    setEditedPlan(null);
    setEditingFoodIndex(null);
    setPendingOps([]);
    setShowDiscardPopup(false);
    if (dietAnalysisData?.data?.food_json?.days) {
      originalDaysRef.current = JSON.parse(JSON.stringify(dietAnalysisData.data.food_json.days));
    }
    // Depend on plan id only — not the full object — so that our own
    // updateEditedDays dispatches don't re-trigger this reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietAnalysisData?.data?.id]);

  // Working data: edited copy if edits exist, otherwise original
  const workingDays = editedPlan?.days || planDays;
  const selectedDayData = workingDays[activeDay - 1] || null;

  useEffect(() => {
    if (editedPlan?.days) {
      dispatch(updateEditedDays(editedPlan.days));
    }
  }, [editedPlan, dispatch]);

  const mealKeyMap = {
    Breakfast: "breakfast",
    Lunch: "lunch",
    Snacks: "snacks",
    Dinner: "dinner",
  };

  const currentMealKey = mealKeyMap[activeMeal];
  const currentMealFoods = selectedDayData?.[currentMealKey]?.foods || [];

  const computeMealTotals = useCallback((foods) => {
    const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
    for (const f of foods || []) {
      totals.calories += Number(f.calories || 0);
      totals.protein_g += Number(f.protein_g || 0);
      totals.carbs_g += Number(f.carbs_g || 0);
      totals.fat_g += Number(f.fat_g || 0);
      totals.fiber_g += Number(f.fiber_g || 0);
    }
    return {
      calories: Math.round(totals.calories),
      protein_g: parseFloat(totals.protein_g.toFixed(1)),
      carbs_g: parseFloat(totals.carbs_g.toFixed(1)),
      fat_g: parseFloat(totals.fat_g.toFixed(1)),
      fiber_g: parseFloat(totals.fiber_g.toFixed(1)),
    };
  }, []);

  const currentMealTotals = useMemo(
    () => computeMealTotals(currentMealFoods),
    [currentMealFoods, computeMealTotals]
  );

  const currentDayTotals = useMemo(() => {
    if (!selectedDayData) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
    const allFoods = ["breakfast", "lunch", "snacks", "dinner"].flatMap(
      (slot) => selectedDayData[slot]?.foods || []
    );
    return computeMealTotals(allFoods);
  }, [selectedDayData, computeMealTotals]);

  const categoryIcons = {
    Meals: "/icons/hugeicons__dish-02.svg",
    Beverage: "/icons/hugeicons__tea.svg",
    "Fruits/vegetables": "/icons/hugeicons__vegetarian-food.svg",
    Snack: "/icons/hugeicons__french-fries-01.svg",
    Dessert: "/icons/hugeicons__cheese-cake-02.svg",
    Drink: "/icons/hugeicons_bubble-tea-02.svg",
  };

  const getMealIcon = (category) => {
    return categoryIcons[category] || "/icons/hugeicons__dish-02.svg";
  };

  const formatValue = (value, suffix = "") => {
    if (value === null || value === undefined || value === "") {
      return `0${suffix}`;
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      return `0${suffix}`;
    }
    return `${parseFloat(num.toFixed(2))}${suffix}`;
  };

  // ── Edit helpers — lazily create editedPlan on first edit ──

  const ensureEditedPlan = useCallback(() => {
    if (!editedPlan) {
      const deepCopy = JSON.parse(JSON.stringify(planDays));
      setEditedPlan({ days: deepCopy });
      return { days: deepCopy };
    }
    return editedPlan;
  }, [editedPlan, planDays]);

  const updateFoodInPlan = useCallback(
    (dayIndex, mealKey, foodIndex, updatedFood) => {
      const dayCode = planDays[dayIndex]?.day_code || `d${dayIndex + 1}`;
      setEditedPlan((prev) => {
        const base = prev || { days: JSON.parse(JSON.stringify(planDays)) };
        const newDays = JSON.parse(JSON.stringify(base.days));
        if (newDays[dayIndex]?.[mealKey]?.foods?.[foodIndex]) {
          newDays[dayIndex][mealKey].foods[foodIndex] = updatedFood;
        }
        return { ...base, days: newDays };
      });
      setPendingOps((ops) => [
        ...ops,
        { action: "update", dayCode, mealType: mealKey, foodIndex, food: updatedFood },
      ]);
      editSnapshotRef.current = null;
      setEditingFoodIndex(null);
    },
    [planDays]
  );

  // Live preview: reflect in-progress edits in the working plan so meal/day
  // macro totals update in real time. Does NOT record a pending op or close
  // the panel — those happen only on "Done" (updateFoodInPlan).
  const updateFoodLive = useCallback(
    (dayIndex, mealKey, foodIndex, updatedFood) => {
      setEditedPlan((prev) => {
        const base = prev || { days: JSON.parse(JSON.stringify(planDays)) };
        const newDays = JSON.parse(JSON.stringify(base.days));
        if (newDays[dayIndex]?.[mealKey]?.foods?.[foodIndex]) {
          newDays[dayIndex][mealKey].foods[foodIndex] = updatedFood;
        }
        return { ...base, days: newDays };
      });
    },
    [planDays]
  );

  // Open the editor for a food, snapshotting it first so Cancel can revert
  // any live edits.
  const startEditFood = useCallback((index, food) => {
    editSnapshotRef.current = JSON.parse(JSON.stringify(food));
    setEditingFoodIndex(index);
  }, []);

  // Cancel editing: restore the pre-edit snapshot into the working plan, then
  // close the panel.
  const cancelEditFood = useCallback((dayIndex, mealKey, foodIndex) => {
    const snapshot = editSnapshotRef.current;
    if (snapshot) {
      setEditedPlan((prev) => {
        if (!prev) return prev;
        const newDays = JSON.parse(JSON.stringify(prev.days));
        if (newDays[dayIndex]?.[mealKey]?.foods?.[foodIndex]) {
          newDays[dayIndex][mealKey].foods[foodIndex] = snapshot;
        }
        return { ...prev, days: newDays };
      });
    }
    editSnapshotRef.current = null;
    setEditingFoodIndex(null);
  }, []);

  const removeFoodFromPlan = useCallback(
    (dayIndex, mealKey, foodIndex) => {
      const dayCode = planDays[dayIndex]?.day_code || `d${dayIndex + 1}`;
      setEditedPlan((prev) => {
        const base = prev || { days: JSON.parse(JSON.stringify(planDays)) };
        const newDays = JSON.parse(JSON.stringify(base.days));
        if (newDays[dayIndex]?.[mealKey]?.foods) {
          newDays[dayIndex][mealKey].foods.splice(foodIndex, 1);
        }
        return { ...base, days: newDays };
      });
      setPendingOps((ops) => [
        ...ops,
        { action: "delete", dayCode, mealType: mealKey, foodIndex },
      ]);
      setEditingFoodIndex(null);
    },
    [planDays]
  );

  const addFoodToPlan = useCallback(
    (food) => {
      const dayIndex = activeDay - 1;
      const dayCode = planDays[dayIndex]?.day_code || `d${dayIndex + 1}`;
      setEditedPlan((prev) => {
        const base = prev || { days: JSON.parse(JSON.stringify(planDays)) };
        const newDays = JSON.parse(JSON.stringify(base.days));
        if (!newDays[dayIndex]) return base;
        if (!newDays[dayIndex][currentMealKey]) newDays[dayIndex][currentMealKey] = { foods: [] };
        if (!newDays[dayIndex][currentMealKey].foods) newDays[dayIndex][currentMealKey].foods = [];
        newDays[dayIndex][currentMealKey].foods.push(food);
        return { ...base, days: newDays };
      });
      setPendingOps((ops) => [
        ...ops,
        { action: "add", dayCode, mealType: currentMealKey, food },
      ]);
      setShowAddFoodModal(false);
    },
    [activeDay, currentMealKey, planDays]
  );

  // Discard button click — confirm via popup if there are edits, else clear immediately.
  const discardEdits = () => {
    if (hasEdits) {
      setShowDiscardPopup(true);
      return;
    }
    performDiscard();
  };

  const performDiscard = () => {
    setShowDiscardPopup(false);
    setEditedPlan(null);
    setPendingOps([]);
    setEditingFoodIndex(null);
    if (originalDaysRef.current) {
      dispatch(updateEditedDays(originalDaysRef.current));
    }
  };

  const saveAllChanges = async () => {
    if (pendingOps.length === 0) return;
    const raw = dietAnalysisData?.data || {};
    const cookieDieticianId = cookieManager.getJSON("dietician")?.dietician_id;

    // Build a normalised selectedWeek — fall back to cookie / URL where the
    // response object doesn't carry the field. Backend column is dietitian_id (no 'e').
    const selectedWeek = {
      id: raw.id,
      dietitian_id: raw.dietitian_id || raw.dietician_id || cookieDieticianId,
      profile_id: raw.profile_id || profileId,
      week_start_date: raw.week_start_date,
      week_end_date: raw.week_end_date,
    };

    if (!selectedWeek.id || !selectedWeek.profile_id || !selectedWeek.dietitian_id) {
      toast.error(`Missing identifier — id:${selectedWeek.id} dietitian:${selectedWeek.dietitian_id} profile:${selectedWeek.profile_id}`, { duration: 10000 });
      return;
    }

    setIsSaving(true);
    const succeeded = [];
    let lastWeeklyData = null;
    try {
      for (const op of pendingOps) {
        let payload;
        if (op.action === "update") {
          payload = buildUpdatePayload({ selectedWeek, dayCode: op.dayCode, mealType: op.mealType, foodIndex: op.foodIndex, food: op.food });
        } else if (op.action === "add") {
          payload = buildAddPayload({ selectedWeek, dayCode: op.dayCode, mealType: op.mealType, food: op.food });
        } else if (op.action === "delete") {
          payload = buildDeletePayload({ selectedWeek, dayCode: op.dayCode, mealType: op.mealType, foodIndex: op.foodIndex });
        } else {
          continue;
        }
        const res = await updateDietPlanFoodService(payload);
        if (!(res?.status === "success" || res?.success || res?.ok)) {
          throw new Error(res?.message || res?.error || `Save failed at op ${succeeded.length + 1}/${pendingOps.length}`);
        }
        if (res?.weekly_json_data) lastWeeklyData = res.weekly_json_data;
        succeeded.push(op);
      }

      toast.success(`Saved ${succeeded.length} change${succeeded.length === 1 ? "" : "s"}`);

      // Server is source of truth for weekly totals — overwrite our optimistic math
      if (lastWeeklyData) {
        dispatch(setWeeklyJsonData(lastWeeklyData));
      }

      // Fire-and-forget edit log for preference learning
      if (originalDaysRef.current && editedPlan?.days) {
        const dieticianId = cookieManager.getJSON("dietician")?.dietician_id;
        fetch("/api/diet-plan/log-edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: profileId,
            recommended: originalDaysRef.current,
            final: editedPlan.days,
            source: "trainer",
            meta: { plan_id: selectedWeek.id, dietician_id: dieticianId, ops_count: succeeded.length },
          }),
        }).catch(() => {});
        originalDaysRef.current = JSON.parse(JSON.stringify(editedPlan.days));
      }

      setPendingOps([]);
      setEditedPlan(null);
      setEditingFoodIndex(null);
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save changes", { duration: 8000 });
      // Drop already-succeeded ops so retry only sends what failed
      if (succeeded.length > 0) {
        setPendingOps((ops) => ops.slice(succeeded.length));
      }
    } finally {
      setIsSaving(false);
    }
  };


  const handleApproveConfirm = async () => {
    try {
      setIsApproving(true);
      const dieticianCookie = cookieManager.getJSON("dietician");
      const dieticianId = dieticianCookie?.dietician_id;
      const planId = dietAnalysisData?.data?.id;

      if (!profileId || !dieticianId || !planId) {
        toast.error("Missing required data for approval");
        return;
      }

      const response = await approveDietPlanService(
        profileId,
        dieticianId,
        planId,
        1
      );

      if (response?.status === "success") {
        setShowApprovePopup(false);
        setShowPopup(false);
        setIsApproved(true);
        toast.success("Diet plan approved successfully");
      } else {
        throw new Error(response?.message || "Failed to approve diet plan");
      }
    } catch (error) {
      console.error("Approval error:", error);
      toast.error(error.message || "Failed to approve diet plan");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <>
      <div
        id="diet-plan-container"
        className="w-full border border-[#E1E6ED] rounded-[15px] pt-[15px] pb-2.5 px-2.5 bg-white"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap px-2.5">
          <div className="flex flex-col gap-1">
            <p className="text-[#252525] py-[5px] text-[15px] xl:text-[17px] 2xl:text-[18px] font-semibold leading-normal tracking-[-0.3px]">
              Diet Plan
            </p>

            {selectedDayData?.day && (
              <p className="text-[#738298] text-[12px] xl:text-[13px] 2xl:text-[14px] font-medium leading-normal tracking-[-0.24px]">
                {days[activeDay - 1]?.dayCode?.toUpperCase()} -{" "}
                {selectedDayData.day}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Day tabs */}
            <div className="border border-[#E1E6ED] rounded-[10px] flex overflow-hidden">
              {days.map((day, index) => {
                const dayNumber = index + 1;
                const isActive = activeDay === dayNumber;

                return (
                  <div
                    key={day.dayCode}
                    onClick={() => {
                      setActiveDay(dayNumber);
                      setEditingFoodIndex(null);
                    }}
                    className={`px-4 py-2.5 cursor-pointer ${
                      isActive ? "bg-[#308BF9]" : "bg-white"
                    }`}
                  >
                    <p
                      className={`text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-[110%] tracking-[-0.24px] ${
                        isActive ? "text-white" : "text-[#A1A1A1]"
                      }`}
                    >
                      {day.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="flex gap-[3px] mt-[15px]">
            <div className="flex flex-col gap-[15px] px-[15px] pt-[15px] pb-[54px] rounded-[15px] border-4 border-[#F5F7FA] min-w-[180px] xl:min-w-[200px] 2xl:min-w-[220px]">
              {meals.map((meal, index) => {
                const isActive = activeMeal === meal.name;

                return (
                  <div
                    key={meal.name}
                    onClick={() => {
                      setActiveMeal(meal.name);
                      setEditingFoodIndex(null);
                    }}
                    className={`flex flex-col gap-2.5 py-2.5 pl-[15px] pr-2.5 w-full cursor-pointer ${
                      isActive ? "bg-[#308BF9] rounded-[10px]" : ""
                    } ${
                      !isActive && index !== 0
                        ? "border-t border-[#E1E6ED]"
                        : ""
                    }`}
                  >
                    <p
                      className={`text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-[110%] tracking-[-0.48px] ${
                        isActive ? "text-white" : "text-[#252525]"
                      }`}
                    >
                      {meal.name}
                    </p>

                    <p
                      className={`text-[10px] xl:text-[11px] 2xl:text-[12px] font-normal leading-normal tracking-[-0.2px] ${
                        isActive ? "text-white" : "text-[#252525]"
                      }`}
                    >
                      {meal.time}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="pt-5 pb-[43px] pl-[15px] pr-2.5 border-4 border-[#F5F7FA] rounded-[15px] flex-1 h-[360px] xl:h-[400px] 2xl:h-[440px] overflow-y-auto scroll-hide">
              {dietAnalysisLoading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[#738298] text-[13px] xl:text-[14px] 2xl:text-[15px] font-medium">
                    Loading diet plan...
                  </p>
                </div>
              ) : dietAnalysisError ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[#E76F51] text-[13px] xl:text-[14px] 2xl:text-[15px] font-medium">
                    {dietAnalysisError}
                  </p>
                </div>
              ) : currentMealFoods.length > 0 ? (
                <div className="flex flex-col gap-10">
                  {/* Meal totals bar */}
                  <div className="flex items-center gap-2 flex-wrap px-2 py-2 bg-[#F5F7FA] rounded-[8px]">
                    <span className="text-[11px] xl:text-[12px] font-bold text-[#252525]">
                      {currentMealTotals.calories} kcal
                    </span>
                    <span className="text-[10px] text-[#A1A1A1]">|</span>
                    <span className="text-[10px] xl:text-[11px] font-semibold text-[#2A9D8F]">
                      P {currentMealTotals.protein_g}g
                    </span>
                    <span className="text-[10px] xl:text-[11px] font-semibold text-[#F4A261]">
                      C {currentMealTotals.carbs_g}g
                    </span>
                    <span className="text-[10px] xl:text-[11px] font-semibold text-[#3A86FF]">
                      F {currentMealTotals.fat_g}g
                    </span>
                    <span className="text-[10px] xl:text-[11px] font-semibold text-[#E76F51]">
                      Fb {currentMealTotals.fiber_g}g
                    </span>
                  </div>
                  {currentMealFoods.map((food, index) => (
                    <div
                      key={`${currentMealKey}-${index}`}
                      className="flex gap-[5px]"
                    >
                      <div className="flex my-[3px] items-start shrink-0">
                        <Image
                          src={getMealIcon(food.category)}
                          alt="food-icon"
                          width={24}
                          height={24}
                          className="xl:w-[28px] xl:h-[28px] 2xl:w-[30px] 2xl:h-[30px]"
                        />

                        <p className="px-[9px] pt-[3px] pb-0.5 text-[#252525] text-[15px] xl:text-[16px] 2xl:text-[18px] font-bold leading-[126%] tracking-[-0.3px]">
                          {index + 1}
                        </p>
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className={`flex flex-col gap-1 flex-1 ${canEdit && editingFoodIndex !== index ? "cursor-pointer rounded-[6px] px-1.5 py-1 -mx-1.5 -my-1 hover:bg-[#F5F7FA] transition-colors" : ""}`}
                              onClick={() => {
                                if (canEdit && editingFoodIndex !== index) startEditFood(index, food);
                              }}
                            >
                              <p className="text-[#252525] text-[12px] xl:text-[14px] 2xl:text-[15px] font-semibold leading-[126%] tracking-[-0.24px]">
                                {food.food_name}
                              </p>

                              <div className="flex flex-wrap items-center gap-[5px]">
                                <p className="text-[#252525] text-[10px] xl:text-[11px] 2xl:text-[12px] font-normal leading-normal tracking-[-0.2px]">
                                  {formatValue(food.calories, " kcal")}
                                </p>

                                {food.portion_with_metric && (
                                  <p className="text-[#252525] text-[10px] xl:text-[11px] 2xl:text-[12px] font-normal leading-normal tracking-[-0.2px]">
                                    {food.portion_with_metric}
                                  </p>
                                )}

                                <Image
                                  src="/icons/hugeicons_information-circle0.svg"
                                  alt="info-icon"
                                  width={12}
                                  height={12}
                                  className="cursor-pointer xl:w-[14px] xl:h-[14px] 2xl:w-[16px] 2xl:h-[16px]"
                                />

                                {food.macro_source && food.macro_source !== "library" && (
                                  <span className="text-[9px] text-[#A1A1A1] bg-[#F5F7FA] px-1.5 py-0.5 rounded">
                                    {food.macro_source === "openai" || food.macro_source === "ai_lookup" ? "AI" : food.macro_source === "manual" ? "Manual" : ""}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Edit/Remove — always visible when plan is editable */}
                            {canEdit && editingFoodIndex !== index && (
                              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                <button
                                  onClick={() => startEditFood(index, food)}
                                  className="p-1.5 rounded-[6px] hover:bg-[#EEF4FE] cursor-pointer transition-colors"
                                  title="Edit food"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#308BF9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => removeFoodFromPlan(activeDay - 1, currentMealKey, index)}
                                  className="p-1.5 rounded-[6px] hover:bg-[#E76F511A] cursor-pointer transition-colors"
                                  title="Remove food"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E76F51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Inline edit panel */}
                          {canEdit && editingFoodIndex === index ? (
                            <FoodEditPanel
                              food={food}
                              onChange={(updatedFood) =>
                                updateFoodLive(activeDay - 1, currentMealKey, index, updatedFood)
                              }
                              onSave={(updatedFood) =>
                                updateFoodInPlan(activeDay - 1, currentMealKey, index, updatedFood)
                              }
                              onRemove={() =>
                                removeFoodFromPlan(activeDay - 1, currentMealKey, index)
                              }
                              onCancel={() =>
                                cancelEditFood(activeDay - 1, currentMealKey, index)
                              }
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              <div className="px-2.5 py-[5px] rounded-[5px] bg-[#2A9D8F1A]">
                                <p className="text-[#2A9D8F] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]">
                                  {formatValue(food.carbs_g, "g")} Carbs
                                </p>
                              </div>

                              <div className="px-2.5 py-[5px] rounded-[5px] bg-[#F4A2611A]">
                                <p className="text-[#F4A261] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]">
                                  {formatValue(food.protein_g, "g")} Protein
                                </p>
                              </div>

                              <div className="px-2.5 py-[5px] rounded-[5px] bg-[#3A86FF1A]">
                                <p className="text-[#3A86FF] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]">
                                  {formatValue(food.fat_g, "g")} Fat
                                </p>
                              </div>

                              <div className="px-2.5 py-[5px] rounded-[5px] bg-[#E76F511A]">
                                <p className="text-[#E76F51] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]">
                                  {formatValue(food.fiber_g, "g")} Fiber
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}


                    {/* Save / Discard bar — always visible when there are pending edits */}
                  {hasEdits && (
                    <div className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-[10px] border border-[#308BF9] bg-[#EEF4FE]">
                      <p className="text-[12px] xl:text-[13px] font-medium text-[#252525] flex-1">
                        {pendingOps.length} unsaved change{pendingOps.length === 1 ? "" : "s"}
                      </p>
                      <button
                        onClick={discardEdits}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-[8px] border border-[#E1E6ED] bg-white text-[#535359] text-[12px] xl:text-[13px] font-semibold cursor-pointer hover:bg-[#F5F7FA] disabled:opacity-50"
                      >
                        Discard
                      </button>
                      <button
                        onClick={saveAllChanges}
                        disabled={isSaving}
                        className="px-5 py-2 rounded-[8px] bg-[#308BF9] text-white text-[12px] xl:text-[13px] font-semibold cursor-pointer hover:bg-[#2678D9] disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  )}



                  {/* Add Food button — always visible when editable */}
                  {canEdit && (
                    <button
                      onClick={() => setShowAddFoodModal(true)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-dashed border-[#308BF9] text-[#308BF9] hover:bg-[#EEF4FE] cursor-pointer transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span className="text-[12px] xl:text-[13px] font-semibold">
                        Add food to {activeMeal.toLowerCase()}
                      </span>
                    </button>
                  )}

                
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <p className="text-[#738298] text-[13px] xl:text-[14px] 2xl:text-[15px] font-medium">
                    No food data available
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => setShowAddFoodModal(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#308BF9] text-white text-[12px] font-semibold cursor-pointer hover:bg-[#2678D9]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add food
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isSuperAdmin && (
            <div className="flex gap-2.5 justify-end mt-2">
              {!isApproved && (
                <p className="py-[11px] text-[#535359] text-[10px] xl:text-[11px] 2xl:text-[12px] font-normal leading-normal tracking-[-0.2px]">
                  Auto-approved if not reviewed within 24 hours
                </p>
              )}

              <div className="flex gap-2.5">
                <div
                  onClick={() => {
                    if (!isApproved && !isApproving) {
                      setShowApprovePopup(true);
                    }
                  }}
                  aria-disabled={isApproved || isApproving}
                  className={[
                    "flex items-center gap-[5px] justify-center px-[11px] py-1 rounded-[4px]",
                    isApproved || isApproving
                      ? "bg-[#E1E6ED] cursor-not-allowed"
                      : "bg-[#308BF9] cursor-pointer",
                  ].join(" ")}
                >
                  <Image
                    src="/icons/hugeicons_tick-0236.svg"
                    alt="approve-icon"
                    width={20}
                    height={20}
                    className={`xl:w-[22px] xl:h-[22px] 2xl:w-[24px] 2xl:h-[24px] ${isApproved || isApproving ? "opacity-50 grayscale" : ""}`}
                  />

                  <span
                    className={[
                      "text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-normal tracking-[-0.24px]",
                      isApproved || isApproving ? "text-[#738298]" : "text-white",
                    ].join(" ")}
                  >
                    {isApproved ? "Approved" : isApproving ? "Approving..." : "Approve"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPopup && !isApproved && (
        <EditDietPopup closePopup={() => setShowPopup(false)} />
      )}

      {showApprovePopup && !isApproved && (
        <ApproveConfirmationPopup
          onClose={() => {
            if (!isApproving) {
              setShowApprovePopup(false);
            }
          }}
          onConfirm={handleApproveConfirm}
          isLoading={isApproving}
        />
      )}

      {showAddFoodModal && canEdit && (
        <FoodSearchModal
          mealSlot={activeMeal}
          onAdd={addFoodToPlan}
          onClose={() => setShowAddFoodModal(false)}
        />
      )}

      {showDiscardPopup && (
        <DiscardConfirmationPopup
          count={pendingOps.length}
          onClose={() => setShowDiscardPopup(false)}
          onConfirm={performDiscard}
        />
      )}
    </>
  );
}
