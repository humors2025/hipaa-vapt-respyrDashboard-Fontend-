




"use client";

import React, { useMemo, useState, useEffect } from "react";
import { IoIosArrowDown } from "react-icons/io";
import Graph from "./graph";
import { fetchScoreTrend, fetchScoresInsight } from "../services/authService";
import { useSearchParams } from "next/navigation";
import { cookieManager } from "../lib/cookies";
import { useDispatch } from "react-redux";
import { setScoresInsight } from "../store/scoresInsightSlice";

function TrendsComponent({ selectedDate, showMainMarker = true, compactGraphs = false }) {
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const dieticianData = cookieManager.getJSON("dietician");
  const dieticianId = dieticianData?.dietician_id;
  const profileId = searchParams.get("profile_id");

  const [active, setActive] = useState("Digestive Balance Trend");
  const [firstTimeRange, setFirstTimeRange] = useState("Weekly");
  const [secondTimeRange, setSecondTimeRange] = useState("Weekly");
  const [firstShowDropdown, setFirstShowDropdown] = useState(false);
  const [secondShowDropdown, setSecondShowDropdown] = useState(false);

  // Month dropdowns (shown only when Monthly is selected)
  const [firstSelectedMonth, setFirstSelectedMonth] = useState(null); // "YYYY-MM"
  const [secondSelectedMonth, setSecondSelectedMonth] = useState(null); // "YYYY-MM"
  const [firstMonthDropdown, setFirstMonthDropdown] = useState(false);
  const [secondMonthDropdown, setSecondMonthDropdown] = useState(false);

  const [graphData, setGraphData] = useState(null);
  const [scoresInsightData, setScoresInsightData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiMessage, setApiMessage] = useState(null);

  // Function to format date to YYYY-MM-DD
  const formatDateToYYYYMMDD = (date) => {
    if (!date) return null;

    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.error("Invalid date:", date);
      return null;
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Normalize tests_by_date → { range, data }
  const normalizeTestsByDate = (testsByDate) => {
    if (!testsByDate) return null;

    const dates = Object.keys(testsByDate).sort();
    if (dates.length === 0) return null;

    const data = dates.map((date) => {
      const t = testsByDate[date];
      const s = t.scores || {};

      return {
        date,
        absorptive_metabolism_score: s.absorptive ?? 0,
        fermentative_metabolism_score: s.fermentative ?? 0,
        fat_metabolism_score: s.fat ?? 0,
        glucose_metabolism_score: s.glucose ?? 0,
        hepatic_stress_metabolism_score: s.hepatic_stress ?? 0,
        detoxification_metabolism_score: s.detoxification ?? 0,
      };
    });

    return {
      range: { start_date: dates[0], end_date: dates[dates.length - 1] },
      data,
    };
  };

  // Fetch trend data once (per profile)
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!dieticianId || !profileId) return;

      setLoading(true);
      setError(null);
      setApiMessage(null);

      try {
        const response = await fetchScoreTrend(dieticianId, profileId);

        if (response && response.tests_by_date) {
          const normalized = normalizeTestsByDate(response.tests_by_date);
          if (normalized) {
            setGraphData(normalized);
            setApiMessage(null);
          } else {
            setGraphData(null);
            setApiMessage("No data available");
          }
        } else {
          setGraphData(null);
          setApiMessage(response?.message || "No data available");
        }
      } catch (err) {
        setError(err.message || "An error occurred");
        setGraphData(null);
        setApiMessage(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [dieticianId, profileId]);

  // Fetch scores insight when selectedDate changes
  useEffect(() => {
    const fetchScoresData = async () => {
      if (!dieticianId || !profileId || !selectedDate) return;

      const formattedDate = formatDateToYYYYMMDD(selectedDate);
      if (!formattedDate) return;

      setScoresLoading(true);
      try {
        const response = await fetchScoresInsight(dieticianId, profileId, formattedDate);

        if (response?.noData) {
          setScoresInsightData(null);
          dispatch(setScoresInsight(null));
        } else if (response && response.latest_test) {
          setScoresInsightData(response);
          dispatch(setScoresInsight(response));
        } else {
          setScoresInsightData(null);
          dispatch(setScoresInsight(null));
        }
      } catch (err) {
        console.error("Error fetching scores insight:", err);
        setScoresInsightData(null);
        dispatch(setScoresInsight(null));
      } finally {
        setScoresLoading(false);
      }
    };

    fetchScoresData();
  }, [dieticianId, profileId, selectedDate, dispatch]);

  // Build months list from graphData.data
  const monthOptions = useMemo(() => {
    const list = graphData?.data || [];
    const map = new Map();

    list.forEach((item) => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}`;
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

      map.set(key, label);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, label]) => ({ key, label }));
  }, [graphData]);

  // Default select latest month once data arrives
  useEffect(() => {
    if (!monthOptions.length) return;

    const latest = monthOptions[monthOptions.length - 1];
    if (!firstSelectedMonth) setFirstSelectedMonth(latest.key);
    if (!secondSelectedMonth) setSecondSelectedMonth(latest.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOptions]);

  // Active marker
  const getActiveMarker = () => {
    switch (active) {
      case "Digestive Balance Trend":
        return { name: "Hydrogen", value: scoresInsightData?.latest_test?.ppm?.h2, unit: "ppm" };
      case "Fuel & Energy Trend":
        return { name: "Acetone", value: scoresInsightData?.latest_test?.ppm?.acetone, unit: "ppm" };
      case "Metabolic Recovery Trend":
        return { name: "Ethanol", value: scoresInsightData?.latest_test?.ppm?.ethanol, unit: "ppm" };
      default:
        return { name: "Hydrogen", value: scoresInsightData?.latest_test?.ppm?.h2, unit: "ppm" };
    }
  };

  const activeMarker = getActiveMarker();


  // Updated getMarkersForScoreType with 70% threshold
  const getMarkersForScoreType = (scoreType) => {
    switch (scoreType) {
      case "absorptive":
      case "detoxification":
      case "fat":
        return [
          { position: "0%", label: "0" },
          { position: "70%", label: "70" },  // Focus/Moderate boundary
          { position: "80%", label: "80" },  // Moderate/Optimal boundary
          { position: "100%", label: "100" },
        ];
      case "fermentative":
      case "glucose":
      case "hepatic_stress":
        return [
          { position: "0%", label: "0" },
          { position: "20%", label: "20" },  // Optimal/Moderate boundary
          { position: "30%", label: "30" },  // Moderate/Focus boundary
          { position: "100%", label: "100" },
        ];
      default:
        return [
          { position: "0%", label: "0" },
          { position: "100%", label: "100" },
        ];
    }
  };

  // Updated getZoneSegmentsForScoreType with 70% threshold
  const getZoneSegmentsForScoreType = (scoreType) => {
    switch (scoreType) {
      case "fermentative":
      case "glucose":
      case "hepatic_stress":
        // For these scores: 0-20% = Optimal (green), 20-30% = Moderate (yellow), 30-100% = Focus (orange)
        return [
          { color: "#3FAF58", width: "20%", min: 0, max: 20 },      // Optimal
          { color: "#FFBF2D", width: "10%", min: 20, max: 30 },     // Moderate
          { color: "#E48326", width: "70%", min: 30, max: 100 },    // Focus (70% width)
        ];
      
      case "absorptive":
      case "detoxification":
        // For these scores: 0-70% = Focus (orange), 70-80% = Moderate (yellow), 80-100% = Optimal (green)
        return [
          { color: "#E48326", width: "70%", min: 0, max: 70 },      // Focus (70% width)
          { color: "#FFBF2D", width: "10%", min: 70, max: 80 },     // Moderate
          { color: "#3FAF58", width: "20%", min: 80, max: 100 },    // Optimal
        ];
      
      case "fat":
        // For fat: 0-70% = Focus (orange), 70-80% = Moderate (yellow), 80-100% = Optimal (green)
        return [
          { color: "#E48326", width: "70%", min: 0, max: 70 },      // Focus (70% width)
          { color: "#FFBF2D", width: "10%", min: 70, max: 80 },     // Moderate
          { color: "#3FAF58", width: "20%", min: 80, max: 100 },    // Optimal
        ];
      
      default:
        return [{ color: "#E1E6ED", width: "100%", min: 0, max: 100 }];
    }
  };

  const getTitles = () => {
    switch (active) {
      case "Digestive Balance Trend":
        return {
          firstTitle: "Nutrient Utilization Trend",
          secondTitle: "Digestive Activity Trend",
          firstScoreType: "absorptive",
          secondScoreType: "fermentative",
        };
      case "Fuel & Energy Trend":
        return {
          firstTitle: "Fuel Utilization Trend",
          secondTitle: "Energy Source Trend",
          firstScoreType: "fat",
          secondScoreType: "glucose",
        };
      case "Metabolic Recovery Trend":
        return {
          firstTitle: "Recovery Activity Trend",
          secondTitle: "Metabolic Load Trend",
          firstScoreType: "detoxification",
          secondScoreType: "hepatic_stress",
        };
      default:
        return {
          firstTitle: "Nutrient Utilization Trend",
          secondTitle: "Digestive Activity Trend",
          firstScoreType: "absorptive",
          secondScoreType: "fermentative",
        };
    }
  };

  const titles = getTitles();

  const metabolismData =
    scoresInsightData?.latest_test?.test_json?.Metabolism_Score_Analysis;

  const firstGraphZone =
    titles.firstTitle === "Nutrient Utilization Trend"
      ? metabolismData?.Nutrient_Utilization_Trend?.zone
      : titles.firstTitle === "Fuel Utilization Trend"
      ? metabolismData?.Fuel_Utilization_Trend?.zone
      : titles.firstTitle === "Recovery Activity Trend"
      ? metabolismData?.Recovery_Activity_Trend?.zone
      : null;

  const secondGraphZone =
    titles.secondTitle === "Digestive Activity Trend"
      ? metabolismData?.Digestive_Activity_Trend?.zone
      : titles.secondTitle === "Energy Source Trend"
      ? metabolismData?.Energy_Source_Trend?.zone
      : titles.secondTitle === "Metabolic Load Trend"
      ? metabolismData?.Metabolic_Load_Trend?.zone
      : null;

  // Progress bars: default / no data / actual
  const getDefaultProgressBarConfigs = () => {
    return [
      {
        percentage: "-",
        colors: getZoneSegmentsForScoreType(titles.firstScoreType),
        markers: getMarkersForScoreType(titles.firstScoreType),
        status: "Optimal",
        statusColor: "#3FAF58",
        interpretation: "-",
        intervention: "-",
      },
      {
        percentage: "-",
        colors: getZoneSegmentsForScoreType(titles.secondScoreType),
        markers: getMarkersForScoreType(titles.secondScoreType),
        status: "Optimal",
        statusColor: "#3FAF58",
        interpretation: "-",
        intervention: "-",
      },
    ];
  };

  const getNoDataProgressBarConfigs = () => {
    return [
      {
        percentage: 0,
        colors: [
          { color: "#E1E6ED", width: "30%" },
          { color: "#E1E6ED", width: "40%" },
          { color: "#E1E6ED", width: "30%" },
        ],
        markers: [
          { position: "0%", label: "0" },
          { position: "30%", label: "60" },
          { position: "70%", label: "80" },
          { position: "100%", label: "100" },
        ],
        status: "No Data",
        statusColor: "#A1A1A1",
        interpretation: "No test data available for the selected date",
        intervention: "Please select a different date with available test results",
      },
      {
        percentage: 0,
        colors: [
          { color: "#E1E6ED", width: "30%" },
          { color: "#E1E6ED", width: "40%" },
          { color: "#E1E6ED", width: "30%" },
        ],
        markers: [
          { position: "0%", label: "0" },
          { position: "30%", label: "60" },
          { position: "70%", label: "80" },
          { position: "100%", label: "100" },
        ],
        status: "No Data",
        statusColor: "#A1A1A1",
        interpretation: "No test data available for the selected date",
        intervention: "Please select a different date with available test results",
      },
    ];
  };

  const normalizeZone = (z) => String(z || "").trim().toLowerCase();

  const zoneToColor = (zone) => {
    const z = normalizeZone(zone);
    if (z === "optimal") return "#3FAF58";
    if (z === "moderate") return "#FFBF2D";
    if (z === "focus") return "#E48326";
    return "#3FAF58";
  };

  const getProgressBarConfigs = () => {
    if (scoresInsightData?.noData) return getNoDataProgressBarConfigs();
    if (!scoresInsightData || !scoresInsightData.latest_test) return getDefaultProgressBarConfigs();

    const testJson = scoresInsightData.latest_test.test_json;
    const scores = scoresInsightData.latest_test.scores;

    const hasActualData = testJson && testJson.Metabolism_Score_Analysis;
    const hasOnlyRawData = testJson && testJson.raw;

    if (hasOnlyRawData) return getNoDataProgressBarConfigs();
    if (!hasActualData) return getNoDataProgressBarConfigs();

    const metabolismData = testJson.Metabolism_Score_Analysis;

    switch (active) {
      case "Digestive Balance Trend":
        return [
          {
            percentage: scores.absorptive || 0,
            colors: getZoneSegmentsForScoreType("absorptive"),
            markers: getMarkersForScoreType("absorptive"),
            status: metabolismData.Nutrient_Utilization_Trend?.zone || "N/A",
            statusColor: zoneToColor(metabolismData.Nutrient_Utilization_Trend?.zone),
            interpretation: metabolismData.Nutrient_Utilization_Trend?.interpretation || "No interpretation available",
            intervention: metabolismData.Nutrient_Utilization_Trend?.intervention || "No intervention available",
          },
          {
            percentage: scores.fermentative || 0,
            colors: getZoneSegmentsForScoreType("fermentative"),
            markers: getMarkersForScoreType("fermentative"),
            status: metabolismData.Digestive_Activity_Trend?.zone || "N/A",
            statusColor: zoneToColor(metabolismData.Digestive_Activity_Trend?.zone),
            interpretation: metabolismData.Digestive_Activity_Trend?.interpretation || "No interpretation available",
            intervention: metabolismData.Digestive_Activity_Trend?.intervention || "No intervention available",
          },
        ];

      case "Fuel & Energy Trend":
        return [
          {
            percentage: scores.fat || 0,
            colors: getZoneSegmentsForScoreType("fat"),
            markers: getMarkersForScoreType("fat"),
            status: metabolismData.Fuel_Utilization_Trend?.zone || "N/A",
            statusColor: zoneToColor(metabolismData.Fuel_Utilization_Trend?.zone),
            interpretation: metabolismData.Fuel_Utilization_Trend?.interpretation || "No interpretation available",
            intervention: metabolismData.Fuel_Utilization_Trend?.intervention || "No intervention available",
          },
          {
            percentage: scores.glucose || 0,
            colors: getZoneSegmentsForScoreType("glucose"),
            markers: getMarkersForScoreType("glucose"),
            status: metabolismData.Energy_Source_Trend?.zone || "N/A",
            statusColor: zoneToColor(metabolismData.Energy_Source_Trend?.zone),
            interpretation: metabolismData.Energy_Source_Trend?.interpretation || "No interpretation available",
            intervention: metabolismData.Energy_Source_Trend?.intervention || "No intervention available",
          },
        ];

      case "Metabolic Recovery Trend":
        return [
          {
            percentage: scores.detoxification || 0,
            colors: getZoneSegmentsForScoreType("detoxification"),
            markers: getMarkersForScoreType("detoxification"),
            status: metabolismData.Recovery_Activity_Trend?.zone || "N/A",
            statusColor: zoneToColor(metabolismData.Recovery_Activity_Trend?.zone),
            interpretation: metabolismData.Recovery_Activity_Trend?.interpretation || "No interpretation available",
            intervention: metabolismData.Recovery_Activity_Trend?.intervention || "No intervention available",
          },
          {
            percentage: scores.hepatic_stress || 0,
            colors: getZoneSegmentsForScoreType("hepatic_stress"),
            markers: getMarkersForScoreType("hepatic_stress"),
            status: metabolismData.Metabolic_Load_Trend?.zone || "N/A",
            statusColor: zoneToColor(metabolismData.Metabolic_Load_Trend?.zone),
            interpretation: metabolismData.Metabolic_Load_Trend?.interpretation || "No interpretation available",
            intervention: metabolismData.Metabolic_Load_Trend?.intervention || "No intervention available",
          },
        ];

      default:
        return getDefaultProgressBarConfigs();
    }
  };

  const progressBarConfigs = getProgressBarConfigs();

  // Updated ProgressBarSection with accurate marker positioning
  const ProgressBarSection = ({ config }) => {
    // Calculate the marker position based on the actual percentage value
    const getMarkerPosition = () => {
      if (config.percentage === "-" || config.percentage === 0) return "0%";
      
      const percentage = Number(config.percentage) || 0;
      
      // Find which segment this percentage falls into
      const segment = config.colors.find(
        seg => percentage >= seg.min && percentage <= seg.max
      );
      
      if (!segment) return `${Math.max(0, Math.min(100, percentage))}%`;
      
      // Calculate position within the segment
      const segmentStart = segment.min;
      const segmentEnd = segment.max;
      const segmentRange = segmentEnd - segmentStart;
      
      if (segmentRange === 0) return `${segment.min}%`;
      
      // Calculate the percentage of the way through this segment
      const percentThroughSegment = (percentage - segmentStart) / segmentRange;
      
      // Calculate the cumulative width before this segment
      let cumulativeWidth = 0;
      for (const seg of config.colors) {
        if (seg === segment) break;
        cumulativeWidth += parseFloat(seg.width);
      }
      
      // Add the portion within this segment
      const segmentWidth = parseFloat(segment.width);
      const position = cumulativeWidth + (percentThroughSegment * segmentWidth);
      
      return `${position}%`;
    };

    // Get the color for the status text based on the actual percentage
    const getStatusColor = () => {
      if (config.percentage === "-") return config.statusColor;
      
      const percentage = Number(config.percentage) || 0;
      
      // Find which segment this percentage belongs to
      const segment = config.colors.find(
        seg => percentage >= seg.min && percentage <= seg.max
      );
      
      return segment?.color || config.statusColor;
    };

    return (
      <div className="flex flex-col gap-5 w-full lg:w-auto">
        <div className="flex flex-col gap-[5px] w-full relative">
          <div className="w-full rounded-[10px] h-[22px] flex gap-0.5 relative items-center">
            {config.colors.map((colorConfig, index) => (
              <div
                key={index}
                className="h-2.5 rounded-[5px]"
                style={{
                  backgroundColor: colorConfig.color,
                  width: colorConfig.width,
                }}
              />
            ))}
            <div
              className="absolute top-1/2 w-1 h-[22px] border-[10px] border-[#252525] rounded-[10px] transform -translate-y-1/2 z-10"
              style={{
                left: getMarkerPosition(),
              }}
            />
          </div>

          <div className="relative w-full">
            {config.markers.map((marker, index) => (
              <span
                key={index}
                className="absolute -translate-x-1/2 text-[8px] text-[#252525] font-normal"
                style={{ left: marker.position }}
              >
                {marker.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
            {config.percentage === "-"
              ? "-"
              : `${Number(config.percentage || 0).toFixed(0)}%`}
          </p>

          <div className="mx-3 h-4 w-px bg-[#252525]"></div>

          <p className="text-[20px] md:text-[25px] font-semibold" style={{ color: getStatusColor() }}>
            {config.status}
          </p>
        </div>

        <div className="flex flex-col gap-[5px]">
          <span className="text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
            Interpretation:
          </span>
          <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
            {config.interpretation}
          </span>
        </div>

        <div className="border-b border-[#E1E6ED]"></div>

        <div className="flex flex-col gap-[5px]">
          <span className="text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
            Intervention:
          </span>
          <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px] break-words">
            {config.intervention}
          </span>
        </div>
      </div>
    );
  };

  const formatDateLabel = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      const day = String(date.getDate()).padStart(2, "0");
      const month = date.toLocaleDateString("en-GB", { month: "short" });
      return `${day} ${month}`;
    } catch {
      return "Invalid Date";
    }
  };

  // Monthly aggregation by selected month
  const aggregateDataByWeek = (data, scoreType, selectedMonthKey) => {
    if (!data || data.length === 0) return { labels: [], values: [] };

    let targetMonth, targetYear;

    if (selectedMonthKey) {
      const [y, m] = selectedMonthKey.split("-");
      targetYear = Number(y);
      targetMonth = Number(m) - 1;
    } else {
      const lastDate = new Date(data[data.length - 1].date);
      targetMonth = lastDate.getMonth();
      targetYear = lastDate.getFullYear();
    }

    const monthData = data.filter((item) => {
      const d = new Date(item.date);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    if (monthData.length === 0) return { labels: [], values: [] };

    const weeklyData = {};

    const monthShort = (d) => d.toLocaleDateString("en-GB", { month: "short" });

    const formatDayMonth = (d) => {
      const day = String(d.getDate()).padStart(2, "0");
      return `${day} ${monthShort(d)}`;
    };

    const getWeekStartMonday = (dateObj) => {
      const d = new Date(dateObj);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const getWeekEndSunday = (mondayObj) => {
      const d = new Date(mondayObj);
      d.setDate(d.getDate() + 6);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const getScore = (item) => {
      switch (scoreType) {
        case "absorptive":
          return parseInt(item.absorptive_metabolism_score) || 0;
        case "fermentative":
          return parseInt(item.fermentative_metabolism_score) || 0;
        case "fat":
          return parseInt(item.fat_metabolism_score) || 0;
        case "glucose":
          return parseInt(item.glucose_metabolism_score) || 0;
        case "detoxification":
          return parseInt(item.detoxification_metabolism_score) || 0;
        case "hepatic_stress":
          return parseInt(item.hepatic_stress_metabolism_score) || 0;
        default:
          return 0;
      }
    };

    monthData.forEach((item) => {
      const dateObj = new Date(item.date);

      const monday = getWeekStartMonday(dateObj);
      const sunday = getWeekEndSunday(monday);

      const monthStart = new Date(targetYear, targetMonth, 1);
      const monthEnd = new Date(targetYear, targetMonth + 1, 0);

      const start = monday < monthStart ? monthStart : monday;
      const end = sunday > monthEnd ? monthEnd : sunday;

      const weekLabel = `${formatDayMonth(start)} - ${formatDayMonth(end)}`;

      if (!weeklyData[weekLabel]) weeklyData[weekLabel] = [];
      weeklyData[weekLabel].push(getScore(item));
    });

    const result = { labels: [], values: [] };

    const sortedLabels = Object.keys(weeklyData).sort((a, b) => {
      const parseStart = (label) => {
        const [startPart] = label.split(" - ");
        const [dd, mon] = startPart.split(" ");
        const monthIndex = new Date(`${mon} 01, ${targetYear}`).getMonth();
        return new Date(targetYear, monthIndex, Number(dd));
      };
      return parseStart(a) - parseStart(b);
    });

    sortedLabels.forEach((label) => {
      const arr = weeklyData[label];
      const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length;
      result.labels.push(label);
      result.values.push(Math.round(avg));
    });

    return result;
  };

  // Main data processing for Weekly / Monthly
  const getProcessedData = (scoreType, timeRange) => {
    if (!graphData || !graphData.data) return { labels: [], values: [] };

    const sortedData = [...graphData.data].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (timeRange === "Weekly") {
      const last7 = sortedData.slice(-7);

      const labels = last7.map((item) => formatDateLabel(item.date));
      const values = last7.map((item) => {
        switch (scoreType) {
          case "absorptive":
            return parseInt(item.absorptive_metabolism_score) || 0;
          case "fermentative":
            return parseInt(item.fermentative_metabolism_score) || 0;
          case "fat":
            return parseInt(item.fat_metabolism_score) || 0;
          case "glucose":
            return parseInt(item.glucose_metabolism_score) || 0;
          case "detoxification":
            return parseInt(item.detoxification_metabolism_score) || 0;
          case "hepatic_stress":
            return parseInt(item.hepatic_stress_metabolism_score) || 0;
          default:
            return 0;
        }
      });

      return { labels, values };
    }

    if (timeRange === "Monthly") {
      const selectedMonthKey =
        scoreType === titles.firstScoreType ? firstSelectedMonth : secondSelectedMonth;

      return aggregateDataByWeek(sortedData, scoreType, selectedMonthKey);
    }

    return { labels: [], values: [] };
  };

  const handleFirstTimeRangeChange = (newRange) => {
    setFirstTimeRange(newRange);
    setFirstShowDropdown(false);
    setFirstMonthDropdown(false);

    if (newRange === "Weekly") {
      setFirstSelectedMonth(null);
    } else if (newRange === "Monthly" && !firstSelectedMonth && monthOptions.length) {
      setFirstSelectedMonth(monthOptions[monthOptions.length - 1].key);
    }
  };

  const handleSecondTimeRangeChange = (newRange) => {
    setSecondTimeRange(newRange);
    setSecondShowDropdown(false);
    setSecondMonthDropdown(false);

    if (newRange === "Weekly") {
      setSecondSelectedMonth(null);
    } else if (newRange === "Monthly" && !secondSelectedMonth && monthOptions.length) {
      setSecondSelectedMonth(monthOptions[monthOptions.length - 1].key);
    }
  };

  const getTabColor = (tabLabel) => {
    const metabolismData = scoresInsightData?.latest_test?.test_json?.Metabolism_Score_Analysis;

    if (!metabolismData) return "#E1E6ED";

    let zone1 = "";
    let zone2 = "";

    switch (tabLabel) {
      case "Digestive Balance Trend":
        zone1 = metabolismData.Nutrient_Utilization_Trend?.zone;
        zone2 = metabolismData.Digestive_Activity_Trend?.zone;
        break;

      case "Fuel & Energy Trend":
        zone1 = metabolismData.Fuel_Utilization_Trend?.zone;
        zone2 = metabolismData.Energy_Source_Trend?.zone;
        break;

      case "Metabolic Recovery Trend":
        zone1 = metabolismData.Recovery_Activity_Trend?.zone;
        zone2 = metabolismData.Metabolic_Load_Trend?.zone;
        break;

      default:
        break;
    }

    const z1 = normalizeZone(zone1);
    const z2 = normalizeZone(zone2);

    if (z1 === "focus" || z2 === "focus") return "#E48326";
    if (z1 === "moderate" || z2 === "moderate") return "#FFBF2D";
    if (z1 === "optimal" || z2 === "optimal") return "#3FAF58";

    return "#E1E6ED";
  };

  const tabs = [
    { label: "Digestive Balance Trend" },
    { label: "Fuel & Energy Trend" },
    { label: "Metabolic Recovery Trend" },
  ];

  const firstSectionData = useMemo(
    () => getProcessedData(titles.firstScoreType, firstTimeRange),
    [graphData, titles.firstScoreType, firstTimeRange, firstSelectedMonth, monthOptions]
  );

  const secondSectionData = useMemo(
    () => getProcessedData(titles.secondScoreType, secondTimeRange),
    [graphData, titles.secondScoreType, secondTimeRange, secondSelectedMonth, monthOptions]
  );

  const hasTrendData = (graphData?.data?.length || 0) > 0;
  if (!loading && !error && (!hasTrendData || apiMessage)) {
    return null;
  }

  if (loading) {
    return <div className="flex-1 min-w-0 rounded-[15px] mx-2 p-4">Loading graph data...</div>;
  }

  if (error) {
    return (
      <div className="flex-1 min-w-0 rounded-[15px] mx-2 p-4 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 rounded-[15px] mx-2">
      <div className="mt-[15px] ml-[13px]">
        <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[0.4px]">
          Score Analysis
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {/* Tabs */}
        <div className="flex w-full gap-6 mt-[18px] border-b border-[#E1E6ED]">
          {tabs.map((tab) => {
            const isActive = active === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => setActive(tab.label)}
                className={`flex gap-2.5 items-center pb-[13px] pl-[5px] pr-[25px] cursor-pointer ${
                  isActive ? "border-b-2 border-[#308BF9]" : ""
                }`}
              >
                <span
                  className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${
                    isActive ? "text-[#308BF9]" : "text-[#A1A1A1]"
                  }`}
                >
                  {tab.label}
                </span>
                <div
                  className="w-[6px] h-[6px] rounded-full"
                  style={{ backgroundColor: getTabColor(tab.label) }}
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-9 pt-1.5 pl-[5px] pr-[13px] rounded-[15px]">
          {/* Main Marker */}
          {showMainMarker && (
            <div className="flex flex-col gap-[5px] px-[15px] py-[18px] bg-[#F0F0F0] rounded-[15px]">
              <span className="text-[#252525] text-[12px] font-semibold leading-[130%] tracking-[-0.24px]">
                Main Marker: {activeMarker.name}
              </span>
              <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">
                {activeMarker.value
                  ? `${parseFloat(activeMarker.value).toFixed(3)} ${activeMarker.unit}`
                  : "-"}
              </span>
            </div>
          )}

          {/* ✅ COMPACT MODE (used in ClientReminder) */}
          {compactGraphs ? (
            <div className="mx-[15px] my-4">
              <div className="flex justify-center items-center gap-6">
                {/* LEFT GRAPH */}
                <div className="w-[500px] max-w-full flex-none ">
                  <div className="flex gap-3 mb-3">
                    {/* Weekly/Monthly */}
                    <div className="relative">
                      <div
                        className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                        onClick={() => setFirstShowDropdown(!firstShowDropdown)}
                      >
                        <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                          {firstTimeRange}
                        </span>
                        <IoIosArrowDown className="w-5 h-5" />
                      </div>

                      {firstShowDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                          <div
                            className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleFirstTimeRangeChange("Weekly")}
                          >
                            <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                              Weekly
                            </span>
                          </div>
                          <div
                            className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleFirstTimeRangeChange("Monthly")}
                          >
                            <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                              Monthly
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Month dropdown */}
                    {firstTimeRange === "Monthly" && (
                      <div className="relative">
                        <div
                          className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                          onClick={() => setFirstMonthDropdown(!firstMonthDropdown)}
                        >
                          <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                            {monthOptions.find((m) => m.key === firstSelectedMonth)?.label ||
                              "Select Month"}
                          </span>
                          <IoIosArrowDown className="w-5 h-5" />
                        </div>

                        {firstMonthDropdown && (
                          <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                            {monthOptions.map((m) => (
                              <div
                                key={m.key}
                                className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  setFirstSelectedMonth(m.key);
                                  setFirstMonthDropdown(false);
                                }}
                              >
                                <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                  {m.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {apiMessage ? (
                    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-center">
                        <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px]">
                      <Graph
                        title={titles.firstTitle}
                        labels={firstSectionData.labels}
                        values={firstSectionData.values}
                        showGradient={true}
                        zone={firstGraphZone}
                      />
                    </div>
                  )}
                </div>

                {/* RIGHT GRAPH */}
                <div className="w-[500px] max-w-full flex-none">
                  <div className="flex gap-3 mb-3 justify-end">
                    {/* Weekly/Monthly */}
                    <div className="relative">
                      <div
                        className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                        onClick={() => setSecondShowDropdown(!secondShowDropdown)}
                      >
                        <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                          {secondTimeRange}
                        </span>
                        <IoIosArrowDown className="w-5 h-5" />
                      </div>

                      {secondShowDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                          <div
                            className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSecondTimeRangeChange("Weekly")}
                          >
                            <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                              Weekly
                            </span>
                          </div>
                          <div
                            className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSecondTimeRangeChange("Monthly")}
                          >
                            <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                              Monthly
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Month dropdown */}
                    {secondTimeRange === "Monthly" && (
                      <div className="relative">
                        <div
                          className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                          onClick={() => setSecondMonthDropdown(!secondMonthDropdown)}
                        >
                          <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                            {monthOptions.find((m) => m.key === secondSelectedMonth)?.label ||
                              "Select Month"}
                          </span>
                          <IoIosArrowDown className="w-5 h-5" />
                        </div>

                        {secondMonthDropdown && (
                          <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                            {monthOptions.map((m) => (
                              <div
                                key={m.key}
                                className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  setSecondSelectedMonth(m.key);
                                  setSecondMonthDropdown(false);
                                }}
                              >
                                <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                  {m.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {apiMessage ? (
                    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-center">
                        <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px]">
                      <Graph
                        title={titles.secondTitle}
                        labels={secondSectionData.labels}
                        values={secondSectionData.values}
                        showGradient={true}
                        zone={secondGraphZone}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ✅ NORMAL MODE (your original layout) */
            <div className="flex flex-col gap-[42px]">
              {/* First Section */}
              <div className="flex flex-col gap-5">
                <div className="pb-5 border-b border-[#E1E6ED]">
                  <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.6px]">
                    {titles.firstTitle}
                  </span>
                </div>

                <div className="flex flex-col lg:flex-row gap-[30px] items-start">
                  {/* Graph */}
                  <div className="flex-1 w-full lg:w-1/2 min-w-0">
                    <div className="mx-[15px] my-4">
                      <div className="flex justify-between gap-3">
                        {/* Weekly/Monthly */}
                        <div className="relative">
                          <div
                            className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                            onClick={() => setFirstShowDropdown(!firstShowDropdown)}
                          >
                            <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                              {firstTimeRange}
                            </span>
                            <IoIosArrowDown className="w-5 h-5" />
                          </div>

                          {firstShowDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                              <div
                                className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleFirstTimeRangeChange("Weekly")}
                              >
                                <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                  Weekly
                                </span>
                              </div>
                              <div
                                className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleFirstTimeRangeChange("Monthly")}
                              >
                                <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                  Monthly
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Month dropdown */}
                        {firstTimeRange === "Monthly" && (
                          <div className="relative">
                            <div
                              className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                              onClick={() => setFirstMonthDropdown(!firstMonthDropdown)}
                            >
                              <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                {monthOptions.find((m) => m.key === firstSelectedMonth)?.label ||
                                  "Select Month"}
                              </span>
                              <IoIosArrowDown className="w-5 h-5" />
                            </div>

                            {firstMonthDropdown && (
                              <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                                {monthOptions.map((m) => (
                                  <div
                                    key={m.key}
                                    className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                    onClick={() => {
                                      setFirstSelectedMonth(m.key);
                                      setFirstMonthDropdown(false);
                                    }}
                                  >
                                    <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                      {m.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {apiMessage ? (
                      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-center">
                          <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
                        </div>
                      </div>
                    ) : (
                      <Graph
                        title={titles.firstTitle}
                        labels={firstSectionData.labels}
                        values={firstSectionData.values}
                        showGradient={true}
                        zone={firstGraphZone}
                      />
                    )}
                  </div>

                  {/* Progress Bar */}
                  {showMainMarker && (
                    <div className="flex-1 w-full lg:w-1/2 min-w-0">
                      <ProgressBarSection config={progressBarConfigs[0]} />
                    </div>
                  )}
                </div>
              </div>

              {/* Second Section */}
              <div className="flex flex-col gap-5">
                <div className="pb-5 border-b border-[#E1E6ED]">
                  <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.6px]">
                    {titles.secondTitle}
                  </span>
                </div>

                <div className="flex flex-col lg:flex-row gap-[30px] items-start">
                  {/* Graph */}
                  <div className="flex-1 w-full lg:w-1/2 min-w-0">
                    <div className="mx-[15px] my-4">
                      <div className="flex justify-between gap-3">
                        {/* Weekly/Monthly */}
                        <div className="relative">
                          <div
                            className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                            onClick={() => setSecondShowDropdown(!secondShowDropdown)}
                          >
                            <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                              {secondTimeRange}
                            </span>
                            <IoIosArrowDown className="w-5 h-5" />
                          </div>

                          {secondShowDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                              <div
                                className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleSecondTimeRangeChange("Weekly")}
                              >
                                <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                  Weekly
                                </span>
                              </div>
                              <div
                                className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleSecondTimeRangeChange("Monthly")}
                              >
                                <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                  Monthly
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Month dropdown */}
                        {secondTimeRange === "Monthly" && (
                          <div className="relative">
                            <div
                              className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
                              onClick={() => setSecondMonthDropdown(!secondMonthDropdown)}
                            >
                              <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                {monthOptions.find((m) => m.key === secondSelectedMonth)?.label ||
                                  "Select Month"}
                              </span>
                              <IoIosArrowDown className="w-5 h-5" />
                            </div>

                            {secondMonthDropdown && (
                              <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
                                {monthOptions.map((m) => (
                                  <div
                                    key={m.key}
                                    className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                    onClick={() => {
                                      setSecondSelectedMonth(m.key);
                                      setSecondMonthDropdown(false);
                                    }}
                                  >
                                    <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                      {m.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {apiMessage ? (
                      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-center">
                          <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
                        </div>
                      </div>
                    ) : (
                      <Graph
                        title={titles.secondTitle}
                        labels={secondSectionData.labels}
                        values={secondSectionData.values}
                        showGradient={true}
                        zone={secondGraphZone}
                      />
                    )}
                  </div>

                  {/* Progress Bar */}
                  {showMainMarker && (
                    <div className="flex-1 w-full lg:w-1/2 min-w-0">
                      <ProgressBarSection config={progressBarConfigs[1]} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TrendsComponent);




















// "use client";

// import React, { useMemo, useState, useEffect } from "react";
// import { IoIosArrowDown } from "react-icons/io";
// import Graph from "./graph";
// import { fetchScoreTrend, fetchScoresInsight } from "../services/authService";
// import { useSearchParams } from "next/navigation";
// import { cookieManager } from "../lib/cookies";
// import { useDispatch } from "react-redux";
// import { setScoresInsight } from "../store/scoresInsightSlice";

// function TrendsComponent({ selectedDate, showMainMarker = true, compactGraphs = false }) {
//   const dispatch = useDispatch();
//   const searchParams = useSearchParams();
//   const dieticianData = cookieManager.getJSON("dietician");
//   const dieticianId = dieticianData?.dietician_id;
//   const profileId = searchParams.get("profile_id");

//   const [active, setActive] = useState("Digestive Balance Trend");
//   const [firstTimeRange, setFirstTimeRange] = useState("Weekly");
//   const [secondTimeRange, setSecondTimeRange] = useState("Weekly");
//   const [firstShowDropdown, setFirstShowDropdown] = useState(false);
//   const [secondShowDropdown, setSecondShowDropdown] = useState(false);

//   // Month dropdowns (shown only when Monthly is selected)
//   const [firstSelectedMonth, setFirstSelectedMonth] = useState(null); // "YYYY-MM"
//   const [secondSelectedMonth, setSecondSelectedMonth] = useState(null); // "YYYY-MM"
//   const [firstMonthDropdown, setFirstMonthDropdown] = useState(false);
//   const [secondMonthDropdown, setSecondMonthDropdown] = useState(false);

//   const [graphData, setGraphData] = useState(null);
//   const [scoresInsightData, setScoresInsightData] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [scoresLoading, setScoresLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [apiMessage, setApiMessage] = useState(null);

//   // Function to format date to YYYY-MM-DD
//   const formatDateToYYYYMMDD = (date) => {
//     if (!date) return null;

//     if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

//     const dateObj = new Date(date);
//     if (isNaN(dateObj.getTime())) {
//       console.error("Invalid date:", date);
//       return null;
//     }

//     const year = dateObj.getFullYear();
//     const month = String(dateObj.getMonth() + 1).padStart(2, "0");
//     const day = String(dateObj.getDate()).padStart(2, "0");
//     return `${year}-${month}-${day}`;
//   };

//   // Normalize tests_by_date → { range, data }
//   const normalizeTestsByDate = (testsByDate) => {
//     if (!testsByDate) return null;

//     const dates = Object.keys(testsByDate).sort();
//     if (dates.length === 0) return null;

//     const data = dates.map((date) => {
//       const t = testsByDate[date];
//       const s = t.scores || {};

//       return {
//         date,
//         absorptive_metabolism_score: s.absorptive ?? 0,
//         fermentative_metabolism_score: s.fermentative ?? 0,
//         fat_metabolism_score: s.fat ?? 0,
//         glucose_metabolism_score: s.glucose ?? 0,
//         hepatic_stress_metabolism_score: s.hepatic_stress ?? 0,
//         detoxification_metabolism_score: s.detoxification ?? 0,
//       };
//     });

//     return {
//       range: { start_date: dates[0], end_date: dates[dates.length - 1] },
//       data,
//     };
//   };

//   // Fetch trend data once (per profile)
//   useEffect(() => {
//     const fetchInitialData = async () => {
//       if (!dieticianId || !profileId) return;

//       setLoading(true);
//       setError(null);
//       setApiMessage(null);

//       try {
//         const response = await fetchScoreTrend(dieticianId, profileId);

//         if (response && response.tests_by_date) {
//           const normalized = normalizeTestsByDate(response.tests_by_date);
//           if (normalized) {
//             setGraphData(normalized);
//             setApiMessage(null);
//           } else {
//             setGraphData(null);
//             setApiMessage("No data available");
//           }
//         } else {
//           setGraphData(null);
//           setApiMessage(response?.message || "No data available");
//         }
//       } catch (err) {
//         setError(err.message || "An error occurred");
//         setGraphData(null);
//         setApiMessage(null);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchInitialData();
//   }, [dieticianId, profileId]);

//   // Fetch scores insight when selectedDate changes
//   useEffect(() => {
//     const fetchScoresData = async () => {
//       if (!dieticianId || !profileId || !selectedDate) return;

//       const formattedDate = formatDateToYYYYMMDD(selectedDate);
//       if (!formattedDate) return;

//       setScoresLoading(true);
//       try {
//         const response = await fetchScoresInsight(dieticianId, profileId, formattedDate);

//         if (response?.noData) {
//           setScoresInsightData(null);
//           dispatch(setScoresInsight(null));
//         } else if (response && response.latest_test) {
//           setScoresInsightData(response);
//           dispatch(setScoresInsight(response));
//         } else {
//           setScoresInsightData(null);
//           dispatch(setScoresInsight(null));
//         }
//       } catch (err) {
//         console.error("Error fetching scores insight:", err);
//         setScoresInsightData(null);
//         dispatch(setScoresInsight(null));
//       } finally {
//         setScoresLoading(false);
//       }
//     };

//     fetchScoresData();
//   }, [dieticianId, profileId, selectedDate, dispatch]);

//   // Build months list from graphData.data
//   const monthOptions = useMemo(() => {
//     const list = graphData?.data || [];
//     const map = new Map();

//     list.forEach((item) => {
//       const d = new Date(item.date);
//       if (isNaN(d.getTime())) return;

//       const y = d.getFullYear();
//       const m = String(d.getMonth() + 1).padStart(2, "0");
//       const key = `${y}-${m}`;
//       const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

//       map.set(key, label);
//     });

//     return Array.from(map.entries())
//       .sort((a, b) => a[0].localeCompare(b[0]))
//       .map(([key, label]) => ({ key, label }));
//   }, [graphData]);

//   // Default select latest month once data arrives
//   useEffect(() => {
//     if (!monthOptions.length) return;

//     const latest = monthOptions[monthOptions.length - 1];
//     if (!firstSelectedMonth) setFirstSelectedMonth(latest.key);
//     if (!secondSelectedMonth) setSecondSelectedMonth(latest.key);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [monthOptions]);

 

//   // Active marker
//   const getActiveMarker = () => {
//     switch (active) {
//       case "Digestive Balance Trend":
//         return { name: "Hydrogen", value: scoresInsightData?.latest_test?.ppm?.h2, unit: "ppm" };
//       case "Fuel & Energy Trend":
//         return { name: "Acetone", value: scoresInsightData?.latest_test?.ppm?.acetone, unit: "ppm" };
//       case "Metabolic Recovery Trend":
//         return { name: "Ethanol", value: scoresInsightData?.latest_test?.ppm?.ethanol, unit: "ppm" };
//       default:
//         return { name: "Hydrogen", value: scoresInsightData?.latest_test?.ppm?.h2, unit: "ppm" };
//     }
//   };

//   const activeMarker = getActiveMarker();


//   const getMarkersForScoreType = (scoreType) => {
//     switch (scoreType) {
//       case "absorptive":
//       case "detoxification":
//         return [
//           { position: "0%", label: "0" },
//           { position: "70%", label: "70" },
//           { position: "80%", label: "80" },
//           { position: "100%", label: "100" },
//         ];
//       case "fermentative":
//       case "glucose":
//       case "hepatic_stress":
//         return [
//           { position: "0%", label: "0" },
//           { position: "20%", label: "20" },
//           { position: "30%", label: "30" },
//           { position: "100%", label: "100" },
//         ];
//       case "fat":
//         return [
//           { position: "0%", label: "0" },
//           { position: "70%", label: "70" },
//           { position: "80%", label: "80" },
//           { position: "100%", label: "100" },
//         ];
//       default:
//         return [
//           { position: "0%", label: "0" },
//           { position: "100%", label: "100" },
//         ];
//     }
//   };

//   const getZoneSegmentsForScoreType = (scoreType) => {
//     switch (scoreType) {
//       case "fermentative":
//       case "glucose":
//       case "hepatic_stress":
//         return [
//           { color: "#3FAF58", width: "20%" },
//           { color: "#FFBF2D", width: "10%" },
//           { color: "#E48326", width: "70%" },
//         ];
//       case "absorptive":
//       case "detoxification":
//         return [
//           { color: "#E48326", width: "70%" },
//           { color: "#FFBF2D", width: "30%" },
//           { color: "#3FAF58", width: "20%" },
//         ];
//       case "fat":
//         return [
//           { color: "#E48326", width: "70%" },
//           { color: "#FFBF2D", width: "10%" },
//           { color: "#3FAF58", width: "20%" },
//         ];
//       default:
//         return [{ color: "#E1E6ED", width: "100%" }];
//     }
//   };

//   // Titles
//   const getTitles = () => {
//     switch (active) {
//       case "Digestive Balance Trend":
//         return {
//           firstTitle: "Nutrient Utilization Trend",
//           secondTitle: "Digestive Activity Trend",
//           firstScoreType: "absorptive",
//           secondScoreType: "fermentative",
//         };
//       case "Fuel & Energy Trend":
//         return {
//           firstTitle: "Fuel Utilization Trend",
//           secondTitle: "Energy Source Trend",
//           firstScoreType: "fat",
//           secondScoreType: "glucose",
//         };
//       case "Metabolic Recovery Trend":
//         return {
//           firstTitle: "Recovery Activity Trend",
//           secondTitle: "Metabolic Load Trend",
//           firstScoreType: "detoxification",
//           secondScoreType: "hepatic_stress",
//         };
//       default:
//         return {
//           firstTitle: "Nutrient Utilization Trend",
//           secondTitle: "Digestive Activity Trend",
//           firstScoreType: "absorptive",
//           secondScoreType: "fermentative",
//         };
//     }
//   };

//   const titles = getTitles();

//   const metabolismData =
//   scoresInsightData?.latest_test?.test_json?.Metabolism_Score_Analysis;

// const firstGraphZone =
//   titles.firstTitle === "Nutrient Utilization Trend"
//     ? metabolismData?.Nutrient_Utilization_Trend?.zone
//     : titles.firstTitle === "Fuel Utilization Trend"
//     ? metabolismData?.Fuel_Utilization_Trend?.zone
//     : titles.firstTitle === "Recovery Activity Trend"
//     ? metabolismData?.Recovery_Activity_Trend?.zone
//     : null;

// const secondGraphZone =
//   titles.secondTitle === "Digestive Activity Trend"
//     ? metabolismData?.Digestive_Activity_Trend?.zone
//     : titles.secondTitle === "Energy Source Trend"
//     ? metabolismData?.Energy_Source_Trend?.zone
//     : titles.secondTitle === "Metabolic Load Trend"
//     ? metabolismData?.Metabolic_Load_Trend?.zone
//     : null;


//   // Progress bars: default / no data / actual
//   const getDefaultProgressBarConfigs = () => {
//     return [
//       {
//         percentage: "-",
//         colors: getZoneSegmentsForScoreType(titles.firstScoreType),
//         markers: getMarkersForScoreType(titles.firstScoreType),
//         status: "Optimal",
//         statusColor: "#3FAF58",
//         interpretation: "-",
//         intervention: "-",
//       },
//       {
//         percentage: "-",
//         colors: getZoneSegmentsForScoreType(titles.secondScoreType),
//         markers: getMarkersForScoreType(titles.secondScoreType),
//         status: "Optimal",
//         statusColor: "#3FAF58",
//         interpretation: "-",
//         intervention: "-",
//       },
//     ];
//   };

//   const getNoDataProgressBarConfigs = () => {
//     return [
//       {
//         percentage: 0,
//         colors: [
//           { color: "#E1E6ED", width: "30%" },
//           { color: "#E1E6ED", width: "40%" },
//           { color: "#E1E6ED", width: "30%" },
//         ],
//         markers: [
//           { position: "0%", label: "0" },
//           { position: "30%", label: "60" },
//           { position: "70%", label: "80" },
//           { position: "100%", label: "100" },
//         ],
//         status: "No Data",
//         statusColor: "#A1A1A1",
//         interpretation: "No test data available for the selected date",
//         intervention: "Please select a different date with available test results",
//       },
//       {
//         percentage: 0,
//         colors: [
//           { color: "#E1E6ED", width: "30%" },
//           { color: "#E1E6ED", width: "40%" },
//           { color: "#E1E6ED", width: "30%" },
//         ],
//         markers: [
//           { position: "0%", label: "0" },
//           { position: "30%", label: "60" },
//           { position: "70%", label: "80" },
//           { position: "100%", label: "100" },
//         ],
//         status: "No Data",
//         statusColor: "#A1A1A1",
//         interpretation: "No test data available for the selected date",
//         intervention: "Please select a different date with available test results",
//       },
//     ];
//   };

//   const normalizeZone = (z) => String(z || "").trim().toLowerCase();

// const zoneToColor = (zone) => {
//   const z = normalizeZone(zone);
//   if (z === "optimal") return "#3FAF58";
//   if (z === "moderate") return "#FFBF2D";
//   if (z === "focus") return "#E48326";
//   return "#3FAF58";
// };



//   const getProgressBarConfigs = () => {
//     if (scoresInsightData?.noData) return getNoDataProgressBarConfigs();
//     if (!scoresInsightData || !scoresInsightData.latest_test) return getDefaultProgressBarConfigs();

//     const testJson = scoresInsightData.latest_test.test_json;
//     const scores = scoresInsightData.latest_test.scores;

//     const hasActualData = testJson && testJson.Metabolism_Score_Analysis;
//     const hasOnlyRawData = testJson && testJson.raw;

//     if (hasOnlyRawData) return getNoDataProgressBarConfigs();
//     if (!hasActualData) return getNoDataProgressBarConfigs();

//     const metabolismData = testJson.Metabolism_Score_Analysis;

//     // const getZoneColor = (zone) => {
//     //   switch (zone) {
//     //     case "Optimal":
//     //       return "#3FAF58";
//     //     case "Moderate":
//     //       return "#FFBF2D";
//     //     case "Focus":
//     //       return "#E48326";
//     //     default:
//     //       return "#3FAF58";
//     //   }
//     // };

//     switch (active) {
//       case "Digestive Balance Trend":
//         return [
//           {
//             percentage: scores.absorptive || 0,
//             colors: getZoneSegmentsForScoreType("absorptive"),
//             markers: getMarkersForScoreType("absorptive"),
//             status: metabolismData.Nutrient_Utilization_Trend?.zone || "N/A",
//             statusColor: zoneToColor(metabolismData.Nutrient_Utilization_Trend?.zone),
//             interpretation: metabolismData.Nutrient_Utilization_Trend?.interpretation || "No interpretation available",
//             intervention: metabolismData.Nutrient_Utilization_Trend?.intervention || "No intervention available",
//           },
//           {
//             percentage: scores.fermentative || 0,
//             colors: getZoneSegmentsForScoreType("fermentative"),
//             markers: getMarkersForScoreType("fermentative"),
//             status: metabolismData.Digestive_Activity_Trend?.zone || "N/A",
//             statusColor: zoneToColor(metabolismData.Digestive_Activity_Trend?.zone),
//             interpretation: metabolismData.Digestive_Activity_Trend?.interpretation || "No interpretation available",
//             intervention: metabolismData.Digestive_Activity_Trend?.intervention || "No intervention available",
//           },
//         ];

//       case "Fuel & Energy Trend":
//         return [
//           {
//             percentage: scores.fat || 0,
//             colors: getZoneSegmentsForScoreType("fat"),
//             markers: getMarkersForScoreType("fat"),
//             status: metabolismData.Fuel_Utilization_Trend?.zone || "N/A",
//             statusColor: zoneToColor(metabolismData.Fuel_Utilization_Trend?.zone),
//             interpretation: metabolismData.Fuel_Utilization_Trend?.interpretation || "No interpretation available",
//             intervention: metabolismData.Fuel_Utilization_Trend?.intervention || "No intervention available",
//           },
//           {
//             percentage: scores.glucose || 0,
//             colors: getZoneSegmentsForScoreType("glucose"),
//             markers: getMarkersForScoreType("glucose"),
//             status: metabolismData.Energy_Source_Trend?.zone || "N/A",
//             statusColor: zoneToColor(metabolismData.Energy_Source_Trend?.zone),
//             interpretation: metabolismData.Energy_Source_Trend?.interpretation || "No interpretation available",
//             intervention: metabolismData.Energy_Source_Trend?.intervention || "No intervention available",
//           },
//         ];

//       case "Metabolic Recovery Trend":
//         return [
//           {
//             percentage: scores.detoxification || 0,
//             colors: getZoneSegmentsForScoreType("detoxification"),
//             markers: getMarkersForScoreType("detoxification"),
//             status: metabolismData.Recovery_Activity_Trend?.zone || "N/A",
//             statusColor: zoneToColor(metabolismData.Recovery_Activity_Trend?.zone),
//             interpretation: metabolismData.Recovery_Activity_Trend?.interpretation || "No interpretation available",
//             intervention: metabolismData.Recovery_Activity_Trend?.intervention || "No intervention available",
//           },
//           {
//             percentage: scores.hepatic_stress || 0,
//             colors: getZoneSegmentsForScoreType("hepatic_stress"),
//             markers: getMarkersForScoreType("hepatic_stress"),
//             status: metabolismData.Metabolic_Load_Trend?.zone || "N/A",
//             statusColor: zoneToColor(metabolismData.Metabolic_Load_Trend?.zone),
//             interpretation: metabolismData.Metabolic_Load_Trend?.interpretation || "No interpretation available",
//             intervention: metabolismData.Metabolic_Load_Trend?.intervention || "No intervention available",
//           },
//         ];

//       default:
//         return getDefaultProgressBarConfigs();
//     }
//   };

//   const progressBarConfigs = getProgressBarConfigs();
//   console.log("progressBarConfigs1850:-", progressBarConfigs);


//   const ProgressBarSection = ({ config }) => (
//     <div className="flex flex-col gap-5 w-full lg:w-auto">
//       <div className="flex flex-col gap-[5px] w-full relative">
//         <div className="w-full rounded-[10px] h-[22px] flex gap-0.5 relative items-center">
//           {config.colors.map((colorConfig, index) => (
//             <div
//               key={index}
//               className="h-2.5 rounded-[5px]"
//               style={{
//                 backgroundColor: colorConfig.color,
//                 width: colorConfig.width,
//               }}
//             />
//           ))}
//           <div
//             className="absolute top-1/2 w-1 h-[22px] border-[10px] border-[#252525] rounded-[10px] transform -translate-y-1/2"
//             style={{
//               left:
//                 config.percentage === "-"
//                   ? "0%"
//                   : `${Math.max(0, Math.min(100, Number(config.percentage) || 0))}%`,
//             }}
//           />
//         </div>

//         <div className="relative w-full">
//           {config.markers.map((marker, index) => (
//             <span
//               key={index}
//               className="absolute -translate-x-1/2 text-[8px] text-[#252525] font-normal"
//               style={{ left: marker.position }}
//             >
//               {marker.label}
//             </span>
//           ))}
//         </div>
//       </div>

//       <div className="flex items-center">
//         {/* <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//           {config.percentage === "-" ? "-" : `${Math.floor(Number(config.percentage) || 0)}%`}
//         </p> */}

//         <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//   {config.percentage === "-"
//     ? "-"
//     : `${Number(config.percentage || 0).toFixed(0)}%`}
// </p>


//         <div className="mx-3 h-4 w-px bg-[#252525]"></div>

//         <p className="text-[20px] md:text-[25px] font-semibold" style={{ color: config.statusColor }}>
//           {config.status}
//         </p>
//       </div>

//       <div className="flex flex-col gap-[5px]">
//         <span className="text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
//           Interpretation:
//         </span>
//         <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
//           {config.interpretation}
//         </span>
//       </div>

//       <div className="border-b border-[#E1E6ED]"></div>

//       <div className="flex flex-col gap-[5px]">
//         <span className="text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
//           Intervention:
//         </span>
//         <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px] break-words">
//           {config.intervention}
//         </span>
//       </div>
//     </div>
//   );

//   const formatDateLabel = (dateString) => {
//     try {
//       const date = new Date(dateString);
//       if (isNaN(date.getTime())) return "Invalid Date";
//       const day = String(date.getDate()).padStart(2, "0");
//       const month = date.toLocaleDateString("en-GB", { month: "short" });
//       return `${day} ${month}`;
//     } catch {
//       return "Invalid Date";
//     }
//   };

//   // Monthly aggregation by selected month
//   const aggregateDataByWeek = (data, scoreType, selectedMonthKey) => {
//     if (!data || data.length === 0) return { labels: [], values: [] };

//     let targetMonth, targetYear;

//     if (selectedMonthKey) {
//       const [y, m] = selectedMonthKey.split("-");
//       targetYear = Number(y);
//       targetMonth = Number(m) - 1;
//     } else {
//       const lastDate = new Date(data[data.length - 1].date);
//       targetMonth = lastDate.getMonth();
//       targetYear = lastDate.getFullYear();
//     }

//     const monthData = data.filter((item) => {
//       const d = new Date(item.date);
//       return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
//     });

//     if (monthData.length === 0) return { labels: [], values: [] };

//     const weeklyData = {};

//     const monthShort = (d) => d.toLocaleDateString("en-GB", { month: "short" });

//     const formatDayMonth = (d) => {
//       const day = String(d.getDate()).padStart(2, "0");
//       return `${day} ${monthShort(d)}`;
//     };

//     const getWeekStartMonday = (dateObj) => {
//       const d = new Date(dateObj);
//       const day = d.getDay();
//       const diff = day === 0 ? -6 : 1 - day;
//       d.setDate(d.getDate() + diff);
//       d.setHours(0, 0, 0, 0);
//       return d;
//     };

//     const getWeekEndSunday = (mondayObj) => {
//       const d = new Date(mondayObj);
//       d.setDate(d.getDate() + 6);
//       d.setHours(0, 0, 0, 0);
//       return d;
//     };

//     const getScore = (item) => {
//       switch (scoreType) {
//         case "absorptive":
//           return parseInt(item.absorptive_metabolism_score) || 0;
//         case "fermentative":
//           return parseInt(item.fermentative_metabolism_score) || 0;
//         case "fat":
//           return parseInt(item.fat_metabolism_score) || 0;
//         case "glucose":
//           return parseInt(item.glucose_metabolism_score) || 0;
//         case "detoxification":
//           return parseInt(item.detoxification_metabolism_score) || 0;
//         case "hepatic_stress":
//           return parseInt(item.hepatic_stress_metabolism_score) || 0;
//         default:
//           return 0;
//       }
//     };

//     monthData.forEach((item) => {
//       const dateObj = new Date(item.date);

//       const monday = getWeekStartMonday(dateObj);
//       const sunday = getWeekEndSunday(monday);

//       const monthStart = new Date(targetYear, targetMonth, 1);
//       const monthEnd = new Date(targetYear, targetMonth + 1, 0);

//       const start = monday < monthStart ? monthStart : monday;
//       const end = sunday > monthEnd ? monthEnd : sunday;

//       const weekLabel = `${formatDayMonth(start)} - ${formatDayMonth(end)}`;

//       if (!weeklyData[weekLabel]) weeklyData[weekLabel] = [];
//       weeklyData[weekLabel].push(getScore(item));
//     });

//     const result = { labels: [], values: [] };

//     const sortedLabels = Object.keys(weeklyData).sort((a, b) => {
//       const parseStart = (label) => {
//         const [startPart] = label.split(" - ");
//         const [dd, mon] = startPart.split(" ");
//         const monthIndex = new Date(`${mon} 01, ${targetYear}`).getMonth();
//         return new Date(targetYear, monthIndex, Number(dd));
//       };
//       return parseStart(a) - parseStart(b);
//     });

//     sortedLabels.forEach((label) => {
//       const arr = weeklyData[label];
//       const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length;
//       result.labels.push(label);
//       result.values.push(Math.round(avg));
//     });

//     return result;
//   };

//   // Main data processing for Weekly / Monthly
//   const getProcessedData = (scoreType, timeRange) => {
//     if (!graphData || !graphData.data) return { labels: [], values: [] };

//     const sortedData = [...graphData.data].sort((a, b) => new Date(a.date) - new Date(b.date));

//     if (timeRange === "Weekly") {
//       const last7 = sortedData.slice(-7);

//       const labels = last7.map((item) => formatDateLabel(item.date));
//       const values = last7.map((item) => {
//         switch (scoreType) {
//           case "absorptive":
//             return parseInt(item.absorptive_metabolism_score) || 0;
//           case "fermentative":
//             return parseInt(item.fermentative_metabolism_score) || 0;
//           case "fat":
//             return parseInt(item.fat_metabolism_score) || 0;
//           case "glucose":
//             return parseInt(item.glucose_metabolism_score) || 0;
//           case "detoxification":
//             return parseInt(item.detoxification_metabolism_score) || 0;
//           case "hepatic_stress":
//             return parseInt(item.hepatic_stress_metabolism_score) || 0;
//           default:
//             return 0;
//         }
//       });

//       return { labels, values };
//     }

//     if (timeRange === "Monthly") {
//       const selectedMonthKey =
//         scoreType === titles.firstScoreType ? firstSelectedMonth : secondSelectedMonth;

//       return aggregateDataByWeek(sortedData, scoreType, selectedMonthKey);
//     }

//     return { labels: [], values: [] };
//   };

//   const handleFirstTimeRangeChange = (newRange) => {
//     setFirstTimeRange(newRange);
//     setFirstShowDropdown(false);
//     setFirstMonthDropdown(false);

//     if (newRange === "Weekly") {
//       setFirstSelectedMonth(null);
//     } else if (newRange === "Monthly" && !firstSelectedMonth && monthOptions.length) {
//       setFirstSelectedMonth(monthOptions[monthOptions.length - 1].key);
//     }
//   };

//   const handleSecondTimeRangeChange = (newRange) => {
//     setSecondTimeRange(newRange);
//     setSecondShowDropdown(false);
//     setSecondMonthDropdown(false);

//     if (newRange === "Weekly") {
//       setSecondSelectedMonth(null);
//     } else if (newRange === "Monthly" && !secondSelectedMonth && monthOptions.length) {
//       setSecondSelectedMonth(monthOptions[monthOptions.length - 1].key);
//     }
//   };

// //   const getTabColor = (tabLabel) => {
// //     const metabolismData = scoresInsightData?.latest_test?.test_json?.Metabolism_Score_Analysis;


// //     if (!metabolismData) {
// //       if (tabLabel === "Digestive Balance Trend") return "#E48326";
// //       if (tabLabel === "Fuel & Energy Trend") return "#3FAF58";
// //       if (tabLabel === "Metabolic Recovery Trend") return "#3FAF58";
// //       return "#E1E6ED";
// //     }

// //     let zone1 = "";
// //     let zone2 = "";

// //     switch (tabLabel) {
// //       case "Digestive Balance Trend":
// //         zone1 = metabolismData.Nutrient_Utilization_Trend
// // ?.zone || "";
// //         zone2 = metabolismData.Digestive_Activity_Trend
// // ?.zone || "";
// //         break;
// //       case "Fuel & Energy Trend":
// //         zone1 = metabolismData.Fuel_Utilization_Trend
// // ?.zone || "";
// //         zone2 = metabolismData.Energy_Source_Trend
// // ?.zone || "";
// //         break;
// //       case "Metabolic Recovery Trend":
// //         zone1 = metabolismData.Recovery_Activity_Trend?.zone || "";
// //         zone2 = metabolismData.metabolism_score_summary
// // ?.zone || "";
// //         break;
// //       default:
// //         break;
// //     }

// //     const z1 = zone1.toLowerCase();
// //     const z2 = zone2.toLowerCase();

// //     if (z1 === "Focus" || z2 === "Focus") return "#E48326";
// //     if (z1 === "Moderate" || z2 === "Moderate") return "#FFBF2D";
// //     if (z1 === "Optimal" || z2 === "Optimal") return "#3FAF58";

// //     return "#E1E6ED";
// //   };


// const getTabColor = (tabLabel) => {
//   const metabolismData = scoresInsightData?.latest_test?.test_json?.Metabolism_Score_Analysis;

//   if (!metabolismData) return "#E1E6ED";

//   let zone1 = "";
//   let zone2 = "";

//   switch (tabLabel) {
//     case "Digestive Balance Trend":
//       zone1 = metabolismData.Nutrient_Utilization_Trend?.zone;
//       zone2 = metabolismData.Digestive_Activity_Trend?.zone;
//       break;

//     case "Fuel & Energy Trend":
//       zone1 = metabolismData.Fuel_Utilization_Trend?.zone;
//       zone2 = metabolismData.Energy_Source_Trend?.zone;
//       break;

//     case "Metabolic Recovery Trend":
//       zone1 = metabolismData.Recovery_Activity_Trend?.zone;
//       zone2 = metabolismData.Metabolic_Load_Trend?.zone;
//       break;

//     default:
//       break;
//   }

//   const z1 = normalizeZone(zone1);
//   const z2 = normalizeZone(zone2);

//   if (z1 === "focus" || z2 === "focus") return "#E48326";
//   if (z1 === "moderate" || z2 === "moderate") return "#FFBF2D";
//   if (z1 === "optimal" || z2 === "optimal") return "#3FAF58";

//   return "#E1E6ED";
// };




//   const tabs = [
//     { label: "Digestive Balance Trend" },
//     { label: "Fuel & Energy Trend" },
//     { label: "Metabolic Recovery Trend" },
//   ];

//   const firstSectionData = useMemo(
//     () => getProcessedData(titles.firstScoreType, firstTimeRange),
//     [graphData, titles.firstScoreType, firstTimeRange, firstSelectedMonth, monthOptions]
//   );

//   const secondSectionData = useMemo(
//     () => getProcessedData(titles.secondScoreType, secondTimeRange),
//     [graphData, titles.secondScoreType, secondTimeRange, secondSelectedMonth, monthOptions]
//   );


// const hasTrendData = (graphData?.data?.length || 0) > 0;
// if (!loading && !error && (!hasTrendData || apiMessage)) {
//   return null;
// }


//   if (loading) {
//     return <div className="flex-1 min-w-0 rounded-[15px] mx-2 p-4">Loading graph data...</div>;
//   }

//   if (error) {
//     return (
//       <div className="flex-1 min-w-0 rounded-[15px] mx-2 p-4 text-red-500">
//         Error: {error}
//       </div>
//     );
//   }

//   return (
//     <div className="flex-1 min-w-0 rounded-[15px] mx-2">
//       <div className="mt-[15px] ml-[13px]">
//         <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[0.4px]">
//           Score Analysis
//         </span>
//       </div>

//       <div className="flex flex-col gap-6">
//         {/* Tabs */}
//         <div className="flex w-full gap-6 mt-[18px] border-b border-[#E1E6ED]">
//           {tabs.map((tab) => {
//             const isActive = active === tab.label;
//             return (
//               <button
//                 key={tab.label}
//                 onClick={() => setActive(tab.label)}
//                 className={`flex gap-2.5 items-center pb-[13px] pl-[5px] pr-[25px] cursor-pointer ${
//                   isActive ? "border-b-2 border-[#308BF9]" : ""
//                 }`}
//               >
//                 <span
//                   className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${
//                     isActive ? "text-[#308BF9]" : "text-[#A1A1A1]"
//                   }`}
//                 >
//                   {tab.label}
//                 </span>
//                 <div
//                   className="w-[6px] h-[6px] rounded-full"
//                   style={{ backgroundColor: getTabColor(tab.label) }}
//                 />
//               </button>
//             );
//           })}
//         </div>

//         <div className="flex flex-col gap-9 pt-1.5 pl-[5px] pr-[13px] rounded-[15px]">
//           {/* Main Marker */}
//           {showMainMarker && (
//             <div className="flex flex-col gap-[5px] px-[15px] py-[18px] bg-[#F0F0F0] rounded-[15px]">
//               <span className="text-[#252525] text-[12px] font-semibold leading-[130%] tracking-[-0.24px]">
//                 Main Marker: {activeMarker.name}
//               </span>
//               <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">
//                 {activeMarker.value
//                   ? `${parseFloat(activeMarker.value).toFixed(3)} ${activeMarker.unit}`
//                   : "-"}
//               </span>
//             </div>
//           )}

//           {/* ✅ COMPACT MODE (used in ClientReminder) */}
//           {compactGraphs ? (
//             <div className="mx-[15px] my-4">
//               <div className="flex justify-center items-center gap-6">
//                 {/* LEFT GRAPH */}
//                 <div className="w-[500px] max-w-full flex-none ">
//                   <div className="flex gap-3 mb-3">
//                     {/* Weekly/Monthly */}
//                     <div className="relative">
//                       <div
//                         className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                         onClick={() => setFirstShowDropdown(!firstShowDropdown)}
//                       >
//                         <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                           {firstTimeRange}
//                         </span>
//                         <IoIosArrowDown className="w-5 h-5" />
//                       </div>

//                       {firstShowDropdown && (
//                         <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                           <div
//                             className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                             onClick={() => handleFirstTimeRangeChange("Weekly")}
//                           >
//                             <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                               Weekly
//                             </span>
//                           </div>
//                           <div
//                             className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                             onClick={() => handleFirstTimeRangeChange("Monthly")}
//                           >
//                             <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                               Monthly
//                             </span>
//                           </div>
//                         </div>
//                       )}
//                     </div>

//                     {/* Month dropdown */}
//                     {firstTimeRange === "Monthly" && (
//                       <div className="relative">
//                         <div
//                           className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                           onClick={() => setFirstMonthDropdown(!firstMonthDropdown)}
//                         >
//                           <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                             {monthOptions.find((m) => m.key === firstSelectedMonth)?.label ||
//                               "Select Month"}
//                           </span>
//                           <IoIosArrowDown className="w-5 h-5" />
//                         </div>

//                         {firstMonthDropdown && (
//                           <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                             {monthOptions.map((m) => (
//                               <div
//                                 key={m.key}
//                                 className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                 onClick={() => {
//                                   setFirstSelectedMonth(m.key);
//                                   setFirstMonthDropdown(false);
//                                 }}
//                               >
//                                 <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                   {m.label}
//                                 </span>
//                               </div>
//                             ))}
//                           </div>
//                         )}
//                       </div>
//                     )}
//                   </div>

//                   {apiMessage ? (
//                     <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
//                       <div className="text-center">
//                         <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
//                       </div>
//                     </div>
//                   ) : (
//                     <div className="h-[200px]">
//                     <Graph
//                       title={titles.firstTitle}
//                       labels={firstSectionData.labels}
//                       values={firstSectionData.values}
//                        showGradient={true}
//                         zone={firstGraphZone}
                      
//                     />
//                     </div>
//                   )}
//                 </div>

//                 {/* RIGHT GRAPH */}
//                 <div className="w-[500px] max-w-full flex-none">
//                   <div className="flex gap-3 mb-3 justify-end">
//                     {/* Weekly/Monthly */}
//                     <div className="relative">
//                       <div
//                         className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                         onClick={() => setSecondShowDropdown(!secondShowDropdown)}
//                       >
//                         <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                           {secondTimeRange}
//                         </span>
//                         <IoIosArrowDown className="w-5 h-5" />
//                       </div>

//                       {secondShowDropdown && (
//                         <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                           <div
//                             className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                             onClick={() => handleSecondTimeRangeChange("Weekly")}
//                           >
//                             <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                               Weekly
//                             </span>
//                           </div>
//                           <div
//                             className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                             onClick={() => handleSecondTimeRangeChange("Monthly")}
//                           >
//                             <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                               Monthly
//                             </span>
//                           </div>
//                         </div>
//                       )}
//                     </div>

//                     {/* Month dropdown */}
//                     {secondTimeRange === "Monthly" && (
//                       <div className="relative">
//                         <div
//                           className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                           onClick={() => setSecondMonthDropdown(!secondMonthDropdown)}
//                         >
//                           <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                             {monthOptions.find((m) => m.key === secondSelectedMonth)?.label ||
//                               "Select Month"}
//                           </span>
//                           <IoIosArrowDown className="w-5 h-5" />
//                         </div>

//                         {secondMonthDropdown && (
//                           <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                             {monthOptions.map((m) => (
//                               <div
//                                 key={m.key}
//                                 className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                 onClick={() => {
//                                   setSecondSelectedMonth(m.key);
//                                   setSecondMonthDropdown(false);
//                                 }}
//                               >
//                                 <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                   {m.label}
//                                 </span>
//                               </div>
//                             ))}
//                           </div>
//                         )}
//                       </div>
//                     )}
//                   </div>

//                   {apiMessage ? (
//                     <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
//                       <div className="text-center">
//                         <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
//                       </div>
//                     </div>
//                   ) : (
//                      <div className="h-[200px]">
//                     <Graph
//                       title={titles.secondTitle}
//                       labels={secondSectionData.labels}
//                       values={secondSectionData.values}
//                       showGradient={true}
//                       zone={secondGraphZone}
//                     />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           ) : (
//             /* ✅ NORMAL MODE (your original layout) */
//             <div className="flex flex-col gap-[42px]">
//               {/* First Section */}
//               <div className="flex flex-col gap-5">
//                 <div className="pb-5 border-b border-[#E1E6ED]">
//                   <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.6px]">
//                     {titles.firstTitle}
//                   </span>
//                 </div>

//                 <div className="flex flex-col lg:flex-row gap-[30px] items-start">
//                   {/* Graph */}
//                   <div className="flex-1 w-full lg:w-1/2 min-w-0">
//                     <div className="mx-[15px] my-4">
//                       <div className="flex justify-between gap-3">
//                         {/* Weekly/Monthly */}
//                         <div className="relative">
//                           <div
//                             className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                             onClick={() => setFirstShowDropdown(!firstShowDropdown)}
//                           >
//                             <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                               {firstTimeRange}
//                             </span>
//                             <IoIosArrowDown className="w-5 h-5" />
//                           </div>

//                           {firstShowDropdown && (
//                             <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                               <div
//                                 className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                 onClick={() => handleFirstTimeRangeChange("Weekly")}
//                               >
//                                 <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                   Weekly
//                                 </span>
//                               </div>
//                               <div
//                                 className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                 onClick={() => handleFirstTimeRangeChange("Monthly")}
//                               >
//                                 <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                   Monthly
//                                 </span>
//                               </div>
//                             </div>
//                           )}
//                         </div>

//                         {/* Month dropdown */}
//                         {firstTimeRange === "Monthly" && (
//                           <div className="relative">
//                             <div
//                               className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                               onClick={() => setFirstMonthDropdown(!firstMonthDropdown)}
//                             >
//                               <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                 {monthOptions.find((m) => m.key === firstSelectedMonth)?.label ||
//                                   "Select Month"}
//                               </span>
//                               <IoIosArrowDown className="w-5 h-5" />
//                             </div>

//                             {firstMonthDropdown && (
//                               <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                                 {monthOptions.map((m) => (
//                                   <div
//                                     key={m.key}
//                                     className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                     onClick={() => {
//                                       setFirstSelectedMonth(m.key);
//                                       setFirstMonthDropdown(false);
//                                     }}
//                                   >
//                                     <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                       {m.label}
//                                     </span>
//                                   </div>
//                                 ))}
//                               </div>
//                             )}
//                           </div>
//                         )}
//                       </div>
//                     </div>

//                     {apiMessage ? (
//                       <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
//                         <div className="text-center">
//                           <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
//                         </div>
//                       </div>
//                     ) : (
//                       <Graph
//                         title={titles.firstTitle}
//                         labels={firstSectionData.labels}
//                         values={firstSectionData.values}
//                       />
//                     )}
//                   </div>

//                   {/* Progress Bar */}
//                   {showMainMarker && (
//                     <div className="flex-1 w-full lg:w-1/2 min-w-0">
//                       <ProgressBarSection config={progressBarConfigs[0]} />
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Second Section */}
//               <div className="flex flex-col gap-5">
//                 <div className="pb-5 border-b border-[#E1E6ED]">
//                   <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.6px]">
//                     {titles.secondTitle}
//                   </span>
//                 </div>

//                 <div className="flex flex-col lg:flex-row gap-[30px] items-start">
//                   {/* Graph */}
//                   <div className="flex-1 w-full lg:w-1/2 min-w-0">
//                     <div className="mx-[15px] my-4">
//                       <div className="flex justify-between gap-3">
//                         {/* Weekly/Monthly */}
//                         <div className="relative">
//                           <div
//                             className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                             onClick={() => setSecondShowDropdown(!secondShowDropdown)}
//                           >
//                             <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                               {secondTimeRange}
//                             </span>
//                             <IoIosArrowDown className="w-5 h-5" />
//                           </div>

//                           {secondShowDropdown && (
//                             <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                               <div
//                                 className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                 onClick={() => handleSecondTimeRangeChange("Weekly")}
//                               >
//                                 <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                   Weekly
//                                 </span>
//                               </div>
//                               <div
//                                 className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                 onClick={() => handleSecondTimeRangeChange("Monthly")}
//                               >
//                                 <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                   Monthly
//                                 </span>
//                               </div>
//                             </div>
//                           )}
//                         </div>

//                         {/* Month dropdown */}
//                         {secondTimeRange === "Monthly" && (
//                           <div className="relative">
//                             <div
//                               className="flex gap-6 items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer"
//                               onClick={() => setSecondMonthDropdown(!secondMonthDropdown)}
//                             >
//                               <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                 {monthOptions.find((m) => m.key === secondSelectedMonth)?.label ||
//                                   "Select Month"}
//                               </span>
//                               <IoIosArrowDown className="w-5 h-5" />
//                             </div>

//                             {secondMonthDropdown && (
//                               <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10">
//                                 {monthOptions.map((m) => (
//                                   <div
//                                     key={m.key}
//                                     className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
//                                     onClick={() => {
//                                       setSecondSelectedMonth(m.key);
//                                       setSecondMonthDropdown(false);
//                                     }}
//                                   >
//                                     <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
//                                       {m.label}
//                                     </span>
//                                   </div>
//                                 ))}
//                               </div>
//                             )}
//                           </div>
//                         )}
//                       </div>
//                     </div>

//                     {apiMessage ? (
//                       <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
//                         <div className="text-center">
//                           <p className="text-gray-500 text-lg font-medium">{apiMessage}</p>
//                         </div>
//                       </div>
//                     ) : (
//                       <Graph
//                         title={titles.secondTitle}
//                         labels={secondSectionData.labels}
//                         values={secondSectionData.values}
//                         showGradient={true}
//                       />
//                     )}
//                   </div>

//                   {/* Progress Bar */}
//                   {showMainMarker && (
//                     <div className="flex-1 w-full lg:w-1/2 min-w-0">
//                       <ProgressBarSection config={progressBarConfigs[1]} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default React.memo(TrendsComponent);

