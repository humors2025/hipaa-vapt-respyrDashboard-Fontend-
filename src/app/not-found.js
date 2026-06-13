"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex items-center justify-center px-4">
      <div className="w-full max-w-[1200px]">
        <div className="mx-auto max-w-[620px] rounded-[24px] border border-[#E5E7EB] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] px-6 py-12 sm:px-10 sm:py-14 text-center">
          <div className="mx-auto mb-6 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#EEF4FF]">
            <span className="text-[32px] font-bold text-[#2874F0]">404</span>
          </div>

          <h1 className="text-[32px] sm:text-[42px] font-extrabold leading-[110%] tracking-[-0.03em] text-[#111827]">
            Page not found
          </h1>

          <p className="mt-4 text-[16px] sm:text-[18px] font-medium leading-[160%] text-[#4B5563]">
            Sorry, the page you are looking for does not exist.
          </p>

        
         
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/trainer/dashboard"
              className="inline-flex min-w-[220px] items-center justify-center rounded-[12px] bg-[#2874F0] px-6 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[#1D68D8]"
            >
              Go to Dashboard
            </Link>

          
          </div>

        
        </div>
      </div>
    </section>
  );
}