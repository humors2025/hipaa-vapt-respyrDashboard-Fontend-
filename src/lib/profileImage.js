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

  // The backend has returned the image endpoint in two shapes over time:
  //   relative: "/dietitian/api/web/get_profile_image?dietician_id=...&profile_id=..."
  //   absolute: "https://api.respyr.ai/v1/dietitian/api/web/get_profile_image?...&exp=...&sig="
  // The absolute form is PRE-SIGNED with a short-lived `exp`/`sig`. Once `exp`
  // passes (minutes later) the backend 403s the request and the avatar shows a
  // broken image — especially once the dashboard response sits in React state
  // or Next's image cache. So we never hand an expiring URL to the browser:
  // we strip it back to the bare endpoint path and route it through our own
  // same-origin proxy, which injects a fresh Bearer token server-side on every
  // request (no `exp`, no token in the URL — HIPAA-safe).
  const ENDPOINT = "/dietitian/api/web/get_profile_image";
  const idx = pImage.indexOf(ENDPOINT);
  if (idx !== -1) {
    let path = pImage.slice(idx); // drop scheme/host and any /v1 version prefix
    const q = path.indexOf("?");
    if (q !== -1) {
      const params = new URLSearchParams(path.slice(q + 1));
      // The proxy authenticates with a Bearer token, so the pre-signed params
      // are not just unnecessary — keeping a stale `exp` is what breaks them.
      params.delete("exp");
      params.delete("sig");
      const kept = params.toString();
      path = kept ? `${path.slice(0, q)}?${kept}` : path.slice(0, q);
    }
    return `/api/profile-image?path=${encodeURIComponent(path)}`;
  }

  // Some other absolute URL or local static asset (e.g. an icon) — use as-is.
  return pImage;
}
