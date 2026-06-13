import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Preference learning logger — Chandan's hosted Flask app from Ankur's zip.
// Falls back to a local JSONL file if the hosted endpoint is unreachable
// (offline dev, network blips, etc.).
const LOG_PLAN_EDIT_URL = process.env.LOG_PLAN_EDIT_URL || "https://respyr.in/foods-plan-api/log_plan_edit";
const MEAL_SLOTS = ["breakfast", "lunch", "snacks", "dinner"];

function foodKey(food) {
  return String(food?.food_name || "").trim().toLowerCase();
}

function foodMacros(food) {
  return {
    calories: Number(food?.calories || 0),
    protein_g: Number(food?.protein_g || 0),
    carbs_g: Number(food?.carbs_g || 0),
    fat_g: Number(food?.fat_g || 0),
    fiber_g: Number(food?.fiber_g || 0),
  };
}

function foodsInMeal(meal) {
  return meal?.foods || [];
}

function diffMeal(recMeal, finMeal, dayLabel, slot) {
  const recFoods = foodsInMeal(recMeal);
  const finFoods = foodsInMeal(finMeal);
  const recByKey = Object.fromEntries(recFoods.map((f) => [foodKey(f), f]));
  const finByKey = Object.fromEntries(finFoods.map((f) => [foodKey(f), f]));

  const recKeys = new Set(Object.keys(recByKey));
  const finKeys = new Set(Object.keys(finByKey));
  const removedKeys = [...recKeys].filter((k) => !finKeys.has(k));
  const addedKeys = [...finKeys].filter((k) => !recKeys.has(k));
  const keptKeys = [...recKeys].filter((k) => finKeys.has(k));

  const removed = removedKeys.sort().map((k) => ({
    food_name: recByKey[k].food_name,
    portion_with_metric: recByKey[k].portion_with_metric || "",
    category: recByKey[k].category || "",
    macros: foodMacros(recByKey[k]),
  }));
  const added = addedKeys.sort().map((k) => ({
    food_name: finByKey[k].food_name,
    portion_with_metric: finByKey[k].portion_with_metric || "",
    category: finByKey[k].category || "",
    macros: foodMacros(finByKey[k]),
  }));

  const keptModified = [];
  for (const k of keptKeys.sort()) {
    const r = recByKey[k];
    const f = finByKey[k];
    const rm = foodMacros(r);
    const fm = foodMacros(f);
    const macroDelta = {};
    let modified = false;
    for (const mk of Object.keys(rm)) {
      const rv = rm[mk];
      const fv = fm[mk];
      if (rv === 0 && fv === 0) continue;
      const denom = Math.max(Math.abs(rv), 1e-6);
      const pct = (fv - rv) / denom;
      if (Math.abs(pct) > 0.05) {
        modified = true;
        macroDelta[mk] = { from: rv, to: fv, pct_change: parseFloat(pct.toFixed(4)) };
      }
    }
    const portionChanged = String(r.portion_with_metric || "").trim() !== String(f.portion_with_metric || "").trim();
    if (portionChanged) modified = true;
    if (modified) {
      keptModified.push({
        food_name: r.food_name,
        portion_from: r.portion_with_metric || "",
        portion_to: f.portion_with_metric || "",
        macro_delta: macroDelta,
      });
    }
  }

  return { day: dayLabel, slot, removed, added, kept_modified: keptModified };
}

function computePlanDiff(recDays, finDays) {
  const mealDiffs = [];
  const max = Math.max(recDays.length, finDays.length);
  for (let idx = 0; idx < max; idx++) {
    const recDay = recDays[idx] || {};
    const finDay = finDays[idx] || {};
    const dayLabel = finDay.day || recDay.day || finDay.day_code || recDay.day_code || `day_${idx + 1}`;
    for (const slot of MEAL_SLOTS) {
      const md = diffMeal(recDay[slot], finDay[slot], String(dayLabel), slot);
      if (md.removed.length || md.added.length || md.kept_modified.length) mealDiffs.push(md);
    }
  }

  const structural = [];
  for (let idx = 0; idx < max; idx++) {
    const recDay = recDays[idx] || {};
    const finDay = finDays[idx] || {};
    const recCount = MEAL_SLOTS.reduce((acc, s) => acc + foodsInMeal(recDay[s]).length, 0);
    const finCount = MEAL_SLOTS.reduce((acc, s) => acc + foodsInMeal(finDay[s]).length, 0);
    if (recCount !== finCount) {
      structural.push({
        day_index: idx,
        day_label: String(finDay.day || recDay.day || `day_${idx + 1}`),
        food_count_from: recCount,
        food_count_to: finCount,
      });
    }
  }

  return {
    meal_diffs: mealDiffs,
    structural_changes: structural,
    summary: {
      meals_changed: mealDiffs.length,
      foods_removed: mealDiffs.reduce((a, m) => a + m.removed.length, 0),
      foods_added: mealDiffs.reduce((a, m) => a + m.added.length, 0),
      foods_kept_modified: mealDiffs.reduce((a, m) => a + m.kept_modified.length, 0),
      days_with_structural_change: structural.length,
    },
  };
}

async function tryRemoteLog(body) {
  try {
    const res = await fetch(LOG_PLAN_EDIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok || data?.status === "success" || data?.event_id || data?.event) return data;
    }
  } catch {
    // remote unreachable — fall through to local storage
  }
  return null;
}

function persistLocally(event) {
  try {
    const dir = path.join(process.cwd(), "preference_data", "edits");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${event.user_id || "unknown"}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(event) + "\n", "utf-8");
    return file;
  } catch (e) {
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { user_id, recommended, final, source, meta } = body;

    if (!Array.isArray(recommended) || !Array.isArray(final)) {
      return NextResponse.json({ error: "recommended and final must be arrays of days" }, { status: 400 });
    }

    const diff = computePlanDiff(recommended, final);

    const event = {
      event_id: crypto.randomUUID(),
      user_id: String(user_id || "unknown"),
      ts_utc: new Date().toISOString(),
      ts_epoch: Date.now() / 1000,
      source: String(source || "trainer").toLowerCase(),
      meta: meta || {},
      diff,
      recommended,
      final,
    };

    const remoteResult = await tryRemoteLog({
      user_id: event.user_id,
      recommended,
      final,
      source: event.source,
      meta: event.meta,
    });

    const localFile = remoteResult ? null : persistLocally(event);
    const remoteStoredAt = remoteResult?.event?.stored_at || remoteResult?.stored_at || null;

    return NextResponse.json({
      event_id: remoteResult?.event?.event_id || event.event_id,
      user_id: event.user_id,
      ts_utc: event.ts_utc,
      source: event.source,
      diff_summary: diff.summary,
      stored_via: remoteResult ? "remote" : localFile ? "local" : "none",
      stored_at: remoteStoredAt || localFile || null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
