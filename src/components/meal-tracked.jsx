
"use client";
import { useState } from "react";
import Image from "next/image";
import { IoIosArrowUp, IoIosArrowDown } from "react-icons/io";

export default function MealTracked({
  activeFilter = "all",
  weeklyAnalysisData = [],
}) {
  const [openItems, setOpenItems] = useState({});

  // ===== Helpers =====
  const splitBrief = (brief = "") => {
    const parts = brief
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.?!])\s+/)
      .filter(Boolean);
    return {
      fatGlucoseImpact: parts[0] || "-",
      liverImpact: parts[1] || "-",
      gutImpact: parts[2] || "-",
    };
  };

  const levelFromScore = (s) => {
    if (s === null || s === undefined) return null;
    if (s <= 60) return "Low";
    if (s <= 79) return "Moderate";
    return "High";
  };

  const strokeColorFromLevel = (lvl) => {
    if (lvl === "High") return "#3FAF58";
    if (lvl === "Moderate") return "#FFBF2D";
    if (lvl === "Low") return "#E48326";
    return null;
  };

  // Convert score (0..100) to SVG end-x for "M3 3H{end}"
  const strokeWidthFromScore = (s) => {
    if (s === null || s === undefined) return 0;
    return Math.round(3 + (Math.max(0, Math.min(100, s)) / 100) * 111); // 3..114
  };

  // ===== Transform ONLY dynamic API data =====
  const allMealItems = Array.isArray(weeklyAnalysisData)
    ? weeklyAnalysisData.map((it, idx) => {
        const score =
          typeof it.metabolic_compatibility_score === "number"
            ? it.metabolic_compatibility_score
            : null;
        const level = levelFromScore(score);
        const { fatGlucoseImpact, liverImpact, gutImpact } = splitBrief(
          it.brief_intervention || ""
        );
        return {
          id: idx + 1, // internal id; UI will show sequential index anyway
          score,
          level,
          strokeColor: strokeColorFromLevel(level),
          strokeWidth: strokeWidthFromScore(score),
          icon: "/icons/hugeicons_plant-04.svg",
          name: it.food || "-",
          calories: "-", // not provided by API
          portion: "-", // not provided by API
          fatGlucoseImpact,
          liverImpact,
          gutImpact,
          goalAlignment: it.goal_alignment || "-",
          goalAlignmentNote: it.goal_alignment_note || "-",
        };
      })
    : [];

  const categorizeItems = (items) => {
    const categorized = { low: [], moderate: [], high: [], others: [] };
    items.forEach((item) => {
      if (item.score === null || item.score === undefined) {
        categorized.others.push(item);
      } else if (item.score >= 0 && item.score <= 60) {
        categorized.low.push(item);
      } else if (item.score >= 61 && item.score <= 79) {
        categorized.moderate.push(item);
      } else if (item.score >= 80 && item.score <= 100) {
        categorized.high.push(item);
      }
    });
    return categorized;
  };

  const categorizedItems = categorizeItems(allMealItems);

  const getFilteredItems = () => {
    switch (activeFilter) {
      case "low":
        return categorizedItems.low;
      case "moderate":
        return categorizedItems.moderate;
      case "high":
        return categorizedItems.high;
      case "others":
        return categorizedItems.others;
      case "all":
      default:
        return allMealItems;
    }
  };

  const filteredItems = getFilteredItems();

  const toggleItem = (id) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const MealItem = ({ item, index }) => (
    <div className="flex flex-col gap-5 p-[15px] rounded-[15px] bg-[#FFFFFF]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center">
          {/* {item.icon && (
            <Image src={item.icon} alt="Food icon" width={24} height={24} />
          )} */}
          {/* <div className="py-[3px] px-[9px]">
            <span className="text-[#252525] text-[15px] font-bold tracking-[-0.3px] leading-[126%]">
              {index + 1}
            </span>
          </div> */}
        </div>

        <div className="flex flex-1 justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex gap-3 items-center">
             <div className="py-[3px] px-[9px]">
            <span className="text-[#252525] text-[15px] font-bold tracking-[-0.3px] leading-[126%]">
              {index + 1}
            </span>
          </div>
            <div>
              <p className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">
                {item.name}
              </p>
            </div>
            </div>
            {/* <div className="flex items-center gap-[5px]">
              <span className="text-[#252525] text-[10px] not-italic font-normal leading-normal tracking-[-0.2px]">
                {item.calories}
              </span>
              <span className="text-[#252525] text-[10px] not-italic font-normal leading-normal tracking-[-0.2px]">
                {item.portion}
              </span>
              {item.icon && (
                <Image
                  src="/icons/hugeicons_information-circle.svg"
                  alt="Info"
                  width={12}
                  height={12}
                  className="cursor-pointer"
                />
              )}
            </div> */}
          </div>

          <div className="flex gap-3 items-center px-5 py-[15px] rounded-[8px] bg-[#F5F7FA]">
            <span className="text-[#535359] text-[10px] not-italic font-semibold leading-[110%] tracking-[-0.2px] capitalize">
              Metabolic <br /> Compatibility Score
            </span>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] leading-[126%]">
                  {item.score ?? "-"}
                </span>
                <div className="w-px h-4 bg-[#D9D9D9]" />
                <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] leading-[126%]">
                  {item.level || "-"}
                </span>
              </div>

              <div className="flex justify-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="117"
                  height="6"
                  viewBox="0 0 117 6"
                  fill="none"
                >
                  <path
                    d="M3 3H114"
                    stroke="#D9D9D9"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  {item.strokeColor && item.strokeWidth > 3 && (
                    <path
                      d={`M3 3H${item.strokeWidth}`}
                      stroke={item.strokeColor}
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {item.score !== null && item.score !== undefined && (
        <div className="flex items-center w-full">
          <div className="flex-1 h-px bg-[#D9D9D9]" />
          <div
            className="flex items-center gap-[5px] ml-2 cursor-pointer"
            onClick={() => toggleItem(item.id)}
          >
            <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">
              {openItems[item.id] ? "View Less" : "View More"}
            </span>
            {openItems[item.id] ? (
              <IoIosArrowUp className="text-[#308BF9] w-[15px] h-[15px]" />
            ) : (
              <IoIosArrowDown className="text-[#308BF9] w-[15px] h-[15px]" />
            )}
          </div>
        </div>
      )}

      {openItems[item.id] &&
        item.score !== null &&
        item.score !== undefined && (
          <>
            <div className="flex flex-col gap-5">
              <div className="flex gap-3 items-center ml:[25px] mr:[67px] ml-[25px] mr-[67px]">
                <p className="w-[118px] text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Fat/Glucose Impact
                </p>
                <div>
                  <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">
                    {item.fatGlucoseImpact || "-"}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 items-center ml-[25px] mr-[67px]">
                <p className="w-[118px] text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Liver Impact
                </p>
                <div>
                  <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">
                    {item.liverImpact || "-"}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 items-center ml-[25px] mr-[67px]">
                <p className="w-[118px] text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  Gut Impact
                </p>
                <div>
                  <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">
                    {item.gutImpact || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8  pl-2.5 pr-4 pt-4 pb-[18px] bg-[#F0F5FD] rounded-[10px]">
              <div className="flex gap-[5px] items-center max-w-[118px]">
                <Image
                  src="/icons/hugeicons_award-01.svg"
                  alt="Award"
                  width={15}
                  height={15}
                />
                <span className="bg-gradient-to-r from-[#308BF9] to-[#1C5293] bg-clip-text text-transparent font-bold text-[12px] tracking-[-0.24px]">
                  Goal Alignment
                </span>
              </div>
              <div className="flex-1">
                <p className="text-[#252525] text-[10px] font-normal leading-[126%] tracking-[-0.2px]">
                  <span className="font-semibold">{item.goalAlignment}</span>
                  {item.goalAlignment && item.goalAlignmentNote ? ": " : " "}
                  {item.goalAlignmentNote || "-"}
                </p>
              </div>
            </div>
          </>
        )}
    </div>
  );

  const OthersItem = ({ item, index }) => (
    <div
      key={index}
      className="flex flex-col gap-5 p-[15px] rounded-[15px] bg-[#E1E6ED]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center">
          <div className="flex flex-col gap-1 py-[3px] px-[9px]">
            <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] leading-[126%]">
              Other
            </span>
            <div className="h-[15px]"></div>
          </div>
        </div>

        <div className="flex flex-1 justify-between">
          <div className="flex flex-col gap-1">
            <div>
              <p className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]"></p>
            </div>
            <div className="flex items-center gap-[5px]">
              <span className="text-[#252525] text-[10px] not-italic font-normal leading-normal tracking-[-0.2px]"></span>
              <span className="text-[#252525] text-[10px] not-italic font-normal leading-normal tracking-[-0.2px]"></span>
            </div>
          </div>

          <div className="flex gap-3 items-center px-5 py-[15px] rounded-[8px] bg-[#F5F7FA]">
            <span className="text-[#535359] text-[10px] not-italic font-semibold leading-[110%] tracking-[-0.2px] capitalize">
              Metabolic <br /> Compatibility Score
            </span>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] leading-[126%]">
                  -
                </span>
                <div className="w-px h-4 bg-[#D9D9D9]" />
                <span className="text-[#252525] text-[12px] font-semibold tracking-[-0.24px] leading-[126%]">
                  -
                </span>
              </div>
              <div className="flex justify-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="117"
                  height="6"
                  viewBox="0 0 117 6"
                  fill="none"
                >
                  <path
                    d="M3 3H114"
                    stroke="#D9D9D9"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="w-full flex flex-col gap-3">
        {filteredItems.map((item, index) =>
          item.score === null || item.score === undefined ? (
            <OthersItem key={index} item={item} index={index} />
          ) : (
            <MealItem key={index} item={item} index={index} />
          )
        )}

        {filteredItems.length === 0 && (
          <div className="flex justify-center items-center p-8 rounded-[15px]">
            <span className="text-[#C0CAD8] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">
              No data available
            </span>
          </div>
        )}
      </div>
    </>
  );
}



