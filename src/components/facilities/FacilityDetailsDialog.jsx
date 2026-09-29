"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchFacilityDetailsService, formatMinor } from "@/services/commissionService";

/**
 * Super admin › Facilities › click a row: everything about that facility in
 * one popup — owner, onboarding trainer admin, payout setup, trainers,
 * members, QR stickers, commission and pending invites. Escape / overlay / ×
 * close it.
 */

const PAYOUT = {
  verified: { text: "Stripe verified", cls: "bg-[#E5F6EE] text-[#1F7A4A]" },
  pending: { text: "Stripe pending", cls: "bg-[#FFF4E0] text-[#A66B00]" },
  action_required: { text: "Stripe: action needed", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  disabled: { text: "Payouts disabled", cls: "bg-[#FCEAEB] text-[#B5363A]" },
  not_started: { text: "No payout setup", cls: "bg-[#F5F7FA] text-[#535359]" },
};

const STATUS = {
  active: "bg-[#E5F6EE] text-[#1F7A4A]",
  trialing: "bg-[#EEF4FE] text-[#308BF9]",
  past_due: "bg-[#FFF4E0] text-[#A66B00]",
  pending: "bg-[#FFF4E0] text-[#A66B00]",
  held: "bg-[#FFF4E0] text-[#A66B00]",
  scheduled: "bg-[#EEF4FE] text-[#308BF9]",
  paid: "bg-[#E5F6EE] text-[#1F7A4A]",
  assigned: "bg-[#E5F6EE] text-[#1F7A4A]",
};
const MUTED = "bg-[#F5F7FA] text-[#535359]";

const fmtDate = (iso, withTime = false) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
};

