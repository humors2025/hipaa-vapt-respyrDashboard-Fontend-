"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

export default function FoodSearchModal({ mealSlot, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualFood, setManualFood] = useState({
    food_name: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
    fiber_g: "",
    portion_with_metric: "",
  });
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (q) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setLookupFailed(false);
    try {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(q)}&limit=8`, {
        signal: controller.signal,
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      if (err.name !== "AbortError") setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setManualMode(false);
    setLookupFailed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && query.trim().length >= 2 && !loading && !lookupLoading) {
      e.preventDefault();
      handleLookup();
    }
  };

  const handleSelectFood = (food) => {
    onAdd({
      food_name: food.food_name,
      calories: Math.round(food.calories || 0),
      protein_g: parseFloat((food.protein_g || 0).toFixed(1)),
      carbs_g: parseFloat((food.carbs_g || 0).toFixed(1)),
      fat_g: parseFloat((food.fat_g || 0).toFixed(1)),
      fiber_g: parseFloat((food.fiber_g || 0).toFixed(1)),
      portion_with_metric: food.portion_with_metric || food.portion_label || "",
      portion: food.portion || food.base_portion || 1,
      base_portion: food.base_portion || 1,
      category: food.category || "Meals",
      macro_source: food.macro_source || "library",
    });
  };

  const handleLookup = async () => {
    if (!query.trim()) return;
    setLookupLoading(true);
    setLookupFailed(false);
    try {
      const res = await fetch("/api/food/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: query.trim(), country: "usa" }),
      });
      const data = await res.json();
      if (data.error) {
        setLookupFailed(true);
      } else {
        onAdd({
          food_name: data.food_name || query.trim(),
          calories: Math.round(data.calories || 0),
          protein_g: parseFloat((data.protein_g || 0).toFixed(1)),
          carbs_g: parseFloat((data.carbs_g || 0).toFixed(1)),
          fat_g: parseFloat((data.fat_g || 0).toFixed(1)),
          fiber_g: parseFloat((data.fiber_g || 0).toFixed(1)),
          portion_with_metric: data.portion_with_metric || "",
          portion: data.portion || 1,
          base_portion: data.base_portion || 1,
          category: data.category || "Meals",
          macro_source: data.macro_source || "ai_lookup",
        });
      }
    } catch {
      setLookupFailed(true);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualFood.food_name.trim()) return;
    const local = {
      food_name: manualFood.food_name.trim(),
      calories: parseFloat(manualFood.calories) || 0,
      protein_g: parseFloat(manualFood.protein_g) || 0,
      carbs_g: parseFloat(manualFood.carbs_g) || 0,
      fat_g: parseFloat(manualFood.fat_g) || 0,
      fiber_g: parseFloat(manualFood.fiber_g) || 0,
      portion_with_metric: manualFood.portion_with_metric || "1 serving",
      portion: 1,
      base_portion: 1,
      category: "Meals",
      macro_source: "manual",
    };
    try {
      const res = await fetch("/api/food/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      const persisted = await res.json();
      if (res.ok && !persisted.error) {
        onAdd(persisted);
        return;
      }
    } catch {
      // server unreachable — fall through to local-only add
    }
    onAdd(local);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[20px] w-[90%] max-w-[480px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-[#E1E6ED]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#252525] text-[16px] font-semibold">
              Add food to {mealSlot}
            </p>
            <button onClick={onClose} className="text-[#A1A1A1] hover:text-[#252525] text-[18px] font-bold cursor-pointer">
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-[10px] px-3 py-2.5">
            <Image src="/icons/hugeicons_search.svg" alt="search" width={16} height={16} className="opacity-50" onError={(e) => { e.target.style.display = "none"; }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a food name and press Enter (e.g. boiled eggs, paratha)..."
              className="flex-1 bg-transparent text-[13px] text-[#252525] outline-none placeholder:text-[#A1A1A1]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && (
            <p className="text-[#A1A1A1] text-[12px] text-center py-4">Searching...</p>
          )}

          {/* Library results */}
          {!loading && !manualMode && results.length > 0 && (
            <div className="flex flex-col gap-1">
              {results.map((food, i) => (
                <button
                  key={`${food.food_name}-${i}`}
                  onClick={() => handleSelectFood(food)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-[8px] hover:bg-[#F5F7FA] transition-colors text-left cursor-pointer"
                >
                  <div className="flex-1">
                    <p className="text-[#252525] text-[13px] font-medium">{food.food_name}</p>
                    <p className="text-[#A1A1A1] text-[11px]">
                      {Math.round(food.calories || 0)} kcal · {food.portion_with_metric || food.portion_label || ""}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <span className="text-[10px] text-[#2A9D8F] bg-[#2A9D8F1A] px-1.5 py-0.5 rounded">P{Math.round(food.protein_g || 0)}g</span>
                    <span className="text-[10px] text-[#F4A261] bg-[#F4A2611A] px-1.5 py-0.5 rounded">C{Math.round(food.carbs_g || 0)}g</span>
                    <span className="text-[10px] text-[#3A86FF] bg-[#3A86FF1A] px-1.5 py-0.5 rounded">F{Math.round(food.fat_g || 0)}g</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No library results → offer AI lookup */}
          {!loading && !manualMode && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-6">
              <button
                onClick={handleLookup}
                disabled={lookupLoading}
                className="bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 rounded-[8px] cursor-pointer disabled:opacity-60"
              >
                {lookupLoading ? "AI is calculating macros..." : `Add "${query}" — AI will calculate macros`}
              </button>
              <p className="text-[#A1A1A1] text-[10px] mt-2">
                Or press Enter. AI calculates calories, protein, carbs, fat & fiber automatically.
              </p>

              {/* Only show manual fallback AFTER AI lookup fails */}
              {lookupFailed && (
                <div className="mt-4 pt-4 border-t border-[#E1E6ED]">
                  <p className="text-[#E76F51] text-[11px] mb-2">
                    AI lookup failed for this food.
                  </p>
                  <button
                    onClick={() => {
                      setManualMode(true);
                      setManualFood((prev) => ({ ...prev, food_name: query.trim() }));
                    }}
                    className="text-[#535359] text-[11px] font-medium cursor-pointer underline"
                  >
                    Enter macros manually as last resort
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual entry — last resort only after AI fails */}
          {manualMode && (
            <div className="flex flex-col gap-3 py-2">
              <p className="text-[#252525] text-[13px] font-semibold">Manual entry</p>
              <p className="text-[#A1A1A1] text-[10px]">
                Both USDA and AI couldn&apos;t find this food. Enter the nutritional info for one serving.
              </p>
              <input
                type="text"
                value={manualFood.food_name}
                onChange={(e) => setManualFood({ ...manualFood, food_name: e.target.value })}
                placeholder="Food name"
                className="bg-[#F5F7FA] rounded-[8px] px-3 py-2 text-[13px] outline-none"
              />
              <input
                type="text"
                value={manualFood.portion_with_metric}
                onChange={(e) => setManualFood({ ...manualFood, portion_with_metric: e.target.value })}
                placeholder="Portion (e.g. 1 cup, 200g)"
                className="bg-[#F5F7FA] rounded-[8px] px-3 py-2 text-[13px] outline-none"
              />
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: "calories", label: "kcal" },
                  { key: "protein_g", label: "Prot" },
                  { key: "carbs_g", label: "Carb" },
                  { key: "fat_g", label: "Fat" },
                  { key: "fiber_g", label: "Fiber" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#A1A1A1] font-medium">{label}</label>
                    <input
                      type="number"
                      step="any"
                      value={manualFood[key]}
                      onChange={(e) => setManualFood({ ...manualFood, [key]: e.target.value })}
                      className="bg-[#F5F7FA] rounded-[6px] px-2 py-1.5 text-[12px] outline-none w-full"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleManualSubmit}
                disabled={!manualFood.food_name.trim()}
                className="bg-[#308BF9] text-white text-[12px] font-semibold py-2 rounded-[8px] cursor-pointer disabled:opacity-50 mt-1"
              >
                Add to meal
              </button>
            </div>
          )}

          {!loading && query.length < 2 && (
            <p className="text-[#A1A1A1] text-[12px] text-center py-8">
              Type at least 2 characters to search
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
