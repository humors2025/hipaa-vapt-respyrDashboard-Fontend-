import { NextResponse } from "next/server";

const FOODS_API_BASE = process.env.RESPYR_FOODS_API_BASE || "https://respyr.in/foods-plan-api";

// Thin proxy to respyr.in /food_macros so the server-side canonical
// label + scaled macros can be retrieved on demand.
// Accepts: { food_name, portion } -> GET food_macros?name=...&portion=...
export async function POST(request) {
  try {
    const body = await request.json();
    const name = body.food_name || body.name;
    const portion = Number(body.portion ?? 1);
    if (!name) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    const params = new URLSearchParams({ name, portion: String(portion) });
    const res = await fetch(`${FOODS_API_BASE}/food_macros?${params.toString()}`, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