// "use client";

// import { useEffect, useRef, useState, useCallback } from "react";
// import Image from "next/image";
// import { IoIosArrowUp, IoIosArrowDown } from "react-icons/io";

// // Observe element height and call setter ONLY if it changed
// function useResizeHeight(ref, setHeight) {
//   const last = useRef(0);

//   useEffect(() => {
//     if (!ref.current) return;
//     const el = ref.current;

//     const report = () => {
//       const h = el.offsetHeight || 0;
//       if (h !== last.current) {
//         last.current = h;
//         setHeight(h);
//       }
//     };

//     // Initial
//     report();

//     const ro = new ResizeObserver(() => report());
//     ro.observe(el);

//     // ensure images trigger a report after load
//     const imgs = el.querySelectorAll("img");
//     imgs.forEach((img) => {
//       if (!img.complete) {
//         img.addEventListener("load", report);
//         img.addEventListener("error", report);
//       }
//     });

//     return () => {
//       ro.disconnect();
//       imgs.forEach((img) => {
//         img.removeEventListener("load", report);
//         img.removeEventListener("error", report);
//       });
//     };
//   }, [ref, setHeight]);
// }

// export default function MealTracked({ categorizedItems, onCategoryHeights }) {
//   const [openItems, setOpenItems] = useState({});

