"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchReferredMembersService, resendPurchaseCodeService, formatMinor } from "@/services/commissionService";

// Mirrors the API's per-recipient cooldown (EMAIL_RESEND_COOLDOWN_SECONDS, default 60).
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Referrals › Members: everyone who bought through the caller's code(s).
 *
 * Facility admin: one accordion per trainer (plus the wall QR), each member
 * expandable to their month-by-month payments — what they were charged after
 * the breath credit, the commission it produced and how it was split.
 * Trainer: the same member rows, flat.
 *
 * "App linked" matters: until a member links, we can't count their readings
 * for the credit. Unlinked members get a resend button.
 */

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ACTIVE = ["active", "trialing", "past_due"];

function StatusPill({ status }) {
  const on = ACTIVE.includes(status);
  return <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${on ? "bg-[#E5F6EE] text-[#1F7A4A]" : "bg-[#FFF4E0] text-[#A66B00]"}`}>{status}</span>;
}

function Chevron({ open }) {
  return <span className={`inline-block text-[#A1A1A1] transition-transform ${open ? "rotate-90" : ""}`}>▸</span>;
}

/** Month-by-month payments for one member. */
function InvoiceHistory({ m, isOwner, house = false, currency }) {
  // Website (no-code) members earn nobody a commission, so the ledger has no
  // per-invoice rows for them; their payment history lives in Stripe.
  if (house) {
    return (
      <div className="px-4 py-3 text-[#535359] text-[12px]">
        Pays {m.last_charged_minor != null ? `${formatMinor(m.last_charged_minor, currency)}/month` : "the list price"} directly to Rysflo
        {m.renews ? ` · next renewal ${fmt(m.renews)}` : ""}. No commission applies; the payment history is in Stripe.
      </div>
    );
  }
  if (!m.invoices?.length) {
    return <div className="px-4 py-3 text-[#A1A1A1] text-[12px]">No payment recorded yet — the first invoice is still settling.</div>;
  }
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-[#535359] text-left">
          <th className="py-2 px-4 font-semibold">Payment</th>
          <th className="py-2 px-4 font-semibold text-right">Charged</th>
          <th className="py-2 px-4 font-semibold text-right">Breath credit</th>
          <th className="py-2 px-4 font-semibold text-right">Commission</th>
          {isOwner && <th className="py-2 px-4 font-semibold text-right">Trainer share</th>}
          <th className="py-2 px-4 font-semibold text-right">{isOwner ? "Facility share" : "Your share"}</th>
          <th className="py-2 px-4 font-semibold">Status</th>
        </tr>
      </thead>
      <tbody>
        {m.invoices.map((i) => (
          <tr key={i.invoice_id} className={`border-t border-[#EEF1F5] ${i.status === "reversed" ? "opacity-50 line-through" : ""}`}>
            <td className="py-2 px-4 text-[#252525]">{fmt(i.paid_at)}</td>
            <td className="py-2 px-4 text-right text-[#252525] font-semibold">{formatMinor(i.charged_minor, currency)}</td>
            <td className="py-2 px-4 text-right text-[#1F7A4A]">{i.breath_credit_minor ? `−${formatMinor(i.breath_credit_minor, currency)}` : "—"}</td>
            <td className="py-2 px-4 text-right text-[#535359]">{formatMinor(i.commission_minor, currency)} <span className="text-[#A1A1A1]">({i.rate_pct}%)</span></td>
            {isOwner && <td className="py-2 px-4 text-right text-[#535359]">{formatMinor(i.trainer_minor, currency)}</td>}
            <td className="py-2 px-4 text-right text-[#252525] font-semibold">{formatMinor(isOwner ? i.facility_minor : i.my_minor, currency)}</td>
            <td className="py-2 px-4"><StatusPill status={i.status === "pending" || i.status === "scheduled" ? "active" : i.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MemberRow({ m, isOwner, house = false, open, onToggle, onResend, busy, coolingDown, currency }) {
  return (
    <>
      <tr className="border-t border-[#F5F7FA] cursor-pointer hover:bg-[#FAFBFC]" onClick={onToggle}>
        <td className="py-2.5 px-4 text-[#252525]">
          <div className="flex items-center gap-2">
            <Chevron open={open} />
            <div>
              <div className="font-semibold">{m.name || m.email || "—"}</div>
              {m.name && <div className="text-[#A1A1A1] text-[11px]">{m.email}</div>}
            </div>
          </div>
        </td>
        {!isOwner && (
          <td className="py-2.5 px-4 text-[#535359]">
            {m.source === "website" ? "Website (no code)" : m.via_trainer ? `Trainer: ${m.via_trainer}` : "Facility QR"}
            {m.qr_id && <span className="text-[#A1A1A1] font-mono text-[11px]"> · sticker {m.qr_id}</span>}
          </td>
        )}
        <td className="py-2.5 px-4 text-[#535359]">{fmt(m.since)}</td>
        <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">
          {m.last_charged_minor != null ? `${formatMinor(m.last_charged_minor, currency)}/mo` : "—"}
          {m.breath_credit_minor > 0 && <div className="text-[#1F7A4A] text-[10px] font-normal">−{formatMinor(m.breath_credit_minor, currency)} breath credit</div>}
        </td>
        {!house && <td className="py-2.5 px-4 text-right text-[#535359]">{m.months_paid}</td>}
        {!house && <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{formatMinor(m.my_share_minor, currency)}</td>}
        <td className="py-2.5 px-4"><StatusPill status={m.status} /></td>
        <td className="py-2.5 px-4">
          {m.linked ? (
            <span className="text-[#1F7A4A] font-semibold">Yes{m.linked_via ? ` (${m.linked_via.replace("_", " ")})` : ""}</span>
          ) : (
            <span className="text-[#A66B00] font-semibold">Not yet{m.purchase_code ? ` · code ${m.purchase_code}` : ""}</span>
          )}
        </td>
        <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
          {!m.linked && (
            <button type="button" onClick={onResend} disabled={busy || coolingDown > 0} className="text-[11px] font-semibold text-[#308BF9] hover:underline disabled:opacity-50 cursor-pointer">
              {busy ? "Sending…" : coolingDown > 0 ? `Resend in ${coolingDown}s` : "Resend code"}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-[#F9FAFC]">
          <td colSpan={isOwner ? 8 : house ? 7 : 9} className="p-0">
            <InvoiceHistory m={m} isOwner={isOwner} house={house} currency={currency} />
          </td>
        </tr>
      )}
    </>
  );
}

function MembersTable({ members, isOwner, house = false, openId, setOpenId, resend, busyId, cooldowns, currency }) {
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="bg-[#F5F7FA] text-[#535359] text-left">
          <th className="py-2.5 px-4 font-semibold">Member</th>
          {!isOwner && <th className="py-2.5 px-4 font-semibold">Via</th>}
          <th className="py-2.5 px-4 font-semibold">Since</th>
          <th className="py-2.5 px-4 font-semibold text-right">Pays</th>
          {!house && <th className="py-2.5 px-4 font-semibold text-right">Months</th>}
          {!house && <th className="py-2.5 px-4 font-semibold text-right">{isOwner ? "Facility share" : "Your share"}</th>}
          <th className="py-2.5 px-4 font-semibold">Status</th>
          <th className="py-2.5 px-4 font-semibold">App linked</th>
          <th className="py-2.5 px-4 font-semibold text-right"></th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <MemberRow
            key={m.stripe_subscription_id}
            m={m}
            isOwner={isOwner}
            house={house}
            currency={currency}
            open={openId === m.stripe_subscription_id}
            onToggle={() => setOpenId(openId === m.stripe_subscription_id ? null : m.stripe_subscription_id)}
            onResend={() => resend(m.stripe_subscription_id)}
            busy={busyId === m.stripe_subscription_id}
            coolingDown={cooldowns[m.stripe_subscription_id] || 0}
          />
        ))}
      </tbody>
    </table>
  );
}

export default function ReferredMembersPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // Seconds left before "Resend code" is allowed again, per subscription. Set
  // after a successful send (server cooldown) or from a 429's retry_after_seconds.
  const [cooldowns, setCooldowns] = useState({});
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [openGroups, setOpenGroups] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchReferredMembersService();
      setData(d);
      // Open every trainer with members by default so the owner sees activity at a glance.
      setOpenGroups((prev) => {
        const next = { ...prev };
        for (const g of d?.groups || []) if (next[g.key] === undefined) next[g.key] = g.members.length > 0;
        return next;
      });
    } catch (err) {
      toast.error(err?.message || "Could not load members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!Object.values(cooldowns).some((s) => s > 0)) return undefined;
    const t = setInterval(() => {
      setCooldowns((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(0, v - 1)]).filter(([, v]) => v > 0)));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldowns]);

  const resend = async (id) => {
    setBusyId(id);
    try {
      await resendPurchaseCodeService({ stripeSubscriptionId: id });
      toast.success("Code re-sent");
      setCooldowns((c) => ({ ...c, [id]: RESEND_COOLDOWN_SECONDS }));
      load();
    } catch (err) {
      const wait = Number(err?.data?.retry_after_seconds);
      if (err?.status === 429 && wait > 0) setCooldowns((c) => ({ ...c, [id]: Math.min(wait, 3600) }));
      toast.error(err?.message || "Could not resend");
    } finally {
      setBusyId(null);
    }
  };

  const pass = (i) => (filter === "all" ? true : filter === "linked" ? i.linked : !i.linked);
  const isOwner = (data?.groups?.length || 0) > 0;
  // House trainer ("Rysflo Support"): members who bought on the website with
  // no code. No commission applies, so the money columns are hidden.
  const house = !!data?.house;
  const items = (data?.items || []).filter(pass);
  const currency = data?.items?.[0]?.currency || "USD";
  const t = data?.totals;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[#252525] text-[16px] font-bold">{house ? "Website members" : "Referred members"}</h2>
          <p className="text-[#535359] text-[13px] mt-1">
            {house
              ? "Members who bought on the website without a gym or trainer code. They're attached to this account when they enter their purchase code in the app."
              : isOwner
              ? "Every member who subscribed through your facility, grouped by the trainer whose code they used. Open a member to see each month's payment — it varies with their breath credit — and how the commission was split."
              : "Members who subscribed through your code or QR. Open a member to see each month's payment and your share of it."}{" "}
            Unlinked members haven&rsquo;t connected the app yet — their readings can&rsquo;t earn a credit until they do.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-60 cursor-pointer">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {t && (
        <div className={`grid grid-cols-2 gap-3 ${house ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {(house
            ? [
                ["Members", `${t.active} active`, `${t.total} total`],
                ["App linked", `${t.linked}`, "entered their purchase code"],
                ["Not linked", `${t.unlinked}`, "still to activate the app"],
              ]
            : [
                ["Members", `${t.active} active`, `${t.total} total`],
                ["Charged to members", formatMinor(t.charged_minor, currency), `after ${formatMinor(t.breath_credit_minor, currency)} breath credits`],
                ["Commission generated", formatMinor(t.commission_minor, currency), data.rate_pct != null ? `${data.rate_pct}% of charged` : "—"],
                [isOwner ? "Facility's share" : "Your share", formatMinor(t.my_share_minor, currency), isOwner ? "after trainer splits" : "of the commission"],
              ]
          ).map(([label, value, hint]) => (
            <div key={label} className="rounded-[10px] bg-white border border-[#E1E6ED] p-4">
              <div className="text-[#535359] text-[11px]">{label}</div>
              <div className="text-[#252525] text-[20px] font-bold">{value}</div>
              <div className="text-[#A1A1A1] text-[11px]">{hint}</div>
            </div>
          ))}
        </div>
      )}

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
      ) : isOwner ? (
        <div className="flex flex-col gap-3">
          {data.groups.map((g) => {
            const members = g.members.filter(pass);
            const open = !!openGroups[g.key];
            return (
              <div key={g.key} className="rounded-[10px] border border-[#E1E6ED] bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenGroups((o) => ({ ...o, [g.key]: !open }))}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left cursor-pointer hover:bg-[#FAFBFC]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Chevron open={open} />
                    <div className="min-w-0">
                      <div className="text-[#252525] text-[13px] font-bold truncate">
                        {g.name}
                        {g.kind === "trainer" && g.status !== "active" && <span className="ml-2 text-[#A66B00] text-[10px] font-semibold">({g.status})</span>}
                      </div>
                      <div className="text-[#A1A1A1] text-[11px] font-mono">
                        {g.code}
                        {g.kind === "trainer" && <span className="font-sans"> · trainer keeps {g.split_pct}%</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right shrink-0">
                    <div>
                      <div className="text-[#252525] text-[13px] font-semibold">{members.length}</div>
                      <div className="text-[#A1A1A1] text-[10px]">members</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-[#252525] text-[13px] font-semibold">{formatMinor(g.totals.charged_minor, currency)}</div>
                      <div className="text-[#A1A1A1] text-[10px]">charged</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-[#252525] text-[13px] font-semibold">{formatMinor(g.totals.commission_minor, currency)}</div>
                      <div className="text-[#A1A1A1] text-[10px]">commission</div>
                    </div>
                    <div>
                      <div className="text-[#308BF9] text-[13px] font-bold">{formatMinor(g.totals.my_share_minor, currency)}</div>
                      <div className="text-[#A1A1A1] text-[10px]">facility share</div>
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="border-t border-[#E1E6ED] overflow-x-auto">
                    {members.length === 0 ? (
                      <div className="px-4 py-3 text-[#A1A1A1] text-[12px]">No members through this code yet.</div>
                    ) : (
                      <MembersTable members={members} isOwner openId={openId} setOpenId={setOpenId} resend={resend} busyId={busyId} cooldowns={cooldowns} currency={currency} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          <MembersTable members={items} isOwner={false} house={house} openId={openId} setOpenId={setOpenId} resend={resend} busyId={busyId} cooldowns={cooldowns} currency={currency} />
        </div>
      )}
    </div>
  );
}
