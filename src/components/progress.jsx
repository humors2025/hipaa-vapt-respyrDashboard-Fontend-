// progress.jsx (replace the existing Progress component)
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IoIosArrowDown } from "react-icons/io";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { fetchProgressData, setSelectedRange } from "@/store/progressSlice";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function Progress({ title = "Progress", showDetails = true, showContainer = true }) {
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const profileId = searchParams.get("profile_id");

  const { byRange, loading: loadingByRange, error: errorByRange, selectedRange } = useSelector(
    (state) => state.progress
  );

  const graphData = byRange?.[selectedRange] || null;
  const loading = !!loadingByRange?.[selectedRange];
  const error = errorByRange?.[selectedRange] || null;

  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const rangeToDisplay = {
    weekly: "One Week",
    monthly: "One Month",
    all_time: "All Time",
  };

  const displayToRange = {
    "One Week": "weekly",
    "One Month": "monthly",
    "All Time": "all_time",
  };

  const ranges = ["One Week", "One Month", "All Time"];

  useEffect(() => {
    if (profileId) {
      dispatch(fetchProgressData({ profileId, range: selectedRange }));
    }
  }, [profileId, selectedRange, dispatch]);

  const handleRangeChange = (range) => {
    dispatch(setSelectedRange(displayToRange[range]));
    setOpenDropdown(false);
  };

  // Get overall_fat_loss_score data from graphs
  const overallFatLossData = useMemo(() => {
    if (!graphData?.graphs) return null;
    
    const fatLossScore = graphData.graphs.overall_fat_loss_score;
    if (!fatLossScore) return null;
    
    return {
      title: fatLossScore.title || "Overall Fat Loss Score",
      graph_points: fatLossScore.graph_points || [],
      recommended_trend_range: fatLossScore.recommended_trend_range || null,
      total_points: fatLossScore.total_points || 0,
    };
  }, [graphData]);

  const chartData = useMemo(() => {
    if (!overallFatLossData || !Array.isArray(overallFatLossData.graph_points)) {
      return null;
    }

    const labels = overallFatLossData.graph_points.map((point) => point.label);
    const values = overallFatLossData.graph_points.map((point) => Number(point.value) || 0);

    return {
      labels,
      values,
      title: overallFatLossData.title,
      recommendedRange: overallFatLossData.recommended_trend_range,
      rangeLabel: graphData?.range_label,
    };
  }, [overallFatLossData, graphData]);

  const data = useMemo(() => {
    if (!chartData) {
      return {
        labels: [],
        datasets: [],
      };
    }

    return {
      labels: chartData.labels,
      datasets: [
        {
          label: chartData.title,
          data: chartData.values,
          borderColor: "#308BF9",
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;

            if (!chartArea) return "rgba(30,120,255,0.12)";

            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            gradient.addColorStop(0, "rgba(30,120,255,0.25)");
            gradient.addColorStop(1, "rgba(30,120,255,0)");
            return gradient;
          },
          pointRadius: (ctx) =>
            ctx.dataIndex === chartData.values.length - 1 ? 6 : 0,
          pointHoverRadius: 6,
          pointBackgroundColor: "#308BF9",
          pointBorderColor: "#308BF9",
          pointBorderWidth: 0,
        },
      ],
    };
  }, [chartData]);

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          displayColors: false,
          backgroundColor: "rgba(0,0,0,0.75)",
          padding: 10,
          titleFont: { size: 12, weight: "600" },
          bodyFont: { size: 12, weight: "500" },
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y}%`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: true,
            borderDash: [4, 4],
            drawBorder: false,
            color: "#E1E6ED",
          },
          ticks: {
            color: "#8A8A8F",
            font: { size: 11, weight: "500" },
            maxRotation: 0,
            autoSkip: true,
          },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            callback: function (value) {
              return value;
            },
            color: "#8A8A8F",
            font: { size: 11, weight: "500" },
          },
          grid: {
            display: true,
            borderDash: [4, 4],
            drawBorder: false,
            color: "#E1E6ED",
          },
        },
      },
      elements: {
        line: {
          capBezierPoints: true,
        },
      },
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (loading && !graphData) {
    return (
      <div className="w-[410px] flex flex-col border border-[#E1E6ED] px-5 pt-[18px] pb-5 rounded-[15px] bg-white">
        <div className="flex justify-center items-center h-[300px]">
          <div className="text-[#535359]">Loading...</div>
        </div>
      </div>
    );
  }

  if (error && !graphData) {
    return (
      <div className="w-[410px] flex flex-col border border-[#E1E6ED] px-5 pt-[18px] pb-5 rounded-[15px] bg-white">
        <div className="flex justify-center items-center h-[300px]">
          <div className="text-red-500 text-center">
            <p>Error loading data</p>
            <button
              onClick={() =>
                dispatch(fetchProgressData({ profileId, range: selectedRange }))
              }
              className="mt-2 text-[#308BF9] text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }


   const containerClasses = showContainer 
    ? "w-full flex flex-col border border-[#E1E6ED] px-5 pt-[18px] pb-5 rounded-[15px] bg-white"
    : " flex flex-col px-5 pt-[18px] pb-5";

  return (
    <div className={containerClasses}>
      <div className="flex justify-between items-center">
        <div className="flex gap-[5px] items-center">
          <p className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px] whitespace-nowrap">
             {title}
          </p>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpenDropdown((prev) => !prev)}
            className="flex gap-[15px] px-[11px] py-1 border border-[#E1E6ED] rounded-[4px] items-center bg-white cursor-pointer"
          >
            <p className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] whitespace-nowrap">
              {rangeToDisplay[selectedRange]}
            </p>
            <IoIosArrowDown
              className={`text-[#A1A1A1] w-[15px] h-[15px] transition-transform duration-200 ${
                openDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {openDropdown && (
            <div className="absolute right-0 top-full mt-1 min-w-full bg-white border border-[#E1E6ED] rounded-[6px] shadow-md z-20 overflow-hidden">
              {ranges.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleRangeChange(item)}
                  className={`w-full text-left px-3 py-2 text-[12px] leading-[110%] tracking-[-0.24px] transition-colors cursor-pointer ${
                    rangeToDisplay[selectedRange] === item
                      ? "bg-[#F5F7FA] text-[#252525] font-medium"
                      : "text-[#535359] hover:bg-[#F5F7FA]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

 {showDetails && (
      <div className="flex flex-col gap-[5px] mt-3">
        <p className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-0.5px]">
          {overallFatLossData?.title || "Overall Fat Loss Score"}
        </p>

        <div className="flex gap-5 items-center px-[15px] py-[5px] rounded-[5px] bg-[#E0E0E0] whitespace-nowrap w-fit">
          <div className="flex gap-[3px] items-center">
            <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
              RECOMMENDED TREND RANGE
            </p>

            <Image
              src="/icons/hugeicons_information-circle-1.svg"
              alt="info"
              width={14}
              height={14}
            />
          </div>

          <p className="text-[#252525] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
            {chartData?.recommendedRange?.label || "NA"}
          </p>
        </div>
      </div>
        )}

      <div className="mt-4 w-full h-[170px]">
        {chartData && chartData.values.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div className="flex justify-center items-center h-full text-[#535359]">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}