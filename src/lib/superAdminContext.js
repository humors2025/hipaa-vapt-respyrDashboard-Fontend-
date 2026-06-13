import Cookies from "js-cookie";

const STORAGE_KEY = "sa_partner_code";

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

export function isSuperAdmin() {
  if (typeof window === "undefined") return false;
  const token = Cookies.get("access_token");
  const decoded = token ? decodeJwt(token) : null;
  return decoded?.role === "super_admin";
}

export function setSuperAdminPartnerCode(code) {
  if (typeof window === "undefined") return;
  if (code) sessionStorage.setItem(STORAGE_KEY, code);
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function clearSuperAdminPartnerCode() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getSuperAdminPartnerCode() {
  if (typeof window === "undefined") return null;
  if (!isSuperAdmin()) return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(
      "partner_code"
    );
    if (fromUrl) return fromUrl;
  } catch {
    // ignore and fall back to sessionStorage
  }
  return sessionStorage.getItem(STORAGE_KEY) || null;
}
