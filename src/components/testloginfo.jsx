

// "use client";

// import { useState, useRef, useEffect } from "react";
// import { useSearchParams } from "next/navigation";

// import { toast } from "sonner";
// import {
//   submitPlanSummaryService,
//   fetchTestRemaining,
// } from "../services/authService";
// import { setExtractedData } from "@/store/extractedDataSlice";
// import { cookieManager } from "../lib/cookies";
// import { useDispatch, useSelector } from "react-redux";
// import { setIsExtracting } from "@/store/extractionSlice";

// export default function TestLogInfo({ onConfirmNext }) {
//   const searchParams = useSearchParams();
//   const profileId = searchParams.get("profile_id");

//   // 🔑 SAME PATTERN AS Summary.jsx
//   const storageKey = profileId
//     ? `planSummary_${profileId}`
//     : "planSummary_default";

//   const [testsAllotted, setTestsAllotted] = useState(""); // for payload
//   const [planDays, setPlanDays] = useState(""); // shown in "No of Tests allotted"
//   const [baseRemaining, setBaseRemaining] = useState(0); // API remaining
//   const [testRemaining, setTestRemaining] = useState(0); // remaining - planDays

//   // Store subtraction result separately, used in visible "Test remaining"
//   const [subtractionResult, setSubtractionResult] = useState(0);


//   const [isLoading, setIsLoading] = useState(false);
//   const isExtracting = useSelector((state) => state.extraction.isExtracting);
//   const [apiResponse, setApiResponse] = useState(null);
// const [isSavingDraft, setIsSavingDraft] = useState(false);

//   const [progress, setProgress] = useState(0);
//   const rafRef = useRef(null);
//   const startTimeRef = useRef(0);
//   const targetMsRef = useRef(0);
//   const capRef = useRef(0);
//   const runningRef = useRef(false);

//   const [errors, setErrors] = useState({ testsAllotted: "" });

//   const clientProfile = useSelector((state) => state.clientProfile.data);
//   const dispatch = useDispatch();

//   // ========= 1) Fetch remaining from TESTREMAINING API =========
//   useEffect(() => {
//     const fetchRemainingFromApi = async () => {
//       try {
//         const dieticianCookie = cookieManager.getJSON("dietician");
//         const dietitianId = dieticianCookie?.dietician_id;

//         if (!dietitianId) {
//           console.warn("No dietitian_id in cookie");
//           return;
//         }

//         const resp = await fetchTestRemaining(dietitianId);

//         if (resp?.success) {
//           const remainingFromApi = parseInt(resp.remaining, 10) || 0;
//           setBaseRemaining(remainingFromApi);
//           setTestRemaining(remainingFromApi); // initial, before subtracting
//         } else {
//           setBaseRemaining(0);
//           setTestRemaining(0);
//         }
//       } catch (err) {
//         console.error("Error fetching remaining tests:", err);
//       }
//     };

//     fetchRemainingFromApi();
//   }, []);

//   // ========= 2) Helpers =========

//   // ⏱ Calculate number of days from two YYYY-MM-DD dates (inclusive)
//   const calculatePlanDays = (startDate, endDate) => {
//     if (!startDate || !endDate) return "";

//     const start = new Date(startDate);
//     const end = new Date(endDate);

//     if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

//     const timeDiff = end.getTime() - start.getTime();
//     const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // include both start & end

//     return daysDiff > 0 ? `${daysDiff}` : "";
//   };

//   const loadFromLocalStorage = () => {
//     try {
//       if (typeof window === "undefined") return;

//       const savedData = localStorage.getItem(storageKey);
  

//       if (savedData) {
//         const data = JSON.parse(savedData);

//         // If tests already stored earlier
//         if (data.test_no_assigned) {
//           setTestsAllotted(String(data.test_no_assigned));
//         }

//         // Calculate planDays using dates saved by Summary (YYYY-MM-DD)
//         if (data.plan_start_date && data.plan_end_date) {
//           const calculatedDays = calculatePlanDays(
//             data.plan_start_date,
//             data.plan_end_date
//           );
//           setPlanDays(calculatedDays || "");
//         }
//       }
//     } catch (error) {
//       console.error("Error loading from localStorage:", error);
//     }
//   };

