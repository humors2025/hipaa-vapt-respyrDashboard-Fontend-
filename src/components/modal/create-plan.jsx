

// "use client";

// import { Modal } from "react-responsive-modal";
// import { useState, useEffect, useRef } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import Image from "next/image";
// import { toast } from "sonner";

// export default function CreatePlanModal({ open, onClose }) {
//   const router = useRouter();
//   const fileInputRef = useRef(null);

//   const [selectedPlan, setSelectedPlan] = useState("");
//   const [showUploadModal, setShowUploadModal] = useState(false);
//   const [uploadedFile, setLocalUploadedFile] = useState(null);
//   const [blobUrl, setBlobUrl] = useState(null);
//   const [urlParams, setUrlParams] = useState({ dietician_id: null, profile_id: null });
//   const [isDragging, setIsDragging] = useState(false);
//   const [fileSizeError, setFileSizeError] = useState(false);


//   // Get parameters from URL safely on client side
//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//       const searchParams = new URLSearchParams(window.location.search);
//       setUrlParams({
//         dietician_id: searchParams.get('dietician_id'),
//         profile_id: searchParams.get('profile_id')
//       });
//     }
//   }, []);

//   // cleanup blob url if created
//   useEffect(() => {
//     return () => {
//       if (blobUrl) URL.revokeObjectURL(blobUrl);
//     };
//   }, [blobUrl]);

//   const options = [
//     { value: "auto", label: "Upload Files" },
//     // { value: "manual", label: "Manual fill" },
//     // { value: "copy", label: "Copy previous plan" },
//   ];

//   const handleNext = () => {
//     if (!selectedPlan) return;

//     if (selectedPlan === "manual") {
//       onClose?.();
//       // Pass parameters to plansummary page
//       const queryParams = new URLSearchParams();
//       if (urlParams.dietician_id) queryParams.append('dietician_id', urlParams.dietician_id);
//       if (urlParams.profile_id) queryParams.append('profile_id', urlParams.profile_id);

//       router.push(`/plansummary?${queryParams.toString()}`);
//       return;
//     }

//     // For auto/copy -> open upload modal
//     onClose?.();
//     setShowUploadModal(true);
//   };

//   const handleCloseUploadModal = () => setShowUploadModal(false);

//   const handleFileChange = (e) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     processFile(file);
//   };

//   const processFile = (file) => {
//     if (!file) return;

//     // Reset previous error
//     setFileSizeError(false);

//     if (file.type !== "application/pdf") {
//       toast.error("Please upload a valid PDF file");
//       return;
//     }

//     // Check file size (3MB)
//     if (file.size > 3 * 1024 * 1024) {
//       setFileSizeError(true);
//       setLocalUploadedFile(null);
//       return;
//     }

//     setLocalUploadedFile(file);

//     const url = URL.createObjectURL(file);
//     setBlobUrl((prev) => {
//       if (prev) URL.revokeObjectURL(prev);
//       return url;
//     });
//   };


//   // Drag and drop handlers
//   const handleDragEnter = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(true);
//   };

//   const handleDragLeave = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);
//   };

//   const handleDragOver = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     if (!isDragging) {
//       setIsDragging(true);
//     }
//   };

//   const handleDrop = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);

//     const files = e.dataTransfer.files;
//     if (files && files.length > 0) {
//       const file = files[0];
//       processFile(file);
//     }
//   };

//   // Click handler for the entire drop zone
//   const handleDropZoneClick = () => {
//     if (fileInputRef.current) {
//       fileInputRef.current.click();
//     }
//   };

//   const storeFileInLocalStorage = (file) => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();

//       reader.onload = function (event) {
//         try {
//           const fileData = {
//             name: file.name,
//             type: file.type,
//             size: file.size,
//             lastModified: file.lastModified,
//             data: event.target.result, // base64 encoded string
//             blobUrl: blobUrl
//           };

//           // Store in localStorage
//           localStorage.setItem('uploadedPdfFile', JSON.stringify(fileData));
//           resolve(true);
//         } catch (error) {
//           reject(error);
//         }
//       };

//       reader.onerror = function (error) {
//         reject(error);
//       };

//       // Read file as base64 string
//       reader.readAsDataURL(file);
//     });
//   };

//   const handleUploadAndRoute = async () => {
//     if (!uploadedFile) {
//       toast.warning("Please select a PDF file before uploading");
//       return;
//     }

//     try {
//       // Store file in localStorage instead of Redux
//       await storeFileInLocalStorage(uploadedFile);

//       // Route to plan summary with parameters
//       const queryParams = new URLSearchParams();
//       if (urlParams.dietician_id) queryParams.append('dietician_id', urlParams.dietician_id);
//       if (urlParams.profile_id) queryParams.append('profile_id', urlParams.profile_id);

//       setShowUploadModal(false);
//       router.push(`/plansummary?${queryParams.toString()}`);
//     } catch (error) {
//       console.error("Error storing file in localStorage:", error);
//       toast.error("Failed to upload file");
//     }
//   };

