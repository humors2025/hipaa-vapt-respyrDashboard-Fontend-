import { NextResponse } from "next/server";

const FOODS_API_BASE = process.env.RESPYR_FOODS_API_BASE || "https://respyr.in/foods-plan-api";

// Proxy to respyr.in /api/add_manual_food. Persists trainer-entered foods
// to the shared SQLite pool so they appear in future searches.
// Accepts {food_name, calories, protein_g, carbs_g, fat_g, fiber_g, portion_with_metric}
// Returns the canonical food object (food_name, base_label, unit_grams, macro_source, ...)
export async function POST(request) {
  try {
    const body = await request.json();
    const foodName = (body.food_name || "").trim();
    if (!foodName) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    const payload = {
      food_name: foodName,
      calories: Number(body.calories || 0),
      protein_g: Number(body.protein_g || 0),
      carbs_g: Number(body.carbs_g || 0),
      fat_g: Number(body.fat_g || 0),
      fiber_g: Number(body.fiber_g || 0),
      portion_with_metric: body.portion_with_metric || "",
      country: body.country || "usa",
      cuisine: body.cuisine,
      diet_type: body.diet_type,
    };

    const res = await fetch(`${FOODS_API_BASE}/api/add_manual_food`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok || data.error) {
      return NextResponse.json(
        { error: data.error || `respyr returned ${res.status}`, raw: data },
        { status: res.status || 502 }
      );
    }

    // Adapt to the shape FoodSearchModal's onAdd consumer expects (flat macros,
    // portion_with_metric, unit_grams). Server returns base_label / base_grams etc.
    return NextResponse.json({
      food_name: data.food_name || foodName,
      calories: data.calories || 0,
      protein_g: data.protein_g || 0,
      carbs_g: data.carbs_g || 0,
      fat_g: data.fat_g || 0,
      fiber_g: data.fiber_g || 0,
      portion_with_metric: data.base_label || body.portion_with_metric || `1 serving (${Math.round(data.base_grams || data.unit_grams || 100)}g)`,
      unit_grams: data.unit_grams || data.base_grams || 100,
      portion: data.base_portion || 1,
      base_portion: data.base_portion || 1,
      category: data.category || "Meals",
      macro_source: data.macro_source || "manual_entry",
      canonical_name: data.canonical_name,
      pool_size_after_reload: data.pool_size_after_reload,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
