
"use client"

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { MdOutlineKeyboardBackspace } from "react-icons/md";
import { IoChevronBackSharp } from "react-icons/io5";
import { GoPlus } from "react-icons/go";
import { IoIosArrowForward } from "react-icons/io";
import { toast } from "sonner";
import Link from 'next/link';
import { cookieManager } from '../lib/cookies';
import { usePathname, useSearchParams } from "next/navigation";
import CreatePlanModal from './modal/create-plan';
import { fetchClientProfileData } from '../services/authService';
import { useDispatch, useSelector } from 'react-redux';
import { setClientProfile, clearClientProfile, setClientProfileLoading, setClientProfileError } from '@/store/clientProfileSlice';
import CreatePlanPopUp from './pop-folder/create-plan-popup';
import { getClientsForDietician, selectClients } from "../store/clientSlice";

export const ClientProfile = ({ showPlanDetails = true, showOverview = true, showPlanSelection = true, showPlanHistoryMargin = true }) => {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const dispatch = useDispatch();
    const clientProfileFromRedux = useSelector((state) => state.clientProfile.data);

       const clientsFromRedux = useSelector(selectClients);

    const [clientData, setClientData] = useState(null);

    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState("");
    const [showUploadModal, setShowUploadModal] = useState(false);

    // Get parameters from URL
    const dieticianCookie = cookieManager.getJSON('dietician');
    const dieticianId = dieticianCookie?.dietician_id || '';
    const profileId = searchParams?.get('profile_id') || '';

    // Determine if we should hide client bits based on current pathname
    const hideClientBits = (pathname || '').toLowerCase().includes('testlog-info')
        || (pathname || '').toLowerCase().includes('plan-summary')
        || (pathname || '').toLowerCase().endsWith('/plansummary');

    // Options for plan selection (commented out but kept for future use)
    const options = [
        { value: "automatically", label: "Automatically fill" },
        { value: "manual", label: "Manual fill" },
        { value: "copy", label: "Copy previous plan" },
    ];

const selectedClientFromRedux = Array.isArray(clientsFromRedux)
  ? clientsFromRedux.find(
      (c) => String(c?.profile_id) === String(profileId)
    )
  : null;




    // ✅ BMI Helpers
    const calculateBMI = (weightKg, heightCm) => {
        if (!weightKg || !heightCm) return null;
        const w = Number(weightKg);
        const hCm = Number(heightCm);
        if (!Number.isFinite(w) || !Number.isFinite(hCm) || w <= 0 || hCm <= 0)
            return null;

        const heightM = hCm / 100;
        const bmi = w / (heightM * heightM);
        return bmi.toFixed(1);
    };

    const getBMICategory = (bmi) => {
        const v = bmi ? Number(bmi) : null;
        if (!v || !Number.isFinite(v)) return { label: "-", color: "#535359" };

        if (v < 18.5) return { label: "Underweight", color: "#FFA500" };
        if (v >= 18.5 && v < 25) return { label: "Normal", color: "#3FAF58" };
        if (v >= 25 && v < 30) return { label: "Overweight", color: "#FFA500" };
        return { label: "Obese", color: "#DA5747" };
    };



const getRoundedFatMetabolism = (client) => {
  const range =
    client?.metabolism_target?.target_metabolism_scores?.["Fat Metabolism %"];

  if (!range) return null;

  // Extract first percentage number safely (works for "11.90% to 19.90%" etc.)
  const match = String(range).match(/([\d.]+)\s*%/);
  if (!match?.[1]) return null;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;

  return Math.round(number);
};



    useEffect(() => {
        const loadClientProfile = async () => {
            if (!dieticianId || !profileId) return;

            try {
                setLoading(true);

                const response = await fetchClientProfileData(dieticianId, profileId);
                if (response.success && response.data) {
                    setClientData(response.data);
                    dispatch(setClientProfile(response.data));
                } else {
                    dispatch(setClientProfileError("Failed to load client data"));
                }
            } catch (error) {
                console.error("Error fetching client profile:", error);
                toast.error("Error loading client data");
                dispatch(setClientProfileError(error?.message || "Error loading client data"));
            } finally {
                setLoading(false);
            }
        };

        loadClientProfile();
    }, [dieticianId, profileId, dispatch]);



    // Helper function to get active plan or first available plan
    const getActivePlan = () => {
        // First priority: Check for active plans
        if (clientData?.plans_summary?.active?.[0]) {
            return clientData.plans_summary.active[0];
        }
        // Second priority: If no active plan, check for not_started plans
        if (clientData?.plans_summary?.not_started?.[0]) {
            return clientData.plans_summary.not_started[0];
        }
        // Third priority: If no active or not_started, check for completed plans
        if (clientData?.plans_summary?.completed?.[0]) {
            return clientData.plans_summary.completed[0];
        }
        return null;
    };

    // Helper function to determine plan status for display
    const getPlanStatus = () => {
        if (clientData?.plans_summary?.active?.[0]) return 'active';
        if (clientData?.plans_summary?.not_started?.[0]) return 'not_started';
        if (clientData?.plans_summary?.completed?.[0]) return 'completed';
        return 'no_plan';
    };

    const activePlan = getActivePlan();
    const planStatus = getPlanStatus();

    // Helper function to parse goals from JSON string
    const parseGoals = (goalsString) => {
        try {
            return JSON.parse(goalsString || "[]");
        } catch (error) {
            return [];
        }
    };

    const goals = activePlan ? parseGoals(activePlan.goal) : [];

    // Check if client has any plans (active, completed, or not_started)
    const hasAnyPlans = !!(
        clientData?.plans_summary &&
        (
            (clientData.plans_summary.active && clientData.plans_summary.active.length > 0) ||
            (clientData.plans_summary.completed && clientData.plans_summary.completed.length > 0) ||
            (clientData.plans_summary.not_started && clientData.plans_summary.not_started.length > 0)
        )
    );

    // Function to handle Create Plan button click
    const handleCreatePlanClick = () => {
        // Clear localStorage when creating a new plan
        localStorage.clear();
        setIsModalOpen(true);
    };

    // Function to copy text to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text || "")
            .then(() => toast.success("Copied to clipboard!"))
            .catch(() => toast.error("Failed to copy"));
    };

    // Check if current page is plan history page
    const isPlanHistoryPage = pathname?.toLowerCase().includes('planhistory');

    // ✅ BMI values from clientData
    const bmiValue = calculateBMI(clientData?.weight, clientData?.height);
    const bmiCategory = getBMICategory(bmiValue);
   const fatMetabolismPercent =
  getRoundedFatMetabolism(selectedClientFromRedux) ??
  getRoundedFatMetabolism(clientData);



    // Loading state
    if (loading && !hideClientBits) {
        return (
            <div className='flex flex-col gap-[5px]'>
                <div className='w-[333px] flex flex-col gap-[30px]'>
                    <div className='flex flex-col pb-[48px] gap-5 bg-[#FFFFFF] rounded-[15px] overflow-y-auto max-h-[calc(16.75*64px)] hide-scrollbar'>
                        <div className="flex flex-col items-center gap-5 mt-[55px]">
                            <div className="bg-[#F0F0F0] rounded-full p-2.5 flex items-center justify-center animate-pulse">
                                <div className="w-20 h-20 bg-gray-300 rounded-full"></div>
                            </div>
                            <div className="flex flex-col items-center gap-5">
                                <div className="w-32 h-6 bg-gray-300 rounded animate-pulse"></div>
                                <div className="w-24 h-4 bg-gray-300 rounded animate-pulse"></div>
                            </div>
                        </div>
                        <div className="text-center py-8">
                            <span className="text-[#535359] text-[15px]">Loading client data...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className='flex flex-col gap-[5px]'>
                <div className='flex gap-5'>
                    {/* Navigation Breadcrumb */}
                    <div className='w-[333px] flex gap-2.5 pl-[15px]  py-[14px] bg-white rounded-[15px]'>
                        <div className='flex gap-[15px] items-center'>

                            <Image
                                src="/icons/Frame 383.svg"
                                alt='Frame 383'
                                width={32}
                                height={32}
                                className='cursor-pointer'
                                onClick={() => window.history.back()}
                            />

                            {isPlanHistoryPage ? (
                                <span className='text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer'
                                    onClick={() => window.history.back()}
                                >
                                    {clientData?.profile_name || 'N/A'}

                                </span>
                            ) : (
                                <span className='text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer'
                                    onClick={() => window.history.back()}
                                >Clients</span>
                            )}
                        </div>

                        <div className='flex gap-[5px] items-center'>
                            <IoChevronBackSharp className='w-[15px] h-[15px] cursor-pointer' />
                            {isPlanHistoryPage ? (
                                <span className='text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px]'>
                                    Plan History({clientData?.plans_count?.total})
                                </span>
                            ) : (
                                <span className='text-[#252525] text-[12px] font-semibold leading-normal tracking-[-0.24px]'>
                                    {clientData?.profile_name || "-"}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Client Profile Content */}
                {!hideClientBits && (
                    <div className='w-[336px] flex flex-col gap-[30px]'>
                        {/* Client Overview Section */}
                        {showOverview && (
                            <div className='flex flex-col pb-[48px] gap-5 bg-[#FFFFFF] rounded-[15px] overflow-y-auto max-h-[calc(16.75*64px)] hide-scrollbar'>
                                {/* Client Avatar and Basic Info */}
                                <div className="flex flex-col items-center gap-5 mt-[55px]">
                                    {/* Avatar */}
                                    <div className="rounded-full p-2.5 flex items-center justify-center">
                                        {clientData?.profile_image_url ? (
                                            <Image
                                                src={clientData.profile_image_url}
                                                alt={clientData.profile_name || "Client"}
                                                height={80}
                                                width={80}
                                                className="rounded-full object-cover"
                                            />
                                        ) : (
                                            <Image
                                                src="/icons/hugeicons_user-circle-02.svg"
                                                alt="hugeicons_user-circle-02"
                                                height={80}
                                                width={80}
                                            />
                                        )}
                                    </div>

                                    {/* Text section */}
                                    <div className="flex flex-col items-center gap-5">
                                        <span className="text-[#252525] text-[25px] font-semibold leading-[110%] tracking-[-1px]">
                                            {clientData?.profile_name || 'N/A'}
                                        </span>

                                        <div className="flex items-center gap-5">
                                            <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                                                {clientData?.age ? `${clientData.age} years` : 'N/A years'}
                                            </span>
                                            <div className="w-1 h-1 rounded-full bg-[#252525]"></div>
                                            <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                                                {clientData?.gender || 'Male'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Height and Weight Stats */}
                                <div className='flex justify-center gap-[44px] px-5 py-[17px] mx-[13px] bg-[#F5F7FA] rounded-[15px]'>
                                    <div className='flex flex-col gap-3 '>
                                        <span className="text-[#252525] text-center text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">Height</span>
                                        <span className="text-[#535359] text-center text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                                            {clientData?.height ? `${clientData.height} cm` : '- cm'}
                                        </span>
                                    </div>
                                    <div className=' border-[#D9D9D9] border-[1px]'></div>
                                    <div className='flex flex-col gap-3 items-center'>
                                        <span className="text-[#252525] text-center text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">Weight</span>
                                        <span className="text-[#535359] text-center text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                                            {clientData?.weight ? `${clientData.weight}kg` : '- kg'}
                                        </span>
                                    </div>
                                </div>


                                <div className='px-2.5 pt-5 pb-0.5'>
                                    <div className='flex flex-col gap-5 pl-5 pr-[42px] pb-5 border-b border-[#E1E6ED]'>
                                        <p className='text-[#252525] text-[12px] font-semibold leading-[130%] tracking-[-0.24px]'>BMI</p>
                                        <div className='flex flex-col gap-2.5'>
                                            <p className='text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]'>
                                                {bmiValue ? `${bmiValue} kg/m²` : "-"}
                                            </p>

                                            <p
                                                className='text-[12px] font-normal leading-[110%] tracking-[-0.24px]'
                                                style={{ color: bmiCategory.color }}
                                            >
                                                {bmiCategory.label}
                                            </p>
                                        </div>
                                    </div>

                                    <div className='flex flex-col gap-5 pl-5 pr-[42px] pt-5'>
                                        <p className='text-[#252525] text-[12px] font-semibold leading-[130%] tracking-[-0.24px]'>RECOMMENDED SCORE RANGE</p>
                                        <div className='flex flex-col gap-2.5'>
                                        <p className='text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]'>
  {fatMetabolismPercent !== null ? `>${fatMetabolismPercent}%` : "-"}
</p>

                                            <p className='text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]'>This score range is based on the <br></br>client’s BMI.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Plan Details Section */}
                                {/* Show "No Plan" button only when there are truly no plans */}
                                {planStatus === 'no_plan' ? (
                                    // <div className='flex mx-2.5 bg-[#F5F7FA] rounded-[15px] whitespace-nowrap py-[13px] pl-[30px] pr-[15px] gap-[80px] items-center'>
                                    //     <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">No plan</span>
                                    //     <button
                                    //         className='flex gap-[15px] px-[18px] py-[9px] bg-[#308BF9] rounded-[5px] cursor-pointer'
                                    //         onClick={handleCreatePlanClick}
                                    //     >
                                    //         <GoPlus className='text-white w-[15px] h-[15px] ' />
                                    //         <span className='text-white text-[12px] font-semibold leading-[110%] tracking-[-0.24px] '>Create Plan</span>
                                    //     </button>
                                    // </div>
                                    ""
                                ) : (
                                    /* Show Plan Details for active, not_started, or completed plans */
                                    // <div className='mx-2.5 pt-5 rounded-[15px] mt-[17px] bg-[#F5F7FA]'>

                                    //     <div className='flex items-center justify-between ml-[30px] mr-[17px]'>
                                    //         <span className={`text-[15px] font-semibold leading-[110%] tracking-[-0.3px] ${planStatus === 'active' ? 'text-[#3FAF58]' :
                                    //                 planStatus === 'not_started' ? 'text-[#FFA500]' :
                                    //                     'text-[#A1A1A1]'
                                    //             }`}>
                                    //             {planStatus === 'active' ? 'Active' :
                                    //                 planStatus === 'not_started' ? 'Not Started' :
                                    //                     'Completed'}
                                    //         </span>

                                    //         <Link
                                    //             href={{
                                    //                 pathname: '/plansummary',
                                    //                 query: {
                                    //                     //dietician_id: cookieManager.getJSON('dietician')?.dietician_id || '',
                                    //                     profile_id: profileId || ''
                                    //                 }
                                    //             }}
                                    //         >
                                    //             <Image
                                    //                 src="/icons/hugeicons_pencil-edit-02.svg"
                                    //                 alt='hugeicons_pencil'
                                    //                 height={24}
                                    //                 width={24}
                                    //                 className='cursor-pointer'
                                    //             />
                                    //         </Link>
                                    //     </div>


                                    //     <div className='my-5 mx-[5px] border border-[#E1E6ED]'></div>


                                    //     <div className='flex justify-between mx-6 my-5'>
                                    //         <div className='flex flex-col gap-2.5 cursor-pointer'>
                                    //             <p className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]'>{activePlan.plan_title}</p>
                                    //             <p className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]'>
                                    //                 Updated {new Date(activePlan.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {new Date(activePlan.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    //             </p>
                                    //         </div>

                                    //         <div className='flex items-start'>
                                    //             <p className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]'>
                                    //                 {new Date(activePlan.plan_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}-{new Date(activePlan.plan_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    //             </p>
                                    //         </div>
                                    //     </div>


                                    //     <div className='my-5 mx-[5px] border border-[#E1E6ED]'></div>


                                    //     <div className='flex items-center gap-[5px] mt-5 mb-[25px] ml-[10px]'>
                                    //         <div className='p-0.5'>
                                    //             <Image
                                    //                 src="/icons/hugeicons_award-01.svg"
                                    //                 alt='hugeicons_award'
                                    //                 width={15}
                                    //                 height={15}
                                    //             />
                                    //         </div>
                                    //         <span className='text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]'>Goal</span>
                                    //     </div>


                                    //     <div className='flex flex-col gap-5 mx-5'>
                                    //         {goals.map((goal, index) => (
                                    //             <div key={index}>
                                    //                 <span className='text-[#535359] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] capitalize'>{goal.name}</span>
                                    //                 <div className='flex gap-5 mt-2'>
                                    //                     <div className='flex flex-col items-start gap-2.5'>
                                    //                         <span className='text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]'>{goal.current_stat}</span>
                                    //                         <span className='text-[#252525] text-center text-[10px] font-normal leading-normal tracking-[-0.2px] whitespace-nowrap'>Current stat</span>
                                    //                     </div>

                                    //                     <div className="mt-[7px] w-[122px] h-px border border-[#A1A1A1]"></div>
                                    //                     <div className='flex flex-col items-start gap-2.5'>
                                    //                         <span className='text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]'>{goal.target_stat}</span>
                                    //                         <span className='text-[#252525] text-center text-[10px] font-normal leading-normal tracking-[-0.2px] whitespace-nowrap'>Target stat</span>
                                    //                     </div>
                                    //                 </div>
                                    //             </div>
                                    //         ))}
                                    //     </div>


                                    //     {activePlan.approach && (
                                    //         <div className='flex flex-col gap-5 mt-10'>
                                    //             <div className='flex items-center gap-[5px] ml-[10px]'>
                                    //                 <div className='p-0.5'>
                                    //                     <Image
                                    //                         src="/icons/hugeicons_sparkles.svg"
                                    //                         alt='hugeicons_sparkles'
                                    //                         width={15}
                                    //                         height={15}
                                    //                     />
                                    //                 </div>
                                    //                 <span className='text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]'>Approach</span>
                                    //             </div>

                                    //             <div className='flex flex-col gap-[5px] mx-5 mb-[30px]'>
                                    //                 <div className='flex gap-[5px]'>
                                    //                     {activePlan.approach.split(',').map((approach, index) => (
                                    //                         <div key={index} className='bg-[#FFFFFF] px-[20px] p-[5px] rounded-[20px]'>
                                    //                             <span className='text-[#535359] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]'>{approach.trim()}</span>
                                    //                         </div>
                                    //                     ))}
                                    //                 </div>
                                    //             </div>
                                    //         </div>
                                    //     )}
                                    // </div>

                                    ""
                                )}

                                {/* Contact Information Section */}
                                <div className='flex flex-col gap-10 mt-[30px] bg-[#F5F7FA] mx-2.5 mb-[13px] py-[30px] rounded-[15px]'>

                                    <div className='flex mx-8  justify-between  items-center'>
                                        <div className='flex flex-col gap-2.5'>
                                            <span className='text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]'>
                                                Mobile number
                                            </span>
                                            <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                                                {clientData?.phone_no &&
                                                    clientData.phone_no !== "-" &&
                                                    clientData.phone_no !== "NA"
                                                    ? clientData.phone_no
                                                    : "-"}
                                            </span>

                                        </div>

                                        <Image
                                            src="/icons/hugeicons_copy-02.svg"
                                            alt='hugeicons_copy-02'
                                            width={15}
                                            height={15}
                                            className='cursor-pointer'
                                            onClick={() => copyToClipboard(clientData?.phone_no && clientData.phone_no !== 'NA' ? clientData.phone_no : "N/A")}
                                        />
                                    </div>

                                    {/* Email */}
                                    <div className='flex mx-8  justify-between  items-center'>
                                        <div className='flex flex-col gap-2.5'>
                                            <span className='text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]'>
                                                Email
                                            </span>
                                            <span className='text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]'>
                                                {clientData?.email && clientData.email !== 'NA' ? clientData.email : 'N/A'}
                                            </span>
                                        </div>

                                        <Image
                                            src="/icons/hugeicons_copy-02.svg"
                                            alt='hugeicons_copy-02'
                                            width={15}
                                            height={15}
                                            className='cursor-pointer'
                                            onClick={() => copyToClipboard(clientData?.email && clientData.email !== 'NA' ? clientData.email : "N/A")}
                                        />
                                    </div>

                                    {/* Reference ID */}
                                    <div className='flex mx-8  justify-between  items-center'>
                                        <div className='flex flex-col gap-2.5'>
                                            <span className='text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]'>
                                                Reference ID
                                            </span>
                                            <span className='text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]'>
                                                {clientData?.profile_id || 'N/A'}
                                            </span>
                                        </div>

                                        <Image
                                            src="/icons/hugeicons_copy-02.svg"
                                            alt='hugeicons_copy-02'
                                            width={15}
                                            height={15}
                                            className='cursor-pointer'
                                            onClick={() => copyToClipboard(clientData?.profile_id || "N/A")}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Plan History Section */}
                        {showPlanDetails && hasAnyPlans && (
                            // <div className={`bg-white rounded-[15px] px-[22px] py-10 whitespace-nowrap ${showOverview ? "" : (showPlanHistoryMargin ? "mt-[30px]" : "")
                            //     }`}>
                            //     <div className='flex justify-between items-center'>
                            //         <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]'>
                            //             Plan History({clientData?.plans_count?.total || 2})
                            //         </span>


                            //         {pathname !== "/planhistory" && (
                            //             <Link
                            //                 href={{
                            //                     pathname: '/planhistory',
                            //                     query: {
                            //                         profile_id: profileId,
                            //                     }
                            //                 }}
                            //                 className='flex gap-2.5'>
                            //                 <span className='text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] cursor-pointer'>View all plans</span>
                            //                 <IoIosArrowForward className='text-[#308BF9] cursor-pointer' />
                            //             </Link>
                            //         )}
                            //     </div>

                            //     <div className='my-[22px] border boder-[#E1E6ED]'></div>

                            //     <div className='flex flex-col gap-[30px]'>

                            //         {clientData?.plans_summary?.active?.map((plan, index) => (
                            //             <Link
                            //                 key={`active-${index}`}
                            //                 href={{
                            //                     pathname: '/planhistory',
                            //                     query: {
                            //                         profile_id: profileId,
                            //                     }
                            //                 }}
                            //                 className='flex flex-col'
                            //             >
                            //                 <div className='flex gap-[25px] justify-between '>
                            //                     <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] cursor-pointer'>{plan.plan_title}</span>
                            //                     <span className='text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px] cursor-pointer'>
                            //                         {new Date(plan.plan_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}-{new Date(plan.plan_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            //                     </span>
                            //                 </div>

                            //                 <div className='flex justify-between'>
                            //                     <div>
                            //                         <span className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>
                            //                             Updated {new Date(plan.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {new Date(plan.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            //                         </span>
                            //                     </div>
                            //                     <div className='flex gap-[3px] items-center'>
                            //                         <Image
                            //                             src="/icons/verified.svg"
                            //                             alt='verified'
                            //                             width={12}
                            //                             height={12}
                            //                         />
                            //                         <span className='text-[#3FAF58] text-[12px] font-normal leading-normal tracking-[-0.24px]'>Active</span>
                            //                     </div>
                            //                 </div>
                            //             </Link>
                            //         ))}


                            //         {clientData?.plans_summary?.completed?.map((plan, index) => (
                            //             <Link
                            //                 key={`completed-${index}`}
                            //                 href={{
                            //                     pathname: '/planhistory',
                            //                     query: {
                            //                         profile_id: profileId,
                            //                     }
                            //                 }}
                            //                 className='flex flex-col'
                            //             >
                            //                 <div className='flex gap-[25px] justify-between'>
                            //                     <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]'>{plan.plan_title}</span>
                            //                     <span className='text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]'>
                            //                         {new Date(plan.plan_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}-{new Date(plan.plan_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            //                     </span>
                            //                 </div>

                            //                 <div className='flex justify-between'>
                            //                     <div>
                            //                         <span className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>
                            //                             Updated {new Date(plan.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {new Date(plan.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            //                         </span>
                            //                     </div>
                            //                     <div className='flex gap-[3px] items-center'>
                            //                         <Image
                            //                             src="/icons/verified.svg"
                            //                             alt='verified'
                            //                             width={12}
                            //                             height={12}
                            //                         />
                            //                         <span className='text-[#3FAF58] text-[12px] font-normal leading-normal tracking-[-0.24px]'>Finished</span>
                            //                     </div>
                            //                 </div>
                            //             </Link>
                            //         ))}


                            //         {clientData?.plans_summary?.not_started?.map((plan, index) => (
                            //             <Link
                            //                 key={`not-started-${index}`}
                            //                 href={{
                            //                     pathname: '/planhistory',
                            //                     query: {
                            //                         profile_id: profileId,
                            //                     }
                            //                 }}
                            //                 className='flex flex-col'
                            //             >
                            //                 <div className='flex gap-[25px] justify-between'>
                            //                     <span className='text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]'>{plan.plan_title}</span>
                            //                     <span className='text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]'>
                            //                         {new Date(plan.plan_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}-{new Date(plan.plan_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            //                     </span>
                            //                 </div>

                            //                 <div className='flex justify-between'>
                            //                     <div>
                            //                         <span className='text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize'>
                            //                             Updated {new Date(plan.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {new Date(plan.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            //                         </span>
                            //                     </div>
                            //                     <div className='flex gap-[3px] items-center'>
                            //                         <Image
                            //                             src="/icons/clock.svg"
                            //                             alt='not started'
                            //                             width={12}
                            //                             height={12}
                            //                         />
                            //                         <span className='text-[#FFA500] text-[12px] font-normal leading-normal tracking-[-0.24px]'>Not Started</span>
                            //                     </div>
                            //                 </div>
                            //             </Link>
                            //         ))}


                            //         {(!clientData?.plans_summary?.active?.length &&
                            //             !clientData?.plans_summary?.completed?.length &&
                            //             !clientData?.plans_summary?.not_started?.length) && (
                            //                 <p className='text-[18px] text-[#252525]'>No Data found</p>
                            //             )}
                            //     </div>
                            // </div>
                            ""
                        )}
                    </div>
                )}

                {/* Plan Selection Section - Commented out but kept for future use */}
                {/* {showPlanSelection && (
                    <div className='w-[333px] flex flex-col gap-5 bg-white rounded-[15px] px-[15px] pb-[15px]'>
                        <div className='pt-[30px] pl-[30px]'>
                            <span className='text-[#535359] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]'>Select one to continue</span>
                        </div>

                        <div className="flex flex-col w-full gap-[15px]">
                            {options.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex gap-2.5 items-center py-[18px] pl-2.5 pr-3 rounded-[5px] cursor-pointer transition-colors
                    ${selectedPlan === opt.value
                                            ? "border-[2px] border-[#308BF9] bg-[#F5F7FA]"
                                            : ""
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="planType"
                                        value={opt.value}
                                        checked={selectedPlan === opt.value}
                                        onChange={() => setSelectedPlan(opt.value)}
                                        className="w-4 h-4 text-[#308BF9] border-gray-300 focus:ring-[#308BF9]"
                                    />
                                    <span className="text-[#252525] text-[15px] font-normal leading-normal tracking-[-0.3px] whitespace-nowrap">
                                        {opt.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )} */}
            </div>

            {/* Create Plan Modal */}
            {/* <CreatePlanModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            /> */}
            <CreatePlanPopUp
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    )
}