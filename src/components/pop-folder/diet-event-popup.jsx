


"use client";
import { useState, useEffect, forwardRef, useRef  } from "react";
import { Modal } from "react-responsive-modal";
import { PiDotsThreeOutlineVerticalFill } from "react-icons/pi";
import Image from "next/image";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";
import { MdDelete } from "react-icons/md";
import { IoClose } from "react-icons/io5";


// Split "1.0 bowl" → { quantityValue: "1.0", quantityUnit: "bowl" }
const parseQuantityDetail = (detail) => {
  if (!detail) return { quantityValue: "", quantityUnit: "" };

  const parts = detail.trim().split(" ");
  const quantityValue = parts[0] || "";
  const quantityUnit = parts.slice(1).join(" ") || "";

  return { quantityValue, quantityUnit };
};

// Split "80kcal" / "3g" / "10 g" → { value: "80", unit: "kcal" }
const parseValueUnit = (str) => {
  if (!str) return { value: "", unit: "" };

  const trimmed = str.trim();
  const match = trimmed.match(/^([\d.]+)\s*(.*)$/); // number + optional unit
  if (!match) {
    return { value: trimmed, unit: "" };
  }
  return { value: match[1] || "", unit: match[2] || "" };
};

// default empty item
const emptyFoodItem = {
  name: "",
  quantityValue: "",
  quantityUnit: "",
  caloriesValue: "",
  caloriesUnit: "kcal",
  proteinValue: "",
  proteinUnit: "g",
  carbsValue: "",
  carbsUnit: "g",
  fatValue: "",
  fatUnit: "g",
};

