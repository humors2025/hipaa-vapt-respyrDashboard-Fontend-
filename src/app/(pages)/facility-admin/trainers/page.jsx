"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  listMyTrainersService,
  setTrainerCommissionSplitService,
  removeTrainerService,
  fetchEarningsSummaryService,
  formatMinor,
} from "@/services/commissionService";
import { resendUserInviteService } from "@/services/authService";

/**
 * Facility admin › Trainers.
 *
 * The owner's control panel for the referral programme: every trainer in the
 * facility, the share of the facility's commission each one receives
 * (0–100 %, entirely the owner's call), and removal — which sends the
 * trainer's members and their future commission back to the facility.
 */

function SplitEditor({ trainer, onSaved }) {
  const [value, setValue] = useState(String(trainer.commission_split_pct ?? 0));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setValue(String(trainer.commission_split_pct ?? 0));
  }, [trainer.commission_split_pct]);

  const numeric = Number(value);
  const valid = value !== "" && Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 && Math.round(numeric * 100) === numeric * 100;
  const dirty = valid && numeric !== Number(trainer.commission_split_pct ?? 0);

  const save = async () => {
    if (!dirty) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await setTrainerCommissionSplitService({
        trainerUserId: trainer.user_id,
        splitPct: numeric,
      });
      toast.success(`${trainer.name || trainer.user_id} now receives ${res.data.split_pct}% of commission`);
      setEditing(false);
      onSaved(trainer.user_id, res.data.split_pct);
    } catch (err) {
      toast.error(err?.message || "Could not update split");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-2 rounded-full bg-[#EEF4FE] px-3 py-1 text-[12px] font-semibold text-[#308BF9] hover:bg-[#308BF9] hover:text-white transition-colors cursor-pointer"
        title="Change this trainer's share"
      >
        {Number(trainer.commission_split_pct ?? 0)}%
        <span className="text-[10px] font-normal opacity-70 group-hover:opacity-100">edit</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(String(trainer.commission_split_pct ?? 0));
            setEditing(false);
          }
        }}
        className={`w-[72px] rounded-[8px] border px-2 py-1 text-[12px] text-right focus:outline-none ${
          valid ? "border-[#E1E6ED] focus:border-[#308BF9]" : "border-[#E5484D]"
        }`}
        aria-label="Commission split percent"
      />
      <span className="text-[12px] text-[#535359]">%</span>
      <button
        type="button"
        onClick={save}
        disabled={!valid || saving}
        className="rounded-full bg-[#308BF9] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50 cursor-pointer"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(String(trainer.commission_split_pct ?? 0));
          setEditing(false);
        }}
        className="text-[11px] text-[#A1A1A1] hover:text-[#535359] cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}

