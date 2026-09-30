"use client";

import { useEffect } from "react";
import { TriangleAlert, X } from "lucide-react";

/**
 * In-app "Are you sure?" popup — replaces window.confirm so the prompt matches
 * the dashboard instead of the browser. Escape / overlay / × cancel; the
 * confirm button is disabled while `busy`.
 */
export default function ConfirmDialog({ open, title, children, confirmText = "Confirm", busyText = "Working…", busy = false, danger = false, onConfirm, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white rounded-[15px] shadow-[0_16px_48px_rgba(37,37,37,0.18)] w-full max-w-[440px] p-6 flex flex-col gap-5">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="absolute top-3.5 right-3.5 rounded-full p-1.5 text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#535359] disabled:opacity-50 cursor-pointer">
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className={`shrink-0 rounded-full p-2.5 ${danger ? "bg-[#FDECEC] text-[#E5484D]" : "bg-[#EEF4FE] text-[#308BF9]"}`}>
            <TriangleAlert className="size-5" />
          </div>
          <div className="flex flex-col gap-1.5 pt-0.5 min-w-0">
            <h3 className="text-[#252525] text-[15px] font-bold leading-snug">{title}</h3>
            <div className="text-[#535359] text-[12px] leading-relaxed">{children}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-[10px] border border-[#E1E6ED] bg-white text-[#535359] text-[12px] font-semibold px-4 py-2 hover:bg-[#F5F7FA] disabled:opacity-50 cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-[10px] text-white text-[12px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer ${danger ? "bg-[#E5484D] hover:bg-[#D03F44]" : "bg-[#308BF9] hover:bg-[#2A7BE0]"}`}>
            {busy ? busyText : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
