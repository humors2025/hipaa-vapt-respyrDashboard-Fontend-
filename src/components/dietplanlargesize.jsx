"use client";

import Image from "next/image";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import {
  selectDietAnalysisData,
  selectDietAnalysisError,
  selectDietAnalysisLoading,
  setWeeklyJsonData,
  updateEditedDays,
} from "../store/dietAnalysisSlice";
import ApproveConfirmationPopup from "./pop-folder/approve-confirmation-popup";
import DiscardConfirmationPopup from "./pop-folder/discard-confirmation-popup";
import FoodEditPanel from "./pop-folder/food-edit-panel";
import FoodSearchModal from "./pop-folder/food-search-modal";
import {
  approveDietPlanService,
  updateDietPlanFoodService,
} from "../services/authService";
import {
  buildAddPayload,
  buildDeletePayload,
  buildUpdatePayload,
} from "../lib/food-update";
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

const MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "snacks", label: "Evening Snacks" },
  { key: "dinner", label: "Dinner" },
];

export default function DietPlanLargeSize() {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showApprovePopup, setShowApprovePopup] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Edit state — edit controls are always visible on editable plans.
  const [editedPlan, setEditedPlan] = useState(null);
  // Which food is being edited, keyed as `${mealKey}:${foodIndex}` because the
  // large view shows all four meals at once.
  const [editingKey, setEditingKey] = useState(null);
  // Snapshot of the food being edited, taken when the panel opens, so live
  // edits can be reverted if the trainer hits "Cancel".
  const editSnapshotRef = useRef(null);
  // Which meal column the "Add food" modal is open for (mealKey or null).
  const [addFoodMealKey, setAddFoodMealKey] = useState(null);
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

  const planDays = useMemo(() => {
    return weeklyPlanData?.days || [];
  }, [weeklyPlanData]);

  // Reset state when the diet plan reloads. Depend on plan id only — not the
  // full object — so our own updateEditedDays dispatches don't re-trigger this.
  useEffect(() => {
    setActiveDayIndex(0);
    const statusValue = dietAnalysisData?.data?.status_value;
    // Handles both number 1 and string "1"
    setIsApproved(Number(statusValue) === 1);
    setShowApprovePopup(false);
    setEditedPlan(null);
    setEditingKey(null);
    setAddFoodMealKey(null);
    setPendingOps([]);
    setShowDiscardPopup(false);
    if (dietAnalysisData?.data?.food_json?.days) {
      originalDaysRef.current = JSON.parse(
        JSON.stringify(dietAnalysisData.data.food_json.days)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietAnalysisData?.data?.id]);

  // Working data: edited copy if edits exist, otherwise original.
  const workingDays = editedPlan?.days || planDays;

  const selectedDay = useMemo(() => {
    return workingDays[activeDayIndex] || null;
  }, [workingDays, activeDayIndex]);

  // Live preview: reflect in-progress edits so day macro totals update in real
  // time.
  useEffect(() => {
    if (editedPlan?.days) {
      dispatch(updateEditedDays(editedPlan.days));
    }
  }, [editedPlan, dispatch]);

  // ── Edit helpers — mirror diet-plan.jsx, lazily creating editedPlan ──

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
      setEditingKey(null);
    },
    [planDays]
  );

  // Live preview: reflect in-progress edits without recording a pending op or
  // closing the panel — those happen only on "Done" (updateFoodInPlan).
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
  const startEditFood = useCallback((mealKey, foodIndex, food) => {
    editSnapshotRef.current = JSON.parse(JSON.stringify(food));
    setEditingKey(`${mealKey}:${foodIndex}`);
  }, []);

  // Cancel editing: restore the pre-edit snapshot, then close the panel.
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
    setEditingKey(null);
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
      setEditingKey(null);
    },
    [planDays]
  );

  const addFoodToPlan = useCallback(
    (food) => {
      const dayIndex = activeDayIndex;
      const mealKey = addFoodMealKey;
      if (!mealKey) return;
      const dayCode = planDays[dayIndex]?.day_code || `d${dayIndex + 1}`;
      setEditedPlan((prev) => {
        const base = prev || { days: JSON.parse(JSON.stringify(planDays)) };
        const newDays = JSON.parse(JSON.stringify(base.days));
        if (!newDays[dayIndex]) return base;
        if (!newDays[dayIndex][mealKey]) newDays[dayIndex][mealKey] = { foods: [] };
        if (!newDays[dayIndex][mealKey].foods) newDays[dayIndex][mealKey].foods = [];
        newDays[dayIndex][mealKey].foods.push(food);
        return { ...base, days: newDays };
      });
      setPendingOps((ops) => [
        ...ops,
        { action: "add", dayCode, mealType: mealKey, food },
      ]);
      setAddFoodMealKey(null);
    },
    [activeDayIndex, addFoodMealKey, planDays]
  );

  // Discard button click — confirm via popup if there are edits, else clear.
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
    setEditingKey(null);
    if (originalDaysRef.current) {
      dispatch(updateEditedDays(originalDaysRef.current));
    }
  };

  const saveAllChanges = async () => {
    if (pendingOps.length === 0) return;
    const raw = dietAnalysisData?.data || {};
    const cookieDieticianId = cookieManager.getJSON("dietician")?.dietician_id;

    // Build a normalised selectedWeek — fall back to cookie / URL where the
    // response object doesn't carry the field. Backend column is dietitian_id.
    const selectedWeek = {
      id: raw.id,
      dietitian_id: raw.dietitian_id || raw.dietician_id || cookieDieticianId,
      profile_id: raw.profile_id || profileId,
      week_start_date: raw.week_start_date,
      week_end_date: raw.week_end_date,
    };

    if (!selectedWeek.id || !selectedWeek.profile_id || !selectedWeek.dietitian_id) {
      toast.error(
        `Missing identifier — id:${selectedWeek.id} dietitian:${selectedWeek.dietitian_id} profile:${selectedWeek.profile_id}`,
        { duration: 10000 }
      );
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

      // Server is source of truth for weekly totals — overwrite optimistic math
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
      setEditingKey(null);
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

      const APPROVED_STATUS_VALUE = 1;

      const response = await approveDietPlanService(
        profileId,
        dieticianId,
        planId,
        APPROVED_STATUS_VALUE
      );

      if (response?.status === "success" || response?.status === true) {
        setShowApprovePopup(false);

        // This re-renders DietPlanLargeSize only
        setIsApproved(true);

        toast.success("Diet plan approved successfully");
      } else {
        throw new Error(response?.message || "Failed to approve diet plan");
      }
    } catch (error) {
      console.error("Approval error:", error);
      toast.error(error?.message || "Failed to approve diet plan");
    } finally {
      setIsApproving(false);
    }
  };

  const addFoodMealLabel =
    MEAL_TYPES.find((m) => m.key === addFoodMealKey)?.label || "meal";

  return (
    <div className="w-full min-w-0 flex-1">
      <div className="w-full min-w-0 pt-[15px] px-3 pb-[15px] rounded-[15px] border border-[#E1E6ED] bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap px-2.5 py-4">
          <div className="flex flex-col gap-1 shrink-0">
            <h2 className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px]">
              Diet Plan
            </h2>

            {dietAnalysisData?.data?.week_range && (
              <p className="text-[#738298] text-[12px] font-medium leading-normal tracking-[-0.24px]">
                {dietAnalysisData.data.week_range}
              </p>
            )}
          </div>
        </div>

        {dietAnalysisLoading ? (
          <EmptyState text="Loading diet plan..." />
        ) : dietAnalysisError ? (
          <EmptyState text={dietAnalysisError} error />
        ) : workingDays.length === 0 ? (
          <EmptyState text="No food data available" />
        ) : (
          <>
            {/* Day Header - Clickable day selector */}
            <div className="px-2.5 pb-4">
              <div className="grid grid-cols-7 rounded-[10px] border border-[#E1E6ED] overflow-hidden">
                {workingDays.map((day, index) => {
                  const isActiveDay = activeDayIndex === index;

                  return (
                    <button
                      key={day.day_code || index}
                      type="button"
                      onClick={() => {
                        setActiveDayIndex(index);
                        setEditingKey(null);
                      }}
                      className={[
                        "min-w-0 px-2 py-2.5 text-center",
                        "text-[12px] font-semibold leading-normal",
                        "transition-all duration-200 cursor-pointer",
                        index !== workingDays.length - 1
                          ? "border-r border-[#E1E6ED]"
                          : "",
                        isActiveDay
                          ? "bg-[#308BF9] text-white"
                          : "bg-white text-[#738298] hover:bg-[#F8FAFC]",
                      ].join(" ")}
                    >
                      Day {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horizontal Meals Table */}
            <div className="w-full min-w-0 overflow-x-auto">
              {selectedDay && (
                <div className="min-w-0 px-2 xl:px-3">
                  {/* Day name above the table */}
                  <p className="text-[#252525] text-[13px] font-semibold mb-3">
                    {selectedDay?.day || `Day ${activeDayIndex + 1}`}
                  </p>

                  {/* Horizontal scrollable table */}
                  <div className="w-full overflow-x-auto scroll-hide">
                    <div className="min-w-[600px]">
                      {/* Table Header - Meal type labels */}
                      <div className="grid grid-cols-4 rounded-t-[10px] border border-[#E1E6ED] overflow-hidden bg-[#F8FAFC]">
                        {MEAL_TYPES.map((mealType, index) => (
                          <div
                            key={mealType.key}
                            className={[
                              "px-3 py-3 text-center",
                              "text-[#252525] text-[11px] xl:text-[12px] font-semibold leading-normal",
                              index !== MEAL_TYPES.length - 1
                                ? "border-r border-[#E1E6ED]"
                                : "",
                            ].join(" ")}
                          >
                            {mealType.label}
                          </div>
                        ))}
                      </div>

                      {/* Table Body - Food items */}
                      <div className="grid grid-cols-4 border-x border-b border-[#E1E6ED] rounded-b-[10px] overflow-hidden">
                        {MEAL_TYPES.map((mealType, index) => {
                          const foods = selectedDay?.[mealType.key]?.foods || [];

                          return (
                            <div
                              key={mealType.key}
                              className={[
                                "min-w-0 px-3 py-4 min-h-[220px]",
                                index !== MEAL_TYPES.length - 1
                                  ? "border-r border-[#E1E6ED]"
                                  : "",
                              ].join(" ")}
                            >
                              <div className="divide-y divide-[#E1E6ED]">
                                {foods.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">
                                    No items
                                  </p>
                                ) : (
                                  foods.map((food, foodIndex) => {
                                    const isEditing =
                                      editingKey === `${mealType.key}:${foodIndex}`;
                                    return (
                                      <div
                                        key={`${food.food_name || "food"}-${foodIndex}`}
                                        className="py-3 first:pt-0 last:pb-0 min-w-0"
                                      >
                                        {canEdit && isEditing ? (
                                          <FoodEditPanel
                                            food={food}
                                            onChange={(updatedFood) =>
                                              updateFoodLive(activeDayIndex, mealType.key, foodIndex, updatedFood)
                                            }
                                            onSave={(updatedFood) =>
                                              updateFoodInPlan(activeDayIndex, mealType.key, foodIndex, updatedFood)
                                            }
                                            onRemove={() =>
                                              removeFoodFromPlan(activeDayIndex, mealType.key, foodIndex)
                                            }
                                            onCancel={() =>
                                              cancelEditFood(activeDayIndex, mealType.key, foodIndex)
                                            }
                                          />
                                        ) : (
                                          <FoodCard
                                            food={food}
                                            canEdit={canEdit}
                                            onEdit={() =>
                                              startEditFood(mealType.key, foodIndex, food)
                                            }
                                            onRemove={() =>
                                              removeFoodFromPlan(activeDayIndex, mealType.key, foodIndex)
                                            }
                                          />
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Add food button — always visible when editable */}
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => setAddFoodMealKey(mealType.key)}
                                  className="mt-3 flex items-center justify-center gap-1.5 w-full px-2 py-2 rounded-[8px] border border-dashed border-[#308BF9] text-[#308BF9] hover:bg-[#EEF4FE] cursor-pointer transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                  <span className="text-[10px] xl:text-[11px] font-semibold">
                                    Add food
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Save / Discard bar — visible when there are pending edits */}
                  {hasEdits && (
                    <div className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-[10px] border border-[#308BF9] bg-[#EEF4FE]">
                      <p className="text-[12px] xl:text-[13px] font-medium text-[#252525] flex-1">
                        {pendingOps.length} unsaved change{pendingOps.length === 1 ? "" : "s"}
                      </p>
                      <button
                        type="button"
                        onClick={discardEdits}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-[8px] border border-[#E1E6ED] bg-white text-[#535359] text-[12px] xl:text-[13px] font-semibold cursor-pointer hover:bg-[#F5F7FA] disabled:opacity-50"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={saveAllChanges}
                        disabled={isSaving}
                        className="px-5 py-2 rounded-[8px] bg-[#308BF9] text-white text-[12px] xl:text-[13px] font-semibold cursor-pointer hover:bg-[#2678D9] disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="flex gap-2.5 justify-end mt-2">
          {!isApproved && (
            <p className="py-[11px] text-[#535359] text-[10px] font-normal leading-normal tracking-[-0.2px]">
              Auto-approved if not reviewed within 24 hours
            </p>
          )}

          <div className="flex gap-2.5">
            {/* Approve / Approved Button */}
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
                className={isApproved ? "opacity-50 grayscale" : ""}
              />

              <span
                className={[
                  "text-[12px] font-semibold leading-normal tracking-[-0.24px]",
                  isApproved ? "text-[#738298]" : "text-white",
                ].join(" ")}
              >
                {isApproved ? "Approved" : isApproving ? "Approving..." : "Approve"}
              </span>
            </div>
          </div>
        </div>
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

      {addFoodMealKey && canEdit && (
        <FoodSearchModal
          mealSlot={addFoodMealLabel}
          onAdd={addFoodToPlan}
          onClose={() => setAddFoodMealKey(null)}
        />
      )}

      {showDiscardPopup && (
        <DiscardConfirmationPopup
          count={pendingOps.length}
          onClose={() => setShowDiscardPopup(false)}
          onConfirm={performDiscard}
        />
      )}
    </div>
  );
}

function EmptyState({ text, error = false }) {
  return (
    <div className="h-[300px] flex items-center justify-center">
      <p
        className={[
          "text-[13px] font-medium",
          error ? "text-[#E76F51]" : "text-[#738298]",
        ].join(" ")}
      >
        {text}
      </p>
    </div>
  );
}

function FoodCard({ food, canEdit = false, onEdit, onRemove }) {
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

  const macros = [
    {
      label: `Carbs: ${formatValue(food.carbs_g, "g")}`,
      classes: "bg-[#2A9D8F1A] text-[#2A9D8F]",
    },
    {
      label: `Fat: ${formatValue(food.fat_g, "g")}`,
      classes: "bg-[#3A86FF1A] text-[#3A86FF]",
    },
    {
      label: `Fiber: ${formatValue(food.fiber_g, "g")}`,
      classes: "bg-[#F4A2611A] text-[#F4A261]",
    },
    {
      label: `Protein: ${formatValue(food.protein_g, "g")}`,
      classes: "bg-[#E76F511A] text-[#E76F51]",
    },
  ];

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-1">
        <h3
          className={[
            "flex-1 text-[#252525] text-[11px] xl:text-[12px] font-semibold leading-[126%] tracking-[-0.22px] break-words",
            canEdit
              ? "cursor-pointer rounded-[4px] px-1 py-0.5 -mx-1 -my-0.5 hover:bg-[#F5F7FA] transition-colors"
              : "",
          ].join(" ")}
          onClick={canEdit ? onEdit : undefined}
        >
          {food.food_name || "Unnamed food"}
        </h3>

        {/* Edit / Remove — always visible when editable */}
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="p-1 rounded-[5px] hover:bg-[#EEF4FE] cursor-pointer transition-colors"
              title="Edit food"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#308BF9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded-[5px] hover:bg-[#E76F511A] cursor-pointer transition-colors"
              title="Remove food"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E76F51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {(food.portion_with_metric || food.calories !== undefined) && (
        <p className="text-[#252525] text-[10px] mt-1 leading-normal tracking-[-0.2px] break-words">
          {food.portion_with_metric && (
            <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
              {food.portion_with_metric}
            </span>
          )}

          {food.portion_with_metric && food.calories !== undefined && (
            <span className="mx-1">•</span>
          )}

          {food.calories !== undefined && (
            <span className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
              {food.calories} Kcal
            </span>
          )}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {macros.map((macro, index) => (
          <span
            key={index}
            className={[
              "inline-flex items-center justify-center rounded-[5px]",
              "px-1.5 py-[4px]",
              "text-[9px] xl:text-[10px] font-semibold leading-[110%]",
              "whitespace-nowrap",
              macro.classes,
            ].join(" ")}
            title={macro.label}
          >
            {macro.label}
          </span>
        ))}
      </div>
    </div>
  );
}