const DietEventPopUp = forwardRef(function Popup({ open, onClose, selectedMeal, onSave, onEditing  }, ref) {


  const dayName = (selectedMeal?.dayName || "").toLowerCase();
  const dayLabel = selectedMeal?.dayLabel || "Day 1";

  const [eventTitle, setEventTitle] = useState("Event1");
  const [planName, setPlanName] = useState("");
  const [foodItems, setFoodItems] = useState([emptyFoodItem]);
  const [updatedExtractedData, setUpdatedExtractedData] = useState(null);
  const UNIT_OPTIONS = ["Bowl", "Cup", "Plate", "Glass"];
  const [hasUserTouched, setHasUserTouched] = useState(false);

   const scrollContainerRef = useRef(null);   
   const originalFoodItemsRef = useRef(null);

  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false); 



  // When selectedMeal changes, rebuild foodItems from selectedMeal.meals
useEffect(() => {
  if (!selectedMeal) return;

  const mealsArray = selectedMeal.meals || [];
  const items = [];

  mealsArray.forEach((meal) => {
    (meal.foodItems || []).forEach((foodItem) => {
      const { quantityValue, quantityUnit } = parseQuantityDetail(foodItem.details?.[0]);
      const { value: caloriesValue, unit: caloriesUnit } = parseValueUnit(foodItem.details?.[1]);
      const { value: proteinValue } = parseValueUnit(foodItem.details?.[2]?.split(":")[1] || "");
      const { value: carbsValue } = parseValueUnit(foodItem.details?.[3]?.split(":")[1] || "");
      const { value: fatValue } = parseValueUnit(foodItem.details?.[4]?.split(":")[1] || "");

      items.push({
        name: foodItem.name || "",
        quantityValue,
        quantityUnit,
        caloriesValue,
        caloriesUnit,
        proteinValue,
        proteinUnit: "g",
        carbsValue,
        carbsUnit: "g",
        fatValue,
        fatUnit: "g",
      });
    });
  });

  const finalItems = items.length ? items : [emptyFoodItem];

  setFoodItems(finalItems);

  // ✅ STORE ORIGINAL SNAPSHOT (ONLY ON OPEN)
originalFoodItemsRef.current = JSON.stringify(
  normalizeItemsForCompare(finalItems)
);

  setHasUserTouched(false);
}, [selectedMeal]);


const handleAddItem = () => {
  setFoodItems((prev) => [...prev, { ...emptyFoodItem }]);
  setHasUserTouched(true); // user clicked “Add”
   setShouldScrollToEnd(true);
};




const hasAnyFilledValue = (items) => {
  return items.some((item) =>
    (item.name && item.name.trim() !== "") ||
    (item.quantityValue && item.quantityValue.trim() !== "") ||
    (item.caloriesValue && item.caloriesValue.trim() !== "") ||
    (item.proteinValue && item.proteinValue.trim() !== "") ||
    (item.carbsValue && item.carbsValue.trim() !== "") ||
    (item.fatValue && item.fatValue.trim() !== "")
  );
};



 const updateFoodItem = (index, field, value) => {
  const updatedItems = [...foodItems];
  updatedItems[index] = {
    ...updatedItems[index],
    [field]: value,
  };
  setFoodItems(updatedItems);
  setHasUserTouched(true);  // ✅ user interacted
};


  const sanitizeUnitInput = (value) => {
    // Remove all digits 0–9
    return value.replace(/[0-9]/g, "");
  };

  // Build RAW STRUCTURED DATA like extractedData
  // const handleSave = () => {
  //   if (!dayName) {
  //     console.error("Day name is missing, cannot save data.");
  //     return;
  //   }

  //   // 1️⃣ Build items array in RAW format
  //   const items = foodItems.map((item) => {
  //     const portionStr = `${item.quantityValue} ${item.quantityUnit}`.trim();

  //     return {
  //       name: item.name || "",
  //       portion: portionStr, // "1.0 bowl"
  //       calories_kcal: parseFloat(item.caloriesValue) || 0,
  //       protein: parseFloat(item.proteinValue) || 0,
  //       carbs: parseFloat(item.carbsValue) || 0,
  //       fat: parseFloat(item.fatValue) || 0,
  //     };
  //   });

  //   // 2️⃣ Build meal time label like: "Lunch at 02:00 PM"
  //   const mealLabel =
  //     selectedMeal?.time && selectedMeal?.timeRange
  //       ? `${selectedMeal.time} at ${selectedMeal.timeRange}`
  //       : selectedMeal?.time || "";

  //   // 3️⃣ Calculate totals for this meal
  //   const totals = items.reduce(
  //     (acc, cur) => {
  //       acc.calories_kcal += cur.calories_kcal || 0;
  //       acc.protein += cur.protein || 0;
  //       acc.carbs += cur.carbs || 0;
  //       acc.fat += cur.fat || 0;
  //       return acc;
  //     },
  //     { calories_kcal: 0, protein: 0, carbs: 0, fat: 0 }
  //   );

  //   // 4️⃣ Build RAW day block
  //   const dayBlock = {
  //     meals: [
  //       {
  //         time: mealLabel, // e.g. "Lunch at 02:00 PM"
  //         items,
  //         totals, // meal totals
  //       },
  //     ],
  //     totals,
  //   };

  //   // 5️⃣ Final RAW payload with .result (for parent to merge)
  //   const rawPayload = {
  //     _notes: {
  //       illegible: [],
  //       omissions: [],
  //       warnings: [],
  //     },
  //     result: {
  //       [dayName]: dayBlock,
  //     },
  //   };

  //   setUpdatedExtractedData(rawPayload);

  //   try {
  //     if (onSave) {
  //       onSave(rawPayload);
  //     }
  //     onClose();
  //   } catch (error) {
  //     console.error("Failed to save data:", error);
  //   }
  // };


  // ... (inside DietEvent component)

  // Build RAW STRUCTURED DATA like extractedData
  
  
  const handleSave = () => {
    if (!dayName) {
      console.error("Day name is missing, cannot save data.");
      return;
    }

    // 1️⃣ Build items array in RAW format with validation/filtering
    const items = foodItems
      .map((item) => {
        // **A. Filter out invalid/empty items**
        // An item is considered "filled" if it has a name OR a quantity value.
        const hasName = item.name.trim().length > 0;
        const hasQuantity = item.quantityValue.trim().length > 0;

        if (!hasName && !hasQuantity) {
          return null; // Mark for removal
        }

        // **B. Transform valid item into the required payload format**
        const portionStr = `${item.quantityValue} ${item.quantityUnit}`.trim();

        return {
          name: item.name || "",
          portion: portionStr, // "1.0 bowl"
          // Ensure values are numbers, default to 0 if parsing fails
          calories_kcal: parseFloat(item.caloriesValue) || 0,
          protein: parseFloat(item.proteinValue) || 0,
          carbs: parseFloat(item.carbsValue) || 0,
          fat: parseFloat(item.fatValue) || 0,
        };
      })
      .filter(item => item !== null); // **C. Remove the marked null items**

    // Optional: If ALL items were blank and filtered out, you might want to prevent saving entirely
    // if (items.length === 0) {
    //   console.log("No food items filled out. Save aborted.");
    //   return;
    // }

    // 2️⃣ Build meal time label like: "Lunch at 02:00 PM"
    const mealLabel =
      selectedMeal?.time && selectedMeal?.timeRange
        ? `${selectedMeal.time} at ${selectedMeal.timeRange}`
        : selectedMeal?.time || "";

    // 3️⃣ Calculate totals for this meal
    const totals = items.reduce(
      (acc, cur) => {
        acc.calories_kcal += cur.calories_kcal || 0;
        acc.protein += cur.protein || 0;
        acc.carbs += cur.carbs || 0;
        acc.fat += cur.fat || 0;
        return acc;
      },
      { calories_kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );

    // 4️⃣ Build RAW day block
    const dayBlock = {
      meals: [
        {
          time: mealLabel, // e.g. "Lunch at 02:00 PM"
          items,
          totals, // meal totals
        },
      ],
      totals,
    };

    // 5️⃣ Final RAW payload with .result (for parent to merge)
    const rawPayload = {
      _notes: {
        illegible: [],
        omissions: [],
        warnings: [],
      },
      result: {
        [dayName]: dayBlock,
      },
    };

    setUpdatedExtractedData(rawPayload);

    try {
      if (onSave) {
        onSave(rawPayload);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  };


const handleRemoveItem = (indexToRemove) => {
  setFoodItems((prev) => {
    if (prev.length === 1) {
      const newItems = [{ ...emptyFoodItem }];
      return newItems;
    }
    const newItems = prev.filter((_, idx) => idx !== indexToRemove);
    return newItems;
  });
  setHasUserTouched(true);
};


useEffect(() => {
  if (!onEditing) return;
  if (!originalFoodItemsRef.current) return;

  const original = originalFoodItemsRef.current;
  const current = JSON.stringify(normalizeItemsForCompare(foodItems));

  const isChanged = current !== original;

  onEditing(isChanged);
}, [foodItems, onEditing]);



useEffect(() => {
  if (shouldScrollToEnd && scrollContainerRef.current) {
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
    setShouldScrollToEnd(false);
  }
}, [foodItems.length, shouldScrollToEnd]);




const normalizeItemsForCompare = (items) => {
  const cleaned = (items || [])
    .map((it) => ({
      name: (it.name || "").trim(),
      quantityValue: (it.quantityValue || "").trim(),
      quantityUnit: (it.quantityUnit || "").trim(),
      caloriesValue: (it.caloriesValue || "").trim(),
      proteinValue: (it.proteinValue || "").trim(),
      carbsValue: (it.carbsValue || "").trim(),
      fatValue: (it.fatValue || "").trim(),
      // units are constant/readOnly in your UI, no need in compare
    }))
    // IMPORTANT: remove fully empty rows (same rule as your save filter intent)
    .filter((it) => {
      const hasName = it.name.length > 0;
      const hasQty = it.quantityValue.length > 0;
      const hasMacros =
        it.caloriesValue.length > 0 ||
        it.proteinValue.length > 0 ||
        it.carbsValue.length > 0 ||
        it.fatValue.length > 0;

      return hasName || hasQty || hasMacros;
    });

  return cleaned;
};




  // const handleRemoveItem = (indexToRemove) => {
  //  setFoodItems((prev) => {
  //   if (prev.length === 1) {
  //  // If it's the last item, close the modal
  //  onClose(); 
  //  return []; // Clear state, modal will close anyway
  //  }
  //  return prev.filter((_, idx) => idx !== indexToRemove);
  // });
  // };


  return (
    <>

    
      <div className="fixed top-0 left-0 w-full h-screen bg-black/50 z-50 flex justify-center items-center gap-2  ">
        <div className="flex gap-2 items-start" ref={ref}>
          {/* OUTER WRAPPER: fixed height + column => header fixed */}
          <div className="max-h-[80vh] bg-white flex flex-col rounded-[10px] px-6 pt-[25px] pb-[34px] border-t-[10px] border-[#FFA99F]">
            {/* 🔹 FIXED HEADER */}
            <div className=" px-2">
              <div className="flex justify-between">
                <div className="flex flex-col gap-2.5 px-[9px] py-[5px]">
                  <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                    {dayLabel}
                  </span>
                  <span className="text-[#252525] text-[25px] font-semibold leading-[110%] tracking-[-0.5px]">
                    {eventTitle}
                  </span>
                </div>

                <div className="flex gap-[13px] items-center pr-2">
                  <button
                    className="bg-[#308BF9] rounded-[10px] px-5 py-[15px] text-white text-[12px] font-semibold leading-normal tracking-[-0.24px]"
                    onClick={handleSave}
                  >
                    Save
                  </button>

                </div>
              </div>
            </div>

            {/* 🔹 SCROLLABLE BODY */}
            <div 
              ref={scrollContainerRef} 
            className="flex-1 overflow-y-auto overflow-x-hidden px-2 hide-scrollbar">
              <div className="rounded-[10px]">
                <div className="flex gap-5 items-end mt-2.5">
                  {/* Name of the event */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="floating_outlined"
                      className="block py-[15px] pl-[19px] pr-[13px] w-full text-[14px] text-[#252525] bg-white rounded-[8px] border border-[#E1E6ED] appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                      placeholder=" "
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                    />
                    <label
                      htmlFor="floating_outlined"
                      className="absolute text-[14px] text-[#9CA3AF] duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 start-1"
                    >
                      Name of the event
                    </label>
                  </div>
                </div>

                {/* Food Items Section */}
                <div className="flex flex-col gap-5 mt-4">
                  <span className="text-[#252525] text-[15px] font-normal leading-[110%] tracking-[-0.3px]">
                    Food Items
                  </span>
                  <div className="w-full border-b border-[#E1E6ED]"></div>
                </div>

                {/* Dynamically render food items */}
                {foodItems.map((item, index) => (
                  <div
                    key={index}
                    className="pl-5 h-full border-l border-[#E1E6ED] mt-4"
                  >
                    <div className="flex items-center justify-between pr-2 pb-2.5">
                      <span className="text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">
                        Item {index + 1}
                      </span>

                      {foodItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="flex items-center gap-1 text-[#252525] text-[12px] cursor-pointer"
                        >

                          <MdDelete size={16} />
                        </button>
                      )}
                    </div>
                    <div className="pl-[13px] h-full border-l border-[#E1E6ED]">
                      <div className="flex flex-col gap-[20px]">
                        {/* Goal Title */}
                        <div className="relative flex-1">
                          <input
                            id={`goalTitle-${index}`}
                            type="text"
                            placeholder=" "
                            className="peer block w-full py-[15px] pl-[19px] pr-[13px] text-[14px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] outline-none placeholder-transparent focus:border-blue-600"
                            value={item.name}
                            onChange={(e) =>
                              updateFoodItem(index, "name", e.target.value)
                            }
                          />
                          <label
                            htmlFor={`goalTitle-${index}`}
                            className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]"
                          >
                            Goal Title
                          </label>
                        </div>

                        {/* Quantity: value + unit */}
                        <div className="flex gap-2 flex-1">
                          {/* Quantity Value */}
                          <div className="relative flex-1">
                            <input
                              id={`quantity-value-${index}`}
                              type="text"
                              placeholder=" "
                              className="peer block w-full py-[15px] pl-[19px] pr-[13px] text-[14px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] outline-none placeholder-transparent focus:border-blue-600"
                              value={item.quantityValue}
                              onChange={(e) =>
                                updateFoodItem(
                                  index,
                                  "quantityValue",
                                  e.target.value
                                )
                              }
                            />
                            <label
                              htmlFor={`quantity-value-${index}`}
                              className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]"
                            >
                              Quantity
                            </label>
                          </div>

                          {/* Quantity Unit */}
                          <div className="relative w-[120px]">
                            <select
                              id={`quantity-unit-${index}`}
                              className="appearance-none peer block w-full py-[15px] pl-[19px] pr-[40px] text-[14px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] outline-none focus:border-blue-600"
                              value={item.quantityUnit || ""}
                              onChange={(e) =>
                                updateFoodItem(
                                  index,
                                  "quantityUnit",
                                  sanitizeUnitInput(e.target.value)
                                )
                              }
                            >
                              <option value="" disabled>
                                Select
                              </option>

                              {item.quantityUnit &&
                                !UNIT_OPTIONS.map((u) => u.toLowerCase()).includes(
                                  item.quantityUnit.toLowerCase()
                                ) && (
                                  <option value={item.quantityUnit}>{item.quantityUnit}</option>
                                )}

                              <option value="Bowl">Bowl</option>
                              <option value="Cup">Cup</option>
                              <option value="Plate">Plate</option>
                              <option value="Glass">Glass</option>
                            </select>

                            {/* CUSTOM DROPDOWN ICON */}
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <MdOutlineKeyboardArrowDown size={20} color="#252525" />
                            </span>

                            <label
                              htmlFor={`quantity-unit-${index}`}
                              className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] top-[-9px] leading-none"
                            >
                              Unit
                            </label>
                          </div>

                        </div>

                        {/* Nutrition Info */}
                        <div className="flex flex-col gap-3">
                          {/* Calories (kcal) */}
                          {/* <div className="flex gap-[7px]">
                          <div className="relative flex-1">
                            <input
                              id={`calories-${index}`}
                              type="text"
                              placeholder=" "
                              className="peer block w-full py-[15px] pl-[19px] pr-[13px] text-[14px] text-[#252525] bg-white border border-[#E1E6ED] rounded-[8px] outline-none placeholder-transparent focus:border-blue-600"
                              value={item.caloriesValue}
                              onChange={(e) =>
                                updateFoodItem(
                                  index,
                                  "caloriesValue",
                                  e.target.value
                                )
                              }
                            />
                            <label
                              htmlFor={`calories-${index}`}
                              className="pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]"
                            >
                              Calories
                            </label>
                          </div>

                          <div className="relative w-[90px]">
                            <input
                              readOnly
                              type="text"
                              placeholder=" "
                              className="peer block w-full py-[15px] pl-[19px] pr-[15px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] bg-white border border-[#E1E6ED] rounded-[8px] placeholder-transparent focus:border-blue-600"
                              value={item.caloriesUnit}
                              onChange={(e) =>
                                updateFoodItem(
                                  index,
                                  "caloriesUnit",
                                  sanitizeUnitInput(e.target.value)
                                )
                              }
                            />
                            <label className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#9CA3AF] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
                              Unit
                            </label>
                          </div>
                        </div> */}

                          {/* Calories (value + unit with symmetric floating labels) */}
                          {/* Calories */}
                          <div className="flex flex-col">
                            <div className="relative flex-1 max-w-[140px]">

                              {/* Input */}
                              <input
                                type="text"
                                placeholder=" "
                                className="peer block w-full py-[15px] pl-[19px] pr-[60px] outline-none text-[#252525] text-[14px] bg-white border border-[#E1E6ED] rounded-[8px] placeholder-transparent focus:border-blue-600"
                                value={item.caloriesValue}
                                onChange={(e) => updateFoodItem(index, "caloriesValue", e.target.value)}
                              />

                              {/* Unit Block */}
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[70%] flex items-center pr-[16px]">
                                <div className="relative h-full flex items-center pl-[12px] border-l border-[#E1E6ED]">

                                  {/* Unit value */}
                                  <span className="text-[14px] text-[#252525]">
                                    {item.caloriesUnit || "kcal"}
                                  </span>

                                  {/* Unit label */}
                                  <span className="absolute -top-3 right-0 bg-white px-1 text-[11px] text-[#A1A1A1] leading-none">
                                    Unit
                                  </span>
                                </div>
                              </div>

                              {/* Floating Label */}
                              <label
                                className="
        pointer-events-none absolute 
        left-[16px] bg-white px-1 text-[14px] text-[#A1A1A1]
        transition-all duration-200 ease-out
        top-1/2 -translate-y-1/2
        peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600
        peer-[&:not(:placeholder-shown)]:top-2 
        peer-[&:not(:placeholder-shown)]:-translate-y-4 
        peer-[&:not(:placeholder-shown)]:scale-75 
        peer-[&:not(:placeholder-shown)]:text-[#535359]
      "
                              >
                                Calories
                              </label>

                            </div>
                          </div>




                          {/* Protein, Fat, Carbs */}
                          <div className="flex gap-2">
                            {/* Protein (g) */}
                            {/* <div className="flex flex-col">
                            <div className="flex gap-2">
                              <div className="relative flex-1 max-w-[90px]">
                                <input
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[15px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] bg-white border  rounded-[8px] placeholder-transparent"
                                  value={item.proteinValue}
                                  onChange={(e) =>
                                    updateFoodItem(
                                      index,
                                      "proteinValue",
                                      e.target.value
                                    )
                                  }
                                />
                                <label className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#A1A1A1] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-[#252525] peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
                                  Protein
                                </label>
                              </div>
                              <div className="relative max-w-[70px]">
                                <input
                                  readOnly
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[15px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] bg-white border  rounded-[8px] placeholder-transparent"
                                  value={item.proteinUnit}
                                  onChange={(e) =>
                                    updateFoodItem(
                                      index,
                                      "proteinUnit",
                                      sanitizeUnitInput(e.target.value)
                                    )
                                  }
                                />
                                <label className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#A1A1A1] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-[#DA5747] peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
                                  Unit
                                </label>
                              </div>
                            </div>
                          </div> */}


                            {/* Protein (value + unit with symmetric floating labels) */}
                            {/* Protein */}
                            <div className="flex flex-col">
                              <div className="relative flex-1 max-w-[140px]">

                                {/* Input */}
                                <input
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[60px] outline-none text-[#252525] text-[14px] bg-white border border-[#E1E6ED] rounded-[8px] placeholder-transparent focus:border-blue-600"
                                  value={item.proteinValue}
                                  onChange={(e) => updateFoodItem(index, "proteinValue", e.target.value)}
                                />

                                {/* Unit Block */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[70%] flex items-center pr-[16px]">
                                  <div className="relative h-full flex items-center pl-[12px] border-l border-[#E1E6ED]">

                                    {/* Unit value */}
                                    <span className="text-[14px] text-[#252525]">
                                      {item.proteinUnit || "g"}
                                    </span>

                                    {/* Unit label */}
                                    <span className="absolute -top-3 right-0 bg-white px-1 text-[11px] text-[#A1A1A1] leading-none">
                                      Unit
                                    </span>
                                  </div>
                                </div>

                                {/* Floating Label */}
                                <label
                                  className="
        pointer-events-none absolute 
        left-[16px] bg-white px-1 text-[14px] text-[#A1A1A1]
        transition-all duration-200 ease-out
        top-1/2 -translate-y-1/2
        peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600
        peer-[&:not(:placeholder-shown)]:top-2 
        peer-[&:not(:placeholder-shown)]:-translate-y-4 
        peer-[&:not(:placeholder-shown)]:scale-75 
        peer-[&:not(:placeholder-shown)]:text-[#535359]
      "
                                >
                                  Protein
                                </label>

                              </div>
                            </div>




                            {/* Fat (g) */}
                            <div className="flex flex-col">
                              {/* <div className="flex gap-2">
                              <div className="relative flex-1 max-w-[90px]">
                                <input
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[15px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] bg-white border rounded-[8px] placeholder-transparent"
                                  value={item.fatValue}
                                  onChange={(e) =>
                                    updateFoodItem(
                                      index,
                                      "fatValue",
                                      e.target.value
                                    )
                                  }
                                />
                                <label className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#A1A1A1] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-[#DA5747] peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
                                  Fat
                                </label>
                              </div>
                              <div className="relative max-w-[70px]">
                                <input
                                  readOnly
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[15px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] bg-white border  rounded-[8px] placeholder-transparent"
                                  value={item.fatUnit}
                                  onChange={(e) =>
                                    updateFoodItem(
                                      index,
                                      "fatUnit",
                                      sanitizeUnitInput(e.target.value)
                                    )
                                  }
                                />
                                <label className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#A1A1A1] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-[#DA5747] peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
                                  Unit
                                </label>
                              </div>
                            </div> */}

                              {/* Fat (value + unit with symmetric floating labels) */}
                              {/* Fat */}
                              <div className="flex flex-col">
                                <div className="relative flex-1 max-w-[140px]">

                                  {/* Input */}
                                  <input
                                    type="text"
                                    placeholder=" "
                                    className="peer block w-full py-[15px] pl-[19px] pr-[60px] outline-none text-[#252525] text-[14px] bg-white border border-[#E1E6ED] rounded-[8px] placeholder-transparent focus:border-blue-600"
                                    value={item.fatValue}
                                    onChange={(e) => updateFoodItem(index, "fatValue", e.target.value)}
                                  />

                                  {/* Unit Block */}
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[70%] flex items-center pr-[16px]">
                                    <div className="relative h-full flex items-center pl-[12px] border-l border-[#E1E6ED]">

                                      {/* Unit value */}
                                      <span className="text-[14px] text-[#252525]">
                                        {item.fatUnit || "g"}
                                      </span>

                                      {/* Unit label */}
                                      <span className="absolute -top-3 right-0 bg-white px-1 text-[11px] text-[#A1A1A1] leading-none">
                                        Unit
                                      </span>
                                    </div>
                                  </div>

                                  {/* Floating Label */}
                                  <label
                                    className="
        pointer-events-none absolute 
        left-[16px] bg-white px-1 text-[14px] text-[#A1A1A1]
        transition-all duration-200 ease-out
        top-1/2 -translate-y-1/2
        peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600
        peer-[&:not(:placeholder-shown)]:top-2 
        peer-[&:not(:placeholder-shown)]:-translate-y-4 
        peer-[&:not(:placeholder-shown)]:scale-75 
        peer-[&:not(:placeholder-shown)]:text-[#535359]
      "
                                  >
                                    Fat
                                  </label>

                                </div>
                              </div>


                            </div>

                            {/* Carbs (g) */}
                            {/* <div className="flex flex-col">
                            <div className="flex gap-2">
                              <div className="relative flex-1 max-w-[90px]">
                                <input
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[15px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] bg-white border rounded-[8px] placeholder-transparent"
                                  value={item.carbsValue}
                                  onChange={(e) =>
                                    updateFoodItem(
                                      index,
                                      "carbsValue",
                                      e.target.value
                                    )
                                  }
                                />
                                <label className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#A1A1A1] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-[#DA5747] peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
                                  Carbs
                                </label>
                              </div>
                              <div className="relative max-w-[70px]">
                                <input
                                  readOnly
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[15px] outline-none text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] bg-white border  rounded-[8px] placeholder-transparent"
                                  value={item.carbsUnit}
                                  onChange={(e) =>
                                    updateFoodItem(
                                      index,
                                      "carbsUnit",
                                      sanitizeUnitInput(e.target.value)
                                    )
                                  }
                                />
                                <label className="whitespace-nowrap pointer-events-none absolute left-[19px] bg-white px-2 text-[14px] text-[#A1A1A1] transition-all duration-200 ease-out top-1/2 -translate-y-1/2 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-[#DA5747] peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:-translate-y-4 peer-[&:not(:placeholder-shown)]:scale-75 peer-[&:not(:placeholder-shown)]:text-[#535359]">
                                  Unit
                                </label>
                              </div>
                            </div>
                          </div> */}


                            {/* Carbs (value + unit with symmetric floating labels) */}
                            {/* Carbs (value + unit, unit always visible, stable position) */}
                            <div className="flex flex-col">
                              <div className="relative flex-1 max-w-[140px]">
                                {/* Input */}
                                <input
                                  type="text"
                                  placeholder=" "
                                  className="peer block w-full py-[15px] pl-[19px] pr-[60px] outline-none text-[#252525] text-[14px] bg-white border border-[#E1E6ED] rounded-[8px] placeholder-transparent focus:border-blue-600"
                                  value={item.carbsValue}
                                  onChange={(e) => updateFoodItem(index, "carbsValue", e.target.value)}
                                />

                                {/* Unit + divider + its label – all locked together */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[70%] flex items-center pr-[16px]">
                                  <div className="relative h-full flex items-center pl-[12px] border-l border-[#E1E6ED]">
                                    {/* Unit value (always visible) */}
                                    <span className="text-[14px] text-[#252525]">
                                      {item.carbsUnit || "g"}
                                    </span>

                                    {/* Small 'Unit' tag above, but tied to this block */}
                                    <span className="absolute -top-3 right-0 bg-white px-1 text-[11px] text-[#A1A1A1] leading-none">
                                      Unit
                                    </span>
                                  </div>
                                </div>

                                {/* Floating Label — Carbs (Left) */}
                                <label
                                  className="
        pointer-events-none absolute 
        left-[16px] 
        bg-white px-1 
        text-[14px] text-[#A1A1A1]
        transition-all duration-200 ease-out
        top-1/2 -translate-y-1/2
        peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-blue-600
        peer-[&:not(:placeholder-shown)]:top-2 
        peer-[&:not(:placeholder-shown)]:-translate-y-4 
        peer-[&:not(:placeholder-shown)]:scale-75 
        peer-[&:not(:placeholder-shown)]:text-[#535359]
      "
                                >
                                  Carbs
                                </label>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}



                <div>

                </div>


              </div>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-2.5 py-[15px] px-[7px] text-[#308BF9] font-semibold 
               leading-normal tracking-[-0.24px] text-[12px] cursor-pointer
               bg-transparent border-none outline-none"
              >
                Add Alternative Item
              </button>
            </div>
          </div>

          <button className="bg-white text-[#252525] px-3 py-1 rounded-md cursor-pointer"
            onClick={onClose}
          >x</button>
        </div>
      </div>

    </>
  );
});

export default DietEventPopUp;