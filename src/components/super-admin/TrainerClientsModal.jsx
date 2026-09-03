"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchTrainerClientsOverviewForSuperAdminService } from "@/services/authService";

// Pop-up opened from the Trainer Adoption table (super-admin analytics). Lists
// every client under the clicked trainer, straight from
// TRAINERCLIENTSOVERVIEWFORSUPERADMIN (trainer_id = the trainer's partner_code),
// with server-side search + pagination.

const PAGE_LIMIT = 10;
const R = {
  blue: "#308bf9", blueLight: "#e9f3ff", green: "#3faf58", red: "#e74c3c",
  tp: "#252525", ts: "#535359", tm: "#738298", td: "#a1a1a1",
  border: "#e1e6ed", surface: "#f5f7fa",
};

function goalLabel(g) {
  if (!g) return "—";
  const l = String(g).toLowerCase();
  if (l.includes("fat")) return "Fat Loss";
  if (l.includes("weight")) return "Weight Loss";
  if (l.includes("muscle") || l.includes("gain")) return "Muscle Gain";
  return String(g).replace(/_/g, " ");
}
function goalColor(g) {
  if (!g) return R.tm;
  const l = String(g).toLowerCase();
  if (l.includes("fat")) return "#e48326";
  if (l.includes("loss")) return R.red;
  if (l.includes("gain") || l.includes("muscle")) return R.green;
  return R.blue;
}

// ── Self-test detection (mirrors isSelfTest in super-admin/analytics/page.jsx) ──
// A trainer/admin who takes readings on their own device shows up in the API as
// one of their own "clients". Names/emails arrive masked (e.g. "Ch******e"), so
// match on the visible characters: first two + last of each part.
function isMaskedMatch(m, r) {
  if (!m || !r) return false;
  const mp = m.toLowerCase().split("@"), rp = r.toLowerCase().split("@");
  if (mp.length !== 2 || rp.length !== 2 || mp[1] !== rp[1]) return false;
  if (mp[0].length < 2 || rp[0].length < 2) return false;
  return mp[0][0] === rp[0][0] && mp[0][1] === rp[0][1] && mp[0].slice(-1) === rp[0].slice(-1);
}
function isMaskedNameMatch(m, r) {
  if (!m || !r) return false;
  const mw = m.toLowerCase().trim().split(/\s+/), rw = r.toLowerCase().trim().split(/\s+/);
  if (!mw.length || mw.length !== rw.length) return false;
  return mw.every((w, i) => w.length >= 2 && rw[i].length >= 2 && w[0] === rw[i][0] && w[1] === rw[i][1] && w.slice(-1) === rw[i].slice(-1));
}
// True when `c` is the trainer's own self-reading profile rather than a real client.
function isTrainerSelfProfile(c, ident) {
  if (!c) return false;
  if (ident.selfProfileId && c.profile_id && String(c.profile_id) === String(ident.selfProfileId)) return true;
  const ce = (c.email || "").toLowerCase().trim(), te = (ident.email || "").toLowerCase().trim();
  if (ce && te && (ce === te || isMaskedMatch(ce, te))) return true;
  const cn = (c.name || "").trim(), tn = (ident.name || "").trim();
  if (cn && tn && (cn.toLowerCase() === tn.toLowerCase() || isMaskedNameMatch(cn, tn))) return true;
  return false;
}

const th = { fontWeight: 600, padding: "10px 12px", fontSize: "10px", color: R.tm, letterSpacing: "0.3px", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", backgroundColor: "#F8FAFC", borderBottom: `1px solid ${R.border}`, position: "sticky", top: 0, zIndex: 1 };
const td = { padding: "10px 12px", fontSize: "12px", color: R.ts, borderBottom: `1px solid ${R.surface}`, whiteSpace: "nowrap" };
const num = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: "110px", padding: "10px 14px", borderRadius: "10px", border: `1px solid ${R.border}`, backgroundColor: "#ffffff" }}>
      <div style={{ fontSize: "10px", color: R.tm, textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: color || R.tp, lineHeight: 1.2, marginTop: "2px" }}>{value ?? 0}</div>
    </div>
  );
}