//   // Refs for each category container
//   const lowRef = useRef(null);
//   const moderateRef = useRef(null);
//   const highRef = useRef(null);
//   const othersRef = useRef(null);

//   // Heights per category
//   const [hLow, setHLow] = useState(0);
//   const [hMod, setHMod] = useState(0);
//   const [hHigh, setHHigh] = useState(0);
//   const [hOth, setHOth] = useState(0);

//   useResizeHeight(lowRef, setHLow);
//   useResizeHeight(moderateRef, setHMod);
//   useResizeHeight(highRef, setHHigh);
//   useResizeHeight(othersRef, setHOth);

//   // Only notify parent when the combined object actually changed
//   const lastSent = useRef({ low: 0, moderate: 0, high: 0, others: 0 });
//   useEffect(() => {
//     const next = { low: hLow, moderate: hMod, high: hHigh, others: hOth };
//     const prev = lastSent.current;
//     if (
//       prev.low !== next.low ||
//       prev.moderate !== next.moderate ||
//       prev.high !== next.high ||
//       prev.others !== next.others
//     ) {
//       lastSent.current = next;
//       onCategoryHeights?.(next);
//     }
//   }, [hLow, hMod, hHigh, hOth, onCategoryHeights]);

//   const toggleItem = useCallback(
//     (id) => setOpenItems((p) => ({ ...p, [id]: !p[id] })),
//     []
//   );

