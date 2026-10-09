// Super Admin audit log — the backend's app_auth_logs table: every sign-in,
// token refresh, API request (one row per call from the global audit
// middleware) and privileged action, each with success/failure and a reason.
//
// GET /v1/dietitian/api/web/audit-logs (backend controller audit-logs.js).
// Authorised: an active super_admin whose email is on the backend's
// AUDIT_LOG_ALLOWED_EMAILS list (connect@respyr.in unless the Lambda sets
// otherwise). Anyone else gets 403 and an audit_logs_denied row. Every
// successful call writes an audit_logs_viewed row (page, limit, filtered).
//
// Query: page, limit (max 100), search (LIKE over event, user, role, code,
//        reason), event_type, user_id, role, partner_code, success (1|0),
//        ip_address (hashed server-side before comparing), date_from /
//        date_to (YYYY-MM-DD, inclusive), exclude_role (comma-separated).
// → { ok, summary: { filtered_total, today_total, unique_event_types,
//      security_events }, event_types: [...], roles: [...],
//      logs: [ { id, event_type, user_id (email), role, partner_code,
//      success (bool), failure_reason (reason on failure, free-text details
//      on success), ip_hash, user_agent_hash, created_at ("YYYY-MM-DD
//      HH:mm:ss", UTC wall clock) } ],
//      pagination: { page, limit, total, total_pages, has_next, has_prev } }
//
// GET /v1/dietitian/api/web/audit-logs/live?after_id=N — rows with id > N,
// oldest first, max 100, never audit_logs_viewed. Writes nothing, so it is
// safe to poll. → { ok, logs, new_count, after_id, next_after_id, has_more }
//
// Super-admin activity is hidden on purpose (EXCLUDED_ROLES) — it is not yet
// decided whether it belongs on this page, and the super admin's own
// audit_logs_viewed rows would otherwise crowd page 1. The backend applies
// exclude_role to rows, counts, dropdowns and the live feed once deployed
// with that parameter; isHiddenRole drops such rows client-side as well, so
// an older backend still never shows them (its counts then include them).
// Rows with no role (anonymous failed logins) are never hidden.

import { apiFetcher } from "@/config/fetcher";
import { API_ENDPOINTS } from "@/config/apiConfig";

export const AUDIT_SEARCH_MIN_LENGTH = 3;
export const AUDIT_PAGE_LIMIT = 20;
export const AUDIT_LIVE_INTERVAL_MS = 5000;
export const EXCLUDED_ROLES = ["super_admin"];

export const isHiddenRole = (role) => EXCLUDED_ROLES.includes(String(role || "").toLowerCase());

function withQuery(endpoint, params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, String(value));
  });
  const s = qs.toString();
  return s ? `${endpoint}?${s}` : endpoint;
}

const get = (endpoint, params, timeoutMs) => apiFetcher(withQuery(endpoint, params), { method: "GET", timeoutMs });

export const fetchAuditLogsService = async ({
  page = 1,
  limit = AUDIT_PAGE_LIMIT,
  search = "",
  event_type = "",
  role = "",
  success = "",
  ip_address = "",
  date_from = "",
  date_to = "",
} = {}) =>
  get(
    API_ENDPOINTS.AUDIT.LOGS,
    { page, limit, search, event_type, role, success, ip_address, date_from, date_to, exclude_role: EXCLUDED_ROLES.join(",") },
    29000
  );

export const fetchAuditLogsLiveService = async ({ after_id }) =>
  get(API_ENDPOINTS.AUDIT.LOGSLIVE, { after_id, exclude_role: EXCLUDED_ROLES.join(",") }, 15000);
