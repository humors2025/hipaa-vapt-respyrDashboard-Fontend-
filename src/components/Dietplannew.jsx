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
  // NEWTEST_FIXED_PAYLOAD, // old TEMP sample-week fallback, now null
  approveWeeklyFoodJsonNewTestService,
  saveCustomMealService,
  fetchDietAnalysisPlanNewTest,
  fetchFoodLogService,
  fetchMacroSummaryByDate,
  getClientProfileDetails,
  priceShoppingListService,
  resetWeeklyFoodJsonNewTestService,
  searchFitChefFoodsService,
  updateDietPlanFoodNewTestService,
} from "@/services/authService";
import { selectDietAnalysisRequestedWeek } from "@/store/dietAnalysisSlice";
import { selectMacroSummaryData } from "@/store/macroSummarySlice";

/* ============================================================ constants */

const SLOTS = ["breakfast", "lunch", "snacks", "dinner"];

/**
 * Name a deleted dish is saved under. Delete does not drop the row: it turns
 * it into this empty placeholder (zero macros, no recipe) which Save persists
 * as an ordinary "update", so the slot survives reload exactly as the older
 * plan screen showed it. The placeholder's own Delete button is disabled; the
 * slot can only be refilled via "Search a swap" / "Make my meal".
 */
const REMOVED_PLACEHOLDER_NAME = "(empty — removed)";
function isRemovedPlaceholder(f) {
  return !!f && String(f.name || "").trim().toLowerCase() === REMOVED_PLACEHOLDER_NAME;
}
const SLOT_META = {
  breakfast: { label: "Breakfast", time: "08:00 – 09:00 AM" },
  lunch: { label: "Lunch", time: "01:00 – 02:00 PM" },
  snacks: { label: "Snacks", time: "04:30 – 05:00 PM" },
  dinner: { label: "Dinner", time: "08:00 – 09:00 PM" },
};

// Same palette as MacrosUpdate / DietPlan (Carbs, Fats, Protein, Fibre).
const MACRO_COLORS = { protein: "#E76F51", fats: "#3A86FF", carbs: "#F4A261", fibre: "#2A9D8F" };

/* Shared UI tokens (mirrors macros-update.jsx / diet-plan.jsx) */
const UI = {
  title: "text-[#252525] text-[15px] xl:text-[17px] 2xl:text-[18px] font-semibold leading-normal tracking-[-0.3px]",
  subtitle: "text-[#738298] text-[12px] xl:text-[13px] 2xl:text-[14px] font-medium leading-normal tracking-[-0.24px]",
  sectionLabel: "text-[#738298] text-[12px] font-semibold uppercase",
  body: "text-[12px] xl:text-[13px] 2xl:text-[14px] leading-normal tracking-[-0.24px]",
  small: "text-[10px] xl:text-[11px] 2xl:text-[12px] leading-normal tracking-[-0.2px]",
  foodName: "text-[#252525] text-[12px] xl:text-[14px] 2xl:text-[15px] font-semibold leading-[126%] tracking-[-0.24px]",
  btnPrimary:
    "px-4 py-2 rounded-[8px] bg-[#308BF9] text-white text-[12px] xl:text-[13px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer hover:bg-[#2678D9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnSecondary:
    "px-4 py-2 rounded-[8px] border border-[#E1E6ED] bg-white text-[#535359] text-[12px] xl:text-[13px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer hover:bg-[#F5F7FA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnDanger:
    "px-4 py-2 rounded-[8px] border border-[#E76F51] bg-white text-[#E76F51] text-[12px] xl:text-[13px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer hover:bg-[#E76F511A] disabled:opacity-50 disabled:cursor-not-allowed disabled:border-[#E1E6ED] disabled:text-[#A1A1A1] disabled:hover:bg-white transition-colors",
  input:
    "w-full rounded-[8px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[#252525] text-[12px] xl:text-[13px] 2xl:text-[14px] leading-normal tracking-[-0.24px] outline-none placeholder:text-[#A1A1A1] focus:border-[#308BF9] focus:ring-2 focus:ring-[#EEF4FE]",
  chip: "px-2.5 py-[5px] rounded-[5px] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]",
};

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

/**
 * Total grams of one builder row on the plate: its fitted portion × qty, from
 * the row's own grams or, failing that, the sum of its ingredient grams.
 * Used for the FitChef custom_meal payload ({ key, grams }).
 */