//   const MealItem = ({ item }) => (
//     <div className="flex flex-col gap-5 p-[15px] rounded-[15px] bg-[#FFFFFF]">
//       <div className="flex items-start justify-between gap-3">
//         <div className="flex items-center">
//           {item.icon && <Image src={item.icon} alt="Food icon" width={24} height={24} />}
//           <div className="py-[3px] px-[9px]">
//             <span className="text-[#252525] text-[15px] font-bold tracking-[-0.3px] leading-[126%]">
//               {item.id}
//             </span>
//           </div>
//         </div>

//         <div className="flex flex-1 justify-between">
//           <div className="flex flex-col gap-1">
//             <div>
//               <p className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">
//                 {item.name}
//               </p>
//             </div>
//             <div className="flex items-center gap-[5px]">
//               <span className="text-[#252525] text-[10px]">{item.calories}</span>
//               <span className="text-[#252525] text-[10px]">{item.portion}</span>
//               {item.icon && (
//                 <Image
//                   src="/icons/hugeicons_information-circle.svg"
//                   alt="Info"
//                   width={12}
//                   height={12}
//                   className="cursor-pointer"
//                 />
//               )}
//             </div>
//           </div>

//           <div className="flex gap-3 items-center px-5 py-[15px] rounded-[8px] bg-[#F5F7FA]">
//             <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">
//               Metabolic <br /> Compatibility Score
//             </span>

//             <div className="flex flex-col gap-2.5">
//               <div className="flex items-center gap-2.5">
//                 <span className="text-[#252525] text-[12px] font-semibold">{item.score ?? "-"}</span>
//                 <div className="w-px h-4 bg-[#D9D9D9]" />
//                 <span className="text-[#252525] text-[12px] font-semibold">{item.level ?? "-"}</span>
//               </div>

//               <div className="flex justify-start">
//                 <svg xmlns="http://www.w3.org/2000/svg" width="117" height="6" viewBox="0 0 117 6" fill="none">
//                   <path d="M3 3H114" stroke="#D9D9D9" strokeWidth="5" strokeLinecap="round" />
//                   {!!item.strokeColor && (
//                     <path d={`M3 3H${item.strokeWidth}`} stroke={item.strokeColor} strokeWidth="5" strokeLinecap="round" />
//                   )}
//                 </svg>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {item.score !== null && (
//         <div className="flex items-center w-full">
//           <div className="flex-1 h-px bg-[#D9D9D9]" />
//           <div
//             className="flex items-center gap-[5px] ml-2 cursor-pointer"
//             onClick={() => toggleItem(item.id)}
//           >
//             <span className="text-[#308BF9] text-[12px] font-semibold">
//               {openItems[item.id] ? "View Less" : "View More"}
//             </span>
//             {openItems[item.id] ? (
//               <IoIosArrowUp className="text-[#308BF9] w-[15px] h-[15px]" />
//             ) : (
//               <IoIosArrowDown className="text-[#308BF9] w-[15px] h-[15px]" />
//             )}
//           </div>
//         </div>
//       )}

//       {openItems[item.id] && item.score !== null && (
//         <>
//           <div className="flex flex-col gap-5">
//             <div className="flex gap-3 items-center ml-[25px] mr-[67px]">
//               <p className="w-[118px] text-[#535359] text-[10px] font-semibold">Fat/Glucose Impact</p>
//               <span className="text-[#535359] text-[10px]">
//                 Protein stabilizes glycemia (29%) and supports fat oxidation (71%)
//               </span>
//             </div>
//             <div className="flex gap-3 items-center ml-[25px] mr-[67px]">
//               <p className="w-[118px] text-[#535359] text-[10px] font-semibold">Liver Impact</p>
//               <span className="text-[#535359] text-[10px]">Keep free sugars low; protect detox pathways (detox ~70%)</span>
//             </div>
//             <div className="flex gap-3 items-center ml-[25px] mr-[67px]">
//               <p className="w-[118px] text-[#535359] text-[10px] font-semibold">Gut Impact</p>
//               <span className="text-[#535359] text-[10px]">
//                 Gentle choice — supports absorption (~59%) with lower fermentation (~27%)
//               </span>
//             </div>
//           </div>

