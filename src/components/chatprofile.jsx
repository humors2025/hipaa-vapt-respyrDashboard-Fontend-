

"use client"
import Image from "next/image"
import { IoIosArrowForward } from "react-icons/io";

export default function ChatProfile() {
    return (
        <>
            {/* Page card */}
            <div className="w-full px-[10px] bg-white rounded-[15px] flex flex-col h-[80vh]">
                {/* Header */}
                <div className="flex gap-2 ml-[15px] mt-[15px] mb-[15px]">
                    <div className="p-2 bg-[#F0F0F0] rounded-full flex items-center justify-center">
                        <Image
                            src="/icons/hugeicons_user-circle-02.svg"
                            alt="hugeicons_user-circle"
                            width={24}
                            height={24}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-[#252525] text-[15px] font-semibold leading-[1.26] tracking-[-0.3px]">
                            Sagar Hosur
                        </p>
                        <p className="text-[#535359] text-[10px] font-normal leading-[normal] tracking-[-0.2px]">
                            Active Now
                        </p>
                    </div>
                </div>

                {/* Plan bar */}
                <div className="flex bg-[#F3FFF5]  px-2.5 rounded-[15px]">
                    <div className="w-[333px] flex gap-[42px] items-center">
                        <div className="flex gap-[5px]">
                            <p className="text-[#535359] text-[12px] font-normal leading-[1.26] tracking-[-0.24px]">Plan Status:</p>
                            <p className="text-[#3FAF58] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">Active</p>
                        </div>

                        <div className="flex gap-[5px] cursor-pointer">
                            <p className="text-[#308BF9] [leading-trim:both] [text-edge:cap] font-['Poppins'] text-[12px] not-italic font-semibold leading-[110%] tracking-[-0.24px]">
                                View plan
                            </p>
                            <IoIosArrowForward className="text-[#308BF9]" />
                        </div>
                    </div>

                    <div className="flex gap-7">
                        <div className="flex gap-[5px] my-2 ml-[21px]">
                            <p className="text-[#535359] text-[12px] font-normal leading-[1.26] tracking-[-0.24px]">Plan Duration:</p>
                            <p className="text-[#252525] text-[12px] font-semibold leading-[1.26] tracking-[-0.24px]">1-Month Plan</p>
                        </div>

                        <div className="flex gap-[5px] items-center">
                            <p className="text-[#535359] text-[12px] font-normal leading-[1.26] tracking-[-0.24px]">Plan Goal:</p>
                            <p className="text-[#252525] text-[12px] font-semibold leading-[1.26] tracking-[-0.24px]">
                                Weight Loss | PCOS Management
                            </p>
                        </div>
                    </div>
                </div>

                {/* Messages (scrollable) */}
                <div className="flex flex-col gap-3 w-full flex-1 overflow-y-auto px-4  hide-scrollbar">
                    {/* Left message */}
                    <div className="flex justify-start">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#EAF3FF]">
                            <p className="text-[#252525] text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor, sit amet consectetur adipisicing elit. Architecto perspiciati Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maxime quasi atque eu
                            </p>
                            <span className="self-end text-[#252525] text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                                6:03 am
                            </span>
                        </div>
                    </div>

                    {/* Right message */}
                    <div className="flex justify-end">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#1D6ECF]">
                            <p className="text-white text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor sit amet consectetur.
                            </p>
                            <span className="self-end text-white text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                                6:03 am
                            </span>
                        </div>
                    </div>

                    <div className="py-[5px] px-1">
                        <div className="flex items-center">
                            <div className="flex-grow border-t border-[#E1E6ED]"></div>
                            <p className="mx-2  px-2 text-[#252525] text-center text-[10px] font-normal leading-normal tracking-[-0.2px]">
                                Today
                            </p>
                            <div className="flex-grow border-t border-[#E1E6ED]"></div>
                        </div>
                    </div>


                    {/* Right message */}
                    <div className="flex justify-end">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#1D6ECF]">
                            <p className="text-white text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor sit amet consectetur.
                            </p>
                            <span className="self-end text-white text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                                6:03 am
                            </span>
                        </div>
                    </div>


                    <div className="flex justify-start">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#EAF3FF]">
                            <p className="text-[#252525] text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor, sit amet consectetur adipisicing elit. Architecto perspiciati Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maxime quasi atque eu
                            </p>
                            <span className="self-end text-[#252525] text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                                6:03 am
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-start">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#EAF3FF]">
                            <p className="text-[#252525] text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor, sit amet consectetur adipisicing elit. Architecto perspiciati Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maxime quasi atque eu
                            </p>
                            <span className="self-end text-[#252525] text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                               6:03 am
                            </span>
                        </div>
                    </div>


                    {/* Right message */}
                    <div className="flex justify-end">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#1D6ECF]">
                            <p className="text-white text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor sit amet consectetur.
                            </p>
                            <span className="self-end text-white text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                               6:03 am
                            </span>
                        </div>
                    </div>

                    {/* Right message */}
                    <div className="flex justify-end">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#1D6ECF]">
                            <p className="text-white text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor sit amet consectetur.
                            </p>
                            <span className="self-end text-white text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                               6:03 am
                            </span>
                        </div>
                    </div>


                    {/* Right message */}
                    <div className="flex justify-end">
                        <div className="w-[312px] flex flex-col rounded-[8px] py-2.5 pl-[15px] pr-[42px] bg-[#1D6ECF]">
                            <p className="text-white text-[12px] font-normal leading-[normal] tracking-[-0.24px]">
                                Lorem ipsum dolor sit amet consectetur.
                            </p>
                            <span className="self-end text-white text-[10px] font-normal leading-[1.26] tracking-[-0.2px]">
                                6:03 am
                            </span>
                        </div>
                    </div>


                </div>


                {/* <div className="flex justify-between items-center bg-[#F0F0F0] rounded-[30px] px-[25px] py-4 mt-9 mb-2">
                    <p className="text-[#A1A1A1] font-[Poppins] text-[12px] font-normal leading-[110%] tracking-[-0.24px] ">Type your meassage....</p>
                    <Image
                        src="/icons/hugeicons_sent.svg"
                        alt="hugeicons"
                        width={24}
                        height={24}
                    />
                </div> */}
                <div className="flex justify-between items-center bg-[#F0F0F0] rounded-[30px] px-[25px] py-4 mt-9 mb-2">
  <input
    type="text"
    placeholder="Type your message...."
    className="flex-1 bg-transparent outline-none text-[#252525] font-[Poppins] text-[12px] font-normal leading-[110%] tracking-[-0.24px] mr-3"
  />
  <Image
    src="/icons/hugeicons_sent.svg"
    alt="send-icon"
    width={24}
    height={24}
    className="cursor-pointer"
  />
</div>

            </div>
        </>
    );
}
