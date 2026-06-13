import Image from "next/image"
import { IoIosArrowForward } from "react-icons/io";
import DashboardGraph from "./dashboard-graph";
import ClientRisk from "./client-risk";
import DietGraph from "./diet-graph";
export default function DietPlanMonitor() {
    return (
        <>


            <div className="border border-[#E1E6ED] rounded-[10px] px-[15px] pt-[30px]">
                <div className="flex justify-between pb-[23px] border-b border-[#E1E6ED]">
                    <span className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">Diet Plan Analytics</span>

                    <div className="flex gap-5 items-center">
                        <span className="text-[#A1A1A1] text-[12px] font-normal leading-normal tracking-[-0.24px]">Today, 12 April 2025</span>
                        <Image
                            src="/icons/hugeicons_calendar-03.svg"
                            alt="hugeicons_calendar-03.svg"
                            width={24}
                            height={24}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-7 pt-[30px]">
                    <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] pl-[9px]">Diet Plan Tracking</span>
                    <DietGraph/>
                </div>

                <div className=" flex flex-col gap-[18px]">
                 





                    <div className="flex gap-5">
                        <div className="flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 w-full">
                            <div className="">

                                <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
                                    Client Tracked
                                </span>
                            </div>
                            <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">45</span>
                        </div>

                        <div className="flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 w-full">
                            <div className="flex gap-[5px]">
                                <Image src="/icons/hugeicons_liver14.svg" alt="hugeicons_liver14.svg" width={18} height={18} />
                                <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
                                    Clients Followed
                                </span>
                            </div>
                            <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">5</span>
                        </div>

                        <div className="flex flex-col gap-10 bg-[#F5F7FA] border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 w-full">
                            <div className="flex gap-[119px]">
                                <div className="flex gap-[5px]">
                                    <Image src="/icons/hugeicons_24liver.svg" alt="hugeicons_24liver.svg" width={18} height={18} />
                                    <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
                                        Clients <br /> Not Followed
                                    </span>
                                </div>
                                {/* <div className="flex gap-2.5">
                                    <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                                        Send Message
                                    </span>
                                    <IoIosArrowForward className="text-[#308BF9]" />
                                </div> */}
                            </div>
                            <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">20</span>
                        </div>
                    </div>
                </div>





                <div className=" flex flex-col gap-[26px]">
                    <span className="mt-10 ml-3.5 text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">Diet Goal Analytics</span>
                    <ClientRisk hideRow={true} />
                </div>
            </div>


        </>
    )
}
