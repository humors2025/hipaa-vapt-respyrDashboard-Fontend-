// Breath-test times (table_test_data.date_time, e.g. last_logged_date).
//
// The column stores a clock time with no time zone. The API adds a "Z" when it
// sends it ("2026-11-20T19:27:08.000Z"), but that Z means nothing, so it is ignored.
//
// Every stored test time is read as India time (UTC+5:30, no daylight saving) and
// shown in each viewer's own time zone: 7:27 PM stored = 7:27 PM IST in India,
// 7:57 AM in Texas, 1:57 PM in London (no zone name is shown).

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const WALL_CLOCK = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * Reads a test time as India time. Returns null when there is none, otherwise
 * { date, converted: true } where date is the exact moment.
 */
export function readTestTime(value) {
  if (!value) return null;
  const m = String(value).match(WALL_CLOCK);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00"] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - IST_OFFSET_MS);
  return Number.isNaN(date.getTime()) ? null : { date, converted: true };
}

/** "Last tested 2 hrs ago", or the date once it is a day or more ago. */
export function formatTestTimeAgo(value, { noTest = "No test yet", dateStyle = "short" } = {}) {
  const t = readTestTime(value);
  if (!t) return noTest;
  // Clamp small negative diffs (clock skew) to 0.
  const diffMs = Math.max(0, Date.now() - t.date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) {
    if (minutes < 1) return "Last tested just now";
    if (minutes < 60) return `Last tested ${minutes} min${minutes > 1 ? "s" : ""} ago`;
    return `Last tested ${hours} hr${hours > 1 ? "s" : ""} ago`;
  }
  return dateStyle === "numeric"
    ? t.date.toLocaleDateString("en-GB")
    : t.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Exact date and time in the viewer's zone, no zone name: "20 Nov 2026, 7:57 AM".
 */
export function formatTestTimeExact(value) {
  const t = readTestTime(value);
  if (!t) return null;
  const date = t.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = t.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}
