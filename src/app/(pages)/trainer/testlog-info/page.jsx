import Preview from "@/components/preview";
import { ClientProfile } from "@/components/client-profile";
import { Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
export default function TestLog(){
    return(
        <>
          <ProtectedRoute>
        <div className="flex gap-2.5">
            <Suspense fallback={<div>Loading client profile...</div>}>
                  <ClientProfile />
                <Preview/>
                </Suspense>
                </div>
                </ProtectedRoute>
        </>
    )
};