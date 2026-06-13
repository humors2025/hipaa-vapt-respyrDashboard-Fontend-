"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TRAINERS } from "@/lib/demo-data";
import { setAttributionOverride } from "@/lib/demo-state";
import { getCurrentUser } from "@/lib/user";

export default function ReattributeDialog({ open, client, currentTrainer, onClose, onConfirm }) {
  const [q, setQ] = useState("");
  const [pickedTrainerId, setPickedTrainerId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setQ("");
      setPickedTrainerId("");
      setReason("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TRAINERS.filter((t) => {
      if (t.id === currentTrainer?.id) return false;
      if (!needle) return true;
      return (
        `${t.first_name} ${t.last_name}`.toLowerCase().includes(needle) ||
        t.email.toLowerCase().includes(needle) ||
        (t.partner_code || "").toLowerCase().includes(needle)
      );
    });
  }, [q, currentTrainer]);

  if (!open || !client) return null;

  const submit = async () => {
    if (!pickedTrainerId) {
      toast.error("Pick a trainer to attribute this subscription to.");
      return;
    }
    if (reason.trim().length < 4) {
      toast.error("Please add a reason (min 4 characters).");
      return;
    }
    setSubmitting(true);
    const actor = getCurrentUser();
    const newTrainer = TRAINERS.find((t) => t.id === pickedTrainerId);
    setAttributionOverride({
      clientId: client.id,
      fromTrainerId: currentTrainer?.id || null,
      toTrainerId: pickedTrainerId,
      actorUserId: actor?.user_id || "unknown",
      actorName: actor ? `${actor.first_name} ${actor.last_name}` : "Unknown",
      reason: reason.trim(),
      clientName: `${client.first_name} ${client.last_name}`,
      fromTrainerName: currentTrainer ? `${currentTrainer.first_name} ${currentTrainer.last_name}` : null,
      toTrainerName: newTrainer ? `${newTrainer.first_name} ${newTrainer.last_name}` : null,
    });
    toast.success(`Attribution moved to ${newTrainer.first_name} ${newTrainer.last_name}.`);
    setSubmitting(false);
    onConfirm?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#252525] text-[18px] font-bold">Reassign attribution</h2>
        <p className="text-[#535359] text-[13px] mt-2">
          Reassign <span className="font-semibold">{client.first_name} {client.last_name}</span>'s
          subscription to a different trainer. Future commissions go to the new trainer; already-paid
          commissions stay with the original recipient (audit log records the discrepancy for finance reconciliation).
        </p>

        <div className="mt-4 rounded-[10px] bg-[#FFF4E0] text-[#A66B00] p-3 text-[12px]">
          Currently attributed to{" "}
          <span className="font-semibold">
            {currentTrainer ? `${currentTrainer.first_name} ${currentTrainer.last_name}` : "no trainer (unattributed)"}
          </span>.
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <label className="text-[#535359] text-[12px] font-semibold">Find new trainer</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or partner code"
            className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
          />
        </div>

        <div className="mt-2 max-h-[200px] overflow-y-auto rounded-[10px] border border-[#E1E6ED]">
          {filtered.length === 0 ? (
            <div className="p-4 text-[#A1A1A1] text-[12px] text-center">No trainers match.</div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPickedTrainerId(t.id)}
                className={[
                  "w-full text-left px-3 py-2.5 border-b border-[#F5F7FA] last:border-0 hover:bg-[#F5F7FA]",
                  pickedTrainerId === t.id ? "bg-[#EEF4FE]" : "",
                ].join(" ")}
              >
                <div className="text-[#252525] text-[13px] font-semibold">{t.first_name} {t.last_name}</div>
                <div className="text-[#A1A1A1] text-[11px]">{t.email} · {t.partner_code}</div>
              </button>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-[#535359] text-[12px] font-semibold">Reason (required)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
            placeholder="Why is this attribution being changed?"
          />
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
            disabled={submitting || !pickedTrainerId}
            className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2.5 disabled:opacity-60"
          >
            {submitting ? "Working…" : "Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}
