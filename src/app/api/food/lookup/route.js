import { NextResponse } from "next/server";

const FOODS_API_BASE = process.env.RESPYR_FOODS_API_BASE || "https://respyr.in/foods-plan-api";
const USDA_API_KEY = process.env.USDA_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function lookupViaRespyr(foodName, portion = 1) {
  const params = new URLSearchParams({ name: foodName, portion: String(portion) });
  const res = await fetch(`${FOODS_API_BASE}/food_macros?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("respyr lookup unavailable");
  const data = await res.json();
  if (data.error || !data.food_name) throw new Error(data.error || "no match");
  return {
    food_name: data.food_name,
    calories: data.calories || 0,
    protein_g: data.protein_g || 0,
    carbs_g: data.carbs_g || 0,
    fat_g: data.fat_g || 0,
    fiber_g: data.fiber_g || 0,
    portion_with_metric: data.portion_with_metric || `${portion} serving`,
    unit_grams: data.unit_grams || 100,
    portion: data.portion || portion,
    base_portion: data.base_portion || 1,
    category: "Meals",
    macro_source: "respyr",
  };
}

// Chandan's full USDA→OpenAI lookup with validation + persistence to the
// shared food pool. New foods discovered here show up in future searches.
async function lookupViaRespyrPipeline(foodName, opts = {}) {
  const res = await fetch(`${FOODS_API_BASE}/api/lookup_food`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      food_name: foodName,
      country: opts.country || "usa",
      cuisine: opts.cuisine,
      diet_type: opts.diet_type,
    }),
  });
  if (!res.ok) throw new Error(`respyr lookup_food ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return {
    food_name: data.food_name || foodName,
    calories: data.calories || 0,
    protein_g: data.protein_g || 0,
    carbs_g: data.carbs_g || 0,
    fat_g: data.fat_g || 0,
    fiber_g: data.fiber_g || 0,
    portion_with_metric: data.base_label || `${data.base_portion || 1} serving (${Math.round(data.base_grams || data.unit_grams || 100)}g)`,
    unit_grams: data.unit_grams || data.base_grams || 100,
    portion: data.base_portion || 1,
    base_portion: data.base_portion || 1,
    category: data.category || "Meals",
    macro_source: data.macro_source || "respyr_pipeline",
  };
}

const NUTRIENT_MAP = {
  "Energy": "calories",
  "Protein": "protein_g",
  "Carbohydrate, by difference": "carbs_g",
  "Total lipid (fat)": "fat_g",
  "Fiber, total dietary": "fiber_g",
};

function extractNutrientsPer100g(foodNutrients) {
  const n = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  for (const fn of foodNutrients || []) {
    const key = NUTRIENT_MAP[fn.nutrientName];
    if (key) n[key] = fn.value || 0;
  }
  return n;
}

function extractPortionInfo(food) {
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

function calorieConsistencyCheck(macros) {
  const calc = macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
  const reported = macros.calories;
  if (reported === 0) return true;
  return Math.abs(calc - reported) / Math.max(1, reported) <= 0.25;
}

async function lookupViaUSDA(foodName) {
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: foodName,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
        pageSize: 5,
      }),
    }
  );

  if (!res.ok) throw new Error(`USDA API error: ${res.status}`);

  const data = await res.json();
  const foods = data.foods || [];
  if (foods.length === 0) throw new Error("No USDA results");

  const best = foods[0];
  const per100g = extractNutrientsPer100g(best.foodNutrients);
  const portion = extractPortionInfo(best);
  const scaled = scaleNutrients(per100g, portion.grams);

  if (!calorieConsistencyCheck(scaled)) {
    const calc = scaled.protein_g * 4 + scaled.carbs_g * 4 + scaled.fat_g * 9;
    scaled.calories = Math.round(calc);
  }

  return {
    food_name: cleanFoodName(best.description || foodName),
    ...scaled,
    portion_with_metric: portion.label,
    unit_grams: portion.grams,
    portion: 1,
    base_portion: 1,
    category: "Meals",
    macro_source: "usda",
  };
}

async function lookupViaOpenAI(foodName, country = "usa") {
  const prompt = `You are a nutrition database. Given a food item, return its nutritional information for a standard single serving.

Food: "${foodName}"
Country/cuisine context: ${country}

Return ONLY valid JSON with these exact keys:
{
  "food_name": "the food name (cleaned up)",
  "calories": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fat_g": <number>,
  "fiber_g": <number>,
  "portion_with_metric": "e.g. 1 piece (60g) or 1 cup (240ml)",
  "portion": 1,
  "base_portion": 1,
  "category": "Meals|Beverage|Snack|Dessert|Fruits/vegetables"
}

Use accurate USDA-level nutritional data. Return realistic values for a standard serving size in ${country}.`;

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
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in OpenAI response");

  const parsed = JSON.parse(jsonMatch[0]);
  parsed.macro_source = "openai";
  return parsed;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const foodName = body.food_name;
    if (!foodName || !foodName.trim()) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    // Step 1: fuzzy match against respyr.in's curated pool
    try {
      const respyrResult = await lookupViaRespyr(foodName.trim(), body.portion || 1);
      return NextResponse.json(respyrResult);
    } catch {
      // not in pool — fall through
    }

    // Step 2: respyr's USDA→OpenAI pipeline with validation + pool-persist.
    // Foods accepted here show up in future searches automatically.
    try {
      const respyrPipelineResult = await lookupViaRespyrPipeline(foodName.trim(), {
        country: body.country || "usa",
        cuisine: body.cuisine,
        diet_type: body.diet_type,
      });
      return NextResponse.json(respyrPipelineResult);
    } catch {
      // respyr pipeline unreachable — fall through to local fallbacks
    }

    // Step 3 (offline fallback): direct USDA call
    try {
      const usdaResult = await lookupViaUSDA(foodName.trim());
      return NextResponse.json(usdaResult);
    } catch {
      // USDA failed or no results
    }

    // Step 4 (offline fallback): direct OpenAI
    const result = await lookupViaOpenAI(foodName.trim(), body.country || "usa");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
