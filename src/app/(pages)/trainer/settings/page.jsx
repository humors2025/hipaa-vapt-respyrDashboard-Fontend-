"use client"

import ProfileSettings from "@/components/profile-settings"
import ProtectedRoute from "@/components/ProtectedRoute"
export default function Settings(){

    return(
        <>
          <ProtectedRoute>

           <ProfileSettings/>
           
           </ProtectedRoute>
        </>
    )
}