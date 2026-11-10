// One place for showing times in the viewer's own time zone.
//
// Rule for values coming from our API:
//   - "2026-11-05T13:30:00Z" / "...+05:30"  -> an exact moment, shown in the
//     viewer's local time.
//   - "2026-11-05 13:30:00" / "2026-11-05T13:30:00" (no zone) -> the backend
//     builds these with toISOString() or reads DATETIME as UTC, so they are
//     treated as UTC and shown in the viewer's local time.
//   - "2026-11-05" (date only) -> a calendar day, shown as that same day
//     everywhere (never shifted).
//
// Breath-test reading times (table_test_data.date_time) are NOT routed
// through here yet: which clock they are stored in is still unproven.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NAIVE_DATE_TIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

export function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isDateOnly(value) {
  return typeof value === "string" && DATE_ONLY.test(value.trim());
}

// Turns any API date value into a Date (an exact moment), or null.
export function parseServerTime(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    // Unix seconds (Stripe style) or milliseconds.
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  let d;
  if (DATE_ONLY.test(s)) d = new Date(`${s}T00:00:00Z`);
  else if (NAIVE_DATE_TIME.test(s)) d = new Date(`${s.replace(" ", "T")}Z`);
  else d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Short zone name for the viewer, e.g. "CST", "PDT", "GMT+5:30".
export function getTimeZoneLabel(date = new Date()) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    const zone = getLocalTimeZone();
    if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return "IST";
    return part?.value || zone;
  } catch {
    return getLocalTimeZone();
  }
}

// "Nov 5, 2026, 7:30 AM CST" in the viewer's time zone.
export function formatLocalDateTime(value, options = {}) {
  const {
    fallback = "—",
    seconds = false,
    year = true,
    withZone = true,
  } = options;
  if (isDateOnly(value)) return formatLocalDate(value, { fallback, year });
  const d = parseServerTime(value);
  if (!d) return value ? String(value) : fallback;
  const text = d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: true,
  });
  return withZone ? `${text} ${getTimeZoneLabel(d)}` : text;
}

// "Nov 5, 2026": the viewer's local day for a moment, or the same calendar
// day for a date-only value.
export function formatLocalDate(value, options = {}) {
  const { fallback = "—", year = true, month = "short" } = options;
  const d = parseServerTime(value);
  if (!d) return value ? String(value) : fallback;
  return d.toLocaleDateString("en-US", {
    month,
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    ...(isDateOnly(value) ? { timeZone: "UTC" } : {}),
  });
}

// "7:30 AM CST"
export function formatLocalTime(value, options = {}) {
  const { fallback = "—", seconds = false, withZone = true } = options;
  const d = parseServerTime(value);
  if (!d || isDateOnly(value)) return fallback;
  const text = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: true,
  });
  return withZone ? `${text} ${getTimeZoneLabel(d)}` : text;
}

// Today's date in the viewer's time zone, as "YYYY-MM-DD".
export function localTodayISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
