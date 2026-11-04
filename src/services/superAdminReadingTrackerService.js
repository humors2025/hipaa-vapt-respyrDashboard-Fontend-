// Super Admin › Client › Reading Tracker — the days each paid profile took or
// missed a breath reading in one month. Read-only.
//
// POST /v1/dietitian/api/web/super-admin-reading-tracker (super_admin only),
// backend controller super-admin-reading-tracker.js.
//
// → { status, month, today, days_in_month,
//     summary: { paid_profiles, not_linked, taken_days, readings, missed_days, no_reading },
//     rows: [ { profile_id, linked, name, email, partner_code, plan_code,
//               subscription_status, purchased_on, taken_days: ["YYYY-MM-DD"],
//               reading_times: { "YYYY-MM-DD": ["HH:MM:SS"] } (every test on a taken day,
//               as stored), reading_count, missed_days: [...], pending_days: [...],
//               last_reading: "YYYY-MM-DD HH:MM:SS" } ],
//     pagination: { page, limit, total, total_pages } }

import { apiFetcher } from "@/config/fetcher";
import { API_ENDPOINTS } from "@/config/apiConfig";

export const fetchReadingTrackerService = async ({
  month,
  search = "",
  sort = "most_missed",
  page = 1,
  limit = 20,
}) =>
  apiFetcher(API_ENDPOINTS.SALES.SUPERADMINREADINGTRACKER, {
    method: "POST",
    body: JSON.stringify({
      month,
      sort,
      ...(search ? { search } : {}),
      page,
      limit,
    }),
    timeoutMs: 29000,
  });
