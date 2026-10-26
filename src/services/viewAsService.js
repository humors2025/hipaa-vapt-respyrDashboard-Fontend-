// Super-admin "View as" API calls. Both endpoints are super_admin only — the
// backend re-checks the role from the JWT + DB (super-admin-view-as.js).

import { apiFetcher } from "../config/fetcher";
import { API_ENDPOINTS } from "../config/apiConfig";

// The users a super admin can view as (active admin / facility_admin /
// trainer accounts that can log in). role: "all" | "admin" |
// "facility_admin" | "trainer". search is opt-in, 3+ chars.
export const fetchViewAsUsersService = async ({
  role = "all",
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  return apiFetcher(API_ENDPOINTS.ADMINPANEL.VIEWASLIST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, page, limit, search }),
  });
};

// Mints the read-only view token for one user. Resolves to
// { ok, access_token, expires_in, target: { user_id, name, role, dashboard_route } }.
export const startViewAsService = async (targetUserId) => {
  return apiFetcher(API_ENDPOINTS.ADMINPANEL.VIEWASSTART, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
};
