import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Maps a trend-zone value to its display label.
// Old zone values are renamed: Focus -> Building, Moderate -> Steady, Optimal -> Strong.
// New values and anything else (e.g. "Attention", "N/A") pass through unchanged.
export function zoneLabel(zone) {
  if (zone == null) return zone;
  switch (String(zone).toLowerCase()) {
    case "focus":
    case "building":
      return "Building";
    case "moderate":
    case "steady":
      return "Steady";
    case "optimal":
    case "strong":
      return "Strong";
    default:
      return zone;
  }
}
