"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchReadingTrackerService } from "@/services/superAdminReadingTrackerService";
import ReadingTrackerCharts from "@/components/super-admin/ReadingTrackerCharts";
import ReadingTrackerLeaders from "@/components/super-admin/ReadingTrackerLeaders";

const PAGE_LIMIT = 20;
const POPUP_LIMIT = 20;

const SORT_OPTIONS = [
  { value: "most_missed", label: "Most missed first" },
  { value: "most_taken", label: "Most taken first" },
  { value: "name", label: "Name A–Z" },
];

const SHOW_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "taken_today", label: "Took a reading today", todayOnly: true },
  { value: "pending_today", label: "No reading yet today", todayOnly: true },
  { value: "first_today", label: "First reading today", todayOnly: true },
  { value: "first_month", label: "First reading this month" },
  { value: "never", label: "Never taken a reading" },
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const CELL_STYLES = {
  taken: { cls: "bg-[#E5F6EE] text-[#1F7A4A]", mark: "1", label: "Readings taken that day" },
  missed: { cls: "bg-[#FCEAEB] text-[#B5363A]", mark: "✕", label: "Missed" },
  pending: { cls: "bg-[#FFF4E0] text-[#A66B00]", mark: "•", label: "No reading yet" },
  none: { cls: "bg-[#F1F3F5] text-transparent", mark: "", label: "Not counted" },
};

const STATUS_STYLES = {
  active: "bg-[#E5F6EE] text-[#1F7A4A]",
  trialing: "bg-[#E5F6EE] text-[#1F7A4A]",
  past_due: "bg-[#FFF4E0] text-[#A66B00]",
};

// The tracker runs on US Pacific time, wherever this browser is.
function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part("year")}-${part("month")}`;
}

function formatDay(iso) {
  if (!iso) return "–";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Times are shown exactly as stored with the test, never converted.
function formatTime(time) {
  const [h, m, s] = time.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m}:${s} ${hour < 12 ? "AM" : "PM"}`;
}

function formatDateTime(value) {
  if (!value) return "–";
  const [day, time] = value.split(" ");
  return `${formatDay(day)}, ${formatTime(time)}`;
}

function readingsLabel(count) {
  return `${count} reading${count === 1 ? "" : "s"}`;
}

const statusLabel = (row) => (row.subscription_status || "unknown").replace(/_/g, " ");
const shortDay = (iso) => formatDay(iso).replace(/, \d{4}$/, "");
const boughtLine = (row) => `Bought ${formatDay(row.purchased_on)} · Plan ${statusLabel(row)}`;
// profile_created_at is "YYYY-MM-DD HH:MM:SS" as stored; only the date is shown.
const createdLabel = (row) =>
  row.profile_created_at ? `Profile created ${formatDay(row.profile_created_at.slice(0, 10))}` : null;
const dayTimesLine = (row, day) =>
  `${formatDay(day)}: ${row.reading_times[day].map(formatTime).join(", ")}`;

