"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listQrService, linkQrService, generateQrBatchService, listFacilitiesService } from "@/services/commissionService";

/**
 * Pre-printed QR stickers. Derek types the id printed under the QR and picks
 * the gym (or a trainer) it should point at. Super admin can also generate
 * new batches and open a printable sheet.
 */

const STICKER_BASE = (process.env.NEXT_PUBLIC_STICKER_BASE_URL || process.env.NEXT_PUBLIC_ORDER_BASE_URL?.replace(/\/order$/, "/q") || "https://admin.rysflo.com/q").replace(/\/+$/, "");

export default function StickersPanel({ isSuperAdmin = false }) {
  const [items, setItems] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrId, setQrId] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(50);
  const [filter, setFilter] = useState("assigned");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, f] = await Promise.all([listQrService({ status: filter === "all" ? undefined : filter }), listFacilitiesService()]);
      setItems(q.items || []);
      setFacilities(f.facilities || []);
    } catch (err) {
      toast.error(err?.message || "Could not load stickers");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const link = async (e) => {
    e.preventDefault();
    if (!qrId.trim() || !target) return;
    setBusy(true);
    try {
      const res = await linkQrService({ qrId: qrId.trim(), targetUserId: target });
      toast.success(`Sticker ${res.qr.id} now points at ${res.qr.partner_code}`);
      setQrId("");
      load();
    } catch (err) {
      toast.error(err?.message || "Could not link sticker");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await generateQrBatchService({ count });
      toast.success(`${res.ids.length} stickers generated (batch ${res.batch_id})`);
      window.open(`/super-admin/stickers/print?batch=${encodeURIComponent(res.batch_id)}`, "_blank");
      setFilter("unassigned");
    } catch (err) {
      toast.error(err?.message || "Could not generate");
    } finally {
      setBusy(false);
    }
  };

  const field = "rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[#252525] text-[14px] font-bold">QR stickers</h2>
        <p className="text-[#535359] text-[12px] mt-1">
          Pre-printed stickers carry only an ID. Link a sticker to a facility (or one of its trainers) and every scan resolves to that code — re-link any time.
        </p>
      </div>

      <form onSubmit={link} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end rounded-[10px] border border-[#E1E6ED] p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[#535359] text-[12px] font-semibold">Sticker ID</span>
          <input value={qrId} onChange={(e) => setQrId(e.target.value.toUpperCase())} placeholder="K7M2P9" className={`${field} font-mono uppercase`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#535359] text-[12px] font-semibold">Points at</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
            <option value="">Choose a facility…</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.owner_user_id}>
                {f.name} — {f.partner_code}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy || !qrId.trim() || !target} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer">
          {busy ? "Linking…" : "Link sticker"}
        </button>
      </form>

      {isSuperAdmin && (
        <div className="flex items-center gap-3 flex-wrap rounded-[10px] bg-[#F5F7FA] p-4">
          <span className="text-[#535359] text-[12px] font-semibold">Generate a new batch</span>
          <input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className={`${field} w-24`} />
          <button type="button" onClick={generate} disabled={busy} className="rounded-[10px] bg-[#EEF4FE] text-[#308BF9] text-[12px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer">
            Generate & open print sheet
          </button>
          <span className="text-[#A1A1A1] text-[11px]">Stickers encode {STICKER_BASE}/&lt;ID&gt;</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[["assigned", "Linked"], ["unassigned", "Unlinked"], ["all", "All"]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-[11px] font-semibold cursor-pointer ${filter === k ? "bg-[#308BF9] text-white" : "bg-[#F5F7FA] text-[#535359]"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">No stickers in this view.</div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">Sticker</th>
                <th className="py-2.5 px-4 font-semibold">Batch</th>
                <th className="py-2.5 px-4 font-semibold">Points at</th>
                <th className="py-2.5 px-4 font-semibold text-right">Scans</th>
                <th className="py-2.5 px-4 font-semibold">Linked</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id} className="border-t border-[#F5F7FA]">
                  <td className="py-2.5 px-4 font-mono text-[#252525] font-semibold">{q.id}</td>
                  <td className="py-2.5 px-4 text-[#A1A1A1]">{q.batch_id || "—"}</td>
                  <td className="py-2.5 px-4 text-[#535359]">{q.partner_code ? `${q.facility_name || ""} ${q.partner_code}`.trim() : <span className="text-[#A66B00]">unlinked</span>}</td>
                  <td className="py-2.5 px-4 text-right text-[#252525]">{q.scans}</td>
                  <td className="py-2.5 px-4 text-[#A1A1A1]">{q.linked_at ? String(q.linked_at).slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
