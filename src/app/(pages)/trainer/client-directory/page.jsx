"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import ClientDirectory from "@/components/ClientDirectory";

export default function ClientDirectoryPage() {
  return (
    <ProtectedRoute>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            Client Directory
          </h1>
          <p className="text-[#535359] text-[13px]">
            Browse and search all clients across your network.
          </p>
        </div>

        <ClientDirectory />
      </div>
    </ProtectedRoute>
  );
}
