// "use client"

// import React from 'react'
// import Calender from "@/components/calender";
// import ClientMonitor from "@/components/client-monitor";
// import { UserProfile } from '@/components/user-profile';
// import { Notification } from '@/components/notification';
// //import { ClientRisk} from "@/components/client-risk";
// import ClientRisk from "../../../components/client-risk"
// import DashboardSidebar from '@/components/dashboard-sidebar';
// import GoalTracker from '@/components/goal-tracker';
// import {
//   getClientsForDietician,
//   selectClients,
//   selectClientsCount,
//   selectClientsStatus,
//   selectClientsError,
// } from "../../../store/clientSlice";
// import Cookies from "js-cookie";
// import { useDispatch, useSelector } from "react-redux";
// import { useState, useMemo, useEffect } from "react";
// import ProtectedRoute from "../../../components/ProtectedRoute";

// const Dashboard = () => {
//   const dispatch = useDispatch();
//   const clients = useSelector(selectClients);


//   useEffect(() => {

//     const dieticianCookie = Cookies.get("dietician");

//     if (dieticianCookie) {
//       try {

//         const dieticianData = JSON.parse(decodeURIComponent(dieticianCookie));


//         const dieticianId = dieticianData?.dietician_id;

//         if (dieticianId) {

//           dispatch(getClientsForDietician({ dieticianId }));
//         } else {
//           console.error("dietician_id not found in cookie data.");

//         }
//       } catch (e) {
//         console.error("Failed to parse dietician cookie:", e);

//       }
//     } else {
//       console.warn("Dietician cookie not found.");

//     }

//   }, [dispatch]);


//   return (
//     <>

//       <ProtectedRoute>
//         {/* <UserProfile />  */}
//         {/* <div className='pb-[42px]'>
//  <Notification/> 
//  </div> */}

//         {/* <div className='flex gap-5'> */}
//         {/* <DashboardSidebar/> */}
//      <div className="flex flex-col gap-5 w-full">
//           {/* <GoalTracker/>  */}

//         </div>

//  <div className="flex gap-5 w-full bg-white px-[15px] pt-2.5 pb-1.5 rounded-[15px]">
//         <div className="flex-shrink-0">
//             <Calender />
//           </div>

//           <div className="flex-1">
//             <ClientMonitor />
//           </div>
//         </div>
//         {/* </div> */}
//       </ProtectedRoute>
//     </>
//   )
// }

// export default Dashboard;




"use client"

import React from 'react'
import Calender from "@/components/calender";
import ClientMonitor from "@/components/client-monitor";
import { UserProfile } from '@/components/user-profile';
import { Notification } from '@/components/notification';
import ClientRisk from "@/components/client-risk"
import DashboardSidebar from '@/components/dashboard-sidebar';
import GoalTracker from '@/components/goal-tracker';
import {
  getClientsForDietician,
  selectClients,
  selectClientsCount,
  selectClientsStatus,
  selectClientsError,
} from "@/store/clientSlice";
import Cookies from "js-cookie";
import { useDispatch, useSelector } from "react-redux";
import { useState, useMemo, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import ClientsSection from '@/components/client-monitor'; // Import ClientsSection

const Dashboard = () => {
  const dispatch = useDispatch();
  const clients = useSelector(selectClients);
  
  // State for selected date from Calendar
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1, // 1-based month (1 = Jan)
      day: today.getDate()
    };
  });

  useEffect(() => {
    const dieticianCookie = Cookies.get("dietician");

    if (dieticianCookie) {
      try {
        const dieticianData = JSON.parse(decodeURIComponent(dieticianCookie));
        const dieticianId = dieticianData?.dietician_id;

        if (dieticianId) {
          dispatch(getClientsForDietician({ dieticianId }));
        } else {
          console.error("dietician_id not found in cookie data.");
        }
      } catch (e) {
        console.error("Failed to parse dietician cookie:", e);
      }
    } else {
      console.warn("Dietician cookie not found.");
    }
  }, [dispatch]);

  // Handle date selection from Calendar
  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  return (
    <>
      <ProtectedRoute>
         {/* <UserProfile />  */}
        {/* <div className='pb-[42px]'>
 <Notification/> 
 </div> */}

        {/* <div className='flex gap-5'> */}
        {/* <DashboardSidebar/> */}
     <div className="flex flex-col gap-5 w-full">
          {/* <GoalTracker/>  */}

        </div>

        <div className="flex gap-5 w-full bg-white px-[15px] pt-2.5 pb-1.5 rounded-[15px]">
          <div className="flex-shrink-0">
            {/* Pass selectedDate state and handler to Calendar */}
            <Calender 
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </div>

          <div className="flex-1 ">
            {/* Pass selectedDate to ClientMonitor which contains ClientsSection */}
            <ClientMonitor selectedDate={selectedDate} />
          </div>
        </div>
      </ProtectedRoute>
    </>
  )
}

export default Dashboard;