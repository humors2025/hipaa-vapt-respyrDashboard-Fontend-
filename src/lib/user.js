// User resolution and role helpers.
//
// The auth model is migrating from a single `dietician` cookie to a `user`
// cookie carrying role + hierarchy info (per HIERARCHY_AND_ONBOARDING_SPEC.md
// Phase 0). During the transition this module is the single source of truth
// for "who is the current user" — it reads the new cookie when present and
// falls back to translating the old `dietician` cookie when not.
//
// Existing code (Header, etc.) that reads the `dietician` cookie directly
// keeps working because login response writers always set BOTH cookies until
// the migration is complete.

import { cookieManager } from "@/lib/cookies";

export const ROLES = Object.freeze({
  SUPER_ADMIN: "super_admin",
  TRAINER_ADMIN: "trainer_admin",
  TRAINER: "trainer",
  CLIENT: "client",
});

const ROLE_ALIASES = Object.freeze({
  admin: ROLES.TRAINER_ADMIN,
  trainer_admin: ROLES.TRAINER_ADMIN,
  super_admin: ROLES.SUPER_ADMIN,
  trainer: ROLES.TRAINER,
  dietician: ROLES.TRAINER,
  client: ROLES.CLIENT,
});

// Resolve the current user from cookies. Returns a normalized shape OR null
// if no auth cookie is set. Prefers the new `user` cookie; falls back to
// translating the legacy `dietician` cookie so this works during migration.
export function getCurrentUser() {
  const fromNew = cookieManager.getJSON("user");
  if (fromNew && typeof fromNew === "object") {
    return normalizeUser(fromNew);
  }

  const legacy = cookieManager.getJSON("dietician");
  if (legacy && typeof legacy === "object") {
    return translateLegacyDietician(legacy);
  }

  return null;
}

export function getCurrentRole() {
  return getCurrentUser()?.role || null;
}

export function hasRole(role) {
  return getCurrentRole() === normalizeRole(role);
}

// Persist the login response into cookies. Writes BOTH the new `user` cookie
// and the legacy `dietician` cookie so existing code that reads the legacy
// shape continues working until Phase 1 cleanup. Also sets `access_token`.
export function persistLoginResponse(res) {
  if (!res) return;

  const tokenPayload = decodeJwtPayload(res.access_token);

  if (res.access_token) {
    cookieManager.set("access_token", res.access_token);
  }

  // Persist the refresh token so apiFetcher can silently renew the short-lived
  // (15 min) access token. The backend rotates it on every refresh, so this is
  // re-written each time too (see persistRefreshedTokens). Cookie lifetime
  // follows refresh_expires_in (seconds → days), defaulting to 30 days.
  
  // if (res.refresh_token) {
  //   cookieManager.set("refresh_token", res.refresh_token, {
  //     expires: res.refresh_expires_in ? res.refresh_expires_in / 86400 : 30,
  //   });
  // }

  // New shape
  if (res.user && typeof res.user === "object") {
    const user = normalizeUser({
      ...tokenPayload,
      ...res.user,
      role: res.user.role ?? tokenPayload?.role,
    });

    cookieManager.set("user", JSON.stringify(user));
    cookieManager.set("dietician", JSON.stringify(legacyShapeFromUser(user)));
    return;
  }

  // Legacy shape
  if (res.dietician && typeof res.dietician === "object") {
    const legacyWithRole = {
      ...res.dietician,
      role: res.dietician.role ?? tokenPayload?.role,
      user_id: tokenPayload?.user_id ?? res.dietician.user_id,
      email: res.dietician.email ?? tokenPayload?.email,
      parent_user_id: tokenPayload?.parent_user_id ?? res.dietician.parent_user_id,
      partner_code: tokenPayload?.partner_code ?? res.dietician.partner_code,
    };

    cookieManager.set("dietician", JSON.stringify(legacyWithRole));

    const translated = translateLegacyDietician(legacyWithRole);
    cookieManager.set("user", JSON.stringify(translated));
    return;
  }

  // If backend only sends access_token
  if (tokenPayload) {
    const user = normalizeUser(tokenPayload);
    cookieManager.set("user", JSON.stringify(user));
    cookieManager.set("dietician", JSON.stringify(legacyShapeFromUser(user)));
  }
}

// Persist ONLY the rotated tokens from a refresh-token response. Unlike
// persistLoginResponse this deliberately leaves the `user`/`dietician` cookies
// untouched — the refresh JWT carries less profile detail than the login
// payload, so we keep the identity cookies set at login time.
export function persistRefreshedTokens(res) {
  if (!res?.access_token) return;

  cookieManager.set("access_token", res.access_token);

  // if (res.refresh_token) {
  //   cookieManager.set("refresh_token", res.refresh_token, {
  //     expires: res.refresh_expires_in ? res.refresh_expires_in / 86400 : 30,
  //   });
  // }
}

// Pick the route a logged-in user should land on based on their role.
// During Phase 0 the trainer-admin and client trees don't exist yet, so
// roles fall back to the existing dashboard (with toast handling on the
// caller side). Phase 1 swaps these for /trainer/overview etc.




export function landingPathForUser(user) {
  if (!user) return "/";

  const role = normalizeRole(user.role);

  switch (role) {
    case ROLES.SUPER_ADMIN:
      return "/super-admin/overview";

    case ROLES.TRAINER_ADMIN:
     return "/trainer-admin/trainers";
        // return "/trainer/dashboard";

    case ROLES.TRAINER:
      return "/trainer/dashboard";

    case ROLES.CLIENT:
      return "/";

    default:
      return "/";
  }
}



// ---------- Internal helpers ----------

function normalizeUser(raw) {
  return {
    user_id: raw.user_id ?? raw.id ?? null,
    role: normalizeRole(raw.role),
    first_name: raw.first_name ?? "",
    last_name: raw.last_name ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? null,
    partner_code: raw.partner_code ?? raw.dietician_id ?? null,
    parent_user_id: raw.parent_user_id ?? null,
    is_reset_password: raw.is_reset_password ?? null,
    email_verified_at: raw.email_verified_at ?? null,
  };
}

// Legacy `dietician` cookie → normalized user shape. Defaults role to trainer
// because the legacy backend has no role concept; super admins and trainer
// admins only exist post-migration.
function translateLegacyDietician(d) {
  const fullName = (d.name || "").trim();
  const parts = fullName.split(/\s+/);
  const first_name = parts[0] || "";
  const last_name = parts.slice(1).join(" ") || "";

  return {
user_id: d.user_id ?? d.email ?? d.dietician_id ?? null,
role: normalizeRole(d.role),
    first_name,
    last_name,
    email: d.email ?? "",
    phone: d.phone ?? null,
    partner_code: d.dietician_id ?? null,
    parent_user_id: null,
    is_reset_password: d.is_reset_password ?? null,
    email_verified_at: null,
  };
}

// Normalized user → legacy `dietician` shape. Used to mirror the new cookie
// back to the legacy one for backward compat with Header etc.
function legacyShapeFromUser(user) {
  return {
  dietician_id: user.partner_code ?? user.user_id ?? "",
  name: [user.first_name, user.last_name].filter(Boolean).join(" "),
  email: user.email,
  role: user.role,
  is_reset_password: user.is_reset_password,
};
}


function normalizeRole(role) {
  const cleanRole = String(role || "").trim().toLowerCase();

  return ROLE_ALIASES[cleanRole] || ROLES.TRAINER;
}

function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => {
          return `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`;
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to decode access token payload:", error);
    return null;
  }
}
