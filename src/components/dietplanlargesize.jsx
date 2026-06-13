"use client";

import Image from "next/image";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import {
  selectDietAnalysisData,
  selectDietAnalysisError,
  selectDietAnalysisLoading,
} from "../store/dietAnalysisSlice";
import ApproveConfirmationPopup from "./pop-folder/approve-confirmation-popup";
import { approveDietPlanService } from "../services/authService";
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

  useEffect(() => {
    const token = cookieManager.get("access_token");
    const decoded = token ? decodeJwt(token) : null;
    setIsSuperAdmin(decoded?.role === "super_admin");
  }, []);

  const searchParams = useSearchParams();
  const profileId = searchParams.get("profile_id");

  const dietAnalysisData = useSelector(selectDietAnalysisData);
  const dietAnalysisLoading = useSelector(selectDietAnalysisLoading);
  const dietAnalysisError = useSelector(selectDietAnalysisError);

  const weeklyPlanData = dietAnalysisData?.data?.food_json || {
    days: [],
    weekly_json_data: {},
  };

  const days = useMemo(() => {
    return weeklyPlanData?.days || [];
  }, [weeklyPlanData]);

  // Reset activeDayIndex when days change or diet data reloads
  useEffect(() => {
    setActiveDayIndex(0);

    const statusValue = dietAnalysisData?.data?.status_value;

    // Handles both number 1 and string "1"
    setIsApproved(Number(statusValue) === 1);

    setShowApprovePopup(false);
  }, [dietAnalysisData]);

  const selectedDay = useMemo(() => {
    return days[activeDayIndex] || null;
  }, [days, activeDayIndex]);

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
        ) : days.length === 0 ? (
          <EmptyState text="No food data available" />
        ) : (
          <>
            {/* Day Header - Clickable day selector */}
            <div className="px-2.5 pb-4">
              <div className="grid grid-cols-7 rounded-[10px] border border-[#E1E6ED] overflow-hidden">
                {days.map((day, index) => {
                  const isActiveDay = activeDayIndex === index;

                  return (
                    <button
                      key={day.day_code || index}
                      type="button"
                      onClick={() => setActiveDayIndex(index)}
                      className={[
                        "min-w-0 px-2 py-2.5 text-center",
                        "text-[12px] font-semibold leading-normal",
                        "transition-all duration-200 cursor-pointer",
                        index !== days.length - 1
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
                                "divide-y divide-[#E1E6ED]",
                                index !== MEAL_TYPES.length - 1
                                  ? "border-r border-[#E1E6ED]"
                                  : "",
                              ].join(" ")}
                            >
                              {foods.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">
                                  No items
                                </p>
                              ) : (
                                foods.map((food, foodIndex) => (
                                  <div
                                    key={`${food.food_name || "food"}-${foodIndex}`}
                                    className="py-3 first:pt-0 last:pb-0 min-w-0"
                                  >
                                    <FoodCard food={food} />
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
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
                {isApproved ? "Approved" : "Approve"}
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

function FoodCard({ food }) {
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
      <h3 className="text-[#252525] text-[11px] xl:text-[12px] font-semibold leading-[126%] tracking-[-0.22px] break-words">
        {food.food_name || "Unnamed food"}
      </h3>

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