"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listFacilitiesService, inviteFacilityAdminService, formatMinor } from "@/services/commissionService";

/**
 * Facilities (gyms / studios) — shared by trainer admin (their own) and super
 * admin (all). Invite an owner as facility_admin; see every facility's
 * trainers, subscriptions, commission and payout-setup state.
 */

const PAYOUT = {
  verified: { text: "Stripe verified", cls: "bg-[#E5F6EE] text-[#1F7A4A]" },
  pending: { text: "Stripe pending", cls: "bg-[#FFF4E0] text-[#A66B00]" },
  action_required: { text: "Stripe: action needed", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  disabled: { text: "Payouts disabled", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  not_started: { text: "No payout setup", cls: "bg-[#F5F7FA] text-[#535359]" },
};

const EMPTY = { firstName: "", lastName: "", email: "", phone: "", facilityName: "" };

function Card({ label, value, hint, accent }) {
  return (
    <div className={`rounded-[10px] p-5 flex flex-col gap-1 ${accent ? "bg-[#308BF9] text-white" : "bg-white border border-[#E1E6ED]"}`}>
      <div className={`text-[12px] ${accent ? "opacity-80" : "text-[#535359]"}`}>{label}</div>
      <div className={`text-[28px] font-bold ${accent ? "" : "text-[#252525]"}`}>{value}</div>
      <div className={`text-[11px] ${accent ? "opacity-80" : "text-[#A1A1A1]"}`}>{hint}</div>
    </div>
  );
}

export default function FacilitiesPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSubmit = form.firstName.trim() && form.lastName.trim() && /\S+@\S+\.\S+/.test(form.email) && form.facilityName.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const res = await inviteFacilityAdminService({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        facilityName: form.facilityName.trim(),
      });
      toast.success(`Invite sent to ${res.data.invited_email} for ${res.data.facility_name} (code ${res.data.partner_code})`);
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err?.message || "Could not send invite");
    } finally {
      setBusy(false);
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
            {showForm ? "Close" : "+ Invite facility owner"}
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
          <h2 className="text-[#252525] text-[14px] font-bold">Invite a facility owner</h2>
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[12px] font-semibold">Facility name *</span>
            <input className={field} value={form.facilityName} onChange={set("facilityName")} placeholder="Iron Works Gym" autoComplete="off" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">Owner first name *</span>
              <input className={field} value={form.firstName} onChange={set("firstName")} autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">Owner last name *</span>
              <input className={field} value={form.lastName} onChange={set("lastName")} autoComplete="off" />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#535359] text-[12px] font-semibold">Owner email *</span>
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
            <span className="text-[#A1A1A1] text-[11px]">The owner gets an email + link. The facility and its QR code are created when they accept.</span>
          </div>
        </form>
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
                  <th className="py-2.5 px-4 font-semibold">Expires</th>
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
                    <td className="py-2.5 px-4 text-[#A1A1A1]">{p.expires_at || "—"}</td>
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
