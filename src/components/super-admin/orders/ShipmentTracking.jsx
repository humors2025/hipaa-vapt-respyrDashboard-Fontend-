"use client";

// FedEx tracking for Orders › Shipping. The table cell stays small (status
// badge + expected / delivered date + "Details"); everything else lives in a
// popup: the tracking number with a link to fedex.com, the latest scan, the
// scan history, and (super admin only, canEdit) add / change / remove.
// The backend looks the number up at FedEx and stores the latest status
// (shipment-tracking.js).

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ExternalLink, Pencil, Trash2, Plus, Truck, X } from "lucide-react";
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

// "TRACKING.TRACKINGNUMBER.NOTFOUND: Tracking number cannot be found." → the message part.
const plainError = (e) => String(e || "").replace(/^[A-Z0-9_.]+:\s*/, "");

function TrackingBadge({ t, large = false }) {
  const known = STATUS[t.status_code];
  const label = known?.label || t.status_text || (t.error ? "Not found yet" : "Checking…");
  const cls = known?.cls || (t.error ? "bg-[#FFF4E0] text-[#A66B00]" : "bg-[#F5F7FA] text-[#535359]");
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full font-semibold ${
        large ? "text-[13px] px-3 py-1" : "text-[11px] px-2.5 py-0.5"
      } ${cls}`}
      title={t.status_text || t.error || undefined}
    >
      {label}
    </span>
  );
}

function deliveryLine(t) {
  if (t.delivered_at) return { text: `Delivered ${formatDate(t.delivered_at, true)}`, cls: "text-[#1F9D55]" };
  if (t.estimated_delivery) return { text: `Expected ${formatDate(t.estimated_delivery)}`, cls: "text-[#535359]" };
  return null;
}

function TrackingForm({ initial = "", busy, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[#535359]">FedEx tracking number</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 7946 1234 5678"
          inputMode="text"
          maxLength={40}
          className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[14px] font-mono text-[#252525] placeholder:text-[#A1A1A1] placeholder:font-sans focus:outline-none focus:border-[#308BF9]"
        />
        <span className="text-[11px] text-[#A1A1A1]">
          Printed under the barcode on the FedEx label. Spaces are removed.
        </span>
      </label>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-[10px] bg-[#F5F7FA] px-4 py-2 text-[13px] font-semibold text-[#535359] hover:bg-[#ECEFF3] cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="rounded-[10px] bg-[#308BF9] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1F7AE8] disabled:opacity-50 cursor-pointer"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function TrackingDetails({ t }) {
  const events = Array.isArray(t.events) ? t.events : [];
  const delivery = deliveryLine(t);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[12px] bg-[#F5F7FA] p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TrackingBadge t={t} large />
          <a
            href={t.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#308BF9] hover:underline"
          >
            Track on fedex.com
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1A1]">Tracking number</div>
          <div className="font-mono text-[15px] text-[#252525] break-all">{t.tracking_number}</div>
        </div>
        {delivery && <div className={`text-[13px] font-semibold ${delivery.cls}`}>{delivery.text}</div>}
        {t.last_event && !t.delivered_at && (
          <div className="text-[12px] text-[#535359]">
            <span className="text-[#A1A1A1]">Latest: </span>
            {[t.last_event.text, t.last_event.location].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {t.error && (
        <div className="rounded-[10px] border border-[#F5DDAA] bg-[#FFF8EB] px-3 py-2.5 text-[12px] text-[#A66B00]" title={t.error}>
          {plainError(t.error)}
          {!t.status_code && " FedEx can take a few hours to list a new label — try Refresh tracking later."}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-bold text-[#252525]">
          Scan history {events.length > 0 && <span className="font-normal text-[#A1A1A1]">({events.length})</span>}
        </div>
        {events.length === 0 ? (
          <div className="text-[12px] text-[#A1A1A1]">No scans yet.</div>
        ) : (
          <ol className="flex flex-col max-h-[260px] overflow-y-auto pr-1">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-3 last:pb-0">
                {i < events.length - 1 && (
                  <span className="absolute left-[4px] top-3 bottom-0 w-px bg-[#E1E6ED]" aria-hidden="true" />
                )}
                <span
                  className={`relative mt-1 size-[9px] shrink-0 rounded-full ${i === 0 ? "bg-[#308BF9]" : "bg-[#C9D3E0]"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 text-[12px]">
                  <div className={i === 0 ? "font-semibold text-[#252525]" : "text-[#252525]"}>{e.text || "—"}</div>
                  <div className="text-[#A1A1A1]">{[formatDate(e.at, true), e.location].filter(Boolean).join(" · ")}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function TrackingCell({ row, canEdit = false, onChange }) {
  const t = row.tracking;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const openPopup = (edit) => {
    setEditing(edit);
    setOpen(true);
  };

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
        toast.warning(`Saved. FedEx: ${plainError(res.lookup_error || res.tracking.error)}`);
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
      setOpen(false);
      toast.success("Tracking number removed");
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove the tracking number"));
    } finally {
      setBusy(false);
    }
  };

  // ── table cell ──────────────────────────────────────────────
  let cell;
  if (!t) {
    cell = canEdit ? (
      <button
        type="button"
        onClick={() => openPopup(true)}
        className="inline-flex items-center gap-1 rounded-[8px] border border-dashed border-[#C9D3E0] px-2 py-1 text-[11px] font-semibold text-[#308BF9] hover:bg-[#EEF4FE] cursor-pointer whitespace-nowrap"
      >
        <Plus className="size-3" aria-hidden="true" /> Add tracking
      </button>
    ) : (
      <span className="text-[#A1A1A1]">Not shipped</span>
    );
  } else {
    const delivery = deliveryLine(t);
    cell = (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <TrackingBadge t={t} />
          {delivery && <span className={`text-[11px] whitespace-nowrap ${delivery.cls}`}>{delivery.text}</span>}
        </div>
        <button
          type="button"
          onClick={() => openPopup(false)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#308BF9] hover:underline cursor-pointer whitespace-nowrap"
        >
          <Truck className="size-3" aria-hidden="true" /> View details
        </button>
      </div>
    );
  }

  // ── popup ───────────────────────────────────────────────────
  const customer = row.customer || {};
  return (
    <>
      {cell}
      <Dialog.Root
        open={open}
        onOpenChange={(v) => {
          if (busy) return;
          setOpen(v);
          if (!v) setEditing(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[480px] max-h-[calc(100vh-48px)] overflow-y-auto bg-white rounded-[15px] shadow-xl p-5 flex flex-col gap-4 focus:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="text-[#252525] text-[16px] font-bold">
                  {!t ? "Add FedEx tracking" : editing ? "Change tracking number" : "FedEx tracking"}
                </Dialog.Title>
                <div className="mt-0.5 text-[12px] text-[#A1A1A1] truncate">
                  {[customer.name, customer.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <Dialog.Close
                aria-label="Close"
                disabled={busy}
                className="shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#252525] transition-colors cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {editing || !t ? (
              <TrackingForm
                initial={t?.tracking_number || ""}
                busy={busy}
                onSave={save}
                onCancel={t ? () => setEditing(false) : () => setOpen(false)}
              />
            ) : (
              <>
                <TrackingDetails t={t} />
                <div className="flex items-center justify-between gap-3 border-t border-[#EEF1F5] pt-3">
                  <div className="text-[11px] text-[#A1A1A1]">
                    {t.checked_at ? `Checked ${formatDate(t.checked_at, true)}` : "Not checked yet"}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#F5F7FA] px-3 py-1.5 text-[12px] font-semibold text-[#535359] hover:bg-[#ECEFF3] cursor-pointer"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" /> Change
                      </button>
                      <button
                        type="button"
                        onClick={remove}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#FDECEC] px-3 py-1.5 text-[12px] font-semibold text-[#D93025] hover:bg-[#FAD9D9] cursor-pointer"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
