"use client";

import Image from "next/image";

export default function PDFLoadingModal({ isOpen }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-[15px] p-8 flex flex-col items-center gap-4 min-w-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-[#252525] text-[16px] font-semibold">
          Generating PDF...
        </p>
        <p className="text-[#738298] text-[12px] text-center">
          Please wait while we prepare your download
        </p>
      </div>
    </div>
  );
}