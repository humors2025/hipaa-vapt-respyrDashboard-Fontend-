"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchReadingTrackerService } from "@/services/superAdminReadingTrackerService";

const PAGE_LIMIT = 20;

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

function SummaryCard({ label, value, tone = "text-[#252525]" }) {
  return (
    <div className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5">
      <div className="text-[#A1A1A1] text-[11px]">{label}</div>
      <div className={`text-[16px] font-bold mt-0.5 ${tone}`}>{value ?? 0}</div>
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
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            Reading Tracker
          </h1>
          <p className="text-[#535359] text-[13px] mt-1">
            Clients with a successful payment in Orders › Payments, and the days they took or
            missed a breath reading. A day is marked missed once it has ended in US Pacific time.
            Reading dates and times are as stored with each test.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 disabled:opacity-60 cursor-pointer"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] rounded-[10px] p-3 text-[12px]">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <SummaryCard label="Paid profiles" value={summary.paid_profiles} />
          {showToday && (
            <>
              <SummaryCard label="Took a reading today" value={summary.took_today} tone="text-[#308BF9]" />
              <SummaryCard label="Readings today" value={summary.readings_today} tone="text-[#308BF9]" />
              <SummaryCard label="First reading today" value={summary.first_today} tone="text-[#308BF9]" />
            </>
          )}
          <SummaryCard label="First reading this month" value={summary.first_month} tone="text-[#308BF9]" />
          <SummaryCard label="Never taken a reading" value={summary.never} tone="text-[#A86A00]" />
          <SummaryCard label="Days taken" value={summary.taken_days} tone="text-[#1F7A4A]" />
          <SummaryCard label="Total readings" value={summary.readings} tone="text-[#1F7A4A]" />
          <SummaryCard label="Days missed" value={summary.missed_days} tone="text-[#B5363A]" />
          <SummaryCard label="No reading this month" value={summary.no_reading} tone="text-[#A86A00]" />
          <SummaryCard label="Not linked yet" value={summary.not_linked} tone="text-[#A1A1A1]" />
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or profile ID"
          className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[12px] flex-1 min-w-[240px] focus:outline-none focus:border-[#308BF9]"
        />
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
