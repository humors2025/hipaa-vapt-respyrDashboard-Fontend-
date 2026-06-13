"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { suspendUser, reinstateUser } from "@/lib/demo-state";
import { getCurrentUser } from "@/lib/user";

// Reusable modal for suspend/reinstate. `mode` is "suspend" or "reinstate".
// On confirm, writes to local demo-state (suspensions + audit log) and calls
// onConfirm so the parent can refresh.
export default function SuspensionDialog({ open, mode, target, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open || !target) return null;

  const isSuspend = mode === "suspend";
  const title = isSuspend ? "Suspend user" : "Reinstate user";
  const cta = isSuspend ? "Suspend" : "Reinstate";
  const ctaColor = isSuspend ? "bg-[#E5484D]" : "bg-[#2EAF6A]";

  const submit = async () => {
    if (reason.trim().length < 4) {
      toast.error("Please add a reason (min 4 characters).");
      return;
    }
    setSubmitting(true);
    const actor = getCurrentUser();
    const args = {
      userId: target.id,
      actorUserId: actor?.user_id || "unknown",
      actorName: actor ? `${actor.first_name} ${actor.last_name}` : "Unknown",
      reason: reason.trim(),
      targetName: `${target.first_name} ${target.last_name}`,
    };
    try {
      if (isSuspend) suspendUser(args);
      else reinstateUser(args);
      toast.success(`${target.first_name} ${target.last_name} ${isSuspend ? "suspended" : "reinstated"}.`);
      onConfirm?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[12px] shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[#252525] text-[18px] font-bold">{title}</h2>
        <p className="text-[#535359] text-[13px] mt-2">
          {isSuspend ? (
            <>
              Suspending <span className="font-semibold">{target.first_name} {target.last_name}</span>{" "}
              blocks login and pauses commission flow up the chain.
              Their data is retained — no deletion.
            </>
          ) : (
            <>
              Reinstating <span className="font-semibold">{target.first_name} {target.last_name}</span>{" "}
              restores login. Future commissions resume; commissions accrued during suspension are unaffected.
            </>
          )}
        </p>

        <div className="mt-5 flex flex-col gap-1.5">
          <label className="text-[#535359] text-[12px] font-semibold">Reason (required)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
            placeholder={isSuspend ? "Why is this user being suspended?" : "Why is this user being reinstated?"}
          />
          <span className="text-[#A1A1A1] text-[11px]">
            Logged to audit trail with your name and timestamp.
          </span>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[10px] bg-[#F5F7FA] text-[#535359] text-[13px] font-semibold px-4 py-2.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={`rounded-[10px] ${ctaColor} text-white text-[13px] font-semibold px-4 py-2.5 disabled:opacity-60`}
          >
            {submitting ? "Working…" : cta}
          </button>
        </div>
      </div>
    </div>
  );
}
