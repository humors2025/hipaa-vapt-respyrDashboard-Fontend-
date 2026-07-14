"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchFoodService } from "../../services/authService";

// Approximate grams (or ml, ~1g/ml) for one of each household unit. Tune these
// to match your nutrition standards. "piece" has no fixed weight — it falls back
// to the food's own per-unit grams.
const UNIT_GRAMS = {
  g: 1,
  gram: 1,
  ml: 1,
  liter: 1000,
  floz: 30,
  oz: 28.35,
  glass: 250,
  cup: 200,
  bowl: 200,
  katori: 150,
  plate: 300,
  tablespoon: 15,
  teaspoon: 5,
};

// Units expressed as a continuous weight/volume ("150 ml") rather than a count
// of servings ("½ katori (100 g)").
const CONTINUOUS_UNITS = ["g", "gram", "ml", "oz", "floz", "liter", "kg", "l"];

// Liquid foods get the ml/glass/cup unit set; everything else gets bowl/katori/…
const LIQUID_UNITS = ["ml", "glass", "liter", "floz", "l"];

// Words in the food name or portion label that mark it as a liquid/beverage.
// Used as a fallback when the food data doesn't carry an explicit category and
// isn't already measured in a liquid unit.
const LIQUID_KEYWORDS =
  /\bml\b|milliliter|\blitre\b|\bliter\b|\bglass\b|smoothie|juice|shake|drink|lassi|milk|water|tea|coffee|soup|beverage/i;

// Pretty fraction labels for the amounts used in the dropdown.
const FRACTION_LABELS = {
  1: "1",
  0.75: "¾",
  0.6667: "⅔",
  0.5: "½",
  0.3333: "⅓",
  0.25: "¼",
};
function fractionLabel(n) {
  if (FRACTION_LABELS[n]) return FRACTION_LABELS[n];
  return Number.isInteger(n) ? String(n) : String(parseFloat(Number(n).toFixed(2)));
}

function parseGramsFromLabel(label) {
  if (!label) return null;
  const m = label.match(/\((\d+(?:\.\d+)?)\s*g\)/i);
  return m ? parseFloat(m[1]) : null;
}