function RemoveButton({ trainer, onRemoved }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await removeTrainerService({ trainerUserId: trainer.user_id, reason: "Removed by facility admin" });
      const r = res?.data?.client_reassignment;
      toast.success(
        r
          ? `${trainer.name || trainer.user_id} removed. ${r.clients_moved} client${r.clients_moved === 1 ? "" : "s"} moved to your account.`
          : `${trainer.name || trainer.user_id} removed.`
      );
      onRemoved(trainer.user_id);
    } catch (err) {
      toast.error(err?.message || "Could not remove trainer");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[11px] font-semibold text-[#E5484D] hover:underline cursor-pointer"
      >
        Remove
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-[11px] text-[#535359]">Their clients move to you. Sure?</span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-full bg-[#E5484D] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50 cursor-pointer"
      >
        {busy ? "Removing…" : "Yes, remove"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-[11px] text-[#A1A1A1] cursor-pointer">
        No
      </button>
    </div>
  );
}

export default function FacilityAdminTrainersPage() {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, earn] = await Promise.all([listMyTrainersService(), fetchEarningsSummaryService()]);
      setData(list);
      setSummary(earn);
    } catch (err) {
      toast.error(err?.message || "Failed to load trainers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trainers = useMemo(() => (data?.existing || []).filter((t) => t.status === "active"), [data]);
  const pending = data?.pending_invites || [];
  const [resending, setResending] = useState(null);
  const [resent, setResent] = useState(null); // { invitation_id, email, debug_invite_link? }

  const resend = async (p) => {
    if (resending) return;
    setResending(p.invitation_id);
    try {
      const res = await resendUserInviteService({ inviteId: p.invitation_id });
      toast.success(`Invite re-sent to ${p.email}`);
      setResent({ invitation_id: p.invitation_id, email: p.email, debug_invite_link: res?.debug_invite_link || res?.data?.debug_invite_link || null });
    } catch (err) {
      toast.error(err?.message || "Could not resend invite");
    } finally {
      setResending(null);
    }
  };
  const earningsByTrainer = useMemo(() => {
    const m = new Map();
    for (const t of summary?.trainers || []) m.set(t.user_id, t);
    return m;
  }, [summary]);

  const totalClients = trainers.reduce((a, t) => a + (t.clients_count || 0), 0);
  const currency = summary?.currency || "USD";

  const onSplitSaved = (userId, pct) =>
    setData((d) => ({
      ...d,
      existing: d.existing.map((t) => (t.user_id === userId ? { ...t, commission_split_pct: pct } : t)),
    }));
  const onRemoved = (userId) =>
    setData((d) => ({ ...d, existing: d.existing.filter((t) => t.user_id !== userId) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            {summary?.facility?.name || "Your facility"}
          </h1>
          <p className="text-[#535359] text-[13px] mt-1">
            Your trainers, their clients, and the share of commission each one receives.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/facility-admin/invites"
            className="rounded-full bg-[#308BF9] text-white text-[11px] font-semibold px-4 py-1.5"
          >
            + Invite trainer
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1">
          <div className="text-[12px] opacity-80">This month, facility</div>
          <div className="text-[28px] font-bold">{summary ? formatMinor(summary.this_month_minor, currency) : "—"}</div>
          <div className="text-[11px] opacity-80">Your share after trainer splits</div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Active members referred</div>
          <div className="text-[#252525] text-[28px] font-bold">{summary?.active_subscriptions ?? "—"}</div>
          <div className="text-[#A1A1A1] text-[11px]">Paying via your QR codes</div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Trainers</div>
          <div className="text-[#252525] text-[28px] font-bold">{trainers.length}</div>
          <div className="text-[#A1A1A1] text-[11px]">{pending.length} invite{pending.length === 1 ? "" : "s"} pending</div>
        </div>
        <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
          <div className="text-[#535359] text-[12px]">Clients across trainers</div>
          <div className="text-[#252525] text-[28px] font-bold">{totalClients}</div>
          <div className="text-[#A1A1A1] text-[11px]">Commission rate {summary?.rate_pct ?? "—"}% of net</div>
        </div>
      </div>

      {/* Split explainer */}
      <div className="rounded-[10px] bg-[#EEF4FE] px-4 py-3 text-[12px] text-[#1F4E8C]">
        <strong>Commission split</strong> is the share of Rysflo&rsquo;s referral commission a trainer keeps for members who
        sign up under their own code; the rest comes to the facility. It&rsquo;s your call, from 0% to 100%, and a change
        re-splits every commission not yet paid out (amounts already paid stay as they were). Members who sign up under the facility&rsquo;s own QR code pay 100% to the facility.
      </div>

      {/* Trainers table */}
      {loading && !data ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : trainers.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
          No trainers yet.{" "}
          <Link href="/facility-admin/invites" className="text-[#308BF9] font-semibold">
            Invite your first trainer
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">Trainer</th>
                <th className="py-2.5 px-4 font-semibold">Code</th>
                <th className="py-2.5 px-4 font-semibold text-right">Clients</th>
                <th className="py-2.5 px-4 font-semibold text-right">Their earnings (month)</th>
                <th className="py-2.5 px-4 font-semibold">Commission split</th>
                <th className="py-2.5 px-4 font-semibold text-right"></th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => {
                const e = earningsByTrainer.get(t.user_id);
                return (
                  <tr key={t.user_id} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4">
                      <div className="text-[#252525] font-semibold">{t.name || t.user_id}</div>
                      <div className="text-[#A1A1A1] text-[11px]">{t.email || t.user_id}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">{t.partner_code || "-"}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{t.clients_count ?? 0}</td>
                    <td className="py-2.5 px-4 text-right text-[#252525]">
                      {e ? formatMinor(e.this_month_minor, currency) : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <SplitEditor trainer={t} onSaved={onSplitSaved} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <RemoveButton trainer={t} onRemoved={onRemoved} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="text-[#252525] text-[14px] font-bold mb-2">Pending invites</h2>
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2.5 px-4 font-semibold">Name</th>
                  <th className="py-2.5 px-4 font-semibold">Email</th>
                  <th className="py-2.5 px-4 font-semibold">Code</th>
                  <th className="py-2.5 px-4 font-semibold">Expires</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Sign-up link</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.invitation_id} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4 text-[#252525] font-semibold">{p.name || "—"}</td>
                    <td className="py-2.5 px-4 text-[#535359]">{p.email}</td>
                    <td className="py-2.5 px-4 text-[#535359] font-mono">{p.partner_code || "—"}</td>
                    <td className="py-2.5 px-4 text-[#A1A1A1]">{p.expires_at || "—"}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button type="button" onClick={() => resend(p)} disabled={resending === p.invitation_id} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 disabled:opacity-60 cursor-pointer">
                        {resending === p.invitation_id ? "Sending…" : "Resend email"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resent && (
            <div className="mt-3 rounded-[10px] bg-[#E5F6EE] px-4 py-3 text-[12px] text-[#1F7A4A]">
              A fresh sign-up link was emailed to <strong>{resent.email}</strong>. Any older link is now invalid.
              {/* Only present when the API runs with RETURN_INVITE_LINK_FOR_TESTING (never in production). */}
              {resent.debug_invite_link && (
                <div className="mt-2 flex flex-col gap-2">
                  <span className="text-[#535359]">Test environment — invite link (emails are not sent here):</span>
                  <div className="text-[#308BF9] break-all select-all bg-white rounded-[8px] px-3 py-2 border border-[#E1E6ED]">{resent.debug_invite_link}</div>
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(resent.debug_invite_link); toast.success("Invite link copied"); }} className="self-start rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">Copy invite link</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
