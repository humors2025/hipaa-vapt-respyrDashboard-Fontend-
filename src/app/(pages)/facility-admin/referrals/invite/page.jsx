"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { inviteTrainerClientService } from "@/services/authService";

/**
 * Facility admin › Invite a trainer.
 *
 * Sends the standard trainer invite (email + link). The backend stamps the
 * facility on the invite so the trainer lands in this facility with their own
 * referral code. Their commission split starts at 0% and is set on the
 * Trainers page.
 */

const EMPTY = { firstName: "", lastName: "", email: "", phone: "" };

export default function FacilityAdminInvitePage() {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSubmit = form.firstName.trim() && form.lastName.trim() && /\S+@\S+\.\S+/.test(form.email);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const res = await inviteTrainerClientService({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      toast.success(`Invite sent to ${res.data.invited_email}`);
      setLast(res.data);
      setForm(EMPTY);
    } catch (err) {
      toast.error(err?.message || "Could not send invite");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Invite a trainer</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          They get an email with a link to create their login. Once they accept, they appear on your{" "}
          <Link href="/facility-admin/trainers" className="text-[#308BF9] font-semibold">Trainers</Link> page, where you set their commission split.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-[10px] border border-[#E1E6ED] p-6 flex flex-col gap-4 max-w-[640px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[12px] font-semibold">First name *</span>
            <input className={field} value={form.firstName} onChange={set("firstName")} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[12px] font-semibold">Last name *</span>
            <input className={field} value={form.lastName} onChange={set("lastName")} autoComplete="off" />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[#535359] text-[12px] font-semibold">Email *</span>
          <input type="email" className={field} value={form.email} onChange={set("email")} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#535359] text-[12px] font-semibold">Mobile (optional)</span>
          <input type="tel" className={field} value={form.phone} onChange={set("phone")} placeholder="+1 555 123 4567" autoComplete="off" />
        </label>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          <span className="text-[#A1A1A1] text-[11px]">The invite link expires in 24 hours.</span>
        </div>
      </form>

      {last && (
        <div className="rounded-[10px] bg-[#E5F6EE] px-4 py-3 text-[12px] text-[#1F7A4A] max-w-[640px]">
          Invite sent to <strong>{last.invited_name}</strong> ({last.invited_email}). Their referral code will be{" "}
          <span className="font-mono font-semibold">{last.partner_code}</span>.
          {/* Only present when the API runs with RETURN_INVITE_LINK_FOR_TESTING (never in production). */}
          {last.debug_invite_link && (
            <div className="mt-2 flex flex-col gap-2">
              <span className="text-[#535359]">Test environment — invite link (emails are not sent here):</span>
              <div className="text-[#308BF9] break-all select-all bg-white rounded-[8px] px-3 py-2 border border-[#E1E6ED]">{last.debug_invite_link}</div>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(last.debug_invite_link); toast.success("Invite link copied"); }} className="self-start rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">Copy invite link</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
