"use client"
import Image from 'next/image'
import React, { useState, useRef, useEffect } from 'react'
import { IoIosArrowForward } from "react-icons/io";
import { usePathname } from 'next/navigation'
import CreateDietPlan from './create-diet-plan';
import Summary from './summary';
import TestLogInfo from './testloginfo';
import DietPlanCreated from './diet-plan-created';
import { useSelector } from "react-redux";
import { toast } from 'sonner';
import DeletePopUp from './modal/delete-popup';
import { cookieManager } from "../lib/cookies";
import { fetchClientProfileData } from "../services/authService";
import { useSearchParams } from "next/navigation";


export default function Preview() {

  const pathname = (usePathname() || '').toLowerCase();

  const fileInputRef = useRef(null);
  const searchParams = useSearchParams();

  const isDietPlan = pathname.includes('/dietplan') || pathname.endsWith('/diet-plan');
  const hideActions = pathname.includes('/testlog-info');
  const hideTestLogOnPlanSummary = pathname.includes('/plan-summary') || pathname.endsWith('/plansummary');

  const [pdfData, setPdfData] = useState({ fileName: '', blobUrl: '' });
  const [hasUploadedPdf, setHasUploadedPdf] = useState(false);
  const [activePanel, setActivePanel] = useState('summary');

  const isExtracting = useSelector((state) => state.extraction.isExtracting);
  const [deletePopUp, setDeletePopUp] = useState(false);
  const [clientProfile, setClientProfile] = useState(null);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);

    const [dietPlanId, setDietPlanId] = useState(null);

  

  // NEW CODE ADDED:
  // useEffect(() => {
  //   const loadPdfFromLocalStorage = () => {
  //     try {
  //       const storedFileData = localStorage.getItem('uploadedPdfFile');
  //       console.log("storedFileData35:-", storedFileData);
  //       if (storedFileData) {
  //         const parsedData = JSON.parse(storedFileData);
  //         setPdfData({
  //           fileName: parsedData.name || 'please_upload.pdf',
  //           blobUrl: parsedData.blobUrl || ''
  //         });
  //       }
  //     } catch (error) {
  //       console.error('Error loading PDF from localStorage:', error);
  //     }
  //   };

  //   loadPdfFromLocalStorage();
  // }, []);


  useEffect(() => {
  const loadClientProfile = async () => {
    try {
      const dietician = cookieManager.getJSON("dietician"); // ✅
      const dieticianId = dietician?.dietician_id || dietician?.dietitian_id || dietician?.login_id;

      const profileId = searchParams.get("profile_id"); // ✅ app router safe

      if (!dieticianId || !profileId) return;

      setClientProfileLoading(true);
      const res = await fetchClientProfileData(dieticianId, profileId);

      setClientProfile(res?.data ?? res); // ✅ depends on your API response shape
    } catch (err) {
      console.error("fetchClientProfileData error:", err);
      toast.error("Failed to load client profile");
    } finally {
      setClientProfileLoading(false);
    }
  };

  loadClientProfile();
}, [searchParams]);



