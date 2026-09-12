"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchCommissionRateService, setCommissionRateService, fetchPricingService, setPricingService, formatMinor } from "@/services/commissionService";

/**
 * Super admin › Settings. Today: the platform commission rate (Rysflo -> facility).
 * Append-only: every change is a new row with an effective date; the ledger
 * keeps the rate each payment was made under.
 */

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

function PricingSection() {
  const [data, setData] = useState(null);
  const [list, setList] = useState("");
  const [referred, setReferred] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchPricingService();
      setData(d);
      if (d.current) {
        setList((d.current.list_price_minor / 100).toFixed(2));
        setReferred((d.current.referred_price_minor / 100).toFixed(2));
      }
    } catch (err) {
      toast.error(err?.message || "Could not load pricing");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const l = Number(list), r = Number(referred);
  const valid = Number.isFinite(l) && Number.isFinite(r) && l > 0 && r > 0 && r <= l;
  const changed = valid && data?.current && (Math.round(l * 100) !== data.current.list_price_minor || Math.round(r * 100) !== data.current.referred_price_minor);

  const save = async (e) => {
    e.preventDefault();
    if (!changed || busy) return;
    if (!window.confirm(`Set list price to $${l.toFixed(2)} and referred price to $${r.toFixed(2)}? New Stripe coupon and promotion codes are created automatically; existing subscribers keep their price.`)) return;
    setBusy(true);
    try {
      await setPricingService({ listPrice: l, referredPrice: r, note: note.trim() || undefined });
      toast.success("Pricing updated");
      setNote("");
      load();
    } catch (err) {
      toast.error(err?.message || "Could not update pricing");
    } finally {
      setBusy(false);
    }
  };

  const field = "rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";

  return (
    <section className="bg-white rounded-[15px] p-6 flex flex-col gap-4 max-w-[720px]">
      <div>
        <h2 className="text-[#252525] text-[14px] font-bold">Membership pricing</h2>
        <p className="text-[#535359] text-[12px] mt-1">
          The website shows the list price. A gym or trainer code brings it to the referred price — the difference becomes a Stripe coupon applied to every month, and each partner code becomes a Stripe promotion code automatically.
        </p>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-[#252525] text-[32px] font-bold">{data?.current ? formatMinor(data.current.referred_price_minor) : "—"}</span>
        <span className="text-[#A1A1A1] text-[14px] line-through">{data?.current ? formatMinor(data.current.list_price_minor) : ""}</span>
        <span className="text-[#A1A1A1] text-[12px]">with a code · per month</span>
      </div>
      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-[140px_140px_1fr_auto] gap-3 items-end">
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">List price $</span><input type="number" min={1} step={0.01} value={list} onChange={(e) => setList(e.target.value)} className={field} /></label>
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">Referred price $</span><input type="number" min={1} step={0.01} value={referred} onChange={(e) => setReferred(e.target.value)} className={field} /></label>
        <label className="flex flex-col gap-1"><span className="text-[#535359] text-[12px] font-semibold">Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Launch pricing" className={field} /></label>
        <button type="submit" disabled={!changed || busy} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer">{busy ? "Saving…" : "Save"}</button>
      </form>
      {data?.history?.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED] mt-2">
          <table className="w-full text-[12px]">
            <thead><tr className="bg-[#F5F7FA] text-[#535359] text-left"><th className="py-2 px-4 font-semibold">List</th><th className="py-2 px-4 font-semibold">Referred</th><th className="py-2 px-4 font-semibold">Effective from</th><th className="py-2 px-4 font-semibold">Set by</th><th className="py-2 px-4 font-semibold">Note</th></tr></thead>
            <tbody>
              {data.history.map((h, i) => (
                <tr key={i} className="border-t border-[#F5F7FA]"><td className="py-2 px-4 text-[#252525] font-semibold">{formatMinor(h.list_price_minor)}</td><td className="py-2 px-4 text-[#252525] font-semibold">{formatMinor(h.referred_price_minor)}</td><td className="py-2 px-4 text-[#535359]">{fmt(h.effective_from)}</td><td className="py-2 px-4 text-[#535359]">{h.set_by_user_id}</td><td className="py-2 px-4 text-[#A1A1A1]">{h.note || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SuperAdminSettingsPage() {
  const [data, setData] = useState(null);
  const [rate, setRate] = useState("");
  const [effective, setEffective] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchCommissionRateService();
      setData(d);
      setRate(String(d.current?.rate_pct ?? ""));
    } catch (err) {
      toast.error(err?.message || "Could not load commission rate");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const n = Number(rate);
  const valid = rate !== "" && Number.isFinite(n) && n >= 0 && n <= 100 && Math.round(n * 100) === n * 100;
  const changed = valid && n !== Number(data?.current?.rate_pct);

  const save = async (e) => {
    e.preventDefault();
    if (!changed || busy) return;
    const when = effective ? `${effective}T00:00:00Z` : null;
    if (!window.confirm(`Set the platform commission rate to ${n}% ${when ? `from ${effective}` : "starting now"}? Existing ledger entries are not affected.`)) return;
    setBusy(true);
    try {
      await setCommissionRateService({
        ratePct: n,
        effectiveFrom: when ? `${effective} 00:00:00` : undefined,
        note: note.trim() || undefined,
      });
      toast.success(`Commission rate set to ${n}%`);
      setEffective("");
      setNote("");
      load();
    } catch (err) {
      toast.error(err?.message || "Could not update rate");
    } finally {
      setBusy(false);
    }
  };

  const field = "rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold">Settings</h1>
        <p className="text-[#535359] text-[13px] mt-1">Platform-wide configuration for the referral programme.</p>
      </div>

      <PricingSection />

      <section className="bg-white rounded-[15px] p-6 flex flex-col gap-4 max-w-[720px]">
        <div>
          <h2 className="text-[#252525] text-[14px] font-bold">Commission rate</h2>
          <p className="text-[#535359] text-[12px] mt-1">
            The share of each referred member&rsquo;s payment (after their reading credit) that Rysflo pays to the facility.
            Facilities then split it with trainers as they choose. Changes never rewrite past payments.
          </p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[#252525] text-[32px] font-bold">{data?.current ? `${data.current.rate_pct}%` : "—"}</span>
          <span className="text-[#A1A1A1] text-[12px]">current, since {fmt(data?.current?.effective_from)}</span>
        </div>

        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-[120px_180px_1fr_auto] gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[12px] font-semibold">New rate %</span>
            <input type="number" min={0} max={100} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[12px] font-semibold">Effective from (UTC)</span>
            <input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[12px] font-semibold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Q4 promo" className={field} />
          </label>
          <button type="submit" disabled={!changed || busy} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer">
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
        <p className="text-[#A1A1A1] text-[11px]">Leave the date empty to apply immediately.</p>

        {data?.history?.length > 0 && (
          <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED] mt-2">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                  <th className="py-2 px-4 font-semibold">Rate</th>
                  <th className="py-2 px-4 font-semibold">Effective from</th>
                  <th className="py-2 px-4 font-semibold">Set by</th>
                  <th className="py-2 px-4 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h, i) => (
                  <tr key={i} className="border-t border-[#F5F7FA]">
                    <td className="py-2 px-4 text-[#252525] font-semibold">{h.rate_pct}%</td>
                    <td className="py-2 px-4 text-[#535359]">{fmt(h.effective_from)}</td>
                    <td className="py-2 px-4 text-[#535359]">{h.set_by_user_id}</td>
                    <td className="py-2 px-4 text-[#A1A1A1]">{h.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
