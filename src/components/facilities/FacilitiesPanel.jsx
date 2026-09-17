"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listFacilitiesService, inviteFacilityAdminService, listQrService, setupQrService, revokeInviteService, formatMinor } from "@/services/commissionService";
import { inviteTrainerClientService, superAdminInviteTrainerService } from "@/services/authService";

/**
 * Facilities (gyms / studios) — shared by trainer admin (their own) and super
 * admin (all). Invite an owner as facility_admin or a personal trainer —
 * optionally binding one of the caller's not-yet-set-up QR stickers in the
 * same step (same flow as "Set up" on the QR codes page); see every
 * facility's trainers, subscriptions, commission and payout-setup state.
 */

const PAYOUT = {
  verified: { text: "Stripe verified", cls: "bg-[#E5F6EE] text-[#1F7A4A]" },
  pending: { text: "Stripe pending", cls: "bg-[#FFF4E0] text-[#A66B00]" },
  action_required: { text: "Stripe: action needed", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  disabled: { text: "Payouts disabled", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  not_started: { text: "No payout setup", cls: "bg-[#F5F7FA] text-[#535359]" },
};

const EMPTY = { type: "facility", qrId: "", firstName: "", lastName: "", email: "", phone: "", facilityName: "" };
// Radix Select can't hold "" as an item value — sentinel for "invite only".
const NO_STICKER = "__none__";

function Card({ label, value, hint, accent }) {
  return (
    <div className={`rounded-[10px] p-5 flex flex-col gap-1 ${accent ? "bg-[#308BF9] text-white" : "bg-white border border-[#E1E6ED]"}`}>
      <div className={`text-[12px] ${accent ? "opacity-80" : "text-[#535359]"}`}>{label}</div>
      <div className={`text-[28px] font-bold ${accent ? "" : "text-[#252525]"}`}>{value}</div>
      <div className={`text-[11px] ${accent ? "opacity-80" : "text-[#A1A1A1]"}`}>{hint}</div>
    </div>
  );
}

export default function FacilitiesPanel({ isSuperAdmin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [revokingId, setRevokingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listFacilitiesService());
    } catch (err) {
      toast.error(err?.message || "Failed to load facilities");
    } finally {
      setLoading(false);
    }
  }, []);

  // Stickers the caller holds that are not set up yet — offered in the form.
  const loadStickers = useCallback(async () => {
    try {
      const q = await listQrService({});
      setStickers((q.items || []).filter((x) => x.status !== "retired" && !(x.status === "assigned" && x.partner_code) && (!isSuperAdmin || x.assigned_to_user_id)));
    } catch {
      setStickers([]);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    load();
    loadStickers();
  }, [load, loadStickers]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isFacility = form.type === "facility";
  const canSubmit = form.firstName.trim() && form.lastName.trim() && /\S+@\S+\.\S+/.test(form.email) && (!isFacility || form.facilityName.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      facilityName: isFacility ? form.facilityName.trim() : "",
    };
    try {
      let out;
      if (form.qrId) {
        // Invite + bind the sticker in one go (same as "Set up" on the QR codes page).
        const res = await setupQrService({ qrId: form.qrId, targetType: form.type, ...payload });
        out = { invited_email: res.invited_email, label: res.qr?.target_label, partner_code: res.partner_code, sticker_id: form.qrId, debug_invite_link: res.debug_invite_link };
      } else if (isFacility) {
        const res = await inviteFacilityAdminService(payload);
        out = { invited_email: res.data.invited_email, label: res.data.facility_name, partner_code: res.data.partner_code, debug_invite_link: res.debug_invite_link || res.data.debug_invite_link };
      } else {
        const res = await (isSuperAdmin ? superAdminInviteTrainerService : inviteTrainerClientService)(payload);
        out = { invited_email: res.data.invited_email, label: res.data.invited_name, partner_code: res.data.partner_code, debug_invite_link: res.debug_invite_link || res.data.debug_invite_link };
      }
      toast.success(`Invite sent to ${out.invited_email} for ${out.label} (code ${out.partner_code})${out.sticker_id ? ` · sticker ${out.sticker_id} is live` : ""}`);
      setLastInvite(out);
      setForm(EMPTY);
      setShowForm(false);
      load();
      if (form.qrId) loadStickers();
    } catch (err) {
      toast.error(err?.message || "Could not send invite");
    } finally {
      setBusy(false);
    }
  };

  // Pending owner invite → revoked; a sticker bound at invite time goes back to "not set up".
  const revokeInvite = async (p) => {
    const who = p.invited_name || p.invited_email;
    const stickerNote = p.qr_id ? ` Sticker ${p.qr_id} goes back to "not set up".` : "";
    if (!window.confirm(`Revoke the invite to ${who} for ${p.facility_name}? The code ${p.partner_code} stops working.${stickerNote}`)) return;
    setRevokingId(p.id);
    try {
      await revokeInviteService({ inviteId: p.id });
      toast.success(`Invite to ${who} revoked${p.qr_id ? ` — sticker ${p.qr_id} is ready to set up again` : ""}`);
      if (lastInvite?.partner_code && lastInvite.partner_code === p.partner_code) setLastInvite(null);
      load();
      if (p.qr_id) loadStickers();
    } catch (err) {
      toast.error(err?.message || "Could not revoke invite");
    } finally {
      setRevokingId(null);
    }
  };

  const field = "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";
  const t = data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">Facilities</h1>
          <p className="text-[#535359] text-[13px] mt-1">
            Gyms and studios in the referral programme. Invite the owner; they add their own trainers and set their splits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowForm((v) => !v)} className="rounded-full bg-[#308BF9] text-white text-[11px] font-semibold px-4 py-1.5 cursor-pointer">
            {showForm ? "Close" : "+ Invite owner / trainer"}
          </button>
          <button type="button" onClick={load} disabled={loading} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card label="Facilities" value={t.facilities} hint={`${t.pending_invites} invite${t.pending_invites === 1 ? "" : "s"} pending`} accent />
          <Card label="Trainers" value={t.trainers} hint="Across all facilities" />
          <Card label="Active members" value={t.active_subscriptions} hint="Referred subscriptions" />
          <Card label="Commission owed" value={formatMinor(t.owed_minor)} hint="Pending + on hold" />
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-[15px] p-6 flex flex-col gap-4 max-w-[720px] border border-[#E1E6ED]">
          <h2 className="text-[#252525] text-[14px] font-bold">Invite a facility owner or personal trainer</h2>
          <div className="flex gap-2">
            {[["facility", "Business (gym / studio)"], ["trainer", "Personal trainer"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, type: k }))} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${form.type === k ? "bg-[#308BF9] text-white" : "bg-white text-[#535359] border border-[#E1E6ED]"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isFacility && (
              <label className="flex flex-col gap-1">
                <span className="text-[#535359] text-[12px] font-semibold">Facility name *</span>
                <input className={field} value={form.facilityName} onChange={set("facilityName")} placeholder="Iron Works Gym" autoComplete="off" />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">QR sticker (optional)</span>
              <Select value={form.qrId || NO_STICKER} onValueChange={(v) => setForm((f) => ({ ...f, qrId: v === NO_STICKER ? "" : v }))}>
                <SelectTrigger className={`${field} h-auto shadow-none data-[placeholder]:text-[#252525] [&_svg]:text-[#A1A1A1] focus-visible:ring-0 focus-visible:border-[#308BF9] data-[state=open]:border-[#308BF9]`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="bottom" align="start" sideOffset={6} avoidCollisions={false} className="rounded-[10px] border-[#E1E6ED] bg-white shadow-[0_8px_24px_rgba(37,37,37,0.10)] max-h-[280px]">
                  <SelectItem value={NO_STICKER} className="rounded-[8px] py-2 text-[13px] text-[#535359] cursor-pointer focus:bg-[#EEF4FE] focus:text-[#308BF9]">
                    No sticker yet — invite only
                  </SelectItem>
                  {stickers.map((q) => (
                    <SelectItem key={q.id} value={q.id} className="rounded-[8px] py-2 text-[13px] text-[#252525] cursor-pointer focus:bg-[#EEF4FE] focus:text-[#308BF9]">
                      <QrCode className="size-4 text-[#A1A1A1]" />
                      <span className="font-mono font-semibold">{q.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[#A1A1A1] text-[11px]">{stickers.length ? "Stickers you hold that are not set up. The one you pick goes live for this invite." : "No stickers waiting to be set up."}</span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">{isFacility ? "Owner first name *" : "First name *"}</span>
              <input className={field} value={form.firstName} onChange={set("firstName")} autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">{isFacility ? "Owner last name *" : "Last name *"}</span>
              <input className={field} value={form.lastName} onChange={set("lastName")} autoComplete="off" />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">{isFacility ? "Owner email *" : "Email *"}</span>
              <input type="email" className={field} value={form.email} onChange={set("email")} autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">Mobile (optional)</span>
              <input type="tel" className={field} value={form.phone} onChange={set("phone")} autoComplete="off" />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!canSubmit || busy} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-50 cursor-pointer">
              {busy ? "Sending…" : "Send invite"}
            </button>
            <span className="text-[#A1A1A1] text-[11px]">{form.qrId ? "The sticker works from the moment you save. Commission is held until they accept the invite." : "They get an email + link. Their code is created when they accept."}</span>
          </div>
        </form>
      )}

      {lastInvite && (
        <div className="rounded-[10px] bg-[#E5F6EE] px-4 py-3 text-[12px] text-[#1F7A4A] max-w-[720px]">
          Invite sent to <strong>{lastInvite.invited_email}</strong> for <strong>{lastInvite.label}</strong> (code{" "}
          <span className="font-mono font-semibold">{lastInvite.partner_code}</span>).
          {lastInvite.sticker_id && <> Sticker <span className="font-mono font-semibold">{lastInvite.sticker_id}</span> is live.</>}
          {/* Only present when the API runs with RETURN_INVITE_LINK_FOR_TESTING (never in production). */}
          {lastInvite.debug_invite_link && (
            <div className="mt-2 flex flex-col gap-2">
              <span className="text-[#535359]">Test environment — invite link (emails are not sent here):</span>
              <div className="text-[#308BF9] break-all select-all bg-white rounded-[8px] px-3 py-2 border border-[#E1E6ED]">{lastInvite.debug_invite_link}</div>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(lastInvite.debug_invite_link); toast.success("Invite link copied"); }} className="self-start rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">Copy invite link</button>
            </div>
          )}
        </div>
      )}

      {loading && !data ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : (data?.facilities?.length || 0) === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">No facilities yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">Facility</th>
                <th className="py-2.5 px-4 font-semibold">Owner</th>
                <th className="py-2.5 px-4 font-semibold">Code</th>
                <th className="py-2.5 px-4 font-semibold text-right">Trainers</th>
                <th className="py-2.5 px-4 font-semibold text-right">Members</th>
                <th className="py-2.5 px-4 font-semibold text-right">Owed</th>
                <th className="py-2.5 px-4 font-semibold text-right">Paid</th>
                <th className="py-2.5 px-4 font-semibold">Payouts</th>
              </tr>
            </thead>
            <tbody>
              {data.facilities.map((f) => {
                const p = PAYOUT[f.payout_status] || PAYOUT.not_started;
                return (
                  <tr key={f.id} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4 text-[#252525] font-semibold">{f.name}</td>
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525]">{f.owner_name || "—"}</div>
                      <div className="text-[#A1A1A1] text-[11px]">{f.owner_user_id}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">{f.partner_code}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525]">{f.trainers_count}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525]">{f.active_subscriptions}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(f.owed_minor)}</td>
                    <td className="py-2.5 px-4 text-right text-[#535359]">{formatMinor(f.paid_minor)}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${p.cls}`}>{p.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(data?.pending_invites?.length || 0) > 0 && (
        <div>
          <h2 className="text-[#252525] text-[14px] font-bold mb-2">Pending owner invites</h2>
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold">Owner</th>
                  <th className="py-2.5 px-4 font-semibold">Code</th>
                  <th className="py-2.5 px-4 font-semibold">Sticker</th>
                  <th className="py-2.5 px-4 font-semibold">Expires</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.pending_invites.map((p) => (
                  <tr key={p.id} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4 text-[#252525] font-semibold">{p.facility_name}</td>
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525]">{p.invited_name || "—"}</div>
                      <div className="text-[#A1A1A1] text-[11px]">{p.invited_email}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">{p.partner_code}</td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">{p.qr_id || <span className="text-[#A1A1A1] font-sans">—</span>}</td>
                    <td className="py-2.5 px-4 text-[#A1A1A1]">{p.expires_at || "—"}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button type="button" onClick={() => revokeInvite(p)} disabled={revokingId === p.id} className="rounded-full bg-[#FDECEC] text-[#E5484D] text-[11px] font-semibold px-3 py-1 disabled:opacity-50 cursor-pointer">
                        {revokingId === p.id ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
