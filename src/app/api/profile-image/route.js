import { API_BASE_URL, API_VERSION } from "@/config/apiConfig";

// Same-origin proxy for client profile images.
//
// The dashboard API returns `p_image` as a relative, auth-protected backend
// path, e.g. "/dietitian/api/web/get_profile_image?dietician_id=...&profile_id=...".
// It can't be used directly in an <img>/<Image> src because:
//   1. It would resolve against the admin-panel origin, not the API host.
//   2. The endpoint requires an `Authorization: Bearer <access_token>` header
//      that a browser image request can't send.
//
// This route runs on our origin, so the browser sends the `access_token`
// cookie automatically. We read it server-side, forward it as a Bearer token
// to the backend, and stream the image bytes back. The token never appears in
// a URL (important for HIPAA — no token in logs/referrers).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  // Only allow the known image endpoint to be proxied — prevents this route
  // from being abused as an open SSRF proxy to arbitrary backend paths.
  if (!path || !path.startsWith("/dietitian/api/web/get_profile_image")) {
    return new Response("Invalid image path", { status: 400 });
  }

  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // The backend returns `p_image` WITHOUT the API version prefix that every
  // other route uses, so a bare `${API_BASE_URL}${path}` hits an unmatched
  // route and API Gateway answers 403 ("Missing Authentication Token"). Insert
  // the version segment so the URL matches a real route: e.g.
  //   /dietitian/api/web/get_profile_image  ->  /v1/dietitian/api/web/get_profile_image
  const upstreamUrl = `${API_BASE_URL}/${API_VERSION}${path}`;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream image fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    // Surface the upstream body so the failure is debuggable instead of blank.
    const detail = await upstream.text().catch(() => "");
    console.error(
      `profile-image proxy: upstream ${upstream.status} for ${upstreamUrl} — ${detail}`
    );
    return new Response(detail || null, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Cache per-user in the browser only; never on shared/CDN caches since
      // this is authenticated, profile-specific imagery.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
