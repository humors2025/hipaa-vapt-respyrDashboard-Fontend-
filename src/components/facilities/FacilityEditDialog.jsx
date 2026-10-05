"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { updateFacilityService } from "@/services/commissionService";

/**
 * Facilities › Edit (pencil on a row, or "Edit" in the super-admin details
 * popup): change the facility's name and/or the owner's display name.
 * Available to super admin (any facility) and trainer admin (their own).
 */

const field = "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";

export default function FacilityEditDialog({ facility, onClose, onSaved }) {
  const open = !!facility;
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [busy, setBusy] = useState(false);

  // Re-seed the fields each time a facility is opened.
  useEffect(() => {
    if (!facility) return;
    setName(facility.name || "");
    setOwnerName(facility.owner_name || "");
  }, [facility]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const f = facility;
  const trimmedName = name.trim();
  const trimmedOwner = ownerName.trim();
  const nameChanged = trimmedName !== (f.name || "");
  const ownerChanged = trimmedOwner !== (f.owner_name || "");
  // Owner name may start empty (owner not signed up yet) — then it stays blank
  // and read-only-ish; the facility name is always required.
  const canSave = trimmedName !== "" && (nameChanged || (ownerChanged && trimmedOwner !== "")) && !busy;

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      await updateFacilityService({
        facilityId: f.id,
        ...(nameChanged && { name: trimmedName }),
        ...(ownerChanged && trimmedOwner !== "" && { ownerName: trimmedOwner }),
      });
      toast.success(`${trimmedName} updated`);
      onSaved?.({ ...f, name: trimmedName, ...(ownerChanged && trimmedOwner !== "" && { owner_name: trimmedOwner }) });
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not update the facility");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Edit ${f.name}`}>
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose?.()} />
      <form onSubmit={save} className="relative bg-white rounded-[15px] shadow-[0_16px_48px_rgba(37,37,37,0.18)] w-full max-w-[440px] p-6 flex flex-col gap-4">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="absolute top-3.5 right-3.5 rounded-full p-1.5 text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#535359] cursor-pointer disabled:opacity-50">
          <X className="size-4" />
        </button>

        <div className="pr-8">
          <h2 className="text-[#252525] text-[16px] font-bold leading-tight">Edit facility</h2>
          <p className="text-[#535359] text-[12px] mt-1">
            Code <span className="font-mono font-semibold">{f.partner_code}</span> · owner {f.owner_user_id}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[#535359] text-[12px] font-semibold">Facility name *</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} autoComplete="off" autoFocus />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[#535359] text-[12px] font-semibold">Owner name</span>
          <input
            className={field}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            maxLength={150}
            autoComplete="off"
            disabled={!f.owner_name && !ownerName}
            placeholder={f.owner_name ? "" : "Owner has not signed up yet"}
          />
          <span className="text-[#A1A1A1] text-[11px]">
            {f.owner_name
              ? "This renames the owner's profile everywhere they appear."
              : "The owner's name can be edited once they accept the invite."}
          </span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={!canSave} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-50 cursor-pointer">
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-[10px] bg-white border border-[#E1E6ED] text-[#535359] text-[13px] font-semibold px-5 py-2.5 disabled:opacity-50 cursor-pointer">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
