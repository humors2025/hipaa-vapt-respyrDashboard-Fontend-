"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { fetchWeightTracking } from "../services/authService";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

const RANGES = ["1W", "1M", "3M", "All"];

const RANGE_DAYS = { "1W": 7, "1M": 30, "3M": 90, All: Infinity };

const UNITS = ["kg", "lbs"];

const KG_TO_LBS = 2.20462;

// Countries where body weight is customarily shown in pounds
// (USA, Liberia, Myanmar). Everyone else defaults to kg.
const LBS_COUNTRIES = ["US", "LR", "MM"];

const UNIT_STORAGE_KEY = "weight_display_unit";

// Best-effort country detection from the browser locale, e.g. "en-US" -> "US",
// "hi-IN" -> "IN". Returns "kg" when the country can't be determined.
const detectUnitFromCountry = () => {
  try {
    const locales =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
    for (const locale of locales) {
      const country = new Intl.Locale(locale).region;
      if (country) return LBS_COUNTRIES.includes(country) ? "lbs" : "kg";
    }
  } catch {
    // ignore — fall through to kg
  }
  return "kg";
};

// Target BMI used to derive a goal weight from the client's height.
// 21.5 sits in the healthy BMI range (18.5–24.9).
const TARGET_BMI = 21.5;

