"use client"
import { Suspense } from 'react'

import { ClientProfile } from "@/components/client-profile";
import CreateDietPlan from "@/components/create-diet-plan";
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DietPlan(){
    return(
        <>
        <ProtectedRoute>
   <div className="flex gap-2.5">
            <Suspense fallback={<div>Loading client profile...</div>}>
                    <ClientProfile />
                </Suspense>
     <CreateDietPlan/>
           </div>
           </ProtectedRoute>
        </>
    )
}
