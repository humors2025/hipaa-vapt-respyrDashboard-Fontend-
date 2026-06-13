

import Image from 'next/image'
import NotificationModal from './modal/notification-modal';
import React, { useState } from 'react'

export const Notification = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const notifications = [
    { id: 1, icon: "/icons/hugeicons_label-important.svg", title: "2 clients: diet plan not assigned", time: "23 minutes ago" },
    { id: 2, icon: "/icons/hugeicons_alert-circle.svg", title: "Subscription plan: expires in 21 days", time: "23 minutes ago" },
    { id: 3, icon: "/icons/hugeicons_message-0234.svg", title: "21 new messages", time: "23 minutes ago" },
  ];

  
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <div className='flex flex-col gap-5'>
        {/* Header */}
        <div className='flex gap-5 items-center flex-wrap'>
          <p className='text-[#252525] text-[15px] font-medium leading-[110%] tracking-[-0.3px]'>
            Notifications ({notifications.length})
          </p>
          <div className='flex gap-[10px] items-center cursor-pointer select-none'
          onClick={openModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openModal()}
          >
            <p className='text-[#308BF9] cursor-pointer text-[12px] font-semibold leading-[110%] tracking-[-0.24px]'>View all</p>
            <Image
              src="/icons/right button.svg"
              alt='right'
              width={15}
              height={15}
              className='cursor-pointer'
            />
          </div>
        </div>


        

        {/* List */}
        <div className='flex gap-5'>
          {/* <div
            className="
            grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5
              
            "
          >
            {notifications.map((item) => (
              <div
                key={item.id}
                className="
               max-w-[353px] w-full min-w-[280px]
                  bg-[#E1E6ED] flex items-center 
                  rounded-[10px] pl-2 pr-[15px] py-2
                "
              >
          
                <div className="bg-white p-3 rounded-[15px] flex items-center justify-center">
                  <Image src={item.icon} alt={item.title} width={20} height={20} />
                </div>

         
                <div className="flex flex-col gap-1 flex-1 px-[10px]">
                  <p className="text-[#252525] font-[Poppins] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">
                    {item.title}
                  </p>
                  <p className="text-[#535359] font-[Poppins] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                    {item.time}
                  </p>
                </div>

               
                <button className="shrink-0 cursor-pointer">
                  <Image
                    src="/icons/hugeicons_multiplication-sign.svg"
                    alt="close"
                    width={15}
                    height={15}
                  />
                </button>
              </div>
            ))}
          </div> */}

<div className="flex gap-5 overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-3">
  {notifications.map((item) => (
    <div
      key={item.id}
      className="
        min-w-[280px] max-w-[353px] 
        bg-[#E1E6ED] flex items-center 
        rounded-[10px] pl-2 pr-[15px] py-2
      "
    >
      {/* left icon */}
      <div className="bg-white p-3 rounded-[15px] flex items-center justify-center">
        <Image src={item.icon} alt={item.title} width={20} height={20} />
      </div>

      {/* text */}
      <div className="flex flex-col gap-1 flex-1 px-[10px]">
        <p className="text-[#252525] font-[Poppins] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">
          {item.title}
        </p>
        <p className="text-[#535359] font-[Poppins] text-[10px] font-normal leading-normal tracking-[-0.2px]">
          {item.time}
        </p>
      </div>

      {/* close */}
      <button className="shrink-0 cursor-pointer">
        <Image
          src="/icons/hugeicons_multiplication-sign.svg"
          alt="close"
          width={15}
          height={15}
        />
      </button>
    </div>
  ))}
</div>


        </div>
      </div>

      

      <NotificationModal
open={isModalOpen}
onClose={closeModal}
      />
    </>
  )
}