//   useEffect(() => {
//     loadFromLocalStorage();
//   }, [storageKey]);

//   // ========= 3) Subtraction logic (CORE) =========
//   useEffect(() => {
//     const allotted = parseInt(planDays, 10) || 0;

//     const remaining = parseInt(baseRemaining, 10) || 0;

//     // sync testsAllotted with planDays (for submit)
//     setTestsAllotted(allotted ? String(allotted) : "");

//     const finalRemaining = remaining - allotted;

//     const result = finalRemaining >= 0 ? finalRemaining : 0;
//     setTestRemaining(result);
//     setSubtractionResult(result);
//   }, [planDays, baseRemaining]);

//   // ========= 4) Progress bar helpers =========
//   const startProgress = (targetMs = 300000, cap = 98) => {
//     cancelProgress();
//     startTimeRef.current = Date.now();
//     targetMsRef.current = targetMs;
//     capRef.current = Math.min(99, Math.max(50, cap));
//     runningRef.current = true;
//     setProgress(0);

//     const tick = () => {
//       if (!runningRef.current) return;
//       const elapsed = Date.now() - startTimeRef.current;
//       const pct = Math.min(
//         capRef.current,
//         Math.floor((elapsed / targetMsRef.current) * capRef.current)
//       );
//       setProgress(pct);
//       rafRef.current = requestAnimationFrame(tick);
//     };
//     rafRef.current = requestAnimationFrame(tick);
//   };

//   const completeProgress = () => {
//     runningRef.current = false;
//     if (rafRef.current) cancelAnimationFrame(rafRef.current);
//     setProgress(100);
//   };

//   const resetProgress = () => {
//     runningRef.current = false;
//     if (rafRef.current) cancelAnimationFrame(rafRef.current);
//     setProgress(0);
//   };

//   const cancelProgress = () => {
//     runningRef.current = false;
//     if (rafRef.current) cancelAnimationFrame(rafRef.current);
//   };

//   // ========= 5) Cookie Reader for submit =========
//   function getCookie(name) {
//     const m = document.cookie.match(
//       new RegExp(
//         "(?:^|; )" + name.replace(/([$?*|{}\\^])/g, "\\$1") + "=([^;]*)"
//       )
//     );
//     return m ? decodeURIComponent(m[1]) : "";
//   }

//   // ========= 6) Validation / Save =========
//   const validateForm = () => {
//     let ok = true;
//     const next = { testsAllotted: "" };

//     if (!testsAllotted || testsAllotted.toString().trim() === "") {
//       next.testsAllotted = "Enter tests assigned";
//       ok = false;
//     } else if (isNaN(testsAllotted) || parseInt(testsAllotted, 10) <= 0) {
//       next.testsAllotted = "Enter a valid positive number";
//       ok = false;
//     }

//     setErrors(next);
//     if (!ok) toast.error("Please fix the highlighted fields");
//     return ok;
//   };

//   const saveToLocalStorage = (isDraft = false) => {
//     if (!isDraft && !validateForm()) return;

//     const existingData =
//       typeof window !== "undefined"
//         ? localStorage.getItem(storageKey)
//         : null;

//     let planSummary = existingData ? JSON.parse(existingData) : {};

//     planSummary = {
//       ...planSummary,
//       test_no_assigned: parseInt(testsAllotted, 10) || 0,
//     };

//     if (isDraft) planSummary.isDraft = true;

//     if (typeof window !== "undefined") {
//       localStorage.setItem(storageKey, JSON.stringify(planSummary));
//     }
//   };

//   // const handleSaveAsDraft = () => saveToLocalStorage(true);

// const handleSaveAsDraft = () => {
//   setIsSavingDraft(true);

//   try {
//     saveToLocalStorage(true);
//     toast.success("Draft saved");
//   } catch (error) {
//     console.error("Error saving draft:", error);
//     toast.error("Failed to save draft");
//   } finally {
//     // small delay so user can see the state change
//     setTimeout(() => {
//       setIsSavingDraft(false);
//     }, 400);
//   }
// };


