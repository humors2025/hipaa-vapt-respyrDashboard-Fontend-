// Breath-test times (table_test_data.date_time, e.g. last_logged_date).
//
// The column stores a clock time with no time zone. The API adds a "Z" when it
// sends it ("2026-11-20T19:27:08.000Z"), but that Z means nothing, so it is ignored.
//
// Until now the app saved each phone's own clock time, so the zone of an old test
// is unknown and it is shown exactly as stored, marked "client's time".
//
// From NEXT_PUBLIC_TEST_TIME_IST_SINCE on (India time, "YYYY-MM-DD" or
// "YYYY-MM-DD HH:MM"), tests are saved in India time (UTC+5:30, no daylight
// saving), so they are converted to each viewer's own time zone. Leave the
// variable empty until the database really saves India time.

import { getTimeZoneLabel } from "./localTime";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const WALL_CLOCK = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

function cutover() {
  const raw = (process.env.NEXT_PUBLIC_TEST_TIME_IST_SINCE || "").trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?$/);
  if (!m) return null;
  return `${m[1]} ${m[2] || "00:00"}:00`;
}

/**
 * Reads a test time. Returns null when there is none, otherwise
 * { date, converted }:
 *   converted = true  -> date is the exact moment (saved in India time);
 *                         show it in the viewer's zone.
 *   converted = false -> date holds the stored clock time as if it were the
 *                         viewer's own (zone unknown); show it as stored.
 */
export function readTestTime(value) {
  if (!value) return null;
  const m = String(value).match(WALL_CLOCK);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00"] = m;
  const since = cutover();
  const wall = `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  if (since && wall >= since) {
    const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - IST_OFFSET_MS;
    return { date: new Date(utc), converted: true };
  }
  const local = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return Number.isNaN(local.getTime()) ? null : { date: local, converted: false };
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
 * Exact date and time: "20 Nov 2026, 7:57 AM CST" in the viewer's zone for
 * converted tests, "20 Nov 2026, 7:27 PM (client's time)" for older ones.
 */
export function formatTestTimeExact(value) {
  const t = readTestTime(value);
  if (!t) return null;
  const date = t.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = t.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return t.converted
    ? `${date}, ${time} ${getTimeZoneLabel(t.date)}`
    : `${date}, ${time} (client's time)`;
}
