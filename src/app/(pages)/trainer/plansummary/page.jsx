"use client"

import Preview from "@/components/preview";
import { ClientProfile } from "@/components/client-profile";
import { Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function PlanSummary(){
    return(
        <>
                 <ProtectedRoute>
<div className="flex flex-col gap-2.5 ">
      <Suspense fallback={<div>Loading client profile...</div>}>
         <ClientProfile /> 
         </Suspense>
        <Preview/>
        </div>
        </ProtectedRoute>
        </>
    )
};