//   // ========= 7) Extract Diet PDF =========
//   const extractDietPdf = async ({ dieticianId, clientId, dietplanId }) => {
//     const savedPdf =
//       typeof window !== "undefined"
//         ? localStorage.getItem("uploadedPdfFile")
//         : null;

//     if (!savedPdf) {
//       toast.error("No PDF found. Please upload a file first.");
//       return false;
//     }

//     try {
//       dispatch(setIsExtracting(true));
//       toast.message("Extracting PDF…");
//       startProgress(300000, 98);

//       const pdfData = JSON.parse(savedPdf);

//       let pdfFile;

//       if (pdfData.data && pdfData.data.startsWith("data:application/pdf")) {
//         const response = await fetch(pdfData.data);
//         const blob = await response.blob();
//         pdfFile = new File([blob], pdfData.name || "diet_plan.pdf", {
//           type: "application/pdf",
//         });
//       } else if (pdfData.blobUrl) {
//         try {
//           const response = await fetch(pdfData.blobUrl);
//           if (!response.ok) {
//             throw new Error(
//               `Blob URL fetch failed with status: ${response.status}`
//             );
//           }
//           const blob = await response.blob();
//           pdfFile = new File([blob], pdfData.name || "diet_plan.pdf", {
//             type: "application/pdf",
//           });
//         } catch (blobError) {
//           console.error("Blob URL failed:", blobError);
//           throw new Error(
//             "Blob URL is no longer valid. Please re-upload the PDF file."
//           );
//         }
//       } else {
//         throw new Error(
//           "No valid PDF data found in storage. Please re-upload the PDF file."
//         );
//       }

//       if (!pdfFile || pdfFile.size === 0) {
//         throw new Error("Created PDF file is empty or invalid");
//       }

//       const formData = new FormData();
//       formData.append("file", pdfFile);
//       formData.append("login_id", dieticianId || "");
//       formData.append("profile_id", clientId || "");
//       formData.append("dietplan_id", dietplanId || "");

//       for (let [key, value] of formData.entries()) {
//         console.log(`FormData: ${key} =`, value);
//       }

//       const res = await fetch("https://respyr.in/mini/api/extract", {
//         method: "POST",
//         body: formData,
//       });

//       if (!res.ok) {
//         const txt = await res.text().catch(() => "");
//         throw new Error(
//           `Extractor error (${res.status}): ${txt || "Failed to extract"}`
//         );
//       }

//       const json = await res.json();
//       dispatch(setExtractedData(json));

//       try {
//         if (typeof window !== "undefined") {
//           localStorage.setItem("extractedData", JSON.stringify(json));
//         }
//         toast.success("PDF extracted successfully and data saved!");
//       } catch (err) {
//         console.error("Failed to save extractedData to localStorage", err);
//       }

//       completeProgress();
//       toast.success("PDF extracted successfully.");
//       return true;
//     } catch (err) {
//       console.error("Extractor Error:", err);
//       toast.error(err.message || "Failed to extract PDF");
//       resetProgress();
//       return false;
//     } finally {
//       dispatch(setIsExtracting(false));
//       setTimeout(() => {
//         if (!isLoading) resetProgress();
//       }, 600);
//     }
//   };

//   // ========= 8) Submit Plan Summary =========
//   const submitPlanSummary = async () => {
//     if (!validateForm()) {
//       return;
//     }

//     setIsLoading(true);
//     startProgress(8000, 90);

//     try {
//       const planSummaryData =
//         typeof window !== "undefined"
//           ? localStorage.getItem(storageKey)
//           : null;

//       if (!planSummaryData) {
//         toast.error("No plan summary data found");
//         resetProgress();
//         return;
//       }

//       const planSummary = JSON.parse(planSummaryData);
//       const urlParams = new URLSearchParams(window.location.search);
//       const clientId = urlParams.get("profile_id");

//       // FIX: Parse the dietician cookie to extract just the ID
//       const dieticianCookie = getCookie("dietician");

//       let effectiveDieticianId = "";
//       if (dieticianCookie) {
//         try {
//           const dieticianData = JSON.parse(dieticianCookie);
//           effectiveDieticianId = dieticianData.dietician_id || "";
//         } catch (parseError) {
//           console.error("Error parsing dietician cookie:", parseError);
//         }
//       }