function parseBaseLabelFromMetric(label) {
  if (!label) return "";
  let s = String(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
  s = s.replace(/^\s*\d+(?:\.\d+)?\s+/, "").trim();
  return s;
}

function formatPortion(baseLabel, unitGrams, portion) {
  const continuous = ["g", "ml", "oz", "kg", "l"];
  const word = parseBaseLabelFromMetric(baseLabel);
  const isContinuous = !word || continuous.includes(word.toLowerCase());

  if (isContinuous) {
    const unit = word || "g";
    if (Math.abs(portion - Math.round(portion)) < 0.05) {
      return `${Math.round(portion)} ${unit}`;
    }
    return `${parseFloat(portion.toFixed(1))} ${unit}`;
  }

  const isWhole = Math.abs(portion - Math.round(portion)) < 0.05;
  const nStr = isWhole ? String(Math.round(portion)) : String(parseFloat(portion.toFixed(1)));
  const n = isWhole ? Math.round(portion) : parseFloat(portion.toFixed(1));

  let displayWord = word;
  if (n !== 1 && displayWord && !displayWord.toLowerCase().endsWith("s") && displayWord.length > 1) {
    displayWord = displayWord + "s";
  }

  let label = displayWord ? `${nStr} ${displayWord}`.trim() : nStr;
  if (unitGrams > 0) {
    const totalG = portion * unitGrams;
    const gStr = Math.abs(totalG - Math.round(totalG)) < 0.05
      ? String(Math.round(totalG))
      : String(parseFloat(totalG.toFixed(1)));
    label = `${label} (${gStr} g)`;
  }
  return label;
}

// Label for a portion chosen via the unit dropdown, e.g. "150 ml" for a
// continuous unit or "½ katori (100 g)" for a count unit.
function buildUnitLabel(qty, unit, grams) {
  const roundedG = Math.round(grams);
  if (CONTINUOUS_UNITS.includes(unit)) {
    const display = unit === "gram" ? "g" : unit === "floz" ? "fl oz" : unit;
    return `${roundedG} ${display}`;
  }
  let word = unit;
  if (qty !== 1 && !word.endsWith("s")) word = `${word}s`;
  return `${fractionLabel(qty)} ${word} (${roundedG} g)`;
}

export default function FoodEditPanel({ food, onSave, onChange, onRemove, onCancel, dietType = "", country = "" }) {
  const initialQty = parseFloat(food.portion) || parseFloat(food.base_portion) || 1;
  const initialUnitGrams = food.unit_grams || parseGramsFromLabel(food.portion_with_metric) || 100;
  const initialUnit = parseBaseLabelFromMetric(food.portion_with_metric) || "g";

  const [portionQty, setPortionQty] = useState(initialQty);
  const [unit, setUnit] = useState(initialUnit);
  const [portionGrams, setPortionGrams] = useState(Math.round(initialUnitGrams * initialQty));
  const [macros, setMacros] = useState({
    calories: food.calories || 0,
    protein_g: food.protein_g || 0,
    carbs_g: food.carbs_g || 0,
    fat_g: food.fat_g || 0,
    fiber_g: food.fiber_g || 0,
    portion_with_metric: food.portion_with_metric || "",
  });

  const baseMacrosRef = useRef({
    calories: food.calories || 0,
    protein_g: food.protein_g || 0,
    carbs_g: food.carbs_g || 0,
    fat_g: food.fat_g || 0,
    fiber_g: food.fiber_g || 0,
    base_portion: initialQty,
    unit_grams: initialUnitGrams,
    base_label: food.portion_with_metric || "",
  });

  const abortRef = useRef(null);

  // Food name is always an editable input that also searches
  const [foodNameInput, setFoodNameInput] = useState(food.food_name || "");
  const [selectedFood, setSelectedFood] = useState(food.food_name || "");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const nameInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Keep the latest props in refs so the live-update effect can read them
  // without re-firing when the parent re-renders us with a new `food` object.
  const foodRef = useRef(food);
  foodRef.current = food;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Build the food payload from current local state. Shared by live updates
  // (onChange) and the final save (onSave) so they never drift apart.
  const buildUpdatedFood = useCallback(() => ({
    ...foodRef.current,
    food_name: selectedFood,
    calories: macros.calories,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    fiber_g: macros.fiber_g,
    portion: portionQty,
    base_portion: baseMacrosRef.current.base_portion,
    unit_grams: baseMacrosRef.current.unit_grams,
    portion_with_metric: macros.portion_with_metric,
  }), [selectedFood, macros, portionQty]);

  // Push edits to the parent in real time so meal/day macro totals update
  // as the trainer changes calories, portion or any macro — without waiting
  // for "Done". Skip the initial mount so we don't fire a no-op update.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onChangeRef.current?.(buildUpdatedFood());
  }, [buildUpdatedFood]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          nameInputRef.current && !nameInputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const scaleMacrosByRatio = useCallback((ratio, newPortion) => {
    const base = baseMacrosRef.current;
    setMacros((prev) => ({
      ...prev,
      calories: Math.round(base.calories * ratio),
      protein_g: parseFloat((base.protein_g * ratio).toFixed(1)),
      carbs_g: parseFloat((base.carbs_g * ratio).toFixed(1)),
      fat_g: parseFloat((base.fat_g * ratio).toFixed(1)),
      fiber_g: parseFloat((base.fiber_g * ratio).toFixed(1)),
      portion_with_metric: formatPortion(base.base_label, base.unit_grams, newPortion),
    }));
  }, []);

  const handleQtyChange = (newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val < 0) return;
    setPortionQty(val);
    const base = baseMacrosRef.current;
    const newGrams = Math.round(base.unit_grams * val);
    setPortionGrams(newGrams);
    if (val > 0) {
      const ratio = val / base.base_portion;
      scaleMacrosByRatio(ratio, val);
    }
  };

  const handleGramsChange = (newGrams) => {
    const val = parseFloat(newGrams);
    if (isNaN(val) || val < 0) return;
    setPortionGrams(val);
    const base = baseMacrosRef.current;
    const totalBaseGrams = base.unit_grams * base.base_portion;
    if (totalBaseGrams > 0 && val > 0) {
      // Grams is edited independently of Qty: scale the macros to the new
      // weight but leave the Qty value untouched. Qty only changes when the
      // user edits the Qty field directly. The label keeps the current Qty and
      // shows the manually entered grams.
      const ratio = val / totalBaseGrams;
      setMacros((prev) => ({
        ...prev,
        calories: Math.round(base.calories * ratio),
        protein_g: parseFloat((base.protein_g * ratio).toFixed(1)),
        carbs_g: parseFloat((base.carbs_g * ratio).toFixed(1)),
        fat_g: parseFloat((base.fat_g * ratio).toFixed(1)),
        fiber_g: parseFloat((base.fiber_g * ratio).toFixed(1)),
        portion_with_metric: buildUnitLabel(portionQty, unit, val),
      }));
    }
  };

  const handleIncrement = () => handleQtyChange(Math.round((portionQty + 0.5) * 10) / 10);
  const handleDecrement = () => {
    if (portionQty > 0.5) handleQtyChange(Math.round((portionQty - 0.5) * 10) / 10);
  };

  // Grams for one of the given unit. "piece" (and anything unmapped) falls back
  // to the food's own per-unit weight.
  const gramsPerUnit = (u) => UNIT_GRAMS[u] || baseMacrosRef.current.unit_grams || 100;

  // The unit dropdown emits action strings: "convert:<unit>" keeps the current
  // gram amount and just relabels it in the new unit; "<unit>:<mult>" sets the
  // portion to <mult> of <unit>. Both flow through the onChange effect so meal
  // and day totals update live.
  const handleUnitAction = (raw) => {
    if (!raw) return;
    const [type, arg] = raw.split(":");
    const base = baseMacrosRef.current;

    if (type === "convert") {
      const newUnit = arg;
      const gpu = gramsPerUnit(newUnit);
      const newQty = gpu > 0 ? parseFloat((portionGrams / gpu).toFixed(2)) : portionQty;
      setUnit(newUnit);
      setPortionQty(newQty);
      // Rebase the reference onto the selected unit so the Qty and Grams inputs
      // can be edited manually afterward and stay consistent: one "unit" now
      // weighs `gpu` grams and the current macros become the reference for this
      // amount. Grams and macros themselves are unchanged ("keep amount").
      base.base_label = newUnit;
      if (gpu > 0 && newQty > 0) {
        base.unit_grams = gpu;
        base.base_portion = newQty;
        base.calories = macros.calories;
        base.protein_g = macros.protein_g;
        base.carbs_g = macros.carbs_g;
        base.fat_g = macros.fat_g;
        base.fiber_g = macros.fiber_g;
      }
      setMacros((prev) => ({
        ...prev,
        portion_with_metric: buildUnitLabel(newQty, newUnit, portionGrams),
      }));
      return;
    }

    // "<unit>:<mult>" — set an exact amount of a unit.
    const newUnit = type;
    const mult = parseFloat(arg) || 1;
    const gpu = gramsPerUnit(newUnit);
    const newGrams = gpu * mult;
    const totalBaseGrams = (base.unit_grams || 100) * (base.base_portion || 1);
    const ratio = totalBaseGrams > 0 ? newGrams / totalBaseGrams : 1;

    // Scale macros to the chosen amount. Keep the unrounded values as the new
    // reference so later manual Qty/Grams edits scale cleanly without
    // compounding rounding error; show the rounded values.
    const scaled = {
      calories: base.calories * ratio,
      protein_g: base.protein_g * ratio,
      carbs_g: base.carbs_g * ratio,
      fat_g: base.fat_g * ratio,
      fiber_g: base.fiber_g * ratio,
    };

    setUnit(newUnit);
    setPortionQty(mult);
    setPortionGrams(Math.round(newGrams));

    // Rebase the reference onto the selected unit so the Qty and Grams inputs
    // stay consistent when edited manually afterward.
    base.base_label = newUnit;
    base.unit_grams = gpu;
    base.base_portion = mult;
    base.calories = scaled.calories;
    base.protein_g = scaled.protein_g;
    base.carbs_g = scaled.carbs_g;
    base.fat_g = scaled.fat_g;
    base.fiber_g = scaled.fiber_g;

    setMacros((prev) => ({
      ...prev,
      calories: Math.round(scaled.calories),
      protein_g: parseFloat(scaled.protein_g.toFixed(1)),
      carbs_g: parseFloat(scaled.carbs_g.toFixed(1)),
      fat_g: parseFloat(scaled.fat_g.toFixed(1)),
      fiber_g: parseFloat(scaled.fiber_g.toFixed(1)),
      portion_with_metric: buildUnitLabel(mult, newUnit, newGrams),
    }));
  };

  const handleMacroEdit = (key, value) => {
    const val = parseFloat(value);
    if (isNaN(val) || val < 0) return;
    setMacros((prev) => ({ ...prev, [key]: val }));
  };

  const searchAbortRef = useRef(null);

  const handleSearch = useCallback(async (q) => {
    if (searchAbortRef.current) searchAbortRef.current.abort();
    if (!q || q.length < 2) { setSearchResults([]); return; }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    try {
      const data = await searchFoodService(q, { limit: 6, dietType, country, signal: controller.signal });
      setSearchResults(data.results || []);
    } catch (err) {
      if (err.name !== "AbortError") setSearchResults([]);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, [dietType, country]);

  const handleFoodNameChange = (e) => {
    const val = e.target.value;
    setFoodNameInput(val);
    setSelectedFood(val);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 300);
  };

  const handleSelectSwap = (newFood) => {
    if (abortRef.current) abortRef.current.abort();

    setFoodNameInput(newFood.food_name);
    setSelectedFood(newFood.food_name);
    const newPortion = parseFloat(newFood.base_portion) || 1;
    const newUnitGrams = newFood.unit_grams || parseGramsFromLabel(newFood.portion_with_metric) || 100;

    setPortionQty(newPortion);
    setPortionGrams(Math.round(newUnitGrams * newPortion));

    const newMacros = {
      calories: Math.round(newFood.calories || 0),
      protein_g: parseFloat((newFood.protein_g || 0).toFixed(1)),
      carbs_g: parseFloat((newFood.carbs_g || 0).toFixed(1)),
      fat_g: parseFloat((newFood.fat_g || 0).toFixed(1)),
      fiber_g: parseFloat((newFood.fiber_g || 0).toFixed(1)),
    };

    const newBaseLabel = newFood.portion_with_metric || newFood.portion_label || "";
    setUnit(parseBaseLabelFromMetric(newBaseLabel) || "g");
    baseMacrosRef.current = {
      ...newMacros,
      base_portion: newPortion,
      unit_grams: newUnitGrams,
      base_label: newBaseLabel,
    };

    setMacros({
      ...newMacros,
      portion_with_metric: newBaseLabel,
    });
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleSave = () => {
    onSave(buildUpdatedFood());
  };

  // Liquid foods (beverages, or anything currently measured in a liquid unit)
  // get the ml/glass/cup set; everything else gets bowl/katori/plate.
  // Detection order: explicit category → current liquid unit → keyword match on
  // the food name / portion label (fallback for data with no category field).
  const isLiquid =
    String(foodRef.current?.category || "").toLowerCase() === "beverage" ||
    LIQUID_UNITS.includes(unit) ||
    LIQUID_KEYWORDS.test(
      `${selectedFood || ""} ${macros.portion_with_metric || foodRef.current?.portion_with_metric || ""}`
    );

  const unitOptionsHtml = isLiquid ? (
    <>
      <optgroup label="Switch unit (keep amount)">
        <option value="convert:ml">→ ml</option>
        <option value="convert:glass">→ glass</option>
        <option value="convert:cup">→ cup</option>
        <option value="convert:tablespoon">→ tablespoon</option>
        <option value="convert:teaspoon">→ teaspoon</option>
        <option value="convert:floz">→ fl oz</option>
        <option value="convert:liter">→ liter</option>
      </optgroup>
      <optgroup label="ml">
        <option value="ml:1">ml</option>
      </optgroup>
      <optgroup label="Glass">
        <option value="glass:1">1 glass</option>
        <option value="glass:0.75">¾ glass</option>
        <option value="glass:0.5">½ glass</option>
        <option value="glass:0.25">¼ glass</option>
      </optgroup>
      <optgroup label="Cup">
        <option value="cup:1">1 cup</option>
        <option value="cup:0.75">¾ cup</option>
        <option value="cup:0.5">½ cup</option>
        <option value="cup:0.25">¼ cup</option>
      </optgroup>
      <optgroup label="Spoon">
        <option value="tablespoon:1">1 tablespoon</option>
        <option value="tablespoon:0.5">½ tablespoon</option>
        <option value="teaspoon:1">1 teaspoon</option>
      </optgroup>
      <optgroup label="Other">
        <option value="floz:1">1 fl oz</option>
        <option value="liter:1">1 liter</option>
        <option value="liter:0.5">½ liter</option>
      </optgroup>
    </>
  ) : (
    <>
      <optgroup label="Switch unit (keep amount)">
        <option value="convert:bowl">→ bowl</option>
        <option value="convert:cup">→ cup</option>
        <option value="convert:katori">→ katori</option>
        <option value="convert:plate">→ plate</option>
        <option value="convert:tablespoon">→ tablespoon</option>
        <option value="convert:teaspoon">→ teaspoon</option>
        <option value="convert:piece">→ piece</option>
      </optgroup>
      <optgroup label="Bowl">
        <option value="bowl:1">1 bowl</option>
        <option value="bowl:0.75">¾ bowl</option>
        <option value="bowl:0.6667">⅔ bowl</option>
        <option value="bowl:0.5">½ bowl</option>
        <option value="bowl:0.3333">⅓ bowl</option>
        <option value="bowl:0.25">¼ bowl</option>
      </optgroup>
      <optgroup label="Cup">
        <option value="cup:1">1 cup</option>
        <option value="cup:0.75">¾ cup</option>
        <option value="cup:0.6667">⅔ cup</option>
        <option value="cup:0.5">½ cup</option>
        <option value="cup:0.3333">⅓ cup</option>
        <option value="cup:0.25">¼ cup</option>
      </optgroup>
      <optgroup label="Katori">
        <option value="katori:1">1 katori</option>
        <option value="katori:0.75">¾ katori</option>
        <option value="katori:0.5">½ katori</option>
        <option value="katori:0.25">¼ katori</option>
      </optgroup>
      <optgroup label="Plate">
        <option value="plate:1">1 plate</option>
        <option value="plate:0.75">¾ plate</option>
        <option value="plate:0.5">½ plate</option>
        <option value="plate:0.25">¼ plate</option>
      </optgroup>
      <optgroup label="Spoon / Piece">
        <option value="tablespoon:1">1 tablespoon</option>
        <option value="tablespoon:0.5">½ tablespoon</option>
        <option value="teaspoon:1">1 teaspoon</option>
        <option value="teaspoon:0.5">½ teaspoon</option>
        <option value="piece:1">1 piece</option>
        <option value="piece:0.5">½ piece</option>
      </optgroup>
      <optgroup label="Weight">
        <option value="oz:1">1 oz</option>
        <option value="gram:1">1 gram</option>
      </optgroup>
    </>
  );

  const macroFields = [
    { key: "calories", label: "kcal", color: "#252525", bg: "#F5F7FA", step: 1 },
    { key: "protein_g", label: "Protein", color: "#2A9D8F", bg: "#2A9D8F1A", step: 0.1 },
    { key: "carbs_g", label: "Carbs", color: "#F4A261", bg: "#F4A2611A", step: 0.1 },
    { key: "fat_g", label: "Fat", color: "#3A86FF", bg: "#3A86FF1A", step: 0.1 },
    { key: "fiber_g", label: "Fiber", color: "#E76F51", bg: "#E76F511A", step: 0.1 },
  ];

  return (
    <div className="mt-2 p-3 bg-[#F5F7FA] rounded-[10px] border border-[#E1E6ED]">
      {/* Food name — editable input with search dropdown */}
      <div className="relative mb-3">
        <input
          ref={nameInputRef}
          type="text"
          value={foodNameInput}
          onChange={handleFoodNameChange}
          onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
          placeholder="Type food name..."
          className="w-full bg-white rounded-[8px] px-3 py-2 text-[13px] font-semibold text-[#252525] outline-none border border-[#E1E6ED] focus:border-[#308BF9] transition-colors"
        />
        {showDropdown && (searchResults.length > 0 || searching) && (
          <div ref={dropdownRef} className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1E6ED] rounded-[8px] shadow-lg z-10 max-h-[200px] overflow-y-auto">
            {searching ? (
              <p className="text-[11px] text-[#A1A1A1] px-3 py-2">Searching...</p>
            ) : (
              searchResults.map((r, i) => (
                <button
                  key={`${r.food_name}-${i}`}
                  onClick={() => handleSelectSwap(r)}
                  className="w-full text-left px-3 py-2 hover:bg-[#F5F7FA] text-[12px] text-[#252525] cursor-pointer border-b border-[#F5F7FA] last:border-0"
                >
                  <span className="font-medium">{r.food_name}</span>
                  <span className="text-[10px] text-[#A1A1A1] ml-2">
                    {Math.round(r.calories || 0)} kcal · {r.portion_with_metric}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Portion control — qty and grams side by side */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#535359] font-medium">Qty:</span>
          <div className="flex items-center border border-[#E1E6ED] rounded-[6px] bg-white overflow-hidden">
            <button
              onClick={handleDecrement}
              className="px-2 py-1 text-[13px] text-[#535359] hover:bg-[#F5F7FA] cursor-pointer font-bold"
            >
              −
            </button>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={portionQty}
              onChange={(e) => handleQtyChange(e.target.value)}
              className="w-[44px] text-center text-[12px] font-semibold text-[#252525] outline-none border-x border-[#E1E6ED] py-1"
            />
            <button
              onClick={handleIncrement}
              className="px-2 py-1 text-[13px] text-[#535359] hover:bg-[#F5F7FA] cursor-pointer font-bold"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#535359] font-medium">Grams:</span>
          <input
            type="number"
            step="1"
            min="1"
            value={portionGrams}
            onChange={(e) => handleGramsChange(e.target.value)}
            className="w-[56px] text-center text-[12px] font-semibold text-[#252525] outline-none border border-[#E1E6ED] rounded-[6px] bg-white py-1"
          />
          <span className="text-[10px] text-[#A1A1A1]">g</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#535359] font-medium">Unit:</span>
          <select
            value=""
            onChange={(e) => handleUnitAction(e.target.value)}
            className="text-[12px] font-semibold text-[#252525] outline-none border border-[#E1E6ED] rounded-[6px] bg-white py-1 px-2 cursor-pointer focus:border-[#308BF9] transition-colors"
          >
            <option value="">{`${fractionLabel(portionQty)} ${unit}`}</option>
            {unitOptionsHtml}
          </select>
        </div>
      </div>

      {/* Macros — editable by trainer */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {macroFields.map(({ key, label, color, bg, step }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-[6px]"
            style={{ backgroundColor: bg }}
          >
            <input
              type="number"
              step={step}
              min="0"
              value={macros[key]}
              onChange={(e) => handleMacroEdit(key, e.target.value)}
              className="w-full text-center text-[11px] font-bold outline-none bg-transparent"
              style={{ color }}
            />
            <span className="text-[8px] font-medium" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Actions — right here, close to the edits */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 py-2 text-[11px] font-semibold text-white bg-[#308BF9] rounded-[8px] cursor-pointer hover:bg-[#2678D9]"
        >
          Done
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-[11px] font-medium text-[#535359] bg-white border border-[#E1E6ED] rounded-[8px] cursor-pointer hover:bg-[#F5F7FA]"
        >
          Cancel
        </button>
        <button
          onClick={onRemove}
          className="px-3 py-2 text-[11px] font-medium text-[#E76F51] bg-[#E76F511A] rounded-[8px] cursor-pointer hover:bg-[#E76F5133]"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

























// "use client";

// import { useState, useRef, useEffect, useCallback } from "react";

// function parseGramsFromLabel(label) {
//   if (!label) return null;
//   const m = label.match(/\((\d+(?:\.\d+)?)\s*g\)/i);
//   return m ? parseFloat(m[1]) : null;
// }

// function parseBaseLabelFromMetric(label) {
//   if (!label) return "";
//   let s = String(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
//   s = s.replace(/^\s*\d+(?:\.\d+)?\s+/, "").trim();
//   return s;
// }

// function formatPortion(baseLabel, unitGrams, portion) {
//   const continuous = ["g", "ml", "oz", "kg", "l"];
//   const word = parseBaseLabelFromMetric(baseLabel);
//   const isContinuous = !word || continuous.includes(word.toLowerCase());

//   if (isContinuous) {
//     const unit = word || "g";
//     if (Math.abs(portion - Math.round(portion)) < 0.05) {
//       return `${Math.round(portion)} ${unit}`;
//     }
//     return `${parseFloat(portion.toFixed(1))} ${unit}`;
//   }

//   const isWhole = Math.abs(portion - Math.round(portion)) < 0.05;
//   const nStr = isWhole ? String(Math.round(portion)) : String(parseFloat(portion.toFixed(1)));
//   const n = isWhole ? Math.round(portion) : parseFloat(portion.toFixed(1));

//   let displayWord = word;
//   if (n !== 1 && displayWord && !displayWord.toLowerCase().endsWith("s") && displayWord.length > 1) {
//     displayWord = displayWord + "s";
//   }

//   let label = displayWord ? `${nStr} ${displayWord}`.trim() : nStr;
//   if (unitGrams > 0) {
//     const totalG = portion * unitGrams;
//     const gStr = Math.abs(totalG - Math.round(totalG)) < 0.05
//       ? String(Math.round(totalG))
//       : String(parseFloat(totalG.toFixed(1)));
//     label = `${label} (${gStr} g)`;
//   }
//   return label;
// }

// export default function FoodEditPanel({ food, onSave, onChange, onRemove, onCancel }) {
//   const initialQty = parseFloat(food.portion) || parseFloat(food.base_portion) || 1;
//   const initialUnitGrams = food.unit_grams || parseGramsFromLabel(food.portion_with_metric) || 100;

//   const [portionQty, setPortionQty] = useState(initialQty);
//   const [portionGrams, setPortionGrams] = useState(Math.round(initialUnitGrams * initialQty));
//   const [macros, setMacros] = useState({
//     calories: food.calories || 0,
//     protein_g: food.protein_g || 0,
//     carbs_g: food.carbs_g || 0,
//     fat_g: food.fat_g || 0,
//     fiber_g: food.fiber_g || 0,
//     portion_with_metric: food.portion_with_metric || "",
//   });

//   const baseMacrosRef = useRef({
//     calories: food.calories || 0,
//     protein_g: food.protein_g || 0,
//     carbs_g: food.carbs_g || 0,
//     fat_g: food.fat_g || 0,
//     fiber_g: food.fiber_g || 0,
//     base_portion: initialQty,
//     unit_grams: initialUnitGrams,
//     base_label: food.portion_with_metric || "",
//   });

//   const abortRef = useRef(null);

//   // Food name is always an editable input that also searches
//   const [foodNameInput, setFoodNameInput] = useState(food.food_name || "");
//   const [selectedFood, setSelectedFood] = useState(food.food_name || "");
//   const [searchResults, setSearchResults] = useState([]);
//   const [searching, setSearching] = useState(false);
//   const [showDropdown, setShowDropdown] = useState(false);
//   const debounceRef = useRef(null);
//   const nameInputRef = useRef(null);
//   const dropdownRef = useRef(null);

//   // Keep the latest props in refs so the live-update effect can read them
//   // without re-firing when the parent re-renders us with a new `food` object.
//   const foodRef = useRef(food);
//   foodRef.current = food;
//   const onChangeRef = useRef(onChange);
//   onChangeRef.current = onChange;

//   // Build the food payload from current local state. Shared by live updates
//   // (onChange) and the final save (onSave) so they never drift apart.
//   const buildUpdatedFood = useCallback(() => ({
//     ...foodRef.current,
//     food_name: selectedFood,
//     calories: macros.calories,
//     protein_g: macros.protein_g,
//     carbs_g: macros.carbs_g,
//     fat_g: macros.fat_g,
//     fiber_g: macros.fiber_g,
//     portion: portionQty,
//     base_portion: baseMacrosRef.current.base_portion,
//     unit_grams: baseMacrosRef.current.unit_grams,
//     portion_with_metric: macros.portion_with_metric,
//   }), [selectedFood, macros, portionQty]);

//   // Push edits to the parent in real time so meal/day macro totals update
//   // as the trainer changes calories, portion or any macro — without waiting
//   // for "Done". Skip the initial mount so we don't fire a no-op update.
//   const didMountRef = useRef(false);
//   useEffect(() => {
//     if (!didMountRef.current) {
//       didMountRef.current = true;
//       return;
//     }
//     onChangeRef.current?.(buildUpdatedFood());
//   }, [buildUpdatedFood]);

//   // Close dropdown on outside click
//   useEffect(() => {
//     const handleClick = (e) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
//           nameInputRef.current && !nameInputRef.current.contains(e.target)) {
//         setShowDropdown(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClick);
//     return () => document.removeEventListener("mousedown", handleClick);
//   }, []);

//   const scaleMacrosByRatio = useCallback((ratio, newPortion) => {
//     const base = baseMacrosRef.current;
//     setMacros((prev) => ({
//       ...prev,
//       calories: Math.round(base.calories * ratio),
//       protein_g: parseFloat((base.protein_g * ratio).toFixed(1)),
//       carbs_g: parseFloat((base.carbs_g * ratio).toFixed(1)),
//       fat_g: parseFloat((base.fat_g * ratio).toFixed(1)),
//       fiber_g: parseFloat((base.fiber_g * ratio).toFixed(1)),
//       portion_with_metric: formatPortion(base.base_label, base.unit_grams, newPortion),
//     }));
//   }, []);

//   const handleQtyChange = (newQty) => {
//     const val = parseFloat(newQty);
//     if (isNaN(val) || val < 0) return;
//     setPortionQty(val);
//     const base = baseMacrosRef.current;
//     const newGrams = Math.round(base.unit_grams * val);
//     setPortionGrams(newGrams);
//     if (val > 0) {
//       const ratio = val / base.base_portion;
//       scaleMacrosByRatio(ratio, val);
//     }
//   };

//   const handleGramsChange = (newGrams) => {
//     const val = parseFloat(newGrams);
//     if (isNaN(val) || val < 0) return;
//     setPortionGrams(val);
//     const base = baseMacrosRef.current;
//     const totalBaseGrams = base.unit_grams * base.base_portion;
//     if (totalBaseGrams > 0 && val > 0) {
//       const newQty = parseFloat((val / base.unit_grams).toFixed(2));
//       setPortionQty(newQty);
//       const ratio = val / totalBaseGrams;
//       scaleMacrosByRatio(ratio, newQty);
//     }
//   };

//   const handleIncrement = () => handleQtyChange(Math.round((portionQty + 0.5) * 10) / 10);
//   const handleDecrement = () => {
//     if (portionQty > 0.5) handleQtyChange(Math.round((portionQty - 0.5) * 10) / 10);
//   };

//   const handleMacroEdit = (key, value) => {
//     const val = parseFloat(value);
//     if (isNaN(val) || val < 0) return;
//     setMacros((prev) => ({ ...prev, [key]: val }));
//   };

//   const searchAbortRef = useRef(null);

//   const handleSearch = useCallback(async (q) => {
//     if (searchAbortRef.current) searchAbortRef.current.abort();
//     if (!q || q.length < 2) { setSearchResults([]); return; }
//     const controller = new AbortController();
//     searchAbortRef.current = controller;
//     setSearching(true);
//     try {
//       const res = await fetch(`/api/food/search?q=${encodeURIComponent(q)}&limit=6`, {
//         signal: controller.signal,
//       });
//       const data = await res.json();
//       setSearchResults(data.results || []);
//     } catch (err) {
//       if (err.name !== "AbortError") setSearchResults([]);
//     } finally {
//       if (!controller.signal.aborted) setSearching(false);
//     }
//   }, []);

//   const handleFoodNameChange = (e) => {
//     const val = e.target.value;
//     setFoodNameInput(val);
//     setSelectedFood(val);
//     setShowDropdown(true);
//     if (debounceRef.current) clearTimeout(debounceRef.current);
//     debounceRef.current = setTimeout(() => handleSearch(val), 300);
//   };

//   const handleSelectSwap = (newFood) => {
//     if (abortRef.current) abortRef.current.abort();

//     setFoodNameInput(newFood.food_name);
//     setSelectedFood(newFood.food_name);
//     const newPortion = parseFloat(newFood.base_portion) || 1;
//     const newUnitGrams = newFood.unit_grams || parseGramsFromLabel(newFood.portion_with_metric) || 100;

//     setPortionQty(newPortion);
//     setPortionGrams(Math.round(newUnitGrams * newPortion));

//     const newMacros = {
//       calories: Math.round(newFood.calories || 0),
//       protein_g: parseFloat((newFood.protein_g || 0).toFixed(1)),
//       carbs_g: parseFloat((newFood.carbs_g || 0).toFixed(1)),
//       fat_g: parseFloat((newFood.fat_g || 0).toFixed(1)),
//       fiber_g: parseFloat((newFood.fiber_g || 0).toFixed(1)),
//     };

//     const newBaseLabel = newFood.portion_with_metric || newFood.portion_label || "";
//     baseMacrosRef.current = {
//       ...newMacros,
//       base_portion: newPortion,
//       unit_grams: newUnitGrams,
//       base_label: newBaseLabel,
//     };

//     setMacros({
//       ...newMacros,
//       portion_with_metric: newBaseLabel,
//     });
//     setShowDropdown(false);
//     setSearchResults([]);
//   };

//   const handleSave = () => {
//     onSave(buildUpdatedFood());
//   };

//   const macroFields = [
//     { key: "calories", label: "kcal", color: "#252525", bg: "#F5F7FA", step: 1 },
//     { key: "protein_g", label: "Protein", color: "#2A9D8F", bg: "#2A9D8F1A", step: 0.1 },
//     { key: "carbs_g", label: "Carbs", color: "#F4A261", bg: "#F4A2611A", step: 0.1 },
//     { key: "fat_g", label: "Fat", color: "#3A86FF", bg: "#3A86FF1A", step: 0.1 },
//     { key: "fiber_g", label: "Fiber", color: "#E76F51", bg: "#E76F511A", step: 0.1 },
//   ];

//   return (
//     <div className="mt-2 p-3 bg-[#F5F7FA] rounded-[10px] border border-[#E1E6ED]">
//       {/* Food name — editable input with search dropdown */}
//       <div className="relative mb-3">
//         <input
//           ref={nameInputRef}
//           type="text"
//           value={foodNameInput}
//           onChange={handleFoodNameChange}
//           onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
//           placeholder="Type food name..."
//           className="w-full bg-white rounded-[8px] px-3 py-2 text-[13px] font-semibold text-[#252525] outline-none border border-[#E1E6ED] focus:border-[#308BF9] transition-colors"
//         />
//         {showDropdown && (searchResults.length > 0 || searching) && (
//           <div ref={dropdownRef} className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1E6ED] rounded-[8px] shadow-lg z-10 max-h-[200px] overflow-y-auto">
//             {searching ? (
//               <p className="text-[11px] text-[#A1A1A1] px-3 py-2">Searching...</p>
//             ) : (
//               searchResults.map((r, i) => (
//                 <button
//                   key={`${r.food_name}-${i}`}
//                   onClick={() => handleSelectSwap(r)}
//                   className="w-full text-left px-3 py-2 hover:bg-[#F5F7FA] text-[12px] text-[#252525] cursor-pointer border-b border-[#F5F7FA] last:border-0"
//                 >
//                   <span className="font-medium">{r.food_name}</span>
//                   <span className="text-[10px] text-[#A1A1A1] ml-2">
//                     {Math.round(r.calories || 0)} kcal · {r.portion_with_metric}
//                   </span>
//                 </button>
//               ))
//             )}
//           </div>
//         )}
//       </div>

//       {/* Portion control — qty and grams side by side */}
//       <div className="flex items-center gap-3 mb-3 flex-wrap">
//         <div className="flex items-center gap-1.5">
//           <span className="text-[11px] text-[#535359] font-medium">Qty:</span>
//           <div className="flex items-center border border-[#E1E6ED] rounded-[6px] bg-white overflow-hidden">
//             <button
//               onClick={handleDecrement}
//               className="px-2 py-1 text-[13px] text-[#535359] hover:bg-[#F5F7FA] cursor-pointer font-bold"
//             >
//               −
//             </button>
//             <input
//               type="number"
//               step="0.5"
//               min="0.5"
//               value={portionQty}
//               onChange={(e) => handleQtyChange(e.target.value)}
//               className="w-[44px] text-center text-[12px] font-semibold text-[#252525] outline-none border-x border-[#E1E6ED] py-1"
//             />
//             <button
//               onClick={handleIncrement}
//               className="px-2 py-1 text-[13px] text-[#535359] hover:bg-[#F5F7FA] cursor-pointer font-bold"
//             >
//               +
//             </button>
//           </div>
//         </div>
//         <div className="flex items-center gap-1.5">
//           <span className="text-[11px] text-[#535359] font-medium">Grams:</span>
//           <input
//             type="number"
//             step="1"
//             min="1"
//             value={portionGrams}
//             onChange={(e) => handleGramsChange(e.target.value)}
//             className="w-[56px] text-center text-[12px] font-semibold text-[#252525] outline-none border border-[#E1E6ED] rounded-[6px] bg-white py-1"
//           />
//           <span className="text-[10px] text-[#A1A1A1]">g</span>
//         </div>
//       </div>

//       {/* Macros — editable by trainer */}
//       <div className="grid grid-cols-5 gap-1.5 mb-3">
//         {macroFields.map(({ key, label, color, bg, step }) => (
//           <div
//             key={key}
//             className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-[6px]"
//             style={{ backgroundColor: bg }}
//           >
//             <input
//               type="number"
//               step={step}
//               min="0"
//               value={macros[key]}
//               onChange={(e) => handleMacroEdit(key, e.target.value)}
//               className="w-full text-center text-[11px] font-bold outline-none bg-transparent"
//               style={{ color }}
//             />
//             <span className="text-[8px] font-medium" style={{ color }}>{label}</span>
//           </div>
//         ))}
//       </div>

//       {/* Actions — right here, close to the edits */}
//       <div className="flex gap-2">
//         <button
//           onClick={handleSave}
//           className="flex-1 py-2 text-[11px] font-semibold text-white bg-[#308BF9] rounded-[8px] cursor-pointer hover:bg-[#2678D9]"
//         >
//           Done
//         </button>
//         <button
//           onClick={onCancel}
//           className="px-3 py-2 text-[11px] font-medium text-[#535359] bg-white border border-[#E1E6ED] rounded-[8px] cursor-pointer hover:bg-[#F5F7FA]"
//         >
//           Cancel
//         </button>
//         <button
//           onClick={onRemove}
//           className="px-3 py-2 text-[11px] font-medium text-[#E76F51] bg-[#E76F511A] rounded-[8px] cursor-pointer hover:bg-[#E76F5133]"
//         >
//           Remove
//         </button>
//       </div>
//     </div>
//   );
// }