// goal weight (kg) = target BMI × height(m)², rounded to 1 decimal.
const goalWeightFromHeight = (heightCm) => {
  const cm = Number(heightCm);
  if (!cm || Number.isNaN(cm) || cm <= 0) return null;
  const m = cm / 100;
  return Number((TARGET_BMI * m * m).toFixed(1));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-07-08" -> "Jul 8"
const formatLogDate = (logDate) => {
  if (!logDate) return "";
  const [y, m, d] = logDate.split("-");
  const monthIdx = Number(m) - 1;
  if (Number.isNaN(monthIdx) || !MONTHS[monthIdx]) return logDate;
  return `${MONTHS[monthIdx]} ${Number(d)}`;
};

// "fat_loss" -> "Fat Loss"
const formatFitnessGoal = (goal) => {
  if (!goal || typeof goal !== "string") return null;
  return goal
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// Normalise raw API logs into chronological (oldest -> newest) points with
// deltas relative to the previous weigh-in.
const normaliseLogs = (rawLogs) => {
  if (!Array.isArray(rawLogs)) return [];

  const chronological = [...rawLogs]
    .map((log) => ({
      weight: Number(log.weight_kg),
      logDate: log.log_date,
      createdAt: log.created_at || `${log.log_date} ${log.log_time || ""}`.trim(),
    }))
    .filter((p) => !Number.isNaN(p.weight))
    // created_at is "YYYY-MM-DD HH:mm:ss" -> lexical sort is chronological
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return chronological.map((point, i) => ({
    ...point,
    label: formatLogDate(point.logDate),
    delta: i === 0 ? 0 : Number((point.weight - chronological[i - 1].weight).toFixed(2)),
  }));
};

export default function WeightTrackingTab({ profileData, profileId, isActive }) {
  const [range, setRange] = useState("1M");
  // Display unit only — all data stays in kg internally and is converted on render.
  const [unit, setUnit] = useState("kg");

  // Default the unit from the viewer's country (browser locale): USA -> lbs,
  // India (and most others) -> kg. A manual switch is remembered and wins over
  // the detected default. Runs in an effect so SSR/hydration always renders "kg".
  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem(UNIT_STORAGE_KEY);
    } catch {
      // storage unavailable — fall back to detection
    }
    setUnit(UNITS.includes(stored) ? stored : detectUnitFromCountry());
  }, []);

  const changeUnit = (u) => {
    setUnit(u);
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, u);
    } catch {
      // storage unavailable — the choice just won't persist
    }
  };
  // Which tile's "how is this calculated" panel is open: "goal" | "progress" | null
  const [infoSection, setInfoSection] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Super-admin-only metrics returned alongside the weight logs.
  const [metabolismScores, setMetabolismScores] = useState({}); // date -> score
  const [metabolismScore, setMetabolismScore] = useState(null); // latest score
  const [fitnessGoal, setFitnessGoal] = useState(null);
  // Top-level values returned by the weight-tracking API.
  const [apiCurrentWeight, setApiCurrentWeight] = useState(null);
  const [apiTargetWeight, setApiTargetWeight] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  // Tracked in a ref (not state) so marking it doesn't retrigger this effect.
  const loadedForRef = useRef(null);

  useEffect(() => {
    const token = cookieManager.get("access_token");
    const decoded = token ? decodeJwt(token) : null;
    setIsSuperAdmin(decoded?.role === "super_admin");
  }, []);

  useEffect(() => {
    // Lazy-load: only fetch once the Weight Tracking tab is actually opened,
    // and refetch when the viewed client (profileId) changes.
    if (!profileId || !isActive || loadedForRef.current === profileId) return;

    let cancelled = false;
    let completed = false;
    loadedForRef.current = profileId;
    setLoading(true);
    setError(null);

    fetchWeightTracking(profileId)
      .then((res) => {
        if (cancelled) return;
        setLogs(normaliseLogs(res?.data));
        const scores = {};
        if (Array.isArray(res?.metabolism_scores)) {
          for (const s of res.metabolism_scores) {
            const value = Number(s?.score);
            if (s?.date && !Number.isNaN(value)) scores[s.date] = value;
          }
        }
        setMetabolismScores(scores);
        setMetabolismScore(
          typeof res?.metabolism_score === "number" ? res.metabolism_score : null
        );
        setFitnessGoal(res?.fitness_goal ?? null);
        const cw = Number(res?.current_weight);
        setApiCurrentWeight(Number.isFinite(cw) ? cw : null);
        const tw = Number(res?.target_weight);
        setApiTargetWeight(Number.isFinite(tw) ? tw : null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Prefer the API's human-readable message. err.message can be the
        // string "[object Object]" when the API's `error` field is an object
        // (e.g. { code: "NOT_FOUND" }), because the shared fetcher builds the
        // Error from data.error first. The fetcher attaches the full response
        // as err.data, so read the real message from there.
        const apiMessage =
          typeof err?.data?.message === "string" && err.data.message.trim()
            ? err.data.message
            : null;
        const plainMessage =
          typeof err?.message === "string" && err.message !== "[object Object]"
            ? err.message
            : null;
        setError(apiMessage || plainMessage || "Failed to load weight logs");
        setLogs([]);
        setMetabolismScores({});
        setMetabolismScore(null);
        setFitnessGoal(null);
        setApiCurrentWeight(null);
        setApiTargetWeight(null);
      })
      .finally(() => {
        completed = true;
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // If we bailed before the request finished, allow a refetch next time
      // the tab is reopened for this client.
      if (!completed) loadedForRef.current = null;
    };
  }, [profileId, isActive]);

  // Points filtered to the selected time range (relative to the latest weigh-in).
  const rangedLogs = useMemo(() => {
    if (logs.length === 0) return [];
    const days = RANGE_DAYS[range] ?? Infinity;
    if (days === Infinity) return logs;

    const latest = new Date(logs[logs.length - 1].logDate);
    const cutoff = new Date(latest);
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = logs.filter((p) => new Date(p.logDate) >= cutoff);
    return filtered.length > 0 ? filtered : logs;
  }, [logs, range]);

  const hasData = logs.length > 0;

  // Current weight comes from the API's top-level current_weight; falls back
  // to the latest weigh-in if the API doesn't provide it.
  const currentWeight =
    apiCurrentWeight != null ? apiCurrentWeight : hasData ? logs[logs.length - 1].weight : null;
  const startingWeight = hasData ? logs[0].weight : null;

  // Goal weight comes from the API's top-level target_weight; falls back to an
  // explicit goal_weight on the profile, then to the BMI-derived value
  // (target BMI × height², height from profile_details.height in cm).
  const heightCm = profileData?.profile_details?.height ?? profileData?.height;
  const goalWeight =
    apiTargetWeight != null
      ? apiTargetWeight
      : profileData?.goal_weight != null
      ? Number(profileData.goal_weight)
      : goalWeightFromHeight(heightCm);

  // Overall progress toward the ideal (goal) weight = the fraction of the
  // original gap that has been closed, measured from where the client is NOW.
  // Works for both directions (loss and gain). Overshooting the goal reopens
  // the gap (currentGap grows again), so progress falls back down instead of
  // staying pinned at 100% — the client still has to move back toward ideal.
  const totalGap =
    goalWeight != null && startingWeight != null ? Math.abs(startingWeight - goalWeight) : 0;
  const currentGap =
    goalWeight != null && currentWeight != null ? Math.abs(currentWeight - goalWeight) : 0;
  const progress =
    totalGap > 0 ? Math.max(0, Math.min(100, Math.round((1 - currentGap / totalGap) * 100))) : 0;
  // Reached once the client is essentially at the ideal weight (within 0.5 kg).
  const reachedGoal = goalWeight != null && currentWeight != null && currentGap <= 0.5;
  const remaining = currentWeight != null && goalWeight != null ? currentGap.toFixed(1) : null;
  // Most recent change between the last two weigh-ins.
  const weeklyChange = hasData ? logs[logs.length - 1].delta : 0;

  const isKg = unit === "kg";
  // kg -> selected display unit (raw number).
  const toUnit = (kg) => (kg == null ? null : isKg ? kg : kg * KG_TO_LBS);
  // kg -> whole number in the selected display unit.
  const fmtWeight = (kg) => (kg == null ? null : Math.round(toUnit(kg)));
  const fmtDelta = (kg) => Math.round(Math.abs(isKg ? kg : kg * KG_TO_LBS));

  const startingDateLabel = hasData ? formatLogDate(logs[0].logDate) : "—";

  // Newest first for the "Recent entries" list.
  const recentEntries = useMemo(() => [...logs].reverse(), [logs]);

  const hasScores = isSuperAdmin && Object.keys(metabolismScores).length > 0;

  const chartData = {
    labels: rangedLogs.map((p) => p.label),
    datasets: [
      {
        label: "Weight",
        data: rangedLogs.map((p) => toUnit(p.weight)),
        borderColor: "#308BF9",
        backgroundColor: "rgba(48,139,249,0.06)",
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "#308BF9",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
      ...(goalWeight != null
        ? [
            {
              label: "Goal",
              data: Array(rangedLogs.length).fill(toUnit(goalWeight)),
              borderColor: "rgba(48,139,249,0.25)",
              borderDash: [6, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              pointHoverRadius: 0,
              fill: false,
            },
          ]
        : []),
      // Super-admin only — metabolism score history (0–100, unitless) matched
      // to the weigh-in dates. Drawn fully invisible (no line, no points): the
      // score surfaces only in the shared hover tooltip.
      ...(hasScores
        ? [
            {
              label: "Metabolism Score",
              data: rangedLogs.map((p) => metabolismScores[p.logDate] ?? null),
              yAxisID: "y1",
              showLine: false,
              pointRadius: 0,
              pointHoverRadius: 0,
              fill: false,
            },
          ]
        : []),
    ],
  };

  // Dynamic y-axis bounds with a little padding around the observed range,
  // computed in the currently displayed unit.
  const yBounds = useMemo(() => {
    const factor = unit === "kg" ? 1 : KG_TO_LBS;
    const values = rangedLogs.map((p) => p.weight * factor);
    if (goalWeight != null) values.push(goalWeight * factor);
    if (values.length === 0) return { min: undefined, max: undefined };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(2, Math.round((max - min) * 0.15));
    return { min: Math.max(0, Math.floor(min - pad)), max: Math.ceil(max + pad) };
  }, [rangedLogs, goalWeight, unit]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 4, bottom: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "#252525",
        titleColor: "#fff",
        bodyColor: "#fff",
        titleFont: { family: "Poppins, sans-serif", weight: "600", size: 12 },
        bodyFont: { family: "Poppins, sans-serif", size: 12 },
        padding: 10,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) =>
            ctx.dataset.label === "Metabolism Score"
              ? `Metabolism Score: ${Math.round(ctx.parsed.y)}`
              : `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)} ${unit}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "#A1A1A1",
          font: { family: "Poppins, sans-serif", size: 10, weight: "400" },
          maxRotation: 0,
        },
      },
      y: {
        min: yBounds.min,
        max: yBounds.max,
        grid: { color: "#F0F0F0", lineWidth: 0.8 },
        border: { display: false },
        ticks: {
          color: "#A1A1A1",
          font: { family: "Poppins, sans-serif", size: 10, weight: "400" },
          callback: (v) => `${v}`,
        },
      },
      // Hidden 0–100 scale for the metabolism score (super admin only) — the
      // score line still uses it for positioning, but no axis is rendered.
      ...(hasScores
        ? {
            y1: {
              display: false,
              min: 0,
              max: 100,
            },
          }
        : {}),
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
  };

  const isLoss = weeklyChange <= 0;

  const statTiles = [
    {
      label: "Current weight",
      value: currentWeight != null ? fmtWeight(currentWeight) : "—",
      unit,
      accent: null,
      sub:
        weeklyChange !== 0 ? (
          <div className="flex items-center gap-1 mt-2">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isLoss ? "#16a34a" : "#dc2626"}
              strokeWidth="2.5"
            >
              {isLoss ? (
                <>
                  <polyline points="7 7 17 17" />
                  <polyline points="17 7 17 17 7 17" />
                </>
              ) : (
                <>
                  <polyline points="17 17 7 7" />
                  <polyline points="7 17 7 7 17 7" />
                </>
              )}
            </svg>
            <span
              className={`text-[10px] font-semibold tracking-[-0.2px] ${
                isLoss ? "text-[#16a34a]" : "text-[#dc2626]"
              }`}
            >
              {fmtDelta(weeklyChange)} {unit} last log
            </span>
          </div>
        ) : (
          <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">No change</p>
        ),
      highlight: true,
    },
    {
      label: "Starting Weight",
      value: startingWeight != null ? fmtWeight(startingWeight) : "—",
      unit,
      sub: <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">{startingDateLabel}</p>,
    },
    {
      label: "Goal",
      info: "goal",
      value: goalWeight != null ? fmtWeight(goalWeight) : "—",
      unit,
      sub: (
        <p
          className={`text-[10px] font-semibold tracking-[-0.2px] mt-2 ${
            reachedGoal ? "text-[#16a34a]" : "text-[#A1A1A1]"
          }`}
        >
          {remaining == null ? "Not set" : reachedGoal ? "Goal reached" : `${fmtWeight(currentGap)} ${unit} to go`}
        </p>
      ),
    },
    {
      label: "Progress",
      info: "progress",
      value: goalWeight != null ? progress : "—",
      unit: goalWeight != null ? "%" : "",
      sub: (
        <div className="mt-3 h-[6px] bg-white rounded-[10px] overflow-hidden" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)" }}>
          <div
            className="h-full rounded-[10px] transition-all duration-700 ease-out"
            style={{
              width: `${goalWeight != null ? progress : 0}%`,
              background: "linear-gradient(90deg, #308BF9, #60a5fa)",
            }}
          />
        </div>
      ),
    },
    // Visible to super admins only — sourced from the weight-tracking API.
    ...(isSuperAdmin
      ? [
          {
            label: "Metabolism Score",
            value: metabolismScore != null ? Math.round(metabolismScore) : "—",
            unit: "",
            sub: (
              <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">
                Goal:{" "}
                <span className="text-[#535359]">
                  {formatFitnessGoal(fitnessGoal) ?? "—"}
                </span>
              </p>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4 mt-[16px] mb-[20px] mx-[5px]">
      {/* Unit switch — applies to every value on this tab */}
      <div className="flex justify-end">
        <div className="flex gap-1 bg-[#F5F7FA] rounded-[40px] p-[3px]">
          {UNITS.map((u) => (
            <button
              key={u}
              onClick={() => changeUnit(u)}
              className={`px-3 py-[4px] rounded-[40px] text-[11px] font-semibold tracking-[-0.22px] transition-all duration-200 cursor-pointer ${
                unit === u
                  ? "bg-[#308BF9] text-white shadow-sm"
                  : "text-[#535359] hover:text-[#252525] hover:bg-[#e8eaed]"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div
        className={`grid gap-3 ${
          statTiles.length > 4
            ? "grid-cols-5 max-2xl:grid-cols-3"
            : "grid-cols-4 max-2xl:grid-cols-2"
        }`}
      >
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-[12px] p-4 transition-all duration-200 cursor-default group ${
              tile.highlight
                ? "bg-[#EFF6FF] border border-[#308BF9]/15 hover:border-[#308BF9]/30"
                : "bg-[#F5F7FA] border border-transparent hover:border-[#E1E6ED]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#A1A1A1] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] uppercase">
                {tile.label}
              </p>
              {tile.info && (
                <button
                  onClick={() => setInfoSection((prev) => (prev === tile.info ? null : tile.info))}
                  aria-label={`How ${tile.label} is calculated`}
                  className="flex-shrink-0 text-[#308BF9] cursor-pointer transition-opacity"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-[#252525] text-[24px] font-semibold tracking-[-1.2px] leading-none">
              {tile.value}
              <span className="text-[#535359] text-[13px] font-semibold tracking-[-0.26px] ml-1">
                {tile.unit}
              </span>
            </p>
            {tile.sub}
          </div>
        ))}
      </div>

      {/* Per-tile "how is this calculated" explanation, toggled from the Goal / Progress info icons */}
      {infoSection === "goal" && (
        <div className="rounded-[12px] border border-[#E1E6ED] bg-[#F9FAFB] p-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px]">
              How the goal (ideal) weight is calculated
            </p>
            <button
              onClick={() => setInfoSection(null)}
              aria-label="Close"
              className="text-[#A1A1A1] hover:text-[#252525] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px]">
            Derived from the client&apos;s height using a target BMI of{" "}
            <span className="font-semibold text-[#252525]">{TARGET_BMI}</span> (the middle of the
            healthy range 18.5–24.9):
          </p>
          <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px] mt-1">
            Goal weight (kg) = Target BMI × (height in cm ÷ 100)²
          </p>
          <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2">
            {heightCm ? (
              <>
                {TARGET_BMI} × ({heightCm} ÷ 100)² ={" "}
                <span className="font-semibold">{goalWeight} kg</span>
                {!isKg && <> ({fmtWeight(goalWeight)} lbs)</>}
              </>
            ) : (
              "Height isn't available for this client, so an ideal weight can't be derived."
            )}
          </div>
        </div>
      )}

      {infoSection === "progress" && (
        <div className="rounded-[12px] border border-[#E1E6ED] bg-[#F9FAFB] p-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px]">
              How progress is calculated
            </p>
            <button
              onClick={() => setInfoSection(null)}
              aria-label="Close"
              className="text-[#A1A1A1] hover:text-[#252525] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px]">
            The share of the original gap to the ideal weight that has been closed, measured from the
            client&apos;s current weight:
          </p>
          <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px] mt-1">
            Progress = (1 − |current − goal| ÷ |starting − goal|) × 100
          </p>
          {startingWeight != null && currentWeight != null && goalWeight != null ? (
            <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2 leading-[175%]">
              <div>
                Starting <span className="font-semibold">{fmtWeight(startingWeight)} {unit}</span> ·
                Current <span className="font-semibold">{fmtWeight(currentWeight)} {unit}</span> ·
                Goal <span className="font-semibold">{fmtWeight(goalWeight)} {unit}</span>
              </div>
              <div>
                (1 − {fmtWeight(currentGap)} ÷ {fmtWeight(totalGap)}) × 100 ={" "}
                <span className="font-semibold">{progress}%</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2">
              Not enough data yet to calculate progress.
            </div>
          )}
          <p className="text-[#A1A1A1] text-[11px] leading-[160%] tracking-[-0.22px] mt-2">
            If the client moves past the ideal weight, the gap opens up again and progress falls —
            because they now need to move back toward the ideal.
          </p>
        </div>
      )}

      {/* Chart + Recent entries side by side */}
      <div className="flex max-2xl:flex-col gap-4 2xl:h-[320px]">
        {/* Chart */}
        <div className="flex-[3] max-2xl:flex-none max-2xl:h-[320px] border border-[#E1E6ED] rounded-[12px] p-5 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#252525] text-[16px] font-semibold leading-[110%] tracking-[-0.64px]">
              Weight trend
            </p>
            <div className="flex gap-1 bg-[#F5F7FA] rounded-[40px] p-[3px]">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-[4px] rounded-[40px] text-[11px] font-semibold tracking-[-0.22px] transition-all duration-200 ${
                    range === r
                      ? "bg-[#308BF9] text-white shadow-sm"
                      : "text-[#535359] hover:text-[#252525] hover:bg-[#e8eaed]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
                Loading weight data…
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px] text-center px-4">
                {error}
              </div>
            ) : !hasData ? (
              <div className="absolute inset-0 flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
                No weight logs yet
              </div>
            ) : (
              <Line data={chartData} options={chartOptions} />
            )}
          </div>

          <div className="flex gap-5 mt-2 pt-2 border-t border-[#F0F0F0]">
            <span className="flex items-center gap-1.5 text-[#535359] text-[11px] tracking-[-0.22px]">
              <span className="w-3.5 h-[2.5px] rounded-sm bg-[#308BF9]" />
              Actual
            </span>
            {goalWeight != null && (
              <span className="flex items-center gap-1.5 text-[#535359] text-[11px] tracking-[-0.22px]">
                <span className="w-3.5 h-0 rounded-sm" style={{ borderTop: "1.5px dashed rgba(48,139,249,0.4)" }} />
                Goal ({fmtWeight(goalWeight)} {unit})
              </span>
            )}
          </div>
        </div>

        {/* Recent entries */}
        <div className="flex-[2] max-2xl:flex-none max-2xl:h-[300px] flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[#252525] text-[16px] font-semibold leading-[110%] tracking-[-0.64px]">
              Recent entries
            </p>
            <span className="text-[#A1A1A1] text-[11px] font-semibold tracking-[-0.22px]">
              {recentEntries.length} logs
            </span>
          </div>

          <div className="border border-[#E1E6ED] rounded-[12px] overflow-hidden flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
                Loading…
              </div>
            ) : recentEntries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
                No entries
              </div>
            ) : (
              recentEntries.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center px-4 py-[10px] hover:bg-[#F9FAFB] transition-colors ${
                    i < recentEntries.length - 1 ? "border-b border-[#F0F0F0]" : ""
                  }`}
                >
                  <span className="flex-1 text-[#535359] text-[12px] tracking-[-0.24px] whitespace-nowrap">
                    {entry.label}
                  </span>
                  <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] mr-3">
                    {fmtWeight(entry.weight)}
                    <span className="text-[#A1A1A1] font-normal ml-0.5">{unit}</span>
                  </span>
                  {entry.delta !== 0 && (
                    <span
                      className={`text-[10px] font-semibold tracking-[-0.2px] flex items-center gap-[2px] px-[6px] py-[2px] rounded-[8px] ${
                        entry.delta < 0
                          ? "text-[#16a34a] bg-[#f0fdf4]"
                          : "text-[#dc2626] bg-[#fef2f2]"
                      }`}
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {entry.delta < 0 ? (
                          <>
                            <polyline points="7 7 17 17" />
                            <polyline points="17 7 17 17 7 17" />
                          </>
                        ) : (
                          <>
                            <polyline points="17 17 7 7" />
                            <polyline points="7 17 7 7 17 7" />
                          </>
                        )}
                      </svg>
                      {fmtDelta(entry.delta)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Info note — inline subtle */}
      <div className="flex items-center gap-2 px-1">
        <svg className="flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p className="text-[#A1A1A1] text-[11px] tracking-[-0.22px]">
          Weight data syncs from the client&apos;s Respyr app. Focus on weekly averages over individual weigh-ins.
        </p>
      </div>
    </div>
  );
}









// "use client";
// import { useState, useEffect, useMemo, useRef } from "react";
// import { Line } from "react-chartjs-2";
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Filler,
//   Tooltip,
// } from "chart.js";
// import { fetchWeightTracking } from "../services/authService";
// import { cookieManager } from "../lib/cookies";

// function decodeJwt(token) {
//   try {
//     const payload = token.split(".")[1];
//     const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
//     const jsonPayload = decodeURIComponent(
//       atob(base64)
//         .split("")
//         .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
//         .join("")
//     );
//     return JSON.parse(jsonPayload);
//   } catch {
//     return null;
//   }
// }

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Filler,
//   Tooltip
// );

// const RANGES = ["1W", "1M", "3M", "All"];

// const RANGE_DAYS = { "1W": 7, "1M": 30, "3M": 90, All: Infinity };

// const UNITS = ["kg", "lbs"];

// const KG_TO_LBS = 2.20462;

// // Countries where body weight is customarily shown in pounds
// // (USA, Liberia, Myanmar). Everyone else defaults to kg.
// const LBS_COUNTRIES = ["US", "LR", "MM"];

// const UNIT_STORAGE_KEY = "weight_display_unit";

// // Best-effort country detection from the browser locale, e.g. "en-US" -> "US",
// // "hi-IN" -> "IN". Returns "kg" when the country can't be determined.
// const detectUnitFromCountry = () => {
//   try {
//     const locales =
//       navigator.languages && navigator.languages.length
//         ? navigator.languages
//         : [navigator.language];
//     for (const locale of locales) {
//       const country = new Intl.Locale(locale).region;
//       if (country) return LBS_COUNTRIES.includes(country) ? "lbs" : "kg";
//     }
//   } catch {
//     // ignore — fall through to kg
//   }
//   return "kg";
// };

// // Target BMI used to derive a goal weight from the client's height.
// // 21.5 sits in the healthy BMI range (18.5–24.9).
// const TARGET_BMI = 21.5;

// // goal weight (kg) = target BMI × height(m)², rounded to 1 decimal.
// const goalWeightFromHeight = (heightCm) => {
//   const cm = Number(heightCm);
//   if (!cm || Number.isNaN(cm) || cm <= 0) return null;
//   const m = cm / 100;
//   return Number((TARGET_BMI * m * m).toFixed(1));
// };

// const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// // "2026-07-08" -> "Jul 8"
// const formatLogDate = (logDate) => {
//   if (!logDate) return "";
//   const [y, m, d] = logDate.split("-");
//   const monthIdx = Number(m) - 1;
//   if (Number.isNaN(monthIdx) || !MONTHS[monthIdx]) return logDate;
//   return `${MONTHS[monthIdx]} ${Number(d)}`;
// };

// // "fat_loss" -> "Fat Loss"
// const formatFitnessGoal = (goal) => {
//   if (!goal || typeof goal !== "string") return null;
//   return goal
//     .split("_")
//     .filter(Boolean)
//     .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
//     .join(" ");
// };

// // Normalise raw API logs into chronological (oldest -> newest) points with
// // deltas relative to the previous weigh-in.
// const normaliseLogs = (rawLogs) => {
//   if (!Array.isArray(rawLogs)) return [];

//   const chronological = [...rawLogs]
//     .map((log) => ({
//       weight: Number(log.weight_kg),
//       logDate: log.log_date,
//       createdAt: log.created_at || `${log.log_date} ${log.log_time || ""}`.trim(),
//     }))
//     .filter((p) => !Number.isNaN(p.weight))
//     // created_at is "YYYY-MM-DD HH:mm:ss" -> lexical sort is chronological
//     .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

//   return chronological.map((point, i) => ({
//     ...point,
//     label: formatLogDate(point.logDate),
//     delta: i === 0 ? 0 : Number((point.weight - chronological[i - 1].weight).toFixed(2)),
//   }));
// };

// export default function WeightTrackingTab({ profileData, profileId, isActive }) {
//   const [range, setRange] = useState("1M");
//   // Display unit only — all data stays in kg internally and is converted on render.
//   const [unit, setUnit] = useState("kg");

//   // Default the unit from the viewer's country (browser locale): USA -> lbs,
//   // India (and most others) -> kg. A manual switch is remembered and wins over
//   // the detected default. Runs in an effect so SSR/hydration always renders "kg".
//   useEffect(() => {
//     let stored = null;
//     try {
//       stored = localStorage.getItem(UNIT_STORAGE_KEY);
//     } catch {
//       // storage unavailable — fall back to detection
//     }
//     setUnit(UNITS.includes(stored) ? stored : detectUnitFromCountry());
//   }, []);

//   const changeUnit = (u) => {
//     setUnit(u);
//     try {
//       localStorage.setItem(UNIT_STORAGE_KEY, u);
//     } catch {
//       // storage unavailable — the choice just won't persist
//     }
//   };
//   // Which tile's "how is this calculated" panel is open: "goal" | "progress" | null
//   const [infoSection, setInfoSection] = useState(null);
//   const [logs, setLogs] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   // Super-admin-only metrics returned alongside the weight logs.
//   const [metabolismScores, setMetabolismScores] = useState({}); // date -> score
//   const [metabolismScore, setMetabolismScore] = useState(null); // latest score
//   const [fitnessGoal, setFitnessGoal] = useState(null);
//   // Top-level values returned by the weight-tracking API.
//   const [apiCurrentWeight, setApiCurrentWeight] = useState(null);
//   const [apiTargetWeight, setApiTargetWeight] = useState(null);
//   const [isSuperAdmin, setIsSuperAdmin] = useState(false);
//   // Tracked in a ref (not state) so marking it doesn't retrigger this effect.
//   const loadedForRef = useRef(null);

//   useEffect(() => {
//     const token = cookieManager.get("access_token");
//     const decoded = token ? decodeJwt(token) : null;
//     setIsSuperAdmin(decoded?.role === "super_admin");
//   }, []);

//   useEffect(() => {
//     // Lazy-load: only fetch once the Weight Tracking tab is actually opened,
//     // and refetch when the viewed client (profileId) changes.
//     if (!profileId || !isActive || loadedForRef.current === profileId) return;

//     let cancelled = false;
//     let completed = false;
//     loadedForRef.current = profileId;
//     setLoading(true);
//     setError(null);

//     fetchWeightTracking(profileId)
//       .then((res) => {
//         if (cancelled) return;
//         setLogs(normaliseLogs(res?.data));
//         const scores = {};
//         if (Array.isArray(res?.metabolism_scores)) {
//           for (const s of res.metabolism_scores) {
//             const value = Number(s?.score);
//             if (s?.date && !Number.isNaN(value)) scores[s.date] = value;
//           }
//         }
//         setMetabolismScores(scores);
//         setMetabolismScore(
//           typeof res?.metabolism_score === "number" ? res.metabolism_score : null
//         );
//         setFitnessGoal(res?.fitness_goal ?? null);
//         const cw = Number(res?.current_weight);
//         setApiCurrentWeight(Number.isFinite(cw) ? cw : null);
//         const tw = Number(res?.target_weight);
//         setApiTargetWeight(Number.isFinite(tw) ? tw : null);
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         setError(err?.message || "Failed to load weight logs");
//         setLogs([]);
//         setMetabolismScores({});
//         setMetabolismScore(null);
//         setFitnessGoal(null);
//         setApiCurrentWeight(null);
//         setApiTargetWeight(null);
//       })
//       .finally(() => {
//         completed = true;
//         if (!cancelled) setLoading(false);
//       });

//     return () => {
//       cancelled = true;
//       // If we bailed before the request finished, allow a refetch next time
//       // the tab is reopened for this client.
//       if (!completed) loadedForRef.current = null;
//     };
//   }, [profileId, isActive]);

//   // Points filtered to the selected time range (relative to the latest weigh-in).
//   const rangedLogs = useMemo(() => {
//     if (logs.length === 0) return [];
//     const days = RANGE_DAYS[range] ?? Infinity;
//     if (days === Infinity) return logs;

//     const latest = new Date(logs[logs.length - 1].logDate);
//     const cutoff = new Date(latest);
//     cutoff.setDate(cutoff.getDate() - days);

//     const filtered = logs.filter((p) => new Date(p.logDate) >= cutoff);
//     return filtered.length > 0 ? filtered : logs;
//   }, [logs, range]);

//   const hasData = logs.length > 0;

//   // Current weight comes from the API's top-level current_weight; falls back
//   // to the latest weigh-in if the API doesn't provide it.
//   const currentWeight =
//     apiCurrentWeight != null ? apiCurrentWeight : hasData ? logs[logs.length - 1].weight : null;
//   const startingWeight = hasData ? logs[0].weight : null;

//   // Goal weight comes from the API's top-level target_weight; falls back to an
//   // explicit goal_weight on the profile, then to the BMI-derived value
//   // (target BMI × height², height from profile_details.height in cm).
//   const heightCm = profileData?.profile_details?.height ?? profileData?.height;
//   const goalWeight =
//     apiTargetWeight != null
//       ? apiTargetWeight
//       : profileData?.goal_weight != null
//       ? Number(profileData.goal_weight)
//       : goalWeightFromHeight(heightCm);

//   // Overall progress toward the ideal (goal) weight = the fraction of the
//   // original gap that has been closed, measured from where the client is NOW.
//   // Works for both directions (loss and gain). Overshooting the goal reopens
//   // the gap (currentGap grows again), so progress falls back down instead of
//   // staying pinned at 100% — the client still has to move back toward ideal.
//   const totalGap =
//     goalWeight != null && startingWeight != null ? Math.abs(startingWeight - goalWeight) : 0;
//   const currentGap =
//     goalWeight != null && currentWeight != null ? Math.abs(currentWeight - goalWeight) : 0;
//   const progress =
//     totalGap > 0 ? Math.max(0, Math.min(100, Math.round((1 - currentGap / totalGap) * 100))) : 0;
//   // Reached once the client is essentially at the ideal weight (within 0.5 kg).
//   const reachedGoal = goalWeight != null && currentWeight != null && currentGap <= 0.5;
//   const remaining = currentWeight != null && goalWeight != null ? currentGap.toFixed(1) : null;
//   // Most recent change between the last two weigh-ins.
//   const weeklyChange = hasData ? logs[logs.length - 1].delta : 0;

//   const isKg = unit === "kg";
//   // kg -> selected display unit (raw number).
//   const toUnit = (kg) => (kg == null ? null : isKg ? kg : kg * KG_TO_LBS);
//   // kg -> whole number in the selected display unit.
//   const fmtWeight = (kg) => (kg == null ? null : Math.round(toUnit(kg)));
//   const fmtDelta = (kg) => Math.round(Math.abs(isKg ? kg : kg * KG_TO_LBS));

//   const startingDateLabel = hasData ? formatLogDate(logs[0].logDate) : "—";

//   // Newest first for the "Recent entries" list.
//   const recentEntries = useMemo(() => [...logs].reverse(), [logs]);

//   const hasScores = isSuperAdmin && Object.keys(metabolismScores).length > 0;

//   const chartData = {
//     labels: rangedLogs.map((p) => p.label),
//     datasets: [
//       {
//         label: "Weight",
//         data: rangedLogs.map((p) => toUnit(p.weight)),
//         borderColor: "#308BF9",
//         backgroundColor: "rgba(48,139,249,0.06)",
//         fill: true,
//         tension: 0.35,
//         borderWidth: 2.5,
//         pointRadius: 4,
//         pointHoverRadius: 7,
//         pointBackgroundColor: "#308BF9",
//         pointBorderColor: "#ffffff",
//         pointBorderWidth: 2,
//       },
//       ...(goalWeight != null
//         ? [
//             {
//               label: "Goal",
//               data: Array(rangedLogs.length).fill(toUnit(goalWeight)),
//               borderColor: "rgba(48,139,249,0.25)",
//               borderDash: [6, 4],
//               borderWidth: 1.5,
//               pointRadius: 0,
//               pointHoverRadius: 0,
//               fill: false,
//             },
//           ]
//         : []),
//       // Super-admin only — metabolism score history (0–100, unitless) matched
//       // to the weigh-in dates. Drawn fully invisible (no line, no points): the
//       // score surfaces only in the shared hover tooltip.
//       ...(hasScores
//         ? [
//             {
//               label: "Metabolism Score",
//               data: rangedLogs.map((p) => metabolismScores[p.logDate] ?? null),
//               yAxisID: "y1",
//               showLine: false,
//               pointRadius: 0,
//               pointHoverRadius: 0,
//               fill: false,
//             },
//           ]
//         : []),
//     ],
//   };

//   // Dynamic y-axis bounds with a little padding around the observed range,
//   // computed in the currently displayed unit.
//   const yBounds = useMemo(() => {
//     const factor = unit === "kg" ? 1 : KG_TO_LBS;
//     const values = rangedLogs.map((p) => p.weight * factor);
//     if (goalWeight != null) values.push(goalWeight * factor);
//     if (values.length === 0) return { min: undefined, max: undefined };
//     const min = Math.min(...values);
//     const max = Math.max(...values);
//     const pad = Math.max(2, Math.round((max - min) * 0.15));
//     return { min: Math.max(0, Math.floor(min - pad)), max: Math.ceil(max + pad) };
//   }, [rangedLogs, goalWeight, unit]);

//   const chartOptions = {
//     responsive: true,
//     maintainAspectRatio: false,
//     layout: { padding: { top: 4, bottom: 0 } },
//     plugins: {
//       legend: { display: false },
//       tooltip: {
//         mode: "index",
//         intersect: false,
//         backgroundColor: "#252525",
//         titleColor: "#fff",
//         bodyColor: "#fff",
//         titleFont: { family: "Poppins, sans-serif", weight: "600", size: 12 },
//         bodyFont: { family: "Poppins, sans-serif", size: 12 },
//         padding: 10,
//         cornerRadius: 10,
//         callbacks: {
//           label: (ctx) =>
//             ctx.dataset.label === "Metabolism Score"
//               ? `Metabolism Score: ${Math.round(ctx.parsed.y)}`
//               : `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)} ${unit}`,
//         },
//       },
//     },
//     scales: {
//       x: {
//         grid: { display: false },
//         border: { display: false },
//         ticks: {
//           color: "#A1A1A1",
//           font: { family: "Poppins, sans-serif", size: 10, weight: "400" },
//           maxRotation: 0,
//         },
//       },
//       y: {
//         min: yBounds.min,
//         max: yBounds.max,
//         grid: { color: "#F0F0F0", lineWidth: 0.8 },
//         border: { display: false },
//         ticks: {
//           color: "#A1A1A1",
//           font: { family: "Poppins, sans-serif", size: 10, weight: "400" },
//           callback: (v) => `${v}`,
//         },
//       },
//       // Hidden 0–100 scale for the metabolism score (super admin only) — the
//       // score line still uses it for positioning, but no axis is rendered.
//       ...(hasScores
//         ? {
//             y1: {
//               display: false,
//               min: 0,
//               max: 100,
//             },
//           }
//         : {}),
//     },
//     interaction: { mode: "nearest", axis: "x", intersect: false },
//   };

//   const isLoss = weeklyChange <= 0;

//   const statTiles = [
//     {
//       label: "Current weight",
//       value: currentWeight != null ? fmtWeight(currentWeight) : "—",
//       unit,
//       accent: null,
//       sub:
//         weeklyChange !== 0 ? (
//           <div className="flex items-center gap-1 mt-2">
//             <svg
//               width="10"
//               height="10"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke={isLoss ? "#16a34a" : "#dc2626"}
//               strokeWidth="2.5"
//             >
//               {isLoss ? (
//                 <>
//                   <polyline points="7 7 17 17" />
//                   <polyline points="17 7 17 17 7 17" />
//                 </>
//               ) : (
//                 <>
//                   <polyline points="17 17 7 7" />
//                   <polyline points="7 17 7 7 17 7" />
//                 </>
//               )}
//             </svg>
//             <span
//               className={`text-[10px] font-semibold tracking-[-0.2px] ${
//                 isLoss ? "text-[#16a34a]" : "text-[#dc2626]"
//               }`}
//             >
//               {fmtDelta(weeklyChange)} {unit} last log
//             </span>
//           </div>
//         ) : (
//           <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">No change</p>
//         ),
//       highlight: true,
//     },
//     {
//       label: "Starting Weight",
//       value: startingWeight != null ? fmtWeight(startingWeight) : "—",
//       unit,
//       sub: <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">{startingDateLabel}</p>,
//     },
//     {
//       label: "Goal",
//       info: "goal",
//       value: goalWeight != null ? fmtWeight(goalWeight) : "—",
//       unit,
//       sub: (
//         <p
//           className={`text-[10px] font-semibold tracking-[-0.2px] mt-2 ${
//             reachedGoal ? "text-[#16a34a]" : "text-[#A1A1A1]"
//           }`}
//         >
//           {remaining == null ? "Not set" : reachedGoal ? "Goal reached" : `${fmtWeight(currentGap)} ${unit} to go`}
//         </p>
//       ),
//     },
//     {
//       label: "Progress",
//       info: "progress",
//       value: goalWeight != null ? progress : "—",
//       unit: goalWeight != null ? "%" : "",
//       sub: (
//         <div className="mt-3 h-[6px] bg-white rounded-[10px] overflow-hidden" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)" }}>
//           <div
//             className="h-full rounded-[10px] transition-all duration-700 ease-out"
//             style={{
//               width: `${goalWeight != null ? progress : 0}%`,
//               background: "linear-gradient(90deg, #308BF9, #60a5fa)",
//             }}
//           />
//         </div>
//       ),
//     },
//     // Visible to super admins only — sourced from the weight-tracking API.
//     ...(isSuperAdmin
//       ? [
//           {
//             label: "Today’s Metabolism Score",
//             value: metabolismScore != null ? Math.round(metabolismScore) : "—",
//             unit: "",
//             sub: (
//               <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">
//                 Goal:{" "}
//                 <span className="text-[#535359]">
//                   {formatFitnessGoal(fitnessGoal) ?? "—"}
//                 </span>
//               </p>
//             ),
//           },
//         ]
//       : []),
//   ];

//   return (
//     <div className="flex flex-col gap-4 mt-[16px] mb-[20px] mx-[5px]">
//       {/* Unit switch — applies to every value on this tab */}
//       <div className="flex justify-end">
//         <div className="flex gap-1 bg-[#F5F7FA] rounded-[40px] p-[3px]">
//           {UNITS.map((u) => (
//             <button
//               key={u}
//               onClick={() => changeUnit(u)}
//               className={`px-3 py-[4px] rounded-[40px] text-[11px] font-semibold tracking-[-0.22px] transition-all duration-200 cursor-pointer ${
//                 unit === u
//                   ? "bg-[#308BF9] text-white shadow-sm"
//                   : "text-[#535359] hover:text-[#252525] hover:bg-[#e8eaed]"
//               }`}
//             >
//               {u}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Stat tiles */}
//       <div
//         className={`grid gap-3 ${
//           statTiles.length > 4
//             ? "grid-cols-5 max-2xl:grid-cols-3"
//             : "grid-cols-4 max-2xl:grid-cols-2"
//         }`}
//       >
//         {statTiles.map((tile) => (
//           <div
//             key={tile.label}
//             className={`rounded-[12px] p-4 transition-all duration-200 cursor-default group ${
//               tile.highlight
//                 ? "bg-[#EFF6FF] border border-[#308BF9]/15 hover:border-[#308BF9]/30"
//                 : "bg-[#F5F7FA] border border-transparent hover:border-[#E1E6ED]"
//             }`}
//           >
//             <div className="flex items-center justify-between mb-2">
//               <p className="text-[#A1A1A1] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] uppercase">
//                 {tile.label}
//               </p>
//               {tile.info && (
//                 <button
//                   onClick={() => setInfoSection((prev) => (prev === tile.info ? null : tile.info))}
//                   aria-label={`How ${tile.label} is calculated`}
//                   className="flex-shrink-0 text-[#308BF9] cursor-pointer transition-opacity"
//                 >
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
//                     <circle cx="12" cy="12" r="10" />
//                     <line x1="12" y1="16" x2="12" y2="12" />
//                     <line x1="12" y1="8" x2="12.01" y2="8" />
//                   </svg>
//                 </button>
//               )}
//             </div>
//             <p className="text-[#252525] text-[24px] font-semibold tracking-[-1.2px] leading-none">
//               {tile.value}
//               <span className="text-[#535359] text-[13px] font-semibold tracking-[-0.26px] ml-1">
//                 {tile.unit}
//               </span>
//             </p>
//             {tile.sub}
//           </div>
//         ))}
//       </div>

//       {/* Per-tile "how is this calculated" explanation, toggled from the Goal / Progress info icons */}
//       {infoSection === "goal" && (
//         <div className="rounded-[12px] border border-[#E1E6ED] bg-[#F9FAFB] p-5">
//           <div className="flex items-center justify-between mb-1.5">
//             <p className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px]">
//               How the goal (ideal) weight is calculated
//             </p>
//             <button
//               onClick={() => setInfoSection(null)}
//               aria-label="Close"
//               className="text-[#A1A1A1] hover:text-[#252525] transition-colors"
//             >
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                 <line x1="18" y1="6" x2="6" y2="18" />
//                 <line x1="6" y1="6" x2="18" y2="18" />
//               </svg>
//             </button>
//           </div>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px]">
//             Derived from the client&apos;s height using a target BMI of{" "}
//             <span className="font-semibold text-[#252525]">{TARGET_BMI}</span> (the middle of the
//             healthy range 18.5–24.9):
//           </p>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px] mt-1">
//             Goal weight (kg) = Target BMI × (height in cm ÷ 100)²
//           </p>
//           <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2">
//             {heightCm ? (
//               <>
//                 {TARGET_BMI} × ({heightCm} ÷ 100)² ={" "}
//                 <span className="font-semibold">{goalWeight} kg</span>
//                 {!isKg && <> ({fmtWeight(goalWeight)} lbs)</>}
//               </>
//             ) : (
//               "Height isn't available for this client, so an ideal weight can't be derived."
//             )}
//           </div>
//         </div>
//       )}

//       {infoSection === "progress" && (
//         <div className="rounded-[12px] border border-[#E1E6ED] bg-[#F9FAFB] p-5">
//           <div className="flex items-center justify-between mb-1.5">
//             <p className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px]">
//               How progress is calculated
//             </p>
//             <button
//               onClick={() => setInfoSection(null)}
//               aria-label="Close"
//               className="text-[#A1A1A1] hover:text-[#252525] transition-colors"
//             >
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                 <line x1="18" y1="6" x2="6" y2="18" />
//                 <line x1="6" y1="6" x2="18" y2="18" />
//               </svg>
//             </button>
//           </div>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px]">
//             The share of the original gap to the ideal weight that has been closed, measured from the
//             client&apos;s current weight:
//           </p>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px] mt-1">
//             Progress = (1 − |current − goal| ÷ |starting − goal|) × 100
//           </p>
//           {startingWeight != null && currentWeight != null && goalWeight != null ? (
//             <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2 leading-[175%]">
//               <div>
//                 Starting <span className="font-semibold">{fmtWeight(startingWeight)} {unit}</span> ·
//                 Current <span className="font-semibold">{fmtWeight(currentWeight)} {unit}</span> ·
//                 Goal <span className="font-semibold">{fmtWeight(goalWeight)} {unit}</span>
//               </div>
//               <div>
//                 (1 − {fmtWeight(currentGap)} ÷ {fmtWeight(totalGap)}) × 100 ={" "}
//                 <span className="font-semibold">{progress}%</span>
//               </div>
//             </div>
//           ) : (
//             <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2">
//               Not enough data yet to calculate progress.
//             </div>
//           )}
//           <p className="text-[#A1A1A1] text-[11px] leading-[160%] tracking-[-0.22px] mt-2">
//             If the client moves past the ideal weight, the gap opens up again and progress falls —
//             because they now need to move back toward the ideal.
//           </p>
//         </div>
//       )}

//       {/* Chart + Recent entries side by side */}
//       <div className="flex max-2xl:flex-col gap-4 2xl:h-[320px]">
//         {/* Chart */}
//         <div className="flex-[3] max-2xl:flex-none max-2xl:h-[320px] border border-[#E1E6ED] rounded-[12px] p-5 min-w-0 flex flex-col">
//           <div className="flex items-center justify-between mb-3">
//             <p className="text-[#252525] text-[16px] font-semibold leading-[110%] tracking-[-0.64px]">
//               Weight trend
//             </p>
//             <div className="flex gap-1 bg-[#F5F7FA] rounded-[40px] p-[3px]">
//               {RANGES.map((r) => (
//                 <button
//                   key={r}
//                   onClick={() => setRange(r)}
//                   className={`px-3 py-[4px] rounded-[40px] text-[11px] font-semibold tracking-[-0.22px] transition-all duration-200 ${
//                     range === r
//                       ? "bg-[#308BF9] text-white shadow-sm"
//                       : "text-[#535359] hover:text-[#252525] hover:bg-[#e8eaed]"
//                   }`}
//                 >
//                   {r}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="flex-1 min-h-0 relative">
//             {loading ? (
//               <div className="absolute inset-0 flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 Loading weight data…
//               </div>
//             ) : error ? (
//               <div className="absolute inset-0 flex items-center justify-center text-[#dc2626] text-[12px] tracking-[-0.24px] text-center px-4">
//                 {error}
//               </div>
//             ) : !hasData ? (
//               <div className="absolute inset-0 flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 No weight logs yet
//               </div>
//             ) : (
//               <Line data={chartData} options={chartOptions} />
//             )}
//           </div>

//           <div className="flex gap-5 mt-2 pt-2 border-t border-[#F0F0F0]">
//             <span className="flex items-center gap-1.5 text-[#535359] text-[11px] tracking-[-0.22px]">
//               <span className="w-3.5 h-[2.5px] rounded-sm bg-[#308BF9]" />
//               Actual
//             </span>
//             {goalWeight != null && (
//               <span className="flex items-center gap-1.5 text-[#535359] text-[11px] tracking-[-0.22px]">
//                 <span className="w-3.5 h-0 rounded-sm" style={{ borderTop: "1.5px dashed rgba(48,139,249,0.4)" }} />
//                 Goal ({fmtWeight(goalWeight)} {unit})
//               </span>
//             )}
//           </div>
//         </div>

//         {/* Recent entries */}
//         <div className="flex-[2] max-2xl:flex-none max-2xl:h-[300px] flex flex-col min-w-0">
//           <div className="flex items-center gap-2 mb-3">
//             <p className="text-[#252525] text-[16px] font-semibold leading-[110%] tracking-[-0.64px]">
//               Recent entries
//             </p>
//             <span className="text-[#A1A1A1] text-[11px] font-semibold tracking-[-0.22px]">
//               {recentEntries.length} logs
//             </span>
//           </div>

//           <div className="border border-[#E1E6ED] rounded-[12px] overflow-hidden flex-1 overflow-y-auto">
//             {loading ? (
//               <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 Loading…
//               </div>
//             ) : recentEntries.length === 0 ? (
//               <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 No entries
//               </div>
//             ) : (
//               recentEntries.map((entry, i) => (
//                 <div
//                   key={i}
//                   className={`flex items-center px-4 py-[10px] hover:bg-[#F9FAFB] transition-colors ${
//                     i < recentEntries.length - 1 ? "border-b border-[#F0F0F0]" : ""
//                   }`}
//                 >
//                   <span className="flex-1 text-[#535359] text-[12px] tracking-[-0.24px] whitespace-nowrap">
//                     {entry.label}
//                   </span>
//                   <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] mr-3">
//                     {fmtWeight(entry.weight)}
//                     <span className="text-[#A1A1A1] font-normal ml-0.5">{unit}</span>
//                   </span>
//                   {entry.delta !== 0 && (
//                     <span
//                       className={`text-[10px] font-semibold tracking-[-0.2px] flex items-center gap-[2px] px-[6px] py-[2px] rounded-[8px] ${
//                         entry.delta < 0
//                           ? "text-[#16a34a] bg-[#f0fdf4]"
//                           : "text-[#dc2626] bg-[#fef2f2]"
//                       }`}
//                     >
//                       <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                         {entry.delta < 0 ? (
//                           <>
//                             <polyline points="7 7 17 17" />
//                             <polyline points="17 7 17 17 7 17" />
//                           </>
//                         ) : (
//                           <>
//                             <polyline points="17 17 7 7" />
//                             <polyline points="7 17 7 7 17 7" />
//                           </>
//                         )}
//                       </svg>
//                       {fmtDelta(entry.delta)}
//                     </span>
//                   )}
//                 </div>
//               ))
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Info note — inline subtle */}
//       <div className="flex items-center gap-2 px-1">
//         <svg className="flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" strokeWidth="1.8">
//           <circle cx="12" cy="12" r="10" />
//           <line x1="12" y1="16" x2="12" y2="12" />
//           <line x1="12" y1="8" x2="12.01" y2="8" />
//         </svg>
//         <p className="text-[#A1A1A1] text-[11px] tracking-[-0.22px]">
//           Weight data syncs from the client&apos;s Respyr app. Focus on weekly averages over individual weigh-ins.
//         </p>
//       </div>
//     </div>
//   );
// }









