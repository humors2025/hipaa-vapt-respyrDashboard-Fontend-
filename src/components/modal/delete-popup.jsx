


"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { cookieManager } from "../../lib/cookies";
import { deleteDietPlanService } from "../../services/authService";
import { useSearchParams, useRouter } from "next/navigation";

export default function DeletePopUp({ open, onClose, dietPlanId }) {

  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const searchParams = useSearchParams();
  const clientId = searchParams?.get("profile_id"); // ✅ profile_id from URL

  // ESC key close
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleDeleteDietPlan = async () => {
    try {
      if (!dietPlanId) {
        toast.error("diet_plan_id not found");
        return;
      }

      if (!clientId) {
        toast.error("client_id (profile_id) not found in URL");
        return;
      }

      // ✅ dietitian_id from cookie
      const dieticianCookie = cookieManager.getJSON("dietician");

      const dietitianId =
        dieticianCookie?.dietitian_id ||
        dieticianCookie?.dietician_id ||
        dieticianCookie?.login_id ||
        dieticianCookie?.id ||
        cookieManager.get("dietitian_id") ||
        cookieManager.get("dietician_id") ||
        cookieManager.get("login_id");

      if (!dietitianId) {
        toast.error("dietitian_id not found in cookies");
        return;
      }

      setIsDeleting(true);

      const res = await deleteDietPlanService(dietPlanId, clientId, dietitianId);

      toast.success(res?.message || "Diet plan deleted successfully");
      onClose?.();
      router.push(`/profile?profile_id=${clientId}`);
    } catch (error) {
      toast.error(error?.message || "Failed to delete diet plan");
      console.error("Delete diet plan error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Popup + Close Button wrapper */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onClick={onClose}
      >
        <div className="flex items-start gap-5">
          {/* POPUP */}
          <div
            className="bg-white rounded-[15px] shadow-lg w-full max-w-[620px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-8 items-center justify-center px-[136px] pt-11 pb-7 rounded-[15px]">
              <Image
                src="/icons/hugeicons_delete-02.svg"
                alt="delete"
                width={94}
                height={94}
              />

              <div className="flex flex-col gap-[46px]">
                <div className="flex flex-col gap-[35px]">
                  <div className="flex flex-col gap-4">
                    <p className="text-[#DA5747] text-[15px] text-center">
                      Are you sure you want to delete this diet plan?
                    </p>
                    <p className="text-[#535359] text-[12px] text-center">
                      Once deleted, all meal schedules for this plan will be <br />
                      permanently deleted
                    </p>
                  </div>

                  <div className="flex flex-col gap-[29px] items-center">
                    <p className="text-[#252525] text-[20px]">Or</p>
                    <p className="text-[#252525] text-[15px]">
                      Edit the existing diet plan
                    </p>
                  </div>
                </div>

                <div className="flex gap-[37px] justify-center">
                  <button
                    className="w-[146px] bg-[#D9D9D9] hover:bg-[#c4c4c4] py-[15px] rounded-[10px] text-[12px] font-semibold"
                    onClick={onClose}
                    disabled={isDeleting}
                  >
                    Edit
                  </button>

                  <button
                    className="w-[146px] bg-[#DA5747] hover:bg-[#c94a3b] py-[15px] rounded-[10px] text-white text-[12px] font-semibold"
                    onClick={handleDeleteDietPlan}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CLOSE BUTTON (OUTSIDE POPUP) */}
          <button
            className="bg-white text-[#252525] px-3 py-1 rounded-md cursor-pointer"
            onClick={onClose}
            disabled={isDeleting}
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
}
