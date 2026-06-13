"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { setRoleOverride } from "@/lib/demo-state";
import { getCurrentUser } from "@/lib/user";

const ALL_ROLES = [
  { id: "super_admin",   label: "Super Admin" },
  { id: "trainer_admin", label: "Trainer Admin" },
  { id: "trainer",       label: "Trainer" },
  { id: "client",        label: "Client" },
];

export default function EditRoleDialog({ open, target, currentRole, onClose, onConfirm }) {
  const [newRole, setNewRole] = useState(currentRole || "trainer");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNewRole(currentRole || "trainer");
      setReason("");
    }
  }, [open, currentRole]);

  if (!open || !target) return null;

  const submit = async () => {
    if (newRole === currentRole) {
      toast.error("New role must be different from the current role.");
      return;
    }
    if (reason.trim().length < 4) {
      toast.error("Please add a reason (min 4 characters).");
      return;
    }
    setSubmitting(true);
    const actor = getCurrentUser();
    setRoleOverride({
      userId: target.id,
      fromRole: currentRole,
      toRole: newRole,
      actorUserId: actor?.user_id || "unknown",
      actorName: actor ? `${actor.first_name} ${actor.last_name}` : "Unknown",
      reason: reason.trim(),
      targetName: `${target.first_name} ${target.last_name}`,
    });
    toast.success(`${target.first_name}'s role changed to ${newRole}.`);
    setSubmitting(false);
    onConfirm?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#252525] text-[18px] font-bold">Change role</h2>
        <p className="text-[#535359] text-[13px] mt-2">
          Change <span className="font-semibold">{target.first_name} {target.last_name}</span>'s
          role from <span className="font-mono">{currentRole}</span> to a different one. Their existing
          commissions and chain remain attached to the original recipient. Existing downstream relationships
          (their trainers / clients) stay intact.
        </p>

        <div className="mt-5 flex flex-col gap-1.5">
          <label className="text-[#535359] text-[12px] font-semibold">New role</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
          >
            {ALL_ROLES.map((r) => (
              <option key={r.id} value={r.id} disabled={r.id === currentRole}>
                {r.label}{r.id === currentRole ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-[#535359] text-[12px] font-semibold">Reason (required)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
            placeholder="Why is this role change happening?"
          />
          <span className="text-[#A1A1A1] text-[11px]">Logged to audit trail with your name and timestamp.</span>
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
            className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2.5 disabled:opacity-60"
          >
            {submitting ? "Working…" : "Change role"}
          </button>
        </div>
      </div>
    </div>
  );
}