function mealRowGrams(r) {
  const qty = num(r?.qty) || 1;
  const own = num(r?.grams);
  if (own > 0) return own * qty;
  const parts = (Array.isArray(r?.contains) ? r.contains : []).reduce((s, i) => s + num(i?.grams), 0);
  return parts * qty;
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

/**
 * Method for a Make-my-meal dish built from `rows`. One dish keeps its own
 * method. Several dishes get every dish's own steps, each prefixed with the
 * dish name so the card reads "Scrambled Eggs: Whisk…", then "Spinach Salad:
 * Toss…". Dishes without a method fall back to the generated basic steps.
 */
function combinedMethodSteps(rows, mealName) {
  const list = (rows || []).filter((r) => r && r.name);
  if (list.length === 0) return [];
  const noPlating = (arr) => arr.filter((s) => !/^Plate everything together/i.test(s));
  if (list.length === 1) return list[0].method?.length ? list[0].method : noPlating(suggestMethodSteps(list, mealName));

  const steps = [];
  for (const r of list) {
    let own = (Array.isArray(r.method) ? r.method : []).map((s) => String(s || "").trim()).filter(Boolean);
    // A dish with no method of its own still gets a section: basic steps for
    // just that dish, minus the plating line that is added once at the end.
    if (own.length === 0) own = suggestMethodSteps([r], "").filter((s) => !/^Plate everything together/i.test(s));
    for (const s of own) steps.push(`${r.name}: ${s}`);
  }
  return steps;
}

/**
 * Splits a stored method into per-dish sections when it was built by
 * combinedMethodSteps(): "[Dish name]: step". Returns [{ name, steps }] with
 * the un-prefixed closing line(s) in a final nameless section, or null when
 * the steps are an ordinary single recipe (fewer than two dish prefixes).
 */
function groupMethodSteps(steps) {
  const list = (Array.isArray(steps) ? steps : []).map((s) => String(s || "").trim()).filter(Boolean);
  if (list.length < 2) return null;
  const groups = [];
  const names = new Set();
  for (const s of list) {
    const m = s.match(/^([^:]{2,80}?):\s+(\S.*)$/);
    const name = m ? m[1].trim() : "";
    const text = m ? m[2].trim() : s;
    if (name) names.add(name.toLowerCase());
    const last = groups[groups.length - 1];
    if (last && last.name.toLowerCase() === name.toLowerCase()) last.steps.push(text);
    else groups.push({ name, steps: [text] });
  }
  if (names.size < 2) return null;
  // Only a combined method has every step prefixed, apart from the closing line(s).
  const unnamed = groups.filter((g) => !g.name);
  if (unnamed.length > 1 || (unnamed.length === 1 && groups[groups.length - 1].name)) return null;
  // Meals saved earlier ended with a generic plating line; it is not shown any more.
  return groups.filter((g) => g.name || g.steps.some((s) => !/^Plate everything together/i.test(s)));
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

/**
 * FitChef / API diet tag ("nonveg", "non_veg", "veg", "vegan", "Non-Veg") →
 * display label ("Non-Veg", "Veg", "Vegan"). Unknown values pass through.
 */
function dietLabel(raw) {
  // Taxonomy entries sometimes arrive as objects ({ name } / { label } / { slug }).
  const v = raw && typeof raw === "object" ? raw.name ?? raw.label ?? raw.slug ?? raw.value ?? "" : raw;
  const s = String(v || "").trim();
  if (!s) return "";
  const k = s.toLowerCase().replace(/[\s_-]/g, "");
  if (k === "nonveg" || k === "nonvegetarian") return "Non-Veg";
  if (k === "vegan") return "Vegan";
  if (k === "veg" || k === "vegetarian") return "Veg";
  return s;
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

    // FitChef has no prep time; estimate one from the method so the card's
    // "10 MIN · NON-VEG · BREAKFAST" line is complete for swapped-in dishes too.
    prep_minutes: estimatePrepMinutes(method),

    diet_type: dietLabel(r?.diet),

    // FitChef meal-type label when the hit carries one; the card falls back to the slot.
    meal_type: dietLabel(r?.meal_type ?? r?.mealType ?? r?.type_of_food?.[0] ?? ""),

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
/**
 * Stored id of a food row, whichever key the API used for it. Returns null for
 * rows that have none (older plans saved before ids were written).
 */
function readFoodId(meal) {
  const raw = meal?.id ?? meal?.food_id ?? meal?.foodId ?? meal?.custom_id ?? meal?.customId ?? null;
  const s = raw === null || raw === undefined ? "" : String(raw).trim();
  return s ? s : null;
}

/**
 * Picture URL out of the custom-meal API reply. The field name is not pinned
 * down yet, so the usual candidates are tried in order (top level, then the
 * nested meal / food / result objects, then the first of an images list).
 */
function pickCustomMealImage(body) {
  if (!body || typeof body !== "object") return null;
  const holders = [body, body.meal, body.food, body.result, body.custom_meal];
  for (const h of holders) {
    if (!h || typeof h !== "object") continue;
    const direct = h.image_url ?? h.imageUrl ?? h.image ?? h.url ?? h.s3_url ?? null;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const list = Array.isArray(h.images) ? h.images : null;
    const first = list?.find((u) => typeof u === "string" && u.trim());
    if (first) return first.trim();
  }
  return null;
}

/** New id for a dish built with Make my meal, same shape the API uses ("custom-" + 10 hex chars). */
function newCustomFoodId() {
  let hex = "";
  try {
    const bytes = new Uint8Array(5);
    (globalThis.crypto || window.crypto).getRandomValues(bytes);
    hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    hex = Math.random().toString(16).slice(2, 12).padEnd(10, "0");
  }
  return `custom-${hex}`;
}

function toFoodItem(meal, id) {
  const n = meal?.nutrition || {};
  const recipe = meal?.recipe || {};
  const prep = Number(recipe.recipe_taxonomy_preparation_time?.[0]);
  const people = Number(recipe.recipe_amount_of_people?.[0]);
  const alternativeItems = Array.isArray(meal?.alternatives)
    ? meal.alternatives.map((alt, i) => toFoodItem(alt, `${id}-alt${i}`))
    : [];
  // Diet ("Veg" / "Non-Veg") from whichever key the row carries it in.
  const dietRaw = [recipe.diet, recipe.diet_type, recipe.recipe_diet, meal?.diet_type, meal?.diet]
    .flatMap((v) => (Array.isArray(v) ? v : v ? String(v).split(",") : []));
  const dietSeen = new Set();
  const dietTags = dietRaw.map(dietLabel).filter((t) => {
    const k = t.toLowerCase();
    if (!t || dietSeen.has(k)) return false;
    dietSeen.add(k);
    return true;
  });
  // Recipe's own meal-type label ("Snack (Evening)"); the card shows it in
  // place of the plain slot name when present.
  const mealTypeRaw = [recipe.type_of_food, recipe.recipe_meal_type, meal?.meal_type, meal?.mealType]
    .flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
    .map(dietLabel)
    .find(Boolean);
  const stored = parseStoredPortion(meal?.portion_with_metric);
  const serv = stored.servings;
  // Stored nutrition is for `serv` servings; the FoodItem keeps per-1-serving values.
  const base = (v) => num(v) / serv;

  return {
    id,
    // Stable id of the row as stored by the API (e.g. "custom-9fe60d7f39" for a
    // dish built with Make my meal). `id` above is only the position-based key
    // used on screen; this one is shown on the card and round-trips on Save.
    foodId: readFoodId(meal),
    name: meal?.name || "Untitled meal",
    icon: "🍽️",
    image: recipe.image || null,
    // Every food's picture for a Make-my-meal dish (the card shows a collage).
    images: Array.isArray(recipe.images) ? recipe.images.map((u) => String(u || "").trim()).filter(Boolean) : [],
    portion: stored.portion || (people > 0 ? `serves ${people}` : "1 serving"),
    prep_minutes: Number.isFinite(prep) && prep > 0 ? prep : null,
    diet_type: dietTags.join(", "),
    meal_type: mealTypeRaw || "",
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
    !isRemovedPlaceholder(item) &&
    !item.recipeId &&
    (item.method_steps || []).length === 0 &&
    (item.ingredients || []).length === 0 &&
    item.diet_type !== "custom"
  );
}

/**
 * Week-level lock derived from the plan row's `status_value`
 * (get_weekly_food_json_suggestions_weeks_newtest):
 *   0 — open, still editable
 *   1 — approved by the dietician
 *   2 — locked by the server (e.g. week already in use / closed)
 * Anything greater than 0 is treated as approved: it disables "Reset week",
 * "Approve week", Delete, swaps, "Search a swap" and "Make my meal". Compared
 * as a number since the API may send the value as a string.
 */
function weekStatus(plan) {
  const v = Number(plan?.meta?.status_value);
  return Number.isFinite(v) ? v : null;
}
function isWeekApproved(plan) {
  const s = weekStatus(plan);
  return s !== null && s > 0;
}
function isWeekLocked(plan) {
  return isWeekApproved(plan);
}
/** Tooltip / toast reason for a locked week, or null when it is open. */
function weekLockReason(plan) {
  const s = weekStatus(plan);
  if (s === 2) return "This week plan is locked";
  if (s !== null && s > 0) return "This week plan is approved";
  return null;
}

/** Live row whose API record carried no diet tag (so the card shows only "5 MIN"). */
function lacksDiet(item) {
  return item && !item.removed && !item.diet_type;
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
        // Bare rows need their whole detail; rows the API stored without a
        // diet tag (empty `recipe.diet`) only need "Veg" / "Non-Veg" back.
        if (lacksRecipeDetail(item) || lacksDiet(item)) targets.push({ dayIdx, slot, id: item.id, name: item.name });
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
    if (!row) continue;
    const d = p.detail;
    // Stored row id: keep what the API returned, else what we remembered.
    if (!row.foodId && d.foodId) row.foodId = d.foodId;
    if (!row.meal_type && d.meal_type) row.meal_type = d.meal_type;
    if (!lacksRecipeDetail(row)) {
      // Row already has its recipe; only the missing diet tag is filled in.
      if (lacksDiet(row) && d.diet_type) row.diet_type = d.diet_type;
      continue;
    }
    row.image = row.image || d.image;
    if (!(row.images || []).length && (d.images || []).length) row.images = d.images;
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
          foodId: item.foodId || null,
          image: item.image || null,
          images: item.images || [],
          prep_minutes: item.prep_minutes ?? null,
          diet_type: item.diet_type || "",
          meal_type: item.meal_type || "",
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
        // Rows that came back bare, or came back without their stored id.
        if (!lacksRecipeDetail(item) && item.foodId) continue;
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
    source.target ||
    source.daily_targets ||
    source.daily_target ||
    source.day_targets ||
    source.macro_targets ||
    source.target_macros ||
    source.macro_goals ||
    source.goals ||
    source.goal ||
    source.final_macro_summary ||
    source.current_data?.final_macro_summary ||
    source.weekly_json_data ||
    source.macro_summary ||
    source.daily_macros ||
    source.meta?.targets ||
    source.summary?.targets ||
    source.profile?.targets ||
    source.user_profile?.targets ||
    source.user?.targets ||
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


function mkRowsPayload(rows) {
  return rows.map((r, i) => {
    const ingredients =
      Array.isArray(r.contains) && r.contains.length > 0
        ? r.contains.map((c) => ({
            name: c.name,
            unit: c.unit || (c.grams != null ? "g" : ""),
            units: round2(num(c.qty) * r.qty),
            ...(c.grams != null ? { grams: round2(num(c.grams) * r.qty) } : {}),
          }))
        : [
            {
              name: r.name,
              unit: "g",
              units: round2(num(r.grams) * r.qty) || 1,
              ...(num(r.grams) > 0 ? { grams: round2(num(r.grams) * r.qty) } : {}),
            },
          ];
    return { day: i + 1, meals: [{ title: r.name, slot: "meal", ingredients }] };
  });
}



function useRowPricing(rows, zip) {
  const [byKey, setByKey] = useState({});
  const [pricing, setPricing] = useState(false);

  useEffect(() => {
    if (!rows.length) { setByKey({}); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setPricing(true);
      try {
        const days = mkRowsPayload(rows);
        const res = await priceShoppingListService(days, { signal: ctrl.signal, zip});

        // How much of this ingredient a given row actually sent — needed to
        // split a combined price proportionally instead of double-counting it.
        const qtyOf = (rowNo, key) => {
          const line = (days[rowNo - 1]?.meals?.[0]?.ingredients || []).find(
            (ing) => normName(ing.name) === key,
          );
          if (!line) return 0;
          return num(line.grams) || num(line.units) || 0;
        };

        const next = {};
        (res?.aisles || []).forEach((a) => {
          (a.items || []).forEach((it) => {
            const key = normName(it?.name);
            const price = Number(it?.price);
            const rowNos = (it.days || []).map(Number).filter(Number.isFinite);
            if (!key || rowNos.length === 0) return;

            const weights = rowNos.map((n) => qtyOf(n, key));
            const totalW = weights.reduce((s, w) => s + w, 0);

            rowNos.forEach((rowNo, idx) => {
              const row = rows[rowNo - 1];
              if (!row) return;
              const share = Number.isFinite(price)
                ? totalW > 0
                  ? round2((price * weights[idx]) / totalW)
                  : round2(price / rowNos.length)
                : null;
              const prev = next[row.key];
              next[row.key] = {
                price: share === null ? (prev?.price ?? null) : round2((prev?.price || 0) + share),
                approx: Boolean(it.approx) || Boolean(prev?.approx),
                note: it.price_note || prev?.note || "",
              };
            });
          });
        });
        if (!ctrl.signal.aborted) setByKey(next);
      } catch (err) {
        if (!ctrl.signal.aborted) console.warn("[MakeMyMeal] pricing failed:", err?.message || err);
      } finally {
        if (!ctrl.signal.aborted) setPricing(false);
      }
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [rows, zip]);

  return { byKey, pricing };
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
 * The FitChef user the plan was generated for, from food_json._request:
 * an explicit `user` / `user_id` field when present, else the `user=` query
 * param of the recorded generator URL. Null when neither exists.
 */
function fitchefUserFromRequest(req) {
  if (!req || typeof req !== "object") return null;
  const direct = req.user || req.user_id || req.userId;
  if (direct) return String(direct);
  const url = String(req.url || "");
  const m = url.match(/[?&]user=([^&]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/**
 * Macro targets the generator was asked for, from food_json._request: either
 * explicit fields on the recorded request (calories / protein / carbs / fat /
 * fiber, with or without a *_target / target_* affix) or the same names as
 * query params of the recorded generator URL. Returns a readTargets()-ready
 * object, or null when the request carries no macro figures at all.
 */
function targetsFromRequest(req) {
  if (!req || typeof req !== "object") return null;
  const bag = {};
  const take = (k, v) => {
    if (v === undefined || v === null || v === "") return;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) bag[k] = n;
  };
  const pick = (obj, keys) => keys.map((k) => obj?.[k]).find((v) => v !== undefined && v !== null && v !== "");

  // Nested request bodies (req.body / req.params / req.query) and flat fields.
  const sources = [req, req.body, req.params, req.query, req.targets, req.macros].filter(
    (s) => s && typeof s === "object"
  );
  for (const s of sources) {
    take("kcal", pick(s, ["kcal", "kcals", "calories", "calories_target", "calorie_target", "target_calories", "energy_kcal"]));
    take("protein_g", pick(s, ["protein_g", "protein", "protein_target", "target_protein"]));
    take("carbs_g", pick(s, ["carbs_g", "carbs", "carbohydrate", "carbs_target", "target_carbs"]));
    take("fat_g", pick(s, ["fat_g", "fat", "fats", "fat_target", "target_fat"]));
    take("fiber_g", pick(s, ["fiber_g", "fibre_g", "fiber", "fibre", "fiber_target", "target_fiber"]));
  }

  // …/generate?name=…&user=…&calories=1669&protein=146&carbs=125&fat=65
  const url = String(req.url || "");
  const qs = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  if (qs) {
    const params = {};
    for (const part of qs.split("&")) {
      const [k, v = ""] = part.split("=");
      if (!k) continue;
      try {
        params[decodeURIComponent(k)] = decodeURIComponent(v);
      } catch {
        params[k] = v;
      }
    }
    if (bag.kcal === undefined) take("kcal", pick(params, ["kcal", "kcals", "calories", "cal", "target_calories"]));
    if (bag.protein_g === undefined) take("protein_g", pick(params, ["protein", "protein_g", "target_protein"]));
    if (bag.carbs_g === undefined) take("carbs_g", pick(params, ["carbs", "carbs_g", "carbohydrate", "target_carbs"]));
    if (bag.fat_g === undefined) take("fat_g", pick(params, ["fat", "fats", "fat_g", "target_fat"]));
    if (bag.fiber_g === undefined) take("fiber_g", pick(params, ["fiber", "fibre", "fiber_g", "target_fiber"]));
  }

  return Object.keys(bag).length > 0 ? { targets: bag } : null;
}


/**
 * The FitChef plan's real on-disk key, from food_json._saved_to
 * ("…/plans/profile405_week1.json" → "profile405_week1"). This is what
 * find() in fitchef_dashboard.py actually indexes plans by — it does an
 * EXACT filename match, and a plan is saved as "<profile>_week<N>.json",
 * not just "<profile>.json". Using the bare profile id (from the
 * generator's user= param) 404s against a plan that has a week suffix.
 */
function fitchefPlanKeyFromSavedTo(savedTo) {
  if (!savedTo || typeof savedTo !== "string") return null;
  const base = savedTo.split(/[\\/]/).pop() || "";
  return base.replace(/\.json$/i, "") || null;
}



/**
 * Compact identity of every meal in a plan — per day, per slot: name, servings
 * and portion of each non-removed food. Two plans with the same signature show
 * the same dishes in the same amounts; macros are left out so server-side
 * rounding never counts as an edit.
 */
function planSignature(days) {
  return (days || [])
    .map((d) =>
      SLOTS.map((slot) =>
        (d?.meals?.[slot] || [])
          .filter((f) => f && !f.removed)
          .map((f) => `${f.name}|${f.servings}|${f.portion}`)
          .join(",")
      ).join(";")
    )
    .join("\n");
}

/**
 * Response of get_weekly_food_json_suggestions_weeks_newtest → PLAN SHAPE.
 * Accepts either the full envelope ({ status, data }) or just `data`.
 */
export function normalizeWeeklyPlan(response) {
  const data = response?.data && response?.data?.food_json !== undefined ? response.data : response;
  const foodJson = data?.food_json || {};
  // Week-level targets: explicit fields on food_json / the row first, then the
  // macro figures the generator was asked for (food_json._request).
  const weekTargets =
    readTargets(foodJson) || readTargets(data) || readTargets(targetsFromRequest(foodJson?._request));

  const buildDays = (fj) => (Array.isArray(fj?.days) ? fj.days : []).map((day, di) => {
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
  const days = buildDays(foodJson);
  // "Edited": the saved plan no longer matches the generator's untouched
  // snapshot (original_food_json, returned by the read endpoint) — a food was
  // added, swapped, deleted or re-portioned and then saved. "Reset week" copies
  // the snapshot back over food_json, so the flag clears on the reload after it.
  const originalJson = data?.original_food_json;
  const differsFromOriginal =
    originalJson && typeof originalJson === "object" && Array.isArray(originalJson.days)
      ? planSignature(days) !== planSignature(buildDays(originalJson))
      : false;
  // trainer-update-weekly-food-json-newtest stamps food_json._trainer_edited_at
  // on every save; reset-weekly-food-json-newtest restores the unstamped
  // snapshot. Covers rows that have no original_food_json to compare against.
  const edited = differsFromOriginal || !!foodJson?._trainer_edited_at;
  return {
    days,
    shopping: normalizeShopping(foodJson.shopping || data?.shopping),
    // meta: {
    //   id: data?.id ?? null,
    //   dietitian_id: data?.dietitian_id ?? null,
    //   profile_id: data?.profile_id ?? null,
    //   week_start_date: data?.week_start_date ?? null,
    //   week_end_date: data?.week_end_date ?? null,
    //   week_range: data?.week_range ?? null,
    //   status_value: data?.status_value ?? null,
    // },


        meta: {
      id: data?.id ?? null,
      dietitian_id: data?.dietitian_id ?? null,
      profile_id: data?.profile_id ?? null,
      week_start_date: data?.week_start_date ?? null,
      week_end_date: data?.week_end_date ?? null,
      week_range: data?.week_range ?? null,
      status_value: data?.status_value ?? null,
      // True when the stored plan differs from its originally generated version
      // (see above). Drives the "Edited" badge together with unsaved `dirty` state.
      edited,
      // The zip the plan was generated/priced against (fitchef_generate.py's
      // &zip=), so live re-pricing (Make My Meal, Shopping List) can match it
      // instead of falling back to the pricer's default region.
      zip: foodJson?._request?.zip || foodJson?.shopping?.week?.zip || null,
      // FitChef identity the plan was generated for: the `user=` param of the
      // generator request (…/generate?name=profile405&user=profile405&…), which
      // is the profile id. custom_meal is posted under this same id.
      
      // fitchefUserId: fitchefUserFromRequest(foodJson?._request) || data?.profile_id || null,

      fitchefUserId:
  fitchefPlanKeyFromSavedTo(foodJson?._saved_to) ||
  fitchefUserFromRequest(foodJson?._request) ||
  data?.profile_id ||
  null,
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
function toApiRecipeDetail(item, slot) {
  const people = String(item.portion || "").match(/serves\s+(\d+)/i)?.[1];
  const mealType = SLOT_META[slot]?.label;
  return {
    // Stored with the row so the card can show it and later edits keep it.
    ...(item.foodId ? { id: item.foodId } : {}),
    name: item.name,
    recipe: {
      image: item.image || "",
      // All food pictures of a Make-my-meal dish, so the collage survives reload.
      ...((item.images || []).length > 1 ? { images: item.images } : {}),
      post_content: stepsToHtml(item.method_steps),
      recipe_tip: stepsToHtml(item.tips),
      diet: item.diet_type && item.diet_type !== "custom" ? [item.diet_type] : [],
      type_of_food: item.meal_type ? [item.meal_type] : mealType ? [mealType] : [],
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
    ...toApiRecipeDetail(item, slot),
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
  if (Math.abs(diff) < 1 || pct < 2) return { text: "on target", cls: "text-[#2A9D8F]", up: null };
  const up = diff > 0;
  return { text: `${Math.abs(Math.round(diff))}g ${up ? "over" : "short"}`, cls: up ? "text-[#F4A261]" : "text-[#308BF9]", up };
}

/**
 * Same threshold as deltaLabel(), worded for the meal builder:
 * "3g more needed" / "7g too much" / "on target".
 */
function gapLabel(value, target) {
  if (!target) return null;
  const diff = value - target;
  const pct = Math.abs(diff / target) * 100;
  if (Math.abs(diff) < 1 || pct < 2) return { text: "just right", cls: "text-[#2A9D8F]", up: null };
  const up = diff > 0;
  return { text: `${Math.abs(Math.round(diff))}g ${up ? "too much" : "more needed"}`, cls: up ? "text-[#F4A261]" : "text-[#308BF9]", up };
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
  // Week picked in client-details (recorded by the dietAnalysis slice). The
  // week_start_date / week_end_date come from get-weekly-tab-list-newtest;
  // profileId is the ?profile_id from the URL.
  const requestedWeek = useSelector(selectDietAnalysisRequestedWeek);
  // Old TEMP fallback to the fixed *_newtest sample week (NEWTEST_FIXED_PAYLOAD
  // is now null in authService):
  // const profileId = requestedWeek?.profileId ?? NEWTEST_FIXED_PAYLOAD?.profile_id ?? null;
  // const weekStart = requestedWeek?.weekStartDate ?? NEWTEST_FIXED_PAYLOAD?.week_start_date ?? null;
  // const weekEnd = requestedWeek?.weekEndDate ?? NEWTEST_FIXED_PAYLOAD?.week_end_date ?? null;
  const profileId = requestedWeek?.profileId ?? null;
  const weekStart = requestedWeek?.weekStartDate ?? null;
  const weekEnd = requestedWeek?.weekEndDate ?? null;

  const [plan, setPlan] = useState(() => planProp || null);
  const [original, setOriginal] = useState(() => (planProp ? structuredClone(planProp) : null));
  const [loading, setLoading] = useState(!planProp);
  const [loadError, setLoadError] = useState(null); // { message, noData: boolean }
  const [reloadKey, setReloadKey] = useState(0);
  // Recipe detail the server does not persist, remembered across Save → reload.
  const detailCacheRef = useRef(new Map());
  const [saving, setSaving] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false); // "Measurements" unit reference
  const [foodLogOpen, setFoodLogOpen] = useState(false); // "Food log" popup (what the client actually logged)

  const [dayIdx, setDayIdx] = useState(0);
  const [mealIdx, setMealIdx] = useState(0);
  // Mirrors of dayIdx / mealIdx for the load effect, which must not re-run on
  // every day click. Which week the grid currently shows, so a reload of the
  // same week (after Save / Reset / Retry) keeps the trainer on their day.
  const dayIdxRef = useRef(0);
  const mealIdxRef = useRef(0);
  dayIdxRef.current = dayIdx;
  mealIdxRef.current = mealIdx;
  const loadedWeekKeyRef = useRef(null);
  const [dirty, setDirty] = useState(false);
  // "<profile>|<weekStart>|<weekEnd>" of the week whose edits were saved in this
  // session, so the "Edited" badge stays on straight after Save even before the
  // reload brings back the server's own marker. Cleared by Reset week.
  const [savedEditsKey, setSavedEditsKey] = useState(null);
  const [toast, setToast] = useState(null);

  const [swapState, setSwapState] = useState(null); // { mode: "alts" | "search", foodId }
  const [swapQuery, setSwapQuery] = useState("");
  const [mealBuilder, setMealBuilder] = useState(null); // { name, rows: [{ingredient, grams}] }
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false); // "Reset week" confirmation popup
  const [resetting, setResetting] = useState(false); // reset-weekly-food-json-newtest in flight
  const [approveOpen, setApproveOpen] = useState(false); // "Approve week" confirmation popup
  const [approving, setApproving] = useState(false); // food_json_suggestion_approve_plan_newtest in flight
  const [deleteTarget, setDeleteTarget] = useState(null); // { dayIdx, slot, foodId, name } awaiting "Delete" confirmation
  const [customSaving, setCustomSaving] = useState(false); // "Make my meal" save is registering the plate with FitChef
  // Client's diet preference → default diet filter for the FitChef swap search.
  const [clientDiet, setClientDiet] = useState("");
  // Client's prescribed macros (get_macro_summary_by_date → final_macro_summary).
  // Used as the comparison target for days whose plan carries no targets of
  // its own, so the "Xg short / over" labels still have something to measure against.
  const [clientTargets, setClientTargets] = useState(null);
  // Macro summary client-details already loaded for the selected date
  // (macroSummary slice) — used when the fetch below finds nothing.
  const storeMacroSummary = useSelector(selectMacroSummaryData);
  const storeTargets = useMemo(() => {
    const body =
      storeMacroSummary?.data && typeof storeMacroSummary.data === "object" ? storeMacroSummary.data : storeMacroSummary;
    return readTargets(body) || readTargets(body?.current_data) || readTargets(body?.previous_data);
  }, [storeMacroSummary]);

  /* ---- client macro targets (non-fatal: labels just stay hidden) ---- */
  // get_macro_summary_by_date only answers for a date that has a strategy, so
  // try the week start, the week end and today in turn; first hit wins. The
  // real client id (Redux) is preferred over the plan's FitChef test id.
  useEffect(() => {
    const clientProfileId = requestedWeek?.profileId || profileId;
    if (!clientProfileId) {
      setClientTargets(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const dates = [...new Set([weekStart, weekEnd, today].filter(Boolean))];
      let found = null;
      for (const date of dates) {
        try {
          const res = await fetchMacroSummaryByDate(clientProfileId, date);
          if (cancelled) return;
          const body = res?.data && typeof res.data === "object" ? res.data : res;
          found = readTargets(body) || readTargets(body?.current_data) || readTargets(body?.previous_data);
        
          if (found) break;
        } catch (err) {
          if (cancelled) return;
        
        }
      }
      if (!cancelled) setClientTargets(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedWeek?.profileId, profileId, weekStart, weekEnd]);

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
        // Only jump back to Day 1 when a different client / week comes in. A
        // reload of the week already on screen (the refetch after Save, Reset
        // week or Retry) stays on the day and meal the trainer was working on,
        // clamped in case the server returned fewer days / meals.
        const weekKey = `${profileId}|${weekStart}|${weekEnd}`;
        if (loadedWeekKeyRef.current === weekKey) {
          const dayCount = next.days.length;
          const keptDay = Math.min(dayIdxRef.current, Math.max(dayCount - 1, 0));
          const mealCount = next.days[keptDay]?.meals?.length ?? 0;
          const keptMeal = Math.min(mealIdxRef.current, Math.max(mealCount - 1, 0));
          setDayIdx(keptDay);
          setMealIdx(keptMeal);
        } else {
          setDayIdx(0);
          setMealIdx(0);
        }
        loadedWeekKeyRef.current = weekKey;
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
    const fallback = clientTargets || storeTargets;
    
    if (!fallback) return list;
    return list.map((d) => (d.targets ? d : { ...d, targets: fallback }));
  }, [plan, clientTargets, storeTargets]);
  const day = days[dayIdx] || null;
  const slot = SLOTS[mealIdx];
  const items = day?.meals?.[slot] || [];
  const dayTotals = useMemo(() => (day ? sumMeals(day.meals) : EMPTY_TOTALS), [day]);
  const weekRange = plan?.meta?.week_range || (weekStart && weekEnd ? `${weekStart} – ${weekEnd}` : null);

  // status_value > 0 (approved / locked): the plan can no longer be edited.
  // Drives the disabled state of swaps / Search a swap / Make my meal / Delete.
  const editLocked = plan ? isWeekLocked(plan) : false;
  const editLockedReason = editLocked ? `${weekLockReason(plan)} and can no longer be edited` : "";

  /* ---- live shopping-list pricing (FitChef) ----
   * `food_json.shopping` is priced when the plan is generated, so a dish added
   * or swapped from Search has no price there until the backend rebuilds it.
   * While the dialog is open, the plan as it is on screen (saved or not) is
   * priced through FitChef. Until that reply lands the dialog shows a loading
   * state — never the stale saved list or an unpriced local one — so the user
   * only ever sees what the server returned. If pricing fails (or there is
   * nothing to price) the key is still recorded with `shopping: null`, which
   * lets the dialog fall back to the saved/local list and stops re-fetching. */
  const [liveShopping, setLiveShopping] = useState(null); // { key, shopping }
  const [pricing, setPricing] = useState(false);
  const shoppingKey = useMemo(() => JSON.stringify(shoppingPayload(days).days), [days]);
  const shoppingLoading = shoppingOpen && liveShopping?.key !== shoppingKey;
  useEffect(() => {
    if (!shoppingOpen || !plan) return undefined;
    const weekPayload = shoppingPayload(days);
    const key = JSON.stringify(weekPayload.days);
    if (liveShopping?.key === key) return undefined;
    if (weekPayload.meals.every((m) => m.ingredients.length === 0)) {
      setLiveShopping({ key, shopping: null }); // nothing to price
      return undefined;
    }
    const ctrl = new AbortController();
    setPricing(true);
    (async () => {
      try {
        const mealPayload = shoppingPayload(days, true);
         const zip = plan?.meta?.zip;
        const [weekRes, mealRes] = await Promise.all([
          priceShoppingListService(weekPayload.days, { signal: ctrl.signal, zip  }),
          priceShoppingListService(mealPayload.days, { signal: ctrl.signal, zip  }),
        ]);
        if (ctrl.signal.aborted) return;
        setLiveShopping({ key, shopping: buildLocalShopping(days, pricingFromFitChef(weekRes, mealRes, mealPayload.meals)) });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.warn("[DietPlanNew] shopping pricing failed:", err?.message || err);
        setLiveShopping({ key, shopping: null });
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
    if (isWeekLocked(plan)) {
      flash(`${weekLockReason(plan)} and its meals can no longer be deleted.`);
      return;
    }
    const f = items.find((x) => x.id === foodId);
    // The empty placeholder keeps its slot; it can only be refilled via a swap.
    if (!f || f.removed || isRemovedPlaceholder(f)) return;
    // Opens the confirmation popup; performDelete() does the work once confirmed.
    setDeleteTarget({ dayIdx, slot, foodId, name: f.name });
  }

  /** Runs once the "Delete" popup is confirmed. */
  function performDelete() {
    const t = deleteTarget;
    setDeleteTarget(null);
    if (!t) return;
    // Deleting a dish keeps the row as an empty placeholder (Save sends
    // "update"), so the slot is still there after reload. The placeholder
    // itself cannot be deleted (its Delete button is disabled).
    updateFood(t.dayIdx, t.slot, t.foodId, (fd) => ({
      ...fd,
      name: REMOVED_PLACEHOLDER_NAME,
      kcal_base: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      servings: 1,
      portion: "1 serving",
      prep_minutes: null,
      image: null,
      images: [],
      ingredients: [],
      method_steps: [],
      tips: [],
      alternatives: 0,
      alternativeItems: [],
      recipeId: null,
      variantId: null,
      hash: null,
    }));
    flash(`Removed ${t.name}`);
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
    if (isWeekLocked(plan)) {
      setSwapState(null);
      flash(`${weekLockReason(plan)} and can no longer be edited.`);
      return;
    }

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
    if (isWeekLocked(plan)) {
      flash(`${weekLockReason(plan)} and can no longer be edited.`);
      return;
    }
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

  async function saveCustomMeal() {
    if (!mealBuilder || customSaving) return;
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
    const customId = newCustomFoodId();
    // A plate built from several foods shows no picture at all (the card falls
    // back to its icon); a single-food meal keeps that food's picture.
    const customImages = single ? Array.from(new Set(rows.map((r) => r.image).filter(Boolean))) : [];
    const custom = {
      id: customId,
      foodId: customId,
      name: mealBuilder.name || rows.map((r) => r.name).join(", "),
      icon: "🍲",
      // First picture stays the main one (small avatar, shopping list); the
      // card's large thumbnail shows every food's picture as a collage.
      image: customImages[0] || null,
      images: customImages,
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
      // Typed steps win; otherwise every dish's own method is kept (prefixed
      // with the dish name when there are several), with generated steps only
      // for dishes that have none — so the card always has a Method.
      method_steps: typedSteps.length ? typedSteps : combinedMethodSteps(rows, mealBuilder.name),
      tips: textToSteps(mealBuilder.tip),
      alternatives: 0,
      alternativeItems: [],
      fitchefKey: single?.fitchefKey ?? null,
      removed: false,
    };

    // Several dish-bank foods on one plate → register the combination with the
    // backend (POST /dietitian/api/web/custom-meal) against this plan row, which
    // answers with the generated picture for the plate. Rows without a dish-bank
    // key (manual entries) have nothing the backend can look up, so they are
    // left out of the payload. A failure never blocks the local save.
    let note = "";
    const fitchefIngredients = rows
      .filter((r) => r.fitchefKey)
      .map((r) => ({ key: r.fitchefKey, grams: round(mealRowGrams(r)) }))
      .filter((i) => i.grams > 0);
    if (rows.length > 1 && fitchefIngredients.length > 0) {
      const meta = plan?.meta || {};
      const customProfileId = meta.profile_id || profileId || null;
      const recordId = Number(meta.id);
      if (!customProfileId || !recordId) {
        console.warn("[DietPlanNew] custom-meal skipped: plan has no profile id / record id");
      } else {
        const payload = {
          profile_id: customProfileId,
          record_id: recordId,
          day: dayIdx,
          meal_name: slot,
          name: custom.name,
          ingredients: fitchefIngredients,
        };
        setCustomSaving(true);
        try {
          const res = await saveCustomMealService(payload);
          console.debug("[DietPlanNew] custom-meal", { payload, response: res });
          const body = res?.data ?? res;
          // The plate's generated picture becomes the card image (single tile,
          // no collage since the backend renders the whole plate as one photo).
          const image = pickCustomMealImage(body);
          if (image) {
            custom.image = image;
            custom.images = [image];
          }
          // Keep whatever key the backend assigned so the plate can be referenced later.
          const key = body?.key ?? body?.food?.key ?? body?.meal?.key ?? body?.result?.key ?? null;
          if (key) custom.fitchefKey = key;
        } catch (err) {
          console.warn("[DietPlanNew] custom-meal failed:", err?.message || err);
          note = ` (meal image not generated: ${err?.message || "unreachable"})`;
        } finally {
          setCustomSaving(false);
        }
      }
    }

    // Empty slot (no food to replace) → add; otherwise replace the chosen food.
    if (mealBuilder.forFoodId == null) addFood(dayIdx, slot, custom);
    else updateFood(dayIdx, slot, mealBuilder.forFoodId, () => custom);
    setMealBuilder(null);
    flash(`Saved ${mealBuilder.name || "custom meal"}${note}`);
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
      setSavedEditsKey(`${profileId}|${weekStart}|${weekEnd}`);
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

  /**
   * "Reset week": asks the server (reset-weekly-food-json-newtest) to put the
   * whole week back to its originally generated plan, dropping every trainer
   * edit — saved or not — foods added from "Search a swap", swapped-in
   * alternatives, "Make my meal" rows, portion steps and deletions. Local
   * unsaved changes are thrown away too and the plan is reloaded from the
   * server. Any open swap / meal-builder dialog is closed so a half-finished
   * pick cannot land on the freshly reset plan.
   */
  function resetWeek() {
    if (!plan || saving || resetting || approving) return;
    // An approved (status 1) or locked (status 2) week cannot be reset.
    if (isWeekLocked(plan)) {
      flash(`${weekLockReason(plan)} and cannot be reset.`);
      return;
    }
    setResetOpen(true);
  }

  /** Runs once the "Reset week" popup is confirmed. */
  async function performReset() {
    setResetOpen(false);
    if (!plan || saving || resetting || approving) return;
    if (isWeekLocked(plan)) {
      flash(`${weekLockReason(plan)} and cannot be reset.`);
      return;
    }

    const meta = plan.meta || {};
    const payload = {
      id: Number(meta.id),
      dietitian_id: meta.dietitian_id || undefined, // service falls back to the access token
      profile_id: meta.profile_id || profileId,
      week_start_date: meta.week_start_date || weekStart,
      week_end_date: meta.week_end_date || weekEnd,
    };
    if (!payload.id || !payload.profile_id || !payload.week_start_date || !payload.week_end_date) {
      flash("Cannot reset: this plan has no row id / profile id / week.");
      return;
    }

    setResetting(true);
    try {
      const res = await resetWeeklyFoodJsonNewTestService(payload);
      // The newtest endpoints answer { status: true|false, message, data }.
      const accepted = res?.ok === true || res?.success === true || res?.status === true || res?.status === "success";
      console.debug("[DietPlanNew] reset week", { payload, response: res, accepted });
      if (!accepted) {
        throw new Error(res?.message || "Reset week failed");
      }
      setSwapState(null);
      setSwapQuery("");
      setMealBuilder(null);
      setDirty(false);
      setSavedEditsKey(null);
      flash(res?.message || "Week reset to the original plan");
      onUndo?.();
      // Reload from the server so the grid shows the reset row.
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("DietPlanNew reset week failed:", err);
      flash("Reset failed: " + (err?.message || "unknown error"));
    } finally {
      setResetting(false);
    }
  }

  /**
   * "Approve week" — opens the confirmation popup. The actual API call runs
   * in performApprove() once the user clicks "Yes".
   */
  function approveWeek() {
    if (!plan || saving || resetting || approving) return;
    // Already approved (status 1) or locked (status 2): nothing to approve.
    if (isWeekLocked(plan)) {
      flash(`${weekLockReason(plan)} and cannot be approved.`);
      return;
    }
    setApproveOpen(true);
  }

  /**
   * Runs once the "Approve week" popup is confirmed. POSTs
   * food_json_suggestion_approve_plan_newtest with
   * { id, dietician_id, profile_id, status: 1 } and, on success, marks the
   * loaded plan as approved so the "Approved" badge shows immediately.
   */
  async function performApprove() {
    setApproveOpen(false);
    if (!plan || saving || resetting || approving) return;
    if (isWeekLocked(plan)) {
      flash(`${weekLockReason(plan)} and cannot be approved.`);
      return;
    }

    const meta = plan.meta || {};
    const payload = {
      id: Number(meta.id),
      dietician_id: meta.dietitian_id || undefined, // service falls back to the access token
      profile_id: meta.profile_id || profileId,
      status: 1,
    };
    if (!payload.id || !payload.profile_id) {
      flash("Cannot approve: this plan has no row id / profile id.");
      return;
    }

    setApproving(true);
    try {
      const res = await approveWeeklyFoodJsonNewTestService(payload);
      // The approve endpoint answers { status: "success"|"error", code, message, data }.
      const accepted = res?.status === "success" || res?.status === true || res?.success === true;
      console.debug("[DietPlanNew] approve week", { payload, response: res, accepted });
      if (!accepted) {
        throw new Error(res?.message || "Approve week failed");
      }
      setPlan((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        next.meta = { ...(next.meta || {}), status_value: 1 };
        return next;
      });
      setOriginal((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        next.meta = { ...(next.meta || {}), status_value: 1 };
        return next;
      });
      flash(res?.message || "Week plan approved");
    } catch (err) {
      console.error("DietPlanNew approve week failed:", err);
      flash("Approve failed: " + (err?.message || "unknown error"));
    } finally {
      setApproving(false);
    }
  }


  /* ---------------------------------------------- loading / empty states */
  if (loading) {
    return (
      <div id="diet-plan-container" className="w-full border border-[#E1E6ED] rounded-[15px] pt-[15px] pb-2.5 px-2.5 bg-white">
        <div className="flex h-[360px] xl:h-[400px] 2xl:h-[440px] w-full flex-col items-center justify-center rounded-[15px] border-4 border-[#F5F7FA]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E1E6ED] border-t-[#308BF9]" />
          <p className="mt-4 text-[#738298] text-[13px] xl:text-[14px] 2xl:text-[15px] font-medium">
            Loading diet plan{weekRange ? ` for ${weekRange}` : ""}…
          </p>
        </div>
      </div>
    );
  }

  if (!plan || !day) {
    const isError = loadError && !loadError.noData;
    return (
      <div id="diet-plan-container" className="w-full border border-[#E1E6ED] rounded-[15px] pt-[15px] pb-2.5 px-2.5 bg-white">
        <div className="flex h-[360px] xl:h-[400px] 2xl:h-[440px] w-full flex-col items-center justify-center rounded-[15px] border-4 border-[#F5F7FA] px-6 text-center">
          <div className="text-3xl">{isError ? "⚠️" : "🍽️"}</div>
          <p className={cn("mt-3 text-[13px] xl:text-[14px] 2xl:text-[15px] font-medium", isError ? "text-[#E76F51]" : "text-[#738298]")}>
            {loadError?.message || "No diet plan found for this week."}
          </p>
          {weekRange && <p className={cn("mt-1 text-[#A1A1A1]", UI.small)}>{weekRange}</p>}
          {profileId && weekStart && weekEnd && (
            <button onClick={() => setReloadKey((k) => k + 1)} className={cn("mt-4", UI.btnSecondary)}>
              {isError ? "Try again" : "Refresh"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-2xl:flex-col gap-5 w-full min-w-0">
      {/* ------------------------------------------------- macros panel */}
      <MacrosPanel totals={dayTotals} targets={day.targets} dayIndex={dayIdx} />

      {/* --------------------------------------------------- plan panel */}
      <div
        id="diet-plan-container"
        className="w-full min-w-0 flex-1 border border-[#E1E6ED] rounded-[15px] pt-[15px] pb-2.5 px-2.5 bg-white"
      >
        {/* ---------------------------------------------------- client header */}
        <div className="flex items-center justify-between gap-4 flex-wrap px-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap py-[5px]">
              <p className={UI.title}>{clientName}</p>
              {isWeekApproved(plan) && (
                <span className="px-2.5 py-[5px] rounded-[5px] bg-[#2A9D8F1A] text-[#2A9D8F] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Approved
                </span>
              )}
              {weekStatus(plan) === 2 && (
                <span className="px-2.5 py-[5px] rounded-[5px] bg-[#7382981A] text-[#738298] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Locked
                </span>
              )}
              {(dirty || plan?.meta?.edited || savedEditsKey === `${profileId}|${weekStart}|${weekEnd}`) && (
                <span
                  title={dirty ? "This week has unsaved changes" : "This week differs from its originally generated plan"}
                  className="px-2.5 py-[5px] rounded-[5px] bg-[#F4A2611A] text-[#F4A261] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]"
                >
                  Edited
                </span>
              )}
              <button
                type="button"
                onClick={() => setFoodLogOpen(true)}
                disabled={!profileId}
                title="What the client actually logged in the app"
                className={cn(UI.btnSecondary, "px-3 py-1.5")}
              >
                Food log
              </button>
            </div>
            {[clientGoal, weekRange].filter(Boolean).length > 0 && (
              <p className={UI.subtitle}>{[clientGoal, weekRange].filter(Boolean).join(" · ")}</p>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={resetWeek}
              disabled={!plan?.meta?.id || saving || resetting || approving || isWeekLocked(plan)}
              title={
                isWeekLocked(plan)
                  ? `${weekLockReason(plan)} and can no longer be reset`
                  : "Put this week back to its original plan — every edit (saved or unsaved) is discarded"
              }
              className={UI.btnDanger}
            >
              {resetting ? "Resetting…" : "Reset week"}
            </button>
            <button onClick={() => setShoppingOpen(true)} className={UI.btnSecondary}>
              Shopping list
            </button>
            <button
              onClick={approveWeek}
              disabled={!plan?.meta?.id || saving || resetting || approving || isWeekLocked(plan)}
              title={
                isWeekApproved(plan)
                  ? "This week plan is already approved"
                  : isWeekLocked(plan)
                    ? `${weekLockReason(plan)} and cannot be approved`
                    : "Mark this week plan as approved"
              }
              className={UI.btnPrimary}
            >
              {approving ? "Approving…" : isWeekApproved(plan) ? "Approved" : "Approve week"}
            </button>
          </div>
        </div>

        {/* day tabs — the whole pill carries on-target/over/under state, same as the python dashboard */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-2.5 mt-[15px]">
          <div className="border border-[#E1E6ED] rounded-[10px] flex overflow-x-auto scroll-hide">
            {days.map((d, i) => {
              const t = sumMeals(d.meals);
              const targetKcal = num(d.targets?.kcal);
              const ratio = targetKcal ? t.kcal / targetKcal : null;
              // No target → neutral pill rather than a bogus "over".
              const status = ratio === null ? "none" : ratio > 1.08 ? "over" : ratio < 0.92 ? "under" : "ok";
              const active = i === dayIdx;
              return (
                <div
                  key={`${d.label}-${i}`}
                  onClick={() => {
                    setDayIdx(i);
                    setMealIdx(0);
                  }}
                  title={targetKcal ? `${Math.round(t.kcal)} of ${Math.round(targetKcal)} kcal` : `${Math.round(t.kcal)} kcal`}
                  className={cn(
                    "px-4 py-2.5 cursor-pointer shrink-0 transition-colors",
                    !active && status === "none" && "bg-white hover:bg-[#F5F7FA]",
                    active && status === "none" && "bg-[#308BF9]",
                    !active && status === "ok" && "bg-[#2A9D8F1A] hover:bg-[#2A9D8F33]",
                    !active && status === "over" && "bg-[#F4A2611A] hover:bg-[#F4A26133]",
                    !active && status === "under" && "bg-[#308BF91A] hover:bg-[#308BF933]",
                    active && status === "ok" && "bg-[#2A9D8F]",
                    active && status === "over" && "bg-[#F4A261]",
                    active && status === "under" && "bg-[#308BF9]",
                  )}
                >
                  <p
                    className={cn(
                      "text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap",
                      active && "text-white",
                      !active && status === "none" && "text-[#A1A1A1]",
                      !active && status === "ok" && "text-[#2A9D8F]",
                      !active && status === "over" && "text-[#F4A261]",
                      !active && status === "under" && "text-[#308BF9]",
                    )}
                  >
                    {d.label}
                  </p>
                </div>
              );
            })}
          </div>

          <div className={cn("flex flex-wrap items-center gap-3 text-[#738298]", UI.small)}>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-[6px] w-[6px] rounded-full bg-[#2A9D8F]" />
              on target
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-[6px] w-[6px] rounded-full bg-[#F4A261]" />
              over
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-[6px] w-[6px] rounded-full bg-[#308BF9]" />
              short
            </span>
            <span className="text-[#535359]">by calories · hover a day for its numbers</span>
          </div>
        </div>

        <div>
          <div className="flex max-2xl:flex-col gap-[3px] mt-[15px]">
            {/* meal tabs */}
            <div className="flex flex-col max-2xl:flex-row max-2xl:overflow-x-auto scroll-hide gap-[15px] px-[15px] pt-[15px] max-2xl:pb-[15px] 2xl:pb-[54px] rounded-[15px] border-4 border-[#F5F7FA] min-w-[180px] xl:min-w-[200px] 2xl:min-w-[220px] h-fit">
              {SLOTS.map((s, i) => {
                const isActive = i === mealIdx;
                return (
                  <div
                    key={s}
                    onClick={() => setMealIdx(i)}
                    title={SLOT_META[s].time}
                    className={cn(
                      "flex flex-col gap-2.5 py-2.5 pl-[15px] pr-2.5 w-full max-2xl:w-auto max-2xl:shrink-0 max-2xl:whitespace-nowrap cursor-pointer",
                      isActive && "bg-[#308BF9] rounded-[10px]",
                      !isActive && i !== 0 && "border-t max-2xl:border-t-0 max-2xl:border-l border-[#E1E6ED]",
                    )}
                  >
                    <p
                      className={cn(
                        "text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-[110%] tracking-[-0.48px]",
                        isActive ? "text-white" : "text-[#252525]",
                      )}
                    >
                      {SLOT_META[s].label}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] xl:text-[11px] 2xl:text-[12px] font-normal leading-normal tracking-[-0.2px]",
                        isActive ? "text-white" : "text-[#252525]",
                      )}
                    >
                      {SLOT_META[s].time}
                    </p>
                  </div>
                );
              })}
            </div>


<div className="flex flex-col max-2xl:flex-row gap-[3px]">
            {/* food cards */}
            <div className="pt-5 pb-[15px] pl-[15px] pr-2.5 border-4 border-[#F5F7FA] rounded-[15px] flex-1 min-w-0 max-2xl:flex-none min-h-[300px] xl:min-h-[320px] 2xl:min-h-[340px] flex flex-col">
              {items.length === 0 && (
                <div className="flex-1 flex flex-wrap items-center justify-center gap-2.5 py-10">
                  <ActionBtn
                    primary
                    disabled={editLocked}
                    title={editLocked ? editLockedReason : undefined}
                    onClick={() => {
                      setSwapQuery("");
                      setSwapState({ mode: "search", foodId: null });
                    }}
                  >
                    Search a swap
                  </ActionBtn>
                  <ActionBtn disabled={editLocked} title={editLocked ? editLockedReason : undefined} onClick={() => openMealBuilder(null)}>
                    Make my meal
                  </ActionBtn>
                </div>
              )}
              {items.length > 0 && (
                // Each FoodCard scrolls its own body; the list itself just stacks them.
                <div className="flex flex-col gap-5">
                  {items.map((f, i) => (
                    <FoodCard
                      key={f.id}
                      index={i}
                      food={f}
                      slot={slot}
                      onStepPortion={(delta) => stepPortion(f.id, delta)}
                      onDelete={() => deleteFood(f.id)}
                      // Same disabled rule as the "Reset week" / "Approve week" buttons.
                      deleteDisabled={!plan?.meta?.id || saving || resetting || approving || isWeekLocked(plan)}
                      deleteDisabledReason={
                        isWeekLocked(plan)
                          ? `${weekLockReason(plan)} and its meals can no longer be deleted`
                          : "Please wait for the current action to finish"
                      }
                      editLocked={editLocked}
                      editLockedReason={editLockedReason}
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
              )}
            </div>

          </div>
          </div>

          {/* --------------------------------------------------------- save bar */}
          {dirty && (
            <div className="sticky bottom-4 z-40 mt-2.5 flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-[#308BF9] bg-[#EEF4FE] shadow-[0px_4px_10px_rgba(0,0,0,0.08)]">
              <p className="text-[12px] xl:text-[13px] font-medium text-[#252525] flex-1">
                {saving ? "Saving your changes…" : "You have unsaved changes to this plan."}
              </p>
              <button onClick={undo} disabled={saving} className={UI.btnSecondary}>
                Undo
              </button>
              <button onClick={save} disabled={saving} className={cn(UI.btnPrimary, "px-5")}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-[10px] bg-[#252525]/95 px-4 py-2.5 text-[12px] xl:text-[13px] font-medium text-white shadow-[0px_4px_10px_rgba(0,0,0,0.12)]">
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

      {/* ------------------------------------------------------ food log */}
      {foodLogOpen && (
        <FoodLogDialog
          profileId={profileId}
          weekStart={weekStart}
          weekEnd={weekEnd}
          clientName={clientName}
          onClose={() => setFoodLogOpen(false)}
        />
      )}

      {/* ------------------------------------------------ make-my-meal dialog */}
      {mealBuilder && (
        <MakeMealDialog
          state={mealBuilder}
          totals={mealBuilderTotals()}
          target={mealBuilder.target}
          slot={slot}
          defaultDiet={clientDiet}
           zip={plan?.meta?.zip}
          onChange={setMealBuilder}
          onClose={() => setMealBuilder(null)}
          onSave={saveCustomMeal}
          saving={customSaving}
        />
      )}

      {/* ------------------------------------------------ reset week confirm */}
      {resetOpen && (
        <ConfirmPopup
          title="Reset this week?"
          message="The week goes back to its original plan. Every edit — added, swapped and custom meals, saved or not — will be discarded."
          confirmLabel="Reset week"
          onClose={() => setResetOpen(false)}
          onConfirm={performReset}
        />
      )}

      {/* ---------------------------------------------- approve week confirm */}
      {approveOpen && (
        <ConfirmPopup
          title="Approve this week plan?"
          message="Are you sure you want to approve this week plan?"
          confirmLabel="Yes"
          cancelLabel="No"
          tone="primary"
          onClose={() => setApproveOpen(false)}
          onConfirm={performApprove}
        />
      )}

      {/* ------------------------------------------------ delete food confirm */}
      {deleteTarget && (
        <ConfirmPopup
          title={`Remove "${deleteTarget.name}" from the plan?`}
          message="The slot stays, empty, so you can build a replacement."
          confirmLabel="Delete"
          onClose={() => setDeleteTarget(null)}
          onConfirm={performDelete}
        />
      )}

      {/* --------------------------------------------------- shopping list */}
      {shoppingOpen && (
        <ShoppingListDialog
          shopping={shoppingLoading ? null : liveShopping?.shopping || plan.shopping || buildLocalShopping(days)}
          fallbackItems={shoppingLoading ? [] : shoppingList()}
          dirty={dirty && !liveShopping?.shopping}
          pricing={pricing}
          loading={shoppingLoading}
          onClose={() => setShoppingOpen(false)}
        />
      )}
    </div>
  );
}

/* ============================================================ FoodLogDialog */

/**
 * "Food log" popup — what the client actually logged in the app, read from
 * `POST /dietitian/api/web/food-log` (fetchFoodLogService). Opens on the plan's
 * week (weekStart..weekEnd) or today when no week is selected; the dietitian
 * can widen / move the range with the two date pickers (server cap: 92 days).
 *
 * The API already returns every day in the range and all four slots (empty
 * ones with zero totals), so this only picks a day and renders it.
 */

const FOOD_LOG_SLOTS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

const FOOD_LOG_MAX_DAYS = 92;

const isYmd = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Local calendar date as YYYY-MM-DD (the app's log_date is a calendar day). */
function foodLogToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-09-05" → "Fri, Sep 5". */
function foodLogDayLabel(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (isNaN(d)) return ymd;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Inclusive day count between two YYYY-MM-DD strings; 0 when start > end or invalid. */
function foodLogDaysBetween(start, end) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (isNaN(a) || isNaN(b) || a > b) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/** 74.3 → "74.3", 4 → "4", null → "–". */
function foodLogG(v) {
  if (v === null || v === undefined) return "–";
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "2026-09-11 12:48:18" → "12:48". */
function foodLogTime(ts) {
  const s = String(ts || "");
  return s.length >= 16 ? s.slice(11, 16) : "";
}

const FOOD_LOG_SOURCE_LABEL = { plan: "Plan", chef: "Chef", manual: "Manual", search: "Search", photo: "Photo" };

function FoodLogDialog({ profileId, weekStart, weekEnd, clientName, onClose }) {
  const today = foodLogToday();
  const planWeek = isYmd(weekStart) && isYmd(weekEnd) ? { start: weekStart, end: weekEnd } : null;
  const initial = planWeek || { start: today, end: today };

  const [range, setRange] = useState(initial); // what is loaded
  const [draft, setDraft] = useState(initial); // what the date pickers show
  const [draftError, setDraftError] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  // Day strip: scrolled with the arrows / wheel / visible scrollbar, and the
  // selected day is brought into view whenever it changes.
  const dayStripRef = useRef(null);
  const scrollDayStrip = (dir) => dayStripRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  useEffect(() => {
    if (loading) return;
    dayStripRef.current
      ?.querySelector("[data-active=\"true\"]")
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [dayIdx, loading]);

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      setError("No client selected");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFoodLogService({ profileId, startDate: range.start, endDate: range.end })
      .then((res) => {
        if (cancelled) return;
        const body = res?.data || null;
        setData(body);
        // Land on today when it is in the range, else the first day with
        // anything logged, else the first day.
        const days = Array.isArray(body?.days) ? body.days : [];
        let idx = days.findIndex((d) => d.log_date === today);
        if (idx < 0) idx = days.findIndex((d) => num(d?.totals?.entries) > 0);
        setDayIdx(idx < 0 ? 0 : idx);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(err?.data?.message || err?.message || "Could not load the food log");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, range.start, range.end, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyDraft = () => {
    if (!isYmd(draft.start) || !isYmd(draft.end)) return setDraftError("Pick both dates");
    const n = foodLogDaysBetween(draft.start, draft.end);
    if (n === 0) return setDraftError("Start date must be on or before the end date");
    if (n > FOOD_LOG_MAX_DAYS) return setDraftError(`At most ${FOOD_LOG_MAX_DAYS} days at a time`);
    setDraftError(null);
    setRange({ start: draft.start, end: draft.end });
    return undefined;
  };

  const showPlanWeek = () => {
    if (!planWeek) return;
    setDraft(planWeek);
    setDraftError(null);
    setRange(planWeek);
  };

  const days = Array.isArray(data?.days) ? data.days : [];
  const day = days[dayIdx] || null;
  const rangeTotals = data?.totals || null;
  const subtitle = `${clientName || "Client"} · ${range.start === range.end ? foodLogDayLabel(range.start) : `${range.start} – ${range.end}`}`;

  const macroLine = (t) => (
    <span className={cn("tabular-nums text-[#738298]", UI.small)}>
      <span style={{ color: MACRO_COLORS.protein }}>P {foodLogG(t?.protein)}g</span>
      {" · "}
      <span style={{ color: MACRO_COLORS.carbs }}>C {foodLogG(t?.carbs)}g</span>
      {" · "}
      <span style={{ color: MACRO_COLORS.fats }}>F {foodLogG(t?.fat)}g</span>
      {" · "}
      <span style={{ color: MACRO_COLORS.fibre }}>Fb {foodLogG(t?.fiber)}g</span>
    </span>
  );

  return (
    <ModalShell title="Food log" subtitle={subtitle} onClose={onClose} widthClass="max-w-[760px]" tall>
      {/* ------------------------------------------------------ range bar */}
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-[#E1E6ED] px-5 py-3">
        <input
          type="date"
          value={draft.start}
          max={draft.end || undefined}
          onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
          className={cn(UI.input, "w-auto py-1.5")}
          aria-label="From date"
        />
        <span className={cn("text-[#A1A1A1]", UI.small)}>to</span>
        <input
          type="date"
          value={draft.end}
          min={draft.start || undefined}
          onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
          className={cn(UI.input, "w-auto py-1.5")}
          aria-label="To date"
        />
        <button type="button" onClick={applyDraft} disabled={loading} className={cn(UI.btnSecondary, "px-3 py-1.5")}>
          Show
        </button>
        {planWeek && (range.start !== planWeek.start || range.end !== planWeek.end) && (
          <button type="button" onClick={showPlanWeek} disabled={loading} className={cn(UI.btnSecondary, "px-3 py-1.5")}>
            Plan week
          </button>
        )}
        {draftError && <span className={cn("text-[#E76F51]", UI.small)}>{draftError}</span>}
        {!loading && !error && rangeTotals && (
          <span className={cn("ml-auto tabular-nums text-[#738298]", UI.small)}>
            {num(rangeTotals.entries)} {num(rangeTotals.entries) === 1 ? "entry" : "entries"} · {Math.round(num(rangeTotals.kcal))} kcal
            {data?.truncated ? " · showing first 2000" : ""}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------ day tabs */}
      {!loading && !error && days.length > 1 && (
        <div className="flex flex-none items-center gap-2 border-b border-[#E1E6ED] px-3 py-2.5">
          <button
            type="button"
            onClick={() => scrollDayStrip(-1)}
            aria-label="Scroll days left"
            className="shrink-0 rounded-[8px] border border-[#E1E6ED] bg-white px-2 py-1.5 text-[#535359] leading-none cursor-pointer hover:bg-[#F5F7FA] transition-colors"
          >
            ‹
          </button>

          {/* Visible thin scrollbar (custom-scrollbar shows it on hover); the
              arrows and mouse-wheel also scroll it, and the selected day is
              scrolled into view automatically. */}
          <div ref={dayStripRef} className="custom-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto scroll-smooth pb-1">
            {days.map((d, i) => {
              const active = i === dayIdx;
              const logged = num(d?.totals?.entries) > 0;
              return (
                <button
                  key={d.log_date}
                  type="button"
                  data-active={active ? "true" : "false"}
                  onClick={() => setDayIdx(i)}
                  className={cn(
                    "flex shrink-0 flex-col items-start rounded-[8px] border px-3 py-1.5 text-left cursor-pointer transition-colors",
                    active ? "border-[#308BF9] bg-[#308BF9] text-white" : "border-[#E1E6ED] bg-white text-[#252525] hover:bg-[#F5F7FA]",
                    !logged && !active && "text-[#A1A1A1]",
                  )}
                >
                  <span className={cn("font-semibold whitespace-nowrap", UI.small)}>
                    {foodLogDayLabel(d.log_date)}
                    {d.log_date === today ? " · today" : ""}
                  </span>
                  <span className={cn("tabular-nums whitespace-nowrap", UI.small, active ? "text-white/80" : "text-[#738298]")}>
                    {logged ? `${Math.round(num(d.totals.kcal))} kcal` : "nothing logged"}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollDayStrip(1)}
            aria-label="Scroll days right"
            className="shrink-0 rounded-[8px] border border-[#E1E6ED] bg-white px-2 py-1.5 text-[#535359] leading-none cursor-pointer hover:bg-[#F5F7FA] transition-colors"
          >
            ›
          </button>
        </div>
      )}

      {/* ------------------------------------------------------ body */}
      <div className="min-h-0 flex-1 overflow-y-auto scroll-hide">
        {loading && (
          <div className={cn("flex h-[240px] items-center justify-center text-[#738298]", UI.body)}>Loading food log…</div>
        )}

        {!loading && error && (
          <div className="flex h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className={cn("text-[#E76F51] font-medium", UI.body)}>{error}</p>
            {profileId && (
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={UI.btnSecondary}>
                Try again
              </button>
            )}
          </div>
        )}

        {!loading && !error && !day && (
          <div className={cn("flex h-[240px] items-center justify-center text-[#738298]", UI.body)}>No food logged in this range.</div>
        )}

        {!loading && !error && day && (
          <>
            {/* day header */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-4">
              <p className={cn("text-[#252525] font-semibold", UI.body)}>
                {foodLogDayLabel(day.log_date)}
                <span className={cn("ml-2 font-normal text-[#738298]", UI.small)}>{day.log_date}</span>
              </p>
              <p className={cn("tabular-nums text-[#252525] font-semibold", UI.body)}>
                {Math.round(num(day?.totals?.kcal))} kcal <span className="ml-2 font-normal">{macroLine(day?.totals)}</span>
              </p>
            </div>

            {num(day?.totals?.entries) === 0 && (
              <div className={cn("mx-5 mb-4 rounded-[8px] bg-[#F5F7FA] px-4 py-3 text-[#738298]", UI.body)}>Nothing logged on this day.</div>
            )}

            {num(day?.totals?.entries) > 0 &&
              FOOD_LOG_SLOTS.map(({ key, label }) => {
                const slot = (day.slots || []).find((s) => s.slot === key) || { totals: {}, entries: [] };
                const entries = Array.isArray(slot.entries) ? slot.entries : [];
                return (
                  <div key={key} className="border-t border-[#F5F7FA]">
                    <div className="flex items-baseline justify-between px-5 pb-1.5 pt-3">
                      <span className={cn("text-[#738298] font-semibold uppercase", UI.small)}>{label}</span>
                      <span className={cn("tabular-nums text-[#738298]", UI.small)}>
                        {entries.length ? `${Math.round(num(slot?.totals?.kcal))} kcal` : ""}
                      </span>
                    </div>

                    {entries.length === 0 && <div className={cn("px-5 pb-3 text-[#A1A1A1]", UI.small)}>Nothing logged</div>}

                    {entries.map((e) => (
                      <div key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className={UI.foodName}>
                            {e.food_name}
                            {e.brand ? <span className={cn("ml-1.5 font-normal text-[#738298]", UI.small)}>{e.brand}</span> : null}
                          </p>
                          <p className={cn("mt-0.5 text-[#738298]", UI.small)}>
                            {num(e.quantity) !== 1 ? `${foodLogG(e.quantity)} × ` : ""}
                            {e.serving_desc}
                            {e.grams !== null && e.grams !== undefined ? ` · ${foodLogG(e.grams)} g` : ""}
                            {foodLogTime(e.logged_at) ? ` · ${foodLogTime(e.logged_at)}` : ""}
                            {e.source && (
                              <span className="ml-1.5 rounded-[4px] bg-[#F5F7FA] px-1.5 py-[1px] text-[#535359]">
                                {FOOD_LOG_SOURCE_LABEL[e.source] || e.source}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn("tabular-nums text-[#252525] font-semibold", UI.body)}>{Math.round(num(e.kcal))} kcal</p>
                          <p className="mt-0.5">{macroLine(e)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
          </>
        )}
      </div>
    </ModalShell>
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

  // Ring geometry mirrors the MacrosUpdate doughnut (chart.js cutout 78%,
  // rotation -45°): a thick band with no gaps between segments, a thin
  // #E1E6ED hairline on both edges and a rounded cap on the END of each
  // segment that overlaps the start of the next one.
  const R_OUT = 117;
  const R_IN = R_OUT * 0.78;
  const BAND = R_OUT - R_IN;
  const R = (R_OUT + R_IN) / 2; // stroke centre line
  const CIRC = 2 * Math.PI * R;
  const START_DEG = -45; // clockwise from 12 o'clock, like MacrosUpdate
  const toRad = (deg) => (deg * Math.PI) / 180;
  // Arcs, clockwise from the start angle: Carbs → Fats → Protein → Fibre.
  const arcs = [
    { key: "carbs", pct: pctC, color: MACRO_COLORS.carbs },
    { key: "fats", pct: pctF, color: MACRO_COLORS.fats },
    { key: "protein", pct: pctP, color: MACRO_COLORS.protein },
    { key: "fibre", pct: pctFib, color: MACRO_COLORS.fibre },
  ];
  let cursor = 0;
  const segs = arcs.map((a) => {
    const len = Math.max(0, (a.pct / 100) * CIRC);
    const endRad = toRad(START_DEG + ((cursor + a.pct) / 100) * 360 - 90);
    const seg = {
      ...a,
      dash: `${len} ${CIRC - len}`,
      dashOffset: -(cursor / 100) * CIRC,
      // Rounded cap drawn at the segment's end (skipped for slivers thinner than the cap).
      cap: (a.pct / 100) * CIRC >= BAND / 2 ? { x: 120 + R * Math.cos(endRad), y: 120 + R * Math.sin(endRad) } : null,
    };
    cursor += a.pct;
    return seg;
  });

  // Bubbles sit on the band at the midpoint angle of their own segment.
  // Hidden below 4% — at that size two bubbles land on top of each other
  // and read as noise.
  let bubbleCursor = 0;
  const bubbles = arcs
    .map((a) => {
      const midPct = bubbleCursor + a.pct / 2;
      bubbleCursor += a.pct;
      if (a.pct < 4) return null;
      const angleRad = toRad(START_DEG + (midPct / 100) * 360 - 90);
      const cx = 120 + R * Math.cos(angleRad);
      const cy = 120 + R * Math.sin(angleRad);
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
    <section
      id="macros-update-container"
      className="w-[356px] max-2xl:w-full max-2xl:shrink-0 shrink-0 h-fit pt-5 pr-1 pb-5 bg-[#F5F7FA] rounded-[15px]"
    >
      <div className="flex items-center justify-between px-[18px] pr-[10px]">
        <p className={UI.sectionLabel}>Diet Plan Macros</p>
      </div>

      <div className="flex justify-center items-center py-5">
        <div className="relative w-[200px] h-[200px]">
          <svg viewBox="0 0 240 240" className="h-full w-full">
            {/* Empty track (only visible while the day has no macros) */}
            <circle cx="120" cy="120" r={R} fill="transparent" stroke="#E1E6ED" strokeWidth={BAND} />
            <g transform={`rotate(${START_DEG - 90} 120 120)`}>
              {segs.map((s) => (
                <circle
                  key={s.key}
                  cx="120"
                  cy="120"
                  r={R}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={BAND}
                  strokeDasharray={s.dash}
                  strokeDashoffset={s.dashOffset}
                  className="transition-all duration-500"
                />
              ))}
            </g>
            {segs.map((s) => (s.cap ? <circle key={`${s.key}-cap`} cx={s.cap.x} cy={s.cap.y} r={BAND / 2} fill={s.color} /> : null))}
            {/* Hairlines on the inner and outer edge of the band */}
            <circle cx="120" cy="120" r={R_IN} fill="transparent" stroke="#E1E6ED" strokeWidth="4" />
            <circle cx="120" cy="120" r={R_OUT} fill="transparent" stroke="#E1E6ED" strokeWidth="4" />
          </svg>
          {bubbles.map((b) => (
            <div
              key={b.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 min-w-[47px] h-[24px] px-2 whitespace-nowrap rounded-full bg-white shadow-[0px_4px_10px_rgba(0,0,0,0.12)] flex items-center justify-center"
              style={{ top: `${b.top}%`, left: `${b.left}%` }}
            >
              <p className="text-[#252525] text-[12px] font-semibold">{b.pct}%</p>
            </div>
          ))}
          <div className="absolute inset-0 flex flex-col gap-[2px] items-center justify-center text-center pointer-events-none">
            <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">Calories</p>
            <p className="text-[#252525] text-[40px] font-normal leading-normal tracking-[-0.8px] tabular-nums">{cal}</p>
            <p className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">
              {targetKcal ? `of ${targetKcal} kcal` : "kcal"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex max-2xl:justify-center">
          {legend.map((l) => {
            const delta = l.target ? deltaLabel(l.g, l.target) : null;
            return (
              <div key={l.label} className="flex flex-col gap-2.5 w-[87px] items-center min-w-0">
                <div className="flex gap-[5px] items-center">
                  <div className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: l.color }}></div>
                  <p className="text-[#252525] text-[10px] font-semibold capitalize">{l.label}</p>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <p className="text-[#252525] text-[15px] font-semibold tabular-nums">{Math.round(l.g)}g</p>
                  {l.target ? <p className="text-[#738298] text-[10px] font-normal">of {Math.round(l.target)}g</p> : null}
                  {delta && (
                    <div className={cn("flex items-center gap-[3px] py-[2.5px] text-[10px] font-semibold", delta.cls)}>
                      {delta.up !== null && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          {delta.up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                        </svg>
                      )}
                      {delta.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pl-[18px] pr-[10px]">
          <p className="text-[#738298] text-[12px] leading-[130%]">{narrative}</p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ FoodCard */

function FoodCard({
  food: f,
  slot,
  index,
  onStepPortion,
  onDelete,
  onOpenSwaps,
  onSearchSwap,
  onMakeMeal,
  onShowMeasurements,
  // Locked (approved / locked) week or an action in flight: Delete is greyed out.
  deleteDisabled = false,
  deleteDisabledReason = "",
  // Approved / locked week: swaps, Search a swap and Make my meal are greyed out.
  editLocked = false,
  editLockedReason = "",
}) {
  const [showMethod, setShowMethod] = useState(false);
  // A deleted dish shows as an empty placeholder in the normal card layout:
  // "(empty — removed)", zero macros, no photo, servings pinned at 1. That is
  // both the unsaved state (performDelete) and the saved one (the row comes
  // back from the server under the placeholder name). Search a swap / Make my
  // meal stay active so the slot can be refilled. Delete stays enabled on a
  // placeholder (it drops the row); it is greyed out once the row is marked
  // removed and only Save remains.
  const removed = !!f.removed || isRemovedPlaceholder(f);
  const view = removed
    ? {
        ...f,
        name: REMOVED_PLACEHOLDER_NAME,
        kcal_base: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        servings: 1,
        portion: "1 serving",
        prep_minutes: null,
        image: null,
        images: [],
        ingredients: [],
        method_steps: [],
        tips: [],
        alternatives: 0,
      }
    : f;
  // Per-dish sections for a Make-my-meal dish; null for an ordinary recipe.
  const methodGroups = useMemo(() => groupMethodSteps(view.method_steps), [view.method_steps]);
  const s = scaledFood(view);
  const serv = view.servings || 1;
  // "10 MIN · NON-VEG · BREAKFAST": prep time, diet tag(s), then the slot the
  // row sits in. Older rows may still carry the slot inside diet_type, so
  // repeats are dropped case-insensitively.
  const headerTags = [];
  const seen = new Set();
  for (const raw of [
    view.prep_minutes ? `${view.prep_minutes} min` : null,
    ...String(view.diet_type === "custom" ? "" : view.diet_type || "").split(","),
    // Recipe's own meal-type label ("Snack (Evening)") when the row has one, else the slot.
    view.meal_type || SLOT_META[slot]?.label,
  ]) {
    const tag = String(raw || "").trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    headerTags.push(tag);
  }
  // Stored row id (e.g. "custom-9fe60d7f39"), shown last like the older plan screen does.
  if (view.foodId) headerTags.push(`ID ${view.foodId}`);

  return (
    // Card = scrollable body (article) + a fixed action row under it. The
    // separator lives on the wrapper so it sits below the buttons. The body
    // cap is sized so body + buttons fit inside the client-details panel
    // (h-[85vh] with its own inner scroller) without scrolling the panel.
    <div className="flex flex-col pb-5 border-b border-[#E1E6ED] last:border-b-0 last:pb-0">
      <article className="flex gap-[5px] max-h-[200px] xl:max-h-[220px] 2xl:max-h-[240px] overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:#E1E6ED_transparent]">
      <div className="flex my-[3px] items-start shrink-0">
        <FoodThumb food={view} className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-[30px] 2xl:w-[30px] rounded-full bg-[#F4A2611A] text-[14px]" />
        <p className="px-[9px] pt-[3px] pb-0.5 text-[#252525] text-[15px] xl:text-[16px] 2xl:text-[18px] font-bold leading-[126%] tracking-[-0.3px] tabular-nums">
          {index + 1}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1">
          <p className={UI.foodName}>{view.name}</p>
          <div className="flex flex-wrap items-center gap-[5px]">
            <p className={cn("text-[#252525] font-normal", UI.small)}>
              <span className="font-semibold tabular-nums">{s.kcal}kcal</span>
            </p>
            {view.portion && <p className={cn("text-[#252525] font-normal", UI.small)}>{view.portion}</p>}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          <Chip k="P" v={s.protein_g} />
          <Chip k="C" v={s.carbs_g} />
          <Chip k="F" v={s.fat_g} />
          <Chip k="Fib" v={s.fiber_g} />
        </div>

        <div className="mt-2.5 border-t border-[#E1E6ED] pt-2.5">
          <p className={cn("mb-1.5 text-[#738298] font-semibold uppercase", UI.small)}>{headerTags.join(" · ")}</p>

          <div className="flex items-start gap-3">
            <FoodThumb
              // Removed placeholder: the photo box reads "no photo" instead of the plate emoji.
              food={removed ? { ...view, icon: <span className={cn("text-[#A1A1A1] font-normal", UI.small)}>no photo</span> } : view}
              collage
              className="h-[76px] w-[76px] rounded-[10px] border border-[#E1E6ED] bg-[#F5F7FA] text-3xl"
            />

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className={cn("text-[#738298] font-semibold uppercase", UI.small)}>servings</span>
                {/* Approved / locked week: servings can no longer be changed. */}
                <StepBtn label="−" disabled={editLocked || removed || serv - 0.25 < 0.25} title={editLocked ? editLockedReason : undefined} onClick={() => onStepPortion(-1)} />
                <span className={cn("min-w-[56px] text-center text-[#252525] font-semibold tabular-nums", UI.body)}>{serv}</span>
                <StepBtn label="+" disabled={editLocked || removed || serv + 0.25 > 6} title={editLocked ? editLockedReason : undefined} onClick={() => onStepPortion(1)} />
                {serv !== 1 && (
                  <span className={cn("text-[#308BF9] font-semibold", UI.small)}>
                    {s.kcal} kcal · P{Math.round(s.protein_g)} · C{Math.round(s.carbs_g)} · F{Math.round(s.fat_g)}
                  </span>
                )}
              </div>

              {view.ingredients.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {view.ingredients.map((ing, i) => {
                    const m = unitMetric(ing.unit);
                    return (
                      <span
                        key={i}
                        className={cn("rounded-[5px] border border-[#E1E6ED] bg-[#F5F7FA] px-2 py-[3px] text-[#738298] font-normal", UI.small)}
                      >
                        {ing.name} <b className="font-semibold text-[#252525]">{fmtQty(ing.qty * serv)}</b> {ing.unit}
                        {m && <span className="ml-1 text-[#A1A1A1]">({m.per} {m.unit} each)</span>}
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={onShowMeasurements}
                    title="Measurements"
                    aria-label="Show measurements"
                    className="flex h-4 w-4 xl:h-[18px] xl:w-[18px] items-center justify-center rounded-full border border-[#A1A1A1] text-[10px] font-bold text-[#738298] cursor-pointer hover:border-[#308BF9] hover:text-[#308BF9] transition-colors"
                  >
                    i
                  </button>
                </div>
              )}

              {view.method_steps.length > 0 && (
                <>
                  <button
                    onClick={() => setShowMethod((v) => !v)}
                    className={cn("mt-2 text-[#308BF9] font-semibold uppercase cursor-pointer hover:text-[#2678D9]", UI.small)}
                  >
                    {showMethod ? "Hide method" : "Method"}
                  </button>
                  {showMethod && (
                    <>
                      {methodGroups ? (
                        // Make-my-meal dish: one section per food, each with its own numbered steps.
                        <div className="mt-1.5 space-y-2">
                          {methodGroups.map((g, gi) => (
                            <div key={`${gi}-${g.name}`}>
                              {g.name && <p className={cn("mb-0.5 text-[#252525] font-semibold", UI.body)}>{g.name}</p>}
                              <ol className={cn("list-decimal pl-[18px] text-[#738298]", UI.body)}>
                                {g.steps.map((step, i) => (
                                  <li key={i} className="mb-1">
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ol className={cn("mt-1.5 list-decimal pl-[18px] text-[#738298]", UI.body)}>
                          {view.method_steps.map((step, i) => (
                            <li key={i} className="mb-1">
                              {step}
                            </li>
                          ))}
                        </ol>
                      )}
                      {view.tips?.length > 0 && (
                        <div className={cn("mt-1.5 rounded-[5px] bg-[#F4A2611A] px-2.5 py-[5px] text-[#F4A261]", UI.small)}>
                          <b className="mr-1 font-semibold">Tip:</b>
                          {view.tips.join(" ")}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

        
        </div>
      </div>
      </article>

      {/* Always visible: sits under the scrolling body, not inside it. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {view.alternatives > 0 && (
          <ActionBtn onClick={onOpenSwaps} disabled={editLocked} title={editLocked ? editLockedReason : undefined}>
            {view.alternatives} swaps
          </ActionBtn>
        )}
        <ActionBtn primary onClick={onSearchSwap} disabled={editLocked} title={editLocked ? editLockedReason : undefined}>
          Search a swap
        </ActionBtn>
        <ActionBtn onClick={onMakeMeal} disabled={editLocked} title={editLocked ? editLockedReason : undefined}>
          Make my meal
        </ActionBtn>
        <button
          type="button"
          onClick={onDelete}
          disabled={!!f.removed || isRemovedPlaceholder(f) || deleteDisabled}
          title={
            f.removed || isRemovedPlaceholder(f)
              ? "This meal has already been removed"
              : deleteDisabled
                ? deleteDisabledReason
                : undefined
          }
          className="ml-auto px-[11px] py-1 rounded-[4px] text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-normal tracking-[-0.24px] text-[#A1A1A1] cursor-pointer hover:bg-[#E76F511A] hover:text-[#E76F51] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#A1A1A1]"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/** Recipe image when the API provides one, emoji fallback otherwise. */
/**
 * Food picture. With `collage`, a Make-my-meal dish that carries several food
 * pictures shows all of them in a two-column grid (the box keeps its width and
 * grows in height); otherwise the single picture, else the emoji icon.
 */
function FoodThumb({ food: f, className, collage = false }) {
  const [broken, setBroken] = useState(false);
  const [brokenTiles, setBrokenTiles] = useState(() => new Set());
  const tiles = collage ? (f.images || []).filter((u) => u && !brokenTiles.has(u)) : [];

  if (tiles.length > 1) {
    return (
      <div
        className={cn("grid shrink-0 grid-cols-2 gap-0.5 overflow-hidden", className)}
        style={{ height: "auto" }}
        title={`${tiles.length} foods`}
      >
        {tiles.map((src, i) => (
          <img
            key={`${i}-${src}`}
            src={src}
            alt={`${f.name} ${i + 1}`}
            loading="lazy"
            onError={() => setBrokenTiles((prev) => new Set(prev).add(src))}
            className={cn("aspect-square w-full object-cover", tiles.length % 2 === 1 && i === tiles.length - 1 && "col-span-2 aspect-[2/1]")}
          />
        ))}
      </div>
    );
  }

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

// Macro chip colours follow the MacrosUpdate legend: P → protein, C → carbs, F → fats, Fib → fibre.
const CHIP_COLOR = { P: MACRO_COLORS.protein, C: MACRO_COLORS.carbs, F: MACRO_COLORS.fats, Fib: MACRO_COLORS.fibre };

function Chip({ k, v }) {
  const color = CHIP_COLOR[k] || MACRO_COLORS.carbs;
  return (
    <span className={cn(UI.chip, "tabular-nums")} style={{ color, background: `${color}1A` }}>
      <b className="mr-0.5 font-semibold uppercase">{k}</b> {Math.round(v)}g
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
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border border-[#E1E6ED] bg-white text-[#252525] text-[13px] font-semibold cursor-pointer hover:border-[#308BF9] hover:bg-[#EEF4FE] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
    >
      {label}
    </button>
  );
}

function ActionBtn({ children, onClick, primary, disabled = false, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex items-center justify-center px-[11px] py-1.5 rounded-[4px] border text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer transition-colors",
        primary
          ? "border-[#308BF9] bg-[#308BF9] text-white hover:bg-[#2678D9] hover:border-[#2678D9]"
          : "border-[#E1E6ED] bg-white text-[#308BF9] hover:bg-[#EEF4FE]",
        // Approved / locked week: greyed out, no hover, not clickable.
        "disabled:opacity-50 disabled:cursor-not-allowed",
        primary
          ? "disabled:hover:bg-[#308BF9] disabled:hover:border-[#308BF9]"
          : "disabled:hover:bg-white",
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
        <div className="flex-none border-b border-[#E1E6ED] px-5 py-3.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search — chicken, oats, salmon…"
            className={UI.input}
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
            {loading && <span className={cn("ml-auto text-[#738298]", UI.small)}>Searching…</span>}
          </div>
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-hide">
        {emptyText && (
          <li className={cn("px-5 py-8 text-center font-medium", UI.body, error && isSearch ? "text-[#E76F51]" : "text-[#738298]")}>{emptyText}</li>
        )}
        {results.map((r) => (
          <SwapRow key={r.id} r={r} isSearch={isSearch} onPick={() => onPick(r.raw)} />
        ))}
        {hasMore && (
          <li className="border-t border-[#F5F7FA] px-5 py-3 text-center">
            <button type="button" disabled={loadingMore} onClick={() => runSearch(meta.page + 1)} className={UI.btnSecondary}>
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
    <li className="border-t border-[#F5F7FA] px-5 py-3 first:border-t-0 hover:bg-[#F5F7FA] transition-colors">
      <div className="flex items-start gap-3">
        <FoodThumb food={r} className="h-11 w-11 rounded-[10px] border border-[#E1E6ED] bg-[#F5F7FA] text-xl" />
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <p className={UI.foodName}>
            {r.name}
            {/* <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-400">{r.source}</span> */}
            {r.offSlot && (
              <span
                className="ml-1.5 inline-block px-2 py-[3px] rounded-[5px] bg-[#F4A2611A] text-[#F4A261] text-[10px] xl:text-[11px] font-semibold leading-[110%] tracking-[-0.2px] align-middle"
                title="Usually served in a different meal"
              >
                other slot
              </span>
            )}
          </p>
          <small className={cn("block text-[#252525] font-normal tabular-nums", UI.small)}>
            {r.kcal} kcal · P{r.protein_g} C{r.carbs_g} F{r.fat_g}
          </small>
          {isSearch && r.portion ? <small className={cn("block text-[#738298] font-normal", UI.small)}>{r.portion}</small> : null}
          {(r.prep_minutes || r.dayPct != null) && (
            <small className={cn("block text-[#738298] font-normal", UI.small)}>
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
              className={cn("mt-0.5 self-start text-[#308BF9] font-semibold cursor-pointer hover:text-[#2678D9]", UI.small)}
            >
              {showMethod ? "▾ Hide method" : "▸ Method"}
            </button>
          )}
        </div>
        <button onClick={onPick} className={cn("shrink-0", UI.btnPrimary)}>
          {isSearch ? "Add" : "Swap"}
        </button>
      </div>

      {showMethod && hasRecipe && (
        <div className="ml-14 mt-2.5 rounded-[10px] border border-[#E1E6ED] bg-white px-4 py-3">
          {r.ingredients.length > 0 && (
            <>
              <p className={cn("text-[#738298] font-semibold uppercase", UI.small)}>Ingredients</p>
              <ul className={cn("mt-1 list-disc pl-[18px] text-[#252525]", UI.body)}>
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
              <p className={cn("text-[#738298] font-semibold uppercase", UI.small, r.ingredients.length > 0 && "mt-2.5")}>Method</p>
              <ol className={cn("mt-1 list-decimal pl-[18px] text-[#252525]", UI.body)}>
                {r.method_steps.map((step, i) => (
                  <li key={i} className="mb-1">
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}
          {r.tips.length > 0 && (
            <div className={cn("mt-2 rounded-[5px] border-l-2 border-[#F4A261] bg-[#F4A2611A] px-3 py-2 text-[#738298]", UI.small)}>
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

  const heading = cn("px-5 pb-2 pt-4 text-[#738298] font-semibold uppercase", UI.small);
  const note = cn("bg-[#F4A2611A] px-5 py-3 leading-[130%] text-[#535359]", UI.body);

  return (
    <ModalShell title="Measurements" subtitle="what each unit means in this plan" onClose={onClose} widthClass="max-w-[760px]" tall>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-hide">
        <div className={note}>US customary — a cup is 237 ml here, not the 250 ml of a metric cup</div>

        <div className={heading}>Volume and weight</div>
        <ul>
          {weighed.map((u) => (
            <li key={u.key} className={cn("flex items-baseline justify-between border-t border-[#F5F7FA] px-5 py-2.5", UI.body)}>
              <span className="font-semibold text-[#252525]">1 {u.key}</span>
              <span className="tabular-nums text-[#738298]">
                {u.per} {u.unit}
              </span>
            </li>
          ))}
        </ul>

        <div className={heading}>Counted, not weighed</div>
        <div className={cn("px-5 pb-2 text-[#535359]", UI.body)}>{counted.join(" · ")}</div>

        <div className={heading}>Where these come from</div>
        <div className={cn(note, "mb-4")}>
          <div>
            the <code className="rounded-[4px] bg-[#F5F7FA] px-1 text-[11px] xl:text-[12px] text-[#252525]">hash</code> on every FitChef meal restates its ingredients in metric beside the human list; dividing one by the other gives each
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
 *   - nothing matches → "Not in the dish bank." (no AI / free-text add)
 */
function MakeMealDialog({ state, totals, target, slot, defaultDiet = "", zip, onChange, onClose, onSave, saving = false }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]);
  const [meta, setMeta] = useState({ count: 0, bank: 0, inSlot: 0, page: 0, pages: 0 });
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [manual, setManual] = useState(null); // null | { ...EMPTY_MANUAL }
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const trimmed = query.trim();
  // 1-char queries browse the full bank instead of flashing an empty list.
  const effectiveQuery = trimmed.length >= MEAL_SEARCH_MIN ? trimmed : "";
  const fitchefSlot = FITCHEF_SLOT[slot] || "";
  const slotLabel = SLOT_META[slot]?.label || slot || "meal";
  const hasRows = state.rows.length > 0;

  const { byKey: rowPrices, pricing: pricingRows } = useRowPricing(state.rows, zip);
const totalPrice = useMemo(() => {
  const vals = state.rows.map((r) => rowPrices[r.key]?.price).filter((p) => Number.isFinite(p));
  return vals.length ? round2(vals.reduce((s, p) => s + p, 0)) : null;
}, [state.rows, rowPrices]);


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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-hide" onScroll={onListScroll}>
      {/* ------------------------------------------------ name */}
      <div className="flex-none px-5 pt-4">
        <input
          value={state.name}
          onChange={(e) => onChange({ ...state, name: e.target.value })}
          placeholder="Named from what you add — or type your own"
          className={UI.input}
        />
      </div>

      {/* ------------------------------------------------ target / build chart */}
      <div className="flex-none border-b border-[#E1E6ED] px-5 pb-3 pt-4">
        <div className="flex items-center gap-5 rounded-[15px] bg-[#F5F7FA] px-4 py-4">
          <BuilderDonut p={shown.p} c={shown.c} f={shown.f} kcal={chartKcal} />
          <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-4">
            {columns.map((col) => {
              const delta = hasRows && col.target ? gapLabel(col.g, col.target) : null;
              return (
                <div key={col.label} className="min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-[5px]">
                    <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: col.color }} />
                    <p className="text-[#252525] text-[10px] font-semibold capitalize">{col.label}</p>
                  </div>
                  <p className="text-[#252525] text-[15px] font-semibold leading-tight tabular-nums">{Math.round(col.g)}g</p>
                  <p className="text-[#738298] text-[10px] font-normal">{col.pct}% of calories</p>
                  {!hasRows && target ? (
                    <p className="text-[#A1A1A1] text-[10px] font-semibold">to match</p>
                  ) : delta ? (
                    <p className={cn("text-[10px] font-semibold", delta.cls)}>{delta.text}</p>
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
                className={cn("inline-flex items-center gap-1.5", showSuggestions ? UI.btnSecondary : UI.btnPrimary)}
              >
                {showSuggestions ? "✕ Hide suggestions" : "✨ Close the gap for me"}
              </button>
              {showSuggestions && !onTarget && (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className={UI.sectionLabel}>
                      {suggestions.length > 0 ? `${suggestions.length} way${suggestions.length === 1 ? "" : "s"} to close it` : "Nothing closes it"}
                    </span>
                    <button type="button" onClick={() => setShowSuggestions(false)} className="text-[#A1A1A1] hover:text-[#252525] cursor-pointer" title="Hide">
                      ✕
                    </button>
                  </div>
                  {suggestions.length === 0 ? (
                    <p className={cn("mt-2 text-[#738298]", UI.body)}>Nothing in the pool closes this gap on its own.</p>
                  ) : (
                    <div className="mt-2 max-h-[400px] space-y-2 overflow-y-auto pr-1 scroll-hide">
                      {suggestions.map((s) => (
                        <div key={s.row.key} className="flex items-center gap-3 rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5">
                          <ScoreRing score={s.score} />
                          <div className="min-w-0 flex-1 flex flex-col gap-1">
                            <p className={cn("truncate", UI.foodName)}>{s.row.name}</p>
                            <p className={cn("text-[#738298] font-normal", UI.small)}>
                              {s.portionText} · {Math.round(s.kcal)} kcal ·{" "}
                              <span className="font-semibold" style={{ color: MACRO_COLORS.protein }}>+{fmt1(s.p)}P</span>{" "}
                              <span className="font-semibold" style={{ color: MACRO_COLORS.fats }}>+{fmt1(s.f)}F</span>{" "}
                              <span className="font-semibold" style={{ color: MACRO_COLORS.carbs }}>+{fmt1(s.c)}C</span>
                            </p>
                          </div>
                          <button type="button" onClick={() => addSuggestion(s)} className={cn("shrink-0", UI.btnPrimary)}>
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
        <p className={cn("mt-2.5 text-right text-[#738298] font-normal", UI.small)}>
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
                  This one is <b className="font-semibold text-[#252525]">{now} kcal</b>.
                </>
              );
            }
            const was = Math.round(target.kcal);
            const diff = now - was;
            const same = Math.abs(diff) < 10 || Math.abs(diff) / Math.max(was, 1) < 0.02;
            return (
              <>
                {isGap ? "The day still needs " : `The ${slotName} you are replacing was `}
                <b className="font-semibold text-[#252525]">{was} kcal</b>. This one is <b className="font-semibold text-[#252525]">{now}</b> —{" "}
                {same ? (
                  <span className="font-semibold text-[#2A9D8F]">about the same.</span>
                ) : (
                  <span className={cn("font-semibold", diff > 0 ? "text-[#F4A261]" : "text-[#308BF9]")}>
                    {Math.abs(diff)} kcal {diff > 0 ? "too much" : "short"}.
                  </span>
                )}
              </>
            );
          })()}
        </p>
      </div>

      {/* ------------------------------------------------ what is in the meal */}
       <div className="flex-none border-b border-[#E1E6ED] px-5 py-3">
        {hasRows && (
          <div className={cn("mb-1 flex items-center justify-end gap-2", UI.small)}>
            {pricingRows && <span className="text-[#A1A1A1]">pricing…</span>}
            {totalPrice !== null && (
              <span className="font-semibold text-[#252525]">
                {money(totalPrice)}
                <span className="text-[#A1A1A1]">*</span>
              </span>
            )}
          </div>
        )}
        {!hasRows ? (
          <p className={cn("text-[#A1A1A1]", UI.body)}>Nothing added yet.</p>
        ) : (
          <div className="max-h-44 space-y-1 overflow-y-auto pr-1 scroll-hide">
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
                <div key={r.key} className="flex items-center gap-3 py-2 border-b border-[#F5F7FA] last:border-b-0">
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <p className={cn("truncate", UI.foodName)}>{r.name}</p>
                    <p
                      className={cn("text-[#738298] font-normal", UI.small)}
                      title={`${Math.round(r.kcal * r.qty)} kcal · P${Math.round(r.p * r.qty)} C${Math.round(r.c * r.qty)} F${Math.round(r.f * r.qty)}`}
                    >
                      {portionText}
                    </p>
                    {contains.length > 0 && (
                      <p className={cn("truncate text-[#A1A1A1] font-semibold", UI.small)}>
                        {contains.map((i) => `${fmtQty(num(i.qty) * r.qty)} ${pluralUnit(i.unit, num(i.qty) * r.qty)} ${i.name}`.replace(/\s+/g, " ").trim()).join(", ")}
                      </p>
                    )}
                  </div>

                  <PriceTag
                    price={rowPrices[r.key]?.price ?? null}
                    approx={rowPrices[r.key]?.approx}
                    note={rowPrices[r.key]?.note}
                    className={cn("shrink-0", UI.body)}
                  />
                  <StepBtn label="−" title={atMin ? "Remove" : "Less"} onClick={() => (atMin ? removeRow(r.key) : setQty(r.key, r.qty - 0.25))} />
                  <StepBtn label="+" title="More" disabled={r.qty + 0.25 > 20} onClick={() => setQty(r.key, r.qty + 0.25)} />
                </div>
              );
            })}
          </div>
        )}
        <p className={cn("mt-2.5 text-[#535359]", UI.body)}>
          This meal <b className="font-semibold text-[#252525]">{fmt1(totals.p)}</b>g protein · <b className="font-semibold text-[#252525]">{fmt1(totals.c)}</b>g carbs ·{" "}
          <b className="font-semibold text-[#252525]">{fmt1(totals.f)}</b>g fat · {Math.round(totals.kcal)} kcal
        </p>
      </div>

      {/* ------------------------------------------------ add a food */}
      <div className="flex-none px-5 pt-4 pb-3">
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setManual(null);
            }}
            onKeyDown={onKeyDown}
            placeholder="Add a food — chicken, rice, oats…"
            className={UI.input}
          />
          {searching && <span className={cn("absolute right-3 top-3 text-[#A1A1A1]", UI.small)}>Searching…</span>}
        </div>

        {searchError && <p className={cn("mt-2 text-[#E76F51]", UI.small)}>{searchError}</p>}

        {/* nothing in the bank → just say so; only dish-bank foods can be added */}
        {showNoHits && (
          <div className="mt-2 rounded-[10px] border border-dashed border-[#E1E6ED] bg-[#F5F7FA] px-3 py-3 text-center">
            <p className={cn("text-[#738298]", UI.small)}>Not in the dish bank.</p>
          </div>
        )}

        {manual && (
          <div className="mt-2 rounded-[10px] border border-[#E1E6ED] p-3">
            <p className={cn("mb-2 text-[#252525] font-semibold", UI.small)}>Manual entry — values for one portion</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={manual.food_name}
                onChange={(e) => setManual({ ...manual, food_name: e.target.value })}
                placeholder="Food name"
                className={cn(UI.input, "px-2 py-1.5")}
              />
              <input
                value={manual.portion_with_metric}
                onChange={(e) => setManual({ ...manual, portion_with_metric: e.target.value })}
                placeholder="Portion — e.g. 1 cup (240 g)"
                className={cn(UI.input, "px-2 py-1.5")}
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
                <label key={k} className="text-[10px] font-semibold uppercase text-[#738298]">
                  {label}
                  <input
                    type="number"
                    step="any"
                    value={manual[k]}
                    onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
                    className={cn(UI.input, "mt-0.5 px-2 py-1.5 tabular-nums")}
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setManual(null)} className={UI.btnSecondary}>
                Cancel
              </button>
              <button onClick={addManual} disabled={!manual.food_name.trim()} className={UI.btnPrimary}>
                Add to meal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ dish bank */}
      <div className={cn("flex-none border-y border-[#E1E6ED] bg-[#F5F7FA] px-5 py-2", UI.sectionLabel)}>
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
              <div className={cn("border-b border-[#E1E6ED] bg-[#F5F7FA] px-5 py-1.5", UI.sectionLabel)}>
                Usually served at other meals
              </div>
            )}
            <div className="flex items-start gap-3 border-b border-[#F5F7FA] px-5 py-3 hover:bg-[#F5F7FA] transition-colors">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#E1E6ED] bg-[#F5F7FA]">
                {row.image ? <img src={row.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <p className={UI.foodName}>{row.name}</p>
                <p className={cn("text-[#738298] font-normal", UI.small)}>
                  {row.fitted ? (
                    <>
                      {row.baseText} → <b className="font-semibold text-[#252525]">{row.portion}</b> here
                    </>
                  ) : (
                    row.portion
                  )}
                  {" · "}
                  <b className="font-semibold text-[#252525]">{fmt1(row.p)}</b>P <b className="font-semibold text-[#252525]">{fmt1(row.c)}</b>C{" "}
                  <b className="font-semibold text-[#252525]">{fmt1(row.f)}</b>F · {Math.round(row.kcal)} kcal
                  {row.gi !== null ? ` · GI ${row.gi}` : ""}
                  {row.diet ? ` · ${row.diet}` : ""}
                </p>
                {row.contains.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {row.contains.map((ing, j) => (
                      <span key={j} className={cn("rounded-[5px] bg-[#F5F7FA] border border-[#E1E6ED] px-2 py-[3px] text-[#738298] font-normal", UI.small)}>
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
                className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[#E1E6ED] bg-white text-[16px] leading-none text-[#308BF9] cursor-pointer hover:bg-[#EEF4FE] hover:border-[#308BF9] transition-colors"
              >
                +
              </button>
            </div>
          </div>
        ))}
        {!searching && fitted.length === 0 && !showNoHits && !searchError && (
          <p className={cn("px-5 py-8 text-center text-[#738298] font-medium", UI.body)}>No dishes to show.</p>
        )}
        {searching && fitted.length > 0 && <p className={cn("px-5 py-3 text-center text-[#A1A1A1]", UI.small)}>Loading more…</p>}
        {!searching && hasMore && (
          <div className="px-5 py-3 text-center">
            <button onClick={() => fetchPage(meta.page + 1, true)} className={cn("text-[#308BF9] font-semibold cursor-pointer hover:underline", UI.small)}>
              Load more
            </button>
          </div>
        )}
      </div>

      </div>

      {/* ------------------------------------------------ save */}
      <div className="flex-none border-t border-[#E1E6ED] px-5 py-3">
        <button onClick={onSave} disabled={!hasRows || saving} className={cn(UI.btnPrimary, "w-full py-2.5 text-[13px] xl:text-[14px] 2xl:text-[15px]")}>
          {saving ? "Saving…" : "Save into the plan"}
        </button>
      </div>
    </ModalShell>
  );
}

/** 0–100 "how much of the gap this closes" ring for a suggestion: green ≥ 90, blue ≥ 75, amber below. */
function ScoreRing({ score }) {
  const s = Math.max(0, Math.min(100, num(score)));
  const color = s >= 90 ? "#2A9D8F" : s >= 75 ? "#308BF9" : "#F4A261";
  const R = 15;
  const CIRC = 2 * Math.PI * R;
  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={R} fill="transparent" stroke="#E1E6ED" strokeWidth="3" />
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
    <div className="relative h-[100px] w-[100px] shrink-0">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
        <circle cx="42" cy="42" r={R} fill="transparent" stroke="#E1E6ED" strokeWidth="8" />
        {segs.map((s) => (
          <circle key={s.key} cx="42" cy="42" r={R} fill="transparent" stroke={s.color} strokeWidth="8" strokeDasharray={s.dash} strokeDashoffset={s.dashOffset} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col gap-[2px] items-center justify-center leading-none pointer-events-none">
        <span className="text-[#535359] text-[9px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">Calories</span>
        <span className="text-[#252525] text-[20px] font-normal leading-none tracking-[-0.4px] tabular-nums">{Math.round(num(kcal))}</span>
        <span className="text-[#535359] text-[9px] font-normal leading-[110%] tracking-[-0.2px]">Kcal</span>
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
    return <span className={cn("text-[#A1A1A1]", className)} title="Could not be priced">—</span>;
  }
  return (
    <span className={cn("tabular-nums font-semibold text-[#252525]", className)} title={note || undefined}>
      {text}
      {approx ? <span className="text-[#A1A1A1]">*</span> : null}
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
    <section className="border-t border-[#E1E6ED]">
      <div className="flex items-baseline gap-2 px-4 pt-2.5 pb-1">
        <span className={cn("shrink-0", UI.sectionLabel)}>{SLOT_META[m.slot]?.label || m.slot}</span>
        <span className={cn("min-w-0 flex-1 break-words leading-[150%] text-[#738298]", UI.small)}>{m.title}</span>
        {m.minutes ? <span className={cn("shrink-0 text-[#A1A1A1]", UI.small)}>{m.minutes} min</span> : null}
      </div>
      <ul className="divide-y divide-[#F5F7FA]">
        {m.items.map((it, i) => (
          <li key={`${i}-${it.name}`} className={cn("flex items-center gap-4 px-4 py-2.5", UI.body)}>
            <span className="w-[150px] shrink-0 font-semibold tabular-nums text-[#252525]">{it.text}</span>
            <span className="min-w-0 flex-1 break-words text-[#535359]">{it.name}</span>
            <PriceTag price={it.price} approx={it.approx} note={it.priceNote} className={cn("shrink-0", UI.body)} />
          </li>
        ))}
      </ul>
      {steps.length > 0 && (
        <div className="px-4 pb-3 pt-1">
          <button type="button" onClick={() => setOpen((v) => !v)} className={cn("text-[#308BF9] font-semibold cursor-pointer hover:text-[#2678D9]", UI.small)}>
            {open ? "▾" : "▸"} Method · {steps.length} step{steps.length === 1 ? "" : "s"}
          </button>
          {open && (
            <div className="mt-2 rounded-[10px] border border-[#E1E6ED] bg-[#F5F7FA] px-4 py-3">
              <ol className={cn("list-decimal pl-[18px] text-[#252525]", UI.body)}>
                {steps.map((s, i) => (
                  <li key={i} className="mb-1">
                    {s}
                  </li>
                ))}
              </ol>
              {m.tip && <div className={cn("mt-2 rounded-[5px] border-l-2 border-[#F4A261] bg-white px-3 py-2 text-[#738298]", UI.small)}>{m.tip}</div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ShoppingListDialog({ shopping, fallbackItems = [], dirty = false, pricing = false, loading = false, onClose }) {
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

  const subtitle = loading
    ? "Fetching prices for the plan as it is on screen…"
    : hasApiList
      ? `${week.itemCount} item${week.itemCount === 1 ? "" : "s"}${week.days ? ` · ${week.days} days` : ""}`
      : "Aggregated across the whole plan";

  return (
    <ModalShell title="Shopping list" subtitle={subtitle} onClose={onClose} widthClass="max-w-[600px]">
      {hasApiList && (
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <div className="border border-[#E1E6ED] rounded-[10px] flex overflow-hidden">
            <div
              onClick={() => setView("week")}
              className={cn("px-4 py-2.5 cursor-pointer transition-colors", view === "week" ? "bg-[#308BF9]" : "bg-white hover:bg-[#F5F7FA]")}
            >
              <p className={cn("text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-[110%] tracking-[-0.24px]", view === "week" ? "text-white" : "text-[#A1A1A1]")}>
                By aisle
              </p>
            </div>
            {hasByDay && (
              <div
                onClick={() => setView("day")}
                className={cn("px-4 py-2.5 cursor-pointer transition-colors", view === "day" ? "bg-[#308BF9]" : "bg-white hover:bg-[#F5F7FA]")}
              >
                <p className={cn("text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-[110%] tracking-[-0.24px]", view === "day" ? "text-white" : "text-[#A1A1A1]")}>
                  By day
                </p>
              </div>
            )}
          </div>
          {pricing && (
            <span
              className="ml-auto px-2.5 py-[5px] rounded-[5px] bg-[#308BF91A] text-[#308BF9] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]"
              title="Fetching shelf prices for the plan as it is on screen."
            >
              Pricing…
            </span>
          )}
          {!pricing && dirty && (
            <span
              className="ml-auto px-2.5 py-[5px] rounded-[5px] bg-[#F4A2611A] text-[#F4A261] text-[10px] xl:text-[11px] 2xl:text-[12px] font-semibold leading-[110%] tracking-[-0.2px]"
              title="This list is generated from the saved plan. Save to refresh it."
            >
              Reflects saved plan
            </span>
          )}
        </div>
      )}

      {/* By-day segmented day picker. Lives outside the scrolling body below so
          it stays pinned while the day's items scroll underneath it. */}
      {hasApiList && view === "day" && selectedDay && (
        <div className="px-5 pt-2 pb-3 shrink-0">
          <div className="border border-[#E1E6ED] rounded-[10px] flex overflow-hidden">
            {shopping.byDay.map((d) => {
              const isActive = d.day === selectedDay.day;
              return (
                <div
                  key={d.day}
                  onClick={() => setDayNo(d.day)}
                  className={cn("flex-1 px-4 py-2.5 text-center cursor-pointer transition-colors", isActive ? "bg-[#308BF9]" : "bg-white hover:bg-[#F5F7FA]")}
                >
                  <p className={cn("text-[12px] xl:text-[13px] 2xl:text-[14px] font-semibold leading-[110%] tracking-[-0.24px]", isActive ? "text-white" : "text-[#A1A1A1]")}>
                    D{d.day}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-h-[440px] overflow-y-auto scroll-hide">
        {/* ------------------------------------------------- loading */}
        {loading && (
          <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-[#738298] font-medium", UI.body)}>
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#E1E6ED] border-t-[#308BF9]" aria-hidden="true" />
            <span>Building your shopping list…</span>
          </div>
        )}

        {/* ---------------------------------------------- local fallback */}
        {!loading && !hasApiList && (
          <ul className="divide-y divide-[#F5F7FA] px-5">
            {fallbackItems.length === 0 && <li className={cn("py-8 text-center text-[#738298] font-medium", UI.body)}>No ingredients yet.</li>}
            {fallbackItems.map((it, i) => (
              <li key={`${i}-${it.name}-${it.unit}`} className={cn("flex items-center justify-between py-2.5", UI.body)}>
                <span className="text-[#252525]">{it.name}</span>
                <span className="tabular-nums font-semibold text-[#738298]">
                  {it.qty} {it.unit}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* ------------------------------------------------- week / aisles */}
        {hasApiList && view === "week" && (
          <div className="px-5 pb-4 pt-2">
            <div className="flex items-center justify-between rounded-[15px] bg-[#F5F7FA] px-5 py-4">
              <span className={cn("text-[#738298] font-semibold uppercase", UI.small)}>Estimated total</span>
              <span className="flex items-baseline gap-2">
                <span className="text-[#252525] text-[22px] xl:text-[24px] font-semibold tracking-[-0.48px] tabular-nums">
                  {week.total !== null ? money(week.total) : "—"}
                  {week.total !== null && <span className="text-[#A1A1A1]">*</span>}
                </span>
                {week.unpriced > 0 && (
                  <span className={cn("text-[#738298]", UI.small)}>
                    {week.total === null ? "not priced yet" : `${week.unpriced} item${week.unpriced === 1 ? "" : "s"} not priced`}
                  </span>
                )}
              </span>
            </div>

            <div className="mt-3 divide-y divide-[#E1E6ED] rounded-[15px] border border-[#E1E6ED] overflow-hidden">
              {week.aisles.map((a) => (
                <section key={a.aisle}>
                  <div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
                    <span className="text-base leading-none">{aisleIcon(a.aisle)}</span>
                    <span className={cn("text-[#252525] font-semibold", UI.body)}>{a.aisle}</span>
                    <span className={cn("ml-auto rounded-[5px] bg-[#F5F7FA] px-2 py-[3px] font-semibold tabular-nums text-[#738298]", UI.small)}>{a.items.length}</span>
                  </div>
                  <ul className="divide-y divide-[#F5F7FA]">
                    {a.items.map((it, i) => {
                      const hint = [it.days.length > 0 ? `Days ${it.days.join(", ")}` : null, it.meals ? `${it.meals} meal${it.meals === 1 ? "" : "s"}` : null]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={`${i}-${it.name}`} className={cn("flex items-center gap-4 px-4 py-2.5", UI.body)} title={hint || undefined}>
                          <span className="w-[150px] shrink-0 font-semibold tabular-nums text-[#252525]">{it.text}</span>
                          <span className="min-w-0 flex-1 break-words text-[#535359]">{it.name}</span>
                          <PriceTag price={it.price} approx={it.approx} note={it.priceNote} className={cn("shrink-0", UI.body)} />
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
          <div className="px-5 pb-4">
            {/* segmented day picker is rendered above the scroll body (pinned) */}
            <div className="rounded-[15px] border border-[#E1E6ED] overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                <span className="text-base leading-none">📅</span>
                <span className={cn("text-[#252525] font-semibold", UI.body)}>Day {selectedDay.day}</span>
                <span
                  className={cn("ml-auto rounded-[5px] bg-[#F5F7FA] px-2 py-[3px] font-semibold tabular-nums text-[#738298]", UI.small)}
                  title={dayTotal > 0 ? `Day total ${money(dayTotal)}*` : undefined}
                >
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

      <div className="border-t border-[#E1E6ED] px-5 py-3.5">
        {hasApiList && (week.priced > 0 && week.unpriced ? true : Boolean(week.disclaimer)) && (
          <p className={cn("mb-3 leading-snug text-[#A1A1A1]", UI.small)}>
            {week.priced > 0 && week.unpriced ? `${week.priced} priced, ${week.unpriced} unpriced. ` : ""}
            {week.disclaimer}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={copyList} disabled={loading} className={cn(UI.btnSecondary, "py-2.5")}>
            {copied ? "Copied" : "Copy as text"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!printShoppingList(listText())) copyList();
            }}
            disabled={loading}
            className={cn(UI.btnPrimary, "py-2.5")}
          >
            Print
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================ ConfirmPopup */

/**
 * Small destructive-action confirmation, styled like
 * pop-folder/discard-confirmation-popup.jsx so it matches the rest of the app.
 */
/**
 * `tone` picks the confirm button colour: "danger" (red, default — reset /
 * delete) or "primary" (blue — approve).
 */
function ConfirmPopup({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "danger", onClose, onConfirm }) {
  const confirmClass =
    tone === "primary"
      ? "px-4 py-2 rounded-[6px] bg-[#308BF9] text-white text-[12px] font-semibold cursor-pointer hover:bg-[#2677DB] transition-colors"
      : "px-4 py-2 rounded-[6px] bg-[#E76F51] text-white text-[12px] font-semibold cursor-pointer hover:bg-[#D65F42] transition-colors";
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-[360px] rounded-[16px] bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#252525] text-[16px] font-semibold leading-normal tracking-[-0.32px]">{title}</h2>

        <p className="mt-2 text-[#738298] text-[13px] font-normal leading-[150%] tracking-[-0.26px]">{message}</p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] border border-[#E1E6ED] bg-white text-[#535359] text-[12px] font-semibold cursor-pointer hover:bg-[#F5F7FA] transition-colors"
          >
            {cancelLabel}
          </button>

          <button type="button" onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ ModalShell */

function ModalShell({ title, subtitle, onClose, widthClass, tall = false, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/50 p-5" onClick={onClose}>
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-[15px] border border-[#E1E6ED] bg-white shadow-[0px_4px_10px_rgba(0,0,0,0.12)]",
          tall ? "h-[92vh] max-h-[92vh]" : "max-h-[92vh]",
          widthClass,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none items-start gap-3 border-b border-[#E1E6ED] px-5 py-4">
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <p className={UI.title}>{title}</p>
            {subtitle && <p className={UI.subtitle}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 px-1 text-2xl leading-none text-[#A1A1A1] cursor-pointer hover:text-[#252525] transition-colors">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}