// "use client";
// import { useState, useEffect, useMemo, useRef } from "react";
// import { Line } from "react-chartjs-2";
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Filler,
//   Tooltip,
// } from "chart.js";
// import { fetchWeightTracking } from "../services/authService";
// import { cookieManager } from "../lib/cookies";

// function decodeJwt(token) {
//   try {
//     const payload = token.split(".")[1];
//     const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
//     const jsonPayload = decodeURIComponent(
//       atob(base64)
//         .split("")
//         .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
//         .join("")
//     );
//     return JSON.parse(jsonPayload);
//   } catch {
//     return null;
//   }
// }

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Filler,
//   Tooltip
// );

// const RANGES = ["1W", "1M", "3M", "All"];

// const RANGE_DAYS = { "1W": 7, "1M": 30, "3M": 90, All: Infinity };

// const UNITS = ["kg", "lbs"];

// const KG_TO_LBS = 2.20462;

// // Countries where body weight is customarily shown in pounds
// // (USA, Liberia, Myanmar). Everyone else defaults to kg.
// const LBS_COUNTRIES = ["US", "LR", "MM"];

// const UNIT_STORAGE_KEY = "weight_display_unit";

// // Best-effort country detection from the browser locale, e.g. "en-US" -> "US",
// // "hi-IN" -> "IN". Returns "kg" when the country can't be determined.
// const detectUnitFromCountry = () => {
//   try {
//     const locales =
//       navigator.languages && navigator.languages.length
//         ? navigator.languages
//         : [navigator.language];
//     for (const locale of locales) {
//       const country = new Intl.Locale(locale).region;
//       if (country) return LBS_COUNTRIES.includes(country) ? "lbs" : "kg";
//     }
//   } catch {
//     // ignore — fall through to kg
//   }
//   return "kg";
// };

