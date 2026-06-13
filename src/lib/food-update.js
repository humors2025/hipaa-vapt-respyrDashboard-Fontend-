// Helpers from Chandan's backend spec — kept in lockstep with PHP contract.

export function getDayFromFoodJson(foodJson, dayCode) {
  if (!foodJson?.days || !Array.isArray(foodJson.days)) return null;
  return foodJson.days.find((day) => day.day_code === dayCode) || null;
}

export function getMealFoods(foodJson, dayCode, mealType) {
  const day = getDayFromFoodJson(foodJson, dayCode);
  if (!day) return [];
  return day?.[mealType]?.foods || [];
}

export function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function extractMetricValue(portionText) {
  const match = String(portionText || "").match(/^([\d.]+)\s*([a-zA-Z]+)/);
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2] };
}

export function buildFoodWithNewQuantity(food, newQuantity, labelText = "") {
  const oldMetric = extractMetricValue(food?.portion_with_metric);
  if (!oldMetric || !oldMetric.value || oldMetric.value <= 0) {
    throw new Error("Old quantity could not be detected from portion_with_metric");
  }
  const quantity = Number(newQuantity);
  if (!quantity || quantity <= 0) throw new Error("Quantity must be greater than 0");

  const factor = quantity / oldMetric.value;
  return {
    ...food,
    calories: round2(Number(food.calories || 0) * factor),
    carbs_g: round2(Number(food.carbs_g || 0) * factor),
    protein_g: round2(Number(food.protein_g || 0) * factor),
    fat_g: round2(Number(food.fat_g || 0) * factor),
    fiber_g: round2(Number(food.fiber_g || 0) * factor),
    portion_with_metric: `${quantity} ${oldMetric.unit}${labelText ? ` (${labelText})` : ""}`,
  };
}

function selectedWeekIdentity(selectedWeek) {
  return {
    id: Number(selectedWeek.id),
    dietitian_id: selectedWeek.dietitian_id || selectedWeek.dietician_id,
    profile_id: selectedWeek.profile_id,
    week_start_date: selectedWeek.week_start_date,
    week_end_date: selectedWeek.week_end_date,
  };
}

function foodFields(food) {
  return {
    food_name: food.food_name,
    portion_with_metric: food.portion_with_metric,
    category: food.category,
    calories: Number(food.calories),
    carbs_g: Number(food.carbs_g),
    protein_g: Number(food.protein_g),
    fat_g: Number(food.fat_g),
    fiber_g: Number(food.fiber_g),
  };
}

export function buildUpdatePayload({ selectedWeek, dayCode, mealType, foodIndex, food }) {
  return {
    action: "update",
    ...selectedWeekIdentity(selectedWeek),
    day_code: dayCode,
    meal_type: mealType,
    food_index: Number(foodIndex),
    food: foodFields(food),
  };
}

export function buildAddPayload({ selectedWeek, dayCode, mealType, food }) {
  return {
    action: "add",
    ...selectedWeekIdentity(selectedWeek),
    day_code: dayCode,
    meal_type: mealType,
    food: foodFields(food),
  };
}

export function buildDeletePayload({ selectedWeek, dayCode, mealType, foodIndex }) {
  return {
    action: "delete",
    ...selectedWeekIdentity(selectedWeek),
    day_code: dayCode,
    meal_type: mealType,
    food_index: Number(foodIndex),
  };
}
