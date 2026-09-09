import { NextResponse } from "next/server";

// Thin proxy to the FitChef custom-meal endpoint
// (respyr.in/fitchef-dashboard/api/custom_meal). Keeps the upstream origin off
// the browser and lets us pin the base URL per environment, same as the dish
// bank search and shopping-list pricer proxies.
//
// Body (same shape the Lambda /dietitian/api/web/custom-meal takes):
//   {
//     profile_id:  "profile405",          // FitChef identity the plan was generated for
//     record_id:   18,                    // weekly_food_json_suggestions_newtest row id (plan.meta.id)
//     day:         0,                     // 0-based day index in the week
//     meal_name:   "breakfast",           // breakfast | lunch | snacks | dinner
//     name:        "Bacon and Egg Breakfast Bowl",
//     ingredients: [{ key: "usa_breakfast:854", grams: 500 }, ...]  // dish-bank keys + grams on the plate
//   }
// Reply: forwarded as-is from FitChef.
const FITCHEF_API_BASE =
  process.env.RESPYR_FITCHEF_API_BASE || "https://respyr.in/fitchef-dashboard";

const MEAL_NAMES = new Set(["breakfast", "lunch", "snacks", "dinner"]);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  if (!body.profile_id) {
    return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
  }
  const recordId = Number(body.record_id);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return NextResponse.json({ error: "record_id must be a positive integer" }, { status: 400 });
  }
  const day = Number(body.day);
  if (!Number.isInteger(day) || day < 0) {
    return NextResponse.json({ error: "day must be a 0-based integer" }, { status: 400 });
  }
  const mealName = String(body.meal_name || "").toLowerCase();
  if (!MEAL_NAMES.has(mealName)) {
    return NextResponse.json(
      { error: "meal_name must be one of breakfast, lunch, snacks, dinner" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return NextResponse.json({ error: "ingredients[] is required" }, { status: 400 });
  }
  const ingredients = body.ingredients
    .filter((i) => i && typeof i.key === "string" && i.key.trim())
    .map((i) => ({ key: i.key.trim(), grams: Number(i.grams) }))
    .filter((i) => Number.isFinite(i.grams) && i.grams > 0);
  if (ingredients.length === 0) {
    return NextResponse.json(
      { error: "ingredients[] needs at least one { key, grams > 0 } entry" },
      { status: 400 }
    );
  }

  const payload = {
    profile_id: String(body.profile_id),
    record_id: recordId,
    day,
    meal_name: mealName,
    name: typeof body.name === "string" ? body.name.trim() : "",
    ingredients,
  };

  try {
    const res = await fetch(`${FITCHEF_API_BASE}/api/custom_meal`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || data?.message || `FitChef custom meal failed (${res.status})` },
        { status: 502 }
      );
    }
    return NextResponse.json(data ?? {});
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "FitChef custom meal unreachable" },
      { status: 502 }
    );
  }
}
