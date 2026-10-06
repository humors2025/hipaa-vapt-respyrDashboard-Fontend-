"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Printer, Send, UserRound, Users } from "lucide-react";
import { RysfloQrPosterModal } from "@/components/earnings/RysfloQrPoster";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listQrService,
  generateQrBatchService,
  assignQrService,
  setupQrService,
  revokeQrService,
  listTrainerAdminsService,
} from "@/services/commissionService";
import { SalesPagination } from "@/components/super-admin/sales/PurchaseTable";

const PAGE_LIMIT = 20;

/**
 * QR Codes.
 *
 * Super admin: generate batches, print, hand N stickers to a trainer admin,
 * see who holds what.
 *
 * Trainer admin: "My stickers" — every sticker handed to them, in a table.
 * "Set up" on a row: Business (gym owner) or Personal trainer, name, owner
 * email, phone → the invite goes out and the sticker is live immediately.
 * "Revoke" while the invite is still pending cancels it and puts the sticker
 * back to "not set up" so it can be set up again.
 */

// Either "https://rysflo.com/buy/?q=" (website) or "https://admin.rysflo.com/q/" (fallback).
const STICKER_BASE = process.env.NEXT_PUBLIC_STICKER_BASE_URL || "https://rysflo.com/buy/?q=";
export const stickerUrl = (id) => (/[?=&]$/.test(STICKER_BASE) ? STICKER_BASE : STICKER_BASE.replace(/\/+$/, "") + "/") + id;

const field = "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";

