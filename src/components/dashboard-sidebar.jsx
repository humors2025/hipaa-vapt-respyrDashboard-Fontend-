"use client"

import Image from "next/image"
import { IoIosArrowForward } from "react-icons/io";
export default function DashboardSidebar() {
    return (
        <>
            <div className="flex flex-col gap-5">
                <div className="px-[13px] pb-[13px] bg-white rounded-[15px]">
                    <div className="ml-6 mt-[30px] mb-[23px]">
                        <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">Client Overview</span>
                    </div>
                    <div className="w-[302px] border-t-2 border-[#E1E6ED]"></div>

                    <div className="flex flex-col gap-10">
                        <div className="flex gap-[102px] ml-6 mr-[9px] mt-7">
                            <div className="flex flex-col gap-[5px]">
                                <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">45</span>
                                <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">Total Clients</span>
                            </div>

                            <div className="flex gap-2.5 items-end cursor-pointer">
                                <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">View clients</span>
                                <IoIosArrowForward className="text-[#308BF9]" />
                            </div>
                        </div>

                        <div className="flex gap-[9px]">
                            <div className="flex flex-col gap-[5px] bg-[#F5F7FA] rounded-[10px] py-7 pl-[27px] pr-[51px]">
                                <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">40</span>
                                <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">Active Plans</span>
                            </div>

                            <div className="flex flex-col gap-[5px] bg-[#F5F7FA] rounded-[10px] py-7 pl-[27px] pr-[51px]">
                                <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">5</span>
                                <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">Needs Plan</span>
                            </div>
                        </div>
                    </div>
                </div>


                <div className="px-[13px] pb-[13px] bg-white rounded-[15px]">
                    <div className="ml-6 mt-[30px] mb-[23px]">
                        <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">Tests Overview</span>
                    </div>
                    <div className="w-[302px] border-t-2 border-[#E1E6ED]"></div>

                    <div className="flex flex-col gap-10">
                        <div className="flex gap-[102px] ml-6 mr-[9px] mt-7">
                            <div className="flex flex-col gap-[5px]">
                                <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">10000</span>
                                <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">Total Tests</span>
                            </div>

                            <div className="flex gap-2.5 items-end cursor-pointer">
                                <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">View Subscription</span>
                                <IoIosArrowForward className="text-[#308BF9]" />
                            </div>
                        </div>

                        <div className="flex gap-[9px]">
                            <div className="flex flex-col gap-[5px] bg-[#F5F7FA] rounded-[10px] py-7 pl-[27px] pr-[51px]">
                                <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">8000</span>
                                <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">Tests Assigned</span>
                            </div>

                            <div className="flex flex-col gap-[5px] bg-[#F5F7FA] rounded-[10px] py-7 pl-[27px] pr-[51px]">
                                <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">2000</span>
                                <span className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">Tests Remaining</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}