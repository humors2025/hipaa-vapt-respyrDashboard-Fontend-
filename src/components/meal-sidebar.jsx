"use client";
import React, { useEffect, useMemo } from "react";

export default function MealSidebar({
  activeFilter,
  onFilterChange,
  weeklyAnalysisData
}) {
  const data = Array.isArray(weeklyAnalysisData) ? weeklyAnalysisData : [];

  const hasFood = (x) =>
    x && typeof x === "object" && typeof x.food === "string" && x.food.trim().length > 0;

  const getScore = (x) => {
    const s = Number(x?.metabolic_compatibility_score);
    return Number.isFinite(s) ? s : null;
  };

  // ✅ Buckets
  const lowFoods = useMemo(
    () => data.filter((x) => hasFood(x) && getScore(x) !== null && getScore(x) <= 60),
    [data]
  );

  const moderateFoods = useMemo(
    () => data.filter((x) => hasFood(x) && getScore(x) !== null && getScore(x) >= 61 && getScore(x) <= 79),
    [data]
  );

  const highFoods = useMemo(
    () => data.filter((x) => hasFood(x) && getScore(x) !== null && getScore(x) >= 80),
    [data]
  );

  // ✅ Sidebar data (memoized)
  const mealSidebarData = useMemo(() => ([
    {
      id: 1,
      scoreRange: "0-60",
      description: "Low Metabolic Compatibility Score",
      count: `${lowFoods.length} food items`,
      countNumber: lowFoods.length,
      borderColor: "border-l-[#E48326]",
      countBg: "bg-white",
      gapClass: "gap-[30px]",
      filter: "low",
    },
    {
      id: 2,
      scoreRange: "61-79",
      description: "Moderate Metabolic Compatibility Score",
      count: `${moderateFoods.length} food items`,
      countNumber: moderateFoods.length,
      borderColor: "border-l-[#FFBF2D]",
      countBg: "bg-[#F5F7FA]",
      gapClass: "gap-[30px]",
      filter: "moderate",
    },
    {
      id: 3,
      scoreRange: "80-100",
      description: "High Metabolic Compatibility Score",
      count: `${highFoods.length} food items`,
      countNumber: highFoods.length,
      borderColor: "border-l-[#3FAF58]",
      countBg: "bg-[#F5F7FA]",
      gapClass: "gap-[30px]",
      filter: "high",
    },
  ]), [lowFoods.length, moderateFoods.length, highFoods.length]);

  // ✅ Handle click
  const handleItemClick = (item) => {
    if (item.countNumber > 0 && onFilterChange) {
      onFilterChange(item.filter);
    }
  };

  // ✅ AUTO-SELECT LOGIC (SAFE)
  useEffect(() => {
    if (!onFilterChange) return;

    const itemsWithOneCount = mealSidebarData.filter(
      (item) => item.countNumber === 1
    );

    if (itemsWithOneCount.length === 1) {
      onFilterChange(itemsWithOneCount[0].filter);
    }
  }, [mealSidebarData, onFilterChange]);

  return (
    <div className="p-[15px] bg-white rounded-[15px] shadow-lg">
      <div className="flex flex-col gap-[15px]">
        {mealSidebarData.map((item) => {
          const isDisabled = item.countNumber === 0;
          const isActive = activeFilter === item.filter && !isDisabled;

          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`flex flex-col ${item.gapClass}
                pl-[15px] pt-[15px] pr-[10px] pb-[10px]
                rounded-[10px] border-2
                ${item.borderColor} border-t-0 border-b-0 border-r-0
                ${isActive ? "bg-[#F0F5FD]" : "bg-white"}
                ${isDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer transition-colors duration-200 hover:bg-[#F0F5FD]"
                }`}
            >
              <div className="flex flex-col gap-2.5">
                <span
                  className={`text-[12px] font-semibold
                    ${isDisabled
                      ? "text-[#9CA3AF]"
                      : isActive
                      ? "text-[#308BF9]"
                      : "text-[#252525]"
                    }`}
                >
                  {item.scoreRange}
                </span>

                {item.description && (
                  <span
                    className={`text-[10px]
                      ${isDisabled
                        ? "text-[#9CA3AF]"
                        : isActive
                        ? "text-[#308BF9]"
                        : "text-[#252525]"
                      }`}
                  >
                    {item.description}
                  </span>
                )}
              </div>

              <div className={`w-fit min-w-[82px] px-2 py-1.5 rounded-[20px] ${item.countBg}`}>
                <p className={`text-[10px] ${isDisabled ? "text-[#9CA3AF]" : "text-[#535359]"}`}>
                  {item.count}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