const label = (s) => (s ? String(s).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");

function Pill({ value, cls }) {
  return <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap ${cls || STATUS[value] || MUTED}`}>{label(value)}</span>;
}

function Stat({ title, value, hint }) {
  return (
    <div className="rounded-[10px] bg-white border border-[#E1E6ED] p-4 flex flex-col gap-0.5">
      <div className="text-[11px] text-[#535359]">{title}</div>
      <div className="text-[20px] font-bold text-[#252525]">{value}</div>
      {hint && <div className="text-[10px] text-[#A1A1A1]">{hint}</div>}
    </div>
  );
}

function Info({ title, rows }) {
  return (
    <div className="rounded-[10px] border border-[#E1E6ED] p-4 flex flex-col gap-2">
      <div className="text-[12px] font-bold text-[#252525]">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 text-[12px]">
          <span className="text-[#A1A1A1] shrink-0">{k}</span>
          <span className="text-[#252525] text-right break-all">{v ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, count, children, empty }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-bold text-[#252525]">
        {title}
        {count != null && <span className="ml-1.5 text-[#A1A1A1] font-semibold">({count})</span>}
      </h3>
      {empty ? (
        <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-4 text-[#A1A1A1] text-[12px] text-center">{empty}</div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">{children}</div>
      )}
    </div>
  );
}

const TH = "py-2 px-3 font-semibold whitespace-nowrap";
const TD = "py-2 px-3 whitespace-nowrap";

export default function FacilityDetailsDialog({ facility, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const open = !!facility;
  const facilityId = facility?.id;

  useEffect(() => {
    if (!facilityId) return undefined;
    let cancelled = false;
    setData(null);
    setError(null);
    fetchFacilityDetailsService(facilityId)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err?.message || "Could not load facility"));
    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const f = data?.facility;
  const c = data?.commission;
  const cur = c?.currency?.toUpperCase() || "USD";
  const payout = PAYOUT[data?.payout?.status] || PAYOUT.not_started;
  const yesNo = (v) => (v ? "Yes" : "No");

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${facility.name} details`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#F5F7FA] rounded-[15px] shadow-[0_16px_48px_rgba(37,37,37,0.18)] w-full max-w-[1040px] max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 bg-white rounded-t-[15px] px-6 py-4 border-b border-[#E1E6ED]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[#252525] text-[18px] font-bold leading-tight">{f?.name || facility.name}</h2>
              {f && <Pill value={f.status} />}
              <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${payout.cls}`}>{payout.text}</span>
            </div>
            <div className="text-[#535359] text-[12px] mt-1">
              Code <span className="font-mono font-semibold text-[#252525]">{f?.partner_code || facility.partner_code}</span>
              {f && <> · Created {fmtDate(f.created_at, true)}{f.created_by_user_id && <> by {f.created_by_user_id}</>}</>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-1.5 text-[#A1A1A1] hover:bg-[#F5F7FA] hover:text-[#535359] cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {error ? (
            <div className="rounded-[10px] bg-[#FCEAEB] text-[#B5363A] text-[12px] px-4 py-3">{error}</div>
          ) : !data ? (
            <div className="text-[#A1A1A1] text-[13px] py-10 text-center">Loading&hellip;</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat title="Trainers" value={data.trainers.filter((t) => t.status === "active").length} hint={`${data.trainers.length} total`} />
                <Stat title="Active members" value={data.members_running} hint={`${data.members_total} purchases`} />
                <Stat title="Commission owed" value={formatMinor(c.owed, cur)} hint="Pending + held + scheduled" />
                <Stat title="Commission paid" value={formatMinor(c.paid, cur)} hint={`${c.entries} ledger entries`} />
                <Stat title="QR stickers" value={data.qr_codes.length} hint={`${data.qr_codes.reduce((a, q) => a + q.scans, 0)} scans`} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info
                  title="Owner"
                  rows={[
                    ["Name", data.owner.name],
                    ["Email", data.owner.user_id],
                    ["Phone", data.owner.phone],
                    ["Location", data.owner.location],
                    ["Account", data.owner.status ? label(data.owner.status) : "Not accepted"],
                    ["Joined", fmtDate(data.owner.joined_at)],
                  ]}
                />
                <Info
                  title="Trainer admin (onboarded by)"
                  rows={[
                    ["Name", data.parent_admin.name],
                    ["Email", data.parent_admin.user_id],
                    ["Phone", data.parent_admin.phone],
                  ]}
                />
                <Info
                  title="Payout setup (Stripe)"
                  rows={[
                    ["Status", payout.text],
                    ["Details submitted", yesNo(data.payout.details_submitted)],
                    ["Charges enabled", yesNo(data.payout.charges_enabled)],
                    ["Payouts enabled", yesNo(data.payout.payouts_enabled)],
                    ["Last synced", fmtDate(data.payout.last_synced_at, true)],
                  ]}
                />
              </div>

              {f.status !== "active" && f.status_changed_at && (
                <div className="rounded-[10px] bg-[#FFF4E0] text-[#A66B00] text-[12px] px-4 py-3">
                  {label(f.status)} on {fmtDate(f.status_changed_at, true)}
                  {f.status_changed_by && <> by {f.status_changed_by}</>}
                  {f.status_change_reason && <> — {f.status_change_reason}</>}
                </div>
              )}

              <Section title="Trainers" count={data.trainers.length} empty={data.trainers.length ? null : "No trainers in this facility yet."}>
                <table className="w-full text-[12px] bg-white">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                      <th className={TH}>Trainer</th>
                      <th className={TH}>Phone</th>
                      <th className={TH}>Code</th>
                      <th className={`${TH} text-right`}>Split</th>
                      <th className={`${TH} text-right`}>Active members</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trainers.map((t) => (
                      <tr key={t.user_id} className="border-t border-[#F5F7FA]">
                        <td className={TD}>
                          <div className="text-[#252525]">{t.name || "—"}</div>
                          <div className="text-[#A1A1A1] text-[11px]">{t.user_id}</div>
                        </td>
                        <td className={`${TD} text-[#535359]`}>{t.phone || "—"}</td>
                        <td className={`${TD} font-mono text-[#535359]`}>{t.partner_code || "—"}</td>
                        <td className={`${TD} text-right text-[#252525]`}>{t.commission_split_pct == null ? "—" : `${t.commission_split_pct}%`}</td>
                        <td className={`${TD} text-right text-[#252525]`}>{t.active_subscriptions}</td>
                        <td className={TD}><Pill value={t.status} /></td>
                        <td className={`${TD} text-[#A1A1A1]`}>{fmtDate(t.joined_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section
                title="Members"
                count={data.members_total > data.members.length ? `latest ${data.members.length} of ${data.members_total}` : data.members_total}
                empty={data.members.length ? null : "No purchases through this facility yet."}
              >
                <table className="w-full text-[12px] bg-white">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                      <th className={TH}>Member</th>
                      <th className={TH}>Plan</th>
                      <th className={`${TH} text-right`}>Price</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Plan period</th>
                      <th className={TH}>Code used</th>
                      <th className={TH}>App linked</th>
                      <th className={TH}>Purchased</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.id} className="border-t border-[#F5F7FA]">
                        <td className={TD}>
                          <div className="text-[#252525]">{m.name || "—"}</div>
                          <div className="text-[#A1A1A1] text-[11px]">{m.email || "—"}</div>
                        </td>
                        <td className={`${TD} text-[#535359]`}>{m.plan_code}</td>
                        <td className={`${TD} text-right text-[#252525]`}>{formatMinor(m.amount_minor, (m.currency || "usd").toUpperCase())}</td>
                        <td className={TD}><Pill value={m.status} /></td>
                        <td className={`${TD} text-[#535359]`}>{m.current_period_start ? `${fmtDate(m.current_period_start)} – ${fmtDate(m.current_period_end)}` : "—"}</td>
                        <td className={TD}>
                          <div className="font-mono text-[#535359]">{m.partner_code || "—"}</div>
                          <div className="text-[#A1A1A1] text-[11px]">{[m.attributed_role && label(m.attributed_role), m.qr_id && `QR ${m.qr_id}`].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className={`${TD} text-[#535359]`}>{m.app_linked ? "Yes" : "No"}</td>
                        <td className={`${TD} text-[#A1A1A1]`}>{fmtDate(m.purchased_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section title="Commission" count={c.entries ? `latest ${data.ledger.length} of ${c.entries}` : 0} empty={data.ledger.length ? null : "No commission recorded yet."}>
                <div className="flex flex-wrap gap-x-6 gap-y-1 bg-white px-3 py-2.5 border-b border-[#F5F7FA] text-[12px]">
                  {["pending", "held", "scheduled", "paid", "reversed"].map((k) => (
                    <span key={k} className="text-[#535359]">
                      {label(k)} <strong className="text-[#252525]">{formatMinor(c[k], cur)}</strong>
                    </span>
                  ))}
                </div>
                <table className="w-full text-[12px] bg-white">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                      <th className={TH}>Invoice paid</th>
                      <th className={TH}>Payee</th>
                      <th className={TH}>Code</th>
                      <th className={`${TH} text-right`}>Invoice</th>
                      <th className={`${TH} text-right`}>Rate</th>
                      <th className={`${TH} text-right`}>Share</th>
                      <th className={`${TH} text-right`}>Commission</th>
                      <th className={TH}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ledger.map((e) => (
                      <tr key={e.id} className="border-t border-[#F5F7FA]">
                        <td className={`${TD} text-[#535359]`}>{fmtDate(e.invoice_paid_at)}</td>
                        <td className={TD}>
                          <div className="text-[#252525]">{e.payee_user_id}</div>
                          <div className="text-[#A1A1A1] text-[11px]">{label(e.payee_role)}</div>
                        </td>
                        <td className={`${TD} font-mono text-[#535359]`}>{e.partner_code}</td>
                        <td className={`${TD} text-right text-[#535359]`}>{formatMinor(e.invoice_net_minor, e.currency.toUpperCase())}</td>
                        <td className={`${TD} text-right text-[#535359]`}>{e.commission_rate_pct}%</td>
                        <td className={`${TD} text-right text-[#535359]`}>{e.share_pct}%</td>
                        <td className={`${TD} text-right text-[#252525] font-semibold`}>{formatMinor(e.amount_minor, e.currency.toUpperCase())}</td>
                        <td className={TD} title={e.hold_reason || undefined}><Pill value={e.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section title="QR stickers" count={data.qr_codes.length} empty={data.qr_codes.length ? null : "No stickers linked to this facility."}>
                <table className="w-full text-[12px] bg-white">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                      <th className={TH}>Sticker</th>
                      <th className={TH}>Points to</th>
                      <th className={TH}>Code</th>
                      <th className={`${TH} text-right`}>Scans</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Linked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.qr_codes.map((q) => (
                      <tr key={q.id} className="border-t border-[#F5F7FA]">
                        <td className={`${TD} font-mono font-semibold text-[#252525]`}>{q.id}</td>
                        <td className={`${TD} text-[#535359]`}>{q.linked_user_id || "—"}</td>
                        <td className={`${TD} font-mono text-[#535359]`}>{q.partner_code || "—"}</td>
                        <td className={`${TD} text-right text-[#252525]`}>{q.scans}</td>
                        <td className={TD}><Pill value={q.status} /></td>
                        <td className={`${TD} text-[#A1A1A1]`}>{fmtDate(q.linked_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {data.pending_invites.length > 0 && (
                <Section title="Pending invites" count={data.pending_invites.length}>
                  <table className="w-full text-[12px] bg-white">
                    <thead>
                      <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                        <th className={TH}>Invitee</th>
                        <th className={TH}>Role</th>
                        <th className={TH}>Code</th>
                        <th className={TH}>Sent</th>
                        <th className={TH}>Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pending_invites.map((i) => (
                        <tr key={i.id} className="border-t border-[#F5F7FA]">
                          <td className={TD}>
                            <div className="text-[#252525]">{i.name || "—"}</div>
                            <div className="text-[#A1A1A1] text-[11px]">{i.email}</div>
                          </td>
                          <td className={`${TD} text-[#535359]`}>{label(i.role)}</td>
                          <td className={`${TD} font-mono text-[#535359]`}>{i.partner_code || "—"}</td>
                          <td className={`${TD} text-[#A1A1A1]`}>{fmtDate(i.sent_at)}</td>
                          <td className={`${TD} text-[#A1A1A1]`}>{fmtDate(i.expires_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
