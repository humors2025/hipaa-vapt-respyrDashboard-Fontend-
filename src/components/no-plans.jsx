"use client"
import { GoPlus } from "react-icons/go";
import Image from "next/image";
import CreatePlanModal from './modal/create-plan';
import CreatePlanPopUp from "./pop-folder/create-plan-popup";
import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux';

export default function NoPlans() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const clientData = useSelector((state) => state.clientProfile.data);
  const handleCreatePlanClick = () => {
    // Clear localStorage when creating a new plan
    localStorage.clear();
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-col w-full">
        {/* Full-width box */}
        <div className="w-full border-[4px] border-dotted border-[#E1E6ED] rounded-[15px] py-[102px]">
          <div className="flex flex-col items-center gap-[30px]">
            <span className="text-[#738298] text-[25px] font-semibold leading-[110%] tracking-[-1px]">
              No Active plan
            </span>
            <div
              className="flex gap-[15px] px-[18px] py-[9px] bg-[#308BF9] rounded-[5px] cursor-pointer"
              onClick={handleCreatePlanClick}
            >
              <GoPlus className="text-white w-[15px] h-[15px]" />
              <span className="text-white text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">
                Create New Plan
              </span>
            </div>
          </div>
        </div>

        {/* Plan History - Always show header, conditionally show content */}
        {clientData?.plans_count?.total > 0 && (
          <div className="max-w-[332px] mt-[30px] bg-white rounded-[15px] px-[22px] py-10">
            <div>
              <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                Plan History ({clientData?.plans_count?.total})
              </span>
            </div>

            <div className="my-[22px] border border-[#E1E6ED]" />

            <div className="flex flex-col gap-[30px]">
              {clientData?.plans_summary?.completed?.length > 0 &&
                clientData.plans_summary.completed.map((plan) => (
                  <div key={plan.id} className="flex flex-col">
                    <div className="flex gap-[25px] justify-between cursor-pointer">
                      <span className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                        {plan.plan_title}
                      </span>
                      <span className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                        {`${plan.plan_start_date} - ${plan.plan_end_date}`}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">
                        Updated {plan.updated_at}
                      </span>

                      <div className="flex gap-[3px] items-center">
                        <Image
                          src="/icons/verified.svg"
                          alt="verified"
                          width={12}
                          height={12}
                        />
                        <span className="text-[#3FAF58] text-[12px]">
                          Finished
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>

      {/* <CreatePlanModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      /> */}


       <CreatePlanPopUp
                      open={isModalOpen}
                      onClose={() => setIsModalOpen(false)}
                  />
    </>
  );
}