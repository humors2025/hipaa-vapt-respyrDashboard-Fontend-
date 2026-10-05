"use client";

import { useEffect, useState } from "react";
import { X, Pencil } from "lucide-react";
import { formatMinor, facilityEditLogsService } from "@/services/commissionService";

/**
 * Super admin › Facilities › click a facility: shows that facility's full row
 * from the list-facilities response in a popup, plus the facility's edit
 * history (who changed the name / owner name and when). Escape / overlay / ×
 * close it.
 */

// facility_edit_logs field → label shown in the history list.
const EDIT_FIELD = { name: "Facility name", owner_name: "Owner name" };

const PAYOUT = {
  verified: { text: "Stripe verified", cls: "bg-[#E5F6EE] text-[#1F7A4A]" },
  pending: { text: "Stripe pending", cls: "bg-[#FFF4E0] text-[#A66B00]" },
  action_required: { text: "Stripe: action needed", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  disabled: { text: "Payouts disabled", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  not_started: { text: "No payout setup", cls: "bg-[#F5F7FA] text-[#535359]" },
};

const STATUS = {
  active: "bg-[#E5F6EE] text-[#1F7A4A]",
  suspended: "bg-[#FFF4E0] text-[#A66B00]",
  inactive: "bg-[#F5F7FA] text-[#535359]",
  removed: "bg-[#FCEAEB] text-[#B5363A]",
};

const label = (s) => (s ? String(s).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");

function Row({ name, children }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-t border-[#F5F7FA] first:border-t-0 text-[13px]">
      <span className="text-[#A1A1A1] shrink-0">{name}</span>
      <span className="text-[#252525] text-right break-all">{children ?? "—"}</span>
    </div>
  );
}

export default function FacilityDetailsDialog({ facility, onClose, onShowPeople, onEdit, suspendEscape = false }) {
  const open = !!facility;
  // Edit history, loaded when the popup opens (and again after an edit —
  // edits_count changes, which re-triggers the effect).
  const [edits, setEdits] = useState(null); // null = loading, [] = none

  useEffect(() => {
    // Escape is left to the Trainers / Active members list while it is open.
    if (!open || suspendEscape) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, suspendEscape]);

  const facilityId = facility?.id;
  const editsCount = facility?.edits_count || 0;
  useEffect(() => {
    if (!facilityId || !editsCount) {
      setEdits([]);
      return undefined;
    }
    let cancelled = false;
    setEdits(null);
    facilityEditLogsService({ facilityId })
      .then((res) => !cancelled && setEdits(res.edits || []))
      .catch(() => !cancelled && setEdits([]));
    return () => {
      cancelled = true;
    };
  }, [facilityId, editsCount]);

  if (!open) return null;

  const f = facility;
  const payout = PAYOUT[f.payout_status] || PAYOUT.not_started;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${f.name} details`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[15px] shadow-[0_16px_48px_rgba(37,37,37,0.18)] w-full max-w-[520px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3.5 right-3.5 rounded-full p-1.5 text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#535359] cursor-pointer">
          <X className="size-4" />
        </button>

        <div className="pr-8">
          <h2 className="text-[#252525] text-[18px] font-bold leading-tight">{f.name}</h2>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${STATUS[f.status] || STATUS.inactive}`}>{label(f.status)}</span>
            <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${payout.cls}`}>{payout.text}</span>
            {(f.edits_count || 0) > 0 && (
              <span className="inline-flex rounded-full bg-[#FFF4E0] text-[#A66B00] text-[10px] font-semibold px-2 py-0.5" title={`Last edited by ${f.last_edited_by || "unknown"}${f.last_edited_at ? ` · ${f.last_edited_at}` : ""}`}>
                Edited
              </span>
            )}
            {onEdit && (
              <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-full bg-[#EEF4FE] text-[#308BF9] text-[10px] font-semibold px-2.5 py-0.5 cursor-pointer">
                <Pencil className="size-3" /> Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Trainers", f.trainers_count, "trainers"],
            ["Active members", f.active_subscriptions, "members"],
            ["Commission owed", formatMinor(f.owed_minor)],
            ["Commission paid", formatMinor(f.paid_minor)],
          ].map(([k, v, view]) =>
            view && onShowPeople ? (
              // Trainers / Active members open the list behind the number.
              <button
                key={k}
                type="button"
                onClick={() => onShowPeople(view)}
                className="rounded-[10px] border border-[#E1E6ED] p-3 text-left hover:border-[#308BF9] hover:bg-[#F5F9FF] cursor-pointer"
              >
                <div className="text-[11px] text-[#535359]">{k}</div>
                <div className="text-[18px] font-bold text-[#308BF9]">{v}</div>
                <div className="text-[10px] text-[#308BF9]">View list</div>
              </button>
            ) : (
              <div key={k} className="rounded-[10px] border border-[#E1E6ED] p-3">
                <div className="text-[11px] text-[#535359]">{k}</div>
                <div className="text-[18px] font-bold text-[#252525]">{v}</div>
              </div>
            )
          )}
        </div>

        <div className="rounded-[10px] border border-[#E1E6ED] px-4 py-1">
          <Row name="Facility ID">{f.id}</Row>
          <Row name="Facility name">{f.name}</Row>
          <Row name="Code"><span className="font-mono font-semibold">{f.partner_code}</span></Row>
          <Row name="Status">{label(f.status)}</Row>
          <Row name="Created">{f.created_at}</Row>
          {(f.edits_count || 0) > 0 && (
            <Row name="Last edited">
              {f.last_edited_at} {f.last_edited_by && <span className="text-[#A1A1A1]">by</span>} {f.last_edited_by}
            </Row>
          )}
          <Row name="Owner name">{f.owner_name}</Row>
          <Row name="Owner email">{f.owner_user_id}</Row>
          <Row name="Trainer admin">{f.parent_admin_user_id}</Row>
          <Row name="Payout status">{payout.text}</Row>
          <Row name="Trainers">{f.trainers_count}</Row>
          <Row name="Active members">{f.active_subscriptions}</Row>
          <Row name="Commission owed">{formatMinor(f.owed_minor)}</Row>
          <Row name="Commission paid">{formatMinor(f.paid_minor)}</Row>
        </div>

        {(f.edits_count || 0) > 0 && (
          <div>
            <h3 className="text-[#252525] text-[13px] font-bold mb-2">Edit history</h3>
            {edits === null ? (
              <div className="text-[#A1A1A1] text-[12px]">Loading&hellip;</div>
            ) : edits.length === 0 ? (
              <div className="text-[#A1A1A1] text-[12px]">No edits recorded.</div>
            ) : (
              <div className="rounded-[10px] border border-[#E1E6ED] px-4 py-1">
                {edits.map((e) => (
                  <div key={e.id} className="py-2.5 border-t border-[#F5F7FA] first:border-t-0 text-[12px]">
                    <div className="text-[#252525]">
                      <span className="font-semibold">{EDIT_FIELD[e.field] || e.field}</span>:{" "}
                      <span className="text-[#A1A1A1] line-through">{e.old_value || "—"}</span>{" "}
                      <span className="text-[#A1A1A1]">&rarr;</span> <span className="font-semibold">{e.new_value}</span>
                    </div>
                    <div className="text-[#A1A1A1] text-[11px] mt-0.5">
                      by {e.edited_by} ({String(e.edited_role || "").replace(/_/g, " ")}) · {e.edited_at}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
