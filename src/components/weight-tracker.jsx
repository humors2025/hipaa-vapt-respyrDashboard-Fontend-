import Image from "next/image"
import { IoIosArrowDown } from "react-icons/io";
import { useState } from "react";
import WeightGraph from "./weight-graph";
import WaterGraph from "./water-graph";

export default function WeightTracker() {
    const [firstDropdown, setFirstDropdown] = useState({
        selectedOption: "Weekly",
        isOpen: false
    });

    const [secondDropdown, setSecondDropdown] = useState({
        selectedOption: "Weekly",
        isOpen: false
    });

    const toggleFirstDropdown = () => {
        setFirstDropdown(prev => ({
            ...prev,
            isOpen: !prev.isOpen
        }));
    };

    const toggleSecondDropdown = () => {
        setSecondDropdown(prev => ({
            ...prev,
            isOpen: !prev.isOpen
        }));
    };

    const handleFirstOptionSelect = (option) => {
        setFirstDropdown(prev => ({
            selectedOption: option,
            isOpen: false
        }));
    };

    const handleSecondOptionSelect = (option) => {
        setSecondDropdown(prev => ({
            selectedOption: option,
            isOpen: false
        }));
    };

    return (
        <>
            <div className="flex gap-[25px]">
                {/* First Card */}
                <div className="border border-[#E1E6ED] rounded-[10px] px-2.5 w-full">
                    <div className=" border-b border-[#E1E6ED] pb-5 pt-5 pl-5">
                        <p className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">Weight Tracker</p>
                    </div>

                    <div className="flex gap-5 mt-[15px] ml-[17px] mr-[101px]">
                        <div className="w-full flex flex-col gap-[15px] py-2.5 pl-5 pr-2.5 bg-[#F5F7FA] rounded-[10px]">
                            <div className="flex flex-col gap-[15px]">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">Current Weight</p>
                                <div className="flex gap-2.5">
                                    <p className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">63Kg</p>
                                    <div className="flex items-center">
                                        <Image
                                            src="/icons/Frame 427319409.svg"
                                            alt="Frame 427319409.svg"
                                            width={20}
                                            height={20}
                                        />
                                        <p className="text-[#252525] text-[10px] font-semibold leading-normal tracking-[-0.2px]">0.5kg less</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">05 Jul, 12:30pm</p>
                        </div>

                        <div className="w-full flex flex-col gap-[15px] py-2.5 pl-5 pr-2.5 bg-[#F5F7FA] rounded-[10px]">
                            <div className="flex flex-col gap-[15px]">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">Current Weight</p>
                                <p className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">63Kg</p>
                            </div>
                        </div>
                    </div>


                    <div className="flex justify-between ml-5 mr-[350px] mt-[13px] mb-7">
                        <div className="relative w-full">
                            <div
                                className="flex justify-between items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer w-full"
                                onClick={toggleFirstDropdown}
                            >
                                <span className="text-[#535359] text-[12px] not-italic font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                    {firstDropdown.selectedOption}
                                </span>
                                <IoIosArrowDown className={`w-5 h-5 cursor-pointer transition-transform ${firstDropdown.isOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {firstDropdown.isOpen && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10 mt-1">
                                    <div
                                        className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                        onClick={() => handleFirstOptionSelect("Weekly")}
                                    >
                                        <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                            Weekly
                                        </span>
                                    </div>
                                    <div
                                        className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                        onClick={() => handleFirstOptionSelect("Monthly")}
                                    >
                                        <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                            Monthly
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    <WeightGraph />
                </div>

                {/* Second Card */}
                <div className="border border-[#E1E6ED] rounded-[10px] px-2.5 w-full">
                    <div className=" border-b border-[#E1E6ED] pb-5 pt-5 pl-5">
                        <p className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">Water Intake</p>
                    </div>

                    <div className="flex gap-5 mt-[15px] ml-5 mr-[22px] ">
                        <div className="flex flex-col gap-[15px] py-2.5 pl-5 pr-2.5 bg-[#F5F7FA] rounded-[10px] w-full">
                            <div className="flex flex-col gap-[15px]">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">Daily intake</p>
                                <div className="flex gap-2.5">
                                    <p className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">6L</p>
                                    <div className="flex items-center">
                                        <Image
                                            src="/icons/Frame 427319409.svg"
                                            alt="Frame 427319409.svg"
                                            width={20}
                                            height={20}
                                        />
                                        <p className="text-[#252525] text-[10px] font-semibold leading-normal tracking-[-0.2px]">0.5kg less than yesterday</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">05 Jul, 12:30pm</p>
                        </div>

                        <div className="flex flex-col gap-[15px] py-2.5 pl-5 pr-2.5 bg-[#F5F7FA] rounded-[10px] w-full">
                            <div className="flex flex-col gap-[15px]">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">Target intake</p>
                                <p className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">6L</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between ml-5 mr-[350px] mt-[13px] mb-7">
                        <div className="relative w-full">
                            <div
                                className="flex justify-between items-center rounded-[5px] border border-[#D9D9D9] bg-white py-[11px] px-[15px] cursor-pointer w-full"
                                onClick={toggleSecondDropdown}
                            >
                                <span className="text-[#535359] text-[12px] not-italic font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                    {secondDropdown.selectedOption}
                                </span>
                                <IoIosArrowDown className={`w-5 h-5 cursor-pointer transition-transform ${secondDropdown.isOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {secondDropdown.isOpen && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-[#D9D9D9] rounded-[5px] shadow-lg z-10 mt-1">
                                    <div
                                        className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                        onClick={() => handleSecondOptionSelect("Weekly")}
                                    >
                                        <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                            Weekly
                                        </span>
                                    </div>
                                    <div
                                        className="py-[11px] px-[15px] hover:bg-gray-50 cursor-pointer"
                                        onClick={() => handleSecondOptionSelect("Monthly")}
                                    >
                                        <span className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px] capitalize">
                                            Monthly
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <WaterGraph />
                </div>
            </div>
        </>
    )
}