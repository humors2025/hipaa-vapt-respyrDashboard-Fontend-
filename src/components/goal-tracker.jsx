

"use client";
import Image from "next/image";
import { useState, useEffect  } from "react";
import { IoIosArrowForward } from "react-icons/io";
import ClientMonitor from "./client-monitor";
import TestMonitor from "./test-monitor";
import DietPlanMonitor from "./diet-plan-monitor";
import DashboardCard from "./dashboard-card";

export default function GoalTracker() {
  const [activeTab, setActiveTab] = useState("Client Monitor");
  const menuItems = ["Client Monitor", "Test Monitor",
    //  "Diet Plan Monitor"
    ];
  const [isMounted, setIsMounted] = useState(false);


    useEffect(() => {
    
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; 
  }


  const handleItemClick = (item) => setActiveTab(item);

  return (
    <>
      <div className="flex gap-5 bg-white rounded-[15px] pt-[15px] pb-[18px] pr-5">
        {/* Left menu */}
        <div className="flex flex-col gap-[18px] bg-white rounded-[15px] py-[15px] px-[18px]">
          <div className="w-[325px] px-2 pt-2 pb-[81px]">
            {menuItems.map((item, index) => (
              <div
                key={index}
                className={`flex justify-between rounded-[5px] py-[17px] pl-[23px] pr-[15px] cursor-pointer ${
                  activeTab === item ? "bg-[#E1E6ED]" : "bg-white"
                }`}
                onClick={() => handleItemClick(item)}
              >
                <span
                  className={`text-[15px] font-semibold whitespace-nowrap leading-[110%] tracking-[-0.3px] ${
                    activeTab === item ? "text-[#308BF9]" : "text-[#252525]"
                  }`}
                >
                  {item}
                </span>
                <IoIosArrowForward
                  className={activeTab === item ? "text-[#308BF9]" : "text-[#252525]"}
                />
              </div>
            ))}
          </div>

          {/* Left gradient cards (unchanged) */}
          {/* <div className="pb-2.5 rounded-[15px] bg-gradient-to-b from-[#FBD881] to-[#E7AA37]">
            <div className="ml-1.5 mr-2.5 pt-[30px] pb-[23px] pl-[34px] pr-[138px]">
              <span className="text-[#252525] font-semibold leading-[110%] tracking-[-0.3px]">
                Plan Goal Tracker
              </span>
            </div>

            <div className="flex flex-col gap-[37px]">
              <div className="flex flex-col gap-[5px] pl-[34px] pr-[157px] pt-7">
                <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">
                  30 plans
                </span>
                <div className="flex flex-col">
                  <span className="text-[#252525] text-[12px] leading-normal tracking-[-0.24px] whitespace-nowrap">
                    Total Assigned
                  </span>
                  <span className="text-[#252525] text-[12px] leading-normal tracking-[-0.24px] whitespace-nowrap">
                    (Excluding active plan)
                  </span>
                </div>
              </div>

              <div className="relative flex ml-2.5 mr-[15px] pb-[9px] rounded-[15px] bg-gradient-to-b from-[#FBD881] to-[#E7AA37] pt-[18px] pl-[30px] overflow-visible">
                <div className="flex flex-col gap-[13px]">
                  <div className="flex flex-col">
                    <span className="text-[#252525] text-[20px] font-bold leading-normal tracking-[-0.4px]">
                      13 plans
                    </span>
                    <span className="text-[#252525] text-[12px] leading-normal tracking-[-0.24px]">
                      Target Goal Achieved
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="flex gap-2.5 items-center">
                      <span className="text-[#724406] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">
                        View plans
                      </span>
                      <IoIosArrowForward className="text-[#724406]" />
                    </div>
                  </div>
                </div>

                <div className="absolute right-[3px] bottom-0">
                  <Image src="/icons/Cup.png" alt="Cup" width={140} height={140} />
                </div>
              </div>
            </div>
          </div> */}
        </div>

        {/* Right side: header cards + active monitor */}
        <div className="flex-1 flex flex-col gap-7">
         {activeTab !== "Diet Plan Monitor" && <DashboardCard activeTab={activeTab} />}

          {activeTab === "Client Monitor" && <ClientMonitor />}
          {activeTab === "Test Monitor" && <TestMonitor />}
          {/* {activeTab === "Diet Plan Monitor" && <DietPlanMonitor />} */}
        </div>
      </div>
    </>
  );
}