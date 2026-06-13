// Resolves a client's `p_image` value into a usable <img>/<Image> src.
//
// The dashboard API returns `p_image` as a relative, auth-protected backend
// path (e.g. "/dietitian/api/web/get_profile_image?dietician_id=...&profile_id=...").
// Such a path can't be loaded directly: it resolves against the wrong origin
// and needs a Bearer token a browser image request can't send. We route it
// through our same-origin proxy at /api/profile-image, which injects the token
// server-side from the access_token cookie.
export function resolveProfileImage(
  pImage,
  fallback = "/icons/hugeicons_user-circle-02.svg"
) {
  if (!pImage || pImage === "NA") return fallback;

  // Backend-relative API image path → route through the authenticated proxy.
  if (pImage.startsWith("/dietitian/")) {
    return `/api/profile-image?path=${encodeURIComponent(pImage)}`;
  }

  // Absolute URL or local static asset (e.g. an icon) — use as-is.
  return pImage;
}
