"use client"

import Image from "next/image"
import { useRef, useEffect, useState } from 'react';
import { BsThreeDotsVertical } from "react-icons/bs";
import { IoIosArrowForward } from "react-icons/io";
import { IoIosArrowDown } from "react-icons/io";
import Expand from "./modal/expand-popup";
import { GoPlus } from "react-icons/go";
import DietEvent from "./modal/diet-event-popup";

// Create a reusable component for the table cell
function DietPlanTableCell({ dayNumber, hideLeftBorder = false, hideBottomBorder = false  }) {
const borderClasses = `
    border 
    ${hideLeftBorder ? 'border-l-0' : ''}
    ${hideBottomBorder ? 'border-b-0' : ''} 
    border-[#D9D9D9] 
    px-[15px] 
    py-[15px] 
    align-top 
    min-w-[340px]
  `;

  return (
    <td className={borderClasses}>
      <div className="flex flex-col gap-2.5">
        {/* Event 1 */}
        <div className="flex flex-col gap-5 bg-white rounded-[10px] px-[15px] pt-[16px] pb-[15px] border-t-[9px] border-[#FFA99F] ">
          <div className="flex justify-between">
            <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] py-[5px] px-[9px] whitespace-nowrap">
              Event 1
            </p>
            <BsThreeDotsVertical className="w-6 h-6 text-[#535359]" />
          </div>

          <div className="flex flex-col gap-5">
            <div className="relative">
              <input
                type="text"
                id={`floating_outlined_${dayNumber}_1`}
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                placeholder=" "
              />
              <label
                htmlFor={`floating_outlined_${dayNumber}_1`}
                className="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1"
              >
                Floating outlined
              </label>
            </div>

            <div className="flex gap-[7px]">
              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  From
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>

              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  To
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>
            </div>

            <div className="flex justify-between items-center border border-[#E1E6ED] rounded-[8px] py-[9px] pl-5 pr-[15px]">
              <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">Add Items (3)</span>
              <IoIosArrowForward className="text-[#308BF9] w-[26px] h-[26px]" />
            </div>
          </div>

        
        </div>

        
                
        {/* Event 2 */}
        <div className="flex flex-col gap-5 bg-white rounded-[10px] px-[15px] pt-[16px] pb-[15px] border-t-[9px] border-[#9FFFCE] ">
          <div className="flex justify-between">
            <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] py-[5px] px-[9px] whitespace-nowrap">
              Event 2
            </p>
            <BsThreeDotsVertical className="w-6 h-6 text-[#535359]" />
          </div>

          <div className="flex flex-col gap-5">
            <div className="relative">
              <input
                type="text"
                id={`floating_outlined_${dayNumber}_4`}
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                placeholder=" "
              />
              <label
                htmlFor={`floating_outlined_${dayNumber}_4`}
                className="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1"
              >
                Floating outlined
              </label>
            </div>

            <div className="flex gap-[7px]">
              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  From
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>

              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  To
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>
            </div>

            <div className="flex justify-between items-center border border-[#E1E6ED] rounded-[8px] py-[9px] pl-5 pr-[15px]">
              <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">Add Items (3)</span>
              <IoIosArrowForward className="text-[#308BF9] w-[26px] h-[26px]" />
            </div>
          </div>
        </div>

        {/* Event 3 */}
        <div className="flex flex-col gap-5 bg-white rounded-[10px] px-[15px] pt-[16px] pb-[15px] border-t-[9px] border-[#9FBAFF]">
          <div className="flex justify-between">
            <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] py-[5px] px-[9px] whitespace-nowrap">
              Event 3
            </p>
            <BsThreeDotsVertical className="w-6 h-6 text-[#535359]" />
          </div>

          <div className="flex flex-col gap-5">
            <div className="relative">
              <input
                type="text"
                id={`floating_outlined_${dayNumber}_7`}
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                placeholder=" "
              />
              <label
                htmlFor={`floating_outlined_${dayNumber}_7`}
                className="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1"
              >
                Floating outlined
              </label>
            </div>

            <div className="flex gap-[7px]">
              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  From
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>

              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  To
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>
            </div>

            <div className="flex justify-between items-center border border-[#E1E6ED] rounded-[8px] py-[9px] pl-5 pr-[15px]">
              <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">Add Items (3)</span>
              <IoIosArrowForward className="text-[#308BF9] w-[26px] h-[26px]" />
            </div>
          </div>
        </div>


 {/* Event 4 */}
        <div className="flex flex-col gap-5 bg-white rounded-[10px] px-[15px] pt-[16px] pb-[15px] border-t-[9px] border-[#9FBAFF]">
          <div className="flex justify-between">
            <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] py-[5px] px-[9px] whitespace-nowrap">
              Event 4
            </p>
            <BsThreeDotsVertical className="w-6 h-6 text-[#535359]" />
          </div>

          <div className="flex flex-col gap-5">
            <div className="relative">
              <input
                type="text"
                id={`floating_outlined_${dayNumber}_7`}
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                placeholder=" "
              />
              <label
                htmlFor={`floating_outlined_${dayNumber}_7`}
                className="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1"
              >
                Floating outlined
              </label>
            </div>

            <div className="flex gap-[7px]">
              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  From
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>

              <div className="relative w-full">
                <input
                  type="text"
                  id={`floating_outlined_${dayNumber}_2`}
                  className="peer block w-full rounded-lg border border-gray-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                  placeholder=" "
                />
                <label
                  htmlFor={`floating_outlined_${dayNumber}_2`}
                  className="absolute left-2 top-2 z-10 origin-[0] bg-white px-2 text-sm text-gray-500 transition-all duration-300 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 
               peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:scale-75 peer-focus:text-blue-600"
                >
                  To
                </label>
                <IoIosArrowDown
                  className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#A1A1A1]"
                />
              </div>
            </div>

            <div className="flex justify-between items-center border border-[#E1E6ED] rounded-[8px] py-[9px] pl-5 pr-[15px]">
              <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">Add Items (3)</span>
              <IoIosArrowForward className="text-[#308BF9] w-[26px] h-[26px]" />
            </div>
          </div>
        </div>

      </div>
    </td>
  );
}

