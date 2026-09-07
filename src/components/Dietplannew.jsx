"use client";

/**
 * DietPlanNew
 * ------------------------------------------------------------------------
 * Self-contained diet-plan editor UI — everything (client header, day/meal
 * tabs, macro ring, food cards, swap dialog, "make my meal" builder,
 * shopping list, and the save/undo bar) lives in this one file so it can be
 * dropped straight into this project's `src/components/` folder.
 *
 * DATA SOURCE
 *   The plan is loaded from
 *   `POST /dietitian/api/web/get_weekly_food_json_suggestions_weeks_newtest`
 *   ({ dietitian_id, profile_id, week_start_date, week_end_date }) via
 *   `fetchDietAnalysisPlanNewTest` in services/authService.js.
 *
 *   Which week to load comes from Redux: client-details dispatches
 *   `getDietAnalysisPlan({ profileId, weekStartDate, weekEndDate })` whenever
 *   the user picks a week, and the slice records that request as
 *   `requestedWeek`. This component watches it and refetches on change.
 *   Pass a `plan` prop (already in PLAN SHAPE) to bypass the fetch entirely.
 *
 *   `normalizeWeeklyPlan()` converts the API's `food_json.days[].meals[]`
 *   (recipe / nutrition / ingredients / alternatives) into PLAN SHAPE below.
 *   Local interactions (servings stepper, swap, custom meal, delete/undo,
 *   shopping list) still only mutate local state; `onSave(plan)` receives the
 *   edited plan for persisting.
 *
 *   "Search a swap" queries the FitChef dish bank through the internal route
 *   `GET /api/food/fitchef?q=&slot=&diet=&page=` (a proxy for
 *   respyr.in/fitchef-dashboard/api/foods); hits are mapped to FoodItem by
 *   `fromFitChefResult()` so they swap in exactly like a plan alternative.
 *
 * Dependencies already in this project: react, react-redux, `cn` from
 * "@/lib/utils" (clsx + tailwind-merge), Tailwind v4.
 * ------------------------------------------------------------------------
 *
 * PLAN SHAPE (what normalizeWeeklyPlan() returns, and what a `plan` prop
 * must look like):
 *
 * {
 *   days: [
 *     {
 *       label: "Day 1",
 *       targets: { kcal, protein_g, carbs_g, fat_g },
 *       meals: {
 *         breakfast: [ FoodItem, ... ],
 *         lunch:     [ FoodItem, ... ],
 *         snacks:    [ FoodItem, ... ],
 *         dinner:    [ FoodItem, ... ],
 *       },
 *     },
 *     ...
 *   ],
 *   shopping: null | { week: { aisles, total, … }, byDay: [...] },  // see normalizeShopping()
 * }
 *
 * FoodItem = {
 *   id, name, icon, image, portion, prep_minutes, diet_type,
 *   kcal_base,                                    // API kcal for 1 serving (null = derive from macros)
 *   protein_g, carbs_g, fat_g, fiber_g,          // per 1 serving
 *   servings,                                     // 1 = as-planned
 *   ingredients: [{ name, qty, unit }],
 *   method_steps: [ "step 1", "step 2", ... ],
 *   alternatives: number,                         // how many pre-built swaps exist
 *   alternativeItems: [ FoodItem, ... ],          // the pre-built swaps themselves
 *   recipeId, variantId, hash, eatingMomentId,    // passthrough identifiers from the API
 *   removed: boolean,                              // true once deleted (slot stays, empty)
 * }
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { cn } from "@/lib/utils";
import {
  NEWTEST_FIXED_PAYLOAD,
  fetchDietAnalysisPlanNewTest,
  fetchMacroSummaryByDate,
  getClientProfileDetails,
  priceShoppingListService,
  searchFitChefFoodsService,
  updateDietPlanFoodNewTestService,
} from "@/services/authService";
import { selectDietAnalysisRequestedWeek } from "@/store/dietAnalysisSlice";

/* ============================================================ constants */

const SLOTS = ["breakfast", "lunch", "snacks", "dinner"];
const SLOT_META = {
  breakfast: { label: "Breakfast", time: "08:00 – 09:00 AM" },
  lunch: { label: "Lunch", time: "01:00 – 02:00 PM" },
  snacks: { label: "Snacks", time: "04:30 – 05:00 PM" },
  dinner: { label: "Dinner", time: "08:00 – 09:00 PM" },
};

const MACRO_COLORS = { protein: "#ef4444", fats: "#3b82f6", carbs: "#f59e0b", fibre: "#22c55e" };

/** A tiny per-100g macro table, used only by the "Make my meal" calculator. */
/* ---------------------------------------------------------- Make my meal */

/**
 * One line of a custom meal. Macros are per ONE `portion` of the food (as the
 * food library / AI lookup returns them); `qty` is how many portions.
 */
function toMealRow(food) {
  return {
    key: `${food?.food_name || "food"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: food?.food_name || "Food",
    portion: food?.portion_with_metric || food?.portion_label || "1 serving",
    grams: num(food?.unit_grams) || null,
    kcal: num(food?.calories),
    p: num(food?.protein_g),
    c: num(food?.carbs_g),
    f: num(food?.fat_g),
    fiber: num(food?.fiber_g),
    qty: 1,
    source: food?.macro_source || "library",
  };
}

/** Free text → steps: one per line, leading "1." / "1)" / "-" / "•" stripped. */
function textToSteps(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Simple, sensible method for a custom meal built from foods — used when the
 * dietitian leaves the Method box empty so every meal card has a Method.
 * Groups foods by how they are usually handled (cook / heat / assemble).
 */
function suggestMethodSteps(rows, mealName) {
  const names = (rows || []).map((r) => r.name).filter(Boolean);
  if (names.length === 0) return [];
  const lower = (s) => s.toLowerCase();
  const isRaw = (n) => /salad|fruit|banana|apple|berry|yogurt|yoghurt|curd|milk|nut|almond|seed|cheese|bread|toast|juice|smoothie|shake|honey|butter|jam/i.test(n);
  const isCook = (n) => /egg|chicken|fish|salmon|beef|pork|turkey|paneer|tofu|dal|lentil|bean|rice|oat|quinoa|pasta|noodle|potato|roti|chapati|paratha|soup|curry|stir|fry|grill|bake|roast/i.test(n);
  const cooked = names.filter(isCook);
  const raw = names.filter((n) => !isCook(n) && isRaw(n));
  const rest = names.filter((n) => !isCook(n) && !isRaw(n));
  const list = (arr) => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`);

  const steps = [];
  steps.push(`Measure out ${list(names.map(lower))} in the quantities listed above.`);
  if (cooked.length) steps.push(`Cook the ${list(cooked.map(lower))} until done, seasoning with salt and pepper to taste.`);
  if (rest.length) steps.push(`Prepare the ${list(rest.map(lower))} — wash, chop or heat as needed.`);
  if (raw.length) steps.push(`Add the ${list(raw.map(lower))} as they are.`);
  steps.push(`Plate everything together${mealName ? ` as ${mealName}` : ""} and serve.`);
  return steps;
}

function sumMealRows(rows) {
  return (rows || []).reduce(
    (acc, r) => {
      const q = num(r.qty);
      return {
        kcal: acc.kcal + r.kcal * q,
        p: acc.p + r.p * q,
        c: acc.c + r.c * q,
        f: acc.f + r.f * q,
        fiber: acc.fiber + r.fiber * q,
      };
    },
    { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 },
  );
}

/* ------------------------------------------------- "Close the gap for me" */

const GAP_QTY_MIN = 0.25;

/** How far `tot` is from `target`, as a weighted squared relative error (0 = exact). */
function gapError(tot, target) {
  const rel = (v, t, w) => {
    const base = Math.max(num(t), 1);
    return w * ((num(v) - num(t)) / base) ** 2;
  };
  // Protein matters most to a dietitian, then the calories, then the split.
  return rel(tot.p, target.p, 1.4) + rel(tot.kcal, target.kcal, 1.2) + rel(tot.c, target.c, 0.8) + rel(tot.f, target.f, 0.8);
}

/** Best qty (0.25 steps in [lo, hi]) for one row given the other rows' totals. */
function bestQtyFor(row, others, target, lo, hi) {
  let best = { qty: row.qty, err: Infinity };
  for (let q = lo; q <= hi + 1e-9; q += 0.25) {
    const tot = {
      kcal: others.kcal + row.kcal * q,
      p: others.p + row.p * q,
      c: others.c + row.c * q,
      f: others.f + row.f * q,
    };
    const err = gapError(tot, target);
    if (err < best.err - 1e-9) best = { qty: q, err };
  }
  return best;
}

/**
 * "Close the gap for me": rank the bank dishes by how much of the remaining
 * gap (target − what is in the meal) each one closes at its best portion.
 *
 *   rows        — current builder rows
 *   candidates  — bank dishes as builder rows (the dialog's `fitted` list)
 *   target      — { kcal, p, c, f } to hit
 * Returns up to `limit` of { row, qty, score, kcal, p, c, f, portionText },
 * best first. `score` is 0–100: how much of the gap error the dish removes.
 */
function gapSuggestions(rows, candidates, target, limit = 6) {
  const tot = sumMealRows(rows);
  const errNow = gapError(tot, target);
  if (!(errNow > 0)) return [];
  const taken = new Set(rows.map((r) => normName(r.name)));
  const out = [];
  for (const cand of candidates) {
    if (!cand || !(cand.kcal > 0) || taken.has(normName(cand.name))) continue;
    const { qty, err } = bestQtyFor(cand, tot, target, GAP_QTY_MIN, 3);
    let score = 100 * (1 - Math.sqrt(err / errNow));
    if (cand.offSlot) score *= 0.97; // in-slot dishes win ties
    score = Math.round(score);
    if (score <= 0) continue;
    const portionText = cand.portionQty
      ? `${fmtQty(cand.portionQty * qty)} ${pluralUnit(cand.portionUnit, cand.portionQty * qty)}`.trim()
      : qty === 1
        ? cand.portion
        : `${fmtQty(qty)} × ${cand.portion}`;
    out.push({ row: cand, qty, score, kcal: cand.kcal * qty, p: cand.p * qty, c: cand.c * qty, f: cand.f * qty, portionText });
  }
  return out.sort((a, b) => b.score - a.score || a.kcal - b.kcal).slice(0, limit);
}

/* ---------------------------------------------------------- FitChef search */

/** Our slot keys → the `slot` value the FitChef foods API understands. */
const FITCHEF_SLOT = { breakfast: "breakfast", lunch: "lunch", snacks: "snack", dinner: "dinner" };

/** Diet filter chips shown in "Search a swap". Value is what the API takes. */
const DIET_FILTERS = [
  { value: "", label: "All" },
  { value: "veg", label: "Veg" },
  { value: "vegan", label: "Vegan" },
];

/** Client profile diet_type ("Non-Vegetarian", "veg", "vegan"…) → FitChef `diet`. */
function fitchefDietFromProfile(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "";
  if (s.includes("vegan")) return "vegan";
  if (s.includes("non")) return ""; // non-veg = no restriction upstream
  if (s.includes("veg")) return "veg";
  return "";
}

/** One FitChef search hit → FoodItem (same shape the plan uses, so swapping in is lossless). */
// function fromFitChefResult(r, id) {
//   const method = typeof r?.method === "string" ? r.method.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
//   return {
//     id,
//     name: r?.name || "Untitled dish",
//     icon: "🍽️",
//     image: r?.thumb || null,
//     portion: r?.portion || r?.base_text || "1 serving",
//     prep_minutes: null,
//     diet_type: r?.diet || "",
//     kcal_base: Number.isFinite(Number(r?.kcal)) ? Number(r.kcal) : null,
//     protein_g: num(r?.p),
//     carbs_g: num(r?.c),
//     fat_g: num(r?.f),
//     fiber_g: num(r?.fiber),
//     servings: 1,
//     ingredients: (Array.isArray(r?.contains) ? r.contains : [])
//       .filter((ing) => ing?.name)
//       .map((ing) => ({
//         name: ing.name,
//         // Prefer the recipe's own unit; fall back to grams when it has none.
//         qty: Number.isFinite(Number(ing.units)) && ing.unit ? num(ing.units) : num(ing.grams),
//         unit: Number.isFinite(Number(ing.units)) && ing.unit ? ing.unit : "g",
//         grams: num(ing.grams) || null,
//       })),
//     method_steps: method,
//     tips: [],
//     alternatives: 0,
//     alternativeItems: [],
//     recipeId: null,
//     variantId: null,
//     hash: null,
//     eatingMomentId: null,
//     removed: false,
//     // Passthrough so the source dish can be traced later.
//     fitchefKey: r?.key ?? null,
//     source: "FitChef live",
//     grams: num(r?.grams) || null,
//     health: Number.isFinite(Number(r?.health)) ? Number(r.health) : null,
//     offSlot: Boolean(r?.off_slot),
//     cuisine: r?.cuisine || "",
//   };
// }


function fromFitChefResult(r, id) {
  const method =
    typeof r?.method === "string"
      ? r.method
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return {
    id,

    name: r?.name || "Untitled dish",

    icon: "🍽️",

    image: r?.thumb || null,

    portion:
      r?.portion ||
      r?.base_text ||
      "1 serving",

    prep_minutes: null,

    diet_type: r?.diet || "",

    kcal_base:
      Number.isFinite(Number(r?.kcal))
        ? Number(r.kcal)
        : null,

    protein_g: num(r?.p),

    carbs_g: num(r?.c),

    fat_g: num(r?.f),

    fiber_g: num(r?.fiber),

    servings: 1,

    /*
     * IMPORTANT:
     *
     * Preserve the complete FitChef ingredient information.
     *
     * Backend shopping rebuild needs:
     *
     * units
     * unit
     * grams
     */
    ingredients: (
      Array.isArray(r?.contains)
        ? r.contains
        : []
    )
      .filter((ing) => ing?.name)
      .map((ing) => {
       const hasUnits = hasNumericValue(ing?.units);
const hasGrams = hasNumericValue(ing?.grams);

        return {
          name: ing.name,

          qty:
            hasUnits && ing?.unit
              ? Number(ing.units)
              : hasGrams
                ? Number(ing.grams)
                : 0,

          units:
            hasUnits
              ? Number(ing.units)
              : null,

          unit:
            ing?.unit || (hasGrams ? "g" : ""),

          grams:
            hasGrams
              ? Number(ing.grams)
              : null,

          productId:
            ing?.productId ??
            ing?.product_id ??
            null,

          unitId:
            ing?.unitId ??
            ing?.unit_id ??
            null,
        };
      }),

    method_steps: method,

    tips: [],

    alternatives: 0,

    alternativeItems: [],

    recipeId: null,

    variantId: null,

    hash: null,

    eatingMomentId: null,

    removed: false,

    fitchefKey:
      r?.key ?? null,

    source:
      "FitChef live",

    grams:
      num(r?.grams) || null,

    health:
      Number.isFinite(Number(r?.health))
        ? Number(r.health)
        : null,

    offSlot:
      Boolean(r?.off_slot),

    cuisine:
      r?.cuisine || "",
  };
}


/* ============================================================ API → plan */

const EMPTY_TOTALS = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

