// src/lib/clientLogger.js
//
// Fire-and-forget client-side event logger.
//
// Sends UI interaction events (button clicks etc.) to the backend:
//   POST {API_BASE_URL}/v1/dietitian/api/web/client-logs
// which writes them to MySQL (app_client_logs) + CloudWatch.
//
// Design rules:
//   - NEVER throws, NEVER blocks the UI. A failed log must not break signup.
//   - Uses fetch with { keepalive: true } so the request survives an
//     immediate navigation (e.g. Decline -> router.push("/")).
//   - NEVER send PHI/secrets in meta: no passwords, tokens, emails, or names.
//     Booleans, counts, and page identifiers only.
//   - event_name must exist in the backend whitelist (client-logs.js), or
//     the backend will reject it with 400.

import { API_BASE_URL, API_ENDPOINTS } from "@/config/apiConfig";

export function logClientEvent(event_name, meta = null, page = null) {
  try {
    const payload = {
      event_name,
      // Prefer a human-readable screen name (e.g. "Terms and condition page")
      // when the caller provides one; otherwise fall back to the URL path.
      // NOTE: never includes the ?token=... query string.
      page:
        page ||
        (typeof window !== "undefined" && window.location
          ? window.location.pathname
          : null),
      meta,
      ts: new Date().toISOString(),
    };

    fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGS.CLIENT_EVENTS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // survives immediate route changes
    }).catch(() => {
      /* swallow — logging must never surface errors to the user */
    });
  } catch {
    /* swallow */
  }
}