// // Target BMI used to derive a goal weight from the client's height.
// // 21.5 sits in the healthy BMI range (18.5–24.9).
// const TARGET_BMI = 21.5;

// // goal weight (kg) = target BMI × height(m)², rounded to 1 decimal.
// const goalWeightFromHeight = (heightCm) => {
//   const cm = Number(heightCm);
//   if (!cm || Number.isNaN(cm) || cm <= 0) return null;
//   const m = cm / 100;
//   return Number((TARGET_BMI * m * m).toFixed(1));
// };

// const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// // "2026-07-08" -> "Jul 8"
// const formatLogDate = (logDate) => {
//   if (!logDate) return "";
//   const [y, m, d] = logDate.split("-");
//   const monthIdx = Number(m) - 1;
//   if (Number.isNaN(monthIdx) || !MONTHS[monthIdx]) return logDate;
//   return `${MONTHS[monthIdx]} ${Number(d)}`;
// };

// // "fat_loss" -> "Fat Loss"
// const formatFitnessGoal = (goal) => {
//   if (!goal || typeof goal !== "string") return null;
//   return goal
//     .split("_")
//     .filter(Boolean)
//     .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
//     .join(" ");
// };

// // Normalise raw API logs into chronological (oldest -> newest) points with
// // deltas relative to the previous weigh-in.
// const normaliseLogs = (rawLogs) => {
//   if (!Array.isArray(rawLogs)) return [];

