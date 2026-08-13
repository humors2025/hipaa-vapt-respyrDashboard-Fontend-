

"use client";

import Image from "next/image";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { IoIosArrowForward } from "react-icons/io";
import {
  selectDietAnalysisData,
  selectDietAnalysisLoading,
  selectDietAnalysisError,
} from "../store/dietAnalysisSlice";
import {
  selectMacroSummaryData,
  selectMacroSummaryLoading,
  selectMacroSummaryError,
} from "../store/macroSummarySlice";
import CalculationPopup from "./pop-folder/calculation-popup";

ChartJS.register(ArcElement, Tooltip, Legend);

const oneEndRoundedPlugin = {
  id: "oneEndRounded",
  afterDatasetDraw(chart) {
    if (chart.config.type !== "doughnut" && chart.config.type !== "pie") {
      return;
    }

    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);

    meta.data.forEach((arc) => {
      const { endAngle, innerRadius, outerRadius, x, y } = arc;

      const capRadius = (outerRadius - innerRadius) / 2;
      const midRadius = (outerRadius + innerRadius) / 2;

      const arcSpan = Math.abs(arc.endAngle - arc.startAngle);
      const minAngle = (2 * capRadius) / midRadius;
      if (arcSpan < minAngle * 0.5) return;

      const capX = x + midRadius * Math.cos(endAngle);
      const capY = y + midRadius * Math.sin(endAngle);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, outerRadius, 0, Math.PI * 2, false);
      ctx.arc(x, y, innerRadius, Math.PI * 2, 0, true);
      ctx.clip();

      ctx.beginPath();
      ctx.arc(capX, capY, capRadius, 0, Math.PI * 2);
      ctx.fillStyle = arc.options.backgroundColor;
      ctx.fill();
      ctx.restore();
    });

    const { chartArea } = chart;
    const innerCircleRadius = (chartArea.width / 2) * 0.78;
    const outerCircleRadius = chartArea.width / 2;
    const lineWidth = 4;
    const borderColor = "#E1E6ED";

    ctx.save();
    ctx.beginPath();
    ctx.arc(
      chartArea.left + chartArea.width / 2,
      chartArea.top + chartArea.height / 2,
      innerCircleRadius,
      0,
      Math.PI * 2
    );
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(
      chartArea.left + chartArea.width / 2,
      chartArea.top + chartArea.height / 2,
      outerCircleRadius,
      0,
      Math.PI * 2
    );
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  },
};