/** A titled card: icon + title + subtitle header, divider, then the content. */
function Section({ icon: Icon, title, subtitle, action, children }) {
  return (
    <section className="bg-white rounded-[15px] border border-[#E1E6ED] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F5F7FA]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF4FE] text-[#308BF9]">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[#252525] text-[14px] font-bold leading-tight tracking-[-0.28px]">{title}</h2>
          <p className="text-[#535359] text-[12px] mt-0.5">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusPill({ q }) {
  if (q.status === "retired") return <span className="inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 bg-[#F5F7FA] text-[#535359]">retired</span>;
  if (q.status !== "assigned" || !q.partner_code) return <span className="inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 bg-[#FFF4E0] text-[#A66B00]">not set up</span>;
  if (q.target_status === "pending") return <span className="inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 bg-[#EEF4FE] text-[#308BF9]">live · invite pending</span>;
  return <span className="inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 bg-[#E5F6EE] text-[#1F7A4A]">live</span>;
}

/**
 * Clicking a sticker's QR opens the branded 5 x 7 poster for it, with a PDF
 * download. Once the sticker is set up the poster carries the partner's code
 * (what a member types at checkout); before that it shows the sticker ID.
 */
function PosterPreview({ sticker, onClose }) {
  const live = sticker.status === "assigned" && !!sticker.partner_code;
  const code = live ? sticker.partner_code : sticker.id;
  const codeLabel = !live ? "STICKER" : sticker.target_type === "trainer" ? "CODE" : "GYM CODE";

  return (
    <RysfloQrPosterModal
      value={stickerUrl(sticker.id)}
      code={code}
      codeLabel={codeLabel}
      filename={`Rysflo-QR-Poster-${sticker.id}-5x7.pdf`}
      onClose={onClose}
      note={`Sticker ${sticker.id} · ${sticker.target_label || "Not set up yet"}`}
    />
  );
}

function SetupForm({ sticker, onDone, onCancel }) {
  const [type, setType] = useState("facility");
  const [f, setF] = useState({ facilityName: "", firstName: "", lastName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const ok = f.firstName.trim() && f.lastName.trim() && /\S+@\S+\.\S+/.test(f.email) && (type === "trainer" || f.facilityName.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    try {
      const res = await setupQrService({ qrId: sticker.id, targetType: type, ...f });
      toast.success(`Sticker ${sticker.id} is live for ${res.qr.target_label} (${res.partner_code}). Invite sent to ${res.invited_email}.`);
      if (res.debug_invite_link) {
        // Local/UAT with RETURN_INVITE_LINK_FOR_TESTING: show the link since no email is sent.
        setResult(res);
      } else {
        onDone();
      }
    } catch (err) {
      toast.error(err?.message || "Could not set up sticker");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-[10px] border border-[#2EAF6A] bg-[#E5F6EE]/60 p-4 flex flex-col gap-2">
        <div className="text-[#1F7A4A] text-[13px] font-bold">Sticker {sticker.id} is live for {result.qr.target_label} · code {result.partner_code}</div>
        <div className="text-[#535359] text-[12px]">Test environment — the invite email is not sent. Open this link as the invitee to accept and create their login:</div>
        <div className="text-[#308BF9] text-[12px] break-all select-all bg-white rounded-[8px] px-3 py-2 border border-[#E1E6ED]">{result.debug_invite_link}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(result.debug_invite_link); toast.success("Invite link copied"); }} className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">Copy invite link</button>
          <button type="button" onClick={onDone} className="text-[12px] text-[#535359] cursor-pointer">Done</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[10px] border border-[#308BF9] bg-[#EEF4FE]/40 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[#252525] text-[13px] font-bold">Set up sticker <span className="font-mono">{sticker.id}</span></div>
        <button type="button" onClick={onCancel} className="text-[11px] text-[#535359] cursor-pointer">Cancel</button>
      </div>
      <div className="flex gap-2">
        {[["facility", "Business (gym / studio)"], ["trainer", "Personal trainer"]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setType(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${type === k ? "bg-[#308BF9] text-white" : "bg-white text-[#535359] border border-[#E1E6ED]"}`}>
            {label}
          </button>
        ))}
      </div>
      {type === "facility" && (
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">Gym / studio name *</span><input className={field} value={f.facilityName} onChange={set("facilityName")} placeholder="Downtown CrossFit" autoComplete="off" /></label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">{type === "facility" ? "Owner first name *" : "First name *"}</span><input className={field} value={f.firstName} onChange={set("firstName")} autoComplete="off" /></label>
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">{type === "facility" ? "Owner last name *" : "Last name *"}</span><input className={field} value={f.lastName} onChange={set("lastName")} autoComplete="off" /></label>
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">Email *</span><input type="email" className={field} value={f.email} onChange={set("email")} autoComplete="off" /></label>
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">Phone</span><input type="tel" className={field} value={f.phone} onChange={set("phone")} placeholder="+1 555 123 4567" autoComplete="off" /></label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={!ok || busy} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer">{busy ? "Sending…" : "Send invite & activate sticker"}</button>
        <span className="text-[#A1A1A1] text-[11px]">The sticker works from the moment you save. Commission is held until they accept the invite.</span>
      </div>
    </form>
  );
}

export default function QrCodesPanel({ isSuperAdmin = false }) {
  const [data, setData] = useState({ items: [], allocation: [], counts: null, pagination: null });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [setupId, setSetupId] = useState(null);
  const [preview, setPreview] = useState(null);
  const closePreview = useCallback(() => setPreview(null), []);
  const [busy, setBusy] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [count, setCount] = useState(50);
  const [tas, setTas] = useState([]);
  const [assignTo, setAssignTo] = useState("");
  const [assignCount, setAssignCount] = useState(10);
  const selectedTa = tas.find((t) => t.user_id === assignTo) || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, t] = await Promise.all([
        listQrService({ page, limit: PAGE_LIMIT, filter }),
        isSuperAdmin ? listTrainerAdminsService() : Promise.resolve({ items: [] }),
      ]);
      setData({ items: q.items || [], allocation: q.allocation || [], counts: q.counts || null, pagination: q.pagination || null });
      setTas(t.items || []);
    } catch (err) {
      toast.error(err?.message || "Could not load QR codes");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await generateQrBatchService({ count });
      toast.success(`${res.ids.length} stickers generated (batch ${res.batch_id})`);
      window.open(`/super-admin/stickers/print?batch=${encodeURIComponent(res.batch_id)}`, "_blank");
      load();
    } catch (err) {
      toast.error(err?.message || "Could not generate");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (e) => {
    e.preventDefault();
    if (!assignTo || !assignCount) return;
    setBusy(true);
    try {
      const res = await assignQrService({ toUserId: assignTo, count: assignCount });
      toast.success(`${res.assigned} stickers handed to ${assignTo}`);
      load();
    } catch (err) {
      toast.error(err?.message || "Could not assign");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (q) => {
    const who = q.target_label || q.partner_code;
    if (!window.confirm(`Revoke the invite to ${q.invited_email || who}? Sticker ${q.id} goes back to "not set up" and the code ${q.partner_code} stops working.`)) return;
    setRevokingId(q.id);
    try {
      await revokeQrService({ qrId: q.id });
      toast.success(`Invite revoked — sticker ${q.id} is ready to set up again`);
      if (setupId === q.id) setSetupId(null);
      load();
    } catch (err) {
      toast.error(err?.message || "Could not revoke");
    } finally {
      setRevokingId(null);
    }
  };

  // Rows arrive pre-filtered and paginated, with the pill counts computed
  // server-side over the whole set. The predicates remain only as a fallback
  // for a backend that predates qr-list pagination (no pagination in the
  // response → legacy full list).
  const FILTERS = {
    all: (q) => q.status !== "retired",
    unset: (q) => q.status !== "assigned" || !q.partner_code,
    live: (q) => q.status === "assigned" && !!q.partner_code,
  };
  const serverPaged = Boolean(data.pagination);
  const items = serverPaged ? data.items : data.items.filter(FILTERS[filter] || (() => true));
  const counts = data.counts || Object.fromEntries(Object.entries(FILTERS).map(([k, fn]) => [k, data.items.filter(fn).length]));
  const { unset, live } = counts;
  const totalPages = Math.max(1, data.pagination?.total_pages || 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">QR codes</h1>
          <p className="text-[#535359] text-[13px] mt-1">
            {isSuperAdmin
              ? "Generate sticker batches, print them, and hand stickers to trainer admins. Each sticker is set up in the field."
              : "Your stickers. Set one up when you put it on a wall: choose Business or Personal trainer, enter the details, and it's live — the invite goes out automatically."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Trainer admins print the posters they carry into the field. Super
              admins reach the same sheet through Generate & print. */}
          {!isSuperAdmin && (
            <a href="/trainer-admin/stickers/print" target="_blank" rel="noreferrer" className="rounded-full bg-[#308BF9] text-white text-[11px] font-semibold px-3 py-1.5 cursor-pointer">
              Print posters
            </a>
          )}
          <button type="button" onClick={load} disabled={loading} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer">{loading ? "Loading…" : "Refresh"}</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white"><div className="text-[12px] opacity-80">{isSuperAdmin ? "Stickers" : "My stickers"}</div><div className="text-[28px] font-bold">{counts.all}</div></div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED]"><div className="text-[#535359] text-[12px]">Live</div><div className="text-[#252525] text-[28px] font-bold">{live}</div><div className="text-[#A1A1A1] text-[11px]">Pointing at a gym or trainer</div></div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED]"><div className="text-[#535359] text-[12px]">Not set up</div><div className="text-[#252525] text-[28px] font-bold">{unset}</div><div className="text-[#A1A1A1] text-[11px]">Ready to put on a wall</div></div>
      </div>

      {isSuperAdmin && (
        <div className="flex flex-col gap-4">
          <Section
            icon={Printer}
            title="Generate & print"
            subtitle="Create a new batch of stickers and open the print sheet for them."
          >
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1 w-28">
                <span className="text-[#535359] text-[11px] font-semibold">How many</span>
                <input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className={field} />
              </label>
              <button type="button" onClick={generate} disabled={busy} className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2.5 hover:bg-[#2578DB] disabled:opacity-50 transition-colors cursor-pointer">
                {busy ? "Working…" : "Generate & open print sheet"}
              </button>
              <span className="text-[#A1A1A1] text-[11px] mb-1.5">
                Stickers encode <span className="font-mono">{stickerUrl("<ID>")}</span>
              </span>
            </div>
          </Section>

          <Section
            icon={Send}
            title="Hand stickers to a trainer admin"
            subtitle="Move unassigned stickers from the pool into a trainer admin's hands — they set them up in the field."
          >
            <form onSubmit={assign} className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1 w-full md:w-auto">
                <span className="text-[#535359] text-[11px] font-semibold">Trainer admin</span>
              <Select value={assignTo || undefined} onValueChange={setAssignTo}>
                <SelectTrigger className={`${field} w-auto min-w-[380px] max-w-[520px] h-auto py-2.5 shadow-none data-[placeholder]:text-[#A1A1A1] [&_svg]:text-[#A1A1A1] focus-visible:ring-0 focus-visible:border-[#308BF9] data-[state=open]:border-[#308BF9]`}>
                  <SelectValue placeholder="Choose trainer admin…">
                    {selectedTa && (
                      <span className="flex items-center gap-2 min-w-0">
                        <UserRound className="size-4 shrink-0" />
                        <span className="truncate">{selectedTa.name || selectedTa.user_id}</span>
                        {selectedTa.name && <span className="text-[#A1A1A1] text-[12px] truncate">· {selectedTa.user_id}</span>}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent side="bottom" align="start" sideOffset={6} avoidCollisions={false} className="rounded-[12px] border-[#E1E6ED] bg-white shadow-[0_8px_24px_rgba(37,37,37,0.10)] max-h-[320px] min-w-[var(--radix-select-trigger-width)] w-max max-w-[560px] [&_[data-radix-select-viewport]]:pr-2 [&_[data-slot=select-scroll-up-button]]:text-[#A1A1A1] [&_[data-slot=select-scroll-down-button]]:text-[#A1A1A1]">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A1A1A1]">Trainer admins</div>
                  {tas.length === 0 && <div className="px-3 py-3 text-[12px] text-[#A1A1A1]">No trainer admins yet</div>}
                  {tas.map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id} className="rounded-[8px] ml-1 mr-2 my-0.5 py-2.5 pl-3 pr-12 gap-3 text-[13px] text-[#252525] cursor-pointer focus:bg-[#EEF4FE] focus:text-[#252525] data-[state=checked]:bg-[#EEF4FE]">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F5F7FA] text-[#535359]">
                        <UserRound className="size-4" />
                      </span>
                      <span className="flex flex-col min-w-0 gap-0.5">
                        <span className="font-semibold leading-[18px] truncate">{t.name || t.user_id}</span>
                        {t.name && <span className="text-[11px] leading-[14px] text-[#A1A1A1] truncate">{t.user_id}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </label>
              <label className="flex flex-col gap-1 w-28">
                <span className="text-[#535359] text-[11px] font-semibold">How many</span>
                <input type="number" min={1} max={1000} value={assignCount} onChange={(e) => setAssignCount(Number(e.target.value) || 1)} className={field} />
              </label>
              <button type="submit" disabled={busy || !assignTo} className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2.5 hover:bg-[#2578DB] disabled:opacity-50 transition-colors cursor-pointer">
                {busy ? "Assigning…" : "Assign"}
              </button>
            </form>
          </Section>

          <Section
            icon={Users}
            title="Who holds what"
            subtitle="Stickers held by each trainer admin, and how many are live."
            action={
              data.allocation.length > 0 ? (
                <span className="inline-flex min-w-[22px] justify-center rounded-full bg-[#F5F7FA] border border-[#E1E6ED] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#252525]">
                  {data.allocation.length}
                </span>
              ) : null
            }
          >
            {data.allocation.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-5 text-[#A1A1A1] text-[12px] text-center">
                No stickers generated yet — holders appear here once a batch exists.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                      <th className="py-2.5 px-4 font-semibold">Trainer admin</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Total</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Live</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Not set up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.allocation.map((a) => (
                      <tr key={a.ta || "pool"} className="border-t border-[#F5F7FA]">
                        <td className="py-2.5 px-4">
                          <div className="text-[#252525] font-semibold">{a.ta_name || a.ta || "Unassigned pool"}</div>
                          {a.ta_name && a.ta && <div className="text-[#A1A1A1] text-[11px]">{a.ta}</div>}
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#252525] font-semibold tabular-nums">{a.total}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums"><span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#E5F6EE] text-[#1F7A4A]">{a.linked}</span></td>
                        <td className="py-2.5 px-4 text-right tabular-nums"><span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#FFF4E0] text-[#A66B00]">{a.unassigned}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[["all", "All"], ["unset", "Not set up"], ["live", "Live"]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setFilter(k); setPage(1); }} className={`inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1 text-[11px] font-semibold cursor-pointer ${filter === k ? "bg-[#308BF9] text-white" : "bg-[#F5F7FA] text-[#535359]"}`}>
            {label}
            <span className={`inline-flex min-w-[20px] justify-center rounded-full px-1.5 py-px text-[10px] tabular-nums ${filter === k ? "bg-white/25 text-white" : "bg-white text-[#252525] border border-[#E1E6ED]"}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading && data.items.length === 0 ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">{isSuperAdmin ? "No stickers yet — generate a batch." : "No stickers assigned to you yet."}</div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">QR</th>
                <th className="py-2.5 px-4 font-semibold">Sticker ID</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Points at</th>
                {isSuperAdmin && <th className="py-2.5 px-4 font-semibold">Held by</th>}
                <th className="py-2.5 px-4 font-semibold text-right">Scans</th>
                <th className="py-2.5 px-4 font-semibold text-right">Sign-ups</th>
                <th className="py-2.5 px-4 font-semibold text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => {
                const isSet = q.status === "assigned" && !!q.partner_code;
                const canRevoke = isSet && q.target_status === "pending" && (!isSuperAdmin || q.assigned_to_user_id);
                return [
                  <tr key={q.id} className="border-t border-[#F5F7FA]">
                    <td className="py-2 px-4"><button type="button" onClick={() => setPreview(q)} className="cursor-pointer" title="Preview"><QRCodeCanvas value={stickerUrl(q.id)} size={36} /></button></td>
                    <td className="py-2.5 px-4 font-mono text-[#252525] font-semibold">{q.id}</td>
                    <td className="py-2.5 px-4"><StatusPill q={q} /></td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {isSet ? (
                        <div>
                          <div className="text-[#252525] font-semibold">{q.target_label || q.facility_name || q.partner_code}</div>
                          <div className="text-[#A1A1A1] text-[11px]">{q.target_type === "trainer" ? "Personal trainer" : "Business"} · <span className="font-mono">{q.partner_code}</span>{q.invited_email ? ` · ${q.invited_email}` : ""}</div>
                        </div>
                      ) : <span className="text-[#A1A1A1]">—</span>}
                    </td>
                    {isSuperAdmin && <td className="py-2.5 px-4 text-[#535359]">{q.assigned_to_user_id || <span className="text-[#A1A1A1]">pool</span>}</td>}
                    <td className="py-2.5 px-4 text-right text-[#252525]">{q.scans}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525]">{q.signups}</td>
                    <td className="py-2.5 px-4 text-right">
                      {!isSet && (!isSuperAdmin || q.assigned_to_user_id) && (
                        <button type="button" onClick={() => setSetupId(setupId === q.id ? null : q.id)} className="rounded-full bg-[#308BF9] text-white text-[11px] font-semibold px-3 py-1 cursor-pointer">Set up</button>
                      )}
                      {canRevoke && (
                        <button type="button" onClick={() => revoke(q)} disabled={revokingId === q.id} className="rounded-full bg-[#FDECEC] text-[#E5484D] text-[11px] font-semibold px-3 py-1 disabled:opacity-50 cursor-pointer">{revokingId === q.id ? "Revoking…" : "Revoke"}</button>
                      )}
                    </td>
                  </tr>,
                  setupId === q.id && (
                    <tr key={`${q.id}-setup`} className="border-t border-[#F5F7FA]">
                      <td colSpan={isSuperAdmin ? 8 : 7} className="p-3"><SetupForm sticker={q} onDone={() => { setSetupId(null); load(); }} onCancel={() => setSetupId(null)} /></td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {serverPaged && (
        <SalesPagination
          page={page}
          limit={PAGE_LIMIT}
          total={data.pagination?.total || 0}
          totalPages={totalPages}
          disabled={loading}
          noun="stickers"
          onPageChange={(p) => p >= 1 && p <= totalPages && p !== page && setPage(p)}
        />
      )}

      {preview && <PosterPreview sticker={preview} onClose={closePreview} />}
    </div>
  );
}
