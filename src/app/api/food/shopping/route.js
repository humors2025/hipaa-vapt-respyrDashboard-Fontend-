import { NextResponse } from "next/server";

// Thin proxy to the FitChef shopping-list pricer
// (respyr.in/fitchef-dashboard/api/shopping). Keeps the upstream origin off the
// browser and lets us pin the base URL per environment.
//
// Body: { days: [{ day, meals: [{ title, slot, ingredients: [{ name, unit, units, grams }] }] }] }
// Reply: { aisles: [{ aisle, items: [{ name, text, days, meals, price, approx,
//          price_note, price_source }] }], total, items, priced, unpriced, approx,
//          days, region, price_sources, disclaimer }
const FITCHEF_API_BASE =
  process.env.RESPYR_FITCHEF_API_BASE || "https://respyr.in/fitchef-dashboard";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!body || !Array.isArray(body.days)) {
    return NextResponse.json({ error: "days[] is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${FITCHEF_API_BASE}/api/shopping`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `FitChef shopping pricing failed (${res.status})` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "FitChef shopping pricing unreachable" },
      { status: 502 }
    );
  }
}
