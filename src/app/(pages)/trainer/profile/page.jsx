// "use client"
// import { ClientProfile } from "@/components/client-profile";
// import { ResultEvaluation } from "@/components/result-evaluation";
// import { Suspense } from "react";
// import ProtectedRoute from "@/components/ProtectedRoute";

// export default function Profile() {
//     const showNoPlans = true;


//     return (
//         <>
// <ProtectedRoute>
//   <Suspense fallback={<div>Loading client profile...</div>}>
//             <div className="flex gap-5">
//                 <div className="">
                    
//                 <ClientProfile
//                     //showPlanDetails={!showNoPlans} 
//                     />
                    
//                 </div>
//                 {/* {showNoPlans && <div className="flex-1"><NoPlans /></div>}  */}
//                 <ResultEvaluation />
//             </div>
//             </Suspense>
//             </ProtectedRoute>
//         </>
//     )
// };



















"use client"
import { ClientProfile } from "@/components/client-profile";
import { ResultEvaluation } from "@/components/result-evaluation";
import { Suspense, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useSearchParams } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { selectClients, selectClientsStatus, getClientsForDietician } from "@/store/clientSlice";
import NotFound from "@/app/not-found";
import Cookies from "js-cookie";

function ProfileContent() {
    const searchParams = useSearchParams();
    const dispatch = useDispatch();
    const clients = useSelector(selectClients);
    const clientsStatus = useSelector(selectClientsStatus);
    const profileId = searchParams?.get('profile_id');
    const [isValidating, setIsValidating] = useState(true);
    const [isValidProfile, setIsValidProfile] = useState(false);
    const showNoPlans = true;

    // Fetch clients if not already loaded
    useEffect(() => {
        if (clientsStatus === 'idle' || (clientsStatus === 'succeeded' && clients.length === 0)) {
            const dieticianCookie = Cookies.get("dietician");
            if (dieticianCookie) {
                try {
                    const dieticianData = JSON.parse(decodeURIComponent(dieticianCookie));
                    const dieticianId = dieticianData?.dietician_id;
                    if (dieticianId) {
                        dispatch(getClientsForDietician({ dieticianId }));
                    }
                } catch (e) {
                    console.error("Failed to parse dietician cookie:", e);
                }
            }
        }
    }, [clientsStatus, clients.length, dispatch]);

    useEffect(() => {
        // Wait for clients to be loaded before validating
        if (clientsStatus === 'loading' || (clientsStatus === 'idle' && clients.length === 0)) {
            setIsValidating(true);
            return;
        }

        // If clients failed to load or are empty after loading, consider it invalid if profileId is provided
        if (clientsStatus === 'succeeded' && clients.length === 0) {
            if (profileId) {
                setIsValidProfile(false);
                setIsValidating(false);
                return;
            }
        }

        // Validate profile_id against the list of valid clients
        if (profileId) {
            const isValid = clients.some(client => 
                client.profile_id === profileId || client.profileId === profileId
            );
            setIsValidProfile(isValid);
        } else {
            // If no profile_id is provided, it's invalid
            setIsValidProfile(false);
        }
        
        setIsValidating(false);
    }, [profileId, clients, clientsStatus]);

    // Show loading while validating
    if (isValidating) {
        return <div>Loading client profile...</div>;
    }

    // If profile is invalid, show not-found page
    if (!isValidProfile) {
        return <NotFound />;
    }

    return (
        <div className="flex gap-5">
            <div className="">
                <ClientProfile
                    //showPlanDetails={!showNoPlans} 
                />
            </div>
            {/* {showNoPlans && <div className="flex-1"><NoPlans /></div>}  */}
            <ResultEvaluation />
        </div>
    );
}

export default function Profile() {
    return (
        <>
            <ProtectedRoute>
                <Suspense fallback={<div>Loading client profile...</div>}>
                    <ProfileContent />
                </Suspense>
            </ProtectedRoute>
        </>
    )
};