"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchReferredMembersService, resendPurchaseCodeService } from "@/services/commissionService";

/**
 * Referrals › Members: everyone who bought through the caller's code(s).
 * The important column is "App linked" — until a member links, we can't
 * count their readings for the credit. Unlinked members get a resend button.
 */

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReferredMembersPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchReferredMembersService());
    } catch (err) {
      toast.error(err?.message || "Could not load members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resend = async (id) => {
    setBusyId(id);
    try {
      await resendPurchaseCodeService({ stripeSubscriptionId: id });
      toast.success("Code re-sent");
      load();
    } catch (err) {
      toast.error(err?.message || "Could not resend");
    } finally {
      setBusyId(null);
    }
  };

  const items = (data?.items || []).filter((i) => (filter === "all" ? true : filter === "linked" ? i.linked : !i.linked));
  const t = data?.totals;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[#252525] text-[16px] font-bold">Referred members</h2>
          <p className="text-[#535359] text-[13px] mt-1">Members who subscribed through your code or QR. Unlinked members haven&rsquo;t connected the app yet — their readings can&rsquo;t earn a credit until they do.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {t && (
        <div className="flex gap-2 flex-wrap">
          {[["all", `All (${t.total})`], ["linked", `App linked (${t.linked})`], ["unlinked", `Not linked (${t.unlinked})`]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-[11px] font-semibold cursor-pointer ${filter === k ? "bg-[#308BF9] text-white" : "bg-[#F5F7FA] text-[#535359]"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">No members here yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">Member</th>
                <th className="py-2.5 px-4 font-semibold">Via</th>
                <th className="py-2.5 px-4 font-semibold">Since</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">App linked</th>
                <th className="py-2.5 px-4 font-semibold text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.stripe_subscription_id} className="border-t border-[#F5F7FA]">
                  <td className="py-2.5 px-4 text-[#252525]">{m.email || "—"}</td>
                  <td className="py-2.5 px-4 text-[#535359]">
                    {m.via_trainer ? `Trainer: ${m.via_trainer}` : "Facility QR"}
                    {m.qr_id && <span className="text-[#A1A1A1] font-mono text-[11px]"> · sticker {m.qr_id}</span>}
                  </td>
                  <td className="py-2.5 px-4 text-[#535359]">{fmt(m.since)}</td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${["active", "trialing"].includes(m.status) ? "bg-[#E5F6EE] text-[#1F7A4A]" : "bg-[#FFF4E0] text-[#A66B00]"}`}>{m.status}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    {m.linked ? (
                      <span className="text-[#1F7A4A] font-semibold">Yes{m.linked_via ? ` (${m.linked_via.replace("_", " ")})` : ""}</span>
                    ) : (
                      <span className="text-[#A66B00] font-semibold">Not yet{m.purchase_code ? ` · code ${m.purchase_code}` : ""}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {!m.linked && (
                      <button type="button" onClick={() => resend(m.stripe_subscription_id)} disabled={busyId === m.stripe_subscription_id} className="text-[11px] font-semibold text-[#308BF9] hover:underline disabled:opacity-50 cursor-pointer">
                        {busyId === m.stripe_subscription_id ? "Sending…" : "Resend code"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