// clientHref(client, partnerCode) → URL opened when a client name is clicked.
// Defaults to the super-admin profile route; the trainer-admin analytics page
// passes the /trainer/clients-profile route instead.
export default function TrainerClientsModal({ open, trainer, onClose, clientHref }) {
  const router = useRouter();
  const trainerId = trainer?.partner_code || trainer?.dietician_id || "";

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [entry, setEntry] = useState({ trainer: null, summary: null, pagination: null, clients: [] });
  const reqRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Fresh state each time the modal opens for a (possibly different) trainer.
  useEffect(() => {
    if (!open) return;
    setPage(1); setQ(""); setDebouncedQ(""); setError(null);
    setEntry({ trainer: null, summary: null, pagination: null, clients: [] });
  }, [open, trainerId]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // ESC closes; lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const load = useCallback(async () => {
    if (!open || !trainerId) return;
    const id = ++reqRef.current;
    setLoading(true); setError(null);
    try {
      const res = await fetchTrainerClientsOverviewForSuperAdminService({ trainerId, page, limit: PAGE_LIMIT, search: debouncedQ });
      if (id !== reqRef.current) return; // a newer request superseded this one
      setEntry({
        trainer: res?.trainer || null,
        summary: res?.summary || null,
        pagination: res?.pagination || { page, limit: PAGE_LIMIT, total: 0, has_more: false },
        clients: Array.isArray(res?.data) ? res.data : [],
      });
    } catch (err) {
      if (id !== reqRef.current) return;
      const msg = err?.message || "Failed to load clients";
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [open, trainerId, page, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  const { pagination, summary, clients: rawClients } = entry;

  // Drop the trainer's own self-test profile (e.g. an admin like Evan who takes
  // readings on their own device appears in the API as their own client). The
  // identity comes from the API's trainer block first, then the analytics row.
  const ident = {
    selfProfileId: trainer?.self_reading_profile_id || trainer?.selfProfileId || null,
    email: entry.trainer?.email || trainer?.email || "",
    name: entry.trainer?.name || trainer?.name || "",
  };
  const clients = useMemo(() => rawClients.filter((c) => !isTrainerSelfProfile(c, ident)), [rawClients, ident.selfProfileId, ident.email, ident.name]);
  const hiddenSelf = rawClients.length - clients.length;
  const adjTotal = Math.max(0, (pagination?.total ?? 0) - hiddenSelf);
  const adjTotalClients = summary?.total_clients != null ? Math.max(0, summary.total_clients - hiddenSelf) : adjTotal;

  const totalPages = useMemo(() => {
    if (!pagination?.total) return 1;
    return Math.max(1, Math.ceil(pagination.total / (pagination.limit || PAGE_LIMIT)));
  }, [pagination]);
  const from = adjTotal ? (pagination.offset ?? ((pagination.page || page) - 1) * (pagination.limit || PAGE_LIMIT)) + 1 : 0;
  const to = adjTotal ? Math.min(from - 1 + clients.length, adjTotal) : 0;

  const openClient = (c) => {
    if (!c?.profile_id) return;
    const code = c.partner_code || entry.trainer?.partner_code || trainerId;
    let href;
    if (typeof clientHref === "function") {
      href = clientHref(c, code);
    } else {
      const params = new URLSearchParams({ profile_id: c.profile_id });
      if (code) params.set("partner_code", code);
      href = `/superadmin-trainer/clients-profile?${params.toString()}`;
    }
    if (!href) return;
    onClose?.();
    router.push(href);
  };

  if (!open || !mounted) return null;

  const headerName = entry.trainer?.name || trainer?.name || trainerId || "Trainer";

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div role="dialog" aria-modal="true" aria-label={`Clients of ${headerName}`}
        style={{ width: "min(1100px, 100%)", maxHeight: "min(88vh, 900px)", display: "flex", flexDirection: "column", backgroundColor: "#ffffff", borderRadius: "16px", border: `1px solid ${R.border}`, boxShadow: "0 24px 64px rgba(15,23,42,0.25)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", padding: "18px 22px", borderBottom: `1px solid ${R.border}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: R.tp, letterSpacing: "-0.36px", margin: 0 }}>{headerName}</h2>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#ffffff", backgroundColor: R.green, borderRadius: "999px", padding: "3px 9px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                {entry.trainer?.display_role || "Trainer"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "4px", fontSize: "12px", color: R.ts }}>
              {(entry.trainer?.email || trainer?.email) && <span>{entry.trainer?.email || trainer?.email}</span>}
              {trainerId && <span>Code: <span style={{ fontFamily: "monospace", color: R.tp }}>{trainerId}</span></span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer"
            style={{ flexShrink: 0, width: "32px", height: "32px", borderRadius: "999px", border: `1px solid ${R.border}`, background: "#ffffff", color: R.ts, fontSize: "16px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            ×
          </button>
        </div>

        {/* Summary + search */}
        <div style={{ padding: "14px 22px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#FBFCFD", borderBottom: `1px solid ${R.border}` }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Stat label="Total clients" value={adjTotalClients} />
            <Stat label="Tested" value={summary?.tested_clients} color={R.green} />
            <Stat label="Missed" value={summary?.missed_clients} color={R.red} />
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients by name, email or profile ID"
            style={{ width: "100%", borderRadius: "10px", border: `1px solid ${R.border}`, backgroundColor: "#ffffff", padding: "8px 12px", fontSize: "12px", color: R.tp, outline: "none" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = R.blue)} onBlur={(e) => (e.currentTarget.style.borderColor = R.border)} />
        </div>

        {/* Table */}
        <div style={{ flex: 1, minHeight: "200px", overflow: "auto" }}>
          {!trainerId ? (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: R.tm }}>This row has no partner code, so its clients cannot be looked up.</div>
          ) : loading && clients.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: R.tm }}>Loading clients…</div>
          ) : error && clients.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: R.red }}>
              {error}
              <div><button type="button" onClick={load} className="cursor-pointer" style={{ marginTop: "10px", border: "none", background: R.blueLight, color: R.blue, fontSize: "11px", fontWeight: 600, borderRadius: "6px", padding: "5px 12px" }}>Retry</button></div>
            </div>
          ) : clients.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: R.tm }}>
              {debouncedQ ? `No clients match “${debouncedQ}”` : "No clients found for this trainer."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Profile ID</th>
                  <th style={th}>Goal</th>
                  <th style={{ ...th, textAlign: "right" }}>Score</th>
                  <th style={{ ...th, textAlign: "right" }}>Acetone (ppm)</th>
                  <th style={{ ...th, textAlign: "right" }}>Ethanol (ppm)</th>
                  <th style={{ ...th, textAlign: "right" }}>H2 (ppm)</th>
                  <th style={th}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.profile_id || i}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${R.blueLight}60`)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <td style={{ ...td, color: R.tp, fontWeight: 600 }}>
                      {c.profile_id
                        ? <button type="button" onClick={() => openClient(c)} className="cursor-pointer hover:underline text-[#252525] hover:text-[#308BF9] transition-colors" style={{ border: "none", background: "transparent", padding: 0, font: "inherit", fontWeight: 600 }}>{c.name || "—"}</button>
                        : (c.name || "—")}
                    </td>
                    <td style={td}>{c.email || "—"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{c.profile_id || "—"}</td>
                    <td style={td}>
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", color: goalColor(c.fitness_goal), backgroundColor: goalColor(c.fitness_goal) + "15" }}>{goalLabel(c.fitness_goal)}</span>
                    </td>
                    <td style={num}>{c.metabolism_score != null ? <span style={{ color: R.tp, fontWeight: 600 }}>{Math.round(c.metabolism_score)}</span> : <span style={{ color: R.td }}>—</span>}</td>
                    <td style={num}>{c.biomarkers?.acetone_ppm ?? "—"}</td>
                    <td style={num}>{c.biomarkers?.ethanol_ppm ?? "—"}</td>
                    <td style={num}>{c.biomarkers?.h2_ppm ?? "—"}</td>
                    <td style={{ ...td, color: R.td }}>{c.last_active || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / pager */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "12px 22px", borderTop: `1px solid ${R.border}`, backgroundColor: "#ffffff" }}>
          <div style={{ fontSize: "11px", color: R.tm }}>
            {adjTotal > 0
              ? <>Showing <strong style={{ color: R.tp }}>{from}–{to}</strong> of <strong style={{ color: R.tp }}>{adjTotal}</strong>{hiddenSelf > 0 && <span style={{ marginLeft: "8px", color: R.td }}>· trainer&apos;s own profile hidden</span>}</>
              : <span>&nbsp;</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="cursor-pointer disabled:opacity-40 disabled:cursor-default"
              style={{ borderRadius: "999px", border: `1px solid ${R.border}`, background: "#ffffff", color: R.ts, fontSize: "11px", fontWeight: 600, padding: "5px 12px" }}>Prev</button>
            <span style={{ fontSize: "11px", color: R.ts }}>Page {pagination?.page || page} of {totalPages}</span>
            <button type="button" disabled={!pagination?.has_more || loading} onClick={() => setPage((p) => p + 1)} className="cursor-pointer disabled:opacity-40 disabled:cursor-default"
              style={{ borderRadius: "999px", border: `1px solid ${R.border}`, background: "#ffffff", color: R.ts, fontSize: "11px", fontWeight: 600, padding: "5px 12px" }}>Next</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