export default function MacrosUpdate({ title = "Macros Update", activeTab }) {
  const chartRef = useRef(null);
  const [labels, setLabels] = useState([]);
  const prevDataRef = useRef(null);
  const [showCalculationPopup, setShowCalculationPopup] = useState(false);

  const clientIndividualProfile = useSelector((state) => state.clientIndividualProfile.data);

  const dietAnalysisData = useSelector(selectDietAnalysisData);
  const dietAnalysisLoading = useSelector(selectDietAnalysisLoading);
  const dietAnalysisError = useSelector(selectDietAnalysisError);

  const macroSummaryData = useSelector(selectMacroSummaryData);
  const macroSummaryLoading = useSelector(selectMacroSummaryLoading);
  const macroSummaryError = useSelector(selectMacroSummaryError);

  useEffect(() => {
    ChartJS.register(oneEndRoundedPlugin);

    return () => {
      ChartJS.unregister(oneEndRoundedPlugin);
    };
  }, []);

  // Determine which data to use based on activeTab
  const weeklyData = useMemo(() => {
    if (activeTab === "macros" && macroSummaryData?.current_data?.final_macro_summary) {
      return macroSummaryData.current_data.final_macro_summary;
    }
    return dietAnalysisData?.data?.food_json?.weekly_json_data || {};
  }, [activeTab, macroSummaryData, dietAnalysisData]);

  // Get change data for macros tab
  const macroChanges = useMemo(() => {
    if (activeTab === "macros" && macroSummaryData?.macro_change_from_previous) {
      return macroSummaryData.macro_change_from_previous;
    }
    return null;
  }, [activeTab, macroSummaryData]);

  // Get previous data for comparison
  const previousData = useMemo(() => {
    if (activeTab === "macros" && macroSummaryData?.previous_data?.final_macro_summary) {
      return macroSummaryData.previous_data.final_macro_summary;
    }
    return null;
  }, [activeTab, macroSummaryData]);

  const totalCalories = Number(weeklyData?.calories || 0);
  const description = weeklyData?.note || "";
  const unit = "Kcal";

  // Helper function to format change display
  // const formatChange = (changeData) => {
  //   if (!changeData) return { icon: "/icons/hugeicons_arrow-down-0210278.svg", change: "0%" };
    
  //   const { change_percent, change_type } = changeData;
  //   const icon = change_type === "increase" 
  //     ? "/icons/hugeicons_arrow-down-0210278.svg"
  //     : "/icons/hugeicons_arrow-down-020.svg";
    
  //   return {
  //     icon,
  //     change: `${change_percent}%`,
  //     isPositive: change_type === "increase"
  //   };
  // };


const formatChange = (changeData) => {
  if (!changeData) return { icon: null, change: null, showChange: false };
  
  const { change_percent, change_type } = changeData;
  
  if (change_type === "increase") {
    return {
      icon: "/icons/hugeicons_arrow-up-03652.svg",
      change: `${change_percent}%`,
      showChange: true
    };
  } else if (change_type === "decrease") {
    return {
      icon: "/icons/hugeicons_arrow-down-0210278.svg",
      change: `${change_percent}%`,
      showChange: true
    };
  }
  
  // For any other change_type or if null
  return { icon: null, change: null, showChange: false };
};


const macros = [
  {
    name: "Carbs",
    color: "#F4A261",
    grams: `${Number(weeklyData?.carbs_g || 0).toFixed(2)}g`,
    value: Number(weeklyData?.carbs_g || 0),
    ...formatChange(macroChanges?.carbs_g),
  },
  {
    name: "Fats",
    color: "#3A86FF",
    grams: `${Number(weeklyData?.fat_g || 0).toFixed(2)}g`,
    value: Number(weeklyData?.fat_g || 0),
    ...formatChange(macroChanges?.fat_g),
  },
  {
    name: "Protein",
    color: "#E76F51",
    grams: `${Number(weeklyData?.protein_g || 0).toFixed(2)}g`,
    value: Number(weeklyData?.protein_g || 0),
    ...formatChange(macroChanges?.protein_g),
  },
  {
    name: "Fibre",
    color: "#2A9D8F",
    grams: `${Number(weeklyData?.fiber_g || 0).toFixed(2)}g`,
    value: Number(weeklyData?.fiber_g || 0),
    ...formatChange(macroChanges?.fiber_g),
  },
];


  const total = useMemo(() => {
    return macros.reduce((acc, item) => acc + item.value, 0);
  }, [
    weeklyData?.carbs_g,
    weeklyData?.fat_g,
    weeklyData?.protein_g,
    weeklyData?.fiber_g,
  ]);

  const dataInOrder = macros.map((macro) => macro.value);
  const colorsInOrder = macros.map((macro) => macro.color);

  const donutData = {
    datasets: [
      {
        data: dataInOrder,
        backgroundColor: colorsInOrder,
        borderWidth: 0,
        borderRadius: 0,
        spacing: 0,
        cutout: "78%",
        circumference: 360,
        rotation: -45,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
  };

  useEffect(() => {
    const currentDataString = JSON.stringify({
      carbs: weeklyData?.carbs_g,
      fat: weeklyData?.fat_g,
      protein: weeklyData?.protein_g,
      fiber: weeklyData?.fiber_g,
    });

    if (prevDataRef.current === currentDataString) {
      return;
    }

    prevDataRef.current = currentDataString;

    const timer = setTimeout(() => {
      const chart = chartRef.current;

      if (!chart || total <= 0) {
        setLabels([]);
        return;
      }

      const meta = chart.getDatasetMeta(0);

      if (!meta?.data?.length) {
        setLabels([]);
        return;
      }

      const nextLabels = meta.data.map((arc, index) => {
        const centerAngle = (arc.startAngle + arc.endAngle) / 2;
        const labelRadius = arc.outerRadius + 14;

        const x = arc.x + Math.cos(centerAngle) * labelRadius;
        const y = arc.y + Math.sin(centerAngle) * labelRadius;

        return {
          ...macros[index],
          percentage:
            total > 0 ? Math.round((macros[index].value / total) * 100) : 0,
          x,
          y,
        };
      });

      setLabels(nextLabels);
    }, 100);

    return () => clearTimeout(timer);
  }, [
    weeklyData?.carbs_g,
    weeklyData?.fat_g,
    weeklyData?.protein_g,
    weeklyData?.fiber_g,
    total,
  ]);

  const handleOpenCalculationPopup = () => {
    setShowCalculationPopup(true);
  };

  const handleCloseCalculationPopup = () => {
    setShowCalculationPopup(false);
  };

  // const ViewCalculationButton = () => (
  //   <button
  //     type="button"
  //     onClick={handleOpenCalculationPopup}
  //     className="flex gap-[15px] items-center px-[11px] py-1 border border-[#E1E6ED] rounded-[4px] cursor-pointer"
  //   >
  //     <p className="text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[-0.24px] whitespace-nowrap">
  //       View Calculation
  //     </p>
  //     <IoIosArrowForward className="text-[#308BF9] w-5 h-5" />
  //   </button>
  // );

  // Determine loading and error states based on activeTab
  const isLoading = activeTab === "diet" ? dietAnalysisLoading : macroSummaryLoading;
  const error = activeTab === "diet" ? dietAnalysisError : macroSummaryError;

  if (isLoading) {
    return (
      <>
        <div
          id="macros-update-container"
          className="w-[356px] max-xl:w-full max-xl:shrink-0 pt-5 pr-1 pb-5 bg-[#F5F7FA] rounded-[15px]"
        >
          <div className="flex items-center justify-between px-[18px] pr-[10px]">
            <p className="text-[#738298] text-[12px] font-semibold uppercase">
              {title}
            </p>

            {/* <ViewCalculationButton /> */}
          </div>

          <div className="flex justify-center items-center py-10">
            <p className="text-[#738298] text-[12px]">Loading...</p>
          </div>
        </div>

        {showCalculationPopup && (
          <CalculationPopup onClose={handleCloseCalculationPopup} />
        )}
      </>
    );
  }

  if (error) {
    return (
      <>
        <div
          id="macros-update-container"
          className="w-[356px] max-xl:w-full max-xl:shrink-0 pt-5 pr-1 pb-5 bg-[#F5F7FA] rounded-[15px]"
        >
          <div className="flex items-center justify-between px-[18px] pr-[10px]">
            <p className="text-[#738298] text-[12px] font-semibold uppercase">
              {title}
            </p>

            {/* <ViewCalculationButton /> */}
          </div>

          <div className="flex justify-center items-center py-10 px-4">
            <p className="text-red-500 text-[12px] text-center">
              {error}
            </p>
          </div>
        </div>

        {showCalculationPopup && (
          <CalculationPopup onClose={handleCloseCalculationPopup} />
        )}
      </>
    );
  }

  // Check if we have data to display
  const hasData = total > 0;

  return (
    <>
      <div
        id="macros-update-container"
        className="w-[356px] max-xl:w-full max-xl:shrink-0 pt-5 pr-1 pb-5 bg-[#F5F7FA] rounded-[15px]"
      >
        <div className="flex items-center justify-between px-[18px] pr-[10px]">
          <p className="text-[#738298] text-[12px] font-semibold uppercase">
            {title}
          </p>

          {/* <ViewCalculationButton /> */}
        </div>

        {hasData ? (
          <>
            <div className="flex justify-center items-center py-5">
              <div className="relative w-[200px] h-[200px]">
                <Doughnut ref={chartRef} data={donutData} options={donutOptions} />

                <div className="absolute inset-0 flex flex-col gap-[2px] items-center justify-center pointer-events-none">
                  <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">
                    Calories
                  </p>
                  <p className="text-[#252525] text-[40px] font-normal leading-normal tracking-[-0.8px]">
                    {totalCalories.toFixed(2)}
                  </p>
                  <p className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">{unit}</p>
                </div>

                {/* {total > 0 &&
                  labels.map((label, index) => (
                    <div
                      key={index}
                      className="absolute min-w-[47px] h-[24px] px-2 rounded-full bg-white shadow-[0px_4px_10px_rgba(0,0,0,0.12)] flex items-center justify-center"
                      style={{
                        left: `${label.x}px`,
                        top: `${label.y}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <p className="text-[#252525] text-[12px] font-semibold">
                        {label.percentage}%
                      </p>
                    </div>
                  ))} */}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex max-xl:justify-center">
                {macros.map((macro, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2.5 w-[87px] items-center"
                  >
                    <div className="flex gap-[5px] items-center">
                      <div
                        className="w-[6px] h-[6px] rounded-full"
                        style={{ background: macro.color }}
                      ></div>
                      <p className="text-[#252525] text-[10px] font-semibold capitalize">
                        {macro.name}
                      </p>
                    </div>

                    <div className="flex flex-col justify-center">
  <p className="text-[#252525] text-[15px] font-semibold">
    {macro.grams}
  </p>
  {macro.showChange && (
    <div className="flex items-center">
      <Image
        src={macro.icon}
        alt="arrow"
        width={20}
        height={20}
      />
      <p className="text-[#252525] text-[10px] font-semibold py-[2.5px]">
        {macro.change}
      </p>
    </div>
  )}
</div>
                  </div>
                ))}
              </div>

              <div className="pl-[18px] pr-[10px]">
                <p className="text-[#738298] text-[12px] leading-[130%]">
                  {description}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex justify-center items-center py-10">
            <p className="text-[#738298] text-[12px]">No data available</p>
          </div>
        )}
      </div>

      {showCalculationPopup && (
        <CalculationPopup onClose={handleCloseCalculationPopup} />
      )}
    </>
  );
}