//   const chronological = [...rawLogs]
//     .map((log) => ({
//       weight: Number(log.weight_kg),
//       logDate: log.log_date,
//       createdAt: log.created_at || `${log.log_date} ${log.log_time || ""}`.trim(),
//     }))
//     .filter((p) => !Number.isNaN(p.weight))
//     // created_at is "YYYY-MM-DD HH:mm:ss" -> lexical sort is chronological
//     .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

//   return chronological.map((point, i) => ({
//     ...point,
//     label: formatLogDate(point.logDate),
//     delta: i === 0 ? 0 : Number((point.weight - chronological[i - 1].weight).toFixed(2)),
//   }));
// };

// export default function WeightTrackingTab({ profileData, profileId, isActive }) {
//   const [range, setRange] = useState("1M");
//   // Display unit only — all data stays in kg internally and is converted on render.
//   const [unit, setUnit] = useState("kg");

//   // Default the unit from the viewer's country (browser locale): USA -> lbs,
//   // India (and most others) -> kg. A manual switch is remembered and wins over
//   // the detected default. Runs in an effect so SSR/hydration always renders "kg".
//   useEffect(() => {
//     let stored = null;
//     try {
//       stored = localStorage.getItem(UNIT_STORAGE_KEY);
//     } catch {
//       // storage unavailable — fall back to detection
//     }
//     setUnit(UNITS.includes(stored) ? stored : detectUnitFromCountry());
//   }, []);