//   return (
//     <>
//       {/* STEP 1 */}
//       <Modal
//         open={open}
//         onClose={onClose}
//         center
//         focusTrapped
//         closeOnOverlayClick
//         showCloseIcon={false}
//         classNames={{ modal: "rounded-[10px] p-0", overlay: "bg-black/40" }}
//         styles={{ modal: { padding: 0, maxWidth: 620, width: "90%" } }}
//       >
//         <div className="flex flex-col gap-[107px] pt-[50px] px-8 pb-8">
//           <div className="flex gap-5">
//             <div className="max-w-[236px] flex flex-col gap-5">
//               <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
//                 Create new plan
//               </span>
//               <p className="text-[#252525] text-[34px] font-normal leading-[110%] tracking-[-0.3px]">
//                 How are you creating?
//               </p>
//             </div>

//             <div className="flex flex-col w-full gap-[15px]">
//               {options.map((opt) => (
//                 <label
//                   key={opt.value}
//                   className={`flex gap-2.5 items-center py-[18px] pl-2.5 pr-3 rounded-[5px] cursor-pointer transition-colors
//                     ${selectedPlan === opt.value
//                       ? "border-[2px] border-[#308BF9] bg-[#F5F7FA]"
//                       : "border-[2px] border-[#E1E6ED] bg-[#F5F7FA] hover:border-[#BFD8FF]"
//                     }`}
//                 >
//                   <input
//                     type="radio"
//                     name="planType"
//                     value={opt.value}
//                     checked={selectedPlan === opt.value}
//                     onChange={() => setSelectedPlan(opt.value)}
//                     className="w-4 h-4 text-[#308BF9] border-gray-300 focus:ring-[#308BF9]"
//                   />
//                   <span className="text-[#252525] text-[15px] font-normal leading-normal tracking-[-0.3px]">
//                     {opt.label}
//                   </span>
//                 </label>
//               ))}
//             </div>
//           </div>

//           <div className="flex justify-end gap-3">
//             <button
//               onClick={handleNext}
//               disabled={!selectedPlan}
//               className={`w-[146px] px-4 py-2 rounded-[10px] text-white text-[12px] font-semibold tracking-[-0.24px] cursor-pointer
//                 ${selectedPlan
//                   ? "bg-[#308BF9]"
//                   : "bg-gray-400 cursor-not-allowed"
//                 }`}
//             >
//               Next
//             </button>
//           </div>
//         </div>
//       </Modal>

//       {/* STEP 2 */}
//       <Modal
//         open={showUploadModal}
//         onClose={handleCloseUploadModal}
//         center
//         focusTrapped
//         closeOnOverlayClick
//         showCloseIcon={false}
//         classNames={{ modal: "rounded-[10px] p-0", overlay: "bg-black/40" }}
//         styles={{ modal: { padding: 0, maxWidth: 620, width: "90%" } }}
//       >
//         <div className="flex gap-6 pt-[50px] px-8 pb-8">
//           <div className="max-w-[236px] flex flex-col gap-5">
//             <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
//               Create new plan
//             </span>
//             <p className="text-[#252525] text-[34px] font-normal leading-[110%] tracking-[-0.3px]">
//               Upload plan file (.pdf)
//             </p>
//             <p className="text-[#535359] text-[12px] font-semibold leading-[110%] tracking-[-0.3px]">File size max. 3MB</p>
//           </div>

//           <div
//             className={`flex-1 border-2 border-dashed rounded-[10px] p-8 text-center cursor-pointer transition-colors
//     ${fileSizeError
//                 ? "border-[#DA5747] bg-[#FFF5F5]"
//                 : isDragging
//                   ? "border-[#308BF9] bg-[#F0F7FF]"
//                   : "border-[#E1E6ED] hover:bg-[#F5F7FA]"
//               }`}
//             onClick={handleDropZoneClick}
//             onDragEnter={handleDragEnter}
//             onDragOver={handleDragOver}
//             onDragLeave={handleDragLeave}
//             onDrop={handleDrop}
//           >
//             <div className="flex flex-col items-center gap-6">
//               <Image
//                 src="/icons/hugeicons_cursor-magic-selection-04.svg"
//                 alt="upload"
//                 width={48}
//                 height={48}
//               />

//               <input
//                 ref={fileInputRef}
//                 id="file-upload"
//                 type="file"
//                 accept="application/pdf,.pdf"
//                 onChange={handleFileChange}
//                 className="hidden"
//               />

//               {/* Normal message OR selected file */}
//               {!fileSizeError && (
//                 <p className="text-[#252525] text-[15px]">
//                   {uploadedFile
//                     ? `Selected: ${uploadedFile.name}`
//                     : "Drag or browse from My Computer"}
//                 </p>
//               )}

//               {/* ERROR MESSAGE */}
//               {fileSizeError && (
//                 <p className="text-[#DA5747] text-[14px] font-medium">
//                   File size must be less than 3MB
//                 </p>
//               )}

//               {/* Drag message */}
//               {isDragging && !fileSizeError && (
//                 <p className="text-[#308BF9] text-sm font-medium">
//                   Drop your PDF file here...
//                 </p>
//               )}
//             </div>
//           </div>

//         </div>

//         <div className="flex justify-end gap-3 px-8 pb-8">
//           <button
//             onClick={handleUploadAndRoute}
//             disabled={fileSizeError || !uploadedFile}
//             className={`w-[146px] px-4 py-2 rounded-[10px] text-white text-[12px] font-semibold
//     ${fileSizeError || !uploadedFile
//                 ? "bg-gray-400 cursor-not-allowed"
//                 : "bg-[#308BF9] cursor-pointer"
//               }
//   `}
//           >
//             Next
//           </button>

//         </div>
//       </Modal>
//     </>
//   );
// }