export default function CreateDietPlan({ isExpanded = false, onToggleExpand }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEventPopUp, setIsEventPopUp] = useState(false);
  // Show 7 days total; scroll horizontally to see beyond the first ~3 columns
  const days = [1, 2, 3, 4, 5, 6, 7];

  const handleExpandClick = () => {
    if (isExpanded && onToggleExpand) {
      onToggleExpand();
    } else {
      setIsModalOpen(true);
    }
  };


  const handleAddEvent = () =>{
    setIsEventPopUp(true);
  }

  return (
    <>
      <div className='w-full max-w-full min-w-0 overflow-x-hidden relative flex flex-col gap-[310px]'>

        <div className={`pt-[23px] pb-[18px] ${isExpanded?'px-[25px]':''} `}>
          <div className="flex justify-between pl-[15px] pr-[20px]">
            <p className='text-[#252525] pb-[18px] pt-[23px] text-[20px] font-semibold leading-[110%] tracking-[0.4px] whitespace-nowrap'>Diet Plan</p>

            <div className='flex gap-2.5 items-center pb-2.5 cursor-pointer'
            onClick={handleExpandClick}
            >
              <span className='text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[-0.24px]'
                
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </span>

              <Image
                src={isExpanded ? "/icons/hugeicons_arrow-collapse.svg" : "/icons/hugeicons_arrow-expand.svg"}
                alt={isExpanded ? "Collapse icon" : "Expand icon"}
                width={20}
                height={20}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[15px]">
            <div className="w-full  border-b border-[#E1E6ED]"></div>

            <div className="w-fit flex justify-center">
              <div className="rounded-l-[10px] border border-[#D9D9D9] pl-4 py-2 pr-2.5 bg-[#F0F0F0] text-center">
                <p className="text-[#252525] text-[12px] tracking-[-0.24px] leading-[110%] font-normal">
                  Type
                </p>
              </div>
              <div className="flex rounded-r-[10px] border border-[#D9D9D9] gap-[37px] text-center items-center pl-4 py-2 pr-2.5 bg-white">
                <p className="cursor-pointer text-[#252525] text-[12px] tracking-[-0.24px] leading-[110%] font-normal">
                  Not specified
                </p>
                <IoIosArrowDown className="text-[#A1A1A1] cursor-pointer" />
              </div>
            </div>

            <div className="pt-[54px] bg-[#F5F7FA] rounded-[15px] ">

              <div className="flex px-[15px]">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="110" height="8" viewBox="0 0 110 8" fill="none">
                    <path d="M4 4H106" stroke="#535359" strokeWidth="8" strokeLinecap="round" />
                  </svg>
                </div>

                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="641" height="9" viewBox="0 0 641 9" fill="none">
                    <path d="M4.5 4.5H637" stroke="#E1E6ED" strokeWidth="8" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* Horizontal slider: table is wider than container, so only ~3 columns show at once */}
              <div className="mt-4 mx-[15px]  overflow-x-auto">

                <table className="min-w-full border border-[#E1E6ED]  border-collapse border-l-0 border-b-0 border-t-0">
                  <thead>
                    <tr className="py-[17px] px-6">
                      {days.map((day) => (
                        <th
                          key={day}
                          className="min-w-[340px] text-[#535359] text-[15px] font-semibold leading-[110%] tracking-[-0.3px] text-left py-2 px-3"
                        >
                          Day{day}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr className="w-full">
                      {days.map((day, index) => (
                        <DietPlanTableCell key={day} dayNumber={day} hideLeftBorder={index === 0}
          hideBottomBorder={true}/>

          
                      ))}
                     
                    </tr>
                    
                  </tbody>

                 
                </table>
   <div className="max-w-[134px] ml-[71px] cursor-pointer  flex gap-2.5 px-5 py-[15px] rounded-[10px] bg-white border-[#D9D9D9]"
    onClick={handleAddEvent}
   >
          <GoPlus className="text-[#308BF9] w-6 h-6"/>
          <button className="cursor-pointer text-[#308BF9] text-[12px] font-semibold leading-[100%] tracking-[-0.24px]"
         
          >Add Event</button>
        </div>

              </div>




            </div>

            <div>
              <div className="w-full border-b border-[#E1E6ED] mt-[30px]"></div>


              <div className='py-[23px]'>
                <div className='flex gap-5 justify-end'>
                  <div className='px-5 py-[15px] bg-white border border-[#D9D9D9] rounded-[10px] text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer'>
                    Save as draft
                  </div>


                  <div className='px-20 py-[15px] bg-[#308BF9] rounded-[10px] text-white text-[12px] font-semibold leading-normal tracking-[-0.24px] cursor-pointer'>
                    Finish
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>


      <Expand
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <DietEvent
      open={isEventPopUp}
      onClose={() => setIsEventPopUp(false)}
      />
    </>
  )
}