//   const changeUnit = (u) => {
//     setUnit(u);
//     try {
//       localStorage.setItem(UNIT_STORAGE_KEY, u);
//     } catch {
//       // storage unavailable — the choice just won't persist
//     }
//   };
//   // Which tile's "how is this calculated" panel is open: "goal" | "progress" | null
//   const [infoSection, setInfoSection] = useState(null);
//   const [logs, setLogs] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   // Super-admin-only metrics returned alongside the weight logs.
//   const [metabolismScores, setMetabolismScores] = useState({}); // date -> score
//   const [metabolismScore, setMetabolismScore] = useState(null); // latest score
//   const [fitnessGoal, setFitnessGoal] = useState(null);
//   const [isSuperAdmin, setIsSuperAdmin] = useState(false);
//   // Tracked in a ref (not state) so marking it doesn't retrigger this effect.
//   const loadedForRef = useRef(null);

//   useEffect(() => {
//     const token = cookieManager.get("access_token");
//     const decoded = token ? decodeJwt(token) : null;
//     setIsSuperAdmin(decoded?.role === "super_admin");
//   }, []);

//   useEffect(() => {
//     // Lazy-load: only fetch once the Weight Tracking tab is actually opened,
//     // and refetch when the viewed client (profileId) changes.
//     if (!profileId || !isActive || loadedForRef.current === profileId) return;

//     let cancelled = false;
//     let completed = false;
//     loadedForRef.current = profileId;
//     setLoading(true);
//     setError(null);

//     fetchWeightTracking(profileId)
//       .then((res) => {
//         if (cancelled) return;
//         setLogs(normaliseLogs(res?.data));
//         const scores = {};
//         if (Array.isArray(res?.metabolism_scores)) {
//           for (const s of res.metabolism_scores) {
//             const value = Number(s?.score);
//             if (s?.date && !Number.isNaN(value)) scores[s.date] = value;
//           }
//         }
//         setMetabolismScores(scores);
//         setMetabolismScore(
//           typeof res?.metabolism_score === "number" ? res.metabolism_score : null
//         );
//         setFitnessGoal(res?.fitness_goal ?? null);
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         setError(err?.message || "Failed to load weight logs");
//         setLogs([]);
//         setMetabolismScores({});
//         setMetabolismScore(null);
//         setFitnessGoal(null);
//       })
//       .finally(() => {
//         completed = true;
//         if (!cancelled) setLoading(false);
//       });

//     return () => {
//       cancelled = true;
//       // If we bailed before the request finished, allow a refetch next time
//       // the tab is reopened for this client.
//       if (!completed) loadedForRef.current = null;
//     };
//   }, [profileId, isActive]);

//   // Points filtered to the selected time range (relative to the latest weigh-in).
//   const rangedLogs = useMemo(() => {
//     if (logs.length === 0) return [];
//     const days = RANGE_DAYS[range] ?? Infinity;
//     if (days === Infinity) return logs;

//     const latest = new Date(logs[logs.length - 1].logDate);
//     const cutoff = new Date(latest);
//     cutoff.setDate(cutoff.getDate() - days);

//     const filtered = logs.filter((p) => new Date(p.logDate) >= cutoff);
//     return filtered.length > 0 ? filtered : logs;
//   }, [logs, range]);

//   const hasData = logs.length > 0;

//   const currentWeight = hasData ? logs[logs.length - 1].weight : null;
//   const startingWeight = hasData ? logs[0].weight : null;

//   // Goal weight derived from BMI: target BMI × height². Height comes from the
//   // client individual-profile API (profile_details.height, in cm). Falls back
//   // to an explicit goal_weight if one is ever provided.
//   const heightCm = profileData?.profile_details?.height ?? profileData?.height;
//   const goalWeight =
//     profileData?.goal_weight != null
//       ? Number(profileData.goal_weight)
//       : goalWeightFromHeight(heightCm);

