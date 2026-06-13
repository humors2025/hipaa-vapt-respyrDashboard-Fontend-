"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function MealLoggedPopup({ open, onClose }) {
    const fromRef = useRef(null);
    const toRef = useRef(null);

    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Convert YYYY-MM-DD (from input[type=date]) -> DD/MM/YYYY (for display)
    const formatDDMMYYYY = (yyyy_mm_dd) => {
        if (!yyyy_mm_dd) return "";
        const [y, m, d] = yyyy_mm_dd.split("-");
        if (!y || !m || !d) return "";
        return `${d}/${m}/${y}`;
    };

    // close on ESC
    useEffect(() => {
        if (!open) return;
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Popup */}
            <div className="relative z-10 w-[520px] max-w-[92vw] bg-white rounded-[15px] p-6 shadow-lg">
                <div className="flex justify-between items-center">
                    <p className="text-[#252525] text-[16px] font-semibold">
                        Popup Title
                    </p>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[#252525] text-[14px] font-semibold"
                    >
                        ✕
                    </button>
                </div>

                <div className="mt-4">
                    <div className="flex-1">
                        <span className="px-[9px] text-[#252525] text-[12px] leading-normal font-semibold tracking-[-0.24px]">
                            Duration
                        </span>

                        <div className="flex gap-2 mt-2">
                            {/* From */}
                            <div
                                onClick={() => fromRef.current?.showPicker()}
                                className="cursor-pointer flex py-[15px] pl-[19px] pr-[13px] rounded-[8px] bg-white border border-[#E1E6ED]"
                            >
                                <input
                                    type="text"
                                    value={formatDDMMYYYY(fromDate)}
                                    placeholder="DD/MM/YYYY"
                                    disabled
                                    className="w-full outline-none bg-transparent text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] placeholder:text-[#9CA3AF] cursor-pointer"
                                />
                                <Image
                                    src="/icons/hugeicons_calendar-03.svg"
                                    alt="calendar"
                                    width={20}
                                    height={20}
                                />
                            </div>

                            {/* Hidden native date input */}
                            <input
                                ref={fromRef}
                                type="date"
                                className="absolute opacity-0 pointer-events-none"
                                onChange={(e) => setFromDate(e.target.value)}
                            />

                            {/* To */}
                            <div
                                onClick={() => toRef.current?.showPicker()}
                                className="cursor-pointer flex py-[15px] pl-[19px] pr-[13px] rounded-[8px] bg-white border border-[#E1E6ED]"
                            >
                                <input
                                    type="text"
                                    value={formatDDMMYYYY(toDate)}
                                    placeholder="DD/MM/YYYY"
                                    disabled
                                    className="w-full outline-none bg-transparent text-[#252525] text-[14px] font-normal leading-normal tracking-[-0.2px] placeholder:text-[#9CA3AF] cursor-pointer"
                                />
                                <Image
                                    src="/icons/hugeicons_calendar-03.svg"
                                    alt="calendar"
                                    width={20}
                                    height={20}
                                />
                            </div>

                            {/* Hidden native date input */}
                            <input
                                ref={toRef}
                                type="date"
                                className="absolute opacity-0 pointer-events-none"
                                onChange={(e) => setToDate(e.target.value)}
                            />

                        </div>
                    </div>
                </div>


                <div>
                    
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-[10px] bg-[#E1E6ED] text-[#252525] text-[12px] font-semibold"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
