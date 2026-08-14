"use client";

import { useEffect, useState } from "react";
import DietPlan from "./diet-plan";
import MacrosUpdate from "./macros-update";
import DietPlanLargeSize from "./dietplanlargesize";

export default function DietAnalysis() {
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth > 1800);
    };

    checkScreenSize();

    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, []);

  return (
    <div className="flex max-2xl:flex-col gap-5 mt-[17px] mx-[5px]">
      <MacrosUpdate />

      {isLargeScreen ? <DietPlanLargeSize /> : <DietPlan />}
    </div>
  );
}