//   // Overall progress toward the ideal (goal) weight = the fraction of the
//   // original gap that has been closed, measured from where the client is NOW.
//   // Works for both directions (loss and gain). Overshooting the goal reopens
//   // the gap (currentGap grows again), so progress falls back down instead of
//   // staying pinned at 100% — the client still has to move back toward ideal.
//   const totalGap =
//     goalWeight != null && startingWeight != null ? Math.abs(startingWeight - goalWeight) : 0;
//   const currentGap =
//     goalWeight != null && currentWeight != null ? Math.abs(currentWeight - goalWeight) : 0;
//   const progress =
//     totalGap > 0 ? Math.max(0, Math.min(100, Math.round((1 - currentGap / totalGap) * 100))) : 0;
//   // Reached once the client is essentially at the ideal weight (within 0.5 kg).
//   const reachedGoal = goalWeight != null && currentWeight != null && currentGap <= 0.5;
//   const remaining = currentWeight != null && goalWeight != null ? currentGap.toFixed(1) : null;
//   // Most recent change between the last two weigh-ins.
//   const weeklyChange = hasData ? logs[logs.length - 1].delta : 0;

//   const isKg = unit === "kg";
//   // kg -> selected display unit (raw number).
//   const toUnit = (kg) => (kg == null ? null : isKg ? kg : kg * KG_TO_LBS);
//   // kg -> whole number in the selected display unit.
//   const fmtWeight = (kg) => (kg == null ? null : Math.round(toUnit(kg)));
//   const fmtDelta = (kg) => Math.round(Math.abs(isKg ? kg : kg * KG_TO_LBS));

//   const startingDateLabel = hasData ? formatLogDate(logs[0].logDate) : "—";

//   // Newest first for the "Recent entries" list.
//   const recentEntries = useMemo(() => [...logs].reverse(), [logs]);

//   const hasScores = isSuperAdmin && Object.keys(metabolismScores).length > 0;

//   const chartData = {
//     labels: rangedLogs.map((p) => p.label),
//     datasets: [
//       {
//         label: "Weight",
//         data: rangedLogs.map((p) => toUnit(p.weight)),
//         borderColor: "#308BF9",
//         backgroundColor: "rgba(48,139,249,0.06)",
//         fill: true,
//         tension: 0.35,
//         borderWidth: 2.5,
//         pointRadius: 4,
//         pointHoverRadius: 7,
//         pointBackgroundColor: "#308BF9",
//         pointBorderColor: "#ffffff",
//         pointBorderWidth: 2,
//       },
//       ...(goalWeight != null
//         ? [
//             {
//               label: "Goal",
//               data: Array(rangedLogs.length).fill(toUnit(goalWeight)),
//               borderColor: "rgba(48,139,249,0.25)",
//               borderDash: [6, 4],
//               borderWidth: 1.5,
//               pointRadius: 0,
//               pointHoverRadius: 0,
//               fill: false,
//             },
//           ]
//         : []),
//       // Super-admin only — metabolism score history (0–100, unitless) matched
//       // to the weigh-in dates. Drawn fully invisible (no line, no points): the
//       // score surfaces only in the shared hover tooltip.
//       ...(hasScores
//         ? [
//             {
//               label: "Metabolism Score",
//               data: rangedLogs.map((p) => metabolismScores[p.logDate] ?? null),
//               yAxisID: "y1",
//               showLine: false,
//               pointRadius: 0,
//               pointHoverRadius: 0,
//               fill: false,
//             },
//           ]
//         : []),
//     ],
//   };

//   // Dynamic y-axis bounds with a little padding around the observed range,
//   // computed in the currently displayed unit.
//   const yBounds = useMemo(() => {
//     const factor = unit === "kg" ? 1 : KG_TO_LBS;
//     const values = rangedLogs.map((p) => p.weight * factor);
//     if (goalWeight != null) values.push(goalWeight * factor);
//     if (values.length === 0) return { min: undefined, max: undefined };
//     const min = Math.min(...values);
//     const max = Math.max(...values);
//     const pad = Math.max(2, Math.round((max - min) * 0.15));
//     return { min: Math.max(0, Math.floor(min - pad)), max: Math.ceil(max + pad) };
//   }, [rangedLogs, goalWeight, unit]);

//   const chartOptions = {
//     responsive: true,
//     maintainAspectRatio: false,
//     layout: { padding: { top: 4, bottom: 0 } },
//     plugins: {
//       legend: { display: false },
//       tooltip: {
//         mode: "index",
//         intersect: false,
//         backgroundColor: "#252525",
//         titleColor: "#fff",
//         bodyColor: "#fff",
//         titleFont: { family: "Poppins, sans-serif", weight: "600", size: 12 },
//         bodyFont: { family: "Poppins, sans-serif", size: 12 },
//         padding: 10,
//         cornerRadius: 10,
//         callbacks: {
//           label: (ctx) =>
//             ctx.dataset.label === "Metabolism Score"
//               ? `Metabolism Score: ${Math.round(ctx.parsed.y)}`
//               : `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)} ${unit}`,
//         },
//       },
//     },
//     scales: {
//       x: {
//         grid: { display: false },
//         border: { display: false },
//         ticks: {
//           color: "#A1A1A1",
//           font: { family: "Poppins, sans-serif", size: 10, weight: "400" },
//           maxRotation: 0,
//         },
//       },
//       y: {
//         min: yBounds.min,
//         max: yBounds.max,
//         grid: { color: "#F0F0F0", lineWidth: 0.8 },
//         border: { display: false },
//         ticks: {
//           color: "#A1A1A1",
//           font: { family: "Poppins, sans-serif", size: 10, weight: "400" },
//           callback: (v) => `${v}`,
//         },
//       },
//       // Hidden 0–100 scale for the metabolism score (super admin only) — the
//       // score line still uses it for positioning, but no axis is rendered.
//       ...(hasScores
//         ? {
//             y1: {
//               display: false,
//               min: 0,
//               max: 100,
//             },
//           }
//         : {}),
//     },
//     interaction: { mode: "nearest", axis: "x", intersect: false },
//   };

//   const isLoss = weeklyChange <= 0;

//   const statTiles = [
//     {
//       label: "Current weight",
//       value: currentWeight != null ? fmtWeight(currentWeight) : "—",
//       unit,
//       accent: null,
//       sub:
//         weeklyChange !== 0 ? (
//           <div className="flex items-center gap-1 mt-2">
//             <svg
//               width="10"
//               height="10"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke={isLoss ? "#16a34a" : "#dc2626"}
//               strokeWidth="2.5"
//             >
//               {isLoss ? (
//                 <>
//                   <polyline points="7 7 17 17" />
//                   <polyline points="17 7 17 17 7 17" />
//                 </>
//               ) : (
//                 <>
//                   <polyline points="17 17 7 7" />
//                   <polyline points="7 17 7 7 17 7" />
//                 </>
//               )}
//             </svg>
//             <span
//               className={`text-[10px] font-semibold tracking-[-0.2px] ${
//                 isLoss ? "text-[#16a34a]" : "text-[#dc2626]"
//               }`}
//             >
//               {fmtDelta(weeklyChange)} {unit} last log
//             </span>
//           </div>
//         ) : (
//           <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">No change</p>
//         ),
//       highlight: true,
//     },
//     {
//       label: "Starting Weight",
//       value: startingWeight != null ? fmtWeight(startingWeight) : "—",
//       unit,
//       sub: <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">{startingDateLabel}</p>,
//     },
//     {
//       label: "Goal",
//       info: "goal",
//       value: goalWeight != null ? fmtWeight(goalWeight) : "—",
//       unit,
//       sub: (
//         <p
//           className={`text-[10px] font-semibold tracking-[-0.2px] mt-2 ${
//             reachedGoal ? "text-[#16a34a]" : "text-[#A1A1A1]"
//           }`}
//         >
//           {remaining == null ? "Not set" : reachedGoal ? "Goal reached" : `${fmtWeight(currentGap)} ${unit} to go`}
//         </p>
//       ),
//     },
//     {
//       label: "Progress",
//       info: "progress",
//       value: goalWeight != null ? progress : "—",
//       unit: goalWeight != null ? "%" : "",
//       sub: (
//         <div className="mt-3 h-[6px] bg-white rounded-[10px] overflow-hidden" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)" }}>
//           <div
//             className="h-full rounded-[10px] transition-all duration-700 ease-out"
//             style={{
//               width: `${goalWeight != null ? progress : 0}%`,
//               background: "linear-gradient(90deg, #308BF9, #60a5fa)",
//             }}
//           />
//         </div>
//       ),
//     },
//     // Visible to super admins only — sourced from the weight-tracking API.
//     ...(isSuperAdmin
//       ? [
//           {
//             label: "Today’s Metabolism Score",
//             value: metabolismScore != null ? Math.round(metabolismScore) : "—",
//             unit: "",
//             sub: (
//               <p className="text-[#A1A1A1] text-[10px] font-semibold tracking-[-0.2px] mt-2">
//                 Goal:{" "}
//                 <span className="text-[#535359]">
//                   {formatFitnessGoal(fitnessGoal) ?? "—"}
//                 </span>
//               </p>
//             ),
//           },
//         ]
//       : []),
//   ];

