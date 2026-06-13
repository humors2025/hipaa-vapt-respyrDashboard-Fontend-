
// "use client"

// import { useState, useMemo } from "react"
// import ClientTable from "@/components/clientTable"
// import { UserProfile } from "@/components/user-profile"
// import { useDispatch, useSelector } from "react-redux";
// import { fetchClientsForDietician } from "../../../store/clientSlice";

// export default function Client() {
//   const tabs = useMemo(
//     () => [
//       { id: "all", label: "All Clients (45)" },
//       { id: "active", label: "Active Plan (40)" },
//       { id: "needs", label: "Needs Plan (10)" },
//     ],
//     []
//   )

//   const [activeTab, setActiveTab] = useState("all")
//   const activeIndex = tabs.findIndex(t => t.id === activeTab)

//     const dispatch = useDispatch();
//   const { status, error, count } = useSelector((s) => s.clients);

//   useEffect(() => {
//     dispatch(fetchClientsForDietician());
//   }, [dispatch]);

//   const TabItem = ({ id, label, index, isLast }) => {
//     const isActive = activeTab === id
//     const isLeftOfActive = index === activeIndex - 1
//     const isRightOfActive = index === activeIndex + 1

//     // Give neighbor tabs a bottom corner toward the active tab
//     const neighborBottomRadius =
//       !isActive && isLeftOfActive
//         ? "rounded-br-[0px]"
//         : !isActive && isRightOfActive
//         ? "rounded-bl-[0px]"
//         : ""

//     return (
//       <div
//         onClick={() => setActiveTab(id)}
//         className={[
//           "relative flex items-center px-20 py-5 cursor-pointer select-none",
//           // 3-side border on tabs, no bottom
//           "border-t border-l border-r border-[#D9D9D9] border-b-0",
//           !isLast && "border-r-0",
//           "rounded-t-[20px]",
//           neighborBottomRadius,
//           // pull tabs down 1px to overlap content box top edge
//           "-mb-px",
//           "transition-colors",
//           isActive
//             // top-only shadow (no bottom) using negative spread to avoid bleed
//             ? "bg-white  z-10"
//             : "bg-[#F5F7FA] z-0"
//         ]
//           .filter(Boolean)
//           .join(" ")}
//       >
//         {/* mask the bottom edge so the shadow never reads as a bottom border */}
//         {isActive && (
//           <span className="pointer-events-none absolute -bottom-1 left-0 right-0 h-2 bg-white" />
//         )}

//         <p
//           className={[
//             "text-[15px] font-semibold leading-[110%] tracking-[-0.3px]",
//             isActive ? "text-[#308BF9]" : "text-[#535359]"
//           ].join(" ")}
//         >
//           {label}
//         </p>
//       </div>
//     )
//   }

//   return (
//     <>
//       <div>
//         {/* Tabs */}
//         <div className="flex overflow-hidden hide-scrollbar">
//           {tabs.map((t, i) => (
//             <TabItem
//               key={t.id}
//               id={t.id}
//               label={t.label}
//               index={i}
//               isLast={i === tabs.length - 1}
//             />
//           ))}
//         </div>

//         {/* Content wrapper: NO top border so white is continuous under tabs */}
//         <div className="border border-[#D9D9D9] border-t-0 rounded-b-[10px] rounded-tr-[10px] bg-white p-5">
//           {/* <UserProfile /> */}
//           <ClientTable activeTab={activeTab}  testAssigned={false}/>
//         </div>
//       </div>
//     </>
//   )
// }




















"use client"

import { useState, useMemo, useEffect } from "react"
import ClientTable from "@/components/clientTable"
import { UserProfile } from "@/components/user-profile"
import {
  getClientsForDietician,
  selectClients,
  selectClientsCount,
  selectClientsStatus,
  selectClientsError,
} from "@/store/clientSlice";

import { useDispatch, useSelector } from "react-redux";
import { fetchClientsForDietician } from "@/store/clientSlice"
import Cookies from "js-cookie";

export default function Client() {

 const dispatch = useDispatch();
  const clients = useSelector(selectClients);
  const count = useSelector(selectClientsCount);
  const status = useSelector(selectClientsStatus);
  const error = useSelector(selectClientsError);


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


  //   const activeCount = useMemo(
  //   () => clients.filter(c => (c?.plans_count?.active ?? 0) > 0).length,
  //   [clients]
  // );

 const activeCount = useMemo(
  () => (clients || []).filter(c => (c?.plans_count?.active ?? 0) > 0).length,
  [clients]
);

  // const needsCount = useMemo(
  //   () => clients.filter(c => (c?.plans_count?.total ?? 0) === 0).length,
  //   [clients]
  // );


  const needsCount = useMemo(
  () => (clients || []).filter(c => (c?.plans_count?.total ?? 0) === 0).length,
  [clients]
);

   const tabs = useMemo(
    () => [
      { id: "all", label: `All Clients (${count ?? 0})` },
      // { id: "active", label: `Active Plan (${activeCount ?? 0})` },
      // { id: "needs", label: `Needs Plan (${needsCount ?? 0})` },
    ],
    [count, activeCount, needsCount]
  );


const [activeTab, setActiveTab] = useState("all");
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);


   if (status === "loading") return <div>Loading clients…</div>;
  if (status === "failed") return <div>Error: {error}</div>;

  return (
    <>
      <div>
        {/* Tabs */}
        <div className="flex overflow-hidden hide-scrollbar">
          {tabs.map((t, i) => (
            <TabItem
              key={t.id}
              id={t.id}
              label={t.label}
              index={i}
              isLast={i === tabs.length - 1}
            />
          ))}
        </div>

        {/* Content wrapper */}
        <div className="border border-[#D9D9D9] border-t-0 rounded-b-[10px] rounded-tr-[10px] bg-white p-5">
          {/* <UserProfile /> */}
          <ClientTable activeTab={activeTab}  testAssigned={false} clients={clients}/>
        </div>
      </div>
    </>
  )

  function TabItem({ id, label, index, isLast }) {
    const isActive = activeTab === id
    const isLeftOfActive = index === activeIndex - 1
    const isRightOfActive = index === activeIndex + 1

    const neighborBottomRadius =
      !isActive && isLeftOfActive
        ? "rounded-br-[0px]"
        : !isActive && isRightOfActive
        ? "rounded-bl-[0px]"
        : ""

    return (
      <div
        onClick={() => setActiveTab(id)}
        className={[
          "relative flex items-center px-20 py-5 cursor-pointer select-none",
          "border-t border-l border-r border-[#D9D9D9] border-b-0",
          !isLast && "border-r-0",
          "rounded-t-[20px]",
          neighborBottomRadius,
          "-mb-px",
          "transition-colors",
          isActive ? "bg-white  z-10" : "bg-[#F5F7FA] z-0"
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isActive && (
          <span className="pointer-events-none absolute -bottom-1 left-0 right-0 h-2 bg-white" />
        )}

        <p
          className={[
            "text-[15px] font-semibold leading-[110%] tracking-[-0.3px]",
            isActive ? "text-[#308BF9]" : "text-[#535359]"
          ].join(" ")}
        >
          {label}
        </p>
      </div>
    )
  }
}
