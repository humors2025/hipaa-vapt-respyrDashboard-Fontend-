"use client"
import { ClientProfile } from "@/components/client-profile";
import HistoryPlan from "@/components/history-plan";
import { Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function PlanHistory() {
    return (
        <>
         <ProtectedRoute>
   <Suspense fallback={<div>Loading client profile...</div>}>
            <div className="flex gap-5 ">
              
                <ClientProfile 
                showOverview={false} 
                showPlanDetails={true} 
                showPlanSelection={false} 
                showPlanHistoryMargin={false} />
                
                <HistoryPlan />
            </div>
            </Suspense>
            </ProtectedRoute>
        </>
    )
};