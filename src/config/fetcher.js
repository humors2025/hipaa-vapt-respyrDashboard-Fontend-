// config/fetcher.js
import Cookies from "js-cookie";
import { API_BASE_URL, API_ENDPOINTS } from "./apiConfig";
import { refreshAccessToken, clearAuthAndRedirect } from "../lib/tokenRefresh";

// Endpoints that must NEVER trigger the refresh-and-retry flow: a 401 here is a
// real credential failure (bad login, dead refresh token), not an expired
// access token, so retrying would loop.
const NO_REFRESH_ENDPOINTS = [
  API_ENDPOINTS.AUTH.LOGIN,
  API_ENDPOINTS.AUTH.REFRESH_TOKEN,
];

export async function apiFetcher(endpoint, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;

  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = timeoutMs
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  // Builds the request, attaching the bearer token automatically. Uses the
  // refreshed token on the post-refresh retry, otherwise the current
  // access_token cookie — so individual callers don't have to set the
  // Authorization header themselves. A token a caller passes explicitly in
  // options.headers still wins (it's spread last over the default below).
  const doFetch = (overrideToken) => {
    const token = overrideToken || Cookies.get("access_token");
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      signal: controller?.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers || {}),
        ...(overrideToken
          ? { Authorization: `Bearer ${overrideToken}` }
          : {}),
      },
    });
  };

  try {
    let res = await doFetch();

    // Access token likely expired → refresh once and retry the original call.
    if (
      res.status === 401 &&
      !NO_REFRESH_ENDPOINTS.some((e) => endpoint.startsWith(e))
    ) {
      const newToken = await refreshAccessToken();

      if (newToken) {
        res = await doFetch(newToken);
      } else {
        // Refresh failed: session is unrecoverable. Clear and bounce to login.
        clearAuthAndRedirect();
      }
    }

    // Check content type and content length before parsing JSON
    const contentType = res.headers.get("content-type");
    const contentLength = res.headers.get("content-length");
    
    let data = null;
    
    // Only parse JSON if there's actual content
    if (contentType && contentType.includes("application/json") && contentLength !== "0") {
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        // If JSON parsing fails, treat as empty response
        data = null;
      }
    } else if (contentLength === "0" || !contentType) {
      // Empty response body
      console.warn("Empty response body for endpoint:", endpoint);
      data = null;
    }

    const apiSaysFail = data?.ok === false || data?.success === false;

    if (!res.ok || apiSaysFail) {
      const errorMessage =
        data?.error || data?.message || `Request failed with status ${res.status}`;

      const error = new Error(errorMessage);
      error.status = res.status;
      error.data = data;
      error.isApiError = true;
      throw error;
    }

    return data;
  } catch (error) {
    // AbortError => timeout by us
    if (error?.name === "AbortError") {
      const e = new Error(`Request timed out after ${timeoutMs} ms`);
      e.status = 408;
      e.isApiError = true;
      throw e;
    }

    if (!error.isApiError) {
      console.error("API Fetch Error:", error);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

