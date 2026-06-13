

"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function PendingPopUp({
  open,
  onClose,
  todayRequests: todayRequestsProp = [],
  yesterdayRequests: yesterdayRequestsProp = [],
}) {
  // ✅ Default Today requests
  const defaultTodayRequests = [
    {
      id: 1,
      name: "Sagar",
      age: 28,
      gender: "Male",
      weight: "78 kgs",
      height: "178 cms",
      location: "Bangalore",
      image: "/icons/Ellipse 668.svg",
    },
    {
      id: 2,
      name: "Rohit",
      age: 31,
      gender: "Male",
      weight: "82 kgs",
      height: "172 cms",
      location: "Mumbai",
      image: "/icons/Ellipse 668.svg",
    },
    {
      id: 3,
      name: "Ankita",
      age: 25,
      gender: "Female",
      weight: "55 kgs",
      height: "162 cms",
      location: "Delhi",
      image: "/icons/Ellipse 668.svg",
    },
  ];

  // ✅ Default Yesterday requests
  const defaultYesterdayRequests = [
    {
      id: 4,
      name: "Vijay",
      age: 29,
      gender: "Male",
      weight: "70 kgs",
      height: "170 cms",
      location: "Hyderabad",
      image: "/icons/Ellipse 668.svg",
    },
    {
      id: 5,
      name: "Priya",
      age: 27,
      gender: "Female",
      weight: "60 kgs",
      height: "165 cms",
      location: "Pune",
      image: "/icons/Ellipse 668.svg",
    },
    {
      id: 6,
      name: "Karan",
      age: 30,
      gender: "Male",
      weight: "75 kgs",
      height: "176 cms",
      location: "Chennai",
      image: "/icons/Ellipse 668.svg",
    },
    {
      id: 7,
      name: "Poornesh",
      age: 50,
      gender: "Male",
      weight: "85 kgs",
      height: "176 cms",
      location: "Chennai",
      image: "/icons/Ellipse 668.svg",
    },
  ];

  // 👉 Use props if provided
  const todayRequests =
    todayRequestsProp.length > 0 ? todayRequestsProp : defaultTodayRequests;

  const yesterdayRequests =
    yesterdayRequestsProp.length > 0
      ? yesterdayRequestsProp
      : defaultYesterdayRequests;

  const totalPending = todayRequests.length + yesterdayRequests.length;
  const hasToday = todayRequests.length > 0;
  const hasYesterday = yesterdayRequests.length > 0;

  // ✅ ESC key close
  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // ✅ Disable background scroll
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* FULL SCREEN WRAPPER – outside click closes */}
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Popup + close button */}
        <div
          className="relative flex items-start gap-4"
          onClick={(e) => e.stopPropagation()} // ⛔ prevent close when clicking inside
          role="dialog"
          aria-modal="true"
        >
          {/* POPUP */}
          <div className="flex flex-col gap-[11px] bg-white rounded-[10px] max-h-[80vh] w-full px-5 pt-[32px] pb-[22px]">
            {/* Header */}
            <div className="pl-[17px] pb-[25px] border-b">
              <p className="text-[#252525] text-[22px] font-semibold tracking-[-0.8px]">
                Pending Request({totalPending})
              </p>
            </div>

            {/* Scroll content */}
            <div className="flex-1 overflow-y-auto pb-5 hide-scrollbar">
              <div className="flex flex-col gap-3 bg-[#F5F7FA] rounded-[10px] px-2.5 py-3">
                {hasToday && (
                  <>
                    <p className="text-[#535359] text-[12px] ml-[10px] mt-2">
                      Today
                    </p>
                    {todayRequests.map((item) => (
                      <RequestRow key={item.id} item={item} />
                    ))}
                  </>
                )}

                {hasYesterday && (
                  <>
                    <p className="text-[#535359] text-[12px] ml-[10px] mt-4">
                      Yesterday
                    </p>
                    {yesterdayRequests.map((item) => (
                      <RequestRow key={item.id} item={item} />
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-2.5 justify-end">
              <button
                disabled={totalPending === 0}
                className={`w-[120px] px-5 py-[15px] rounded-[10px] text-[12px] font-semibold
                  ${
                    totalPending === 0
                      ? "bg-[#D9D9D9] text-[#535359]"
                      : "bg-[#308BF9] text-white"
                  }`}
              >
                Accept All
              </button>

              <button className="w-[120px] bg-[#F5F7FA] border border-[#D9D9D9] rounded-[10px] px-5 py-[15px] text-[12px] font-semibold">
                Deny All
              </button>
            </div>
          </div>

          {/* CLOSE BUTTON – outside popup */}
          <button
            onClick={onClose}
            className="shrink-0 bg-white text-[#252525] text-[18px] px-2 py-1 rounded-md shadow cursor-pointer"
            aria-label="Close"
          >
          x
          </button>
        </div>
      </div>
    </>
  );
}

function RequestRow({ item }) {
  return (
    <div className="flex border-b border-[#E1E6ED] py-4">
      <div className="flex items-center gap-[15px]">
        <Image src={item.image} alt={item.name} width={40} height={40} />
        <div>
          <p className="text-[12px] font-semibold">{item.name}</p>
          <p className="text-[10px] text-[#535359]">
            {item.age} years, {item.gender}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-[54px] ml-auto">
        <div className="text-[10px]">
          <p>Weight : {item.weight}</p>
          <p>Height : {item.height}</p>
        </div>

        <div className="text-[10px]">{item.location}</div>

        <div className="flex gap-2.5">
          <button className="w-[120px] bg-[#308BF9] px-5 py-[15px] rounded-[10px] text-white text-[12px] font-semibold">
            Accept
          </button>
          <button className="w-[120px] bg-[#F5F7FA] border border-[#D9D9D9] rounded-[10px] px-5 py-[15px] text-[12px] font-semibold">
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
