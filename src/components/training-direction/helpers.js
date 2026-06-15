// Small formatting helpers used across the trainer-direction tabs.
// Mirrors the engineer's `fmt` / `round` helpers — em-dash placeholder when
// a value is missing, trims trailing zeros for cleaner display.

const isNullish = (v) => v == null || (typeof v === "number" && Number.isNaN(v));

export function fmt(n, decimals = 1) {
  if (isNullish(n)) return "—";
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return x.toFixed(decimals).replace(/\.0+$/, "");
}

export function round(n) {
  if (isNullish(n)) return "—";
  return Math.round(Number(n));
}

// Status pill tokens — keep aligned with the dashboard's existing palette.
export const STATUS_TONE = {
  Optimal:  { bg: "#E5F6EE", text: "#1F7A4A", border: "#A8E0C2" },
  Strong:   { bg: "#E5F6EE", text: "#1F7A4A", border: "#A8E0C2" },
  Moderate: { bg: "#FFF4E0", text: "#A66B00", border: "#F0CB87" },
  Steady:   { bg: "#FFF4E0", text: "#A66B00", border: "#F0CB87" },
  Focus:    { bg: "#FCEAEB", text: "#B5363A", border: "#F0AAB0" },
  Building: { bg: "#FCEAEB", text: "#B5363A", border: "#F0AAB0" },
};

export const FATIGUE_TONE = {
  Low:      { bg: "#E5F6EE", text: "#1F7A4A" },
  Moderate: { bg: "#FFF4E0", text: "#A66B00" },
  High:     { bg: "#FCEAEB", text: "#B5363A" },
};

// Marker pill (acetone / ethanol / hydrogen) — light backgrounds, dark text.
export const MARKER_TONE = {
  acetone:  { bg: "#E5F6EE", text: "#1F7A4A", short: "A", label: "Acetone"  },
  ethanol:  { bg: "#EEF4FE", text: "#1A56AF", short: "E", label: "Ethanol"  },
  hydrogen: { bg: "#FFF4E0", text: "#A66B00", short: "H", label: "Hydrogen" },
};

// Signal mini-card border / score color. Best = green, mid = yellow, limiter = red.
// Top positive driver gets a green-on-light-green emphasis.
export function signalAccent({ tier, isTopDriver }) {
  if (isTopDriver) return { border: "#2EAF6A", text: "#1F7A4A", bg: "#E5F6EE" };
  if (tier === "limiter") return { border: "#E5484D", text: "#B5363A", bg: "#FCEAEB" };
  if (tier === "mid")     return { border: "#F2A93B", text: "#A66B00", bg: "#FFF4E0" };
  if (tier === "best")    return { border: "#2EAF6A", text: "#1F7A4A", bg: "#E5F6EE" };
  return                       { border: "#E1E6ED", text: "#535359", bg: "#F5F7FA" };
}