// One card per number at the top. `show` and `sort` pick the popup's clients from the API,
// `details` is what the popup says about each one.
const CARDS = [
  {
    key: "paid",
    label: "Paid profiles",
    field: "paid_profiles",
    hint: "All clients with a paid plan this month, including those not signed up in the app yet.",
    show: "all",
    details: (row) => [boughtLine(row), `Last reading: ${formatDateTime(row.last_reading)}`],
  },
  {
    key: "took_today",
    label: "Took a reading today",
    field: "took_today",
    hint: "Number of clients who did at least one test today. A client who tested 3 times counts once.",
    tone: "text-[#308BF9]",
    todayOnly: true,
    show: "taken_today",
    sort: "name",
    details: (row, today) => [readingsLabel(row.today_count), dayTimesLine(row, today)],
  },
  {
    key: "missed_today",
    label: "Total reading missed today",
    // Linked clients with no test yet today: the chart's "pending" count for today.
    count: (res) => res?.charts?.daily?.find((d) => d.day === res.today)?.pending ?? 0,
    hint: "Clients signed up in the app who have not done any test today yet.",
    tone: "text-[#B5363A]",
    todayOnly: true,
    show: "pending_today",
    sort: "name",
    details: (row) => [boughtLine(row), `Last reading: ${formatDateTime(row.last_reading)}`],
  },
  {
    key: "first_today",
    label: "First reading today",
    field: "first_today",
    hint: "Clients who did their very first test ever today.",
    tone: "text-[#308BF9]",
    todayOnly: true,
    show: "first_today",
    sort: "name",
    details: (row) => [`First reading: ${formatDateTime(row.first_reading)}`],
  },
  {
    key: "first_month",
    label: "First reading this month",
    field: "first_month",
    hint: "Clients who did their very first test ever this month.",
    tone: "text-[#308BF9]",
    show: "first_month",
    sort: "name",
    details: (row) => [`First reading: ${formatDateTime(row.first_reading)}`],
  },
  {
    key: "never",
    label: "Never taken a reading",
    field: "never",
    hint: "Clients signed up in the app who have never done a single test.",
    tone: "text-[#A86A00]",
    show: "never",
    sort: "name",
    details: (row) => [boughtLine(row)],
  },
  {
    key: "days_taken",
    label: "Days with a reading",
    field: "taken_days",
    hint: "Every client's days with a test this month, added together. E.g. 2 clients who each tested on 3 days = 6.",
    tone: "text-[#1F7A4A]",
    show: "taken_month",
    sort: "most_taken",
    details: (row) => [
      `${row.taken_days.length} day${row.taken_days.length === 1 ? "" : "s"}: ${row.taken_days.map(shortDay).join(", ")}`,
    ],
  },
  {
    key: "total_readings",
    label: "Total readings",
    field: "readings",
    hint: "Total tests done this month by all clients. A client who tested 3 times in a day counts as 3.",
    tone: "text-[#1F7A4A]",
    show: "taken_month",
    sort: "most_taken",
    details: (row) => [readingsLabel(row.reading_count), ...row.taken_days.map((day) => dayTimesLine(row, day))],
  },
  {
    key: "days_missed",
    label: "Days without a reading",
    field: "missed_days",
    hint: "Every client's days with no test this month, added together. Counted from the day they paid; today is not counted.",
    tone: "text-[#B5363A]",
    show: "missed_month",
    sort: "most_missed",
    details: (row) => [
      `${row.missed_days.length} day${row.missed_days.length === 1 ? "" : "s"}: ${row.missed_days.map(shortDay).join(", ")}`,
    ],
  },
  {
    key: "no_reading",
    label: "No reading this month",
    field: "no_reading",
    hint: "Clients signed up in the app who have not done any test this month.",
    tone: "text-[#A86A00]",
    show: "no_reading",
    sort: "name",
    lastReadingColumn: true,
    details: (row) => [boughtLine(row)],
  },
  {
    key: "not_linked",
    label: "Not linked yet",
    field: "not_linked",
    hint: "Clients who paid but have not signed up in the app yet, so they cannot do tests.",
    tone: "text-[#A1A1A1]",
    show: "not_linked",
    sort: "name",
    details: (row) => [boughtLine(row)],
  },
];

const cardValue = (card, res) => (card.count ? card.count(res) : res?.summary?.[card.field]);

// Colour and icon for each card in the left column.
const CARD_LOOK = {
  paid: { tone: "dark" },
  took_today: { tone: "green" },
  missed_today: { tone: "red" },
  first_today: { tone: "green", icon: "plus" },
  first_month: { tone: "blue", icon: "star" },
  never: { tone: "orange", icon: "alert" },
  days_taken: { tone: "green", icon: "calendar" },
  total_readings: { tone: "blue", icon: "chart" },
  days_missed: { tone: "red", icon: "calendarX" },
  no_reading: { tone: "orange", icon: "pause" },
  not_linked: { tone: "muted", icon: "unlink" },
};

