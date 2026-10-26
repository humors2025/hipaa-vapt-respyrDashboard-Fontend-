// Super-admin "View as" (read-only impersonation) — client-side session swap.
//
// startViewAsService (services/viewAsService.js) returns an access token that
// carries the TARGET user's identity plus `view_only: true` and
// `impersonated_by: <super admin email>`. Entering a view saves the super
// admin's own token + identity cookies in va_original_* cookies, then writes
// the view token through persistLoginResponse so every existing reader
// (Header, middleware, services decoding the JWT) sees the target's identity.
// Exiting restores the saved cookies.
//
// The view token cannot be refreshed (the backend never returns its refresh
// token), so when it expires apiFetcher's silent refresh brings back the super
// admin's own token — the view simply ends. cleanupStaleViewAs() removes the
// leftover va_* cookies when that happens.

import Cookies from "js-cookie";
import { cookieManager } from "@/lib/cookies";
import { persistLoginResponse } from "@/lib/user";

const ORIGINAL_TOKEN_KEY = "va_original_token";
const ORIGINAL_USER_KEY = "va_original_user";
const ORIGINAL_DIETICIAN_KEY = "va_original_dietician";

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// The decoded view-as claims when the CURRENT access token is a view session,
// else null. { email, name, role, impersonated_by, exp }
export function getViewAsInfo() {
  if (typeof window === "undefined") return null;
  const token = Cookies.get("access_token");
  const decoded = token ? decodeJwt(token) : null;
  if (!decoded?.impersonated_by) return null;
  return {
    email: decoded.user_id || decoded.email || null,
    name: decoded.dietician?.name || null,
    role: decoded.role || null,
    impersonated_by: decoded.impersonated_by,
    exp: decoded.exp || null,
  };
}

export function isViewAs() {
  return !!getViewAsInfo();
}

// Swap the session to the view token. Call with the access_token returned by
// startViewAsService while still logged in as the super admin.
export function enterViewAs(accessToken) {
  if (typeof window === "undefined" || !accessToken) return false;

  // Never stack views: keep the ORIGINAL super-admin session if one is
  // already saved (entering a second view from inside a first).
  if (!Cookies.get(ORIGINAL_TOKEN_KEY)) {
    const token = Cookies.get("access_token");
    if (!token) return false;
    cookieManager.set(ORIGINAL_TOKEN_KEY, token);
    const user = Cookies.get("user");
    if (user) cookieManager.set(ORIGINAL_USER_KEY, user);
    const dietician = Cookies.get("dietician");
    if (dietician) cookieManager.set(ORIGINAL_DIETICIAN_KEY, dietician);
  }

  // Writes access_token + user + dietician cookies from the token payload.
  persistLoginResponse({ access_token: accessToken });
  return true;
}

// Restore the super admin's own session. Returns true when something was
// restored. The view session row expires server-side on its own (VIEW_AS_TTL).
export function exitViewAs() {
  if (typeof window === "undefined") return false;

  const originalToken = Cookies.get(ORIGINAL_TOKEN_KEY);
  if (!originalToken) return false;

  cookieManager.set("access_token", originalToken);
  const user = Cookies.get(ORIGINAL_USER_KEY);
  if (user) cookieManager.set("user", user);
  const dietician = Cookies.get(ORIGINAL_DIETICIAN_KEY);
  if (dietician) cookieManager.set("dietician", dietician);

  clearSavedOriginal();
  return true;
}

// The view token expired and silent refresh already restored the super admin's
// own session: drop the now-useless saved copies.
export function cleanupStaleViewAs() {
  if (typeof window === "undefined") return;
  if (!isViewAs() && Cookies.get(ORIGINAL_TOKEN_KEY)) {
    clearSavedOriginal();
  }
}

function clearSavedOriginal() {
  cookieManager.remove(ORIGINAL_TOKEN_KEY);
  cookieManager.remove(ORIGINAL_USER_KEY);
  cookieManager.remove(ORIGINAL_DIETICIAN_KEY);
}
