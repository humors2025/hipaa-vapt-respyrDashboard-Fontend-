"use client";
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
  const profileId = searchParams?.get("profile_id");
  const [isValidating, setIsValidating] = useState(true);
  const [isValidProfile, setIsValidProfile] = useState(false);

  useEffect(() => {
    if (clientsStatus === "idle" || (clientsStatus === "succeeded" && clients.length === 0)) {
      const dieticianCookie = Cookies.get("dietician");
      if (dieticianCookie) {
        try {
          const dieticianData = JSON.parse(decodeURIComponent(dieticianCookie));
          const dieticianId = dieticianData?.dietician_id;
          if (dieticianId) dispatch(getClientsForDietician({ dieticianId }));
        } catch (e) {
          console.error("Failed to parse dietician cookie:", e);
        }
      }
    }
  }, [clientsStatus, clients.length, dispatch]);

  useEffect(() => {
    if (clientsStatus === "loading" || (clientsStatus === "idle" && clients.length === 0)) {
      setIsValidating(true);
      return;
    }

    if (clientsStatus === "succeeded" && clients.length === 0) {
      if (profileId) {
        setIsValidProfile(false);
        setIsValidating(false);
        return;
      }
    }

    if (profileId) {
      const isValid = clients.some(
        (client) => client.profile_id === profileId || client.profileId === profileId
      );
      setIsValidProfile(isValid);
    } else {
      setIsValidProfile(false);
    }

    setIsValidating(false);
  }, [profileId, clients, clientsStatus]);

  if (isValidating) return <div>Loading client profile...</div>;
  if (!isValidProfile) return <NotFound />;

  return (
    <div className="flex gap-5">
      <div className="">
        <ClientProfile />
      </div>
      <ResultEvaluation />
    </div>
  );
}

export default function ClientProfilePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div>Loading client profile...</div>}>
        <ProfileContent />
      </Suspense>
    </ProtectedRoute>
  );
}