/** Maps the API's free-text `mealName` onto one of our four slots. */
function slotForMeal(meal) {
  const raw = String(meal?.mealName || meal?.meal_name || meal?.slot || "")
    .trim()
    .toLowerCase();
  if (raw.includes("snack")) return "snacks";
  if (raw.includes("break")) return "breakfast";
  if (raw.includes("lunch")) return "lunch";
  if (raw.includes("dinner") || raw.includes("supper")) return "dinner";
  // Unknown label (e.g. "mid-morning") — treat as a snack so nothing is dropped.
  return "snacks";
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/** "<ol><li>Step</li>…</ol>" (or <p>/<br>-separated text) → ["Step", …]. */
function htmlToSteps(html) {
  if (!html || typeof html !== "string") return [];
  const items = html.match(/<li[^>]*>[\s\S]*?<\/li>/gi);
  const chunks = items && items.length ? items : html.split(/<br\s*\/?>|<\/p>|\r?\n/i);
  return chunks
    .map((c) => decodeEntities(c.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function ingredientUnit(ing) {
  const n = Number(ing?.units);
  const single = ing?.unitSingular || ing?.unit || "";
  const multi = ing?.unitMultiple || single;
  return n === 1 ? single : multi;
}

/**
 * Household measure → metric per unit, for the "(15 ml each)" hint and the
 * Measurements popup. US customary (a cup is 237 ml, not the 250 ml metric
 * cup): the `hash` on every FitChef meal restates its ingredients in metric
 * beside the human list, and dividing one by the other gave these constants
 * exactly across ~2,400 ingredient lines. Count units (piece, slice) have no
 * fixed size and return null.
 */
const UNIT_METRIC = {
  bowl: { per: 350, unit: "ml" },
  clove: { per: 5, unit: "g" },
  cup: { per: 237, unit: "ml" },
  "fluid ounce": { per: 30, unit: "ml" },
  glass: { per: 250, unit: "ml" },
  handful: { per: 30, unit: "g" },
  ounce: { per: 28, unit: "g" },
  pinch: { per: 0.5, unit: "g" },
  pound: { per: 454, unit: "g" },
  squeeze: { per: 5, unit: "ml" },
  tablespoon: { per: 15, unit: "ml" },
  teaspoon: { per: 5, unit: "ml" },
  pint: { per: 473, unit: "ml" },
  quart: { per: 946, unit: "ml" },
  liter: { per: 1000, unit: "ml" },
  kilogram: { per: 1000, unit: "g" },
  milliliter: { per: 1, unit: "ml" },
  gram: { per: 1, unit: "g" },
};

/** Abbreviations and spellings → the UNIT_METRIC key. */
const UNIT_ALIAS = {
  tsp: "teaspoon",
  tbsp: "tablespoon",
  tbs: "tablespoon",
  "fl oz": "fluid ounce",
  "fl. oz": "fluid ounce",
  oz: "ounce",
  lb: "pound",
  kg: "kilogram",
  g: "gram",
  gm: "gram",
  ml: "milliliter",
  millilitre: "milliliter",
  litre: "liter",
  l: "liter",
};

/** "Tablespoons" / "tbsp." / "fl oz" → "tablespoon" / "fluid ounce": one singular name per unit. */
function unitKey(unit) {
  const raw = String(unit || "")
    .toLowerCase()
    .trim()
    .replace(/\.$/, "");
  if (!raw) return "";
  if (UNIT_ALIAS[raw]) return UNIT_ALIAS[raw];
  if (UNIT_METRIC[raw]) return raw;
  // Exactly one plural rule applies: berries → berry, glasses → glass, cups → cup.
  let singular = raw;
  if (/ies$/.test(raw)) singular = raw.replace(/ies$/, "y");
  else if (/(ch|sh|ss|x|z)es$/.test(raw)) singular = raw.replace(/es$/, "");
  else singular = raw.replace(/s$/, "");
  return UNIT_ALIAS[singular] || singular;
}

function unitMetric(unit) {
  const key = unitKey(unit);
  return key ? UNIT_METRIC[key] || null : null;
}

function hasNumericValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value))
  );
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Save writes the servings multiplier into `portion_with_metric` as
 * "1.5 × serves 1" (see toApiFood) and sends the nutrition already scaled.
 * Read that back so a reload shows 1.5 on the stepper (not 1) and the base
 * macros are un-scaled, otherwise stepping again would multiply twice.
 * Returns { servings, portion } — portion is null when nothing was stored.
 */
function parseStoredPortion(text) {
  const raw = String(text || "").trim();
  if (!raw) return { servings: 1, portion: null };
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*[×x]\s*(.+)$/i);
  if (!m) return { servings: 1, portion: raw };
  const servings = Number(m[1]);
  return {
    servings: Number.isFinite(servings) && servings > 0 ? servings : 1,
    portion: m[2].trim() || null,
  };
}

/** One API meal (or one of its `alternatives`) → FoodItem. */
function toFoodItem(meal, id) {
  const n = meal?.nutrition || {};
  const recipe = meal?.recipe || {};
  const prep = Number(recipe.recipe_taxonomy_preparation_time?.[0]);
  const people = Number(recipe.recipe_amount_of_people?.[0]);
  const alternativeItems = Array.isArray(meal?.alternatives)
    ? meal.alternatives.map((alt, i) => toFoodItem(alt, `${id}-alt${i}`))
    : [];
  const dietTags = [...(recipe.diet || []), ...(recipe.type_of_food || [])].filter(Boolean);
  const stored = parseStoredPortion(meal?.portion_with_metric);
  const serv = stored.servings;
  // Stored nutrition is for `serv` servings; the FoodItem keeps per-1-serving values.
  const base = (v) => num(v) / serv;

  return {
    id,
    name: meal?.name || "Untitled meal",
    icon: "🍽️",
    image: recipe.image || null,
    portion: stored.portion || (people > 0 ? `serves ${people}` : "1 serving"),
    prep_minutes: Number.isFinite(prep) && prep > 0 ? prep : null,
    diet_type: dietTags.join(", "),
    kcal_base: Number.isFinite(Number(n.kcals)) ? base(n.kcals) : null,
    protein_g: base(n.protein),
    carbs_g: base(n.carbohydrate ?? n.carbs),
    fat_g: base(n.fat),
    fiber_g: base(n.fiber),
    servings: serv,
    // ingredients: (meal?.ingredients || []).map((ing) => ({
    //   name: ing?.name || "",
    //   qty: num(ing?.units),
    //   unit: ingredientUnit(ing),
    //   // Weight of the whole line when the recipe states it (for Measurements).
    //   grams: num(ing?.grams ?? ing?.weight_g ?? ing?.gram) || null,
    // })),


    ingredients: (meal?.ingredients || []).map((ing) => {
  const hasUnits = hasNumericValue(ing?.units);
  const hasGrams = hasNumericValue(ing?.grams);

  return {
    name: ing?.name || "",

    qty:
      hasUnits
        ? Number(ing.units)
        : hasGrams
          ? Number(ing.grams)
          : 0,

    units:
      hasUnits
        ? Number(ing.units)
        : null,

    unit:
      ing?.unit ||
      ingredientUnit(ing) ||
      (hasGrams ? "g" : ""),

    grams:
      hasGrams
        ? Number(ing.grams)
        : null,

    productId:
      ing?.productId ??
      ing?.product_id ??
      null,

    unitId:
      ing?.unitId ??
      ing?.unit_id ??
      null,
  };
}),

    method_steps: htmlToSteps(recipe.post_content),
    tips: htmlToSteps(recipe.recipe_tip),
    alternatives: alternativeItems.length,
    alternativeItems,
    recipeId: meal?.recipeId ?? null,
    variantId: meal?.variantId ?? null,
    hash: meal?.hash ?? null,
    eatingMomentId: meal?.eatingMomentId ?? null,
    removed: false,
  };
}

/**
 * True when a plan row came back from the server without any recipe detail —
 * the update API only persists name / portion / category / macros, so a dish
 * added or swapped in from FitChef loses its method, ingredients and image on
 * Save → reload. Such rows are re-hydrated from FitChef by name (see below).
 */
function lacksRecipeDetail(item) {
  return (
    item &&
    !item.removed &&
    !item.recipeId &&
    (item.method_steps || []).length === 0 &&
    (item.ingredients || []).length === 0 &&
    item.diet_type !== "custom"
  );
}