//           <div className="flex gap-8 items-start pl-2.5 pr-4 pt-4 pb-[18px] bg-[#F0F5FD] rounded-[10px]">
//             <div className="flex gap-[5px] items-center max-w-[118px]">
//               <Image src="/icons/hugeicons_award-01.svg" alt="Award" width={15} height={15} />
//               <span className="bg-gradient-to-r from-[#308BF9] to-[#1C5293] bg-clip-text text-transparent font-bold text-[12px]">
//                 Goal Alignment
//               </span>
//             </div>
//             <div className="flex-1">
//               <p className="text-[#252525] text-[10px]">
//                 Oats are high in carbohydrates, which can hinder fat loss by maintaining glucose reliance. The fiber
//                 content, while generally healthy, may contribute to the high fermentation observed.
//               </p>
//             </div>
//           </div>
//         </>
//       )}

//       {item.score === null && (
//         <div className="flex gap-3 w-full">
//           <div className="flex items-start py-2 w-[118px] px-[9px]">
//             <span className="text-[#535359] text-[10px] font-semibold">Description</span>
//           </div>
//           <div className="flex">
//             <span className="text-[#252525] text-[10px]">
//               {item.description}
//             </span>
//           </div>
//         </div>
//       )}
//     </div>
//   );

//   const OthersItem = ({ item }) => (
//     <div key={item.id} className="flex flex-col gap-5 p-[15px] rounded-[15px] bg-[#E1E6ED]">
//       <div className="flex items-start justify_between gap-3">
//         <div className="flex items-center">
//           <div className="flex flex-col gap-1 py-[3px] px-[9px]">
//             <span className="text-[#252525] text-[12px] font-semibold leading-[126%]">Other</span>
//             <div className="h-[15px]" />
//           </div>
//         </div>

//         <div className="flex flex-1 justify_between">
//           <div className="flex flex-col gap-1" />
//           <div className="flex gap-3 items-center px-5 py-[15px] rounded-[8px] bg-[#F5F7FA]">
//             <span className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
//               Metabolic <br /> Compatibility Score
//             </span>
//             <div className="flex flex-col gap-2.5">
//               <div className="flex items-center gap-2.5">
//                 <span className="text-[#252525] text-[12px] font-semibold">-</span>
//                 <div className="w-px h-4 bg-[#D9D9D9]" />
//                 <span className="text-[#252525] text-[12px] font-semibold">-</span>
//               </div>
//               <div className="flex justify-start">
//                 <svg xmlns="http://www.w3.org/2000/svg" width="117" height="6" viewBox="0 0 117 6" fill="none">
//                   <path d="M3 3H114" stroke="#D9D9D9" strokeWidth="5" strokeLinecap="round" />
//                 </svg>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="flex gap-3 w-full">
//         <div className="flex items-start py-2 w-[118px] px-[9px]">
//           <span className="text-[#535359] text-[10px] font-semibold">Description</span>
//         </div>
//         <div className="flex">
//           <span className="text-[#252525] text-[10px]">{item.description}</span>
//         </div>
//       </div>
//     </div>
//   );

//   return (
//     <div className="w-full flex flex-col gap-3">
//       {/* Each category block wrapped with refs for height measurement */}
//       <div ref={lowRef} className="flex flex-col gap-3">
//         {categorizedItems.low.map((item) => <MealItem key={item.id} item={item} />)}
//       </div>

//       <div ref={moderateRef} className="flex flex-col gap-3">
//         {categorizedItems.moderate.map((item) => <MealItem key={item.id} item={item} />)}
//       </div>

//       <div ref={highRef} className="flex flex-col gap-3">
//         {categorizedItems.high.map((item) => <MealItem key={item.id} item={item} />)}
//       </div>

//       <div ref={othersRef} className="flex flex-col gap-3">
//         {categorizedItems.others.map((item) => <OthersItem key={item.id} item={item} />)}
//       </div>
//     </div>
//   );
// }