//       const effectiveClientId = clientId || "";

//       if (!effectiveDieticianId || !effectiveClientId) {
//         toast.error("Missing dietician ID or client ID (URL/cookie)");
//         resetProgress();
//         return;
//       }

//       const requestBody = {
//         dietitian_id: effectiveDieticianId,
//         client_id: effectiveClientId,
//         plan_title: planSummary.plan_title || "",
//         plan_start_date: planSummary.plan_start_date || "",
//         plan_end_date: planSummary.plan_end_date || "",
//         calories_target: planSummary.calories_target || 0,
//         protein_target: planSummary.protein_target || 0,
//         fiber_target: planSummary.fiber_target || 0,
//         water_target: planSummary.water_target || 0,
//         test_no_assigned: parseInt(testsAllotted, 10) || 0,
//         goal: planSummary.goal || [],
//         approach: planSummary.approach || "",
//         status: "active",
//         diet_type: planSummary.diet_type || "",
//         is_diabetic: planSummary.is_diabetic || false,
//         carbs_target: planSummary.carbs_target || 0,
//         fat_target: planSummary.fat_target || 0,
//       };

//       const resp = await submitPlanSummaryService(requestBody);
//       setApiResponse(resp);

//       if (resp?.status) {
//         completeProgress();
//         toast.success("Plan summary submitted successfully!");

//         const dietplanId = resp?.inserted_data?.id || "";

//         const extractedOk = await extractDietPdf({
//           dieticianId: effectiveDieticianId,
//           clientId: effectiveClientId,
//           dietplanId,
//         });

//         if (extractedOk) {
//           onConfirmNext?.();
//         }
//       } else {
//         toast.error(resp?.message || "Failed to submit plan summary");
//         resetProgress();
//       }
//     } catch (error) {
//       console.error("API Error:", error);
//       toast.error(error.message || "Failed to submit plan summary");
//       resetProgress();
//     } finally {
//       setIsLoading(false);
//       setTimeout(() => {
//         if (!isExtracting) resetProgress();
//       }, 600);
//     }
//   };

//   const handleConfirmNext = () => {
//     const savedPdf =
//       typeof window !== "undefined"
//         ? localStorage.getItem("uploadedPdfFile")
//         : null;

//     if (!savedPdf) {
//       toast.error("Please upload a PDF file before proceeding.");
//       return;
//     }

//     try {
//       const pdfData = JSON.parse(savedPdf);

//       if (!pdfData.data && !pdfData.blobUrl) {
//         toast.error("Invalid PDF data. Please re-upload the PDF file.");
//         return;
//       }
//     } catch (error) {
//       toast.error("Corrupted PDF data. Please re-upload the PDF file.");
//       return;
//     }

//     saveToLocalStorage(false);
//     submitPlanSummary();
//   };

//   // ========= 9) JSX =========
//   return (
//     <>
//       <div className="flex-1 flex-col gap-[310px] h-full">
//         <div className="pt-[23px] pb-[18px] ">
//           <div className="flex justify-between items-center">
//             <p className="text-[#252525] pb-[18px] pt-[23px] text-[20px] font-semibold leading-[110%] tracking-[0.4px] whitespace-nowrap">
//               Test log info
//             </p>
//           </div>

//           <div className="w-full border-b border-[#E1E6ED]"></div>

//           <div className="mt-[15px]">
//             <div className="flex gap-5 items-end">
//               {/* No of Tests allotted (planDays) */}
//               <div className="relative flex-1">
//                 <input
//                   type="text"
//                   id="plan_days"
//                   value={planDays}
//                   readOnly
//                   className={`block py-[15px] pl-[19px] pr-[13px] w-full text-[14px] text-[#252525] bg-white rounded-[8px] border ${
//                     errors.testsAllotted ? "border-[#DA5747]" : "border-[#E1E6ED]"
//                   } focus:outline-none focus:ring-0 focus:border-blue-600 peer`}
//                   placeholder=" "
//                 />
//                 <label
//                   htmlFor="plan_days"
//                   className="absolute text-[14px] text-[#9CA3AF] duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 start-1"
//                 >
//                   No of Tests allotted
//                 </label>