function normName(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Looks each detail-less row up in the FitChef dish bank by exact name and
 * returns [{ dayIdx, slot, id, detail }] patches. Never throws — a failed
 * lookup just leaves that row as it was.
 */
async function fetchFitChefDetails(plan, signal) {
  const targets = [];
  (plan?.days || []).forEach((day, dayIdx) => {
    for (const slot of SLOTS) {
      for (const item of day.meals?.[slot] || []) {
        if (lacksRecipeDetail(item)) targets.push({ dayIdx, slot, id: item.id, name: item.name });
      }
    }
  });
  if (targets.length === 0) return [];

  // One search per distinct dish name; several rows may share a dish.
  const byName = new Map();
  for (const t of targets) {
    const key = `${normName(t.name)}|${t.slot}`;
    if (!byName.has(key)) byName.set(key, { name: t.name, slot: t.slot, rows: [] });
    byName.get(key).rows.push(t);
  }

  const patches = [];
  await Promise.all(
    Array.from(byName.values()).map(async ({ name, slot, rows }) => {
      try {
        const data = await searchFitChefFoodsService(name, { slot: FITCHEF_SLOT[slot] || "", page: 0, signal });
        const hit = (data?.results || []).find((r) => normName(r?.name) === normName(name));
        if (!hit) return;
        const detail = fromFitChefResult(hit, "hydrate");
        for (const row of rows) patches.push({ ...row, detail });
      } catch {
        /* leave the row without detail */
      }
    }),
  );
  return patches;
}

/** Applies fetchFitChefDetails() patches to a plan (immutably, by row id). */
function applyFitChefDetails(plan, patches) {
  if (!plan || patches.length === 0) return plan;
  const next = structuredClone(plan);
  for (const p of patches) {
    const list = next.days?.[p.dayIdx]?.meals?.[p.slot];
    const row = list?.find((f) => f.id === p.id);
    if (!row || !lacksRecipeDetail(row)) continue;
    const d = p.detail;
    row.image = row.image || d.image;
    row.prep_minutes = row.prep_minutes ?? d.prep_minutes;
    row.diet_type = row.diet_type || d.diet_type;
    row.ingredients = d.ingredients;
    row.method_steps = d.method_steps;
    row.tips = d.tips;
    row.fitchefKey = d.fitchefKey;
    row.grams = d.grams;
    row.health = d.health;
    row.cuisine = d.cuisine;
    // Portion label ("1 glass") is more useful than the generic "1 serving".
    if (!row.portion || row.portion === "1 serving") row.portion = d.portion;
  }
  return next;
}

/* ------------------------------------------ recipe detail across reloads */

function detailKey(dayCode, slot, name) {
  return `${String(dayCode || "").toLowerCase()}|${slot}|${normName(name)}`;
}

/**
 * Snapshot every row's recipe detail (method, ingredients, image, …) keyed by
 * day / slot / dish name. The update API persists only name + macros, so after
 * Save → reload we put this detail back onto the matching rows. In-memory only
 * (session state, nothing written to the browser), so it survives Save and the
 * Reload button but not a full page refresh.
 */
function collectRecipeDetail(plan, cache) {
  const map = cache || new Map();
  (plan?.days || []).forEach((day) => {
    for (const slot of SLOTS) {
      for (const item of day.meals?.[slot] || []) {
        if (!item || item.removed || lacksRecipeDetail(item)) continue;
        map.set(detailKey(day.day_code, slot, item.name), {
          image: item.image || null,
          prep_minutes: item.prep_minutes ?? null,
          diet_type: item.diet_type || "",
          ingredients: item.ingredients || [],
          method_steps: item.method_steps || [],
          tips: item.tips || [],
          fitchefKey: item.fitchefKey ?? null,
          grams: item.grams ?? null,
          health: item.health ?? null,
          cuisine: item.cuisine || "",
          portion: item.portion || "1 serving",
        });
      }
    }
  });
  return map;
}

/** Rows that came back bare get their remembered detail (same patch shape as FitChef hydration). */
function applyDetailCache(plan, cache) {
  if (!plan || !cache || cache.size === 0) return plan;
  const patches = [];
  (plan.days || []).forEach((day, dayIdx) => {
    for (const slot of SLOTS) {
      for (const item of day.meals?.[slot] || []) {
        if (!lacksRecipeDetail(item)) continue;
        const detail = cache.get(detailKey(day.day_code, slot, item.name));
        if (detail) patches.push({ dayIdx, slot, id: item.id, detail });
      }
    }
  });
  return applyFitChefDetails(plan, patches);
}

/**
 * Picks explicit macro targets if the API provides any; null otherwise.
 * Accepts the nested shapes the plan / macro-summary endpoints use
 * (`targets`, `daily_targets`, `macro_targets`, `final_macro_summary`,
 * `weekly_json_data`, …) and the flat `*_target` columns from
 * table_diet_plan_strategy.
 */
function readTargets(source) {
  if (!source || typeof source !== "object") return null;
  const t =
    source.targets ||
    source.daily_targets ||
    source.macro_targets ||
    source.target_macros ||
    source.macro_goals ||
    source.final_macro_summary ||
    source.current_data?.final_macro_summary ||
    source.weekly_json_data ||
    source.macro_summary ||
    source.daily_macros ||
    (source.calories_target !== undefined || source.protein_target !== undefined ? source : null);
  if (!t || typeof t !== "object") return null;
  const targets = {
    kcal: num(t.kcal ?? t.kcals ?? t.calories ?? t.calories_target ?? t.calorie_target ?? t.target_calories ?? t.energy_kcal),
    protein_g: num(t.protein_g ?? t.protein ?? t.protein_target ?? t.target_protein),
    carbs_g: num(t.carbs_g ?? t.carbohydrate ?? t.carbs ?? t.carbs_target ?? t.target_carbs),
    fat_g: num(t.fat_g ?? t.fat ?? t.fats ?? t.fat_target ?? t.target_fat),
    fiber_g: num(t.fiber_g ?? t.fibre_g ?? t.fiber ?? t.fibre ?? t.fiber_target ?? t.target_fiber),
  };
  // A kcal figure the source left out is derived from the macros so the donut
  // and the day tabs still have something to compare against.
  if (!targets.kcal && (targets.protein_g || targets.carbs_g || targets.fat_g)) {
    targets.kcal = Math.round(targets.protein_g * 4 + targets.carbs_g * 4 + targets.fat_g * 9);
  }
  return Object.values(targets).some((v) => v > 0) ? targets : null;
}

function dayLabel(day, i) {
  const code = day?.day_code || day?.dayCode;
  return day?.label || day?.day_label || (code ? String(code).toUpperCase() : null) || day?.day || day?.date || `Day ${i + 1}`;
}

/**
 * Aisle for an ingredient name, used only when the server sends no shopping
 * block. Keyword match, first hit wins; anything unmatched lands in Pantry.
 */
const LOCAL_AISLES = [
  ["Frozen", /frozen/i],
  ["Meat & Fish", /chicken|beef|turkey|pork|lamb|ham|bacon|sausage|salmon|tuna|shrimp|prawn|fish|cod|meatball|steak|mince/i],
  ["Dairy & Eggs", /milk|yogurt|yoghurt|cheese|paneer|butter|cream|egg|feta|mozzarella|parmesan|cheddar|ricotta|whey/i],
  ["Bakery & Grains", /bread|toast|bun|wrap|tortilla|oat|rice|quinoa|pasta|noodle|flour|cereal|granola|muffin|bagel|cracker/i],
  ["Produce", /apple|banana|berry|berries|mango|pineapple|orange|mandarin|lemon|lime|grape|melon|pear|peach|kiwi|avocado|tomato|onion|garlic|pepper|zucchini|cucumber|lettuce|spinach|kale|broccoli|cauliflower|carrot|celery|corn|pea|bean|sprout|mushroom|potato|scallion|herb|basil|parsley|cilantro|coriander|mint|dill|ginger|chili|jalape|radish|beet|squash|pumpkin|asparagus|cabbage|leek|eggplant|artichoke|olive(?!\s*oil)/i],
  ["Drinks", /water|juice|coffee|tea\b|soda/i],
  ["Nuts & Seeds", /almond|walnut|cashew|peanut|pecan|pistachio|hazelnut|seed|chia|flax|tofu|tempeh|hummus/i],
  ["Spices & Condiments", /salt|pepper|paprika|cumin|curry|oregano|seasoning|spice|powder|cinnamon|turmeric|vinegar|mustard|mayonnaise|ketchup|sriracha|sauce|honey|syrup|sugar|oil/i],
];
function localAisle(name) {
  const hit = LOCAL_AISLES.find(([, re]) => re.test(String(name || "")));
  return hit ? hit[0] : "Pantry";
}

const round2 = (v) => Math.round(Number(v) * 100) / 100;

/**
 * Current plan → the FitChef pricer's input (see /api/food/shopping). Every
 * non-removed food becomes a meal whose ingredient lines are scaled to the
 * chosen servings. With `explode` each meal is sent as its own "day", so the
 * reply prices every meal separately (used for the By day view); otherwise
 * plan days map 1:1. Returns { days, meals } where meals[i] describes the
 * i-th meal sent (1-based meal number = i + 1) with its line quantities.
 */
function shoppingPayload(days, explode = false) {
  const out = [];
  const sent = [];
  (days || []).forEach((day, di) => {
    const dayNo = di + 1;
    const meals = [];
    for (const slot of SLOTS) {
      for (const f of day?.meals?.[slot] || []) {
        if (!f || f.removed) continue;
        const serv = f.servings || 1;
        const ingredients = (f.ingredients || [])
          .filter((ing) => ing?.name)
          .map((ing) => {
            const units = hasNumericValue(ing.units) ? Number(ing.units) : num(ing.qty);
            const grams = hasNumericValue(ing.grams) ? Number(ing.grams) : null;
            return {
              name: ing.name,
              unit: ing.unit || (grams !== null ? "g" : ""),
              units: round2(units * serv),
              ...(grams !== null ? { grams: round2(grams * serv) } : {}),
            };
          });
        const meal = { title: f.name, slot, ingredients };
        sent.push({ dayNo, slot, foodId: f.id, ingredients });
        if (explode) out.push({ day: out.length + 1, meals: [meal] });
        else meals.push(meal);
      }
    }
    if (!explode) out.push({ day: dayNo, meals });
  });
  return { days: out, meals: sent };
}

/**
 * Two pricer replies → what buildLocalShopping() needs to show prices:
 *   week    — the aisle list for the real days (already the dialog's shape)
 *   lineFor — (mealNo, ingredientName) → { price, approx, note, source } | null
 * The exploded reply folds an ingredient used in several meals into one line
 * with a summed price, so that price is split back per meal in proportion to
 * each meal's quantity (grams when known, else units). Prices are indicative
 * shelf prices anyway, so a proportional split is as good as the source.
 */
function pricingFromFitChef(weekRes, mealRes, sentMeals) {
  const week = normalizeShopping({ week: weekRes })?.week || null;
  const qtyOf = (mealNo, key) => {
    const line = (sentMeals[mealNo - 1]?.ingredients || []).find((ing) => normName(ing.name) === key);
    if (!line) return 0;
    return num(line.grams) || num(line.units) || 0;
  };
  const byLine = new Map(); // `${mealNo}|${normName}` → { price, approx, note, source }
  (Array.isArray(mealRes?.aisles) ? mealRes.aisles : []).forEach((a) => {
    (Array.isArray(a?.items) ? a.items : []).forEach((it) => {
      const key = normName(it?.name);
      const mealNos = (Array.isArray(it?.days) ? it.days : []).map(Number).filter(Number.isFinite);
      if (!key || mealNos.length === 0) return;
      const price = Number(it?.price);
      const entry = {
        price: Number.isFinite(price) ? price : null,
        approx: Boolean(it?.approx),
        note: it?.price_note || "",
        source: it?.price_source || "",
      };
      const weights = mealNos.map((n) => qtyOf(n, key));
      const totalW = weights.reduce((s, w) => s + w, 0);
      mealNos.forEach((n, i) => {
        const share = entry.price === null ? null : totalW > 0 ? round2((entry.price * weights[i]) / totalW) : round2(entry.price / mealNos.length);
        byLine.set(`${n}|${key}`, { ...entry, price: share });
      });
    });
  });
  return { week, lineFor: (mealNo, name) => byLine.get(`${mealNo}|${normName(name)}`) || null };
}

/**
 * Build the shopping structure from the plan's own ingredients. Same shape
 * normalizeShopping() returns, so the dialog renders By aisle / By day
 * identically. Without `pricing` (no FitChef reply yet / call failed) every
 * line is "Not priced"; with it, the week block comes from the pricer and
 * each By-day line carries its share of the shelf price.
 */
function buildLocalShopping(days, pricing = null) {
  const agg = new Map(); // name → { name, lines: [], days: Set, meals }
  const byDay = [];
  let mealNo = 0;
  (days || []).forEach((day, di) => {
    const dayNo = di + 1;
    const meals = [];
    for (const slot of SLOTS) {
      for (const f of day?.meals?.[slot] || []) {
        if (!f || f.removed) continue;
        mealNo += 1;
        const serv = f.servings || 1;
        const items = [];
        for (const ing of f.ingredients || []) {
          if (!ing?.name) continue;
          const qty = num(ing.qty) * serv;
          const m = unitMetric(ing.unit);
          const unit = String(ing.unit || "");
          let text = qty > 0 ? `${fmtQty(qty)} ${unit}`.trim() : unit;
          if (m && qty > 0) text += ` (${round(qty * m.per)} ${m.unit})`;
          const p = pricing?.lineFor(mealNo, ing.name) || null;
          items.push({
            name: ing.name,
            text,
            days: [dayNo],
            meals: 1,
            price: p?.price ?? null,
            approx: p?.approx ?? false,
            priceNote: p?.price !== null && p?.price !== undefined ? p.note : "Not priced",
            priceSource: p?.source || "",
          });
          const key = normName(ing.name);
          const row = agg.get(key) || { name: ing.name, lines: [], days: new Set(), meals: 0 };
          row.lines.push(text);
          row.days.add(dayNo);
          row.meals += 1;
          agg.set(key, row);
        }
        const pricedLines = items.filter((it) => it.price !== null);
        meals.push({
          title: f.name,
          slot,
          items,
          count: items.length,
          price: pricedLines.length > 0 ? round2(pricedLines.reduce((s, it) => s + it.price, 0)) : null,
          steps: f.method_steps || [],
          tip: (f.tips || []).join(" "),
          minutes: f.prep_minutes ? String(f.prep_minutes) : "",
        });
      }
    }
    byDay.push({ day: dayNo, meals });
  });

  if (pricing?.week) {
    const hasMeals = byDay.some((d) => d.meals.length > 0);
    if (pricing.week.itemCount === 0 && !hasMeals) return null;
    return {
      generatedAt: Date.now(),
      note: "",
      local: false,
      live: true,
      week: { ...pricing.week, days: (days || []).length },
      byDay,
    };
  }

  const aisleMap = new Map();
  for (const row of agg.values()) {
    const aisle = localAisle(row.name);
    const list = aisleMap.get(aisle) || [];
    list.push({
      name: row.name,
      text: row.lines.length === 1 ? row.lines[0] : row.lines.join(" + "),
      days: [...row.days].sort((a, b) => a - b),
      meals: row.meals,
      price: null,
      approx: false,
      priceNote: "Not priced",
    });
    aisleMap.set(aisle, list);
  }
  const aisles = [...aisleMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([aisle, items]) => ({ aisle, items: items.sort((a, b) => a.name.localeCompare(b.name)) }));
  const itemCount = aisles.reduce((n, a) => n + a.items.length, 0);
  if (itemCount === 0 && byDay.every((d) => d.meals.length === 0)) return null;

  return {
    generatedAt: null,
    note: "",
    local: true,
    week: {
      aisles,
      total: null,
      itemCount,
      days: (days || []).length,
      priced: 0,
      unpriced: itemCount,
      approx: 0,
      region: "",
      zip: "",
      priceSources: [],
      disclaimer: "",
    },
    byDay,
  };
}

/** One shopping line (aisle item or per-meal item) → { name, text, days, meals, price, approx, priceNote }. */
function toShoppingItem(it) {
  const price = Number(it?.price);
  return {
    name: it?.name || "",
    text: it?.text || "",
    days: Array.isArray(it?.days) ? it.days.map(Number).filter(Number.isFinite) : [],
    meals: Number.isFinite(Number(it?.meals)) ? Number(it.meals) : null,
    price: Number.isFinite(price) ? price : null,
    priceSource: it?.price_source || "",
    approx: Boolean(it?.approx),
    priceNote: it?.price_note || "",
  };
}

/**
 * `food_json.shopping` (server-generated, priced list) → what ShoppingListDialog
 * renders. Returns null when the block is missing so the dialog can fall back
 * to the locally aggregated ingredient list.
 *
 * {
 *   generatedAt, note,
 *   week: { aisles: [{ aisle, items: [ShoppingItem] }], total, itemCount, priced,
 *           unpriced, approx, region, zip, priceSources, disclaimer },
 *   byDay: [{ day, meals: [{ title, slot, items: [ShoppingItem], count, price, steps, tip, minutes }] }],
 * }
 */
function normalizeShopping(raw) {
  if (!raw || typeof raw !== "object") return null;
  const week = raw.week || {};
  const aisles = (Array.isArray(week.aisles) ? week.aisles : [])
    .map((a) => ({
      aisle: a?.aisle || "Other",
      items: (Array.isArray(a?.items) ? a.items : []).map(toShoppingItem).filter((it) => it.name),
    }))
    .filter((a) => a.items.length > 0);
  const byDay = (Array.isArray(raw.by_day?.days) ? raw.by_day.days : []).map((d, i) => ({
    day: Number.isFinite(Number(d?.day)) ? Number(d.day) : i + 1,
    meals: (Array.isArray(d?.meals) ? d.meals : []).map((m) => ({
      title: m?.title || "Meal",
      slot: m?.slot || "",
      items: (Array.isArray(m?.items) ? m.items : []).map(toShoppingItem).filter((it) => it.name),
      count: Number.isFinite(Number(m?.count)) ? Number(m.count) : null,
      price: Number.isFinite(Number(m?.price)) ? Number(m.price) : null,
      steps: Array.isArray(m?.steps) ? m.steps.filter(Boolean) : [],
      tip: m?.tip || "",
      minutes: m?.minutes ? String(m.minutes) : "",
    })),
  }));
  if (aisles.length === 0 && byDay.length === 0) return null;
  const total = Number(week.total);
  return {
    generatedAt: Number.isFinite(Number(raw.generated_at)) ? Number(raw.generated_at) : null,
    note: raw.note || "",
    week: {
      aisles,
      total: Number.isFinite(total) ? total : null,
      itemCount: Number.isFinite(Number(week.items)) ? Number(week.items) : aisles.reduce((n, a) => n + a.items.length, 0),
      days: Number.isFinite(Number(week.days)) ? Number(week.days) : null,
      priced: Number.isFinite(Number(week.priced)) ? Number(week.priced) : null,
      unpriced: Number.isFinite(Number(week.unpriced)) ? Number(week.unpriced) : null,
      approx: Number.isFinite(Number(week.approx)) ? Number(week.approx) : null,
      region: week.region || week.zip || "",
      zip: week.zip || "",
      priceSources: Array.isArray(week.price_sources) ? week.price_sources : [],
      disclaimer: week.disclaimer || "",
    },
    byDay,
  };
}

/**
 * Response of get_weekly_food_json_suggestions_weeks_newtest → PLAN SHAPE.
 * Accepts either the full envelope ({ status, data }) or just `data`.
 */
export function normalizeWeeklyPlan(response) {
  const data = response?.data && response?.data?.food_json !== undefined ? response.data : response;
  const foodJson = data?.food_json || {};
  const weekTargets = readTargets(foodJson) || readTargets(data);

  const days = (Array.isArray(foodJson.days) ? foodJson.days : []).map((day, di) => {
    const meals = { breakfast: [], lunch: [], snacks: [], dinner: [] };
    const list = Array.isArray(day?.meals) ? day.meals : [];
    list.forEach((meal, mi) => {
      const slot = slotForMeal(meal);
      const item = toFoodItem(meal, `d${di + 1}-${slot}-${mi}`);
      // Position inside this slot as stored on the server — becomes `food_index`
      // for update/delete calls. Kept across swaps so edits target the right row.
      item.origIndex = meals[slot].length;
      meals[slot].push(item);
    });
    return {
      label: dayLabel(day, di),
      // `day_code` is what the update API uses to locate the day.
      day_code: String(day?.day_code || day?.dayCode || `d${di + 1}`).toLowerCase(),
      date: day?.date || null,
      targets: readTargets(day) || weekTargets,
      meals,
    };
  });

  return {
    days,
    shopping: normalizeShopping(foodJson.shopping || data?.shopping),
    meta: {
      id: data?.id ?? null,
      dietitian_id: data?.dietitian_id ?? null,
      profile_id: data?.profile_id ?? null,
      week_start_date: data?.week_start_date ?? null,
      week_end_date: data?.week_end_date ?? null,
      week_range: data?.week_range ?? null,
      status_value: data?.status_value ?? null,
    },
  };
}

/* ============================================================ plan → API */

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** ["step", …] → "<ol><li>step</li>…</ol>" — the format `recipe.post_content` uses on read. */
function stepsToHtml(steps) {
  const list = (Array.isArray(steps) ? steps : []).filter(Boolean);
  return list.length ? `<ol>${list.map((st) => `<li>${escapeHtml(st)}</li>`).join("")}</ol>` : "";
}

/**
 * Recipe detail (method, tips, ingredients, image, ids) in the exact shape the
 * read endpoint returns, so a meal added/swapped from FitChef keeps its Method
 * and ingredients after Save → reload. toFoodItem() reads these keys back.
 * Ingredient quantities are per 1 serving (the card multiplies by servings).
 */
function toApiRecipeDetail(item) {
  const people = String(item.portion || "").match(/serves\s+(\d+)/i)?.[1];
  return {
    name: item.name,
    recipe: {
      image: item.image || "",
      post_content: stepsToHtml(item.method_steps),
      recipe_tip: stepsToHtml(item.tips),
      diet: item.diet_type ? [item.diet_type] : [],
      type_of_food: [],
      recipe_allergy: [],
      recipe_meal_type: [],
      recipe_amount_of_people: people ? [people] : ["1"],
      recipe_taxonomy_preparation_time: item.prep_minutes ? [String(item.prep_minutes)] : [],
    },
    // ingredients: (item.ingredients || [])
    //   .filter((ing) => ing?.name)
    //   .map((ing) => ({
    //     name: ing.name,
    //     units: num(ing.qty),
    //     unitSingular: ing.unit || "",
    //     unitMultiple: ing.unit || "",
    //   })),


    ingredients: (item.ingredients || [])
  .filter((ing) => ing?.name)
  .map((ing) => {
    const units =
  hasNumericValue(ing?.units)
    ? Number(ing.units)
    : hasNumericValue(ing?.qty)
      ? Number(ing.qty)
      : 0;

const grams =
  hasNumericValue(ing?.grams)
    ? Number(ing.grams)
    : null;

    const unit =
      ing?.unit || "";

    return {
      name: ing.name,

      units,

      unit,

      unitSingular: unit,

      unitMultiple: unit,

      ...(grams !== null
        ? {
            grams,
          }
        : {}),

      ...(ing?.productId !== undefined &&
      ing?.productId !== null
        ? {
            productId: ing.productId,
          }
        : {}),

      ...(ing?.unitId !== undefined &&
      ing?.unitId !== null
        ? {
            unitId: ing.unitId,
          }
        : {}),
    };
  }),


    recipeId: item.recipeId ?? null,
    variantId: item.variantId ?? null,
    hash: item.hash ?? null,
    eatingMomentId: item.eatingMomentId ?? null,
    fitchefKey: item.fitchefKey ?? null,
  };
}

/** FoodItem (at its current servings) → the food object the update API validates. */
function toApiFood(item, slot) {
  const s = scaledFood(item);
  const serv = item.servings || 1;
  const portion = serv === 1 ? item.portion || "1 serving" : `${serv} × ${item.portion || "serving"}`;
  return {
    // Contract fields (see src/lib/food-update.js) — these the API always stores.
    food_name: item.name,
    calories: round(s.kcal),
    carbs_g: round(s.carbs_g),
    protein_g: round(s.protein_g),
    fat_g: round(s.fat_g),
    fiber_g: round(s.fiber_g),
    portion_with_metric: portion,
    category: item.diet_type || SLOT_META[slot]?.label || slot,
    // Recipe detail, read-format shape, so the row survives reload with its method.
    ...toApiRecipeDetail(item),
  };
}

function foodChanged(before, after) {
  if (!before || !after) return true;
  return (
    before.id !== after.id ||
    before.name !== after.name ||
    (before.servings || 1) !== (after.servings || 1) ||
    before.protein_g !== after.protein_g ||
    before.carbs_g !== after.carbs_g ||
    before.fat_g !== after.fat_g ||
    before.fiber_g !== after.fiber_g
  );
}

/**
 * Diffs the edited plan against the loaded one and returns the ordered list of
 * { action, day_code, meal_type, food_index?, food? } operations to send.
 * Order within a slot: updates (indices unchanged), then deletes from the
 * highest index down (so earlier indices stay valid), then adds.
 */
function diffPlanOps(original, current) {
  const ops = [];
  if (!original || !current) return ops;

  current.days.forEach((day, di) => {
    const origDay = original.days[di];
    if (!origDay) return;
    const dayCode = day.day_code || origDay.day_code || `d${di + 1}`;

    for (const slot of SLOTS) {
      const items = day.meals?.[slot] || [];
      const origItems = origDay.meals?.[slot] || [];
      const updates = [];
      const deletes = [];
      const adds = [];

      for (const item of items) {
        const hasOrigin = Number.isInteger(item.origIndex) && origItems[item.origIndex];
        if (!hasOrigin) {
          if (!item.removed) adds.push({ action: "add", day_code: dayCode, meal_type: slot, food: toApiFood(item, slot) });
          continue;
        }
        const before = origItems[item.origIndex];
        if (item.removed) {
          if (!before.removed) deletes.push({ action: "delete", day_code: dayCode, meal_type: slot, food_index: item.origIndex });
          continue;
        }
        if (foodChanged(before, item)) {
          updates.push({ action: "update", day_code: dayCode, meal_type: slot, food_index: item.origIndex, food: toApiFood(item, slot) });
        }
      }

      deletes.sort((a, b) => b.food_index - a.food_index);
      ops.push(...updates, ...deletes, ...adds);
    }
  });

  return ops;
}

/** True for API failures that just mean "no plan for this week" rather than a real error. */
function isNoDataError(err) {
  const msg = String(err?.message || err?.data?.message || "").toLowerCase();
  return msg.includes("no data") || msg.includes("not found") || msg.includes("no plan") || msg.includes("no weekly");
}


/* ============================================================ helpers */

function round(n) {
  return Math.round(n * 10) / 10;
}

function scaledFood(f) {
  const s = f.servings || 1;
  // Prefer the API's kcal (accounts for alcohol/rounding); derive from macros otherwise.
  const baseKcal = f.kcal_base ?? f.protein_g * 4 + f.carbs_g * 4 + f.fat_g * 9;
  return {
    ...f,
    kcal: round(baseKcal * s),
    protein_g: round(f.protein_g * s),
    carbs_g: round(f.carbs_g * s),
    fat_g: round(f.fat_g * s),
    fiber_g: round(f.fiber_g * s),
  };
}

function sumMeals(meals) {
  const totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  for (const slot of SLOTS) {
    for (const f of meals[slot] || []) {
      if (f.removed) continue;
      const s = scaledFood(f);
      totals.kcal += s.kcal;
      totals.protein_g += s.protein_g;
      totals.carbs_g += s.carbs_g;
      totals.fat_g += s.fat_g;
      totals.fiber_g += s.fiber_g;
    }
  }
  return totals;
}

/**
 * Grams over/under target, same wording and 2%-or-1g threshold as
 * macroItem() in client.html — "21g over" / "33g short" / "on target",
 * not a raw percentage.
 */
function deltaLabel(value, target) {
  if (!target) return null;
  const diff = value - target;
  const pct = Math.abs(diff / target) * 100;
  if (Math.abs(diff) < 1 || pct < 2) return { text: "on target", cls: "text-emerald-600", up: null };
  const up = diff > 0;
  return { text: `${Math.abs(Math.round(diff))}g ${up ? "over" : "short"}`, cls: up ? "text-amber-600" : "text-blue-600", up };
}

/**
 * Same threshold as deltaLabel(), worded for the meal builder:
 * "3g more needed" / "7g too much" / "on target".
 */
function gapLabel(value, target) {
  if (!target) return null;
  const diff = value - target;
  const pct = Math.abs(diff / target) * 100;
  if (Math.abs(diff) < 1 || pct < 2) return { text: "just right", cls: "text-emerald-600", up: null };
  const up = diff > 0;
  return { text: `${Math.abs(Math.round(diff))}g ${up ? "too much" : "more needed"}`, cls: up ? "text-amber-600" : "text-blue-600", up };
}

/** "piece" ↔ "pieces", "ounces" ↔ "ounce" — only for plain single-word units. */
function pluralUnit(unit, n) {
  const u = String(unit || "").trim();
  if (!/^[a-z]+$/i.test(u)) return u;
  const one = Math.abs(num(n) - 1) < 1e-9;
  if (one) return u.length > 3 && /s$/i.test(u) && !/ss$/i.test(u) ? u.slice(0, -1) : u;
  return /s$/i.test(u) ? u : `${u}s`;
}

/* ============================================================ component */

export default function DietPlanNew({ plan: planProp, clientName = "Client", clientGoal = "", onSave, onUndo }) {
  // Week picked in client-details (recorded by the dietAnalysis slice).
  const requestedWeek = useSelector(selectDietAnalysisRequestedWeek);
  // TEMP (testing only): when no week has been picked (e.g. the client has no
  // weekly tab list yet) fall back to the fixed *_newtest sample week so the
  // plan still loads. Goes away with NEWTEST_FIXED_PAYLOAD in authService.
  const profileId = requestedWeek?.profileId ?? NEWTEST_FIXED_PAYLOAD?.profile_id ?? null;
  const weekStart = requestedWeek?.weekStartDate ?? NEWTEST_FIXED_PAYLOAD?.week_start_date ?? null;
  const weekEnd = requestedWeek?.weekEndDate ?? NEWTEST_FIXED_PAYLOAD?.week_end_date ?? null;

  const [plan, setPlan] = useState(() => planProp || null);
  const [original, setOriginal] = useState(() => (planProp ? structuredClone(planProp) : null));
  const [loading, setLoading] = useState(!planProp);
  const [loadError, setLoadError] = useState(null); // { message, noData: boolean }
  const [reloadKey, setReloadKey] = useState(0);
  // Recipe detail the server does not persist, remembered across Save → reload.
  const detailCacheRef = useRef(new Map());
  const [saving, setSaving] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false); // "Measurements" unit reference

  const [dayIdx, setDayIdx] = useState(0);
  const [mealIdx, setMealIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);

  const [swapState, setSwapState] = useState(null); // { mode: "alts" | "search", foodId }
  const [swapQuery, setSwapQuery] = useState("");
  const [mealBuilder, setMealBuilder] = useState(null); // { name, rows: [{ingredient, grams}] }
  const [shoppingOpen, setShoppingOpen] = useState(false);
  // Client's diet preference → default diet filter for the FitChef swap search.
  const [clientDiet, setClientDiet] = useState("");
  // Client's prescribed macros (get_macro_summary_by_date → final_macro_summary).
  // Used as the comparison target for days whose plan carries no targets of
  // its own, so the "Xg short / over" labels still have something to measure against.
  const [clientTargets, setClientTargets] = useState(null);

  /* ---- client macro targets (non-fatal: labels just stay hidden) ---- */
  useEffect(() => {
    if (!profileId) {
      setClientTargets(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const date = weekStart || new Date().toISOString().slice(0, 10);
        const res = await fetchMacroSummaryByDate(profileId, date);
        if (cancelled) return;
        const body = res?.data && typeof res.data === "object" ? res.data : res;
        setClientTargets(readTargets(body) || readTargets(body?.current_data) || readTargets(body?.previous_data));
      } catch {
        if (!cancelled) setClientTargets(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, weekStart]);

  /* ---- client diet_type (non-fatal: search just defaults to "All") ---- */
  useEffect(() => {
    if (!profileId) {
      setClientDiet("");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getClientProfileDetails(profileId, null);
        const d = res?.data || {};
        if (!cancelled) setClientDiet(fitchefDietFromProfile(d.diet_type || d.dietary_preferences?.diet_type));
      } catch {
        if (!cancelled) setClientDiet("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  /* ---- load the plan for the selected week from the *_newtest endpoint ---- */
  useEffect(() => {
    if (planProp) {
      setPlan(planProp);
      setOriginal(structuredClone(planProp));
      setLoading(false);
      setLoadError(null);
      return undefined;
    }
    if (!profileId || !weekStart || !weekEnd) {
      setPlan(null);
      setOriginal(null);
      setLoading(false);
      setLoadError({ message: "Select a week to load its diet plan.", noData: true });
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const res = await fetchDietAnalysisPlanNewTest(profileId, weekStart, weekEnd);
        if (cancelled) return;
        if (!res || res.status === false || !res.data) {
          setPlan(null);
          setOriginal(null);
          setLoadError({ message: res?.message || "No diet plan found for this week.", noData: true });
          return;
        }
        // Put back any method / ingredients we remembered for rows the server
        // returned bare (custom meals, FitChef swaps) before showing the plan.
        const next = applyDetailCache(normalizeWeeklyPlan(res), detailCacheRef.current);
        setPlan(next);
        setOriginal(structuredClone(next));
        setDirty(false);
        setDayIdx(0);
        setMealIdx(0);
        setSwapState(null);
        setMealBuilder(null);
        if (next.days.length === 0) {
          setLoadError({ message: "This week has no meals planned yet.", noData: true });
        }
        // Rows the server stored without recipe detail (FitChef adds/swaps) get
        // their method / ingredients / image back by name. Merged by row id so
        // edits made while the lookup runs are kept; `original` gets the same
        // patch so Save does not see a phantom change. The plan is already on
        // screen, so drop the spinner before the lookup.
        setLoading(false);
        const patches = await fetchFitChefDetails(next);
        if (cancelled || patches.length === 0) return;
        setPlan((cur) => applyFitChefDetails(cur, patches));
        setOriginal((cur) => applyFitChefDetails(cur, patches));
      } catch (err) {
        if (cancelled) return;
        setPlan(null);
        setOriginal(null);
        setLoadError({
          message: isNoDataError(err) ? "No diet plan found for this week." : err?.message || "Failed to load the diet plan.",
          noData: isNoDataError(err),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planProp, profileId, weekStart, weekEnd, reloadKey]);

  // Days lacking their own targets borrow the client's prescribed macros so
  // the macros panel and the day tabs can compare against something.
  const days = useMemo(() => {
    const list = plan?.days || [];
    if (!clientTargets) return list;
    return list.map((d) => (d.targets ? d : { ...d, targets: clientTargets }));
  }, [plan, clientTargets]);
  const day = days[dayIdx] || null;
  const slot = SLOTS[mealIdx];
  const items = day?.meals?.[slot] || [];
  const dayTotals = useMemo(() => (day ? sumMeals(day.meals) : EMPTY_TOTALS), [day]);
  const weekRange = plan?.meta?.week_range || (weekStart && weekEnd ? `${weekStart} – ${weekEnd}` : null);

  /* ---- live shopping-list pricing (FitChef) ----
   * `food_json.shopping` is priced when the plan is generated, so a dish added
   * or swapped from Search has no price there until the backend rebuilds it.
   * While the dialog is open, the plan as it is on screen (saved or not) is
   * priced through FitChef; the server list stays up as the placeholder. */
  const [liveShopping, setLiveShopping] = useState(null); // { key, shopping }
  const [pricing, setPricing] = useState(false);
  useEffect(() => {
    if (!shoppingOpen || !plan) return undefined;
    const weekPayload = shoppingPayload(days);
    const key = JSON.stringify(weekPayload.days);
    if (liveShopping?.key === key) return undefined;
    if (weekPayload.meals.every((m) => m.ingredients.length === 0)) return undefined; // nothing to price
    const ctrl = new AbortController();
    setPricing(true);
    (async () => {
      try {
        const mealPayload = shoppingPayload(days, true);
        const [weekRes, mealRes] = await Promise.all([
          priceShoppingListService(weekPayload.days, { signal: ctrl.signal }),
          priceShoppingListService(mealPayload.days, { signal: ctrl.signal }),
        ]);
        if (ctrl.signal.aborted) return;
        setLiveShopping({ key, shopping: buildLocalShopping(days, pricingFromFitChef(weekRes, mealRes, mealPayload.meals)) });
      } catch (err) {
        if (!ctrl.signal.aborted) console.warn("[DietPlanNew] shopping pricing failed:", err?.message || err);
      } finally {
        if (!ctrl.signal.aborted) setPricing(false);
      }
    })();
    return () => {
      ctrl.abort();
      setPricing(false);
    };
  }, [shoppingOpen, plan, days, liveShopping?.key]);

  function flash(message) {
    setToast(message);
    setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 2600);
  }

  function updateFood(dIdx, slotKey, foodId, updater) {
    setPlan((prev) => {
      const next = structuredClone(prev);
      const list = next.days[dIdx].meals[slotKey];
      const i = list.findIndex((f) => f.id === foodId);
      if (i === -1) return prev;
      const before = list[i];
      const after = updater(before);
      // Keep the server-side slot position so Save can address this row.
      if (Number.isInteger(before.origIndex)) after.origIndex = before.origIndex;
      list[i] = after;
      return next;
    });
    setDirty(true);
  }

  function stepPortion(foodId, delta) {
    updateFood(dayIdx, slot, foodId, (f) => {
      const next = Math.min(6, Math.max(0.25, (f.servings || 1) + delta * 0.25));
      return { ...f, servings: next };
    });
  }

  function deleteFood(foodId) {
    const f = items.find((x) => x.id === foodId);
    if (!f) return;
    if (!window.confirm(`Remove "${f.name}" from the plan?\n\nThe slot stays, empty, so you can build a replacement.`)) return;
    updateFood(dayIdx, slot, foodId, (fd) => ({ ...fd, removed: true }));
    flash(`Removed ${f.name}`);
  }

  /**
   * Appends a brand-new food to a slot (used when the slot is empty). No
   * `origIndex`, so Save sends it as an "add" op.
   */
  function addFood(dIdx, slotKey, item) {
    setPlan((prev) => {
      const next = structuredClone(prev);
      const list = next.days[dIdx].meals[slotKey];
      list.push(item);
      return next;
    });
    setDirty(true);
  }

  /** `alt` is a FoodItem — a plan alternative or a FitChef search hit (see fromFitChefResult). */
  function applySwap(alt) {
    if (!swapState) return;

    // Empty slot: nothing to replace, so add the picked dish as a new row.
    if (swapState.foodId == null) {
      addFood(dayIdx, slot, {
        ...structuredClone(alt),
        id: `d${dayIdx + 1}-${slot}-new-${Date.now()}`,
        servings: 1,
        removed: false,
        alternatives: 0,
        alternativeItems: [],
      });
      setSwapState(null);
      flash(`Added ${alt.name}`);
      return;
    }

    const current = items.find((x) => x.id === swapState.foodId);

    updateFood(dayIdx, slot, swapState.foodId, () => {
      // Keep the meal we are replacing (plus the other alternatives) reachable
      // so the dietitian can swap back.
      const others = (current?.alternativeItems || []).filter((a) => a.id !== alt.id);
      const alternativeItems = current
        ? [{ ...structuredClone(current), servings: 1, removed: false, alternatives: 0, alternativeItems: [] }, ...others]
        : others;
      return {
        ...structuredClone(alt),
        id: `${swapState.foodId}-swap-${Date.now()}`,
        servings: 1,
        removed: false,
        alternatives: alternativeItems.length,
        alternativeItems,
      };
    });
    setSwapState(null);
    flash(`Swapped to ${alt.name}`);
  }

  function openMealBuilder(foodId) {
    // The meal being replaced (at its current servings) is the target the
    // builder fits portions to and draws in the chart until foods are added.
    const current = foodId == null ? null : items.find((f) => f.id === foodId) || null;
    let target = null;
    let targetKind = null; // "replace" | "gap"
    if (current) {
      const s = scaledFood(current);
      target = { kcal: s.kcal, p: s.protein_g, c: s.carbs_g, f: s.fat_g };
      targetKind = "replace";
    } else if (day?.targets && (day.targets.kcal || day.targets.protein_g)) {
      // Adding a meal: the target is what the day still needs to reach its
      // macro targets, so "Close the gap for me" has a gap to close.
      const t = day.targets;
      const left = (goal, have) => Math.max(0, num(goal) - num(have));
      target = {
        kcal: left(t.kcal, dayTotals.kcal),
        p: left(t.protein_g, dayTotals.protein_g),
        c: left(t.carbs_g, dayTotals.carbs_g),
        f: left(t.fat_g, dayTotals.fat_g),
      };
      targetKind = "gap";
      if (!(target.kcal > 0) && !(target.p > 0)) target = null; // day already met
    }
    // Rows start empty — the dialog adds dishes from the FitChef bank.
    setMealBuilder({ forFoodId: foodId, replacingName: current?.name || "", target, targetKind, name: "", rows: [], method: "", tip: "" });
  }

  function mealBuilderTotals() {
    return sumMealRows(mealBuilder?.rows);
  }

  function saveCustomMeal() {
    if (!mealBuilder) return;
    const totals = mealBuilderTotals();
    if (mealBuilder.rows.length === 0) {
      flash("Add at least one food to the meal first.");
      return;
    }
    const rows = mealBuilder.rows;
    const single = rows.length === 1 ? rows[0] : null;
    // A FitChef dish brings its own ingredient list (scaled by qty). A library
    // food has no breakdown, so it becomes its own single ingredient: one
    // portion reads "1 egg muffin (120 g)"; more read "2 × 1 egg muffin (120 g)".
    // const ingredients = rows.flatMap((r) => {
    //   if (Array.isArray(r.contains) && r.contains.length > 0) {
    //     return r.contains.map((ing) => ({ name: ing.name, qty: round(num(ing.qty) * num(r.qty)), unit: ing.unit }));
    //   }
    //   const qty = num(r.qty);
    //   const lead = String(r.portion || "").match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    //   if (qty === 1 && lead) return [{ name: r.name, qty: num(lead[1].replace(",", ".")), unit: lead[2] }];
    //   return [{ name: r.name, qty, unit: `× ${r.portion}` }];
    // });

const ingredients = rows.flatMap((r) =>
  Array.isArray(r.contains) && r.contains.length > 0
    ? r.contains.map((ing) => ({
        name: ing.name,

        qty:
          round(
            num(ing.qty) *
            num(r.qty)
          ),

        units:
          ing.units !== null &&
          ing.units !== undefined
            ? round(
                num(ing.units) *
                num(r.qty)
              )
            : null,

        unit:
          ing.unit,

        grams:
          ing.grams !== null &&
          ing.grams !== undefined
            ? round(
                num(ing.grams) *
                num(r.qty)
              )
            : null,
      }))
    : [
        {
          name: r.name,

          qty: num(r.qty),

          units:
            num(r.qty),

          unit:
            `× ${r.portion}`,

          grams:
            null,
        },
      ]
);


    const typedSteps = textToSteps(mealBuilder.method);
    const custom = {
      id: `custom-${Date.now()}`,
      name: mealBuilder.name || rows.map((r) => r.name).join(", "),
      icon: "🍲",
      image: rows.find((r) => r.image)?.image || null,
      portion: single ? (num(single.qty) === 1 ? single.portion : `${fmtQty(single.qty)} × ${single.portion}`) : "custom",
      prep_minutes: null,
      diet_type: "custom",
      kcal_base: round(totals.kcal),
      protein_g: round(totals.p),
      carbs_g: round(totals.c),
      fat_g: round(totals.f),
      fiber_g: round(totals.fiber),
      servings: 1,
      ingredients,
      // Typed steps win; a single dish keeps its own method; otherwise a basic
      // method is generated so the card always has one.
      method_steps: typedSteps.length
        ? typedSteps
        : single?.method?.length
          ? single.method
          : suggestMethodSteps(rows, mealBuilder.name),
      tips: textToSteps(mealBuilder.tip),
      alternatives: 0,
      alternativeItems: [],
      fitchefKey: single?.fitchefKey ?? null,
      removed: false,
    };
    // Empty slot (no food to replace) → add; otherwise replace the chosen food.
    if (mealBuilder.forFoodId == null) addFood(dayIdx, slot, custom);
    else updateFood(dayIdx, slot, mealBuilder.forFoodId, () => custom);
    setMealBuilder(null);
    flash(`Saved ${mealBuilder.name || "custom meal"}`);
  }

  function shoppingList() {
    const map = new Map();
    for (const d of days) {
      for (const s of SLOTS) {
        for (const f of d.meals?.[s] || []) {
          if (f.removed) continue;
          for (const ing of f.ingredients || []) {
            if (!ing?.name) continue;
            const key = `${ing.name}|${ing.unit}`;
            map.set(key, (map.get(key) || 0) + Number(ing.qty || 0) * (f.servings || 1));
          }
        }
      }
    }
    return Array.from(map.entries()).map(([key, qty]) => {
      const [name, unit] = key.split("|");
      return { name, qty: round(qty), unit };
    });
  }

  async function save() {
    if (saving || !plan) return;

    const ops = diffPlanOps(original, plan);
    if (ops.length === 0) {
      setDirty(false);
      flash("Nothing to save");
      return;
    }

    const meta = plan.meta || {};
    const identity = {
      id: Number(meta.id),
      profile_id: meta.profile_id || profileId,
      week_start_date: meta.week_start_date || weekStart,
      week_end_date: meta.week_end_date || weekEnd,
    };
    if (!identity.id || !identity.profile_id) {
      flash("Cannot save: this plan has no row id / profile id.");
      return;
    }

    // Remember every row's recipe detail: the API stores only name + macros, and
    // the reload after saving would otherwise drop methods and ingredients.
    collectRecipeDetail(plan, detailCacheRef.current);

    setSaving(true);
    let done = 0;
    let lastResponse = null;
    try {
      // The API mutates one food per call and locks the row, so send sequentially.
      for (const op of ops) {
        const payload = { ...identity, ...op };
        const res = await updateDietPlanFoodNewTestService(payload);
        // The newtest endpoints answer { status: true|false, message, data }
        // (same envelope as the read call); older ones used ok / success.
        const accepted = res?.ok === true || res?.success === true || res?.status === true || res?.status === "success";
        console.debug("[DietPlanNew] save op", { payload, response: res, accepted });
        if (!accepted) {
          throw new Error(res?.message || `Save failed at change ${done + 1} of ${ops.length}`);
        }
        lastResponse = res;
        done += 1;
      }

      setDirty(false);
      flash(`Saved ${done} change${done === 1 ? "" : "s"}`);
      onSave?.(plan, lastResponse);
      // Reload from the server so indices/totals reflect what was persisted.
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("DietPlanNew save failed:", err);
      const prefix = done > 0 ? `Saved ${done} of ${ops.length}, then failed: ` : "Save failed: ";
      flash(prefix + (err?.message || "unknown error"));
      // Partial saves changed the server; reload so the next Save diffs against reality.
      if (done > 0) setReloadKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  function undo() {
    if (!original) return;
    setPlan(structuredClone(original));
    setDirty(false);
    flash("Reverted to original plan");
    onUndo?.();
  }


  /* ---------------------------------------------- loading / empty states */
  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-center p-4 md:p-6">
        <div className="flex h-[360px] w-full flex-col items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-neutral-100">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500" />
          <p className="mt-4 text-sm text-neutral-500">Loading diet plan{weekRange ? ` for ${weekRange}` : ""}…</p>
        </div>
      </div>
    );
  }

  if (!plan || !day) {
    const isError = loadError && !loadError.noData;
    return (
      <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
        <div className="flex h-[360px] w-full flex-col items-center justify-center rounded-2xl bg-white px-6 text-center shadow-sm ring-1 ring-neutral-100">
          <div className="text-3xl">{isError ? "⚠️" : "🍽️"}</div>
          <p className={cn("mt-3 text-sm font-semibold", isError ? "text-red-600" : "text-neutral-700")}>
            {loadError?.message || "No diet plan found for this week."}
          </p>
          {weekRange && <p className="mt-1 text-xs text-neutral-400">{weekRange}</p>}
          {profileId && weekStart && weekEnd && (
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-4 rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              {isError ? "Try again" : "Refresh"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
      {/* ---------------------------------------------------- client header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-bold text-neutral-900">{clientName}</div>
          <div className="text-sm text-neutral-500">
            {[clientGoal, weekRange].filter(Boolean).join(" · ")}
            {plan.meta?.status_value === 1 && (
              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Approved
              </span>
            )}
          </div>
        </div>
        {dirty && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            Unsaved changes
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ------------------------------------------------- macros panel */}
        <MacrosPanel totals={dayTotals} targets={day.targets} dayIndex={dayIdx} />

        {/* --------------------------------------------------- plan panel */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
          {/* day tabs — the whole pill carries on-target/over/under state, same as the python dashboard */}
          <div className="flex flex-wrap items-center gap-1 border-b border-neutral-100 pb-3">
            {days.map((d, i) => {
              const t = sumMeals(d.meals);
              const targetKcal = num(d.targets?.kcal);
              const ratio = targetKcal ? t.kcal / targetKcal : null;
              // No target → neutral pill rather than a bogus "over".
              const status = ratio === null ? "none" : ratio > 1.08 ? "over" : ratio < 0.92 ? "under" : "ok";
              const active = i === dayIdx;
              return (
                <button
                  key={`${d.label}-${i}`}
                  onClick={() => {
                    setDayIdx(i);
                    setMealIdx(0);
                  }}
                  title={targetKcal ? `${Math.round(t.kcal)} of ${Math.round(targetKcal)} kcal` : `${Math.round(t.kcal)} kcal`}
                  className={cn(
                    "min-h-[36px] min-w-[38px] rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                    !active && status === "none" && "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                    active && status === "none" && "bg-neutral-900 text-white",
                    !active && status === "ok" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                    !active && status === "over" && "bg-amber-50 text-amber-700 hover:bg-amber-100",
                    !active && status === "under" && "bg-blue-50 text-blue-700 hover:bg-blue-100",
                    active && status === "ok" && "bg-emerald-600 text-white",
                    active && status === "over" && "bg-amber-600 text-white",
                    active && status === "under" && "bg-blue-600 text-white",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setShoppingOpen(true)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Shopping list
              </button>
              <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800">
                Approve week
              </button>
            </div>
            <div className="mt-1.5 flex w-full flex-wrap items-center gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-sm bg-emerald-600" />
                on target
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-sm bg-amber-600" />
                over
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-sm bg-blue-600" />
                short
              </span>
              <span className="w-full text-neutral-600 sm:ml-auto sm:w-auto sm:text-right">
                by calories · hover a day for its numbers
              </span>
            </div>
          </div>

          {/* meal tabs */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SLOTS.map((s, i) => (
              <button
                key={s}
                onClick={() => setMealIdx(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  i === mealIdx ? "bg-blue-50 text-blue-700" : "text-neutral-500 hover:bg-neutral-100",
                )}
                title={SLOT_META[s].time}
              >
                {SLOT_META[s].label}
              </button>
            ))}
          </div>

          {/* food cards */}
          <div className="mt-2">
            {items.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 py-10">
                <ActionBtn
                  primary
                  onClick={() => {
                    setSwapQuery("");
                    setSwapState({ mode: "search", foodId: null });
                  }}
                >
                  Search a swap
                </ActionBtn>
                <ActionBtn onClick={() => openMealBuilder(null)}>Make my meal</ActionBtn>
              </div>
            )}
            {items.map((f, i) => (
              <FoodCard
                key={f.id}
                index={i}
                food={f}
                onStepPortion={(delta) => stepPortion(f.id, delta)}
                onDelete={() => deleteFood(f.id)}
                onOpenSwaps={() => setSwapState({ mode: "alts", foodId: f.id })}
                onSearchSwap={() => {
                  setSwapQuery("");
                  setSwapState({ mode: "search", foodId: f.id });
                }}
                onMakeMeal={() => openMealBuilder(f.id)}
                onShowMeasurements={() => setMeasureOpen(true)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* --------------------------------------------------------- save bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4">
          <div className="flex items-center gap-3 rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white shadow-lg">
            <span>{saving ? "Saving your changes…" : "You have unsaved changes to this plan."}</span>
            <button onClick={undo} disabled={saving} className="rounded-full bg-white/10 px-3 py-1 font-semibold hover:bg-white/20 disabled:opacity-50">
              Undo
            </button>
            <button onClick={save} disabled={saving} className="rounded-full bg-blue-600 px-3 py-1 font-semibold hover:bg-blue-500 disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-900/95 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* ---------------------------------------------------- swap dialog */}
      {swapState && (
        <SwapDialog
          mode={swapState.mode}
          alternatives={items.find((x) => x.id === swapState.foodId)?.alternativeItems || []}
          replacing={items.find((x) => x.id === swapState.foodId)?.name || ""}
          // Share of the day: against the kcal target when the plan has one,
          // otherwise against what the day currently adds up to.
          dayKcal={num(day?.targets?.kcal) || num(dayTotals.kcal)}
          slot={slot}
          defaultDiet={clientDiet}
          query={swapQuery}
          onQuery={setSwapQuery}
          onClose={() => setSwapState(null)}
          onPick={applySwap}
        />
      )}

      {/* ------------------------------------------- measurements reference */}
      {measureOpen && <MeasurementsDialog days={days} onClose={() => setMeasureOpen(false)} />}

      {/* ------------------------------------------------ make-my-meal dialog */}
      {mealBuilder && (
        <MakeMealDialog
          state={mealBuilder}
          totals={mealBuilderTotals()}
          target={mealBuilder.target}
          slot={slot}
          defaultDiet={clientDiet}
          onChange={setMealBuilder}
          onClose={() => setMealBuilder(null)}
          onSave={saveCustomMeal}
        />
      )}

      {/* --------------------------------------------------- shopping list */}
      {shoppingOpen && (
        <ShoppingListDialog
          shopping={liveShopping?.shopping || plan.shopping || buildLocalShopping(days)}
          fallbackItems={shoppingList()}
          dirty={dirty && !liveShopping?.shopping}
          pricing={pricing}
          onClose={() => setShoppingOpen(false)}
        />
      )}
    </div>
  );
}

/* ============================================================ MacrosPanel */

function MacrosPanel({ totals, targets, dayIndex = 0 }) {
  const p = Math.round(totals.protein_g);
  const c = Math.round(totals.carbs_g);
  const f = Math.round(totals.fat_g);
  const fib = Math.round(totals.fiber_g);

  // Same formula fitchef_generate.py uses for the target, so the number in the
  // donut and the number the plan was built against are the same arithmetic
  // (summing each food's own `calories` field drifted from this over time).
  const calP = p * 4;
  const calC = c * 4;
  const calF = f * 9;
  const calFib = 0; // the generator doesn't count fibre either
  const calTot = calC + calF + calP || 1;
  const cal = calP + calC + calF;

  // Round each share to an integer, then nudge the largest contributor so
  // they sum to exactly 100% (handles rounding drift) — same as macroItem's
  // sibling logic in client.html.
  const pctOf = (part) => Math.round((part / calTot) * 100);
  let pctC = pctOf(calC);
  let pctF = pctOf(calF);
  let pctP = pctOf(calP);
  let pctFib = pctOf(calFib);
  const drift = 100 - (pctC + pctF + pctP + pctFib);
  if (drift !== 0 && calTot > 1) {
    const vals = { C: calC, F: calF, P: calP, Fib: calFib };
    const maxKey = Object.keys(vals).reduce((a, b) => (vals[a] >= vals[b] ? a : b));
    if (maxKey === "C") pctC += drift;
    if (maxKey === "F") pctF += drift;
    if (maxKey === "P") pctP += drift;
    if (maxKey === "Fib") pctFib += drift;
  }

  // Arcs, clockwise from 12 o'clock: Fibre → Protein → Fats → Carbs.
  const R = 90;
  const CIRC = 2 * Math.PI * R;
  const GAP = 6;
  const arcs = [
    { key: "fibre", pct: pctFib, color: MACRO_COLORS.fibre },
    { key: "protein", pct: pctP, color: MACRO_COLORS.protein },
    { key: "fats", pct: pctF, color: MACRO_COLORS.fats },
    { key: "carbs", pct: pctC, color: MACRO_COLORS.carbs },
  ];
  let cursor = 0;
  const segs = arcs.map((a) => {
    const len = Math.max(0, (a.pct / 100) * CIRC - (a.pct > 0 ? GAP : 0));
    const seg = { ...a, dash: `${len} ${CIRC - len}`, dashOffset: -cursor };
    cursor += (a.pct / 100) * CIRC;
    return seg;
  });

  // Bubbles sit at the midpoint angle of their own segment. Hidden below 4%
  // — at that size two bubbles land on top of each other and read as noise.
  let bubbleCursor = 0;
  const bubbles = arcs
    .map((a) => {
      const midPct = bubbleCursor + a.pct / 2;
      bubbleCursor += a.pct;
      if (a.pct < 4) return null;
      const angleRad = ((midPct / 100) * 360 - 90) * (Math.PI / 180);
      const cx = 120 + 75 * Math.cos(angleRad);
      const cy = 120 + 75 * Math.sin(angleRad);
      return { key: a.key, pct: a.pct, top: (cy / 240) * 100, left: (cx / 240) * 100 };
    })
    .filter(Boolean);

  const legend = [
    { label: "Carbs", color: MACRO_COLORS.carbs, g: c, target: targets?.carbs_g },
    { label: "Fats", color: MACRO_COLORS.fats, g: f, target: targets?.fat_g },
    { label: "Protein", color: MACRO_COLORS.protein, g: p, target: targets?.protein_g },
    { label: "Fibre", color: MACRO_COLORS.fibre, g: fib, target: targets?.fiber_g || null },
  ];

  const hasTargets = Boolean(targets?.protein_g || targets?.carbs_g || targets?.fat_g);
  const targetKcal = hasTargets
    ? Math.round(num(targets.kcal) || (targets.protein_g || 0) * 4 + (targets.carbs_g || 0) * 4 + (targets.fat_g || 0) * 9)
    : null;

  const narrative =
    `Day ${dayIndex + 1} plan. Macros below are computed from the day's foods. Donut shows each macro's share of ` +
    `total calories (Protein/Carbs ×4 kcal/g, Fat ×9) — the same formula the plan was built with.`;

  return (
    <section className="h-fit rounded-2xl bg-neutral-50 p-5 ring-1 ring-neutral-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Diet Plan Macros</h3>

      <div className="relative mx-auto mt-4 h-[220px] w-[220px]">
        <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
          <circle cx="120" cy="120" r={R} fill="transparent" stroke="#eceef1" strokeWidth="20" />
          {segs.map((s) => (
            <circle
              key={s.key}
              cx="120"
              cy="120"
              r={R}
              fill="transparent"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={s.dash}
              strokeDashoffset={s.dashOffset}
              className="transition-all duration-500"
            />
          ))}
        </svg>
        {bubbles.map((b) => (
          <div
            key={b.key}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold text-neutral-900 shadow-md"
            style={{ top: `${b.top}%`, left: `${b.left}%` }}
          >
            {b.pct}%
          </div>
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Calories</span>
          <span className="text-3xl font-bold leading-none tabular-nums text-neutral-900">{cal}</span>
          <span className="text-xs text-neutral-400">{targetKcal ? `of ${targetKcal} kcal` : "kcal"}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {legend.map((l) => {
          const delta = l.target ? deltaLabel(l.g, l.target) : null;
          return (
            <div key={l.label} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} />
                {l.label}
              </div>
              <div className="text-lg font-bold tabular-nums text-neutral-900">{Math.round(l.g)}g</div>
              {l.target ? <div className="text-xs text-neutral-400">of {Math.round(l.target)}g</div> : null}
              {delta && (
                <div className={cn("mt-0.5 flex items-center gap-1 text-xs font-semibold", delta.cls)}>
                  {delta.up !== null && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      {delta.up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                    </svg>
                  )}
                  {delta.text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-neutral-200 pt-3 text-xs leading-relaxed text-neutral-500">{narrative}</div>
    </section>
  );
}

/* ============================================================ FoodCard */

function FoodCard({ food: f, index, onStepPortion, onDelete, onOpenSwaps, onSearchSwap, onMakeMeal, onShowMeasurements }) {
  const [showMethod, setShowMethod] = useState(false);
  const s = scaledFood(f);
  const serv = f.servings || 1;

  if (f.removed) {
    return (
      <article className="flex gap-3 border-b border-neutral-100 py-4 opacity-70 last:border-b-0">
        <div className="w-5 shrink-0 pt-2 text-right text-sm font-semibold text-neutral-400 tabular-nums">{index + 1}</div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg">○</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm italic text-neutral-400">{f.name} (removed)</div>
          <div className="mt-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
            This meal was removed. Use {f.alternatives > 0 ? <><b>{f.alternatives} swaps</b>, </> : null}
            <b>Search a swap</b> or <b>Make my meal</b> to fill the slot.
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {f.alternatives > 0 && <ActionBtn onClick={onOpenSwaps}>{f.alternatives} swaps</ActionBtn>}
            <ActionBtn primary onClick={onSearchSwap}>
              Search a swap
            </ActionBtn>
            <ActionBtn onClick={onMakeMeal}>Make my meal</ActionBtn>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex gap-3 border-b border-neutral-100 py-4 last:border-b-0">
      <div className="w-5 shrink-0 pt-2 text-right text-sm font-semibold text-neutral-400 tabular-nums">{index + 1}</div>
      <FoodThumb food={f} className="h-9 w-9 rounded-full bg-amber-50 text-lg" />

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-snug text-neutral-900">{f.name}</div>
        <div className="mt-0.5 text-sm text-neutral-500">
          <span className="font-bold tabular-nums text-neutral-900">{s.kcal}kcal</span> <span>{f.portion}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip k="P" v={s.protein_g} />
          <Chip k="C" v={s.carbs_g} />
          <Chip k="F" v={s.fat_g} />
          <Chip k="Fib" v={s.fiber_g} />
        </div>

        <div className="mt-2.5 border-t border-neutral-100 pt-2.5">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {[f.prep_minutes ? `${f.prep_minutes} min` : null, f.diet_type].filter(Boolean).join(" · ")}
          </div>

          <div className="flex items-start gap-3">
            <FoodThumb food={f} className="h-[76px] w-[76px] rounded-lg border border-neutral-200 bg-neutral-50 text-3xl" />

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">servings</span>
                <StepBtn label="−" disabled={serv - 0.25 < 0.25} onClick={() => onStepPortion(-1)} />
                <span className="min-w-[56px] text-center font-mono text-sm font-semibold tabular-nums">{serv}</span>
                <StepBtn label="+" disabled={serv + 0.25 > 6} onClick={() => onStepPortion(1)} />
                {serv !== 1 && (
                  <span className="text-xs font-semibold text-blue-600">
                    {s.kcal} kcal · P{Math.round(s.protein_g)} · C{Math.round(s.carbs_g)} · F{Math.round(s.fat_g)}
                  </span>
                )}
              </div>

              {f.ingredients.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {f.ingredients.map((ing, i) => {
                    const m = unitMetric(ing.unit);
                    return (
                      <span key={i} className="rounded-md border border-neutral-200 bg-neutral-50 px-[7px] py-[2px] text-xs text-neutral-500">
                        {ing.name} <b className="font-semibold text-neutral-900">{fmtQty(ing.qty * serv)}</b> {ing.unit}
                        {m && <span className="ml-1 text-neutral-400">({m.per} {m.unit} each)</span>}
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={onShowMeasurements}
                    title="Measurements"
                    aria-label="Show measurements"
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-bold text-neutral-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    i
                  </button>
                </div>
              )}

              {f.method_steps.length > 0 && (
                <>
                  <button
                    onClick={() => setShowMethod((v) => !v)}
                    className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-blue-600"
                  >
                    {showMethod ? "Hide method" : "Method"}
                  </button>
                  {showMethod && (
                    <>
                      <ol className="mt-1 list-decimal pl-[18px] text-sm text-neutral-500">
                        {f.method_steps.map((step, i) => (
                          <li key={i} className="mb-1">
                            {step}
                          </li>
                        ))}
                      </ol>
                      {f.tips?.length > 0 && (
                        <div className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                          <b className="mr-1 font-semibold">Tip:</b>
                          {f.tips.join(" ")}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {f.alternatives > 0 && <ActionBtn onClick={onOpenSwaps}>{f.alternatives} swaps</ActionBtn>}
            <ActionBtn primary onClick={onSearchSwap}>
              Search a swap
            </ActionBtn>
            <ActionBtn onClick={onMakeMeal}>Make my meal</ActionBtn>
            <button
              onClick={onDelete}
              className="ml-auto rounded-lg px-[11px] py-[5px] text-sm font-semibold text-neutral-400 hover:bg-red-50 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Recipe image when the API provides one, emoji fallback otherwise. */
function FoodThumb({ food: f, className }) {
  const [broken, setBroken] = useState(false);
  const showImage = f.image && !broken;
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden", className)}>
      {showImage ? (
        <img src={f.image} alt={f.name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        f.icon || "🍽️"
      )}
    </div>
  );
}

function Chip({ k, v }) {
  return (
    <span className="rounded-md bg-amber-50 px-2.5 py-[5px] text-sm font-semibold tabular-nums text-amber-800">
      <b className="mr-0.5 text-[10px] uppercase tracking-wide opacity-80">{k}</b> {Math.round(v)}g
    </span>
  );
}

function StepBtn({ label, onClick, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 hover:border-blue-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function ActionBtn({ children, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-[11px] py-[5px] text-sm font-medium transition",
        primary ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-500" : "border-neutral-200 bg-white text-neutral-900 hover:border-blue-400 hover:text-blue-600",
      )}
    >
      {children}
    </button>
  );
}

/* ============================================================ SwapDialog */

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_MIN_CHARS = 2;

/**
 * "alts"   → the pre-built alternatives that came with the plan (no network).
 * "search" → live search against the FitChef dish bank
 *            (GET /api/food/fitchef?q=&slot=&diet=&page=), debounced, abortable,
 *            paged with a "Load more" button. Both render through one row shape.
 */
function SwapDialog({ mode, alternatives = [], replacing = "", dayKcal = 0, slot, defaultDiet = "", query, onQuery, onClose, onPick }) {
  const isSearch = mode === "search";
  const [diet, setDiet] = useState(defaultDiet);
  const [hits, setHits] = useState([]); // FoodItems built from FitChef results
  const [meta, setMeta] = useState({ count: 0, page: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fitchefSlot = FITCHEF_SLOT[slot] || "";
  const trimmed = (query || "").trim();

  async function runSearch(page) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isMore = page > 0;
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await searchFitChefFoodsService(trimmed, { slot: fitchefSlot, diet, page, signal: controller.signal });
      if (controller.signal.aborted) return;
      const seen = new Set(isMore ? hits.map((h) => h.fitchefKey) : []);
      const fresh = (data?.results || [])
        .filter((r) => !seen.has(r?.key))
        .map((r, i) => fromFitChefResult(r, `fitchef-${r?.key || `${page}-${i}`}`));
      setHits(isMore ? [...hits, ...fresh] : fresh);
      setMeta({ count: num(data?.count), page: num(data?.page), pages: num(data?.pages) });
    } catch (err) {
      if (err?.name === "AbortError" || controller.signal.aborted) return;
      setError(err?.message || "Search failed. Try again.");
      if (!isMore) setHits([]);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  // Debounced first-page search whenever the query / diet / slot changes.
  useEffect(() => {
    if (!isSearch) return undefined;
    if (trimmed.length < SEARCH_MIN_CHARS) {
      abortRef.current?.abort();
      setHits([]);
      setMeta({ count: 0, page: 0, pages: 0 });
      setLoading(false);
      setError(null);
      return undefined;
    }
    const t = setTimeout(() => runSearch(0), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearch, trimmed, diet, fitchefSlot]);

  // Cancel any in-flight request when the dialog unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const rows = isSearch ? hits : alternatives;
  const results = rows.map((r) => {
    const s = scaledFood({ ...r, servings: 1, protein_g: r.protein_g || 0, carbs_g: r.carbs_g || 0, fat_g: r.fat_g || 0, fiber_g: r.fiber_g || 0 });
    const kcal = Math.round(r.kcal ?? s.kcal);
    const steps = Array.isArray(r.method_steps) ? r.method_steps : [];
    return {
      raw: r,
      id: r.id,
      name: r.name,
      icon: r.icon,
      image: r.image || null,
      source: r.source || "plan alternative",
      kcal,
      protein_g: Math.round(r.protein_g || 0),
      carbs_g: Math.round(r.carbs_g || 0),
      fat_g: Math.round(r.fat_g || 0),
      // FitChef has no prep time, so estimate one from the method when missing.
      prep_minutes: r.prep_minutes ?? estimatePrepMinutes(steps),
      prep_estimated: r.prep_minutes == null && steps.length > 0,
      // Share of the day's calorie target this dish would take, e.g. 6.8.
      dayPct: dayKcal > 0 ? Math.round((kcal / dayKcal) * 1000) / 10 : null,
      portion: r.portion,
      offSlot: Boolean(r.offSlot),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      method_steps: Array.isArray(r.method_steps) ? r.method_steps : [],
      tips: Array.isArray(r.tips) ? r.tips : [],
    };
  });
  const hasMore = isSearch && meta.pages > 0 && meta.page + 1 < meta.pages;

  let emptyText = null;
  if (results.length === 0 && !loading) {
    if (!isSearch) emptyText = "No alternatives were suggested for this meal.";
    else if (trimmed.length < SEARCH_MIN_CHARS) emptyText = "Type at least 2 letters to search the FitChef dish bank.";
    else if (error) emptyText = error;
    else emptyText = `Nothing matched “${trimmed}”${diet ? ` for ${diet}` : ""}.`;
  }

  return (
    <ModalShell
      title={isSearch ? "Search a swap" : "Swaps for this meal"}
      subtitle={
        isSearch
          ? `${replacing ? `Replacing ${replacing} · ` : ""}FitChef dish bank · ${SLOT_META[slot]?.label || slot}${meta.count ? ` · ${meta.count} match${meta.count === 1 ? "" : "es"}` : ""}`
          : `${replacing ? `${replacing} · ` : ""}${results.length} alternative${results.length === 1 ? "" : "s"} from the plan`
      }
      onClose={onClose}
      widthClass="max-w-[760px]"
      tall
    >
      {isSearch && (
        <div className="flex-none border-b border-neutral-100 px-5 py-3.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search — chicken, oats, salmon…"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-2.5 flex items-center gap-1.5">
            {/* <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Diet</span> */}
            {/* {DIET_FILTERS.map((d) => (
              <button
                key={d.value || "all"}
                type="button"
                onClick={() => setDiet(d.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                  diet === d.value ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                )}
              >
                {d.label}
              </button>
            ))} */}
            {loading && <span className="ml-auto text-xs text-neutral-400">Searching…</span>}
          </div>
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {emptyText && (
          <li className={cn("px-5 py-8 text-center text-sm", error && isSearch ? "text-red-600" : "text-neutral-400")}>{emptyText}</li>
        )}
        {results.map((r) => (
          <SwapRow key={r.id} r={r} isSearch={isSearch} onPick={() => onPick(r.raw)} />
        ))}
        {hasMore && (
          <li className="border-t border-neutral-50 px-5 py-3 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => runSearch(meta.page + 1)}
              className="rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : `Load more (page ${meta.page + 2} of ${meta.pages})`}
            </button>
          </li>
        )}
      </ul>
    </ModalShell>
  );
}

/**
 * FitChef dishes carry no prep time. Rough it out from the method length:
 * about 2½ minutes a step, rounded up to the nearest 5 (2 steps → 5 min,
 * 6 steps → 15 min). Shown with a "~" so it reads as an estimate.
 */
function estimatePrepMinutes(steps) {
  const n = Array.isArray(steps) ? steps.length : 0;
  if (n === 0) return null;
  return Math.max(5, Math.ceil((n * 2.5) / 5) * 5);
}

/**
 * One row in SwapDialog. The "Method" toggle expands the recipe (ingredients,
 * numbered steps, tip) so a dish can be judged before it is added; FitChef
 * hits and plan alternatives both carry these fields, so it works for both.
 */
function SwapRow({ r, isSearch, onPick }) {
  const [showMethod, setShowMethod] = useState(false);
  const hasRecipe = r.ingredients.length > 0 || r.method_steps.length > 0;
  return (
    <li className="border-t border-neutral-50 px-5 py-[11px] first:border-t-0 hover:bg-neutral-50">
      <div className="flex items-start gap-3">
        <FoodThumb food={r} className="h-11 w-11 rounded-lg bg-neutral-100 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-neutral-900">
            {r.name} 
            {/* <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-400">{r.source}</span> */}
            {r.offSlot && (
              <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700" title="Usually served in a different meal">
                other slot
              </span>
            )}
          </div>
          <small className="block font-mono text-xs text-neutral-400">
            {r.kcal} kcal · P{r.protein_g} C{r.carbs_g} F{r.fat_g}
          </small>
          {isSearch && r.portion ? <small className="block text-xs text-neutral-500">{r.portion}</small> : null}
          {(r.prep_minutes || r.dayPct != null) && (
            <small className="block text-xs text-neutral-500">
              {[
                r.prep_minutes ? `${r.prep_estimated ? "~" : ""}${r.prep_minutes} min` : null,
                r.dayPct != null ? `day ${r.dayPct}%` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          )}
          {hasRecipe && (
            <button
              type="button"
              onClick={() => setShowMethod((v) => !v)}
              className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-500"
            >
              {showMethod ? "▾ Hide method" : "▸ Method"}
            </button>
          )}
        </div>
        <button onClick={onPick} className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
          {isSearch ? "Add" : "Swap"}
        </button>
      </div>

      {showMethod && hasRecipe && (
        <div className="ml-14 mt-2 rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
          {r.ingredients.length > 0 && (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Ingredients</div>
              <ul className="mt-1 list-disc pl-[18px] text-sm text-neutral-700">
                {r.ingredients.map((ing, i) => (
                  <li key={i} className="mb-0.5">
                    {fmtQty(ing.qty)} {ing.unit} {ing.name}
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.method_steps.length > 0 && (
            <>
              <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-neutral-400", r.ingredients.length > 0 && "mt-2.5")}>
                Method
              </div>
              <ol className="mt-1 list-decimal pl-[18px] text-sm text-neutral-700">
                {r.method_steps.map((step, i) => (
                  <li key={i} className="mb-1">
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}
          {r.tips.length > 0 && (
            <div className="mt-2 rounded-md border-l-2 border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
              {r.tips.join(" ")}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ============================================================ MeasurementsDialog */

/** Every distinct ingredient unit used anywhere in the plan (all days, all slots). */
function collectPlanUnits(days) {
  const set = new Set();
  (days || []).forEach((day) => {
    for (const slot of SLOTS) {
      for (const item of day?.meals?.[slot] || []) {
        if (!item || item.removed) continue;
        for (const ing of item.ingredients || []) {
          // "× 1 cup (240 g)" and "egg muffin (120 g)" are whole-portion labels
          // from Make my meal, not household units — keep them out of the table.
          const unit = String(ing?.unit || "");
          if (unit.startsWith("×") || /[()]/.test(unit)) continue;
          const key = unitKey(unit);
          if (key) set.add(key);
        }
      }
    }
  });
  return set;
}

/** The household units FitChef plans are written in — always listed in the popup. */
const MEASURE_WEIGHED = ["bowl", "clove", "cup", "fluid ounce", "glass", "handful", "ounce", "pinch", "pound", "squeeze", "tablespoon", "teaspoon"];
const MEASURE_COUNTED = ["cube", "head", "piece", "scoop", "slice", "stalk"];

/**
 * Opened from the "i" button beside a card's ingredient chips. A reference
 * for what each household unit means in metric, then the units that are
 * counted rather than weighed. The standard FitChef set is always shown; any
 * other unit this plan uses is added to the right section.
 */
function MeasurementsDialog({ days, onClose }) {
  const used = collectPlanUnits(days);
  const weighed = [...new Set([...MEASURE_WEIGHED, ...[...used].filter((k) => UNIT_METRIC[k])])]
    .sort()
    .map((k) => ({ key: k, ...UNIT_METRIC[k] }));
  const counted = [...new Set([...MEASURE_COUNTED, ...[...used].filter((k) => !UNIT_METRIC[k])])].sort();

  const heading = "px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-400";
  const note = "bg-amber-50/70 px-5 py-3 text-[13px] leading-relaxed text-neutral-600";

  return (
    <ModalShell title="Measurements" subtitle="what each unit means in this plan" onClose={onClose} widthClass="max-w-[760px]" tall>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={note}>US customary — a cup is 237 ml here, not the 250 ml of a metric cup</div>

        <div className={heading}>Volume and weight</div>
        <ul>
          {weighed.map((u) => (
            <li key={u.key} className="flex items-baseline justify-between border-t border-neutral-100 px-5 py-2.5 text-sm">
              <span className="font-semibold text-neutral-900">1 {u.key}</span>
              <span className="tabular-nums text-neutral-500">
                {u.per} {u.unit}
              </span>
            </li>
          ))}
        </ul>

        <div className={heading}>Counted, not weighed</div>
        <div className="px-5 pb-2 text-sm text-neutral-600">{counted.join(" · ")}</div>

        <div className={heading}>Where these come from</div>
        <div className={cn(note, "mb-4")}>
          <div>
            the <code className="rounded bg-neutral-100 px-1 text-[12px]">hash</code> on every FitChef meal restates its ingredients in metric beside the human list; dividing one by the other gives each
            constant
          </div>
          <div>every conversion came out exact across ~2,400 ingredient lines, not an average</div>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================ MakeMealDialog */

const MEAL_SEARCH_MIN = 2;
const EMPTY_MANUAL = { food_name: "", portion_with_metric: "", calories: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "" };

/** 0.75 → "¾", 4.75 → "4¾", 1.5 → "1½"; other values print as a short decimal. */
function fmtQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  const whole = Math.floor(v);
  const frac = Math.round((v - whole) * 100) / 100;
  const glyph = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.67: "⅔" }[frac];
  if (glyph) return `${whole || ""}${glyph}`;
  if (frac === 0) return String(whole);
  return String(Math.round(v * 100) / 100);
}

/** One decimal, always shown ("0.0", "20.6"). */
function fmt1(n) {
  return (Math.round(num(n) * 10) / 10).toFixed(1);
}

/**
 * How many of the dish's base portions get it closest to the target calories.
 * Snapped to quarters and kept within ×0.5–×2 so the suggestion stays a sane
 * plate; 1 when there is no target or the dish has no calories.
 */
function fitMultiplier(dishKcal, targetKcal) {
  const k = num(dishKcal);
  const t = num(targetKcal);
  if (!(k > 0) || !(t > 0)) return 1;
  const snapped = Math.round((t / k) * 4) / 4;
  return Math.min(2, Math.max(0.5, snapped)) || 1;
}

function rowKey(seed) {
  return `${seed || "food"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * FitChef dish → builder row with its portion already fitted to the target.
 * Macros / ingredient amounts are for ONE fitted portion; `qty` multiplies them.
 */
function fitchefToMealRow(r, mult) {
  const m = mult || 1;
  const baseQty = num(r?.base_qty) || 1;
  const unit = r?.base_unit || "";
  const baseText = r?.base_text || `${fmtQty(baseQty)} ${unit}`.trim();
  const fittedText = `${fmtQty(baseQty * m)} ${pluralUnit(unit, baseQty * m)}`.trim();
 const hasUnits = (i) =>
  hasNumericValue(i?.units) &&
  Boolean(i?.unit);

const hasGrams = (i) =>
  hasNumericValue(i?.grams);

  return {
    key: rowKey(r?.key || r?.name),
    name: r?.name || "Dish",
    portion: (m === 1 ? baseText : fittedText) || r?.portion || "1 serving",
    baseText,
    // Portion as a number + unit so the builder row can show "1 piece" → "2 pieces" as qty changes.
    portionQty: baseQty * m,
    portionUnit: unit,
    fitted: m !== 1,
    grams: num(r?.grams) * m || null,
    kcal: num(r?.kcal) * m,
    p: num(r?.p) * m,
    c: num(r?.c) * m,
    f: num(r?.f) * m,
    fiber: num(r?.fiber) * m,
    qty: 1,
    source: "fitchef",
    image: r?.thumb || null,
    diet: r?.diet || "",
    gi: Number.isFinite(Number(r?.gi)) ? Number(r.gi) : null,
    offSlot: Boolean(r?.off_slot),
    method: typeof r?.method === "string" ? r.method.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [],
    // contains: (Array.isArray(r?.contains) ? r.contains : [])
    //   .filter((i) => i?.name)
    //   .map((i) => ({
    //     name: i.name,
    //     qty: (hasUnits(i) ? num(i.units) : num(i.grams)) * m,
    //     unit: hasUnits(i) ? i.unit : "g",
    //   })),

contains: (Array.isArray(r?.contains) ? r.contains : [])
  .filter((i) => i?.name)
  .map((i) => ({
    name: i.name,

    qty:
      (hasUnits(i)
        ? Number(i.units)
        : hasGrams(i)
          ? Number(i.grams)
          : 0) * m,

    units:
      hasUnits(i)
        ? Number(i.units) * m
        : null,

    unit:
      hasUnits(i)
        ? i.unit
        : hasGrams(i)
          ? "g"
          : "",

    grams:
      hasGrams(i)
        ? Number(i.grams) * m
        : null,
  })),


    fitchefKey: r?.key ?? null,
  };
}

/** Share of calories each macro contributes (Protein/Carbs ×4, Fat ×9). */
function macroShares(p, c, f) {
  const kp = num(p) * 4;
  const kc = num(c) * 4;
  const kf = num(f) * 9;
  const tot = kp + kc + kf;
  if (!(tot > 0)) return { kcal: 0, p: 0, c: 0, f: 0 };
  return { kcal: tot, p: Math.round((kp / tot) * 100), c: Math.round((kc / tot) * 100), f: Math.round((kf / tot) * 100) };
}

/**
 * Build a meal from the FitChef dish bank:
 *   - the list opens with every dish (in-slot ones first), portions fitted to
 *     the meal being replaced; typing narrows it
 *   - "+" adds a dish as a row; the chart at the top shows the target until
 *     something is added, then follows what is being built
 *   - nothing matches → AI lookup, then manual macros as the last resort
 */
function MakeMealDialog({ state, totals, target, slot, defaultDiet = "", onChange, onClose, onSave }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]);
  const [meta, setMeta] = useState({ count: 0, bank: 0, inSlot: 0, page: 0, pages: 0 });
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [manual, setManual] = useState(null); // null | { ...EMPTY_MANUAL }
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const trimmed = query.trim();
  // 1-char queries browse the full bank instead of flashing an empty list.
  const effectiveQuery = trimmed.length >= MEAL_SEARCH_MIN ? trimmed : "";
  const fitchefSlot = FITCHEF_SLOT[slot] || "";
  const slotLabel = SLOT_META[slot]?.label || slot || "meal";
  const hasRows = state.rows.length > 0;
  const targetKcal = target?.kcal || 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function fetchPage(page, append) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setSearchError(null);
    try {
      const data = await searchFitChefFoodsService(effectiveQuery, {
        slot: fitchefSlot,
        diet: defaultDiet,
        page,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const results = Array.isArray(data?.results) ? data.results : [];
      setHits((cur) => (append ? [...cur, ...results] : results));
      setMeta({
        count: num(data?.count),
        bank: num(data?.bank_distinct) || num(data?.bank) || num(data?.count),
        inSlot: num(data?.in_slot),
        page: num(data?.page),
        pages: num(data?.pages),
      });
    } catch (err) {
      if (err?.name === "AbortError" || controller.signal.aborted) return;
      if (!append) setHits([]);
      setSearchError(err?.message || "Could not load the dish bank. Try again.");
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  // Full bank on open; debounced narrowing while typing.
  useEffect(() => {
    const t = setTimeout(() => fetchPage(0, false), effectiveQuery ? 300 : 0);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveQuery, fitchefSlot, defaultDiet]);

  const hasMore = meta.pages > 0 && meta.page + 1 < meta.pages;

  function onListScroll(e) {
    const el = e.currentTarget;
    if (!hasMore || searching) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) fetchPage(meta.page + 1, true);
  }

  // Portions fitted to the meal being replaced — recomputed only when the list or target changes.
  const fitted = useMemo(() => hits.map((r) => fitchefToMealRow(r, fitMultiplier(r?.kcal, targetKcal))), [hits, targetKcal]);
  const firstOffSlot = fitted.findIndex((r) => r.offSlot);

  function addRow(row) {
    onChange({ ...state, rows: [...state.rows, { ...row, key: rowKey(row.fitchefKey || row.name) }] });
    setAiFailed(false);
    setManual(null);
  }

  function setQty(key, qty) {
    const next = Math.min(20, Math.max(0.25, qty));
    onChange({ ...state, rows: state.rows.map((r) => (r.key === key ? { ...r, qty: next } : r)) });
  }

  function removeRow(key) {
    onChange({ ...state, rows: state.rows.filter((r) => r.key !== key) });
  }

  /**
   * "Close the gap for me": shown once something is in the meal and there is a
   * target; opens a ranked list of bank dishes that close what is still missing.
   */
  const [showSuggestions, setShowSuggestions] = useState(false);
  const canCloseGap = Boolean(target) && hasRows;
  // Every macro "just right" and the calories about the same → there is no gap
  // to close, so the suggestions panel stays away (nothing to say there).
  const kcalDiff = target ? totals.kcal - target.kcal : 0;
  const kcalOnTarget = !target || Math.abs(kcalDiff) < 10 || Math.abs(kcalDiff) / Math.max(target.kcal, 1) < 0.02;
  const onTarget =
    canCloseGap &&
    kcalOnTarget &&
    [
      [totals.p, target?.p],
      [totals.c, target?.c],
      [totals.f, target?.f],
    ].every(([v, t]) => !t || gapLabel(v, t)?.up === null);
  useEffect(() => {
    if (onTarget) setShowSuggestions(false);
  }, [onTarget]);
  const suggestions = useMemo(
    () => (showSuggestions && canCloseGap && !onTarget ? gapSuggestions(state.rows, fitted, target) : []),
    [showSuggestions, canCloseGap, onTarget, state.rows, fitted, target],
  );
  function addSuggestion(s) {
    addRow({ ...s.row, qty: s.qty });
  }

  /** "Add a food" the bank does not know: AI works out the macros. */
  async function addViaAi() {
    if (!trimmed || aiLoading) return;
    setAiLoading(true);
    setAiFailed(false);
    try {
      const res = await fetch("/api/food/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: trimmed, country: "usa" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || "lookup failed");
      addRow(toMealRow({ ...data, food_name: data.food_name || trimmed, macro_source: data.macro_source || "ai_lookup" }));
      setQuery("");
    } catch {
      setAiFailed(true);
    } finally {
      setAiLoading(false);
    }
  }

  function addManual() {
    if (!manual?.food_name?.trim()) return;
    addRow(
      toMealRow({
        food_name: manual.food_name.trim(),
        portion_with_metric: manual.portion_with_metric || "1 serving",
        calories: num(manual.calories),
        protein_g: num(manual.protein_g),
        carbs_g: num(manual.carbs_g),
        fat_g: num(manual.fat_g),
        fiber_g: num(manual.fiber_g),
        macro_source: "manual",
      }),
    );
    setQuery("");
  }

  function onKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (fitted.length > 0) addRow(fitted[0]);
    else if (effectiveQuery && !searching) addViaAi();
  }

  const showNoHits = !searching && Boolean(effectiveQuery) && hits.length === 0 && !manual && !searchError;

  // Chart: the target until something is added, then what is being built.
  const shown = hasRows
    ? { kcal: totals.kcal, p: totals.p, c: totals.c, f: totals.f }
    : { kcal: target?.kcal || 0, p: target?.p || 0, c: target?.c || 0, f: target?.f || 0 };
  const shares = macroShares(shown.p, shown.c, shown.f);
  const chartKcal = hasRows ? shown.kcal : shown.kcal || shares.kcal;
  const columns = [
    { label: "Protein", color: MACRO_COLORS.protein, g: shown.p, pct: shares.p, target: target?.p },
    { label: "Fats", color: MACRO_COLORS.fats, g: shown.f, pct: shares.f, target: target?.f },
    { label: "Carbs", color: MACRO_COLORS.carbs, g: shown.c, pct: shares.c, target: target?.c },
  ];

  return (
    <ModalShell
      title="Make my meal"
      subtitle={state.replacingName ? `replacing ${state.replacingName}` : `adding to ${slotLabel.toLowerCase()}`}
      onClose={onClose}
      widthClass="max-w-[780px]"
      tall
    >
      {/* Everything above the Save button scrolls as one body, so an open
          suggestions panel or a long meal never pushes the add-food box, the
          dish bank or the Save button out of the modal. The dish bank's
          infinite scroll listens on this body. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" onScroll={onListScroll}>
      {/* ------------------------------------------------ name */}
      <div className="flex-none px-5 pt-4">
        <input
          value={state.name}
          onChange={(e) => onChange({ ...state, name: e.target.value })}
          placeholder="Named from what you add — or type your own"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-[15px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* ------------------------------------------------ target / build chart */}
      <div className="flex-none border-b border-neutral-100 px-5 pb-3 pt-4">
        <div className="flex items-center gap-5">
          <BuilderDonut p={shown.p} c={shown.c} f={shown.f} kcal={chartKcal} />
          <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-4">
            {columns.map((col) => {
              const delta = hasRows && col.target ? gapLabel(col.g, col.target) : null;
              return (
                <div key={col.label} className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[12.5px] text-neutral-600">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.color }} />
                    {col.label}
                  </div>
                  <div className="mt-0.5 text-lg font-bold leading-tight tabular-nums text-neutral-900">{Math.round(col.g)}g</div>
                  <div className="text-xs text-neutral-400">{col.pct}% of calories</div>
                  {!hasRows && target ? (
                    <div className="text-xs font-semibold text-neutral-300">to match</div>
                  ) : delta ? (
                    <div className={cn("text-xs font-semibold", delta.cls)}>{delta.text}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {canCloseGap && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  if (onTarget) return; // nothing to close
                  setShowSuggestions((v) => !v);
                }}
                title={
                  onTarget
                    ? "This meal already matches — nothing to close."
                    : showSuggestions
                      ? "Hide the suggestions"
                      : "Dishes from the bank that close what this meal is still missing."
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  showSuggestions ? "bg-neutral-500 text-white hover:bg-neutral-600" : "bg-neutral-900 text-white hover:bg-neutral-800",
                )}
              >
                {showSuggestions ? "✕ Hide suggestions" : "✨ Close the gap for me"}
              </button>
              {showSuggestions && !onTarget && (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      {suggestions.length > 0 ? `${suggestions.length} way${suggestions.length === 1 ? "" : "s"} to close it` : "Nothing closes it"}
                    </span>
                    <button type="button" onClick={() => setShowSuggestions(false)} className="text-neutral-400 hover:text-neutral-700" title="Hide">
                      ✕
                    </button>
                  </div>
                  {suggestions.length === 0 ? (
                    <div className="mt-2 text-sm text-neutral-500">Nothing in the pool closes this gap on its own.</div>
                  ) : (
                    <div className="mt-2 max-h-[400px] space-y-2 overflow-y-auto pr-1">
                      {suggestions.map((s) => (
                        <div key={s.row.key} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                          <ScoreRing score={s.score} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-semibold text-neutral-900">{s.row.name}</div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                              {s.portionText} · {Math.round(s.kcal)} kcal ·{" "}
                              <span className="font-semibold" style={{ color: MACRO_COLORS.protein }}>+{fmt1(s.p)}P</span>{" "}
                              <span className="font-semibold" style={{ color: MACRO_COLORS.fats }}>+{fmt1(s.f)}F</span>{" "}
                              <span className="font-semibold" style={{ color: MACRO_COLORS.carbs }}>+{fmt1(s.c)}C</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addSuggestion(s)}
                            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        <div className="mt-2 text-right text-xs text-neutral-400">
          {(() => {
            const slotName = slotLabel.toLowerCase();
            const isGap = state.targetKind === "gap";
            if (!hasRows) {
              if (!target) return "Nothing to replace — add foods and the chart follows what you build.";
              return isGap
                ? `The day still needs ${Math.round(target.kcal)} kcal — add foods and the chart follows what you build.`
                : `This is the ${slotName} you are replacing — add foods and the chart follows what you build.`;
            }
            const now = Math.round(totals.kcal);
            if (!target) {
              return (
                <>
                  This one is <b className="text-neutral-700">{now} kcal</b>.
                </>
              );
            }
            const was = Math.round(target.kcal);
            const diff = now - was;
            const same = Math.abs(diff) < 10 || Math.abs(diff) / Math.max(was, 1) < 0.02;
            return (
              <>
                {isGap ? "The day still needs " : `The ${slotName} you are replacing was `}
                <b className="text-neutral-700">{was} kcal</b>. This one is <b className="text-neutral-700">{now}</b> —{" "}
                {same ? (
                  <span className="font-semibold text-emerald-600">about the same.</span>
                ) : (
                  <span className={cn("font-semibold", diff > 0 ? "text-amber-600" : "text-blue-600")}>
                    {Math.abs(diff)} kcal {diff > 0 ? "too much" : "short"}.
                  </span>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* ------------------------------------------------ what is in the meal */}
      <div className="flex-none border-b border-neutral-100 px-5 py-3">
        {!hasRows ? (
          <div className="text-sm text-neutral-400">Nothing added yet.</div>
        ) : (
          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {state.rows.map((r) => {
              // "1 piece" → "2 pieces" as qty changes; non-bank rows show "1½ × 1 cup".
              const portionText = r.portionQty
                ? `${fmtQty(r.portionQty * r.qty)} ${pluralUnit(r.portionUnit, r.portionQty * r.qty)}`.trim()
                : r.qty === 1
                  ? r.portion
                  : `${fmtQty(r.qty)} × ${r.portion}`;
              const contains = Array.isArray(r.contains) ? r.contains.filter((i) => i?.name) : [];
              const atMin = r.qty - 0.25 < 0.25;
              return (
                <div key={r.key} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-neutral-900">{r.name}</div>
                    <div className="mt-0.5 text-xs text-neutral-400" title={`${Math.round(r.kcal * r.qty)} kcal · P${Math.round(r.p * r.qty)} C${Math.round(r.c * r.qty)} F${Math.round(r.f * r.qty)}`}>
                      {portionText}
                    </div>
                    {contains.length > 0 && (
                      <div className="mt-0.5 truncate text-xs font-semibold text-neutral-400">
                        {contains.map((i) => `${fmtQty(num(i.qty) * r.qty)} ${pluralUnit(i.unit, num(i.qty) * r.qty)} ${i.name}`.replace(/\s+/g, " ").trim()).join(", ")}
                      </div>
                    )}
                  </div>
                  <StepBtn label="−" title={atMin ? "Remove" : "Less"} onClick={() => (atMin ? removeRow(r.key) : setQty(r.key, r.qty - 0.25))} />
                  <StepBtn label="+" title="More" disabled={r.qty + 0.25 > 20} onClick={() => setQty(r.key, r.qty + 0.25)} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------ add a food */}
      <div className="flex-none px-5 pt-4 pb-3">
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAiFailed(false);
              setManual(null);
            }}
            onKeyDown={onKeyDown}
            placeholder="Add a food — chicken, rice, oats…"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-[15px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {searching && <span className="absolute right-3 top-3 text-xs text-neutral-400">Searching…</span>}
        </div>

        {searchError && <div className="mt-2 text-xs text-red-600">{searchError}</div>}

        {/* nothing in the bank → AI add, then manual as last resort */}
        {showNoHits && (
          <div className="mt-2 rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-center">
            <div className="text-xs text-neutral-500">Not in the dish bank.</div>
            <button
              onClick={addViaAi}
              disabled={aiLoading}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {aiLoading ? "AI is calculating macros…" : `Add "${trimmed}" — AI will calculate macros`}
            </button>
            {aiFailed && (
              <div className="mt-2 text-xs">
                <span className="text-red-600">AI lookup failed for this food. </span>
                <button onClick={() => setManual({ ...EMPTY_MANUAL, food_name: trimmed })} className="font-semibold text-blue-600 hover:underline">
                  Enter macros manually
                </button>
              </div>
            )}
          </div>
        )}

        {manual && (
          <div className="mt-2 rounded-lg border border-neutral-200 p-3">
            <div className="mb-2 text-xs font-semibold text-neutral-700">Manual entry — values for one portion</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={manual.food_name}
                onChange={(e) => setManual({ ...manual, food_name: e.target.value })}
                placeholder="Food name"
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              />
              <input
                value={manual.portion_with_metric}
                onChange={(e) => setManual({ ...manual, portion_with_metric: e.target.value })}
                placeholder="Portion — e.g. 1 cup (240 g)"
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {[
                ["calories", "kcal"],
                ["protein_g", "Protein"],
                ["carbs_g", "Carbs"],
                ["fat_g", "Fat"],
                ["fiber_g", "Fiber"],
              ].map(([k, label]) => (
                <label key={k} className="text-[10px] font-semibold uppercase text-neutral-400">
                  {label}
                  <input
                    type="number"
                    step="any"
                    value={manual[k]}
                    onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm tabular-nums text-neutral-900"
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setManual(null)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={addManual}
                disabled={!manual.food_name.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Add to meal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ dish bank */}
      <div className="flex-none border-y border-neutral-100 bg-neutral-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {meta.count > 0
          ? `${meta.count} of ${meta.bank || meta.count} foods${meta.inSlot > 0 ? ` · ${meta.inSlot} for ${slotLabel}, rest below` : ""}`
          : searching
            ? "Loading the dish bank…"
            : "Dish bank"}
      </div>
      <div className="flex-none">
        {fitted.map((row, i) => (
          <div key={`${row.fitchefKey || row.name}-${i}`}>
            {i === firstOffSlot && i > 0 && (
              <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Usually served at other meals
              </div>
            )}
            <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                {row.image ? <img src={row.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-snug text-neutral-900">{row.name}</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {row.fitted ? (
                    <>
                      {row.baseText} → <b className="font-semibold text-neutral-700">{row.portion}</b> here
                    </>
                  ) : (
                    row.portion
                  )}
                  {" · "}
                  <b className="font-semibold text-neutral-700">{fmt1(row.p)}</b>P <b className="font-semibold text-neutral-700">{fmt1(row.c)}</b>C{" "}
                  <b className="font-semibold text-neutral-700">{fmt1(row.f)}</b>F · {Math.round(row.kcal)} kcal
                  {row.gi !== null ? ` · GI ${row.gi}` : ""}
                  {row.diet ? ` · ${row.diet}` : ""}
                </div>
                {row.contains.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.contains.map((ing, j) => (
                      <span key={j} className="rounded-md bg-neutral-100 px-1.5 py-[2px] text-[11px] text-neutral-600">
                        {fmtQty(ing.qty)} {ing.unit} {ing.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => addRow(row)}
                title="Add to this meal"
                className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-lg leading-none text-neutral-400 hover:bg-blue-50 hover:text-blue-600"
              >
                +
              </button>
            </div>
          </div>
        ))}
        {!searching && fitted.length === 0 && !showNoHits && !searchError && (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">No dishes to show.</div>
        )}
        {searching && fitted.length > 0 && <div className="px-5 py-3 text-center text-xs text-neutral-400">Loading more…</div>}
        {!searching && hasMore && (
          <div className="px-5 py-3 text-center">
            <button onClick={() => fetchPage(meta.page + 1, true)} className="text-xs font-semibold text-blue-600 hover:underline">
              Load more
            </button>
          </div>
        )}
      </div>

      </div>

      {/* ------------------------------------------------ save */}
      <div className="flex-none border-t border-neutral-100 px-5 py-3">
        <button
          onClick={onSave}
          disabled={!hasRows}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Save into the plan
        </button>
      </div>
    </ModalShell>
  );
}

/** 0–100 "how much of the gap this closes" ring for a suggestion: green ≥ 90, blue ≥ 75, amber below. */
function ScoreRing({ score }) {
  const s = Math.max(0, Math.min(100, num(score)));
  const color = s >= 90 ? "#059669" : s >= 75 ? "#2563eb" : "#d97706";
  const R = 15;
  const CIRC = 2 * Math.PI * R;
  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={R} fill="transparent" stroke="#e5e7eb" strokeWidth="3" />
        <circle cx="20" cy="20" r={R} fill="transparent" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(s / 100) * CIRC} ${CIRC}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums" style={{ color }}>
        {Math.round(s)}
      </span>
    </div>
  );
}

/** Donut with the calories in the middle — same segment math as MacrosPanel, Protein → Fats → Carbs. */
function BuilderDonut({ p, c, f, kcal }) {
  const kcalP = num(p) * 4;
  const kcalC = num(c) * 4;
  const kcalF = num(f) * 9;
  const total = kcalP + kcalC + kcalF || 1;
  const pct = (v) => (v / total) * 100;
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const GAP = 4;
  const arcs = [
    { pct: pct(kcalP), color: MACRO_COLORS.protein },
    { pct: pct(kcalF), color: MACRO_COLORS.fats },
    { pct: pct(kcalC), color: MACRO_COLORS.carbs },
  ];
  let offset = 0;
  const segs = arcs.map((a, i) => {
    const len = Math.max(0, (a.pct / 100) * CIRC - (a.pct > 0 ? GAP : 0));
    const seg = { ...a, key: i, dash: `${len} ${CIRC - len}`, dashOffset: -offset };
    offset += (a.pct / 100) * CIRC;
    return seg;
  });

  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
        <circle cx="42" cy="42" r={R} fill="transparent" stroke="#eceef1" strokeWidth="8" />
        {segs.map((s) => (
          <circle key={s.key} cx="42" cy="42" r={R} fill="transparent" stroke={s.color} strokeWidth="8" strokeDasharray={s.dash} strokeDashoffset={s.dashOffset} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[9px] font-medium text-neutral-400">Calories</span>
        <span className="mt-0.5 text-[19px] font-bold tabular-nums text-neutral-900">{Math.round(num(kcal))}</span>
        <span className="mt-0.5 text-[9px] font-medium text-neutral-400">Kcal</span>
      </div>
    </div>
  );
}

/* ============================================================ ShoppingListDialog */

function money(n) {
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : null;
}

/** "$2.97*" for approximate shelf prices, "$2.97" for firm ones, "—" when unpriced. */
function PriceTag({ price, approx, note, className }) {
  const text = money(price);
  if (text === null) {
    return <span className={cn("text-neutral-300", className)} title="Could not be priced">—</span>;
  }
  return (
    <span className={cn("tabular-nums text-neutral-700", className)} title={note || undefined}>
      {text}
      {approx ? <span className="text-neutral-400">*</span> : null}
    </span>
  );
}

/**
 * Shopping list.
 *   `shopping`      — server-generated, priced list from food_json.shopping (aisles + by-day).
 *   `fallbackItems` — locally aggregated ingredients; used only when the API block is absent.
 *   `dirty`         — the server list reflects the *saved* plan, so warn while edits are unsaved.
 */
/** Aisle name → icon for the section header. Matched on keywords, so "Meat & Fish" and "Meat" both work. */
const AISLE_ICONS = [
  [/produce|fruit|veg/i, "🥕"],
  [/dairy|egg|cheese/i, "🧀"],
  [/meat|fish|seafood|poultry|protein/i, "🥩"],
  [/bakery|bread|grain|cereal/i, "🍞"],
  [/frozen/i, "🧊"],
  [/spice|herb|season/i, "🧂"],
  [/drink|beverage|juice/i, "🥤"],
  [/pantry|dry|canned|tin|oil|sauce|condiment/i, "🥫"],
  [/snack|nut|seed/i, "🥜"],
];
function aisleIcon(name) {
  const hit = AISLE_ICONS.find(([re]) => re.test(String(name || "")));
  return hit ? hit[1] : "🛒";
}

/** Plain-text version of the list for the clipboard and the print window. */
function shoppingListText({ week, days = [], subtitle }) {
  const lines = [`Shopping list — ${subtitle}`, ""];
  const priceOf = (it) => (Number.isFinite(it.price) ? `  ${money(it.price)}${it.approx ? "*" : ""}` : "");
  if (days.length > 0) {
    days.forEach((day, i) => {
      if (i > 0) lines.push("", "");
      lines.push(`DAY ${day.day}`);
      day.meals.forEach((m) => {
        lines.push("", `${(SLOT_META[m.slot]?.label || m.slot || "Meal").toUpperCase()} — ${m.title}`);
        m.items.forEach((it) => lines.push(`- ${it.text ? `${it.text}  ` : ""}${it.name}${priceOf(it)}`));
      });
      const dayTotal = day.meals.reduce((sum, m) => sum + (m.price ?? 0), 0);
      if (dayTotal > 0) lines.push("", `Day ${day.day} total: ${money(dayTotal)}*`);
    });
  } else {
    (week?.aisles || []).forEach((a) => {
      lines.push(`${a.aisle.toUpperCase()} (${a.items.length})`);
      a.items.forEach((it) => lines.push(`- ${it.text ? `${it.text}  ` : ""}${it.name}${priceOf(it)}`));
      lines.push("");
    });
    if (week?.total !== null && week?.total !== undefined) lines.push(`Estimated total: ${money(week.total)}*`);
  }
  if (week?.disclaimer) lines.push("", week.disclaimer);
  return lines.join("\n");
}

/** Opens the plain-text list in its own window and prints it, leaving the app page alone. */
function printShoppingList(text) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return false;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  w.document.write(
    `<!doctype html><title>Shopping list</title><body style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;padding:24px;white-space:pre-wrap">${esc(text)}</body>`,
  );
  w.document.close();
  w.focus();
  w.print();
  return true;
}

/** One meal inside the "By day" shopping view: slot, dish, its lines, and a collapsible method. */
function ShoppingMeal({ meal: m }) {
  const [open, setOpen] = useState(false);
  const steps = m.steps || [];
  return (
    <section className="border-t border-neutral-100">
      <div className="flex items-baseline gap-2 px-4 pt-2.5 pb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{SLOT_META[m.slot]?.label || m.slot}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-400">{m.title}</span>
        {m.minutes ? <span className="shrink-0 text-xs text-neutral-400">{m.minutes} min</span> : null}
      </div>
      <ul className="divide-y divide-neutral-50">
        {m.items.map((it, i) => (
          <li key={`${i}-${it.name}`} className="flex items-center gap-4 px-4 py-2.5 text-sm">
            <span className="w-[150px] shrink-0 font-semibold tabular-nums text-neutral-900">{it.text}</span>
            <span className="min-w-0 flex-1 truncate text-neutral-800">{it.name}</span>
            <PriceTag price={it.price} approx={it.approx} note={it.priceNote} className="shrink-0 text-sm" />
          </li>
        ))}
      </ul>
      {steps.length > 0 && (
        <div className="px-4 pb-3 pt-1">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-blue-600 hover:text-blue-500">
            {open ? "▾" : "▸"} Method · {steps.length} step{steps.length === 1 ? "" : "s"}
          </button>
          {open && (
            <div className="mt-2 rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
              <ol className="list-decimal pl-[18px] text-sm text-neutral-700">
                {steps.map((s, i) => (
                  <li key={i} className="mb-1">
                    {s}
                  </li>
                ))}
              </ol>
              {m.tip && <div className="mt-2 rounded-md border-l-2 border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">{m.tip}</div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ShoppingListDialog({ shopping, fallbackItems = [], dirty = false, pricing = false, onClose }) {
  const hasApiList = Boolean(shopping);
  const hasByDay = Boolean(shopping?.byDay?.length);
  const [view, setView] = useState("week"); // "week" | "day"
  const [dayNo, setDayNo] = useState(() => shopping?.byDay?.[0]?.day ?? 1);
  const [copied, setCopied] = useState(false);
  const week = shopping?.week;
  const selectedDay = hasByDay ? shopping.byDay.find((d) => d.day === dayNo) || shopping.byDay[0] : null;
  const dayTotal = selectedDay ? selectedDay.meals.reduce((sum, m) => sum + (m.price ?? 0), 0) : 0;

  function listText() {
    if (!hasApiList) {
      return ["Shopping list — aggregated across the whole plan", "", ...fallbackItems.map((it) => `- ${it.qty} ${it.unit}  ${it.name}`)].join("\n");
    }
    // "By day" copies/prints every day in the plan, not just the one currently selected.
    return shoppingListText({ week, days: view === "day" ? shopping.byDay : [], subtitle });
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(listText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const subtitle = hasApiList
    ? `${week.itemCount} item${week.itemCount === 1 ? "" : "s"}${week.days ? ` · ${week.days} days` : ""}`
    : "Aggregated across the whole plan";

  return (
    <ModalShell title="Shopping list" subtitle={subtitle} onClose={onClose} widthClass="max-w-[600px]">
      {hasApiList && (
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <button
            type="button"
            onClick={() => setView("week")}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
              view === "week" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
            )}
          >
            By aisle
          </button>
          {hasByDay && (
            <button
              type="button"
              onClick={() => setView("day")}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
                view === "day" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              By day
            </button>
          )}
          {pricing && (
            <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200" title="Fetching shelf prices for the plan as it is on screen.">
              Pricing…
            </span>
          )}
          {!pricing && dirty && (
            <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200" title="This list is generated from the saved plan. Save to refresh it.">
              Reflects saved plan
            </span>
          )}
        </div>
      )}

      <div className="max-h-[440px] overflow-y-auto">
        {/* ---------------------------------------------- local fallback */}
        {!hasApiList && (
          <ul className="divide-y divide-neutral-100 px-5">
            {fallbackItems.length === 0 && <li className="py-8 text-center text-sm text-neutral-400">No ingredients yet.</li>}
            {fallbackItems.map((it, i) => (
              <li key={`${i}-${it.name}-${it.unit}`} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-neutral-900">{it.name}</span>
                <span className="font-mono tabular-nums text-neutral-500">
                  {it.qty} {it.unit}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* ------------------------------------------------- week / aisles */}
        {hasApiList && view === "week" && (
          <div className="px-5 pb-4 pt-2">
            <div className="flex items-center justify-between rounded-xl bg-neutral-900 px-5 py-4 text-white">
              <span className="text-sm font-medium">Estimated total</span>
              <span className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">
                  {week.total !== null ? money(week.total) : "—"}
                  {week.total !== null && <span className="text-neutral-400">*</span>}
                </span>
                {week.unpriced > 0 && (
                  <span className="text-xs text-neutral-400">
                    {week.total === null ? "not priced yet" : `${week.unpriced} item${week.unpriced === 1 ? "" : "s"} not priced`}
                  </span>
                )}
              </span>
            </div>

            <div className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-100">
              {week.aisles.map((a) => (
                <section key={a.aisle}>
                  <div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
                    <span className="text-base leading-none">{aisleIcon(a.aisle)}</span>
                    <span className="text-sm font-bold text-neutral-900">{a.aisle}</span>
                    <span className="ml-auto rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-500">{a.items.length}</span>
                  </div>
                  <ul className="divide-y divide-neutral-50">
                    {a.items.map((it, i) => {
                      const hint = [it.days.length > 0 ? `Days ${it.days.join(", ")}` : null, it.meals ? `${it.meals} meal${it.meals === 1 ? "" : "s"}` : null]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={`${i}-${it.name}`} className="flex items-center gap-4 px-4 py-2.5 text-sm" title={hint || undefined}>
                          <span className="w-[150px] shrink-0 font-semibold tabular-nums text-neutral-900">{it.text}</span>
                          <span className="min-w-0 flex-1 truncate text-neutral-800">{it.name}</span>
                          <PriceTag price={it.price} approx={it.approx} note={it.priceNote} className="shrink-0 text-sm" />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------ by day */}
        {hasApiList && view === "day" && selectedDay && (
          <div className="px-5 pb-4 pt-2">
            {/* segmented day picker */}
            <div className="flex rounded-xl bg-neutral-100 p-1">
              {shopping.byDay.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setDayNo(d.day)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-[13px] font-semibold transition-colors",
                    d.day === selectedDay.day ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  D{d.day}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-neutral-100">
              <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                <span className="text-base leading-none">📅</span>
                <span className="text-sm font-bold text-neutral-900">Day {selectedDay.day}</span>
                <span className="ml-auto rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-500" title={dayTotal > 0 ? `Day total ${money(dayTotal)}*` : undefined}>
                  {selectedDay.meals.reduce((n, m) => n + m.items.length, 0)}
                </span>
              </div>
              {selectedDay.meals.map((m, mi) => (
                <ShoppingMeal key={`${m.slot}-${mi}`} meal={m} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-neutral-100 px-5 py-3.5">
        {hasApiList && (week.priced > 0 && week.unpriced ? true : Boolean(week.disclaimer)) && (
          <p className="mb-3 text-[11px] leading-snug text-neutral-400">
            {week.priced > 0 && week.unpriced ? `${week.priced} priced, ${week.unpriced} unpriced. ` : ""}
            {week.disclaimer}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={copyList}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            {copied ? "Copied" : "Copy as text"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!printShoppingList(listText())) copyList();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Print
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================ ModalShell */

function ModalShell({ title, subtitle, onClose, widthClass, tall = false, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" onClick={onClose}>
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
          tall ? "h-[92vh] max-h-[92vh]" : "max-h-[92vh]",
          widthClass,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none items-start gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-neutral-900">{title}</div>
            {subtitle && <div className="mt-0.5 text-[12.5px] text-neutral-400">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="shrink-0 px-1 text-2xl leading-none text-neutral-400 hover:text-neutral-900">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}