const TONE = {
  dark: { bg: "bg-[#252525]", text: "text-[#252525]", dot: "bg-[#252525]", ring: "ring-[#308BF9]" },
  blue: { bg: "bg-[#E9F3FF]", text: "text-[#308BF9]", dot: "bg-[#308BF9]", ring: "ring-[#308BF9]" },
  green: { bg: "bg-[#EAFFEF]", text: "text-[#3FAF58]", dot: "bg-[#3FAF58]", ring: "ring-[#3FAF58]" },
  red: { bg: "bg-[#FDECEE]", text: "text-[#E74C3C]", dot: "bg-[#E74C3C]", ring: "ring-[#E74C3C]" },
  orange: { bg: "bg-[#FFF4E1]", text: "text-[#E48326]", dot: "bg-[#E48326]", ring: "ring-[#E48326]" },
  muted: { bg: "bg-[#F5F7FA]", text: "text-[#738298]", dot: "bg-[#738298]", ring: "ring-[#738298]" },
};

const toneOf = (card) => TONE[CARD_LOOK[card.key]?.tone] || TONE.dark;

function MetricIcon({ type }) {
  const props = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true };
  switch (type) {
    case "chart":
      return (
        <svg {...props}>
          <path d="M3 12l2.5-3 2.5 1.5L11 6l2 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="5.5" cy="9.5" r="1" fill="currentColor" />
          <circle cx="8" cy="9.5" r="1" fill="currentColor" />
        </svg>
      );
    case "calendarX":
      return (
        <svg {...props}>
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6.5 9l3 3M9.5 9l-3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "star":
      return (
        <svg {...props}>
          <path d="M8 2l1.8 3.6L14 6.2l-3 2.9.7 4.1L8 11.3 4.3 13.2l.7-4.1-3-2.9 4.2-.6L8 2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case "alert":
      return (
        <svg {...props}>
          <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "pause":
      return (
        <svg {...props}>
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 9v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "unlink":
      return (
        <svg {...props}>
          <path d="M6.5 10l-1.5 1.5a2 2 0 002.8 2.8L9.5 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M9.5 6l1.5-1.5a2 2 0 00-2.8-2.8L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M3.5 12.5L12.5 3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function Pager({ pagination, page, loading, setPage }) {
  if (!(pagination?.total_pages > 1)) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={page <= 1 || loading}
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        className="rounded-full border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1 disabled:opacity-40 cursor-pointer"
      >
        Prev
      </button>
      <span className="text-[#535359] text-[11px]">
        Page {pagination.page} of {pagination.total_pages}
      </span>
      <button
        type="button"
        disabled={page >= pagination.total_pages || loading}
        onClick={() => setPage((p) => p + 1)}
        className="rounded-full border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1 disabled:opacity-40 cursor-pointer"
      >
        Next
      </button>
    </div>
  );
}

// Right-hand table: the clients behind the selected card, straight from the API.
function CardTable({ card, month, search, reloadKey, onOpenProfile, onClearSearch }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError("");
    fetchReadingTrackerService({
      month,
      show: card.show,
      sort: card.sort || "name",
      search,
      page,
      limit: POPUP_LIMIT,
    })
      .then((res) => {
        if (stale) return;
        if (res?.status === false) throw new Error(res.message);
        setData(res);
      })
      .catch((err) => {
        if (stale) return;
        setData(null);
        setError(err?.message || "Could not load these clients");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [card, month, search, page, reloadKey]);

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;
  const tone = toneOf(card);

  return (
    <div className="bg-white rounded-[15px] border border-[#E1E6ED] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-[#F5F7FA]">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${tone.dot}`} />
            <span className="text-[#252525] text-[13px] font-semibold tracking-[-0.26px]">
              {card.label}
            </span>
            <span className="rounded-full bg-[#F5F7FA] text-[#535359] text-[11px] font-semibold px-2 py-0.5 tabular-nums">
              {pagination?.total ?? (loading ? "…" : 0)}
            </span>
          </div>
          <p className="text-[#A1A1A1] text-[11px] mt-1 tracking-[-0.22px]">{card.hint}</p>
        </div>
        {search && (
          <button
            type="button"
            onClick={onClearSearch}
            className="text-[#A1A1A1] text-[11px] hover:text-[#252525] transition-colors cursor-pointer tracking-[-0.22px] shrink-0"
          >
            Clear search
          </button>
        )}
      </div>

      {error ? (
        <div className="m-4 bg-[#FDECEE] border border-[#F5C2C7] text-[#B02A37] rounded-[10px] p-3 text-[12px]">
          {error}
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#E1E6ED] border-t-[#308BF9] rounded-full animate-spin" />
            <span className="text-[#A1A1A1] text-[12px] tracking-[-0.24px]">Loading clients...</span>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-[#A1A1A1] text-[12px] tracking-[-0.24px]">
          {search ? "No clients match your search." : "No clients here."}
        </div>
      ) : (
        <div className={`max-h-[640px] overflow-auto ${loading ? "opacity-60" : ""}`}>
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F5F7FA] text-[#738298] text-left">
                <th className="py-2.5 px-5 font-medium w-10">#</th>
                <th className="py-2.5 px-4 font-medium">Client</th>
                <th className="py-2.5 px-4 font-medium">Profile ID</th>
                <th className="py-2.5 px-4 font-medium">Details</th>
                {card.lastReadingColumn && (
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">Last reading</th>
                )}
                <th className="py-2.5 px-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.profile_id || row.email || row.purchased_on}
                  className="border-t border-[#F5F7FA] hover:bg-[#F8FAFC] transition-colors align-top"
                >
                  <td className="py-3 px-5 text-[#A1A1A1] tabular-nums">
                    {((pagination?.page || 1) - 1) * POPUP_LIMIT + i + 1}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#F5F7FA] flex items-center justify-center text-[#738298] text-[11px] font-semibold shrink-0 uppercase">
                        {(row.name || row.email || "?").charAt(0)}
                      </div>
                      <div className="min-w-0">
                        {row.linked ? (
                          <button
                            type="button"
                            onClick={() => onOpenProfile(row)}
                            className="text-[#252525] font-medium hover:text-[#308BF9] text-left cursor-pointer tracking-[-0.24px]"
                          >
                            {row.name || row.profile_id}
                          </button>
                        ) : (
                          <div className="text-[#252525] font-medium tracking-[-0.24px]">{row.name || "–"}</div>
                        )}
                        <div className="text-[#535359] text-[11px] break-all">{row.email || "–"}</div>
                        {createdLabel(row) && (
                          <div className="text-[#A1A1A1] text-[10px] whitespace-nowrap">{createdLabel(row)}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#535359] font-mono text-[11px] whitespace-nowrap">
                    {row.profile_id || "No profile ID yet"}
                  </td>
                  <td className="py-3 px-4 text-[#535359] text-[11px] min-w-[200px]">
                    {card.details(row, data.today).map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </td>
                  {card.lastReadingColumn && (
                    <td className="py-3 px-4 text-[11px] whitespace-nowrap">
                      {row.last_reading ? (
                        <span className="text-[#252525] font-medium">{formatDateTime(row.last_reading)}</span>
                      ) : (
                        <span className="text-[#E48326] font-medium">Never tested</span>
                      )}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex rounded-full text-[10px] font-semibold px-2.5 py-0.5 capitalize whitespace-nowrap ${
                          STATUS_STYLES[row.subscription_status] || "bg-[#F1F3F5] text-[#535359]"
                        }`}
                      >
                        {statusLabel(row)}
                      </span>
                      {!row.linked && (
                        <span className="inline-flex rounded-full text-[10px] font-semibold px-2.5 py-0.5 bg-[#F5F7FA] text-[#738298] whitespace-nowrap">
                          Not linked
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination?.total_pages > 1 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#F5F7FA]">
          <span className="text-[#A1A1A1] text-[11px]">{pagination.total} clients</span>
          <Pager pagination={pagination} page={page} loading={loading} setPage={setPage} />
        </div>
      )}
    </div>
  );
}

function DayCell({ state, day, times }) {
  const style = CELL_STYLES[state];
  const detail = times
    ? `${readingsLabel(times.length)} at ${times.map(formatTime).join(", ")}`
    : style.label;
  return (
    <td className="p-[2px]">
      <div
        title={`${formatDay(day)}: ${detail}`}
        aria-label={`${formatDay(day)}: ${detail}`}
        className={`w-[22px] h-[22px] rounded-[4px] flex items-center justify-center text-[11px] font-bold ${style.cls}`}
      >
        {times ? times.length : style.mark}
      </div>
    </td>
  );
}

export default function ReadingTrackerPage() {
  const router = useRouter();

  const [month, setMonth] = useState(currentMonth);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(SORT_OPTIONS[0].value);
  const [show, setShow] = useState(SHOW_OPTIONS[0].value);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openProfileId, setOpenProfileId] = useState(null);
  const [activeKey, setActiveKey] = useState(CARDS[0].key);
  const [cardQ, setCardQ] = useState("");
  const [cardSearch, setCardSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setCardSearch(cardQ.trim()), 400);
    return () => clearTimeout(timer);
  }, [cardQ]);

  const clearCardSearch = useCallback(() => {
    setCardQ("");
    setCardSearch("");
  }, []);

  // Open reading lists belong to the rows on screen.
  useEffect(() => {
    setOpenProfileId(null);
  }, [month, search, sort, show, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError("");
    fetchReadingTrackerService({ month, search, sort, show, page, limit: PAGE_LIMIT })
      .then((res) => {
        if (stale) return;
        if (res?.status === false) throw new Error(res.message);
        setData(res);
      })
      .catch((err) => {
        if (stale) return;
        setData(null);
        setError(err?.message || "Could not load the reading tracker");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [month, search, sort, show, page, reloadKey]);

  // Day columns follow the month the data is for, so they never mismatch it mid-load.
  const days = useMemo(() => {
    if (!data?.month) return [];
    const [y, m] = data.month.split("-").map(Number);
    return Array.from({ length: data.days_in_month }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 1, i + 1));
      return {
        iso: date.toISOString().slice(0, 10),
        number: i + 1,
        weekday: WEEKDAYS[date.getUTCDay()],
      };
    });
  }, [data?.month, data?.days_in_month]);

  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const pagination = data?.pagination;
  // Today's numbers only exist while the current month is on screen.
  const showToday = !!data?.today && data.month === data.today.slice(0, 7);
  const columnCount = days.length + (showToday ? 6 : 5);
  const visibleCards = CARDS.filter((card) => !card.todayOnly || showToday);
  // A today-only card falls back to Paid profiles when a past month is picked.
  const activeCard = visibleCards.find((c) => c.key === activeKey) || CARDS[0];
  const heroCard = CARDS[0];
  const tileCards = visibleCards.filter((c) => c.key === "took_today" || c.key === "missed_today");
  const listCards = visibleCards.filter((c) => !["paid", "took_today", "missed_today"].includes(c.key));
  const pickCard = (card) => {
    setActiveKey(card.key);
    clearCardSearch();
  };
  const valueOrPulse = (card, pulseCls) =>
    loading && !summary ? (
      <span className={`inline-block rounded-[6px] animate-pulse ${pulseCls}`} />
    ) : (
      cardValue(card, data) ?? 0
    );

  const openProfile = (row) => {
    if (!row.profile_id) return;
    const params = new URLSearchParams({ profile_id: row.profile_id });
    if (row.partner_code) params.set("partner_code", row.partner_code);
    router.push(`/superadmin-trainer/clients-profile?${params.toString()}`);
  };

  const cellState = (takenSet, missedSet, pendingSet, iso) => {
    if (takenSet.has(iso)) return "taken";
    if (missedSet.has(iso)) return "missed";
    if (pendingSet.has(iso)) return "pending";
    return "none";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-semibold leading-tight tracking-[-0.4px]">
            Reading Tracker
          </h1>
          <p className="text-[#535359] text-[13px] mt-1 tracking-[-0.26px] max-w-[720px]">
            Clients with a successful payment in Orders › Payments, and the days they took or
            missed a breath reading. A day is marked missed once it has ended in US Pacific time.
            Reading dates and times are as stored with each test.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            aria-label="Month"
            value={month}
            max={currentMonth()}
            onChange={(e) => {
              if (!e.target.value) return;
              setMonth(e.target.value);
              setShow("all");
              setPage(1);
            }}
            className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-[#308BF9]"
          />
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="rounded-[15px] bg-[#252525] text-white text-[12px] font-semibold px-4 py-2 disabled:opacity-55 cursor-pointer hover:bg-[#3a3a3a] transition-colors tracking-[-0.24px] shadow-[0_4px_12px_rgba(37,37,37,0.18)]"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FDECEE] border border-[#F5C2C7] text-[#B02A37] rounded-[10px] p-3 text-[12px] tracking-[-0.24px]">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left: every number is a card; clicking one lists its clients on the right. */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => pickCard(heroCard)}
            aria-pressed={activeCard.key === heroCard.key}
            className={`text-left rounded-[15px] p-5 text-white bg-[#252525] transition-all duration-150 cursor-pointer ${
              activeCard.key === heroCard.key
                ? "ring-2 ring-[#308BF9] ring-offset-2"
                : "hover:ring-2 hover:ring-[#252525]/20 hover:ring-offset-1"
            }`}
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.4px] opacity-70">
              {heroCard.label}
            </div>
            <div className="text-[40px] font-bold leading-none mt-1 tracking-[-1px]">
              {valueOrPulse(heroCard, "w-14 h-10 bg-white/10")}
            </div>
            <div className="text-[11px] opacity-60 mt-2 tracking-[-0.22px]">{heroCard.hint}</div>
          </button>

          {tileCards.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {tileCards.map((card) => {
                const tone = toneOf(card);
                const isActive = activeCard.key === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => pickCard(card)}
                    aria-pressed={isActive}
                    title={card.hint}
                    className={`text-left rounded-[15px] p-4 transition-all duration-150 cursor-pointer ${tone.bg} ${
                      isActive ? `ring-2 ${tone.ring} ring-offset-2` : "hover:ring-2 hover:ring-black/5 hover:ring-offset-1"
                    }`}
                  >
                    <div className={`text-[10px] font-medium uppercase tracking-[0.3px] leading-tight ${tone.text}`}>
                      {card.label}
                    </div>
                    <div className={`text-[28px] font-bold leading-none mt-1.5 tracking-[-0.8px] ${tone.text}`}>
                      {valueOrPulse(card, "w-8 h-7 bg-black/5")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-[15px] border border-[#E1E6ED] overflow-hidden">
            {listCards.map((card, i) => {
              const tone = toneOf(card);
              const isActive = activeCard.key === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => pickCard(card)}
                  aria-pressed={isActive}
                  title={card.hint}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-all duration-150 ${
                    i < listCards.length - 1 ? "border-b border-[#F5F7FA]" : ""
                  } ${isActive ? "bg-[#F0F7FF]" : "hover:bg-[#FAFBFC]"}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${tone.bg} ${tone.text}`}>
                      <MetricIcon type={CARD_LOOK[card.key]?.icon} />
                    </div>
                    <span
                      className={`text-[12px] text-left tracking-[-0.24px] ${
                        isActive ? "text-[#252525] font-semibold" : "text-[#535359]"
                      }`}
                    >
                      {card.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[14px] font-bold tracking-[-0.28px] tabular-nums ${tone.text}`}>
                      {valueOrPulse(card, "w-6 h-4 bg-[#F5F7FA]")}
                    </span>
                    {isActive && (
                      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-[#308BF9]" aria-hidden>
                        <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: the selected card's clients. */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              aria-label={`Search ${activeCard.label}`}
              placeholder="Search by name, email, or profile ID..."
              value={cardQ}
              onChange={(e) => setCardQ(e.target.value)}
              className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-3 py-2.5 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] focus:outline-none focus:border-[#308BF9] focus:shadow-[0_0_0_3px_rgba(48,139,249,0.08)] transition-all tracking-[-0.24px]"
            />
          </div>
          <CardTable
            key={`${activeCard.key}|${month}|${cardSearch}`}
            card={activeCard}
            month={month}
            search={cardSearch}
            reloadKey={reloadKey}
            onOpenProfile={openProfile}
            onClearSearch={clearCardSearch}
          />
        </div>
      </div>

      {data?.charts && <ReadingTrackerCharts charts={data.charts} today={data.today} />}

      {data?.leaders && (
        <ReadingTrackerLeaders
          key={data.month}
          leaders={data.leaders}
          summary={data.summary}
          month={data.month}
          daysInMonth={data.days_in_month}
          today={data.today}
          onOpenProfile={openProfile}
        />
      )}

      <div>
        <h2 className="text-[#252525] text-[15px] font-semibold tracking-[-0.3px]">Day-by-day calendar</h2>
        <p className="text-[#535359] text-[12px] mt-0.5">Every client&apos;s readings for each day of the month.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the calendar"
          placeholder="Search by name, email, or profile ID"
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] flex-1 min-w-[240px] focus:outline-none focus:border-[#308BF9]"
        />
        <select
          aria-label="Show"
          value={show}
          onChange={(e) => {
            setShow(e.target.value);
            setPage(1);
          }}
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px]"
        >
          {SHOW_OPTIONS.filter((o) => !o.todayOnly || month === currentMonth()).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-4 text-[11px] text-[#535359]">
        {["taken", "missed", "pending", "none"].map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span
              className={`w-[16px] h-[16px] rounded-[4px] inline-flex items-center justify-center text-[10px] font-bold ${CELL_STYLES[key].cls}`}
            >
              {CELL_STYLES[key].mark}
            </span>
            {CELL_STYLES[key].label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED] bg-white">
        <table className="w-full text-[12px] border-separate border-spacing-0">
          <thead>
            <tr className="bg-[#F5F7FA] text-[#535359] text-left">
              <th className="sticky left-0 z-10 bg-[#F5F7FA] py-2.5 px-3 font-semibold min-w-[200px]">
                Client
              </th>
              {days.map((d) => (
                <th
                  key={d.iso}
                  className={`p-[2px] text-center font-semibold text-[10px] leading-tight ${
                    d.iso === data.today ? "text-[#308BF9]" : ""
                  }`}
                >
                  <div>{d.number}</div>
                  <div className="font-normal text-[#A1A1A1]">{d.weekday}</div>
                </th>
              ))}
              {showToday && (
                <th className="py-2.5 px-3 font-semibold text-right text-[#308BF9]">Today</th>
              )}
              <th className="py-2.5 px-2 font-semibold text-right">Days taken</th>
              <th className="py-2.5 px-3 font-semibold text-right">Readings</th>
              <th className="py-2.5 px-3 font-semibold text-right">Missed</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Last reading</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(columnCount, 1)} className="py-8 px-4 text-center text-[#A1A1A1]">
                  {loading
                    ? "Loading..."
                    : error
                    ? "Could not load this month."
                    : show !== "all" || search
                    ? "No clients match your filters."
                    : "No paid profiles for this month."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const takenSet = new Set(row.taken_days);
                const missedSet = new Set(row.missed_days);
                const pendingSet = new Set(row.pending_days);
                const isOpen = row.linked && openProfileId === row.profile_id;
                return (
                  <Fragment key={row.profile_id || row.email || row.purchased_on}>
                  <tr className="group hover:bg-[#F5F7FA]">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F5F7FA] py-2 px-3 border-t border-[#F5F7FA]">
                      {row.linked ? (
                        <button
                          type="button"
                          onClick={() => openProfile(row)}
                          className="text-[#252525] font-semibold hover:text-[#308BF9] text-left cursor-pointer"
                        >
                          {row.name || row.profile_id}
                        </button>
                      ) : (
                        <div className="text-[#252525] font-semibold">{row.name || "–"}</div>
                      )}
                      <div className="text-[#A1A1A1] text-[11px] break-all">{row.email || "–"}</div>
                      <div className="text-[#535359] text-[11px] font-mono">
                        {row.profile_id || "No profile ID yet"}
                      </div>
                      {createdLabel(row) && (
                        <div className="text-[#A1A1A1] text-[10px] whitespace-nowrap">{createdLabel(row)}</div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 capitalize ${
                            STATUS_STYLES[row.subscription_status] || "bg-[#F1F3F5] text-[#535359]"
                          }`}
                        >
                          {(row.subscription_status || "unknown").replace(/_/g, " ")}
                        </span>
                        <span className="text-[#A1A1A1] text-[10px] whitespace-nowrap">
                          Bought {formatDay(row.purchased_on)}
                        </span>
                      </div>
                      {row.first_reading ? (
                        <div
                          className={`text-[10px] mt-1 ${
                            row.first_reading.startsWith(data.today)
                              ? "text-[#308BF9] font-semibold"
                              : "text-[#A1A1A1]"
                          }`}
                        >
                          First reading {formatDateTime(row.first_reading)}
                        </div>
                      ) : (
                        row.linked && (
                          <div className="text-[#A86A00] text-[10px] font-semibold mt-1">
                            Never taken a reading
                          </div>
                        )
                      )}
                      {row.reading_count > 0 && (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenProfileId(isOpen ? null : row.profile_id)}
                          className="mt-1 text-[#308BF9] text-[11px] font-semibold cursor-pointer"
                        >
                          {isOpen ? "Hide date & time" : "View date & time"}
                        </button>
                      )}
                    </td>
                    {row.linked ? (
                      days.map((d) => (
                        <DayCell
                          key={d.iso}
                          day={d.iso}
                          state={cellState(takenSet, missedSet, pendingSet, d.iso)}
                          times={row.reading_times?.[d.iso]}
                        />
                      ))
                    ) : (
                      <td
                        colSpan={days.length}
                        className="px-3 text-center text-[#A1A1A1] text-[11px] border-t border-[#F5F7FA]"
                      >
                        Not linked yet: this buyer hasn&apos;t connected an app profile
                      </td>
                    )}
                    {showToday && (
                      <td
                        className={`py-2 px-3 text-right font-semibold tabular-nums border-t border-[#F5F7FA] ${
                          row.today_count > 0 ? "text-[#308BF9]" : "text-[#A1A1A1]"
                        }`}
                      >
                        {row.today_count > 0 ? row.today_count : row.pending_days.length > 0 ? 0 : "–"}
                      </td>
                    )}
                    <td className="py-2 px-3 text-right font-semibold text-[#1F7A4A] tabular-nums border-t border-[#F5F7FA]">
                      {row.linked ? row.taken_days.length : "–"}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-[#1F7A4A] tabular-nums border-t border-[#F5F7FA]">
                      {row.linked ? row.reading_count : "–"}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-[#B5363A] tabular-nums border-t border-[#F5F7FA]">
                      {row.linked ? row.missed_days.length : "–"}
                    </td>
                    <td className="py-2 px-3 text-[#535359] min-w-[92px] border-t border-[#F5F7FA]">
                      {formatDateTime(row.last_reading)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={columnCount} className="bg-[#F5F7FA] px-3 py-3">
                        <div className="text-[#535359] text-[11px] mb-2">
                          {row.name || row.profile_id}: {readingsLabel(row.reading_count)} on{" "}
                          {row.taken_days.length} day{row.taken_days.length === 1 ? "" : "s"}.
                          Times are as stored with each test.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.taken_days.map((day) => (
                            <div
                              key={day}
                              className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[11px]"
                            >
                              <div className="text-[#252525] font-semibold whitespace-nowrap">
                                {formatDay(day)}
                                <span className="text-[#1F7A4A]">
                                  {" · "}
                                  {readingsLabel(row.reading_times[day].length)}
                                </span>
                              </div>
                              {row.reading_times[day].map((time, i) => (
                                <div key={`${time}-${i}`} className="text-[#535359] tabular-nums">
                                  {formatTime(time)}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination?.total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-[#A1A1A1] text-[11px]">
            <span className="text-[#252525] font-semibold">{pagination.total}</span> profiles
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1 disabled:opacity-40 cursor-pointer"
            >
              Prev
            </button>
            <span className="text-[#535359] text-[11px]">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              type="button"
              disabled={page >= pagination.total_pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