//                 {errors.testsAllotted && (
//                   <p className="mt-1 text-[12px] text-[#DA5747]">
//                     {errors.testsAllotted}
//                   </p>
//                 )}
//               </div>

//               {/* Hidden field: raw testRemaining (not used directly in UI) */}
//               <div className="relative hidden">
//                 <input
//                   type="text"
//                   id="test_remaining"
//                   value={testRemaining}
//                   readOnly
//                   hidden
//                   className="block py-[15px] pl-[19px] pr-[13px] w-full text-[14px] text-[#252525] bg-white rounded-[8px] border border-[#E1E6ED] focus:outline-none focus:ring-0 focus:border-blue-600 peer"
//                   placeholder=" "
//                 />
//                 <label
//                   htmlFor="test_remaining"
//                   className="absolute text-[14px] text-[#9CA3AF] duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 start-1"
//                 >
//                   Test remaining
//                 </label>
//               </div>

//               {/* Visible: Test remaining = baseRemaining - planDays */}
//               <div className="relative flex-1">
//                 <input
//                   type="text"
//                   id="test_remaining_1"
//                   value={subtractionResult}
//                   readOnly
//                   className="block py-[15px] pl-[19px] pr-[13px] w-full text-[14px] text-[#252525] bg-white rounded-[8px] border border-[#E1E6ED] focus:outline-none focus:ring-0 focus:border-blue-600 peer"
//                   placeholder=" "
//                 />
//                 <label
//                   htmlFor="test_remaining_1"
//                   className="absolute text-[14px] text-[#9CA3AF] duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 start-1"
//                 >
//                   Test remaining
//                 </label>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div>
//           <div className="w-full border-b border-[#E1E6ED] mt-[30px]"></div>

//           <div className="py-[23px]">
//             <div className="flex gap-5 justify-end">
//               {/* <div
//                 className="px-5 py-[15px] bg-white border border-[#D9D9D9] rounded-[10px] cursor-pointer"
//                 onClick={handleSaveAsDraft}
//               >
//                 <span className="text-[#308BF9] text-[12px] font-semibold">
//                   Save as draft
//                 </span>
//               </div> */}


//               {/* <div
//   className={`px-5 py-[15px] border rounded-[10px] flex items-center justify-center
//     ${
//       isSavingDraft
//         ? "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed"
//         : "bg-white border-[#D9D9D9] cursor-pointer"
//     }`}
//   onClick={!isSavingDraft ? handleSaveAsDraft : undefined}
// >
//   {isSavingDraft ? (
//     <span className="text-[#308BF9] text-[12px] font-semibold flex items-center gap-2">
//       <svg
//         className="animate-spin h-4 w-4 text-[#308BF9]"
//         xmlns="http://www.w3.org/2000/svg"
//         fill="none"
//         viewBox="0 0 24 24"
//       >
//         <circle
//           className="opacity-25"
//           cx="12"
//           cy="12"
//           r="10"
//           stroke="currentColor"
//           strokeWidth="4"
//         ></circle>
//         <path
//           className="opacity-75"
//           fill="currentColor"
//           d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
//         ></path>
//       </svg>
//       Saving…
//     </span>
//   ) : (
//     <span className="text-[#308BF9] text-[12px] font-semibold">
//       Save as draft
//     </span>
//   )}
// </div> */}


//               <button
//                 type="button"
//                 className="relative px-5 py-[15px] bg-[#308BF9] rounded-[10px] cursor-pointer flex items-center justify-center overflow-hidden disabled:opacity-60 w-[180px]"
//                 onClick={handleConfirmNext}
//                 disabled={isLoading || isExtracting}
//               >
//                 {(isLoading || isExtracting) && (
//                   <div
//                     className="absolute left-0 top-0 h-full bg-[#1D6EDC] transition-all duration-200 ease-out"
//                     style={{ width: `${progress}%` }}
//                   />
//                 )}

//                 <span className="relative text-white text-[12px] font-semibold z-10">
//                   {isLoading
//                     ? `Submitting ${progress}%`
//                     : isExtracting
//                     ? `Extracting ${progress}%`
//                     : "Confirm & Next"}
//                 </span>
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }
