"use client";

import { use } from "react";
import Link from "next/link";

export default function ClientDetailPage({ params }) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/super-admin/clients"
        className="text-[#308BF9] text-[12px] font-semibold inline-flex items-center gap-1"
      >
        &larr; Back to Clients
      </Link>

      <div>
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
          Client Detail
        </h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Client ID: <span className="font-mono">{id}</span>
        </p>
      </div>

      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-8 text-center">
        <p className="text-[#A1A1A1] text-[13px]">
          Client detail view requires a dedicated API endpoint.
        </p>
        <p className="text-[#A1A1A1] text-[11px] mt-2">
          Needed: client profile, subscription tier/amount, attribution chain
          (trainer + trainer admin), commission breakdown.
        </p>
      </div>
    </div>
  );
}
