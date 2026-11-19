"use client";

// FedEx tracking cell for Orders › Shipping. A super admin (canEdit) types the
// tracking number once the device ships; the backend looks it up at FedEx and
// stores the latest status (shipment-tracking.js). Everyone who can see the
// tab sees the status, the expected / actual delivery date and the scan
// history, plus a link to FedEx's own tracking page.

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Pencil, Trash2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { formatDate } from "@/components/super-admin/sales/salesFormat";
import { saveTrackingNumberService, removeTrackingNumberService } from "@/services/superAdminOrdersService";

// FedEx latestStatusDetail.code → label and colours.
const STATUS = {
  DL: { label: "Delivered", cls: "bg-[#E7F8EE] text-[#1F9D55]" },
  OD: { label: "Out for delivery", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  IT: { label: "In transit", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  AR: { label: "In transit", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  DP: { label: "In transit", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  AF: { label: "In transit", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  PU: { label: "Picked up", cls: "bg-[#EEF4FE] text-[#308BF9]" },
  OC: { label: "Label created", cls: "bg-[#F5F7FA] text-[#535359]" },
  IN: { label: "Label created", cls: "bg-[#F5F7FA] text-[#535359]" },
  DE: { label: "Delivery exception", cls: "bg-[#FDECEC] text-[#D93025]" },
  DY: { label: "Delayed", cls: "bg-[#FFF4E0] text-[#A66B00]" },
  CA: { label: "Cancelled", cls: "bg-[#FDECEC] text-[#D93025]" },
  RS: { label: "Returning to sender", cls: "bg-[#FFF4E0] text-[#A66B00]" },
  HL: { label: "Ready for pickup", cls: "bg-[#FFF4E0] text-[#A66B00]" },
};

function errorMessage(err, fallback) {
  return err?.response?.data?.message || err?.data?.message || err?.message || fallback;
}

function TrackingBadge({ t }) {
  const known = STATUS[t.status_code];
  const label = known?.label || t.status_text || (t.error ? "Not found yet" : "Checking…");
  const cls = known?.cls || (t.error ? "bg-[#FFF4E0] text-[#A66B00]" : "bg-[#F5F7FA] text-[#535359]");
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${cls}`}
      title={t.status_text || t.error || undefined}
    >
      {label}
    </span>
  );
}

function TrackingForm({ initial = "", busy, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="FedEx tracking number"
        aria-label="FedEx tracking number"
        inputMode="text"
        maxLength={40}
        className="w-[170px] rounded-[8px] border border-[#E1E6ED] bg-white px-2 py-1 text-[12px] font-mono text-[#252525] placeholder:text-[#A1A1A1] placeholder:font-sans focus:outline-none focus:border-[#308BF9]"
      />
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="rounded-[8px] bg-[#308BF9] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50 cursor-pointer"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-[8px] bg-[#F5F7FA] px-2.5 py-1 text-[11px] font-semibold text-[#535359] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function TrackingCell({ row, canEdit = false, onChange }) {
  const t = row.tracking;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const save = async (raw) => {
    const number = String(raw || "").replace(/\s+/g, "");
    if (!number) return;
    setBusy(true);
    try {
      const res = await saveTrackingNumberService(row.stripe_subscription_id, number);
      if (res?.status === false) throw new Error(res?.message || "Could not save the tracking number");
      onChange?.(row.stripe_subscription_id, res.tracking || null);
      setEditing(false);
      if (res.lookup_error || res.tracking?.error) {
        toast.warning(`Saved. FedEx: ${res.lookup_error || res.tracking.error}`);
      } else {
        toast.success("Tracking number saved");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not save the tracking number"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove tracking number ${t.tracking_number}?`)) return;
    setBusy(true);
    try {
      const res = await removeTrackingNumberService(row.stripe_subscription_id);
      if (res?.status === false) throw new Error(res?.message || "Could not remove the tracking number");
      onChange?.(row.stripe_subscription_id, null);
      toast.success("Tracking number removed");
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove the tracking number"));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return <TrackingForm initial={t?.tracking_number || ""} busy={busy} onSave={save} onCancel={() => setEditing(false)} />;
  }

  if (!t) {
    if (!canEdit) return <span className="text-[#A1A1A1]">Not shipped</span>;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-[8px] border border-dashed border-[#C9D3E0] px-2 py-1 text-[11px] font-semibold text-[#308BF9] hover:bg-[#EEF4FE] cursor-pointer whitespace-nowrap"
      >
        <Plus className="size-3" aria-hidden="true" /> Add tracking
      </button>
    );
  }

  const events = Array.isArray(t.events) ? t.events : [];
  return (
    <div className="flex flex-col gap-1 min-w-[190px]">
      <div className="flex items-center gap-1.5 flex-wrap">
        <TrackingBadge t={t} />
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              title="Change tracking number"
              aria-label="Change tracking number"
              className="text-[#A1A1A1] hover:text-[#308BF9] cursor-pointer"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              title="Remove tracking number"
              aria-label="Remove tracking number"
              className="text-[#A1A1A1] hover:text-[#D93025] cursor-pointer"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <a
        href={t.tracking_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-[11px] text-[#308BF9] hover:underline w-fit"
        title="Open on fedex.com"
      >
        {t.tracking_number}
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>

      {t.delivered_at ? (
        <div className="text-[11px] text-[#1F9D55]">Delivered {formatDate(t.delivered_at, true)}</div>
      ) : t.estimated_delivery ? (
        <div className="text-[11px] text-[#535359]">Expected {formatDate(t.estimated_delivery)}</div>
      ) : null}

      {t.last_event && !t.delivered_at && (
        <div className="text-[11px] text-[#A1A1A1] break-words">
          {[t.last_event.text, t.last_event.location].filter(Boolean).join(" · ")}
        </div>
      )}

      {t.error && (
        // "TRACKING.TRACKINGNUMBER.NOTFOUND: Tracking number cannot be found." → the message part.
        <div className="text-[11px] text-[#A66B00] break-words" title={t.error}>
          {t.error.replace(/^[A-Z0-9_.]+:\s*/, "")}
          {!t.status_code && " FedEx can take a few hours to list a new label."}
        </div>
      )}

      {events.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#535359] hover:text-[#308BF9] w-fit cursor-pointer"
        >
          {open ? <ChevronUp className="size-3" aria-hidden="true" /> : <ChevronDown className="size-3" aria-hidden="true" />}
          {open ? "Hide history" : `History (${events.length})`}
        </button>
      )}
      {open && (
        <ol className="mt-1 flex flex-col gap-1.5 border-l border-[#E1E6ED] pl-2.5 max-h-[220px] overflow-y-auto">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="text-[11px]">
              <div className="text-[#252525]">{e.text || "—"}</div>
              <div className="text-[#A1A1A1]">{[formatDate(e.at, true), e.location].filter(Boolean).join(" · ")}</div>
            </li>
          ))}
        </ol>
      )}

      {t.checked_at && <div className="text-[10px] text-[#C0C0C0]">Checked {formatDate(t.checked_at, true)}</div>}
    </div>
  );
}
