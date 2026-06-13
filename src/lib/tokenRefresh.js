// Access-token refresh. The login access token is short-lived (15 min); this
// module exchanges the stored refresh_token for a fresh access token (and a
// rotated refresh token) via POST /v1/auth/refresh-token.
//
// apiFetcher calls refreshAccessToken() on a 401 and retries the original
// request once. A module-level in-flight promise makes this single-flight: if
// several requests 401 at the same time, they all await ONE refresh call
// instead of stampeding the endpoint (and racing to overwrite cookies).

import Cookies from "js-cookie";
import { API_BASE_URL, API_ENDPOINTS } from "../config/apiConfig";
import { persistRefreshedTokens } from "./user";

let refreshPromise = null;

// Returns the new access token string on success, or null if refresh is not
// possible (no refresh token, network/HTTP error, or non-browser context).
export function refreshAccessToken() {
  // Cookies (js-cookie) only work in the browser; on the server (Next.js route
  // handlers) there's no refresh token to read, so bail out cleanly.
  if (typeof document === "undefined") {
    return Promise.resolve(null);
  }

  // Coalesce concurrent callers onto a single in-flight refresh.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = Cookies.get("refresh_token");
    if (!refreshToken) return null;

    try {
      const res = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }
      );

      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.ok || !data?.access_token) return null;

      persistRefreshedTokens(data);
      return data.access_token;
    } catch {
      return null;
    }
  })();

  // Clear the in-flight handle once settled so the next 401 can refresh again.
  return refreshPromise.finally(() => {
    refreshPromise = null;
  });
}

// Wipe auth cookies and send the user back to login. Called when refresh fails
// (refresh token missing/expired/revoked) — the session is unrecoverable.
export function clearAuthAndRedirect() {
  if (typeof window === "undefined") return;

  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
  Cookies.remove("user");
  Cookies.remove("dietician");

  // Avoid redirect loops if we're already on the login page.
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
}