useEffect(() => {
    const id =
      clientProfile?.plans_summary?.active?.[0]?.id ??
      clientProfile?.plans_summary?.not_started?.[0]?.id ??
      clientProfile?.plans_summary?.completed?.[0]?.id ??
      null;

    setDietPlanId(id);
  }, [clientProfile]);




  useEffect(() => {
    try {
      const storedFileData = localStorage.getItem('uploadedPdfFile');
      setHasUploadedPdf(!!storedFileData); // check exists

      if (storedFileData) {
        const parsedData = JSON.parse(storedFileData);
        setPdfData({
          fileName: parsedData.name || 'please_upload.pdf',
          blobUrl: parsedData.blobUrl || ''
        });
      }
    } catch (error) {
      console.error('Error loading PDF from localStorage:', error);
    }
  }, []);



  // Cleanup blob URLs on component unmount
  useEffect(() => {
    return () => {
      if (pdfData.blobUrl) {
        URL.revokeObjectURL(pdfData.blobUrl);
      }
    };
  }, [pdfData.blobUrl]);

  const handleReupload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a valid PDF file");
      return;
    }

    // File size validation (3MB max)
    if (file.size > 3 * 1024 * 1024) {
      toast.error("File size must be less than 3MB");
      return;
    }

    try {
      // Clean up previous blob URL if exists
      if (pdfData.blobUrl) {
        URL.revokeObjectURL(pdfData.blobUrl);
      }

      // Create new blob URL
      const newBlobUrl = URL.createObjectURL(file);

      // Store file in localStorage
      const reader = new FileReader();
      reader.onload = function (event) {
        const fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          data: event.target.result,
          blobUrl: newBlobUrl
        };

        localStorage.setItem('uploadedPdfFile', JSON.stringify(fileData));

        // Update local state
        setPdfData({
          fileName: file.name,
          blobUrl: newBlobUrl
        });

        toast.success(`File re-uploaded: ${file.name}`);

        // Reset the file input to allow re-uploading the same file
        event.target.value = '';
      };

      reader.onerror = function (error) {
        console.error("Error reading file:", error);
        toast.error("Failed to re-upload file");
      };

      reader.readAsDataURL(file);

    } catch (error) {
      console.error("Error during re-upload:", error);
      toast.error("Failed to re-upload file");
    }
  };

  const handleReuploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSummaryConfirmNext = () => {
    setActivePanel('testlog');
  };

  const handleTestLogConfirmNext = () => {
    setActivePanel('dietplan');
  };

  const handleDeletePlan = () => {
    setDeletePopUp(false);

  }

  return (
    <>
      <div className='overflow-hidden w-full bg-white rounded-[15px]  p-[15px] '>
        <div className='flex justify-between'>
          <p className='text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]'>Preview</p>

          {hasUploadedPdf && (
            <div className='flex gap-[25px] items-center pb-2.5'>
              <span className='text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[-0.24px]'>
                {pdfData?.fileName || 'please_upload.pdf'}
              </span>

              {/* Hidden file input for re-upload */}
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleReupload}
                ref={fileInputRef}
                className="hidden"
              />

              {/* Re-upload button - Only show when activePanel is 'summary' */}
              {activePanel === 'summary' && (
                <div
                  className='flex gap-1.5 px-5 py-[15px] border border-[#D9D9D9] rounded-[10px] cursor-pointer hover:bg-gray-50 transition-colors'
                  onClick={handleReuploadClick}
                >
                  <Image
                    src="/icons/hugeicons_rotate-01.svg"
                    alt='hugeicons_rotate-01'
                    width={20}
                    height={20}
                  />
                  <span className='text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px]'>Re-upload</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full border-b border-[#E1E6ED]"></div>

        {/* === Diet Plan switch === */}
        <div className="mt-4">
          {isDietPlan ? (
            <CreateDietPlan />
          ) : (
            <>
              {!hideActions && (
                <div className='flex gap-5'>
                  <div className='flex flex-col mt-4 bg-[#F5F7FA] rounded-[15px] px-[7px] pt-[9px] pb-[9px]'>

                    {/* Plan summary tile */}
                    <div
                      className={`flex gap-[52px] justify-between py-5 pl-[23px] pr-[15px] rounded-[5px] items-center cursor-pointer
    ${activePanel === 'summary' ? 'bg-white' : ''}
    ${isExtracting ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
  `}
                      onClick={() => {
                        if (isExtracting) return;  // ✅ block click
                        setActivePanel('summary');
                      }}
                    >
                      <div className='flex gap-2.5 items-center'>
                        <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap'>Plan summary</span>
                        {/* <div className='flex gap-[5px] items-center rounded-[20px] bg-[#DA5747] px-3 py-1.5'>
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>2</span>
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>Pending</span>
                      </div> */}
                      </div>
                      <IoIosArrowForward className='w-[20px] h-[20px] text-[#252525]' />
                    </div>

                    {/* Tests log info tile */}
                    <div
                      className={`flex justify-between py-5 pl-[23px] pr-[15px] rounded-[5px] items-center cursor-pointer
    ${activePanel === 'testlog' ? 'bg-white' : ''}
    ${isExtracting ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
  `}
                      onClick={() => {
                        if (isExtracting) return;
                        setActivePanel('testlog');
                      }}
                    >
                      <div className='flex gap-2.5 items-center'>
                        <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap'>Tests log info</span>
                        {/* <div className='flex gap-[5px] items-center rounded-[20px] bg-[#3FAF58] px-3 py-1.5'>
                        <Image src="/icons/verified.svg" alt='verified.svg' width={18} height={18} />
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>ready</span>
                      </div> */}
                      </div>
                      <IoIosArrowForward className='w-[20px] h-[20px] text-[#252525]' />
                    </div>

                    {/* Diet plan tile */}
                    <div
                      className={`flex justify-between py-5 pl-[23px] pr-[15px] rounded-[5px] items-center cursor-pointer
    ${activePanel === 'dietplan' ? 'bg-white' : ''}
    ${isExtracting ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
  `}
                      onClick={() => {
                        if (isExtracting) return;
                        setActivePanel('dietplan');
                      }}
                    >
                      <div className='flex gap-2.5 items-center'>
                        <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap'>Diet plan</span>
                        {/* <div className='flex gap-[5px] items-center rounded-[20px] bg-[#3FAF58] px-3 py-1.5'>
                        <Image src="/icons/verified.svg" alt='verified.svg' width={18} height={18} />
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>ready</span>
                      </div> */}
                      </div>
                      <IoIosArrowForward className='w-[20px] h-[20px] text-[#252525]' />
                    </div>

                    <div className='flex gap-2.5 items-center  py-5 pl-[23px] pr-[15px] cursor-pointer mt-auto  bg-white rounded-[5px]'
                      onClick={() => setDeletePopUp(true)}
                    >
                      <Image
                        src="/icons/hugeicons_delete-01.svg"
                        alt='hugeicons_delete-01.svg'
                        width={24}
                        height={24}
                      />
                      <p className='text-[#DA5747] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]'>Delete Plan</p>
                    </div>
                  </div>

                  {/* Right side content based on activePanel */}
                  {activePanel === 'summary' && <Summary onConfirmNext={handleSummaryConfirmNext} />}
                  {activePanel === 'testlog' && <TestLogInfo onConfirmNext={handleTestLogConfirmNext} />}
                  {activePanel === 'dietplan' && <DietPlanCreated />}
                </div>
              )}

              {!hideTestLogOnPlanSummary && (
                <div className='flex gap-5 '>
                  <div className='mt-4 bg-[#F5F7FA] rounded-[15px] px-[7px] pt-[9px]'>

                    <div
                      className='flex gap-[52px] justify-between py-5 pl-[23px] pr-[15px] rounded-[5px] items-center bg-white cursor-pointer'
                      onClick={() => setActivePanel('summary')}
                    >
                      <div className='flex gap-2.5 items-center'>
                        <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap'>Plan summary</span>
                        {/* <div className='flex gap-[5px] items-center rounded-[20px] bg-[#DA5747] px-3 py-1.5'>
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>2</span>
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>Pending</span>
                      </div> */}
                      </div>
                      <IoIosArrowForward className='w-[20px] h-[20px] text-[#252525]' />
                    </div>

                    <div
                      className='flex justify-between py-5 pl-[23px] pr-[15px] rounded-[5px] items-center cursor-pointer'
                      onClick={() => setActivePanel('testlog')}
                    >
                      <div className='flex gap-2.5 items-center'>
                        <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap'>Tests log info</span>
                        {/* <div className='flex gap-[5px] items-center rounded-[20px] bg-[#3FAF58] px-3 py-1.5'>
                        <Image src="/icons/verified.svg" alt='verified.svg' width={18} height={18} />
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>ready</span>
                      </div> */}
                      </div>
                      <IoIosArrowForward className='w-[20px] h-[20px] text-[#252525]' />
                    </div>

                    <div
                      className='flex justify-between py-5 pl-[23px] pr-[15px] rounded-[5px] items-center cursor-pointer'
                      onClick={() => setActivePanel('dietplan')}
                    >
                      <div className='flex gap-2.5 items-center'>
                        <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] whitespace-nowrap'>Diet plan</span>
                        {/* <div className='flex gap-[5px] items-center rounded-[20px] bg-[#3FAF58] px-3 py-1.5'>
                        <Image src="/icons/verified.svg" alt='verified.svg' width={18} height={18} />
                        <span className='text-white text-[12px] font-semibold leading-normal tracking-[-0.2px]'>ready</span>
                      </div> */}
                      </div>
                      <IoIosArrowForward className='w-[20px] h-[20px] text-[#252525]' />
                    </div>
                  </div>

                  {/* Right side content again */}
                  {activePanel === 'summary' && <Summary onConfirmNext={handleSummaryConfirmNext} />}
                  {activePanel === 'testlog' && <TestLogInfo onConfirmNext={handleTestLogConfirmNext} />}
                  {activePanel === 'dietplan' && <CreateDietPlan />}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <DeletePopUp
        open={deletePopUp}
        onClose={handleDeletePlan}
        dietPlanId={dietPlanId}
      />
    </>
  )
}