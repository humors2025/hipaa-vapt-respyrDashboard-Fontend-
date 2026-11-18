// Product analytics (Amplitude).
//
// Turned on only where NEXT_PUBLIC_AMPLITUDE_API_KEY is set (UAT today), so
// every call here is a safe no-op on environments without a key.
//
// PRIVACY: this is a health product. Send internal IDs, roles and feature
// names only — never names, emails, phone numbers, readings, weights or food
// logs. Page views carry the path only (no query string, which can hold reset
// tokens or emails), and all automatic capture except sessions is off.

import * as amplitude from "@amplitude/analytics-browser";

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || "";

let started = false;
let currentUserId = null;

export function analyticsEnabled() {
  return Boolean(API_KEY) && typeof window !== "undefined";
}

export function initAnalytics() {
  if (started || !analyticsEnabled()) return;
  amplitude.init(API_KEY, {
    autocapture: {
      sessions: true,
      pageViews: false, // tracked by hand in AnalyticsTracker (path only)
      attribution: false,
      formInteractions: false,
      fileDownloads: false,
      elementInteractions: false,
      // Would add the full page URL (query string included) to every event.
      pageUrlEnrichment: false,
    },
    // Keep capture settings in code; don't let the Amplitude UI switch on
    // autocapture (clicks, forms) remotely.
    fetchRemoteConfig: false,
  });
  started = true;
}

// Amplitude needs a user id of at least 5 characters; prefix the internal id.
// Legacy sessions may only carry an email as the id — never send that.
function toAnalyticsId(user) {
  const candidates = [user?.user_id, user?.partner_code];
  const id = candidates.find((v) => v != null && v !== "" && !String(v).includes("@"));
  return id == null ? null : `user-${id}`;
}

// Point Amplitude at the logged-in user (or back to anonymous after logout).
// `realUser` is the person at the keyboard; during super-admin "View as" it is
// the super admin, not the account being viewed.
export function syncAnalyticsUser(realUser, { viewingAsRole = null } = {}) {
  if (!started) return;
  const id = realUser ? toAnalyticsId(realUser) : null;

  if (!id) {
    if (currentUserId) {
      amplitude.reset();
      currentUserId = null;
    }
    return;
  }

  if (id !== currentUserId) {
    if (currentUserId) amplitude.reset();
    amplitude.setUserId(id);
    currentUserId = id;
  }

  const identify = new amplitude.Identify()
    .set("role", realUser.role || "unknown")
    .set("environment", process.env.NEXT_PUBLIC_APP_ENV || "uat")
    .set("viewing_as_role", viewingAsRole || "none");
  amplitude.identify(identify);
}

// Track a product event. Keep properties free of personal or health data.
export function trackEvent(name, properties) {
  if (!started) return;
  amplitude.track(name, properties);
}
