import { NextResponse } from "next/server";

const FOODS_API_BASE = process.env.RESPYR_FOODS_API_BASE || "https://respyr.in/foods-plan-api";
const USDA_API_KEY = process.env.USDA_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Adapt respyr.in food_search shape → what the UI expects (flat macros)
function adaptRespyrResult(item) {
  const m = item.base_macros || {};
  return {
    food_name: item.food_name,
    calories: m.calories || 0,
    protein_g: m.protein_g || 0,
    carbs_g: m.carbs_g || 0,
    fat_g: m.fat_g || 0,
    fiber_g: m.fiber_g || 0,
    portion_with_metric: item.base_label || item.default_portion_label || "1 serving",
    unit_grams: item.unit_grams || 100,
    portion: item.base_portion || 1,
    base_portion: item.base_portion || 1,
    category: "Meals",
    macro_source: "respyr",
    match_score: item.match_score,
  };
}

const NUTRIENT_MAP = {
  "Energy": "calories",
  "Protein": "protein_g",
  "Carbohydrate, by difference": "carbs_g",
  "Total lipid (fat)": "fat_g",
  "Fiber, total dietary": "fiber_g",
};

function extractUSDANutrientsPer100g(foodNutrients) {
  const n = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  for (const fn of foodNutrients || []) {
    const key = NUTRIENT_MAP[fn.nutrientName];
    if (key) n[key] = fn.value || 0;
  }
  return n;
}

function extractUSDAPortionInfo(food) {
  const measures = food.foodMeasures || [];
  if (measures.length > 0) {
    const m = measures[0];
    const grams = m.gramWeight || 100;
    const label = m.disseminationText || "1 serving";
    return { grams, label: `${label} (${Math.round(grams)}g)` };
  }
  const portions = food.foodPortions || [];
  if (portions.length > 0) {
    const p = portions[0];
    const grams = p.gramWeight || 100;
    const label = p.portionDescription || p.modifier || "1 serving";
    return { grams, label: `${label} (${Math.round(grams)}g)` };
  }
  if (food.servingSize) {
    const grams = food.servingSize;
    return { grams, label: `1 serving (${Math.round(grams)}g)` };
  }
  return { grams: 100, label: "100g" };
}

function cleanFoodName(usdaDescription) {
  let name = usdaDescription;
  name = name.replace(/,\s*(raw|NFS|unprepared|uncooked)$/i, "");
  name = name.replace(/\s*\(.*?\)\s*/g, " ");
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const mainItem = parts[0];
    const descriptors = parts.slice(1).filter(
      (d) => !/^(whole|with |without )/.test(d.toLowerCase())
    );
    name = descriptors.length > 0
      ? `${descriptors.join(" ")} ${mainItem}`
      : mainItem;
  } else {
    name = parts[0] || usdaDescription;
  }
  name = name.replace(/\s+/g, " ").trim();
  return name.split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function scaleNutrients(per100g, grams) {
  const factor = grams / 100;
  return {
    calories: Math.round(per100g.calories * factor),
    protein_g: parseFloat((per100g.protein_g * factor).toFixed(1)),
    carbs_g: parseFloat((per100g.carbs_g * factor).toFixed(1)),
    fat_g: parseFloat((per100g.fat_g * factor).toFixed(1)),
    fiber_g: parseFloat((per100g.fiber_g * factor).toFixed(1)),
  };
}

function isRelevantResult(description, query) {
  const desc = description.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return true;
  return words.every((w) => {
    if (desc.includes(w)) return true;
    const stem = w.endsWith("s") ? w.slice(0, -1) : w + "s";
    return desc.includes(stem);
  });
}

async function searchViaUSDA(query, limit = 5) {
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
        pageSize: limit * 2,
      }),
    }
  );

  if (!res.ok) throw new Error(`USDA API error: ${res.status}`);

  const data = await res.json();
  const foods = (data.foods || []).filter((f) => isRelevantResult(f.description || "", query));
  if (foods.length === 0) return [];

  return foods.slice(0, limit).map((food) => {
    const per100g = extractUSDANutrientsPer100g(food.foodNutrients);
    const portion = extractUSDAPortionInfo(food);
    const scaled = scaleNutrients(per100g, portion.grams);

    return {
      food_name: cleanFoodName(food.description || query),
      ...scaled,
      portion_with_metric: portion.label,
      unit_grams: portion.grams,
      portion: 1,
      base_portion: 1,
      category: "Meals",
      macro_source: "usda",
    };
  });
}

async function searchViaOpenAI(query) {
  const prompt = `You are a nutrition database. The user is searching for: "${query}"

Return a JSON array of up to 5 matching common foods with their nutritional info per standard serving. Include variations if applicable (e.g. for "egg" include boiled egg, scrambled egg, etc).

Return ONLY a valid JSON array like:
[
  {
    "food_name": "Boiled Egg",
    "calories": 78,
    "protein_g": 6.3,
    "carbs_g": 0.6,
    "fat_g": 5.3,
    "fiber_g": 0,
    "portion_with_metric": "1 large egg (50g)",
    "portion": 1,
    "base_portion": 1,
    "category": "Meals",
    "macro_source": "openai"
  }
]

Use accurate USDA-level data. Return realistic serving sizes.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!res.ok) throw new Error("OpenAI search failed");

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const limit = parseInt(searchParams.get("limit") || "8", 10);
  const diet_type = searchParams.get("diet_type") || "";

  // Step 1: Try Chandan's curated food pool at respyr.in
  try {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (diet_type) params.set("diet_type", diet_type);
    const url = `${FOODS_API_BASE}/food_search?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return NextResponse.json({ results: data.results.map(adaptRespyrResult) });
      }
    }
  } catch {
    // respyr API not reachable — fall through
  }

  // Step 2: Try USDA FoodData Central API
  try {
    const results = await searchViaUSDA(q, limit);
    if (results.length > 0) {
      return NextResponse.json({ results });
    }
  } catch {
    // USDA failed
  }

  // Step 3: Fall back to OpenAI
  try {
    const results = await searchViaOpenAI(q);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ results: [], error: err.message }, { status: 502 });
  }
}