//   return (
//     <div className="flex flex-col gap-4 mt-[16px] mb-[20px] mx-[5px]">
//       {/* Unit switch — applies to every value on this tab */}
//       <div className="flex justify-end">
//         <div className="flex gap-1 bg-[#F5F7FA] rounded-[40px] p-[3px]">
//           {UNITS.map((u) => (
//             <button
//               key={u}
//               onClick={() => changeUnit(u)}
//               className={`px-3 py-[4px] rounded-[40px] text-[11px] font-semibold tracking-[-0.22px] transition-all duration-200 cursor-pointer ${
//                 unit === u
//                   ? "bg-[#308BF9] text-white shadow-sm"
//                   : "text-[#535359] hover:text-[#252525] hover:bg-[#e8eaed]"
//               }`}
//             >
//               {u}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Stat tiles */}
//       <div
//         className={`grid gap-3 ${
//           statTiles.length > 4
//             ? "grid-cols-5 max-2xl:grid-cols-3"
//             : "grid-cols-4 max-2xl:grid-cols-2"
//         }`}
//       >
//         {statTiles.map((tile) => (
//           <div
//             key={tile.label}
//             className={`rounded-[12px] p-4 transition-all duration-200 cursor-default group ${
//               tile.highlight
//                 ? "bg-[#EFF6FF] border border-[#308BF9]/15 hover:border-[#308BF9]/30"
//                 : "bg-[#F5F7FA] border border-transparent hover:border-[#E1E6ED]"
//             }`}
//           >
//             <div className="flex items-center justify-between mb-2">
//               <p className="text-[#A1A1A1] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] uppercase">
//                 {tile.label}
//               </p>
//               {tile.info && (
//                 <button
//                   onClick={() => setInfoSection((prev) => (prev === tile.info ? null : tile.info))}
//                   aria-label={`How ${tile.label} is calculated`}
//                   className="flex-shrink-0 text-[#308BF9] cursor-pointer transition-opacity"
//                 >
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
//                     <circle cx="12" cy="12" r="10" />
//                     <line x1="12" y1="16" x2="12" y2="12" />
//                     <line x1="12" y1="8" x2="12.01" y2="8" />
//                   </svg>
//                 </button>
//               )}
//             </div>
//             <p className="text-[#252525] text-[24px] font-semibold tracking-[-1.2px] leading-none">
//               {tile.value}
//               <span className="text-[#535359] text-[13px] font-semibold tracking-[-0.26px] ml-1">
//                 {tile.unit}
//               </span>
//             </p>
//             {tile.sub}
//           </div>
//         ))}
//       </div>

//       {/* Per-tile "how is this calculated" explanation, toggled from the Goal / Progress info icons */}
//       {infoSection === "goal" && (
//         <div className="rounded-[12px] border border-[#E1E6ED] bg-[#F9FAFB] p-5">
//           <div className="flex items-center justify-between mb-1.5">
//             <p className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px]">
//               How the goal (ideal) weight is calculated
//             </p>
//             <button
//               onClick={() => setInfoSection(null)}
//               aria-label="Close"
//               className="text-[#A1A1A1] hover:text-[#252525] transition-colors"
//             >
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                 <line x1="18" y1="6" x2="6" y2="18" />
//                 <line x1="6" y1="6" x2="18" y2="18" />
//               </svg>
//             </button>
//           </div>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px]">
//             Derived from the client&apos;s height using a target BMI of{" "}
//             <span className="font-semibold text-[#252525]">{TARGET_BMI}</span> (the middle of the
//             healthy range 18.5–24.9):
//           </p>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px] mt-1">
//             Goal weight (kg) = Target BMI × (height in cm ÷ 100)²
//           </p>
//           <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2">
//             {heightCm ? (
//               <>
//                 {TARGET_BMI} × ({heightCm} ÷ 100)² ={" "}
//                 <span className="font-semibold">{goalWeight} kg</span>
//                 {!isKg && <> ({fmtWeight(goalWeight)} lbs)</>}
//               </>
//             ) : (
//               "Height isn't available for this client, so an ideal weight can't be derived."
//             )}
//           </div>
//         </div>
//       )}

//       {infoSection === "progress" && (
//         <div className="rounded-[12px] border border-[#E1E6ED] bg-[#F9FAFB] p-5">
//           <div className="flex items-center justify-between mb-1.5">
//             <p className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px]">
//               How progress is calculated
//             </p>
//             <button
//               onClick={() => setInfoSection(null)}
//               aria-label="Close"
//               className="text-[#A1A1A1] hover:text-[#252525] transition-colors"
//             >
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                 <line x1="18" y1="6" x2="6" y2="18" />
//                 <line x1="6" y1="6" x2="18" y2="18" />
//               </svg>
//             </button>
//           </div>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px]">
//             The share of the original gap to the ideal weight that has been closed, measured from the
//             client&apos;s current weight:
//           </p>
//           <p className="text-[#535359] text-[12px] leading-[165%] tracking-[-0.24px] mt-1">
//             Progress = (1 − |current − goal| ÷ |starting − goal|) × 100
//           </p>
//           {startingWeight != null && currentWeight != null && goalWeight != null ? (
//             <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2 leading-[175%]">
//               <div>
//                 Starting <span className="font-semibold">{fmtWeight(startingWeight)} {unit}</span> ·
//                 Current <span className="font-semibold">{fmtWeight(currentWeight)} {unit}</span> ·
//                 Goal <span className="font-semibold">{fmtWeight(goalWeight)} {unit}</span>
//               </div>
//               <div>
//                 (1 − {fmtWeight(currentGap)} ÷ {fmtWeight(totalGap)}) × 100 ={" "}
//                 <span className="font-semibold">{progress}%</span>
//               </div>
//             </div>
//           ) : (
//             <div className="mt-2 text-[12px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] px-3 py-2">
//               Not enough data yet to calculate progress.
//             </div>
//           )}
//           <p className="text-[#A1A1A1] text-[11px] leading-[160%] tracking-[-0.22px] mt-2">
//             If the client moves past the ideal weight, the gap opens up again and progress falls —
//             because they now need to move back toward the ideal.
//           </p>
//         </div>
//       )}

//       {/* Chart + Recent entries side by side */}
//       <div className="flex max-2xl:flex-col gap-4 2xl:h-[320px]">
//         {/* Chart */}
//         <div className="flex-[3] max-2xl:flex-none max-2xl:h-[320px] border border-[#E1E6ED] rounded-[12px] p-5 min-w-0 flex flex-col">
//           <div className="flex items-center justify-between mb-3">
//             <p className="text-[#252525] text-[16px] font-semibold leading-[110%] tracking-[-0.64px]">
//               Weight trend
//             </p>
//             <div className="flex gap-1 bg-[#F5F7FA] rounded-[40px] p-[3px]">
//               {RANGES.map((r) => (
//                 <button
//                   key={r}
//                   onClick={() => setRange(r)}
//                   className={`px-3 py-[4px] rounded-[40px] text-[11px] font-semibold tracking-[-0.22px] transition-all duration-200 ${
//                     range === r
//                       ? "bg-[#308BF9] text-white shadow-sm"
//                       : "text-[#535359] hover:text-[#252525] hover:bg-[#e8eaed]"
//                   }`}
//                 >
//                   {r}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="flex-1 min-h-0 relative">
//             {loading ? (
//               <div className="absolute inset-0 flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 Loading weight data…
//               </div>
//             ) : error ? (
//               <div className="absolute inset-0 flex items-center justify-center text-[#dc2626] text-[12px] tracking-[-0.24px] text-center px-4">
//                 {error}
//               </div>
//             ) : !hasData ? (
//               <div className="absolute inset-0 flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 No weight logs yet
//               </div>
//             ) : (
//               <Line data={chartData} options={chartOptions} />
//             )}
//           </div>

//           <div className="flex gap-5 mt-2 pt-2 border-t border-[#F0F0F0]">
//             <span className="flex items-center gap-1.5 text-[#535359] text-[11px] tracking-[-0.22px]">
//               <span className="w-3.5 h-[2.5px] rounded-sm bg-[#308BF9]" />
//               Actual
//             </span>
//             {goalWeight != null && (
//               <span className="flex items-center gap-1.5 text-[#535359] text-[11px] tracking-[-0.22px]">
//                 <span className="w-3.5 h-0 rounded-sm" style={{ borderTop: "1.5px dashed rgba(48,139,249,0.4)" }} />
//                 Goal ({fmtWeight(goalWeight)} {unit})
//               </span>
//             )}
//           </div>
//         </div>

//         {/* Recent entries */}
//         <div className="flex-[2] max-2xl:flex-none max-2xl:h-[300px] flex flex-col min-w-0">
//           <div className="flex items-center gap-2 mb-3">
//             <p className="text-[#252525] text-[16px] font-semibold leading-[110%] tracking-[-0.64px]">
//               Recent entries
//             </p>
//             <span className="text-[#A1A1A1] text-[11px] font-semibold tracking-[-0.22px]">
//               {recentEntries.length} logs
//             </span>
//           </div>

//           <div className="border border-[#E1E6ED] rounded-[12px] overflow-hidden flex-1 overflow-y-auto">
//             {loading ? (
//               <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 Loading…
//               </div>
//             ) : recentEntries.length === 0 ? (
//               <div className="h-full flex items-center justify-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
//                 No entries
//               </div>
//             ) : (
//               recentEntries.map((entry, i) => (
//                 <div
//                   key={i}
//                   className={`flex items-center px-4 py-[10px] hover:bg-[#F9FAFB] transition-colors ${
//                     i < recentEntries.length - 1 ? "border-b border-[#F0F0F0]" : ""
//                   }`}
//                 >
//                   <span className="flex-1 text-[#535359] text-[12px] tracking-[-0.24px] whitespace-nowrap">
//                     {entry.label}
//                   </span>
//                   <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] mr-3">
//                     {fmtWeight(entry.weight)}
//                     <span className="text-[#A1A1A1] font-normal ml-0.5">{unit}</span>
//                   </span>
//                   {entry.delta !== 0 && (
//                     <span
//                       className={`text-[10px] font-semibold tracking-[-0.2px] flex items-center gap-[2px] px-[6px] py-[2px] rounded-[8px] ${
//                         entry.delta < 0
//                           ? "text-[#16a34a] bg-[#f0fdf4]"
//                           : "text-[#dc2626] bg-[#fef2f2]"
//                       }`}
//                     >
//                       <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                         {entry.delta < 0 ? (
//                           <>
//                             <polyline points="7 7 17 17" />
//                             <polyline points="17 7 17 17 7 17" />
//                           </>
//                         ) : (
//                           <>
//                             <polyline points="17 17 7 7" />
//                             <polyline points="7 17 7 7 17 7" />
//                           </>
//                         )}
//                       </svg>
//                       {fmtDelta(entry.delta)}
//                     </span>
//                   )}
//                 </div>
//               ))
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Info note — inline subtle */}
//       <div className="flex items-center gap-2 px-1">
//         <svg className="flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" strokeWidth="1.8">
//           <circle cx="12" cy="12" r="10" />
//           <line x1="12" y1="16" x2="12" y2="12" />
//           <line x1="12" y1="8" x2="12.01" y2="8" />
//         </svg>
//         <p className="text-[#A1A1A1] text-[11px] tracking-[-0.22px]">
//           Weight data syncs from the client&apos;s Respyr app. Focus on weekly averages over individual weigh-ins.
//         </p>
//       </div>
//     </div>
//   );
// }
