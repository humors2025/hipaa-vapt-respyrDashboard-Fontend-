

"use client";

import React, { useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

/* -----------------------------
   Optional: soft stroke shadow
------------------------------ */
const SoftShadow = {
  id: "softShadow",
  beforeDatasetsDraw(chart, _args, pluginOpts) {
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = pluginOpts?.color ?? "rgba(218,87,71,0.45)";
    ctx.shadowBlur = pluginOpts?.blur ?? 6;
    ctx.shadowOffsetY = 0;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  },
};

ChartJS.register(SoftShadow);

/* -----------------------------
   Utils
------------------------------ */
const hexToRgba = (hex, alpha = 1) => {
  let c = String(hex || "").replace("#", "");
  if (c.length === 3) {
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const num = parseInt(c, 16);
  if (!Number.isFinite(num)) return `rgba(228,131,38,${alpha})`; // fallback
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const normalizeZone = (z) => String(z || "").trim().toLowerCase();

const zoneToColor = (zone, fallback = "#E48326") => {
  const z = normalizeZone(zone);
  if (z === "optimal" || z === "strong") return "#3FAF58";
  if (z === "moderate" || z === "steady") return "#FFBF2D";
  if (z === "focus" || z === "building") return "#E48326";
  return fallback;
};

/**
 * Legacy fallback (only used when zone is NOT provided)
 * Feel free to delete this if you will always pass `zone`.
 */
const getColorByScore = (type, value, fallback = "#E48326", zoneInfo) => {
  // If we have zone information from the API, use it directly
  if (zoneInfo && zoneInfo[type]) {
    const zone = zoneInfo[type].zone?.toLowerCase();
    if (zone === "optimal" || zone === "strong") return "#3FAF58";
    if (zone === "moderate" || zone === "steady") return "#FFBF2D";
    if (zone === "focus" || zone === "building") return "#E48326";
  }

  // Fallback to numeric thresholds if no zone info available
  const v = Number(value) || 0;

  switch (type) {
    case "Nutrient Utilization Trend":
      if (v > 80) return "#3FAF58";      // Optimal
      if (v >= 50) return "#FFBF2D";     // Moderate
      return "#E48326";                   // Focus

    case "Digestive Activity Trend":
      if (v < 30) return "#3FAF58";      // Optimal
      if (v <= 35) return "#FFBF2D";     // Moderate
      return "#E48326";                   // Focus

    case "Fuel Utilization Trend":
      if (v > 80) return "#3FAF58";      // Optimal
      if (v >= 70) return "#FFBF2D";     // Moderate
      return "#E48326";                   // Focus

    case "Energy Source Trend":
      if (v < 40) return "#3FAF58";      // Optimal
      if (v <= 60) return "#FFBF2D";     // Moderate
      return "#E48326";                   // Focus

    case "Metabolic Load Trend":
      // Fix: Match the actual zone definitions from API
      if (v < 30) return "#FFBF2D";      // Moderate (23.56 is Moderate)
      if (v <= 60) return "#E48326";     // Focus
      return "#3FAF58";                   // Optimal

    case "Recovery Activity Trend":
      if (v > 80) return "#3FAF58";      // Optimal
      if (v >= 50) return "#FFBF2D";     // Moderate
      return "#E48326";                   // Focus

    default:
      return fallback;
  }
};

/* -----------------------------
   Component
------------------------------ */
export default function Graph({
  title = "",
  labels = [],
  values = [],
  color = "#E48326",
  showGradient,
  zone, // ✅ NEW: pass API zone ("Optimal" | "Moderate" | "Focus")
}) {
  const isSecondScore =
    title === "Digestive Activity Trend" ||
    title === "Energy Source Trend" ||
    title === "Recovery Activity Trend";

  const shouldShowGradient =
    typeof showGradient === "boolean" ? showGradient : !isSecondScore;

  const lastRawValue = values?.length ? values[values.length - 1] : 0;
  const lastNum =
    typeof lastRawValue === "string" ? Number(lastRawValue) : lastRawValue;

  // ✅ Priority: zone color (from API) > legacy score-threshold color
  const chosenColor = zone
    ? zoneToColor(zone, color)
    : getColorByScore(title, lastNum, color);

  // ✅ convert values once (stable array for chart)
  const numericValues = useMemo(() => {
    return (values || []).map((v) => {
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : 0;
    });
  }, [values]);

  // ✅ Keep a gradient cache so it doesn't recreate every render
  const gradientRef = useRef(null);
  const gradientKeyRef = useRef("");

  const data = useMemo(() => {
    return {
      labels,
      datasets: [
        {
          label: "Score",
          data: numericValues,
          borderColor: chosenColor,
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointHitRadius: 8,
          pointBackgroundColor: chosenColor,
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 1.5,
          tension: 0.45,
          fill: true,

          // temporary fallback until chartArea exists
          backgroundColor: shouldShowGradient
            ? hexToRgba(chosenColor, 0.15)
            : "rgba(0,0,0,0)",
        },
      ],
    };
  }, [labels, numericValues, chosenColor, shouldShowGradient]);

  // ✅ Plugin to set gradient ONLY when chartArea available, and cache it
  const gradientPlugin = useMemo(() => {
    return {
      id: "stableGradientFill",
      beforeDatasetsDraw(chart) {
        if (!shouldShowGradient) return;

        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        const key = `${chartArea.top}-${chartArea.bottom}-${chosenColor}`;
        if (gradientKeyRef.current !== key) {
          const g = ctx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom
          );
          g.addColorStop(0, hexToRgba(chosenColor, 0.3));
          g.addColorStop(1, hexToRgba(chosenColor, 0));
          gradientRef.current = g;
          gradientKeyRef.current = key;
        }

        // set it on dataset (no re-render required)
        const ds = chart.data.datasets?.[0];
        if (ds) ds.backgroundColor = gradientRef.current;
      },
    };
  }, [chosenColor, shouldShowGradient]);

  // ✅ Memoize options so it doesn't become "new object" each render
  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,

      // no animation
      animation: false,
      animations: {
        colors: false,
        x: { duration: 0 },
        y: { duration: 0 },
        tension: { duration: 0 },
      },
      transitions: {
        active: { animation: { duration: 0 } },
      },

      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          enabled: true,
          intersect: false,
          mode: "index",
          callbacks: {
            title(items) {
              if (!items?.length) return "";
              const idx = items[0].dataIndex;
              return labels[idx] || "";
            },
            label(context) {
              const value = context.parsed.y ?? "";
              return `Score: ${value}`;
            },
          },
        },

        // you can set blur=0 to keep it crisp
        softShadow: { color: "rgba(218,87,71,0.45)", blur: 0 },
      },

      elements: {
        line: {
          borderJoinStyle: "round",
          borderCapStyle: "round",
        },
      },

      layout: { padding: { top: 8 } },

      scales: {
        y: {
          min: 0,
          max: 100,
          reverse: isSecondScore,
          ticks: {
            stepSize: 20,
            color: "#A1A1A1",
            font: { size: 10 },
          },
          grid: { display: false },
          border: { display: true, color: "#D9D9D9" },
        },
        x: {
          ticks: {
            color: "#A1A1A1",
            font: { size: 10 },
            callback(value) {
              const label = this.getLabelForValue(value);
              const [d, m] = String(label).split(" ");
              return [d ?? "", m ?? ""];
            },
          },
          grid: { display: true },
          border: { display: true, color: "#D9D9D9" },
        },
      },
    };
  }, [labels, isSecondScore]);

  return (
    <div className="w-full h-full">
      <Line data={data} options={options} plugins={[gradientPlugin]} />
    </div>
  );
}


