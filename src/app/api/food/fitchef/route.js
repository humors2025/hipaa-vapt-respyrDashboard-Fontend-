import { NextResponse } from "next/server";

// Thin proxy to the FitChef dish bank (respyr.in/fitchef-dashboard/api/foods).
// Keeps the upstream origin off the browser (no CORS / CSP changes for fetch) and
// lets us pin the base URL per environment. Query params are forwarded as-is:
//   q     — free-text search ("chicken"); empty = browse the whole bank
//   slot  — breakfast | lunch | snack | dinner (ranks in-slot dishes first)
//   diet  — veg | vegan | non_veg | "" (non_veg / "" = no filter upstream)
//   page  — 0-based page index (page_size is fixed upstream, currently 60)
const FITCHEF_API_BASE =
  process.env.RESPYR_FITCHEF_API_BASE || "https://respyr.in/fitchef-dashboard";

const FORWARDED_PARAMS = ["q", "slot", "diet", "page", "page_size"];

// "/dish-image/x.png" lives under the dashboard path, not the site root, so a
// plain prefix (not `new URL(path, base)`) is what resolves it correctly.
function resolveThumb(thumb) {
  if (!thumb || typeof thumb !== "string") return null;
  if (/^https?:\/\//i.test(thumb)) return thumb;
  return `${FITCHEF_API_BASE}${thumb.startsWith("/") ? "" : "/"}${thumb}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  // A single character matches half the bank upstream; wait for a second one.
  // An empty q is a deliberate browse (Make my meal lists every dish).
  if (q.length === 1) {
    return NextResponse.json({ results: [], count: 0, page: 0, pages: 0, query: q });
  }

  const params = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) {
    const value = searchParams.get(key);
    if (value !== null && value !== "") params.set(key, value);
  }
  params.set("q", q);

  try {
    const res = await fetch(`${FITCHEF_API_BASE}/api/foods?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { results: [], error: `FitChef search failed (${res.status})` },
        { status: 502 }
      );
    }
    const data = await res.json();
    // Thumbs come back as paths relative to the dashboard ("/dish-image/…");
    // resolve them here so the client never has to know the upstream origin.
    const results = (Array.isArray(data.results) ? data.results : []).map((r) => ({
      ...r,
      thumb: resolveThumb(r.thumb),
    }));
    return NextResponse.json({ ...data, results });
  } catch (err) {
    return NextResponse.json(
      { results: [], error: err?.message || "FitChef search unreachable" },
      { status: 502 }
    );
  }
}
