"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { getAdminGroups, selectAdminGroups, selectAdminGroupsRaw, selectPrimaryGroupName } from "@/store/adminGroupsSlice";
import { getGroupDetails, selectGroupDetails, selectGroupDetailsLoading, selectGroupCounts } from "@/store/groupDetailsSlice";
import { fetchGroupPeriodOverviewService } from "@/services/authService";
import TrainerClientsModal from "@/components/super-admin/TrainerClientsModal";

const TIMEZONES = { "America/Chicago": "Houston, TX", "Asia/Kolkata": "India (IST)" };
const DEFAULT_TZ = "America/Chicago";
const ACTIVE_THRESHOLD = 60;
const ELITE_THRESHOLD = 90;
const EXECUTIVE_TAS = ["Derek", "Evan"];
const BLUE = "#308BF9";
const R = {
  dark: "#252525", blue: "#308bf9", blueLight: "#e9f3ff",
  green: "#3faf58", greenLight: "#eaffef", red: "#e74c3c", orange: "#e48326", amber: "#ffbf2d",
  tp: "#252525", ts: "#535359", tm: "#738298", td: "#a1a1a1",
  border: "#e1e6ed", surface: "#f5f7fa", white: "#ffffff",
  rCard: "15px", rBadge: "6px", rPill: "33px",
  shadow: "0 20px 60px rgba(37,37,37,0.08), 0 6px 16px rgba(37,37,37,0.04), 0 1px 3px rgba(37,37,37,0.03)",
};

function tzNow(tz) { return new Date(new Date().toLocaleString("en-US", { timeZone: tz })); }
function tzTime(tz) { return new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }); }
function tzDay(tz) { return new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }); }
function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
// Local-date parts → "YYYY-MM-DD" (no UTC shift), for the API's overview_date param.
function toYMD(d) { if (!d) return ""; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtRange(r) { if (!r) return ""; return `${fmtDate(r.start)} – ${fmtDate(r.end)}`; }
function daysBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.max(0, Math.round((new Date(da.getFullYear(), da.getMonth(), da.getDate()) - new Date(db.getFullYear(), db.getMonth(), db.getDate())) / -86400000));
}

const COHORTS = [90, 70, 50, 25, 10];
function getCohort(pct) { for (const t of COHORTS) if (pct >= t) return `${t}%+`; return "<10%"; }
function goalColor(g) { if (!g) return R.tm; const l = g.toLowerCase(); if (l.includes("fat")) return R.orange; if (l.includes("loss")) return R.red; if (l.includes("gain") || l.includes("muscle")) return R.green; return R.blue; }
function goalLabel(g) { if (!g) return "—"; const l = g.toLowerCase(); if (l.includes("fat")) return "Fat Loss"; if (l.includes("weight")) return "Weight Loss"; if (l.includes("muscle") || l.includes("gain")) return "Muscle Gain"; return g; }

// Rows per page for the Trainer Adoption / Client Engagement tables.
const TRAINER_PAGE_SIZE = 6;
const CLIENT_PAGE_SIZE = 6;
// Case-insensitive "contains" across a row's searchable fields. Client names and
// emails arrive masked from the API (e.g. "Ch******e"), so a search matches
// whatever characters the mask leaves visible.
function rowMatches(fields, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some(f => f != null && String(f).toLowerCase().includes(needle));
}
const trainerSearchFields = t => [t.name, t.partner_code, t.dietician_id, t.email, t.taName];
const clientSearchFields = c => [c.name, c.profile_id, c.email, c.trainerName, c.trainer_name, c.trainer_code, goalLabel(c.fitness_goal), c.dietitian_id];

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
function isSelfTest(client, trainers) {
  const ce = (client.email || "").toLowerCase().trim(), cn = (client.name || "").trim();
  return trainers.some(t => { const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
}

function getPeriodRange(p, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "today") return { start: today, end: today };
  if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); return { start: m, end: today }; }
  if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  return null;
}
function getPrevRange(p, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "today") { const y = new Date(today); y.setDate(y.getDate() - 1); return { start: y, end: y }; }
  if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); const ps = new Date(m); ps.setDate(m.getDate() - 1); const pm = new Date(ps); pm.setDate(ps.getDate() - 6); return { start: pm, end: ps }; }
  if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 0) };
  return null;
}
function inRange(ds, r) { if (!r) return true; if (!ds) return false; const d = new Date(ds); if (isNaN(d)) return false; const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return day >= r.start && day <= r.end; }
// Every calendar day in an inclusive {start,end} range, as Date objects. Used to
// fan out one period_overview call per day (the API only scopes a single day).
function daysInRange(r) { if (!r) return []; const out = []; const d = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate()); const end = new Date(r.end.getFullYear(), r.end.getMonth(), r.end.getDate()); let guard = 0; while (d <= end && guard < 366) { out.push(new Date(d)); d.setDate(d.getDate() + 1); guard++; } return out; }
function prevLbl(p, now) { if (p === "custom") return "prev day"; if (p === "today") return "yesterday"; if (p === "week") return "last week"; if (p === "month") return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", { month: "short" }); return null; }

function periodMetrics(clients, trainers, rdm, range) {
  const nT = !range ? trainers.length : trainers.filter(t => inRange(t.created_at, range)).length;
  const nC = !range ? clients.length : clients.filter(c => inRange(c.onboardedDate, range)).length;
  // A trainer's own device readings live on their self-reading profile. That
  // profile can ALSO surface as a client row (a self-test returned in clients[]),
  // so we attribute those reads to the trainer bucket and skip them in the client
  // loop below — the read is counted exactly once.
  const trainerSelfPids = new Set((trainers || []).map(t => t.selfProfileId).filter(Boolean));
  const countIn = pid => { const d = rdm[pid] || []; return !range ? d.length : d.filter(x => inRange(x.date, range)).length; };
  let clientReads = 0, readers = 0;
  clients.forEach(c => {
    if (trainerSelfPids.has(c.profile_id)) return; // counted as a trainer read
    const n = countIn(c.profile_id);
    clientReads += n; if (n > 0) readers++;
  });
  let trainerReads = 0;
  trainerSelfPids.forEach(pid => { trainerReads += countIn(pid); });
  const reads = clientReads + trainerReads;
  return { newTrainers: nT, newClients: nC, reads, clientReads, trainerReads, readers, adoption: clients.length > 0 ? Math.round((readers / clients.length) * 100) : 0 };
}

function pctChange(cur, prev) {
  if (prev === 0 && cur === 0) return { val: 0, label: "0%" };
  if (prev === 0) return { val: 100, label: "100%" };
  const v = Math.round(((cur - prev) / prev) * 100);
  return { val: v, label: `${Math.abs(v)}%` };
}

/* ══════════════════════════════════════════════════════════════════════
   REAL DATA ADAPTER — get_group_details.php
   Maps the GETGROUPDETAILS response into the shape the dashboard renders from:
     group_members (admins) → Trainer-Admin tabs (taList)
     trainers               → trainers under their parent admin (trainersMap)
     clients                → attributed to a TA via owner code (allClients)
     trainers/clients total_tests → Tests count + reading-rate numerator
     latest_test.date_time  → anchors the "today / this period" reads
   The API gives test COUNTS (total_tests) but not per-test DATES, so count- and
   rate-based metrics are exact while period/"today" reads use the latest test only.
   ══════════════════════════════════════════════════════════════════════ */
function buildFromGroupDetails(gd, now = new Date()) {
  const taList = [];
  const trainersMap = {};
  const allClients = [];
  const readingDatesMap = {};

  const members = Array.isArray(gd?.group_members) ? gd.group_members : [];
  const trainers = Array.isArray(gd?.trainers) ? gd.trainers : [];
  const clients = Array.isArray(gd?.clients) ? gd.clients : [];

  // Group members flagged "admin" become the Trainer-Admin tabs. If none are
  // flagged, treat every member as an admin so the dashboard still populates.
  const admins = members.filter(m => (m.role || "").toLowerCase() === "admin");
  const taMembers = admins.length ? admins : members;

  // Group members (admins) are NEVER clients. Any client profile whose email
  // matches a group member's email is the admin themselves, not a real client,
  // and must be excluded from all client lists/counts.
  const memberEmails = new Set(members.map(m => (m.email || "").toLowerCase().trim()).filter(Boolean));
  // Email → member, so an admin's own self-test profile (a client row matching
  // their email) can be attributed back to that admin's dietician code.
  const memberByEmail = new Map(members.filter(m => m.email).map(m => [(m.email || "").toLowerCase().trim(), m]));

  // Admins are ALSO returned inside `trainers[]` (role: "admin", null parent) and
  // are counted in `counts.trainers`. They ARE their group's Trainer-Admin tabs,
  // but an admin can personally coach clients and take readings, so we now also
  // surface them as trainer rows in the Trainer Adoption list (see adminEntry
  // below). Nothing is dropped from the trainer total — counts.trainers already
  // includes them, and each admin appears exactly once as a trainer row.
  const excludedTrainerAdminCount = 0;

  taMembers.forEach(m => {
    const uid = m.dietician_id || m.email;
    taList.push({
      user_id: uid,
      name: m.name && m.name !== "NA" ? m.name : (m.email || "—"),
      email: m.email || "",
      partner_code: m.dietician_id || "",
      created_at: m.created_at || null, // admin join date (added to group_members by the backend)
    });

    // Trainers whose parent admin is this member.
    const myTrainers = trainers
      .filter(t => (t.parent_admin_email || "").toLowerCase() === (m.email || "").toLowerCase())
      .map(t => ({
        user_id: t.partner_code,
        name: t.name && t.name !== "NA" ? t.name : (t.email || "—"),
        email: t.email || "",
        partner_code: t.partner_code || "",
        dietician_id: t.partner_code || "",
        created_at: t.created_at || null,
        total_tests: typeof t.total_tests === "number" ? t.total_tests : null,
        total_clients: typeof t.total_clients === "number" ? t.total_clients : null,
        total_tested_clients: typeof t.total_tested_clients === "number" ? t.total_tested_clients : null,
        // The trainer's OWN device tests (self-readings), straight from the backend.
        self_reading_tests: typeof t.self_reading?.total_tests === "number" ? t.self_reading.total_tests : null,
        // The backend-authoritative profile_id of the trainer's own self-reading (null
        // if they have none). This — NOT a name/email guess — is the only profile that
        // may be excluded from the cohort as a trainer self-test.
        self_reading_profile_id: t.self_reading?.profile_id || null,
        is_self: false,
      }));

    // The admin themselves, surfaced as a trainer row (is_self:false → shown in the
    // Trainer Adoption list) so admins like Derek/Evan appear alongside their team,
    // with their OWN totals (clients coached, tests taken, tested clients). Their
    // dietician code stays in the code set, so admin-owned clients still attribute
    // to this TA. Blank email → no client is mis-detected as the admin's self-test
    // (admin self-test profiles are already excluded upstream and tracked in
    // adminSelfByCode). is_admin flags the row for any admin-specific presentation.
    const adminEntry = {
      user_id: `admin_${uid}`,
      name: m.name && m.name !== "NA" ? m.name : (m.email || "—"),
      email: "",
      partner_code: m.dietician_id || "",
      dietician_id: m.dietician_id || "",
      created_at: m.created_at || null,
      total_tests: typeof m.total_tests === "number" ? m.total_tests : null,
      total_clients: typeof m.total_clients === "number" ? m.total_clients : null,
      total_tested_clients: typeof m.total_tested_clients === "number" ? m.total_tested_clients : null,
      // The admin's OWN device tests (self-readings), straight from the backend.
      self_reading_tests: typeof m.self_reading?.total_tests === "number" ? m.self_reading.total_tests : null,
      // Backend-authoritative profile_id of the admin's own self-reading (see trainer note).
      self_reading_profile_id: m.self_reading?.profile_id || null,
      is_self: false,
      is_admin: true,
    };

    trainersMap[uid] = { trainers: [...myTrainers, adminEntry] };
  });

  let excludedAdminCount = 0;
  // An admin's own device tests: a client row whose email matches a member is the
  // admin self-testing. Keep it out of the client lists (admins are never clients)
  // but record the activity so the cohort can show the admin as a trainer when
  // they've personally taken readings. Keyed by the admin's dietician code.
  const adminSelfByCode = {};
  clients.forEach(c => {
    const pid = c.profile_id;
    if (!pid) return;
    const cEmail = (c.email || "").toLowerCase().trim();
    // Skip admins — a client profile that matches a group member's email is the
    // admin, not a client — but capture their own test activity first.
    if (memberEmails.has(cEmail)) {
      excludedAdminCount++;
      const code = (memberByEmail.get(cEmail)?.dietician_id || "").toUpperCase();
      if (code) {
        const prev = adminSelfByCode[code] || { total_tests: 0, joined: null, latest: null };
        const joined = c.joined_dttm || c.created_at || null;
        adminSelfByCode[code] = {
          total_tests: prev.total_tests + (typeof c.total_tests === "number" ? c.total_tests : 0),
          joined: prev.joined && joined ? (new Date(prev.joined) <= new Date(joined) ? prev.joined : joined) : (prev.joined || joined),
          latest: c.latest_test?.date_time || prev.latest,
        };
      }
      return;
    }
    allClients.push({
      profile_id: pid,
      name: c.profile_name || "—",
      email: c.email || "",
      dietitian_id: c.dietician_id || c.owner?.partner_code || "",
      fitness_goal: c.fitness_goal || "",
      total_tests: typeof c.total_tests === "number" ? c.total_tests : null,
      // Latest test's metabolism score (0–100) from get_group_details — the most
      // recent reading's result, distinct from the reading-frequency Rate %.
      metabolism_score: typeof c.latest_test?.metabolism_score === "number" ? c.latest_test.metabolism_score : null,
      associated_dietitian: { name: c.owner?.name || "—" },
      // Assigned trainer straight from the backend (client.trainer). When no
      // trainer is assigned (trainer.partner_code / name are null) the client is
      // coached directly by the owning admin, so fall back to client.owner.
      trainer_code: c.trainer?.partner_code || c.owner?.partner_code || "",
      trainer_name: (c.trainer?.name && c.trainer.name !== "NA") ? c.trainer.name
        : (c.owner?.name && c.owner.name !== "NA") ? c.owner.name : "",
      client: { joined_dttm: c.joined_dttm || c.created_at || null },
      test_history: { last_test_date_time: c.latest_test?.date_time || null },
    });
    // Per-test dates aren't in the response; the latest test anchors period/"today" reads.
    readingDatesMap[pid] = c.latest_test?.date_time ? [{ date: c.latest_test.date_time }] : [];
  });

  // Seed the reading-dates map with each trainer's / admin's OWN self-reading
  // (its latest_test date, keyed by the self-reading profile id) so period/day
  // read totals include trainer device usage, not just clients. Skip profiles
  // already present — a self-test that also came back as a client row keeps its
  // client entry (same date), so no read is counted twice.
  const seedSelf = (sr) => {
    const spid = sr?.profile_id, dt = sr?.latest_test?.date_time;
    if (!spid || !dt || readingDatesMap[spid]) return;
    readingDatesMap[spid] = [{ date: dt }];
  };
  trainers.forEach(t => seedSelf(t.self_reading));
  members.forEach(m => seedSelf(m.self_reading));

  return { taList, trainersMap, allClients, readingDatesMap, excludedAdminCount, excludedTrainerAdminCount, adminSelfByCode };
}

const ICO_COLORS = { people: R.blue, person: R.green, "person-add": R.orange, trend: "#7c3aed" };
function Ico({ type, color }) {
  const c = color || ICO_COLORS[type] || R.blue;
  return (
    <div className="w-10 h-10 flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110" style={{ background: `linear-gradient(135deg, ${c}18, ${c}08)`, borderRadius: R.rCard, border: `1px solid ${c}15` }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {type === "person" && <><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a7 7 0 0114 0v1" /></>}
        {type === "people" && <><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-1a5 5 0 0110 0v1" /><circle cx="18" cy="9" r="3" /><path d="M22 21v-1a4 4 0 00-3-3.87" /></>}
        {type === "person-add" && <><circle cx="10" cy="7" r="3.5" /><path d="M3 21v-1a5 5 0 0110 0" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></>}
        {type === "trend" && <><polyline points="22 12 18 8 14 12 10 8 2 16" /></>}
      </svg>
    </div>
  );
}

function Sparkline({ data, width = 80, height = 28, color = R.blue, filled = true }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - 2 - ((v - min) / range) * (height - 4),
  ]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {filled && <path d={area} fill={`${color}15`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}

function Donut({ pct, size = 120, thickness = 10, color = R.blue, label, bg, track, textColor }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimPct(pct), 50); return () => clearTimeout(t); }, [pct]);
  const innerBg = bg || R.white;
  const trackColor = track || R.surface;
  const ringBorder = bg ? "none" : `0 0 0 3px ${R.white}, 0 0 0 4px ${R.border}`;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="rounded-full flex items-center justify-center" style={{ width: size, height: size, background: `conic-gradient(${color} 0% ${animPct}%, ${trackColor} ${animPct}% 100%)`, transition: "background 0.8s ease-out", boxShadow: ringBorder }}>
        <div className="rounded-full flex items-center justify-center" style={{ width: size - thickness * 2, height: size - thickness * 2, backgroundColor: innerBg }}>
          <span className="font-extrabold" style={{ fontSize: size * 0.25, color: textColor || R.tp, letterSpacing: "-0.4px" }}>{animPct}%</span>
        </div>
      </div>
      {label && <span style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{label}</span>}
    </div>
  );
}

/* Compact search input used by the Trainer Adoption / Client Engagement tables.
   Filtering is client-side over the fully-loaded group data (every clients/trainers
   page is merged in groupDetailsSlice), so a search never re-queries the API and
   never narrows the data the dashboard's totals are derived from. */
function SearchBox({ value, onChange, placeholder }) {
  const [focus, setFocus] = useState(false);
  return (
    <div className="flex items-center gap-2" style={{
      flex: 1, minWidth: 0, backgroundColor: focus ? "#ffffff" : "#F8FAFC",
      border: `1px solid ${focus ? R.blue + "55" : "#EEF2F6"}`, borderRadius: "8px",
      padding: "6px 10px", transition: "all 0.2s ease",
      boxShadow: focus ? `0 0 0 3px ${R.blue}12` : "none",
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={focus ? R.blue : R.tm} strokeWidth="2.2" strokeLinecap="round" className="shrink-0">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: "12px", color: R.tp, letterSpacing: "-0.24px", fontFamily: "inherit" }}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} title="Clear search"
          className="flex items-center justify-center cursor-pointer shrink-0"
          style={{ width: 16, height: 16, borderRadius: "50%", border: "none", backgroundColor: "#E2E8F0", color: R.ts, fontSize: "11px", lineHeight: 1, padding: 0 }}>
          ×
        </button>
      )}
    </div>
  );
}

/* Page bar rendered under a paginated AccTable. Pages are numbered with an
   ellipsis window so long trainer/client lists stay on one line. */
function Pager({ page, totalPages, total, from, to, onPage }) {
  if (totalPages <= 1) return (
    <div className="flex items-center justify-end pt-2" style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px" }}>
      {total} {total === 1 ? "row" : "rows"}
    </div>
  );
  const nums = [];
  const push = n => { if (!nums.includes(n)) nums.push(n); };
  push(1);
  for (let n = page - 1; n <= page + 1; n++) if (n > 1 && n < totalPages) push(n);
  push(totalPages);
  nums.sort((a, b) => a - b);

  const btn = (disabled, active) => ({
    minWidth: "22px", height: "22px", padding: "0 5px", borderRadius: "6px",
    border: `1px solid ${active ? R.blue : "#EEF2F6"}`,
    backgroundColor: active ? R.blue : "#ffffff",
    color: active ? "#ffffff" : disabled ? R.td : R.ts,
    fontSize: "10px", fontWeight: active ? 700 : 500, letterSpacing: "-0.2px",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease",
  });

  return (
    <div className="flex items-center justify-between gap-2 pt-2" style={{ flexShrink: 0 }}>
      <span style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px", whiteSpace: "nowrap" }}>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)} style={btn(page === 1, false)} title="Previous page">‹</button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span style={{ fontSize: "10px", color: R.td }}>…</span>}
            <button type="button" onClick={() => onPage(n)} style={btn(false, n === page)}>{n}</button>
          </span>
        ))}
        <button type="button" disabled={page === totalPages} onClick={() => onPage(page + 1)} style={btn(page === totalPages, false)} title="Next page">›</button>
      </div>
    </div>
  );
}

// pageSize > 0 turns on pagination: rows are sorted in FULL, then sliced, so the
// sort order is global rather than per-page. resetKey (tab + search term) sends the
// table back to page 1 whenever the underlying row set changes.
function AccTable({ rows, cols, rowStyle, pageSize = 0, resetKey }) {
  const [sort, setSort] = useState({ key: null, asc: true });
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);
  const sorted = sort.key ? [...rows].sort((a, b) => {
    const av = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(a) : a[sort.key];
    const bv = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(b) : b[sort.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sort.asc ? cmp : -cmp;
  }) : rows;
  const toggle = (key) => { setSort(s => s.key === key ? { key, asc: !s.asc } : { key, asc: true }); setPage(1); };
  const arrow = (key) => sort.key !== key ? "↕" : sort.asc ? "↑" : "↓";
  const thBase = { fontWeight: 500, padding: "8px 0", fontSize: "10px", color: R.tm, letterSpacing: "-0.2px", borderBottom: `1px solid ${R.border}` };

  const total = sorted.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const curPage = Math.min(page, totalPages);
  const visible = pageSize > 0 ? sorted.slice((curPage - 1) * pageSize, curPage * pageSize) : sorted;

  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: "12px", letterSpacing: "-0.24px", flex: 1, minHeight: 0 }}>
      <div className="uppercase" style={{ display: "flex", backgroundColor: "#ffffff", position: "relative", zIndex: 2, flexShrink: 0 }}>
        {cols.map(c => (
          <div key={c.key} className="font-semibold cursor-pointer select-none"
            style={{ ...thBase, flex: c.width ? `0 0 ${c.width}` : 1, textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" }}
            onClick={() => toggle(c.key)}>
            {c.label} {c.label ? <span style={{ fontSize: "9px" }}>{arrow(c.key)}</span> : null}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {visible.map((r, i) => (
          <div key={i} className="transition-colors duration-150" style={{ display: "flex", borderBottom: `1px solid ${R.surface}`, backgroundColor: i % 2 === 1 ? `${R.surface}80` : "transparent", cursor: "default", ...(rowStyle ? rowStyle(r) : {}) }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = `${R.blueLight}60`}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 1 ? `${R.surface}80` : "transparent"}>
            {cols.map(c => (
              <div key={c.key} style={{ flex: c.width ? `0 0 ${c.width}` : 1, padding: "8px 0", textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left", color: c.className?.includes("text-muted") || c.className?.includes("text-secondary") ? R.ts : R.tp }}>
                {c.render ? c.render(r) : (typeof c.val === "function" ? c.val(r) : r[c.key])}
              </div>
            ))}
          </div>
        ))}
      </div>
      {pageSize > 0 && total > 0 && (
        <Pager page={curPage} totalPages={totalPages} total={total}
          from={(curPage - 1) * pageSize + 1} to={Math.min(curPage * pageSize, total)}
          onPage={setPage} />
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const dispatch = useDispatch();
  const router = useRouter();
  // MANAGEADMINGROUPS response — captured at login into Redux (setAdminGroups),
  // re-fetched here if the in-memory store was reset (e.g. hard refresh).
  const adminGroups = useSelector(selectAdminGroups);
  const adminGroupsRaw = useSelector(selectAdminGroupsRaw);
  // group_name for get_group_details comes from the MANAGEADMINGROUPS response.
  const primaryGroupName = useSelector(selectPrimaryGroupName);
  const groupDetails = useSelector(selectGroupDetails);
  const groupDetailsLoading = useSelector(selectGroupDetailsLoading);
  // Authoritative group totals { members, trainers, clients } from the response.
  const groupCounts = useSelector(selectGroupCounts);
  // Reading counts for the selected period, summed from the API's per-day
  // period_overview. The backend scopes period_overview to a single overview_date,
  // so W/M totals are built by fanning out one call per day in the range.
  const [periodReads, setPeriodReads] = useState({ total: 0, trainer: 0, client: 0, loading: false, scope: null });
  const [readsNonce, setReadsNonce] = useState(0);

  // Entire GETGROUPDETAILS response stored on this page (all client pages merged).
  const [groupDetailsResponse, setGroupDetailsResponse] = useState(null);

  const [taList, setTaList] = useState([]);
  const [trainersMap, setTrainersMap] = useState({});
  const [allClients, setAllClients] = useState([]);
  const [readingDatesMap, setReadingDatesMap] = useState({});
  // Clients dropped because their email matched a group member (admin). Subtracted
  // from the backend's authoritative client count so admins are never counted.
  const [excludedAdminCount, setExcludedAdminCount] = useState(0);
  // Admins are returned inside trainers[] and counted in counts.trainers, but are
  // shown as Trainer-Admin tabs, not trainer rows — subtract them from the total.
  const [excludedTrainerAdminCount, setExcludedTrainerAdminCount] = useState(0);
  // Admin (group-member) code → their own self-test activity ({ total_tests, joined }).
  const [adminSelfByCode, setAdminSelfByCode] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState("Connecting...");
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [tabDdOpen, setTabDdOpen] = useState(false);
  const tabDdRef = useRef(null);
  const [period, setPeriod] = useState("today");
  // A specific calendar day picked from the world-clock calendar. When set (and
  // period === "custom") the Period Overview filters every metric to just that day.
  const [selectedDate, setSelectedDate] = useState(null);
  const compare = true;
  const [timezone, setTimezone] = useState(DEFAULT_TZ);
  const [clock, setClock] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => 0);
  const calRef = useRef(null);
  const [openAcc, setOpenAcc] = useState(new Set());
  const [trainerTab, setTrainerTab] = useState("all");
  // Table search terms. Both filter client-side over the fully-loaded group data,
  // so the dashboard's totals/cohorts (derived from the unfiltered set) are untouched.
  const [trainerSearch, setTrainerSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [cohortTab, setCohortTab] = useState(0);
  const [cohortSubTab, setCohortSubTab] = useState("trainers");
  // Trainer rows temporarily excluded via the Trainer Adoption checkboxes. A
  // checked trainer — and every client under their dietician code — is removed
  // from ALL derived numbers (Client Engagement, cohorts, snapshots, adoption)
  // until unchecked. Purely client-side and session-scoped; nothing is deleted.
  const [excludedTrainerIds, setExcludedTrainerIds] = useState(new Set());
  // Stable per-row key: trainer user_id (admins are "admin_<uid>"), falling back
  // to partner_code/email for safety.
  const trKey = (t) => t.user_id || t.partner_code || t.email || t.name;
  // Trainer whose client list is open in the Trainer Adoption pop-up (null = closed).
  const [clientsModalTrainer, setClientsModalTrainer] = useState(null);
  const toggleTrainerExcluded = (id) => setExcludedTrainerIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [timezone]);

  useEffect(() => {
    const handler = (e) => { if (tabDdRef.current && !tabDdRef.current.contains(e.target)) setTabDdOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close the world-clock calendar on outside click / Escape.
  useEffect(() => {
    if (!calOpen) return;
    const onDown = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setCalOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setCalOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [calOpen]);

  // Tick every second so the live times inside the open calendar stay current.
  useEffect(() => {
    if (!calOpen) return;
    const id = setInterval(() => setNowTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [calOpen]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const now = new Date();
      let source;
      if (groupDetails) {
        // Real data from get_group_details.php.
        source = buildFromGroupDetails(groupDetails, now);
      } else if (primaryGroupName) {
        // We know which group to load but its details haven't arrived yet —
        // keep the loader up; this effect re-runs once groupDetails lands.
        setLoading(true);
        return;
      } else {
        // No admin group in context — nothing to show.
        source = { taList: [], trainersMap: {}, allClients: [], readingDatesMap: {}, excludedAdminCount: 0, excludedTrainerAdminCount: 0, adminSelfByCode: {} };
      }
      setTaList(source.taList);
      setTrainersMap(source.trainersMap);
      setAllClients(source.allClients);
      setReadingDatesMap(source.readingDatesMap);
      setExcludedAdminCount(source.excludedAdminCount || 0);
      setExcludedTrainerAdminCount(source.excludedTrainerAdminCount || 0);
      setAdminSelfByCode(source.adminSelfByCode || {});
      setLoading(false);
    } catch (e) {
      setError(e?.message || "Failed to load");
      toast.error(e?.message || "Failed");
      setLoading(false);
    }
  }, [groupDetails, primaryGroupName]);

  useEffect(() => { loadData(); }, [loadData]);

  // If the MANAGEADMINGROUPS payload wasn't handed off from login (e.g. the user
  // hard-refreshed this page and the in-memory Redux store reset), re-fetch it.
  useEffect(() => {
    if (!adminGroupsRaw) dispatch(getAdminGroups());
  }, [adminGroupsRaw, dispatch]);

  // The stored MANAGEADMINGROUPS response is now available to this dashboard via
  // `adminGroups` (response.groups) and `adminGroupsRaw` (full payload).


  // useEffect(() => {
  //   if (adminGroupsRaw) console.log("Admin groups (from Redux):", adminGroupsRaw);
  // }, [adminGroupsRaw]);

  // Once we know the group name (from Redux), pull that group's details. Use a
  // high limit so every client loads in one shot — the dashboard's totals are
  // derived from the loaded set, so partial pages would under-count. This payload
  // (clients/trainers/counts) is all-time, so it does NOT depend on the selected
  // period — the period readings are fetched separately below.
  useEffect(() => {
    if (primaryGroupName) {
      dispatch(getGroupDetails({ groupName: primaryGroupName, page: 1, limit: 50, search: "", fetchAll: true }));
    }
  }, [primaryGroupName, dispatch]);

  // Refresh button: re-fetch the group from the API when we have a group name,
  // otherwise just rebuild from whatever is in state. Bump readsNonce so the
  // period-readings aggregation re-runs too.
  const handleRefresh = useCallback(() => {
    setReadsNonce(n => n + 1);
    if (primaryGroupName) {
      dispatch(getGroupDetails({ groupName: primaryGroupName, page: 1, limit: 50, search: "", fetchAll: true }));
    } else {
      loadData();
    }
  }, [primaryGroupName, dispatch, loadData]);

  useEffect(() => {
    if (groupDetails) {
      // Store the entire GETGROUPDETAILS response in a page-level variable.
      setGroupDetailsResponse(groupDetails);
    }
  }, [groupDetails]);

  // The admin whose readings the Period Overview is scoped to: the selected TA tab's
  // partner_code, or "" on the Overview tab (whole group = all members, the default).
  // Sent to the API as overview_member. Uppercased to match the network_codes casing.
  const overviewMemberCode = useMemo(() => {
    if (activeTab === "overview") return "";
    const m = taList.find(t => t.user_id === activeTab);
    return m?.partner_code ? String(m.partner_code).toUpperCase() : "";
  }, [activeTab, taList]);

  // Period-readings aggregation. period_overview is a single-day snapshot server-side
  // (scoped by overview_date + optional overview_member), so a week/month total is the
  // SUM of each day's snapshot across the period range. Fan out one lightweight call
  // per day and add them up. D/custom = 1 day (1 call); W = Mon→today; M = 1st→today.
  useEffect(() => {
    if (!primaryGroupName) { setPeriodReads({ total: 0, trainer: 0, client: 0, loading: false, scope: null }); return; }
    const tnow = tzNow(timezone);
    const range = period === "custom" && selectedDate
      ? (() => { const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()); return { start: d, end: d }; })()
      : (getPeriodRange(period, tnow) || getPeriodRange("today", tnow));
    const days = daysInRange(range);
    let cancelled = false;
    setPeriodReads(p => ({ ...p, loading: true }));
    Promise.all(days.map(d => fetchGroupPeriodOverviewService({ groupName: primaryGroupName, overviewDate: toYMD(d), overviewMember: overviewMemberCode }).catch(() => null)))
      .then(results => {
        if (cancelled) return;
        const sum = results.reduce((a, po) => ({
          total: a.total + (po?.total_readings || 0),
          trainer: a.trainer + (po?.trainer_readings || 0),
          client: a.client + (po?.client_readings || 0),
        }), { total: 0, trainer: 0, client: 0 });
        // Scope is identical across the range's days; keep the first non-null one.
        const scope = results.find(po => po?.scope)?.scope || null;
        setPeriodReads({ ...sum, loading: false, scope });
      })
      .catch(() => { if (!cancelled) setPeriodReads(p => ({ ...p, loading: false })); });
    return () => { cancelled = true; };
  }, [primaryGroupName, period, selectedDate, timezone, overviewMemberCode, readsNonce]);

  const now = tzNow(timezone);

  const computeTa = useCallback((ta) => {
    if (!ta) return null;
    const all = (trainersMap[ta.user_id] || { trainers: [] }).trainers;
    const nonSelf = all.filter(t => !t.is_self);
    const codes = new Set(all.map(t => (t.partner_code || t.dietician_id || "").toUpperCase()));
    const taCl = allClients.filter(c => codes.has((c.dietitian_id || c.partner_code || "").toUpperCase()));
    // Show ALL clients owned by this TA's codes — including profiles whose
    // email/name matches a trainer (previously hidden as "self-tests").
    const real = taCl;
    // Still identify self-test profiles so each trainer's own test activity /
    // adoption is computed from their self-profile below.
    const selfT = taCl.filter(c => isSelfTest(c, all));

    const enrich = c => {
      const dates = readingDatesMap[c.profile_id] || [];
      // Prefer the API's authoritative test count; fall back to reading dates (mock).
      const rd = c.total_tests != null ? c.total_tests : dates.length;
      const sorted = dates.map(d => d.date).filter(Boolean).sort();
      const last = sorted.length ? sorted[sorted.length - 1] : null;
      const onb = c.client?.joined_dttm || (sorted.length ? sorted[0] : null);
      const lastT = c.test_history?.last_test_date_time || last;
      const ds = onb ? daysBetween(onb, now) + 1: 0;
      const pct = ds > 0 ? Math.min(100, Math.round((rd / ds) * 100)) : 0;
      const code = (c.dietitian_id || "").toUpperCase();
      const tr = all.find(t => (t.partner_code || t.dietician_id || "").toUpperCase() === code);
      return { ...c, trainerName: tr?.name || c.associated_dietitian?.name || "—", readingDays: rd, onboardedDate: onb, daysSince: ds, pct, cohort: getCohort(pct), lastDate: lastT };
    };

    const clients = real.map(enrich).sort((a, b) => b.pct - a.pct);
    const trainers = nonSelf.map(t => {
      const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim();
      const tc = (t.partner_code || t.dietician_id || "").toUpperCase();
      const sc = selfT.find(c => { const ce = (c.email || "").toLowerCase().trim(), cn = (c.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
      const allDates = sc ? (readingDatesMap[sc.profile_id] || []) : [];
      const ds = t.created_at ? daysBetween(t.created_at, now) + 1 : 0;
      const dates = t.created_at ? allDates.filter(d => !d.date || new Date(d.date) >= new Date(new Date(t.created_at).getFullYear(), new Date(t.created_at).getMonth(), new Date(t.created_at).getDate())) : allDates;
      // Prefer the API's authoritative counts; fall back to derived values (mock).
      const rd = t.total_tests != null ? t.total_tests : dates.length;

      // The trainer's OWN tests — prefer the backend's authoritative self_reading count;
      // fall back to their self-test client profile (sc). 0 if neither is available.
      const selfTests = t.self_reading_tests != null
        ? t.self_reading_tests
        : (sc ? (sc.total_tests != null ? sc.total_tests : (readingDatesMap[sc.profile_id] || []).length) : 0);
      // Rate = the trainer's OWN tests (self_reading.total_tests) ÷ days since they joined
      // (created_at), as a percentage capped at 100. ~1 self-test/day ⇒ 100%.
      const pct = ds > 0 ? Math.min(100, Math.round((selfTests / ds) * 100)) : 0;
      const realClientCount = t.total_clients != null ? t.total_clients : clients.filter(c => (c.dietitian_id || "").toUpperCase() === tc).length;
      // Clients under this trainer who have taken at least one test (backend-authoritative; fall back to deriving from reads).
      const testedClientCount = t.total_tested_clients != null ? t.total_tested_clients : clients.filter(c => (c.dietitian_id || "").toUpperCase() === tc && (c.readingDays || 0) > 0).length;
      // selfProfileId identifies the trainer's OWN reading device so the cohort
      // people-axis and the readings split can separate it from real clients. Use the
      // backend's authoritative self_reading.profile_id — a name/email match (sc)
      // produces false positives when a real client shares the trainer's name (e.g. a
      // trainer who also coaches clients under their own code), wrongly dropping active
      // clients from the cohort.
      const selfProfileId = t.self_reading_profile_id || null;
      return { ...t, daysSince: ds, readingDays: rd, selfTests, pct, cohort: getCohort(pct), realClientCount, testedClientCount, hasSelfTest: !!selfProfileId, selfProfileId };
    }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount);

    const goals = { weight_loss: 0, fat_loss: 0, muscle_gain: 0 };
    clients.forEach(c => { const g = (c.fitness_goal || "").toLowerCase(); if (g in goals) goals[g]++; });
    return { ta, trainers, clients, totalTrainers: nonSelf.length, activeTrainers: trainers.filter(t => t.pct >= ACTIVE_THRESHOLD).length, totalClients: clients.length, activeClients: clients.filter(c => c.pct >= ACTIVE_THRESHOLD).length, goals };
  }, [trainersMap, allClients, readingDatesMap, now]);

  const taData = useMemo(() => { const m = {}; taList.forEach(ta => { m[ta.user_id] = computeTa(ta); }); return m; }, [taList, computeTa]);
  const allTrainers = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.trainers.map(t => ({ ...t, taName: ta.name })) : []; }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount), [taList, taData]);
  const allRealClients = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.clients : []; }).sort((a, b) => b.pct - a.pct), [taList, taData]);
  const totals = useMemo(() => {
    const v = Object.values(taData).filter(Boolean);
    return { trainers: v.reduce((s, x) => s + x.totalTrainers, 0), activeT: v.reduce((s, x) => s + x.activeTrainers, 0), clients: v.reduce((s, x) => s + x.totalClients, 0), activeC: v.reduce((s, x) => s + x.activeClients, 0), goals: { fat_loss: v.reduce((s, x) => s + x.goals.fat_loss, 0), muscle_gain: v.reduce((s, x) => s + x.goals.muscle_gain, 0), weight_loss: v.reduce((s, x) => s + x.goals.weight_loss, 0) } };
  }, [taData]);

  const selTa = activeTab !== "overview" ? taList.find(t => t.user_id === activeTab) : null;
  const selData = selTa ? taData[selTa.user_id] : null;
  // Unfiltered lists for the current tab — the Trainer Adoption "All" table
  // renders from tabTrAll so a checked (excluded) trainer stays visible (dimmed)
  // and can be unchecked.
  const tabClAll = activeTab === "overview" ? allRealClients : (selData?.clients || []);
  const tabTrAll = activeTab === "overview" ? allTrainers : (selData?.trainers || []);
  // Dietician codes owned by the checked trainers — their clients are excluded
  // too. table_clients.dietician_id is mixed case, so compare uppercased.
  const excludedCodes = new Set(tabTrAll.filter(t => excludedTrainerIds.has(trKey(t))).map(t => (t.partner_code || t.dietician_id || "").toUpperCase()).filter(Boolean));
  const tabTr = excludedTrainerIds.size ? tabTrAll.filter(t => !excludedTrainerIds.has(trKey(t))) : tabTrAll;
  const tabCl = excludedCodes.size ? tabClAll.filter(c => !excludedCodes.has((c.dietitian_id || c.partner_code || "").toUpperCase())) : tabClAll;
  // How many rows the checkboxes removed in this tab's scope — subtracted from
  // the backend-authoritative headline counts below.
  const hiddenTrainerCount = tabTrAll.length - tabTr.length;
  const hiddenClientCount = tabClAll.length - tabCl.length;
  const avgActivity = useMemo(() => { if (!tabCl.length) return 0; return Math.round(tabCl.reduce((s, c) => s + c.pct, 0) / tabCl.length); }, [tabCl]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-5" style={{ height: "calc(100vh - 130px)" }}>
      <div className="flex items-center gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: R.blue, animation: `loaderBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
        ))}
      </div>
      <div style={{ fontSize: "13px", color: R.ts, fontWeight: 500, letterSpacing: "-0.26px" }}>{loadingPhase}</div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height: "calc(100vh - 130px)" }}>
      <div className="max-w-md text-center" style={{ background: "#fef2f2", border: `1px solid ${R.red}30`, color: R.red, borderRadius: R.rCard, padding: "16px", fontSize: "13px", letterSpacing: "-0.26px" }}>{error}</div>
      <button onClick={handleRefresh} className="cursor-pointer" style={{ borderRadius: R.rPill, background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 20px", letterSpacing: "-0.24px", border: "none" }}>Retry</button>
    </div>
  );

  // Overview Trainers/Clients totals come from the authoritative `counts` in the
  // GETGROUPDETAILS response, falling back to the derived totals (demo/mock).
  const tTotalBase = activeTab === "overview" ? Math.max(0, (groupCounts?.trainers ?? totals.trainers) - excludedTrainerAdminCount) : (selData?.totalTrainers ?? 0);
  const tActiveBase = activeTab === "overview" ? totals.activeT : (selData?.activeTrainers ?? 0);
  // Subtract admin profiles that the backend counted as clients (0 if it already excluded them).
  const cTotalBase = activeTab === "overview" ? Math.max(0, (groupCounts?.clients ?? totals.clients) - excludedAdminCount) : (selData?.totalClients ?? 0);
  const cActiveBase = activeTab === "overview" ? totals.activeC : (selData?.activeClients ?? 0);
  const curGoalsBase = activeTab === "overview" ? totals.goals : (selData?.goals || { fat_loss: 0, muscle_gain: 0, weight_loss: 0 });
  // Checkbox exclusions: subtract the hidden trainer/client rows from the
  // headline counts, and recompute Active + Goals from the filtered lists (the
  // base values come from unfiltered taData/backend counts). When nothing is
  // checked the base values pass through untouched.
  const anyExcluded = excludedTrainerIds.size > 0;
  const tTotal = anyExcluded ? Math.max(0, tTotalBase - hiddenTrainerCount) : tTotalBase;
  const cTotal = anyExcluded ? Math.max(0, cTotalBase - hiddenClientCount) : cTotalBase;
  const tActive = anyExcluded ? tabTr.filter(t => t.pct >= ACTIVE_THRESHOLD).length : tActiveBase;
  const cActive = anyExcluded ? tabCl.filter(c => c.pct >= ACTIVE_THRESHOLD).length : cActiveBase;
  const curGoals = anyExcluded
    ? (() => { const g = { weight_loss: 0, fat_loss: 0, muscle_gain: 0 }; tabCl.forEach(c => { const k = (c.fitness_goal || "").toLowerCase(); if (k in g) g[k]++; }); return g; })()
    : curGoalsBase;

  // A calendar-picked date becomes a single-day "custom" period; its comparison
  // baseline is the day before. Otherwise the D/W/M period anchors to `now`.
  const customDay = period === "custom" && selectedDate
    ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    : null;
  const range = customDay ? { start: customDay, end: customDay } : getPeriodRange(period, now);
  const prevR = customDay
    ? (() => { const p = new Date(customDay); p.setDate(customDay.getDate() - 1); return { start: p, end: p }; })()
    : (compare ? getPrevRange(period, now) : null);
  const pm = periodMetrics(tabCl, tabTr, readingDatesMap, range);
  const ppm = prevR ? periodMetrics(tabCl, tabTr, readingDatesMap, prevR) : null;

  // Onboarding drill-down: the two "Onboarded" cards open /super-admin/onboarding
  // (get_group_onboarding) scoped to the SAME window + member the dashboard is on.
  const onbRange = range || getPeriodRange("today", now);
  const periodWord = period === "week" ? "this week" : period === "month" ? "this month" : period === "custom" ? "on this day" : "today";
  const openOnboarding = (type) => {
    if (!primaryGroupName) { toast.error("No admin group in context."); return; }
    const qs = new URLSearchParams({
      group: primaryGroupName,
      from: toYMD(onbRange.start),
      to: toYMD(onbRange.end),
      type,
      member: overviewMemberCode || "",
      label: periodWord,
    });
    router.push(`/super-admin/onboarding?${qs.toString()}`);
  };

  // Reading Split drill-down: the Trainers / Clients rows open /super-admin/readers
  // (get_group_period_readers) scoped to the SAME window + member the dashboard is
  // on. overview_from/overview_to default to today via the period range.
  const openPeriodReaders = (type) => {
    if (!primaryGroupName) { toast.error("No admin group in context."); return; }
    const qs = new URLSearchParams({
      group: primaryGroupName,
      from: toYMD(onbRange.start),
      to: toYMD(onbRange.end),
      type,
      member: overviewMemberCode || "",
      label: periodWord,
    });
    router.push(`/super-admin/readers?${qs.toString()}`);
  };

  const adoptionRate = tTotal > 0 ? Math.round((tActive / tTotal) * 100) : 0;
  const engagementRate = cTotal > 0 ? Math.round((cActive / cTotal) * 100) : 0;
  // Trainer status buckets — a clean partition of ALL trainers so the tab
  // counts always sum to the All count: 0-59% At Risk, 60-89% Active, 90-100% Elite.
  const activeTrainers = tabTr.filter(t => t.pct >= ACTIVE_THRESHOLD && t.pct < ELITE_THRESHOLD);
  const eliteTrainers = tabTr.filter(t => t.pct >= ELITE_THRESHOLD);
  const atRiskTrainers = tabTr.filter(t => t.pct < ACTIVE_THRESHOLD);
  const eliteCount = eliteTrainers.length;
  const atRiskTrainerCount = atRiskTrainers.length;
  // Rows behind the Trainer Adoption table: the active tab's list, narrowed by the
  // search box. The "All" tab uses the UNFILTERED list so a checkbox-excluded
  // trainer stays visible (dimmed) and can be unchecked.
  const trainerTabRows = ({ all: tabTrAll, active: activeTrainers, elite: eliteTrainers, atrisk: atRiskTrainers })[trainerTab] || [];
  const trainerRows = trainerSearch.trim()
    ? trainerTabRows.filter(t => rowMatches(trainerSearchFields(t), trainerSearch))
    : trainerTabRows;
  // Rows behind the Client Engagement table — same idea, over this tab's clients.
  const clientRows = clientSearch.trim()
    ? tabCl.filter(c => rowMatches(clientSearchFields(c), clientSearch))
    : tabCl;
  const highestRate = tabCl.length > 0 ? Math.max(...tabCl.map(c => c.pct)) : 0;
  const lowestRate = tabCl.length > 0 ? Math.min(...tabCl.map(c => c.pct)) : 0;

  const todayR = getPeriodRange("today", now);
  const yesterdayR = getPrevRange("today", now);
  const todayStats = periodMetrics(tabCl, tabTr, readingDatesMap, todayR);
  const yesterdayStats = periodMetrics(tabCl, tabTr, readingDatesMap, yesterdayR);

  const wkR = getPeriodRange("week", now);
  const pwkR = getPrevRange("week", now);
  const wkStats = periodMetrics(tabCl, tabTr, readingDatesMap, wkR);
  const pwkStats = periodMetrics(tabCl, tabTr, readingDatesMap, pwkR);

  const trainerWeekDelta = wkStats.newTrainers - pwkStats.newTrainers;
  const readingsWeekDelta = wkStats.reads - pwkStats.reads;
  const clientWeekDelta = wkStats.newClients - pwkStats.newClients;

  const last7Days = (() => {
    // Trainer self-tests can also appear as client rows; count each profile once
    // (client loop skips trainer self-profiles; the trainer loop counts them).
    const trSelf = new Set(tabTr.map(t => t.selfProfileId).filter(Boolean));
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const r = { start: d, end: d };
      let count = 0;
      tabCl.forEach(c => { if (trSelf.has(c.profile_id)) return; (readingDatesMap[c.profile_id] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
      tabTr.forEach(t => { if (t.selfProfileId) (readingDatesMap[t.selfProfileId] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
      days.push(count);
    }
    return days;
  })();

  const last4WeeksTrainers = (() => {
    const weeks = [];
    for (let w = 3; w >= 0; w--) {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6);
      weeks.push(tabTr.filter(t => inRange(t.created_at, { start, end })).length);
    }
    return weeks;
  })();

  const last4WeeksClients = (() => {
    const weeks = [];
    for (let w = 3; w >= 0; w--) {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6);
      weeks.push(tabCl.filter(c => inRange(c.onboardedDate, { start, end })).length);
    }
    return weeks;
  })();

  // Trainer self-test profiles also surface as client rows; this set marks them
  // so the cohort's people-axis (real clients only) can exclude them.
  const selfPidSet = new Set(tabTr.map(t => t.selfProfileId).filter(Boolean));
  const allTimeClientReads = tabCl.reduce((s, c) => s + (c.readingDays || 0), 0);
  console.log("allTimeClientReads954:-", allTimeClientReads);
  const allTimeTotalReads = allTimeClientReads;
  console.log("allTimeTotalReads956:-", allTimeTotalReads);
  // Readings-card split as people counts — mirror the snapshot cards exactly so
  // the split totals match the Trainers/Clients cards above. Using cTotal (not the
  // sum of each trainer's total_clients) keeps admin-owned clients — the ones under
  // the admin's own code, not any non-self trainer — in the client count.
  const networkTrainerCount = tTotal;
  const networkClientCount = cTotal;
  const networkSplitTotal = networkTrainerCount + networkClientCount;
  // Period reads come from the API's period_overview, summed across the selected
  // range (see the aggregation effect). No frontend recomputation of the counts
  // themselves — the Reading Split shows each bucket; trainer + client = total.
  const periodTotalReads = periodReads.total;
  const periodTrainerReads = periodReads.trainer;
  const periodClientReads = periodReads.client;
  const periodLabel = customDay
    ? customDay.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase()
    : period === "today" ? `TODAY (${fmtDate(range?.start).toUpperCase()})`
      : period === "week" ? `THIS WEEK (${fmtRange(range).toUpperCase()})`
        : period === "month" ? `THIS MONTH (${fmtRange(range).toUpperCase()})`
          : "ALL TIME";
  // Device-Adoption donut is period-scoped: the share of clients who logged a
  // reading in the selected period (pm.adoption), NOT the all-time avg rate.
  const adoptionSubLabel = period === "custom" ? "Clients Read That Day"
    : period === "week" ? "Clients Read This Week"
      : period === "month" ? "Clients Read This Month"
        : "Clients Read Today";

  const CTIERS = [
    { label: "100%", min: 100, max: 100, color: R.blue },
    { label: "90% – 99%", min: 90, max: 99, color: R.blue },
    { label: "70% – 89%", min: 70, max: 89, color: R.blue },
    { label: "50% – 69%", min: 50, max: 69, color: R.blue },
    { label: "30% – 49%", min: 30, max: 49, color: R.orange },
    { label: "<30%", min: 0, max: 29, color: R.red },
  ];
  // Bucket clients by their reading rate. Trainer self-test profiles also appear
  // in tabCl, so exclude them — the cohort's people axis is real clients only.
  const cohortClients = tabCl.filter(c => !selfPidSet.has(c.profile_id));
  // Group-member (admin) codes: an admin who directly owns a client is NOT a
  // trainer, so never surface them in the cohort's Trainers tab.
  const adminCodeSet = new Set(taList.map(ta => (ta.partner_code || "").toUpperCase()).filter(Boolean));
  // Resolve a client's coaching trainer (by dietitian code) to the enriched
  // trainer row so the Trainers tab can show that trainer's own stats.
  const trByCode = new Map();
  tabTr.forEach(t => { const code = (t.partner_code || t.dietician_id || "").toUpperCase(); if (code) trByCode.set(code, t); });
  const totalPeople = cohortClients.length;
  const cohortData = CTIERS.map(tier => {
    const clientsIn = cohortClients.filter(c => c.pct >= tier.min && c.pct <= tier.max);
    // Bind trainers to the band: the distinct trainers who coach the clients in it
    // (the same trainers named in the client rows), each with a count of how many
    // of their clients land here. Admin-owned clients contribute no trainer row.
    const byTrainer = new Map();
    clientsIn.forEach(c => {
      const code = (c.dietitian_id || "").toUpperCase();
      const isAdmin = adminCodeSet.has(code);
      // Admins appear in the Trainers tab only for bands where a client they
      // directly own has actually taken readings (skip their zero-reading clients).
      const adminSelf = isAdmin ? adminSelfByCode[code] : null;
      if (isAdmin && !((c.readingDays ?? 0) > 0)) return;
      const key = code || (c.trainerName || "—");
      let entry = byTrainer.get(key);
      if (!entry) {
        const tr = trByCode.get(code);
        // Admin's Own Rate is their own self-test rate (tests ÷ days since they joined).
        let pct = tr ? tr.pct : null;
        if (isAdmin && adminSelf) {
          const ds = adminSelf.joined ? daysBetween(adminSelf.joined, now) + 1 : 0;
          pct = ds > 0 ? Math.min(100, Math.round((adminSelf.total_tests / ds) * 100)) : 0;
        }
        entry = { ...(tr || {}), name: tr?.name || c.trainerName || "—", partner_code: tr?.partner_code || code || "—", taName: tr?.taName || c.taName, pct, _clientsHere: 0, _self: isAdmin };
        byTrainer.set(key, entry);
      }
      entry._clientsHere += 1;
    });
    const trainersIn = Array.from(byTrainer.values());
    const count = clientsIn.length;
    return { ...tier, count, trainersIn, clientsIn, pctOfTotal: totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0 };
  });
  const maxCohortCount = Math.max(...cohortData.map(c => c.count), 1);

  const onboardedTrainersToday = tabTr.filter(t => inRange(t.created_at, todayR));
  const onboardedClientsToday = tabCl.filter(c => inRange(c.onboardedDate, todayR));
  const readingsToday = tabCl.filter(c => { const d = readingDatesMap[c.profile_id] || []; return d.some(x => inRange(x.date, todayR)); });
  const onboardedTrainersYesterday = tabTr.filter(t => inRange(t.created_at, yesterdayR));
  const onboardedClientsYesterday = tabCl.filter(c => inRange(c.onboardedDate, yesterdayR));

  const toggleAcc = (key) => setOpenAcc(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const riskyTrainers = tabTr.filter(t => t.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);
  const riskyClients = tabCl.filter(c => c.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);

  const tChange = pctChange(todayStats.newTrainers, yesterdayStats.newTrainers);
  const cChange = pctChange(todayStats.newClients, yesterdayStats.newClients);
  const rChange = pctChange(todayStats.reads, yesterdayStats.reads);

  const rateColor = (pct) => pct >= ACTIVE_THRESHOLD ? R.green : pct > 0 ? R.orange : R.red;
  const rateStyle = (pct) => ({ fontWeight: 600, color: rateColor(pct) });
  const RateCell = ({ pct }) => (
    <div className="flex items-center gap-2" style={{ justifyContent: "flex-end" }}>
      <div style={{ width: "36px", height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: "2px", backgroundColor: rateColor(pct), transition: "width 0.4s ease" }} />
      </div>
      <span style={rateStyle(pct)}>{pct}%</span>
    </div>
  );
  const badgeStyle = (bg, fg) => ({ fontSize: "10px", fontWeight: 500, padding: "2px 8px", borderRadius: R.rBadge, backgroundColor: bg, color: fg, letterSpacing: "-0.2px" });

  // Checkbox column for Trainer Adoption: checking a trainer temporarily removes
  // them — and every client under their code — from all analytics (incl. Client
  // Engagement). The checked row stays visible (dimmed) so it can be unchecked.
  const excludeCol = {
    key: "_exclude", label: "", width: "28px", align: "center",
    val: r => (excludedTrainerIds.has(trKey(r)) ? 1 : 0),
    render: r => (
      <input
        type="checkbox"
        checked={excludedTrainerIds.has(trKey(r))}
        onChange={() => toggleTrainerExcluded(trKey(r))}
        onClick={e => e.stopPropagation()}
        title={excludedTrainerIds.has(trKey(r)) ? "Include this trainer again" : "Temporarily exclude this trainer and their clients"}
        style={{ cursor: "pointer", accentColor: R.blue, width: "14px", height: "14px", verticalAlign: "middle" }}
      />
    ),
  };
  // Dim a checked (excluded) trainer's row so it reads as removed but stays togglable.
  const excludedRowStyle = (r) => excludedTrainerIds.has(trKey(r)) ? { opacity: 0.4, textDecoration: "line-through" } : {};
  // Trainer name → opens the client-list pop-up for that trainer (data from
  // TRAINERCLIENTSOVERVIEWFORSUPERADMIN, keyed by the row's partner_code).
  const trainerNameCell = r => (
    <button type="button" onClick={e => { e.stopPropagation(); setClientsModalTrainer(r); }}
      title="View this trainer's clients" className="cursor-pointer hover:underline text-[#252525] hover:text-[#308BF9] transition-colors"
      style={{ border: "none", background: "transparent", padding: 0, font: "inherit", fontWeight: 600, textAlign: "left" }}>
      {r.name || "—"}
    </button>
  );

  const trainerCols = [
    excludeCol,
    { key: "name", label: "Name", val: r => r.name || "—", render: trainerNameCell },
    { key: "partner_code", label: "Code", val: r => r.partner_code || "—", className: "text-muted font-mono" },
    ...(activeTab === "overview" ? [{ key: "taName", label: "TA", val: r => r.taName || "—", className: "text-secondary" }] : []),
    { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
    { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
    { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
  ];
  const clientCols = [
    { key: "name", label: "Name", val: r => r.name || "—" },
    { key: "trainerName", label: "Trainer", val: r => r.trainerName || "—", className: "text-secondary" },
    { key: "fitness_goal", label: "Goal", render: r => <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
    { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
    { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
    { key: "metabolism_score", label: "Score", align: "center", val: r => r.metabolism_score ?? null, render: r => r.metabolism_score != null ? <span style={{ fontWeight: 600, color: R.tp }}>{Math.round(r.metabolism_score)}</span> : <span style={{ color: R.td }}>—</span> },
    { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
  ];
  // Trainers shown inside a cohort band are the coaches of that band's clients, so
  // the columns describe that binding: how many of their clients are in this band,
  // plus the trainer's own self-test rate (— when it's the admin's own code).
  const cohortTrainerCols = [
    { key: "name", label: "Trainer", val: r => r.name || "—" },
    { key: "partner_code", label: "Code", val: r => r.partner_code || "—", className: "text-muted font-mono" },
    { key: "taName", label: "TA", val: r => r._self ? "self" : (r.taName || "—"), className: "text-secondary" },
    { key: "_clientsHere", label: "Clients Here", align: "center", val: r => r._clientsHere ?? 0 },
    { key: "pct", label: "Own Rate", align: "right", render: r => r.pct == null ? <span style={{ fontSize: "11px", color: R.tm }}>—</span> : <RateCell pct={r.pct} /> },
  ];

  const CS = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #EEF2F6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.3s ease, transform 0.3s ease", position: "relative", overflow: "hidden" };
  const csHover = { boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", transform: "translateY(-2px)" };
  const csReset = { boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transform: "none" };

  const maxGoal = Math.max(curGoals.fat_loss, curGoals.muscle_gain, curGoals.weight_loss, 1);

  const deltaStyle = (v) => ({ borderRadius: "8px", padding: "6px 12px", fontSize: "12px", letterSpacing: "-0.24px", fontWeight: 500, backgroundColor: "#F8FAFC", color: R.ts, border: "1px solid #EEF2F6" });
  const DeltaArrow = ({ v }) => <span style={{ fontWeight: 700, color: v >= 0 ? R.green : R.red, marginRight: "4px" }}>{v >= 0 ? "↑" : "↓"}</span>;

  return (
    <div className="overflow-y-scroll custom-scrollbar" style={{ height: "calc(100vh - 130px)", fontFamily: "'Poppins', sans-serif", backgroundColor: "#F5F7FA" }}>
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between py-3 sticky top-0 z-10" style={{ backgroundColor: "#F5F7FA", borderBottom: "1px solid #EEF2F6" }}>
        {/* ── Left: Page title as dropdown ── */}
        <div ref={tabDdRef} style={{ position: "relative" }}>
          <button onClick={() => setTabDdOpen(o => !o)}
            className="flex items-center gap-2 cursor-pointer transition-all duration-200"
            style={{ background: "none", border: "none", padding: "4px 0", outline: "none" }}>
            <span style={{ fontSize: "18px", fontWeight: 700, color: R.tp, letterSpacing: "-0.36px" }}>
              {activeTab === "overview" ? "Overview" : taList.find(t => t.user_id === activeTab)?.name || "—"}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={R.tm} strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: tabDdOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {tabDdOpen && (
            <div className="absolute left-0 z-50" style={{ top: "calc(100% + 6px)", minWidth: 220, backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #EEF2F6", boxShadow: "0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)", padding: "6px", animation: "fadeSlideUp 0.15s ease-out" }}>
              <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>View</div>
              <button onClick={() => { setActiveTab("overview"); setTabDdOpen(false); }}
                className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
                style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: activeTab === "overview" ? R.blueLight : "transparent", color: activeTab === "overview" ? R.blue : R.ts, fontSize: "13px", fontWeight: activeTab === "overview" ? 600 : 400, letterSpacing: "-0.26px" }}
                onMouseEnter={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = R.surface; }}
                onMouseLeave={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = "transparent"; }}>
                <span className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: "8px", backgroundColor: activeTab === "overview" ? R.blue + "18" : R.surface }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={activeTab === "overview" ? R.blue : R.tm} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                </span>
                Overview
              </button>
              {taList.length > 0 && <>
                <div style={{ height: "1px", backgroundColor: R.border, margin: "6px 10px" }} />
                <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>Trainer Admins</div>
              </>}
              {taList.map((t, i) => {
                const isActive = activeTab === t.user_id;
                const dotColor = [R.blue, R.green, R.orange, "#7c3aed"][i % 4];
                return (
                  <button key={t.user_id} onClick={() => { setActiveTab(t.user_id); setTabDdOpen(false); }}
                    className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
                    style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: isActive ? R.blueLight : "transparent", color: isActive ? R.blue : R.ts, fontSize: "13px", fontWeight: isActive ? 600 : 400, letterSpacing: "-0.26px" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = R.surface; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <span className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: "8px", background: isActive ? `linear-gradient(135deg, ${R.blue}, ${R.dark})` : R.surface, color: isActive ? R.white : R.ts, fontSize: "11px", fontWeight: 700 }}>
                      {(t.name || "?")[0]}
                    </span>
                    <div className="flex-1 text-left">
                      <div className="truncate">{t.name}</div>
                      {t.email && <div className="truncate" style={{ fontSize: "11px", color: R.tm, fontWeight: 400 }}>{t.email}</div>}
                    </div>
                    <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Controls ── */}
        <div className="flex items-center gap-3">
          {/* Refresh */}
          <button onClick={handleRefresh} className="flex items-center justify-center cursor-pointer transition-all duration-200"
            style={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: "#ffffff", border: "1px solid #EEF2F6", color: R.tm }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = R.blueLight; e.currentTarget.style.color = R.blue; e.currentTarget.style.borderColor = R.blue + "40"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.color = R.tm; e.currentTarget.style.borderColor = "#EEF2F6"; }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
          </button>

          {/* Timezone + Clock cluster */}
          <div className="flex items-center gap-2" style={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #EEF2F6", padding: "6px 12px" }}>
            <div className="flex items-center" style={{ backgroundColor: R.surface, borderRadius: "8px", padding: "2px", gap: "2px" }}>
              {Object.entries(TIMEZONES).map(([tz, label]) => (
                <button key={tz} onClick={() => setTimezone(tz)}
                  className="cursor-pointer transition-all duration-200"
                  style={{ padding: "4px 10px", fontSize: "11px", fontWeight: timezone === tz ? 600 : 500, letterSpacing: "-0.22px", backgroundColor: timezone === tz ? R.dark : "transparent", color: timezone === tz ? R.white : R.ts, border: "none", borderRadius: "6px" }}
                  onMouseEnter={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = R.border; e.currentTarget.style.color = R.tp; } }}
                  onMouseLeave={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = R.ts; } }}>{label}</button>
              ))}
            </div>
            <div style={{ width: "1px", height: "20px", backgroundColor: R.border }} />
            <div ref={calRef} style={{ position: "relative" }}>
              <button type="button" onClick={() => setCalOpen(o => !o)} title="World clock"
                className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all duration-200"
                style={{ fontSize: "11px", color: calOpen ? R.blue : R.tm, letterSpacing: "-0.22px", background: "transparent", border: "none", padding: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = R.blue; }}
                onMouseLeave={e => { e.currentTarget.style.color = calOpen ? R.blue : R.tm; }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                <span>{clock}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: calOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
              </button>

              {calOpen && (
                <div data-tick={nowTick} style={{ position: "absolute", top: "calc(100% + 12px)", right: 0, zIndex: 50, backgroundColor: R.white, borderRadius: R.rCard, border: `1px solid ${R.border}`, boxShadow: R.shadow, padding: "18px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: R.tp, letterSpacing: "-0.24px" }}>{TIMEZONES[timezone]}</span>
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontSize: "22px", fontWeight: 700, color: R.tp, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{tzTime(timezone)}</div>
                      <div style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px", marginTop: "2px" }}>{tzDay(timezone)}</div>
                    </div>
                    <div className="wc-cal">
                      <Calendar
                        onChange={(d) => { const dt = Array.isArray(d) ? d[0] : d; if (dt) { setSelectedDate(dt); setPeriod("custom"); setCalOpen(false); } }}
                        value={period === "custom" && selectedDate ? selectedDate : tzNow(timezone)}
                        maxDate={tzNow(timezone)}
                        showNeighboringMonth={false} locale="en-US" />
                    </div>
                    <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px" }}>
                        {period === "custom" && selectedDate ? "Filtering Period Overview" : "Pick a date to filter"}
                      </span>
                      {period === "custom" && selectedDate && (
                        <button type="button" onClick={() => { setSelectedDate(null); setPeriod("today"); }}
                          className="cursor-pointer" style={{ fontSize: "10px", fontWeight: 600, color: R.blue, background: R.blueLight, border: "none", borderRadius: R.rBadge, padding: "3px 8px" }}>Reset to today</button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .wc-cal .react-calendar { width: 232px; border: none; background: transparent; font-family: inherit; line-height: 1.2; }
        .wc-cal .react-calendar button { border-radius: 8px; }
        .wc-cal .react-calendar__navigation { height: 32px; margin-bottom: 4px; }
        .wc-cal .react-calendar__navigation button { min-width: 30px; font-size: 13px; font-weight: 600; color: ${R.tp}; background: transparent; }
        .wc-cal .react-calendar__navigation button:enabled:hover, .wc-cal .react-calendar__navigation button:enabled:focus { background: ${R.surface}; }
        .wc-cal .react-calendar__navigation button:disabled { background: transparent; }
        .wc-cal .react-calendar__month-view__weekdays { font-size: 10px; font-weight: 600; color: ${R.tm}; text-transform: uppercase; letter-spacing: 0.2px; }
        .wc-cal .react-calendar__month-view__weekdays abbr { text-decoration: none; cursor: default; }
        .wc-cal .react-calendar__tile { padding: 6px 4px; font-size: 11px; color: ${R.ts}; }
        .wc-cal .react-calendar__tile:enabled:hover, .wc-cal .react-calendar__tile:enabled:focus { background: ${R.blueLight}; color: ${R.blue}; }
        .wc-cal .react-calendar__month-view__days__day--weekend { color: ${R.red}; }
        .wc-cal .react-calendar__month-view__days__day--neighboringMonth { color: ${R.td}; }
        .wc-cal .react-calendar__tile--now { background: ${R.blueLight}; color: ${R.blue}; font-weight: 700; }
        .wc-cal .react-calendar__tile--now:enabled:hover, .wc-cal .react-calendar__tile--now:enabled:focus { background: ${R.blueLight}; }
        .wc-cal .react-calendar__tile--active, .wc-cal .react-calendar__tile--active:enabled:hover, .wc-cal .react-calendar__tile--active:enabled:focus { background: ${R.dark}; color: ${R.white}; font-weight: 700; }

        /* Tablet (1024x768 landscape & 768x1024 portrait): stack the hero grid so the
           snapshot cards render full-width right below the sticky header, then the
           Period Overview card, then Trainer Adoption. */
        @media (max-width: 1024px) {
          .an-hero-grid { grid-template-columns: 1fr !important; grid-template-rows: none !important; }
          .an-snapshot-grid { order: -1; }
          .an-period-card { grid-row: auto !important; grid-column: auto !important; }
          .an-row3-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 820px) {
          .an-snapshot-grid { gap: 10px !important; }
        }
      `}</style>

      <div className="flex flex-col gap-5 pb-8 pt-2">

        {/* ═══ TA PROFILE (individual tabs only) ═══ */}
        {selTa && (
          <div className="flex items-center gap-4" style={{ ...CS, padding: "16px 24px" }}>
            <div className="w-10 h-10 flex items-center justify-center font-bold text-white" style={{ borderRadius: "12px", background: `linear-gradient(135deg, ${R.dark} 0%, ${R.blue} 100%)`, fontSize: "18px", letterSpacing: "-0.36px" }}>{(selTa.name || "?")[0]}</div>
            <div className="flex-1">
              <div style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.3px", color: R.tp }}>{selTa.name}</div>
              <div style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{selTa.email}</div>
            </div>
            <div className="flex gap-8 shrink-0">
              <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Code</div><div className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: R.tp, letterSpacing: "-0.26px" }}>{selTa.partner_code}</div></div>
              <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Since</div><div style={{ fontSize: "13px", fontWeight: 600, color: R.tp, letterSpacing: "-0.26px" }}>{fmtDate(selTa.created_at)}</div></div>
              <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Days Active</div><div style={{ fontSize: "13px", fontWeight: 700, color: R.blue, letterSpacing: "-0.26px" }}>{selTa.created_at ? daysBetween(selTa.created_at, now) : "—"}</div></div>
            </div>
          </div>
        )}

        {/* ═══ 2-ROW GRID: Left (Snapshot + Trainer Adoption) | Right (Period + Reading Split spanning both) ═══ */}
        <div className="an-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "14px", gridTemplateRows: "auto 1fr" }}>

          {/* ── Left Top: Snapshot cards ── */}
          <div className="an-snapshot-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            {/* Card: Trainers */}
            <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.blue}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
              onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Trainers</span>
                <div className="flex items-center gap-2">
                  {wkStats.newTrainers > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newTrainers} this wk</span>}
                  <Ico type="people" />
                </div>
              </div>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{tTotal}</div>
                  <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{tActive} Active</span>
                    <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {tTotal}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Sparkline data={last4WeeksTrainers} width={64} height={28} color={R.blue} />
                  <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
                </div>
              </div>
              <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
                <div style={{ width: `${adoptionRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.blue}, ${R.green})`, transition: "width 0.6s ease" }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span style={{ fontSize: "10px", color: R.tm }}>Adoption</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{adoptionRate}%</span>
              </div>
            </div>

            {/* Card: Clients */}
            <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.green}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
              onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Clients</span>
                <div className="flex items-center gap-2">
                  {wkStats.newClients > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newClients} this wk</span>}
                  <Ico type="person" />
                </div>
              </div>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{cTotal}</div>
                  <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{cActive} Active</span>
                    <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {cTotal}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Sparkline data={last4WeeksClients} width={64} height={28} color={R.green} />
                  <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
                </div>
              </div>
              <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
                <div style={{ width: `${engagementRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.green}, #10B981)`, transition: "width 0.6s ease" }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span style={{ fontSize: "10px", color: R.tm }}>Engagements</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{engagementRate}%</span>
              </div>
            </div>

            {/* Card: Readings */}
            <div className="analytics-card-animate" style={{ ...CS, padding: "20px", borderLeft: "3px solid #7C3AED", height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
              onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>CLIENTS Reading (Excluding Trainers)</span>
                <div className="flex items-center gap-2">
                  {wkStats.reads > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: "#7C3AED", backgroundColor: "#7C3AED12", padding: "2px 6px", borderRadius: "4px" }}>{wkStats.reads} this wk</span>}
                  <Ico type="trend" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{allTimeTotalReads}</div>
                  <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Sparkline data={last7Days} width={90} height={32} color="#7C3AED" />
                  <span style={{ fontSize: "9px", color: R.tm }}>Last 7 days</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
                {[["Trainers", networkTrainerCount, R.blue], ["Clients", networkClientCount, R.green]].map(([l, v, c]) => (
                  <div key={l} className="flex items-center gap-2">
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: c, flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: R.ts, flex: 1 }}>{l}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: R.tp }}>{v}</span>
                    {networkSplitTotal > 0 && <span style={{ fontSize: "10px", color: R.tm }}>({Math.round((v / networkSplitTotal) * 100)}%)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Period + Reading Split — spans 2 rows ── */}
          <div className="analytics-card-animate an-period-card" style={{ gridRow: "1 / 3", gridColumn: 2, alignSelf: "start", borderRadius: "16px", padding: "28px 24px", background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)", color: "#ffffff", position: "relative", overflow: "hidden", transition: "box-shadow 0.3s ease, transform 0.3s ease", display: "flex", flexDirection: "column" }}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { boxShadow: "0 8px 32px rgba(15,23,42,0.4)", transform: "translateY(-2px)" })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none" })}>

            {/* Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "4px" }}>Period Overview</div>
                <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.3px" }}>{periodLabel}</span>
                {/* Whose readings these are: the selected admin, or all members by default. */}
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px", letterSpacing: "-0.1px" }}>
                  {selTa ? (selTa.email || selTa.name || periodReads.scope?.name) : "All Members"}
                </div>
              </div>
              <div className="flex items-center" style={{ backgroundColor: "rgba(148,163,184,0.12)", borderRadius: "8px", padding: "2px", gap: "2px" }}>
                {[["today", "D"], ["week", "W"], ["month", "M"]].map(([k, l]) => (
                  <button key={k} onClick={() => setPeriod(k)}
                    className="cursor-pointer transition-all duration-200"
                    style={{ padding: "5px 12px", fontSize: "11px", fontWeight: period === k ? 700 : 500, backgroundColor: period === k ? R.blue : "transparent", color: "#ffffff", border: "none", borderRadius: "6px", opacity: period === k ? 1 : 0.6 }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Hero metric — Total Readings (summed across the period) */}
            <div className="text-center" style={{ padding: "8px 0 20px" }}>
              <div style={{ fontSize: "44px", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1, opacity: periodReads.loading ? 0.4 : 1, transition: "opacity 0.2s ease" }}>{periodTotalReads}</div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", letterSpacing: "0.3px" }}>Total Readings</div>
            </div>

            {/* Onboarding metrics — 2 compact cards side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {[
                { val: pm.newTrainers, prev: ppm?.newTrainers, label: "Trainers", sub: "Onboarded", color: R.blue, type: "trainers" },
                { val: pm.newClients, prev: ppm?.newClients, label: "Clients", sub: "Onboarded", color: R.green, type: "clients" },
              ].map((item) => (
                <div
                  key={item.label}
                  role="button"
                  tabIndex={0}
                  title={`View ${item.label.toLowerCase()} onboarded ${periodWord}`}
                  onClick={() => openOnboarding(item.type)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOnboarding(item.type); } }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(148,163,184,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(148,163,184,0.06)"; e.currentTarget.style.transform = "none"; }}
                  className="cursor-pointer"
                  style={{ padding: "14px", borderRadius: "12px", backgroundColor: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.1)", transition: "background-color 0.2s ease, transform 0.2s ease", outline: "none" }}
                >
                  <div className="flex items-center justify-between">
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: item.color }} />
                    {item.prev != null && item.val !== item.prev && (
                      <span style={{ fontSize: "10px", fontWeight: 600, color: item.val >= item.prev ? "#4ade80" : "#f87171" }}>
                        {item.val >= item.prev ? "+" : ""}{item.val - item.prev}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-1px", marginTop: "8px", lineHeight: 1 }}>{item.val}</div>
                  <div className="flex items-center justify-between" style={{ marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{item.label} {item.sub}</span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>›</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Device Adoption + Reading Split — side by side */}
            <div className="flex-1 flex gap-4" style={{ paddingTop: "20px", borderTop: "1px solid rgba(148,163,184,0.1)", marginTop: "20px" }}>

              {/* Device Adoption — left column */}
              <div className="flex-1 flex flex-col items-center" style={{ borderRight: "1px solid rgba(148,163,184,0.1)", paddingRight: "16px" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Device Adoption</div>
                <Donut pct={pm.adoption} size={90} thickness={8} color={R.blue} bg="#0f172a" track="rgba(148,163,184,0.12)" textColor="#ffffff" />
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", marginTop: "12px" }}>{adoptionSubLabel}</div>
              </div>

              {/* Reading Split — right column */}
              <div className="flex-1 flex flex-col items-center" style={{ paddingLeft: "4px" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Reading Split</div>
                {(() => {
                  const trPct = periodTotalReads > 0 ? Math.round((periodTrainerReads / periodTotalReads) * 100) : 0;
                  return (
                    <div className="flex flex-col items-center gap-4 flex-1 w-full">
                      <div className="rounded-full flex items-center justify-center" style={{
                        width: 90, height: 90,
                        background: periodTotalReads > 0
                          ? `conic-gradient(${R.blue} 0% ${trPct}%, ${R.green}80 ${trPct}% 100%)`
                          : "rgba(148,163,184,0.12)"
                      }}>
                        <div className="rounded-full flex items-center justify-center" style={{ width: 70, height: 70, backgroundColor: "#0f172a" }}>
                          <div className="text-center">
                            <div style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1 }}>{periodTotalReads}</div>
                            <div style={{ fontSize: "8px", color: "#64748b", marginTop: "2px" }}>readings</div>
                          </div>
                        </div>
                      </div>

                      <div className="w-full" style={{ height: "5px", borderRadius: "3px", overflow: "hidden", display: "flex", backgroundColor: "rgba(148,163,184,0.12)" }}>
                        {periodTotalReads > 0 && <>
                          <div style={{ width: `${trPct}%`, height: "100%", backgroundColor: R.blue, transition: "width 0.4s ease" }} />
                          <div style={{ flex: 1, height: "100%", backgroundColor: `${R.green}80` }} />
                        </>}
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        {[
                          { label: "Trainers", val: periodTrainerReads, color: R.blue, type: "trainers" },
                          { label: "Clients", val: periodClientReads, color: `${R.green}80`, type: "clients" },
                        ].map(s => (
                          <div
                            key={s.label}
                            role="button"
                            tabIndex={0}
                            title={`View ${s.label.toLowerCase()} who took readings ${periodWord}`}
                            onClick={() => openPeriodReaders(s.type)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPeriodReaders(s.type); } }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(148,163,184,0.14)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(148,163,184,0.05)"; }}
                            className="flex items-center gap-2 cursor-pointer"
                            style={{ padding: "6px 10px", borderRadius: "8px", backgroundColor: "rgba(148,163,184,0.05)", transition: "background-color 0.2s ease", outline: "none" }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.color, flexShrink: 0 }} />
                            <span style={{ fontSize: "11px", color: "#94a3b8", flex: 1 }}>{s.label}</span>
                            <span style={{ fontSize: "14px", fontWeight: 700 }}>{s.val}</span>
                            <span style={{ fontSize: "10px", color: "#475569" }}>({periodTotalReads > 0 ? Math.round((s.val / periodTotalReads) * 100) : 0}%)</span>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>›</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ── Left Bottom: Trainer Adoption ── */}
          <div className="p-5 analytics-card-animate" style={{ ...CS, display: "flex", flexDirection: "column", height: "480px" }}
            onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
            onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Trainer Adoption</h2>
                <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are trainers using the device?</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div style={{ fontSize: "20px", fontWeight: 700, color: R.tp, lineHeight: 1 }}>{tTotal}</div>
                  <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Total</div>
                </div>
                <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
                <div className="text-center">
                  <div style={{ fontSize: "20px", fontWeight: 700, color: R.green, lineHeight: 1 }}>{tActive}</div>
                  <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Active</div>
                </div>
                <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
                <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{adoptionRate}%</div>
                  <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Adoption</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4 p-1" style={{ backgroundColor: "#F1F5F9", borderRadius: "10px" }}>
              {[
                { key: "all", dotColor: R.blue, count: tTotal, label: "All" },
                { key: "active", dotColor: R.green, count: activeTrainers.length, label: `Active` },
                { key: "elite", dotColor: "#10B981", count: eliteCount, label: "Elite" },
                { key: "atrisk", dotColor: R.red, count: atRiskTrainerCount, label: "At Risk" },
              ].map(t => (
                <button key={t.key} onClick={() => setTrainerTab(t.key)} className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer" style={{
                  padding: "7px 10px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, letterSpacing: "-0.24px", transition: "all 0.2s ease",
                  backgroundColor: trainerTab === t.key ? "#ffffff" : "transparent",
                  color: trainerTab === t.key ? R.tp : R.tm,
                  boxShadow: trainerTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.dotColor }} />
                  <span>{t.count}</span>
                  <span style={{ fontWeight: 500 }}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Search — filters the active tab's rows */}
            <div className="flex items-center gap-2 mt-2">
              <SearchBox value={trainerSearch} onChange={setTrainerSearch} placeholder="Search trainers" />
              {trainerSearch.trim() && (
                <span className="shrink-0" style={{ fontSize: "10px", fontWeight: 600, color: R.blue, backgroundColor: R.blueLight, borderRadius: R.rBadge, padding: "4px 8px", letterSpacing: "-0.2px", whiteSpace: "nowrap" }}>
                  {trainerRows.length} {trainerRows.length === 1 ? "match" : "matches"}
                </span>
              )}
            </div>

            {/* Exclusion banner — shown while any trainer is checkbox-excluded */}
            {excludedTrainerIds.size > 0 && (
              <div className="flex items-center justify-between mt-2" style={{ backgroundColor: "#FFF8EB", border: "1px solid #FFE3AD", borderRadius: "8px", padding: "6px 10px" }}>
                <span style={{ fontSize: "11px", color: "#9A6B00", letterSpacing: "-0.22px" }}>
                  {hiddenTrainerCount} {hiddenTrainerCount === 1 ? "trainer" : "trainers"} &amp; {hiddenClientCount} {hiddenClientCount === 1 ? "client" : "clients"} temporarily excluded from analytics
                </span>
                <button onClick={() => setExcludedTrainerIds(new Set())} className="cursor-pointer" style={{ border: "none", background: "transparent", color: R.blue, fontSize: "11px", fontWeight: 600, letterSpacing: "-0.22px", padding: "0 2px" }}>
                  Reset
                </button>
              </div>
            )}

            {/* Tab content — table fills available space. The "All" tab renders the
                UNFILTERED list so a checked (excluded) trainer stays visible —
                dimmed — and can be unchecked; the other tabs are already scoped
                to the filtered set. */}
            <div className="mt-3 flex-1 flex flex-col" style={{ overflow: "hidden" }}>
              {(() => {
                const list = trainerRows;
                const searching = !!trainerSearch.trim();
                if (list.length === 0) return <div className="flex flex-col items-center justify-center flex-1 gap-3">
                  <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>{searching ? `No trainers match “${trainerSearch.trim()}”` : "No trainers in this group"}</div>
                    {searching
                      ? <button onClick={() => setTrainerSearch("")} className="cursor-pointer mt-2" style={{ border: "none", background: R.blueLight, color: R.blue, fontSize: "11px", fontWeight: 600, borderRadius: R.rBadge, padding: "4px 10px" }}>Clear search</button>
                      : <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>Try selecting a different tab</div>}
                  </div>
                </div>;
                if (trainerTab === "all") return <AccTable rows={list} rowStyle={excludedRowStyle} pageSize={TRAINER_PAGE_SIZE} resetKey={`${trainerTab}|${trainerSearch}|${activeTab}`} cols={[
                  excludeCol,
                  { key: "name", label: "Trainer", val: r => r.name || "—", render: trainerNameCell },
                  { key: "realClientCount", label: "Clients", align: "center", val: r => r.realClientCount ?? 0 },
                  { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
                  { key: "selfTests", label: "Tests", align: "center", val: r => r.selfTests ?? 0 },
                  { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
                  {
                    key: "status", label: "Status", align: "right", val: r => r.pct >= ELITE_THRESHOLD ? 2 : r.pct >= ACTIVE_THRESHOLD ? 1 : 0, render: r => r.pct >= ELITE_THRESHOLD
                      ? <span style={badgeStyle(R.greenLight, R.green)}>Elite</span>
                      : r.pct >= ACTIVE_THRESHOLD
                        ? <span style={badgeStyle(R.blueLight, R.blue)}>Active</span>
                        : <span style={badgeStyle("#fef2f2", R.red)}>At Risk</span>
                  },
                ]} />;
                return <AccTable rows={list} rowStyle={excludedRowStyle} pageSize={TRAINER_PAGE_SIZE} resetKey={`${trainerTab}|${trainerSearch}|${activeTab}`} cols={trainerCols} />;
              })()}
            </div>

            <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #EEF2F6" }}>
              <div className="italic" style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px" }}>Adoption = Trainers with reading rate {"≥"} {ACTIVE_THRESHOLD}% / Total trainers ({tActive}/{tTotal} = {adoptionRate}%)</div>
              <div className="mt-2" style={deltaStyle(trainerWeekDelta)}>
                <DeltaArrow v={trainerWeekDelta} />{Math.abs(trainerWeekDelta)} {trainerWeekDelta === 1 || trainerWeekDelta === -1 ? "trainer" : "trainers"} this week vs last
              </div>
            </div>
          </div>

        </div>

        {/* ═══ ROW 3: CLIENT ENGAGEMENT (wide) + READING RATE COHORTS ═══ */}
        <div className="an-row3-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "stretch" }}>
          {/* Client Engagement */}
          <div className="p-5 analytics-card-animate" style={CS}
            onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
            onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Client Engagement</h2>
                <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are clients engaged and consistent?</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{avgActivity}%</div>
                  <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Avg Rate</div>
                </div>
                <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
                <div className="flex gap-3">
                  <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.green }}>{highestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>High</div></div>
                  <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.red }}>{lowestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>Low</div></div>
                </div>
              </div>
            </div>

            {/* Clients by Goal — compact */}
            <div className="flex gap-3 mt-3">
              {[["fat_loss", "Fat Loss", R.orange], ["muscle_gain", "Muscle Gain", R.green]].map(([k, l, c]) => (
                <div key={k} className="flex-1 p-2.5" style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", borderLeft: `3px solid ${c}` }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: R.tp }}>{curGoals[k] || 0}</div>
                  <div style={{ fontSize: "10px", color: R.tm }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Search — filters this tab's clients */}
            <div className="flex items-center gap-2 mt-3">
              <SearchBox value={clientSearch} onChange={setClientSearch} placeholder="Search clients" />
              {clientSearch.trim() && (
                <span className="shrink-0" style={{ fontSize: "10px", fontWeight: 600, color: R.blue, backgroundColor: R.blueLight, borderRadius: R.rBadge, padding: "4px 8px", letterSpacing: "-0.2px", whiteSpace: "nowrap" }}>
                  {clientRows.length} {clientRows.length === 1 ? "match" : "matches"}
                </span>
              )}
            </div>

            {/* Client table */}
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid #EEF2F6", height: "230px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {clientRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3">
                  <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a7 7 0 0114 0v1" /></svg>
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>{clientSearch.trim() ? `No clients match “${clientSearch.trim()}”` : "No clients in this group"}</div>
                    {clientSearch.trim() && (
                      <button onClick={() => setClientSearch("")} className="cursor-pointer mt-2" style={{ border: "none", background: R.blueLight, color: R.blue, fontSize: "11px", fontWeight: 600, borderRadius: R.rBadge, padding: "4px 10px" }}>Clear search</button>
                    )}
                  </div>
                </div>
              ) : (
              <AccTable rows={clientRows} pageSize={CLIENT_PAGE_SIZE} resetKey={`${clientSearch}|${activeTab}`} cols={[
                { key: "name", label: "Client", val: r => r.name || "—" },
                { key: "profile_id", label: "Profile ID", val: r => r.profile_id || "—", className: "text-muted font-mono" },
                // Assigned trainer from get_group_details (client.trainer): name on top,
                // partner_code underneath. Falls back to the owning admin when no trainer is assigned.
                { key: "trainer_name", label: "Trainer", val: r => r.trainer_name || r.trainer_code || "—", render: r => (r.trainer_name || r.trainer_code) ? (
                  <div>
                    <div style={{ color: R.ts }}>{r.trainer_name || "—"}</div>
                    {r.trainer_code ? <div className="font-mono" style={{ fontSize: "11px", color: R.td }}>{r.trainer_code}</div> : null}
                  </div>
                ) : <span style={{ color: R.td }}>—</span> },
                { key: "fitness_goal", label: "Goal", val: r => goalLabel(r.fitness_goal), render: r => <span style={{ fontSize: "11px", fontWeight: 500, padding: "3px 10px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
                { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
                { key: "readingDays", label: "Tests", align: "center", val: r => r.readingDays ?? 0 },
                { key: "metabolism_score", label: "Score", align: "center", val: r => r.metabolism_score ?? null, render: r => r.metabolism_score != null ? <span style={{ fontWeight: 600, color: R.tp }}>{Math.round(r.metabolism_score)}</span> : <span style={{ color: R.td }}>—</span> },
                { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
              ]} />
              )}
            </div>
            <div className="mt-2" style={deltaStyle(readingsWeekDelta)}>
              <DeltaArrow v={readingsWeekDelta} />{Math.abs(readingsWeekDelta)} readings this week vs last week
            </div>
          </div>

          {/* Reading Rate Cohorts — 2-column layout */}
          <div className="p-5 analytics-card-animate" style={CS}
            onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
            onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

            <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Reading Rate Cohorts</h2>
            <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Clients grouped by reading rate — and the trainers coaching each tier.</p>

            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "28px", marginTop: "16px" }}>

              {/* Left: Distribution chart */}
              <div className="flex flex-col gap-2 pt-1">
                {cohortData.map((tier, i) => {
                  const active = cohortTab === i;
                  const barPct = maxCohortCount > 0 ? Math.max((tier.count / maxCohortCount) * 100, tier.count > 0 ? 8 : 0) : 0;
                  return (
                    <div key={i} className="cursor-pointer" onClick={() => setCohortTab(i)}
                      style={{ padding: "6px 10px", borderRadius: "10px", transition: "all 0.2s", backgroundColor: active ? `${tier.color}08` : "transparent", border: active ? `1px solid ${tier.color}20` : "1px solid transparent" }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: "5px" }}>
                        <span style={{ fontSize: "11px", fontWeight: active ? 700 : 500, color: active ? tier.color : R.ts }}>{tier.label}</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: active ? tier.color : R.tp }}>{tier.count} <span style={{ fontSize: "10px", fontWeight: 500, color: R.tm }}>({tier.pctOfTotal}%)</span></span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
                        <div style={{ width: `${barPct}%`, height: "100%", borderRadius: "3px", backgroundColor: tier.color, opacity: active ? 1 : 0.5, transition: "all 0.3s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right: Selected cohort table */}
              <div style={{ borderLeft: "1px solid #EEF2F6", paddingLeft: "24px", display: "flex", flexDirection: "column" }}>
                {cohortData[cohortTab] ? (
                  cohortData[cohortTab].count === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                      <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>No one in this cohort</div>
                        <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>No trainers or clients fall in this range</div>
                      </div>
                    </div>
                  ) : (<>
                    <div className="flex gap-1 p-1 mb-3" style={{ backgroundColor: "#F1F5F9", borderRadius: "8px", alignSelf: "flex-start" }}>
                      {[
                        { key: "trainers", label: "Trainers", count: cohortData[cohortTab].trainersIn.length },
                        { key: "clients", label: "Clients", count: cohortData[cohortTab].clientsIn.length },
                      ].map(t => (
                        <button key={t.key} onClick={() => setCohortSubTab(t.key)} className="cursor-pointer" style={{
                          padding: "5px 12px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: 600, letterSpacing: "-0.2px", transition: "all 0.2s ease",
                          backgroundColor: cohortSubTab === t.key ? "#ffffff" : "transparent",
                          color: cohortSubTab === t.key ? R.tp : R.tm,
                          boxShadow: cohortSubTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        }}>
                          {t.label} <span style={{ color: cohortSubTab === t.key ? R.blue : R.tm, marginLeft: "2px" }}>{t.count}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ height: "240px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      {cohortSubTab === "trainers" ? (
                        cohortData[cohortTab].trainersIn.length > 0
                          ? <AccTable rows={cohortData[cohortTab].trainersIn} cols={cohortTrainerCols} />
                          : <div className="flex flex-col items-center justify-center gap-2 py-6">
                            <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No trainers in this range</div>
                            <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
                          </div>
                      ) : (
                        cohortData[cohortTab].clientsIn.length > 0
                          ? <AccTable rows={cohortData[cohortTab].clientsIn} cols={clientCols} />
                          : <div className="flex flex-col items-center justify-center gap-2 py-6">
                            <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No clients in this range</div>
                            <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
                          </div>
                      )}
                    </div>
                  </>)
                ) : null}
              </div>

            </div>
          </div>
        </div>

        {/* Trainer Adoption → client list pop-up (portal to <body>, so the card's
            overflow:hidden / hover transform can't clip or offset it). */}
        <TrainerClientsModal open={!!clientsModalTrainer} trainer={clientsModalTrainer} onClose={() => setClientsModalTrainer(null)} />

        {/* ═══ FOOTER ═══ */}
        <div className="flex items-start gap-2.5" style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px", padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #EEF2F6" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span><strong style={{ color: R.ts }}>Active</strong> = Reading rate {"≥"} {ACTIVE_THRESHOLD}% {"·"} <strong style={{ color: R.ts }}>Reading Rate</strong> = Reading days / Days since onboarded {"·"} All clients are counted, including trainer self-test profiles, which also feed trainer adoption.</span>
        </div>
      </div>
    </div>
  );
}











// "use client";

// import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// import { useRouter } from "next/navigation";
// import Calendar from "react-calendar";
// import "react-calendar/dist/Calendar.css";
// import { toast } from "sonner";
// import { useDispatch, useSelector } from "react-redux";
// import { getAdminGroups, selectAdminGroups, selectAdminGroupsRaw, selectPrimaryGroupName } from "@/store/adminGroupsSlice";
// import { getGroupDetails, selectGroupDetails, selectGroupDetailsLoading, selectGroupCounts } from "@/store/groupDetailsSlice";
// import { fetchGroupPeriodOverviewService } from "@/services/authService";

// const TIMEZONES = { "America/Chicago": "Houston, TX", "Asia/Kolkata": "India (IST)" };
// const DEFAULT_TZ = "America/Chicago";
// const ACTIVE_THRESHOLD = 60;
// const EXECUTIVE_TAS = ["Derek", "Evan"];
// const BLUE = "#308BF9";
// const R = {
//   dark: "#252525", blue: "#308bf9", blueLight: "#e9f3ff",
//   green: "#3faf58", greenLight: "#eaffef", red: "#e74c3c", orange: "#e48326", amber: "#ffbf2d",
//   tp: "#252525", ts: "#535359", tm: "#738298", td: "#a1a1a1",
//   border: "#e1e6ed", surface: "#f5f7fa", white: "#ffffff",
//   rCard: "15px", rBadge: "6px", rPill: "33px",
//   shadow: "0 20px 60px rgba(37,37,37,0.08), 0 6px 16px rgba(37,37,37,0.04), 0 1px 3px rgba(37,37,37,0.03)",
// };

// function tzNow(tz) { return new Date(new Date().toLocaleString("en-US", { timeZone: tz })); }
// function tzTime(tz) { return new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }); }
// function tzDay(tz) { return new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }); }
// function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
// // Local-date parts → "YYYY-MM-DD" (no UTC shift), for the API's overview_date param.
// function toYMD(d) { if (!d) return ""; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
// function fmtRange(r) { if (!r) return ""; return `${fmtDate(r.start)} – ${fmtDate(r.end)}`; }
// function daysBetween(a, b) {
//   const da = new Date(a), db = new Date(b);
//   if (isNaN(da) || isNaN(db)) return 0;
//   return Math.max(0, Math.round((new Date(da.getFullYear(), da.getMonth(), da.getDate()) - new Date(db.getFullYear(), db.getMonth(), db.getDate())) / -86400000));
// }

// const COHORTS = [90, 70, 50, 25, 10];
// function getCohort(pct) { for (const t of COHORTS) if (pct >= t) return `${t}%+`; return "<10%"; }
// function goalColor(g) { if (!g) return R.tm; const l = g.toLowerCase(); if (l.includes("fat")) return R.orange; if (l.includes("loss")) return R.red; if (l.includes("gain") || l.includes("muscle")) return R.green; return R.blue; }
// function goalLabel(g) { if (!g) return "—"; const l = g.toLowerCase(); if (l.includes("fat")) return "Fat Loss"; if (l.includes("weight")) return "Weight Loss"; if (l.includes("muscle") || l.includes("gain")) return "Muscle Gain"; return g; }

// function isMaskedMatch(m, r) {
//   if (!m || !r) return false;
//   const mp = m.toLowerCase().split("@"), rp = r.toLowerCase().split("@");
//   if (mp.length !== 2 || rp.length !== 2 || mp[1] !== rp[1]) return false;
//   if (mp[0].length < 2 || rp[0].length < 2) return false;
//   return mp[0][0] === rp[0][0] && mp[0][1] === rp[0][1] && mp[0].slice(-1) === rp[0].slice(-1);
// }
// function isMaskedNameMatch(m, r) {
//   if (!m || !r) return false;
//   const mw = m.toLowerCase().trim().split(/\s+/), rw = r.toLowerCase().trim().split(/\s+/);
//   if (!mw.length || mw.length !== rw.length) return false;
//   return mw.every((w, i) => w.length >= 2 && rw[i].length >= 2 && w[0] === rw[i][0] && w[1] === rw[i][1] && w.slice(-1) === rw[i].slice(-1));
// }
// function isSelfTest(client, trainers) {
//   const ce = (client.email || "").toLowerCase().trim(), cn = (client.name || "").trim();
//   return trainers.some(t => { const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
// }

// function getPeriodRange(p, now) {
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   if (p === "today") return { start: today, end: today };
//   if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); return { start: m, end: today }; }
//   if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
//   return null;
// }
// function getPrevRange(p, now) {
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   if (p === "today") { const y = new Date(today); y.setDate(y.getDate() - 1); return { start: y, end: y }; }
//   if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); const ps = new Date(m); ps.setDate(m.getDate() - 1); const pm = new Date(ps); pm.setDate(ps.getDate() - 6); return { start: pm, end: ps }; }
//   if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 0) };
//   return null;
// }
// function inRange(ds, r) { if (!r) return true; if (!ds) return false; const d = new Date(ds); if (isNaN(d)) return false; const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return day >= r.start && day <= r.end; }
// // Every calendar day in an inclusive {start,end} range, as Date objects. Used to
// // fan out one period_overview call per day (the API only scopes a single day).
// function daysInRange(r) { if (!r) return []; const out = []; const d = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate()); const end = new Date(r.end.getFullYear(), r.end.getMonth(), r.end.getDate()); let guard = 0; while (d <= end && guard < 366) { out.push(new Date(d)); d.setDate(d.getDate() + 1); guard++; } return out; }
// function prevLbl(p, now) { if (p === "custom") return "prev day"; if (p === "today") return "yesterday"; if (p === "week") return "last week"; if (p === "month") return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", { month: "short" }); return null; }

// function periodMetrics(clients, trainers, rdm, range) {
//   const nT = !range ? trainers.length : trainers.filter(t => inRange(t.created_at, range)).length;
//   const nC = !range ? clients.length : clients.filter(c => inRange(c.onboardedDate, range)).length;
//   // A trainer's own device readings live on their self-reading profile. That
//   // profile can ALSO surface as a client row (a self-test returned in clients[]),
//   // so we attribute those reads to the trainer bucket and skip them in the client
//   // loop below — the read is counted exactly once.
//   const trainerSelfPids = new Set((trainers || []).map(t => t.selfProfileId).filter(Boolean));
//   const countIn = pid => { const d = rdm[pid] || []; return !range ? d.length : d.filter(x => inRange(x.date, range)).length; };
//   let clientReads = 0, readers = 0;
//   clients.forEach(c => {
//     if (trainerSelfPids.has(c.profile_id)) return; // counted as a trainer read
//     const n = countIn(c.profile_id);
//     clientReads += n; if (n > 0) readers++;
//   });
//   let trainerReads = 0;
//   trainerSelfPids.forEach(pid => { trainerReads += countIn(pid); });
//   const reads = clientReads + trainerReads;
//   return { newTrainers: nT, newClients: nC, reads, clientReads, trainerReads, readers, adoption: clients.length > 0 ? Math.round((readers / clients.length) * 100) : 0 };
// }

// function pctChange(cur, prev) {
//   if (prev === 0 && cur === 0) return { val: 0, label: "0%" };
//   if (prev === 0) return { val: 100, label: "100%" };
//   const v = Math.round(((cur - prev) / prev) * 100);
//   return { val: v, label: `${Math.abs(v)}%` };
// }

// /* ══════════════════════════════════════════════════════════════════════
//    REAL DATA ADAPTER — get_group_details.php
//    Maps the GETGROUPDETAILS response into the shape the dashboard renders from:
//      group_members (admins) → Trainer-Admin tabs (taList)
//      trainers               → trainers under their parent admin (trainersMap)
//      clients                → attributed to a TA via owner code (allClients)
//      trainers/clients total_tests → Tests count + reading-rate numerator
//      latest_test.date_time  → anchors the "today / this period" reads
//    The API gives test COUNTS (total_tests) but not per-test DATES, so count- and
//    rate-based metrics are exact while period/"today" reads use the latest test only.
//    ══════════════════════════════════════════════════════════════════════ */
// function buildFromGroupDetails(gd, now = new Date()) {
//   const taList = [];
//   const trainersMap = {};
//   const allClients = [];
//   const readingDatesMap = {};

//   const members = Array.isArray(gd?.group_members) ? gd.group_members : [];
//   const trainers = Array.isArray(gd?.trainers) ? gd.trainers : [];
//   const clients = Array.isArray(gd?.clients) ? gd.clients : [];

//   // Group members flagged "admin" become the Trainer-Admin tabs. If none are
//   // flagged, treat every member as an admin so the dashboard still populates.
//   const admins = members.filter(m => (m.role || "").toLowerCase() === "admin");
//   const taMembers = admins.length ? admins : members;

//   // Group members (admins) are NEVER clients. Any client profile whose email
//   // matches a group member's email is the admin themselves, not a real client,
//   // and must be excluded from all client lists/counts.
//   const memberEmails = new Set(members.map(m => (m.email || "").toLowerCase().trim()).filter(Boolean));
//   // Email → member, so an admin's own self-test profile (a client row matching
//   // their email) can be attributed back to that admin's dietician code.
//   const memberByEmail = new Map(members.filter(m => m.email).map(m => [(m.email || "").toLowerCase().trim(), m]));

//   // Admins are ALSO returned inside `trainers[]` (role: "admin", null parent) and
//   // are counted in `counts.trainers`. They ARE their group's Trainer-Admin tabs,
//   // but an admin can personally coach clients and take readings, so we now also
//   // surface them as trainer rows in the Trainer Adoption list (see adminEntry
//   // below). Nothing is dropped from the trainer total — counts.trainers already
//   // includes them, and each admin appears exactly once as a trainer row.
//   const excludedTrainerAdminCount = 0;

//   taMembers.forEach(m => {
//     const uid = m.dietician_id || m.email;
//     taList.push({
//       user_id: uid,
//       name: m.name && m.name !== "NA" ? m.name : (m.email || "—"),
//       email: m.email || "",
//       partner_code: m.dietician_id || "",
//       created_at: m.created_at || null, // admin join date (added to group_members by the backend)
//     });

//     // Trainers whose parent admin is this member.
//     const myTrainers = trainers
//       .filter(t => (t.parent_admin_email || "").toLowerCase() === (m.email || "").toLowerCase())
//       .map(t => ({
//         user_id: t.partner_code,
//         name: t.name && t.name !== "NA" ? t.name : (t.email || "—"),
//         email: t.email || "",
//         partner_code: t.partner_code || "",
//         dietician_id: t.partner_code || "",
//         created_at: t.created_at || null,
//         total_tests: typeof t.total_tests === "number" ? t.total_tests : null,
//         total_clients: typeof t.total_clients === "number" ? t.total_clients : null,
//         total_tested_clients: typeof t.total_tested_clients === "number" ? t.total_tested_clients : null,
//         // The trainer's OWN device tests (self-readings), straight from the backend.
//         self_reading_tests: typeof t.self_reading?.total_tests === "number" ? t.self_reading.total_tests : null,
//         // The backend-authoritative profile_id of the trainer's own self-reading (null
//         // if they have none). This — NOT a name/email guess — is the only profile that
//         // may be excluded from the cohort as a trainer self-test.
//         self_reading_profile_id: t.self_reading?.profile_id || null,
//         is_self: false,
//       }));

//     // The admin themselves, surfaced as a trainer row (is_self:false → shown in the
//     // Trainer Adoption list) so admins like Derek/Evan appear alongside their team,
//     // with their OWN totals (clients coached, tests taken, tested clients). Their
//     // dietician code stays in the code set, so admin-owned clients still attribute
//     // to this TA. Blank email → no client is mis-detected as the admin's self-test
//     // (admin self-test profiles are already excluded upstream and tracked in
//     // adminSelfByCode). is_admin flags the row for any admin-specific presentation.
//     const adminEntry = {
//       user_id: `admin_${uid}`,
//       name: m.name && m.name !== "NA" ? m.name : (m.email || "—"),
//       email: "",
//       partner_code: m.dietician_id || "",
//       dietician_id: m.dietician_id || "",
//       created_at: m.created_at || null,
//       total_tests: typeof m.total_tests === "number" ? m.total_tests : null,
//       total_clients: typeof m.total_clients === "number" ? m.total_clients : null,
//       total_tested_clients: typeof m.total_tested_clients === "number" ? m.total_tested_clients : null,
//       // The admin's OWN device tests (self-readings), straight from the backend.
//       self_reading_tests: typeof m.self_reading?.total_tests === "number" ? m.self_reading.total_tests : null,
//       // Backend-authoritative profile_id of the admin's own self-reading (see trainer note).
//       self_reading_profile_id: m.self_reading?.profile_id || null,
//       is_self: false,
//       is_admin: true,
//     };

//     trainersMap[uid] = { trainers: [...myTrainers, adminEntry] };
//   });

//   let excludedAdminCount = 0;
//   // An admin's own device tests: a client row whose email matches a member is the
//   // admin self-testing. Keep it out of the client lists (admins are never clients)
//   // but record the activity so the cohort can show the admin as a trainer when
//   // they've personally taken readings. Keyed by the admin's dietician code.
//   const adminSelfByCode = {};
//   clients.forEach(c => {
//     const pid = c.profile_id;
//     if (!pid) return;
//     const cEmail = (c.email || "").toLowerCase().trim();
//     // Skip admins — a client profile that matches a group member's email is the
//     // admin, not a client — but capture their own test activity first.
//     if (memberEmails.has(cEmail)) {
//       excludedAdminCount++;
//       const code = (memberByEmail.get(cEmail)?.dietician_id || "").toUpperCase();
//       if (code) {
//         const prev = adminSelfByCode[code] || { total_tests: 0, joined: null, latest: null };
//         const joined = c.joined_dttm || c.created_at || null;
//         adminSelfByCode[code] = {
//           total_tests: prev.total_tests + (typeof c.total_tests === "number" ? c.total_tests : 0),
//           joined: prev.joined && joined ? (new Date(prev.joined) <= new Date(joined) ? prev.joined : joined) : (prev.joined || joined),
//           latest: c.latest_test?.date_time || prev.latest,
//         };
//       }
//       return;
//     }
//     allClients.push({
//       profile_id: pid,
//       name: c.profile_name || "—",
//       email: c.email || "",
//       dietitian_id: c.dietician_id || c.owner?.partner_code || "",
//       fitness_goal: c.fitness_goal || "",
//       total_tests: typeof c.total_tests === "number" ? c.total_tests : null,
//       // Latest test's metabolism score (0–100) from get_group_details — the most
//       // recent reading's result, distinct from the reading-frequency Rate %.
//       metabolism_score: typeof c.latest_test?.metabolism_score === "number" ? c.latest_test.metabolism_score : null,
//       associated_dietitian: { name: c.owner?.name || "—" },
//       client: { joined_dttm: c.joined_dttm || c.created_at || null },
//       test_history: { last_test_date_time: c.latest_test?.date_time || null },
//     });
//     // Per-test dates aren't in the response; the latest test anchors period/"today" reads.
//     readingDatesMap[pid] = c.latest_test?.date_time ? [{ date: c.latest_test.date_time }] : [];
//   });

//   // Seed the reading-dates map with each trainer's / admin's OWN self-reading
//   // (its latest_test date, keyed by the self-reading profile id) so period/day
//   // read totals include trainer device usage, not just clients. Skip profiles
//   // already present — a self-test that also came back as a client row keeps its
//   // client entry (same date), so no read is counted twice.
//   const seedSelf = (sr) => {
//     const spid = sr?.profile_id, dt = sr?.latest_test?.date_time;
//     if (!spid || !dt || readingDatesMap[spid]) return;
//     readingDatesMap[spid] = [{ date: dt }];
//   };
//   trainers.forEach(t => seedSelf(t.self_reading));
//   members.forEach(m => seedSelf(m.self_reading));

//   return { taList, trainersMap, allClients, readingDatesMap, excludedAdminCount, excludedTrainerAdminCount, adminSelfByCode };
// }

// const ICO_COLORS = { people: R.blue, person: R.green, "person-add": R.orange, trend: "#7c3aed" };
// function Ico({ type, color }) {
//   const c = color || ICO_COLORS[type] || R.blue;
//   return (
//     <div className="w-10 h-10 flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110" style={{ background: `linear-gradient(135deg, ${c}18, ${c}08)`, borderRadius: R.rCard, border: `1px solid ${c}15` }}>
//       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//         {type === "person" && <><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a7 7 0 0114 0v1" /></>}
//         {type === "people" && <><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-1a5 5 0 0110 0v1" /><circle cx="18" cy="9" r="3" /><path d="M22 21v-1a4 4 0 00-3-3.87" /></>}
//         {type === "person-add" && <><circle cx="10" cy="7" r="3.5" /><path d="M3 21v-1a5 5 0 0110 0" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></>}
//         {type === "trend" && <><polyline points="22 12 18 8 14 12 10 8 2 16" /></>}
//       </svg>
//     </div>
//   );
// }

// function Sparkline({ data, width = 80, height = 28, color = R.blue, filled = true }) {
//   if (!data || data.length < 2) return null;
//   const max = Math.max(...data, 1);
//   const min = Math.min(...data, 0);
//   const range = max - min || 1;
//   const pts = data.map((v, i) => [
//     (i / (data.length - 1)) * width,
//     height - 2 - ((v - min) / range) * (height - 4),
//   ]);
//   const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
//   const area = `${line} L${width},${height} L0,${height} Z`;
//   return (
//     <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
//       {filled && <path d={area} fill={`${color}15`} />}
//       <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
//     </svg>
//   );
// }

// function Donut({ pct, size = 120, thickness = 10, color = R.blue, label, bg, track, textColor }) {
//   const [animPct, setAnimPct] = useState(0);
//   useEffect(() => { const t = setTimeout(() => setAnimPct(pct), 50); return () => clearTimeout(t); }, [pct]);
//   const innerBg = bg || R.white;
//   const trackColor = track || R.surface;
//   const ringBorder = bg ? "none" : `0 0 0 3px ${R.white}, 0 0 0 4px ${R.border}`;
//   return (
//     <div className="flex flex-col items-center gap-1">
//       <div className="rounded-full flex items-center justify-center" style={{ width: size, height: size, background: `conic-gradient(${color} 0% ${animPct}%, ${trackColor} ${animPct}% 100%)`, transition: "background 0.8s ease-out", boxShadow: ringBorder }}>
//         <div className="rounded-full flex items-center justify-center" style={{ width: size - thickness * 2, height: size - thickness * 2, backgroundColor: innerBg }}>
//           <span className="font-extrabold" style={{ fontSize: size * 0.25, color: textColor || R.tp, letterSpacing: "-0.4px" }}>{animPct}%</span>
//         </div>
//       </div>
//       {label && <span style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{label}</span>}
//     </div>
//   );
// }

// function AccTable({ rows, cols }) {
//   const [sort, setSort] = useState({ key: null, asc: true });
//   const sorted = sort.key ? [...rows].sort((a, b) => {
//     const av = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(a) : a[sort.key];
//     const bv = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(b) : b[sort.key];
//     if (av == null && bv == null) return 0;
//     if (av == null) return 1;
//     if (bv == null) return -1;
//     const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
//     return sort.asc ? cmp : -cmp;
//   }) : rows;
//   const toggle = (key) => setSort(s => s.key === key ? { key, asc: !s.asc } : { key, asc: true });
//   const arrow = (key) => sort.key !== key ? "↕" : sort.asc ? "↑" : "↓";
//   const thBase = { fontWeight: 500, padding: "8px 0", fontSize: "10px", color: R.tm, letterSpacing: "-0.2px", borderBottom: `1px solid ${R.border}` };
//   return (
//     <div style={{ display: "flex", flexDirection: "column", fontSize: "12px", letterSpacing: "-0.24px", flex: 1, minHeight: 0 }}>
//       <div className="uppercase" style={{ display: "flex", backgroundColor: "#ffffff", position: "relative", zIndex: 2, flexShrink: 0 }}>
//         {cols.map(c => (
//           <div key={c.key} className="font-semibold cursor-pointer select-none"
//             style={{ ...thBase, flex: 1, textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" }}
//             onClick={() => toggle(c.key)}>
//             {c.label} <span style={{ fontSize: "9px" }}>{arrow(c.key)}</span>
//           </div>
//         ))}
//       </div>
//       <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
//         {sorted.map((r, i) => (
//           <div key={i} className="transition-colors duration-150" style={{ display: "flex", borderBottom: `1px solid ${R.surface}`, backgroundColor: i % 2 === 1 ? `${R.surface}80` : "transparent", cursor: "default" }}
//             onMouseEnter={e => e.currentTarget.style.backgroundColor = `${R.blueLight}60`}
//             onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 1 ? `${R.surface}80` : "transparent"}>
//             {cols.map(c => (
//               <div key={c.key} style={{ flex: 1, padding: "8px 0", textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left", color: c.className?.includes("text-muted") || c.className?.includes("text-secondary") ? R.ts : R.tp }}>
//                 {c.render ? c.render(r) : (typeof c.val === "function" ? c.val(r) : r[c.key])}
//               </div>
//             ))}
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// export default function AnalyticsDashboard() {
//   const dispatch = useDispatch();
//   const router = useRouter();
//   // MANAGEADMINGROUPS response — captured at login into Redux (setAdminGroups),
//   // re-fetched here if the in-memory store was reset (e.g. hard refresh).
//   const adminGroups = useSelector(selectAdminGroups);
//   const adminGroupsRaw = useSelector(selectAdminGroupsRaw);
//   // group_name for get_group_details comes from the MANAGEADMINGROUPS response.
//   const primaryGroupName = useSelector(selectPrimaryGroupName);
//   const groupDetails = useSelector(selectGroupDetails);
//   const groupDetailsLoading = useSelector(selectGroupDetailsLoading);
//   // Authoritative group totals { members, trainers, clients } from the response.
//   const groupCounts = useSelector(selectGroupCounts);
//   // Reading counts for the selected period, summed from the API's per-day
//   // period_overview. The backend scopes period_overview to a single overview_date,
//   // so W/M totals are built by fanning out one call per day in the range.
//   const [periodReads, setPeriodReads] = useState({ total: 0, trainer: 0, client: 0, loading: false, scope: null });
//   const [readsNonce, setReadsNonce] = useState(0);

//   // Entire GETGROUPDETAILS response stored on this page (all client pages merged).
//   const [groupDetailsResponse, setGroupDetailsResponse] = useState(null);

//   const [taList, setTaList] = useState([]);
//   const [trainersMap, setTrainersMap] = useState({});
//   const [allClients, setAllClients] = useState([]);
//   const [readingDatesMap, setReadingDatesMap] = useState({});
//   // Clients dropped because their email matched a group member (admin). Subtracted
//   // from the backend's authoritative client count so admins are never counted.
//   const [excludedAdminCount, setExcludedAdminCount] = useState(0);
//   // Admins are returned inside trainers[] and counted in counts.trainers, but are
//   // shown as Trainer-Admin tabs, not trainer rows — subtract them from the total.
//   const [excludedTrainerAdminCount, setExcludedTrainerAdminCount] = useState(0);
//   // Admin (group-member) code → their own self-test activity ({ total_tests, joined }).
//   const [adminSelfByCode, setAdminSelfByCode] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [loadingPhase, setLoadingPhase] = useState("Connecting...");
//   const [error, setError] = useState(null);
//   const [activeTab, setActiveTab] = useState("overview");
//   const [tabDdOpen, setTabDdOpen] = useState(false);
//   const tabDdRef = useRef(null);
//   const [period, setPeriod] = useState("today");
//   // A specific calendar day picked from the world-clock calendar. When set (and
//   // period === "custom") the Period Overview filters every metric to just that day.
//   const [selectedDate, setSelectedDate] = useState(null);
//   const compare = true;
//   const [timezone, setTimezone] = useState(DEFAULT_TZ);
//   const [clock, setClock] = useState("");
//   const [calOpen, setCalOpen] = useState(false);
//   const [nowTick, setNowTick] = useState(() => 0);
//   const calRef = useRef(null);
//   const [openAcc, setOpenAcc] = useState(new Set());
//   const [trainerTab, setTrainerTab] = useState("all");
//   const [cohortTab, setCohortTab] = useState(0);
//   const [cohortSubTab, setCohortSubTab] = useState("trainers");
//   // Trainers the admin has temporarily removed via the Trainer Adoption checkbox.
//   // A removed trainer — and every client coached under their dietician code —
//   // drops out of all downstream metrics (Client Engagement, cohorts, period
//   // reads). Purely client-side/session: nothing is persisted to the backend.
//   const [removedTrainerKeys, setRemovedTrainerKeys] = useState(() => new Set());
//   const toggleTrainerRemoved = (key) => setRemovedTrainerKeys(prev => {
//     const next = new Set(prev);
//     next.has(key) ? next.delete(key) : next.add(key);
//     return next;
//   });

//   useEffect(() => {
//     const tick = () => setClock(new Date().toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }));
//     tick();
//     const id = setInterval(tick, 10000);
//     return () => clearInterval(id);
//   }, [timezone]);

//   useEffect(() => {
//     const handler = (e) => { if (tabDdRef.current && !tabDdRef.current.contains(e.target)) setTabDdOpen(false); };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   // Close the world-clock calendar on outside click / Escape.
//   useEffect(() => {
//     if (!calOpen) return;
//     const onDown = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setCalOpen(false); };
//     const onKey = (e) => { if (e.key === "Escape") setCalOpen(false); };
//     document.addEventListener("mousedown", onDown);
//     document.addEventListener("keydown", onKey);
//     return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
//   }, [calOpen]);

//   // Tick every second so the live times inside the open calendar stay current.
//   useEffect(() => {
//     if (!calOpen) return;
//     const id = setInterval(() => setNowTick(t => t + 1), 1000);
//     return () => clearInterval(id);
//   }, [calOpen]);

//   const loadData = useCallback(async () => {
//     setError(null);
//     try {
//       const now = new Date();
//       let source;
//       if (groupDetails) {
//         // Real data from get_group_details.php.
//         source = buildFromGroupDetails(groupDetails, now);
//       } else if (primaryGroupName) {
//         // We know which group to load but its details haven't arrived yet —
//         // keep the loader up; this effect re-runs once groupDetails lands.
//         setLoading(true);
//         return;
//       } else {
//         // No admin group in context — nothing to show.
//         source = { taList: [], trainersMap: {}, allClients: [], readingDatesMap: {}, excludedAdminCount: 0, excludedTrainerAdminCount: 0, adminSelfByCode: {} };
//       }
//       setTaList(source.taList);
//       setTrainersMap(source.trainersMap);
//       setAllClients(source.allClients);
//       setReadingDatesMap(source.readingDatesMap);
//       setExcludedAdminCount(source.excludedAdminCount || 0);
//       setExcludedTrainerAdminCount(source.excludedTrainerAdminCount || 0);
//       setAdminSelfByCode(source.adminSelfByCode || {});
//       setLoading(false);
//     } catch (e) {
//       setError(e?.message || "Failed to load");
//       toast.error(e?.message || "Failed");
//       setLoading(false);
//     }
//   }, [groupDetails, primaryGroupName]);

//   useEffect(() => { loadData(); }, [loadData]);

//   // If the MANAGEADMINGROUPS payload wasn't handed off from login (e.g. the user
//   // hard-refreshed this page and the in-memory Redux store reset), re-fetch it.
//   useEffect(() => {
//     if (!adminGroupsRaw) dispatch(getAdminGroups());
//   }, [adminGroupsRaw, dispatch]);

//   // The stored MANAGEADMINGROUPS response is now available to this dashboard via
//   // `adminGroups` (response.groups) and `adminGroupsRaw` (full payload).
//   useEffect(() => {
//     if (adminGroupsRaw) console.log("Admin groups (from Redux):", adminGroupsRaw);
//   }, [adminGroupsRaw]);

//   // Once we know the group name (from Redux), pull that group's details. Use a
//   // high limit so every client loads in one shot — the dashboard's totals are
//   // derived from the loaded set, so partial pages would under-count. This payload
//   // (clients/trainers/counts) is all-time, so it does NOT depend on the selected
//   // period — the period readings are fetched separately below.
//   useEffect(() => {
//     if (primaryGroupName) {
//       dispatch(getGroupDetails({ groupName: primaryGroupName, page: 1, limit: 50, search: "", fetchAll: true }));
//     }
//   }, [primaryGroupName, dispatch]);

//   // Refresh button: re-fetch the group from the API when we have a group name,
//   // otherwise just rebuild from whatever is in state. Bump readsNonce so the
//   // period-readings aggregation re-runs too.
//   const handleRefresh = useCallback(() => {
//     setReadsNonce(n => n + 1);
//     if (primaryGroupName) {
//       dispatch(getGroupDetails({ groupName: primaryGroupName, page: 1, limit: 50, search: "", fetchAll: true }));
//     } else {
//       loadData();
//     }
//   }, [primaryGroupName, dispatch, loadData]);

//   useEffect(() => {
//     if (groupDetails) {
//       // Store the entire GETGROUPDETAILS response in a page-level variable.
//       setGroupDetailsResponse(groupDetails);
//       console.log("GETGROUPDETAILS response:", groupDetails);
//     }
//   }, [groupDetails]);

//   // The admin whose readings the Period Overview is scoped to: the selected TA tab's
//   // partner_code, or "" on the Overview tab (whole group = all members, the default).
//   // Sent to the API as overview_member. Uppercased to match the network_codes casing.
//   const overviewMemberCode = useMemo(() => {
//     if (activeTab === "overview") return "";
//     const m = taList.find(t => t.user_id === activeTab);
//     return m?.partner_code ? String(m.partner_code).toUpperCase() : "";
//   }, [activeTab, taList]);

//   // Period-readings aggregation. period_overview is a single-day snapshot server-side
//   // (scoped by overview_date + optional overview_member), so a week/month total is the
//   // SUM of each day's snapshot across the period range. Fan out one lightweight call
//   // per day and add them up. D/custom = 1 day (1 call); W = Mon→today; M = 1st→today.
//   useEffect(() => {
//     if (!primaryGroupName) { setPeriodReads({ total: 0, trainer: 0, client: 0, loading: false, scope: null }); return; }
//     const tnow = tzNow(timezone);
//     const range = period === "custom" && selectedDate
//       ? (() => { const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()); return { start: d, end: d }; })()
//       : (getPeriodRange(period, tnow) || getPeriodRange("today", tnow));
//     const days = daysInRange(range);
//     let cancelled = false;
//     setPeriodReads(p => ({ ...p, loading: true }));
//     Promise.all(days.map(d => fetchGroupPeriodOverviewService({ groupName: primaryGroupName, overviewDate: toYMD(d), overviewMember: overviewMemberCode }).catch(() => null)))
//       .then(results => {
//         if (cancelled) return;
//         const sum = results.reduce((a, po) => ({
//           total: a.total + (po?.total_readings || 0),
//           trainer: a.trainer + (po?.trainer_readings || 0),
//           client: a.client + (po?.client_readings || 0),
//         }), { total: 0, trainer: 0, client: 0 });
//         // Scope is identical across the range's days; keep the first non-null one.
//         const scope = results.find(po => po?.scope)?.scope || null;
//         setPeriodReads({ ...sum, loading: false, scope });
//       })
//       .catch(() => { if (!cancelled) setPeriodReads(p => ({ ...p, loading: false })); });
//     return () => { cancelled = true; };
//   }, [primaryGroupName, period, selectedDate, timezone, overviewMemberCode, readsNonce]);

//   const now = tzNow(timezone);

//   const computeTa = useCallback((ta) => {
//     if (!ta) return null;
//     const all = (trainersMap[ta.user_id] || { trainers: [] }).trainers;
//     const nonSelf = all.filter(t => !t.is_self);
//     const codes = new Set(all.map(t => (t.partner_code || t.dietician_id || "").toUpperCase()));
//     const taCl = allClients.filter(c => codes.has((c.dietitian_id || c.partner_code || "").toUpperCase()));
//     // Show ALL clients owned by this TA's codes — including profiles whose
//     // email/name matches a trainer (previously hidden as "self-tests").
//     const real = taCl;
//     // Still identify self-test profiles so each trainer's own test activity /
//     // adoption is computed from their self-profile below.
//     const selfT = taCl.filter(c => isSelfTest(c, all));

//     const enrich = c => {
//       const dates = readingDatesMap[c.profile_id] || [];
//       // Prefer the API's authoritative test count; fall back to reading dates (mock).
//       const rd = c.total_tests != null ? c.total_tests : dates.length;
//       const sorted = dates.map(d => d.date).filter(Boolean).sort();
//       const last = sorted.length ? sorted[sorted.length - 1] : null;
//       const onb = c.client?.joined_dttm || (sorted.length ? sorted[0] : null);
//       const lastT = c.test_history?.last_test_date_time || last;
//       const ds = onb ? daysBetween(onb, now) : 0;
//       const pct = ds > 0 ? Math.min(100, Math.round((rd / ds) * 100)) : 0;
//       const code = (c.dietitian_id || "").toUpperCase();
//       const tr = all.find(t => (t.partner_code || t.dietician_id || "").toUpperCase() === code);
//       return { ...c, trainerName: tr?.name || c.associated_dietitian?.name || "—", readingDays: rd, onboardedDate: onb, daysSince: ds, pct, cohort: getCohort(pct), lastDate: lastT };
//     };

//     const clients = real.map(enrich).sort((a, b) => b.pct - a.pct);
//     const trainers = nonSelf.map(t => {
//       const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim();
//       const tc = (t.partner_code || t.dietician_id || "").toUpperCase();
//       const sc = selfT.find(c => { const ce = (c.email || "").toLowerCase().trim(), cn = (c.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
//       const allDates = sc ? (readingDatesMap[sc.profile_id] || []) : [];
//       const ds = t.created_at ? daysBetween(t.created_at, now) : 0;
//       const dates = t.created_at ? allDates.filter(d => !d.date || new Date(d.date) >= new Date(new Date(t.created_at).getFullYear(), new Date(t.created_at).getMonth(), new Date(t.created_at).getDate())) : allDates;
//       // Prefer the API's authoritative counts; fall back to derived values (mock).
//       const rd = t.total_tests != null ? t.total_tests : dates.length;
//       // The trainer's OWN tests — prefer the backend's authoritative self_reading count;
//       // fall back to their self-test client profile (sc). 0 if neither is available.
//       const selfTests = t.self_reading_tests != null
//         ? t.self_reading_tests
//         : (sc ? (sc.total_tests != null ? sc.total_tests : (readingDatesMap[sc.profile_id] || []).length) : 0);
//       // Rate = the trainer's OWN tests (self_reading.total_tests) ÷ days since they joined
//       // (created_at), as a percentage capped at 100. ~1 self-test/day ⇒ 100%.
//       const pct = ds > 0 ? Math.min(100, Math.round((selfTests / ds) * 100)) : 0;
//       const realClientCount = t.total_clients != null ? t.total_clients : clients.filter(c => (c.dietitian_id || "").toUpperCase() === tc).length;
//       // Clients under this trainer who have taken at least one test (backend-authoritative; fall back to deriving from reads).
//       const testedClientCount = t.total_tested_clients != null ? t.total_tested_clients : clients.filter(c => (c.dietitian_id || "").toUpperCase() === tc && (c.readingDays || 0) > 0).length;
//       // selfProfileId identifies the trainer's OWN reading device so the cohort
//       // people-axis and the readings split can separate it from real clients. Use the
//       // backend's authoritative self_reading.profile_id — a name/email match (sc)
//       // produces false positives when a real client shares the trainer's name (e.g. a
//       // trainer who also coaches clients under their own code), wrongly dropping active
//       // clients from the cohort.
//       const selfProfileId = t.self_reading_profile_id || null;
//       return { ...t, daysSince: ds, readingDays: rd, selfTests, pct, cohort: getCohort(pct), realClientCount, testedClientCount, hasSelfTest: !!selfProfileId, selfProfileId };
//     }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount);

//     const goals = { weight_loss: 0, fat_loss: 0, muscle_gain: 0 };
//     clients.forEach(c => { const g = (c.fitness_goal || "").toLowerCase(); if (g in goals) goals[g]++; });
//     return { ta, trainers, clients, totalTrainers: nonSelf.length, activeTrainers: trainers.filter(t => t.pct >= ACTIVE_THRESHOLD).length, totalClients: clients.length, activeClients: clients.filter(c => c.pct >= ACTIVE_THRESHOLD).length, goals };
//   }, [trainersMap, allClients, readingDatesMap, now]);

//   const taData = useMemo(() => { const m = {}; taList.forEach(ta => { m[ta.user_id] = computeTa(ta); }); return m; }, [taList, computeTa]);
//   const allTrainers = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.trainers.map(t => ({ ...t, taName: ta.name })) : []; }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount), [taList, taData]);
//   const allRealClients = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.clients : []; }).sort((a, b) => b.pct - a.pct), [taList, taData]);
//   const totals = useMemo(() => {
//     const v = Object.values(taData).filter(Boolean);
//     return { trainers: v.reduce((s, x) => s + x.totalTrainers, 0), activeT: v.reduce((s, x) => s + x.activeTrainers, 0), clients: v.reduce((s, x) => s + x.totalClients, 0), activeC: v.reduce((s, x) => s + x.activeClients, 0), goals: { fat_loss: v.reduce((s, x) => s + x.goals.fat_loss, 0), muscle_gain: v.reduce((s, x) => s + x.goals.muscle_gain, 0), weight_loss: v.reduce((s, x) => s + x.goals.weight_loss, 0) } };
//   }, [taData]);

//   const selTa = activeTab !== "overview" ? taList.find(t => t.user_id === activeTab) : null;
//   const selData = selTa ? taData[selTa.user_id] : null;
//   // Unfiltered lists for the current scope. The Trainer Adoption "All" tab renders
//   // from rawTabTr so removed trainers stay visible (and re-checkable); every metric
//   // downstream uses the filtered tabTr/tabCl below.
//   const rawTabCl = activeTab === "overview" ? allRealClients : (selData?.clients || []);
//   const rawTabTr = activeTab === "overview" ? allTrainers : (selData?.trainers || []);
//   // Dietician codes belonging to the removed trainers — used to drop their clients.
//   const removedCodes = useMemo(() => {
//     const s = new Set();
//     rawTabTr.forEach(t => {
//       if (!removedTrainerKeys.has(t.user_id)) return;
//       const code = (t.partner_code || t.dietician_id || "").toUpperCase();
//       if (code) s.add(code);
//     });
//     return s;
//   }, [rawTabTr, removedTrainerKeys]);
//   const tabTr = useMemo(() => rawTabTr.filter(t => !removedTrainerKeys.has(t.user_id)), [rawTabTr, removedTrainerKeys]);
//   const tabCl = useMemo(() => rawTabCl.filter(c => !removedCodes.has((c.dietitian_id || "").toUpperCase())), [rawTabCl, removedCodes]);
//   const avgActivity = useMemo(() => { if (!tabCl.length) return 0; return Math.round(tabCl.reduce((s, c) => s + c.pct, 0) / tabCl.length); }, [tabCl]);

//   if (loading) return (
//     <div className="flex flex-col items-center justify-center gap-5" style={{ height: "calc(100vh - 130px)" }}>
//       <div className="flex items-center gap-2">
//         {[0, 1, 2].map(i => (
//           <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: R.blue, animation: `loaderBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
//         ))}
//       </div>
//       <div style={{ fontSize: "13px", color: R.ts, fontWeight: 500, letterSpacing: "-0.26px" }}>{loadingPhase}</div>
//     </div>
//   );

//   if (error) return (
//     <div className="flex flex-col items-center justify-center gap-3" style={{ height: "calc(100vh - 130px)" }}>
//       <div className="max-w-md text-center" style={{ background: "#fef2f2", border: `1px solid ${R.red}30`, color: R.red, borderRadius: R.rCard, padding: "16px", fontSize: "13px", letterSpacing: "-0.26px" }}>{error}</div>
//       <button onClick={handleRefresh} className="cursor-pointer" style={{ borderRadius: R.rPill, background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 20px", letterSpacing: "-0.24px", border: "none" }}>Retry</button>
//     </div>
//   );

//   // Overview Trainers/Clients totals come from the authoritative `counts` in the
//   // GETGROUPDETAILS response, falling back to the derived totals (demo/mock).
//   const tTotal = activeTab === "overview" ? Math.max(0, (groupCounts?.trainers ?? totals.trainers) - excludedTrainerAdminCount) : (selData?.totalTrainers ?? 0);
//   const tActive = activeTab === "overview" ? totals.activeT : (selData?.activeTrainers ?? 0);
//   // Subtract admin profiles that the backend counted as clients (0 if it already excluded them).
//   const cTotal = activeTab === "overview" ? Math.max(0, (groupCounts?.clients ?? totals.clients) - excludedAdminCount) : (selData?.totalClients ?? 0);
//   const cActive = activeTab === "overview" ? totals.activeC : (selData?.activeClients ?? 0);
//   const curGoals = activeTab === "overview" ? totals.goals : (selData?.goals || { fat_loss: 0, muscle_gain: 0, weight_loss: 0 });

//   // A calendar-picked date becomes a single-day "custom" period; its comparison
//   // baseline is the day before. Otherwise the D/W/M period anchors to `now`.
//   const customDay = period === "custom" && selectedDate
//     ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
//     : null;
//   const range = customDay ? { start: customDay, end: customDay } : getPeriodRange(period, now);
//   const prevR = customDay
//     ? (() => { const p = new Date(customDay); p.setDate(customDay.getDate() - 1); return { start: p, end: p }; })()
//     : (compare ? getPrevRange(period, now) : null);
//   const pm = periodMetrics(tabCl, tabTr, readingDatesMap, range);
//   const ppm = prevR ? periodMetrics(tabCl, tabTr, readingDatesMap, prevR) : null;

//   // Onboarding drill-down: the two "Onboarded" cards open /super-admin/onboarding
//   // (get_group_onboarding) scoped to the SAME window + member the dashboard is on.
//   const onbRange = range || getPeriodRange("today", now);
//   const periodWord = period === "week" ? "this week" : period === "month" ? "this month" : period === "custom" ? "on this day" : "today";
//   const openOnboarding = (type) => {
//     if (!primaryGroupName) { toast.error("No admin group in context."); return; }
//     const qs = new URLSearchParams({
//       group: primaryGroupName,
//       from: toYMD(onbRange.start),
//       to: toYMD(onbRange.end),
//       type,
//       member: overviewMemberCode || "",
//       label: periodWord,
//     });
//     router.push(`/super-admin/onboarding?${qs.toString()}`);
//   };

//   const adoptionRate = tTotal > 0 ? Math.round((tActive / tTotal) * 100) : 0;
//   const engagementRate = cTotal > 0 ? Math.round((cActive / cTotal) * 100) : 0;
//   const activeTrainers = tabTr.filter(t => t.pct >= ACTIVE_THRESHOLD);
//   const eliteTrainers = tabTr.filter(t => t.pct >= 100);
//   const atRiskTrainers = tabTr.filter(t => t.pct < 30);
//   const eliteCount = eliteTrainers.length;
//   const atRiskTrainerCount = atRiskTrainers.length;
//   const highestRate = tabCl.length > 0 ? Math.max(...tabCl.map(c => c.pct)) : 0;
//   const lowestRate = tabCl.length > 0 ? Math.min(...tabCl.map(c => c.pct)) : 0;

//   const todayR = getPeriodRange("today", now);
//   const yesterdayR = getPrevRange("today", now);
//   const todayStats = periodMetrics(tabCl, tabTr, readingDatesMap, todayR);
//   const yesterdayStats = periodMetrics(tabCl, tabTr, readingDatesMap, yesterdayR);

//   const wkR = getPeriodRange("week", now);
//   const pwkR = getPrevRange("week", now);
//   const wkStats = periodMetrics(tabCl, tabTr, readingDatesMap, wkR);
//   const pwkStats = periodMetrics(tabCl, tabTr, readingDatesMap, pwkR);

//   const trainerWeekDelta = wkStats.newTrainers - pwkStats.newTrainers;
//   const readingsWeekDelta = wkStats.reads - pwkStats.reads;
//   const clientWeekDelta = wkStats.newClients - pwkStats.newClients;

//   const last7Days = (() => {
//     // Trainer self-tests can also appear as client rows; count each profile once
//     // (client loop skips trainer self-profiles; the trainer loop counts them).
//     const trSelf = new Set(tabTr.map(t => t.selfProfileId).filter(Boolean));
//     const days = [];
//     for (let i = 6; i >= 0; i--) {
//       const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
//       const r = { start: d, end: d };
//       let count = 0;
//       tabCl.forEach(c => { if (trSelf.has(c.profile_id)) return; (readingDatesMap[c.profile_id] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
//       tabTr.forEach(t => { if (t.selfProfileId) (readingDatesMap[t.selfProfileId] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
//       days.push(count);
//     }
//     return days;
//   })();

//   const last4WeeksTrainers = (() => {
//     const weeks = [];
//     for (let w = 3; w >= 0; w--) {
//       const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
//       const start = new Date(end); start.setDate(end.getDate() - 6);
//       weeks.push(tabTr.filter(t => inRange(t.created_at, { start, end })).length);
//     }
//     return weeks;
//   })();

//   const last4WeeksClients = (() => {
//     const weeks = [];
//     for (let w = 3; w >= 0; w--) {
//       const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
//       const start = new Date(end); start.setDate(end.getDate() - 6);
//       weeks.push(tabCl.filter(c => inRange(c.onboardedDate, { start, end })).length);
//     }
//     return weeks;
//   })();

//   // Trainer self-test profiles also surface as client rows; this set marks them
//   // so the cohort's people-axis (real clients only) can exclude them.
//   const selfPidSet = new Set(tabTr.map(t => t.selfProfileId).filter(Boolean));
//   const allTimeClientReads = tabCl.reduce((s, c) => s + (c.readingDays || 0), 0);
//   const allTimeTotalReads = allTimeClientReads;
//   // Readings-card split as people counts — mirror the snapshot cards exactly so
//   // the split totals match the Trainers/Clients cards above. Using cTotal (not the
//   // sum of each trainer's total_clients) keeps admin-owned clients — the ones under
//   // the admin's own code, not any non-self trainer — in the client count.
//   const networkTrainerCount = tTotal;
//   const networkClientCount = cTotal;
//   const networkSplitTotal = networkTrainerCount + networkClientCount;
//   // Period reads come from the API's period_overview, summed across the selected
//   // range (see the aggregation effect). No frontend recomputation of the counts
//   // themselves — the Reading Split shows each bucket; trainer + client = total.
//   const periodTotalReads = periodReads.total;
//   const periodTrainerReads = periodReads.trainer;
//   const periodClientReads = periodReads.client;
//   const periodLabel = customDay
//     ? customDay.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase()
//     : period === "today" ? `TODAY (${fmtDate(range?.start).toUpperCase()})`
//       : period === "week" ? `THIS WEEK (${fmtRange(range).toUpperCase()})`
//         : period === "month" ? `THIS MONTH (${fmtRange(range).toUpperCase()})`
//           : "ALL TIME";
//   // Device-Adoption donut is period-scoped: the share of clients who logged a
//   // reading in the selected period (pm.adoption), NOT the all-time avg rate.
//   const adoptionSubLabel = period === "custom" ? "Clients Read That Day"
//     : period === "week" ? "Clients Read This Week"
//       : period === "month" ? "Clients Read This Month"
//         : "Clients Read Today";

//   const CTIERS = [
//     { label: "100%", min: 100, max: 100, color: R.blue },
//     { label: "90% – 99%", min: 90, max: 99, color: R.blue },
//     { label: "70% – 89%", min: 70, max: 89, color: R.blue },
//     { label: "50% – 69%", min: 50, max: 69, color: R.blue },
//     { label: "30% – 49%", min: 30, max: 49, color: R.orange },
//     { label: "<30%", min: 0, max: 29, color: R.red },
//   ];
//   // Bucket clients by their reading rate. Trainer self-test profiles also appear
//   // in tabCl, so exclude them — the cohort's people axis is real clients only.
//   const cohortClients = tabCl.filter(c => !selfPidSet.has(c.profile_id));
//   // Group-member (admin) codes: an admin who directly owns a client is NOT a
//   // trainer, so never surface them in the cohort's Trainers tab.
//   const adminCodeSet = new Set(taList.map(ta => (ta.partner_code || "").toUpperCase()).filter(Boolean));
//   // Resolve a client's coaching trainer (by dietitian code) to the enriched
//   // trainer row so the Trainers tab can show that trainer's own stats.
//   const trByCode = new Map();
//   tabTr.forEach(t => { const code = (t.partner_code || t.dietician_id || "").toUpperCase(); if (code) trByCode.set(code, t); });
//   const totalPeople = cohortClients.length;
//   const cohortData = CTIERS.map(tier => {
//     const clientsIn = cohortClients.filter(c => c.pct >= tier.min && c.pct <= tier.max);
//     // Bind trainers to the band: the distinct trainers who coach the clients in it
//     // (the same trainers named in the client rows), each with a count of how many
//     // of their clients land here. Admin-owned clients contribute no trainer row.
//     const byTrainer = new Map();
//     clientsIn.forEach(c => {
//       const code = (c.dietitian_id || "").toUpperCase();
//       const isAdmin = adminCodeSet.has(code);
//       // Admins appear in the Trainers tab only for bands where a client they
//       // directly own has actually taken readings (skip their zero-reading clients).
//       const adminSelf = isAdmin ? adminSelfByCode[code] : null;
//       if (isAdmin && !((c.readingDays ?? 0) > 0)) return;
//       const key = code || (c.trainerName || "—");
//       let entry = byTrainer.get(key);
//       if (!entry) {
//         const tr = trByCode.get(code);
//         // Admin's Own Rate is their own self-test rate (tests ÷ days since they joined).
//         let pct = tr ? tr.pct : null;
//         if (isAdmin && adminSelf) {
//           const ds = adminSelf.joined ? daysBetween(adminSelf.joined, now) : 0;
//           pct = ds > 0 ? Math.min(100, Math.round((adminSelf.total_tests / ds) * 100)) : 0;
//         }
//         entry = { ...(tr || {}), name: tr?.name || c.trainerName || "—", partner_code: tr?.partner_code || code || "—", taName: tr?.taName || c.taName, pct, _clientsHere: 0, _self: isAdmin };
//         byTrainer.set(key, entry);
//       }
//       entry._clientsHere += 1;
//     });
//     const trainersIn = Array.from(byTrainer.values());
//     const count = clientsIn.length;
//     return { ...tier, count, trainersIn, clientsIn, pctOfTotal: totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0 };
//   });
//   const maxCohortCount = Math.max(...cohortData.map(c => c.count), 1);

//   const onboardedTrainersToday = tabTr.filter(t => inRange(t.created_at, todayR));
//   const onboardedClientsToday = tabCl.filter(c => inRange(c.onboardedDate, todayR));
//   const readingsToday = tabCl.filter(c => { const d = readingDatesMap[c.profile_id] || []; return d.some(x => inRange(x.date, todayR)); });
//   const onboardedTrainersYesterday = tabTr.filter(t => inRange(t.created_at, yesterdayR));
//   const onboardedClientsYesterday = tabCl.filter(c => inRange(c.onboardedDate, yesterdayR));

//   const toggleAcc = (key) => setOpenAcc(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

//   const riskyTrainers = tabTr.filter(t => t.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);
//   const riskyClients = tabCl.filter(c => c.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);

//   const tChange = pctChange(todayStats.newTrainers, yesterdayStats.newTrainers);
//   const cChange = pctChange(todayStats.newClients, yesterdayStats.newClients);
//   const rChange = pctChange(todayStats.reads, yesterdayStats.reads);

//   const rateColor = (pct) => pct >= ACTIVE_THRESHOLD ? R.green : pct > 0 ? R.orange : R.red;
//   const rateStyle = (pct) => ({ fontWeight: 600, color: rateColor(pct) });
//   const RateCell = ({ pct }) => (
//     <div className="flex items-center gap-2" style={{ justifyContent: "flex-end" }}>
//       <div style={{ width: "36px", height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
//         <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: "2px", backgroundColor: rateColor(pct), transition: "width 0.4s ease" }} />
//       </div>
//       <span style={rateStyle(pct)}>{pct}%</span>
//     </div>
//   );
//   const badgeStyle = (bg, fg) => ({ fontSize: "10px", fontWeight: 500, padding: "2px 8px", borderRadius: R.rBadge, backgroundColor: bg, color: fg, letterSpacing: "-0.2px" });

//   const trainerCols = [
//     { key: "name", label: "Name", val: r => r.name || "—" },
//     { key: "partner_code", label: "Code", val: r => r.partner_code || "—", className: "text-muted font-mono" },
//     ...(activeTab === "overview" ? [{ key: "taName", label: "TA", val: r => r.taName || "—", className: "text-secondary" }] : []),
//     { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//     { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
//     { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
//   ];
//   const clientCols = [
//     { key: "name", label: "Name", val: r => r.name || "—" },
//     { key: "trainerName", label: "Trainer", val: r => r.trainerName || "—", className: "text-secondary" },
//     { key: "fitness_goal", label: "Goal", render: r => <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
//     { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//     { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
//     { key: "metabolism_score", label: "Score", align: "center", val: r => r.metabolism_score ?? null, render: r => r.metabolism_score != null ? <span style={{ fontWeight: 600, color: R.tp }}>{Math.round(r.metabolism_score)}</span> : <span style={{ color: R.td }}>—</span> },
//     { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
//   ];
//   // Trainers shown inside a cohort band are the coaches of that band's clients, so
//   // the columns describe that binding: how many of their clients are in this band,
//   // plus the trainer's own self-test rate (— when it's the admin's own code).
//   const cohortTrainerCols = [
//     { key: "name", label: "Trainer", val: r => r.name || "—" },
//     { key: "partner_code", label: "Code", val: r => r.partner_code || "—", className: "text-muted font-mono" },
//     { key: "taName", label: "TA", val: r => r._self ? "self" : (r.taName || "—"), className: "text-secondary" },
//     { key: "_clientsHere", label: "Clients Here", align: "center", val: r => r._clientsHere ?? 0 },
//     { key: "pct", label: "Own Rate", align: "right", render: r => r.pct == null ? <span style={{ fontSize: "11px", color: R.tm }}>—</span> : <RateCell pct={r.pct} /> },
//   ];

//   const CS = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #EEF2F6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.3s ease, transform 0.3s ease", position: "relative", overflow: "hidden" };
//   const csHover = { boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", transform: "translateY(-2px)" };
//   const csReset = { boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transform: "none" };

//   const maxGoal = Math.max(curGoals.fat_loss, curGoals.muscle_gain, curGoals.weight_loss, 1);

//   const deltaStyle = (v) => ({ borderRadius: "8px", padding: "6px 12px", fontSize: "12px", letterSpacing: "-0.24px", fontWeight: 500, backgroundColor: "#F8FAFC", color: R.ts, border: "1px solid #EEF2F6" });
//   const DeltaArrow = ({ v }) => <span style={{ fontWeight: 700, color: v >= 0 ? R.green : R.red, marginRight: "4px" }}>{v >= 0 ? "↑" : "↓"}</span>;

//   return (
//     <div className="overflow-y-scroll custom-scrollbar" style={{ height: "calc(100vh - 130px)", fontFamily: "'Poppins', sans-serif", backgroundColor: "#F5F7FA" }}>
//       {/* ═══ HEADER ═══ */}
//       <div className="flex items-center justify-between py-3 sticky top-0 z-10" style={{ backgroundColor: "#F5F7FA", borderBottom: "1px solid #EEF2F6" }}>
//         {/* ── Left: Page title as dropdown ── */}
//         <div ref={tabDdRef} style={{ position: "relative" }}>
//           <button onClick={() => setTabDdOpen(o => !o)}
//             className="flex items-center gap-2 cursor-pointer transition-all duration-200"
//             style={{ background: "none", border: "none", padding: "4px 0", outline: "none" }}>
//             <span style={{ fontSize: "18px", fontWeight: 700, color: R.tp, letterSpacing: "-0.36px" }}>
//               {activeTab === "overview" ? "Overview" : taList.find(t => t.user_id === activeTab)?.name || "—"}
//             </span>
//             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={R.tm} strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: tabDdOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
//           </button>

//           {tabDdOpen && (
//             <div className="absolute left-0 z-50" style={{ top: "calc(100% + 6px)", minWidth: 220, backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #EEF2F6", boxShadow: "0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)", padding: "6px", animation: "fadeSlideUp 0.15s ease-out" }}>
//               <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>View</div>
//               <button onClick={() => { setActiveTab("overview"); setTabDdOpen(false); }}
//                 className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
//                 style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: activeTab === "overview" ? R.blueLight : "transparent", color: activeTab === "overview" ? R.blue : R.ts, fontSize: "13px", fontWeight: activeTab === "overview" ? 600 : 400, letterSpacing: "-0.26px" }}
//                 onMouseEnter={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = R.surface; }}
//                 onMouseLeave={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = "transparent"; }}>
//                 <span className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: "8px", backgroundColor: activeTab === "overview" ? R.blue + "18" : R.surface }}>
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={activeTab === "overview" ? R.blue : R.tm} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
//                 </span>
//                 Overview
//               </button>
//               {taList.length > 0 && <>
//                 <div style={{ height: "1px", backgroundColor: R.border, margin: "6px 10px" }} />
//                 <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>Trainer Admins</div>
//               </>}
//               {taList.map((t, i) => {
//                 const isActive = activeTab === t.user_id;
//                 const dotColor = [R.blue, R.green, R.orange, "#7c3aed"][i % 4];
//                 return (
//                   <button key={t.user_id} onClick={() => { setActiveTab(t.user_id); setTabDdOpen(false); }}
//                     className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
//                     style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: isActive ? R.blueLight : "transparent", color: isActive ? R.blue : R.ts, fontSize: "13px", fontWeight: isActive ? 600 : 400, letterSpacing: "-0.26px" }}
//                     onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = R.surface; }}
//                     onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}>
//                     <span className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: "8px", background: isActive ? `linear-gradient(135deg, ${R.blue}, ${R.dark})` : R.surface, color: isActive ? R.white : R.ts, fontSize: "11px", fontWeight: 700 }}>
//                       {(t.name || "?")[0]}
//                     </span>
//                     <div className="flex-1 text-left">
//                       <div className="truncate">{t.name}</div>
//                       {t.email && <div className="truncate" style={{ fontSize: "11px", color: R.tm, fontWeight: 400 }}>{t.email}</div>}
//                     </div>
//                     <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
//                   </button>
//                 );
//               })}
//             </div>
//           )}
//         </div>

//         {/* ── Right: Controls ── */}
//         <div className="flex items-center gap-3">
//           {/* Refresh */}
//           <button onClick={handleRefresh} className="flex items-center justify-center cursor-pointer transition-all duration-200"
//             style={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: "#ffffff", border: "1px solid #EEF2F6", color: R.tm }}
//             onMouseEnter={e => { e.currentTarget.style.backgroundColor = R.blueLight; e.currentTarget.style.color = R.blue; e.currentTarget.style.borderColor = R.blue + "40"; }}
//             onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.color = R.tm; e.currentTarget.style.borderColor = "#EEF2F6"; }}>
//             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
//           </button>

//           {/* Timezone + Clock cluster */}
//           <div className="flex items-center gap-2" style={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #EEF2F6", padding: "6px 12px" }}>
//             <div className="flex items-center" style={{ backgroundColor: R.surface, borderRadius: "8px", padding: "2px", gap: "2px" }}>
//               {Object.entries(TIMEZONES).map(([tz, label]) => (
//                 <button key={tz} onClick={() => setTimezone(tz)}
//                   className="cursor-pointer transition-all duration-200"
//                   style={{ padding: "4px 10px", fontSize: "11px", fontWeight: timezone === tz ? 600 : 500, letterSpacing: "-0.22px", backgroundColor: timezone === tz ? R.dark : "transparent", color: timezone === tz ? R.white : R.ts, border: "none", borderRadius: "6px" }}
//                   onMouseEnter={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = R.border; e.currentTarget.style.color = R.tp; } }}
//                   onMouseLeave={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = R.ts; } }}>{label}</button>
//               ))}
//             </div>
//             <div style={{ width: "1px", height: "20px", backgroundColor: R.border }} />
//             <div ref={calRef} style={{ position: "relative" }}>
//               <button type="button" onClick={() => setCalOpen(o => !o)} title="World clock"
//                 className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all duration-200"
//                 style={{ fontSize: "11px", color: calOpen ? R.blue : R.tm, letterSpacing: "-0.22px", background: "transparent", border: "none", padding: 0 }}
//                 onMouseEnter={e => { e.currentTarget.style.color = R.blue; }}
//                 onMouseLeave={e => { e.currentTarget.style.color = calOpen ? R.blue : R.tm; }}>
//                 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
//                 <span>{clock}</span>
//                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: calOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
//               </button>

//               {calOpen && (
//                 <div data-tick={nowTick} style={{ position: "absolute", top: "calc(100% + 12px)", right: 0, zIndex: 50, backgroundColor: R.white, borderRadius: R.rCard, border: `1px solid ${R.border}`, boxShadow: R.shadow, padding: "18px" }}>
//                   <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
//                     <div className="flex items-center gap-1.5">
//                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
//                       <span style={{ fontSize: "12px", fontWeight: 700, color: R.tp, letterSpacing: "-0.24px" }}>{TIMEZONES[timezone]}</span>
//                     </div>
//                     <div>
//                       <div className="font-mono" style={{ fontSize: "22px", fontWeight: 700, color: R.tp, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{tzTime(timezone)}</div>
//                       <div style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px", marginTop: "2px" }}>{tzDay(timezone)}</div>
//                     </div>
//                     <div className="wc-cal">
//                       <Calendar
//                         onChange={(d) => { const dt = Array.isArray(d) ? d[0] : d; if (dt) { setSelectedDate(dt); setPeriod("custom"); setCalOpen(false); } }}
//                         value={period === "custom" && selectedDate ? selectedDate : tzNow(timezone)}
//                         maxDate={tzNow(timezone)}
//                         showNeighboringMonth={false} locale="en-US" />
//                     </div>
//                     <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
//                       <span style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px" }}>
//                         {period === "custom" && selectedDate ? "Filtering Period Overview" : "Pick a date to filter"}
//                       </span>
//                       {period === "custom" && selectedDate && (
//                         <button type="button" onClick={() => { setSelectedDate(null); setPeriod("today"); }}
//                           className="cursor-pointer" style={{ fontSize: "10px", fontWeight: 600, color: R.blue, background: R.blueLight, border: "none", borderRadius: R.rBadge, padding: "3px 8px" }}>Reset to today</button>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       <style jsx global>{`
//         .wc-cal .react-calendar { width: 232px; border: none; background: transparent; font-family: inherit; line-height: 1.2; }
//         .wc-cal .react-calendar button { border-radius: 8px; }
//         .wc-cal .react-calendar__navigation { height: 32px; margin-bottom: 4px; }
//         .wc-cal .react-calendar__navigation button { min-width: 30px; font-size: 13px; font-weight: 600; color: ${R.tp}; background: transparent; }
//         .wc-cal .react-calendar__navigation button:enabled:hover, .wc-cal .react-calendar__navigation button:enabled:focus { background: ${R.surface}; }
//         .wc-cal .react-calendar__navigation button:disabled { background: transparent; }
//         .wc-cal .react-calendar__month-view__weekdays { font-size: 10px; font-weight: 600; color: ${R.tm}; text-transform: uppercase; letter-spacing: 0.2px; }
//         .wc-cal .react-calendar__month-view__weekdays abbr { text-decoration: none; cursor: default; }
//         .wc-cal .react-calendar__tile { padding: 6px 4px; font-size: 11px; color: ${R.ts}; }
//         .wc-cal .react-calendar__tile:enabled:hover, .wc-cal .react-calendar__tile:enabled:focus { background: ${R.blueLight}; color: ${R.blue}; }
//         .wc-cal .react-calendar__month-view__days__day--weekend { color: ${R.red}; }
//         .wc-cal .react-calendar__month-view__days__day--neighboringMonth { color: ${R.td}; }
//         .wc-cal .react-calendar__tile--now { background: ${R.blueLight}; color: ${R.blue}; font-weight: 700; }
//         .wc-cal .react-calendar__tile--now:enabled:hover, .wc-cal .react-calendar__tile--now:enabled:focus { background: ${R.blueLight}; }
//         .wc-cal .react-calendar__tile--active, .wc-cal .react-calendar__tile--active:enabled:hover, .wc-cal .react-calendar__tile--active:enabled:focus { background: ${R.dark}; color: ${R.white}; font-weight: 700; }
//       `}</style>

//       <div className="flex flex-col gap-5 pb-8 pt-2">

//         {/* ═══ TA PROFILE (individual tabs only) ═══ */}
//         {selTa && (
//           <div className="flex items-center gap-4" style={{ ...CS, padding: "16px 24px" }}>
//             <div className="w-10 h-10 flex items-center justify-center font-bold text-white" style={{ borderRadius: "12px", background: `linear-gradient(135deg, ${R.dark} 0%, ${R.blue} 100%)`, fontSize: "18px", letterSpacing: "-0.36px" }}>{(selTa.name || "?")[0]}</div>
//             <div className="flex-1">
//               <div style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.3px", color: R.tp }}>{selTa.name}</div>
//               <div style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{selTa.email}</div>
//             </div>
//             <div className="flex gap-8 shrink-0">
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Code</div><div className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: R.tp, letterSpacing: "-0.26px" }}>{selTa.partner_code}</div></div>
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Since</div><div style={{ fontSize: "13px", fontWeight: 600, color: R.tp, letterSpacing: "-0.26px" }}>{fmtDate(selTa.created_at)}</div></div>
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Days Active</div><div style={{ fontSize: "13px", fontWeight: 700, color: R.blue, letterSpacing: "-0.26px" }}>{selTa.created_at ? daysBetween(selTa.created_at, now) : "—"}</div></div>
//             </div>
//           </div>
//         )}

//         {/* ═══ 2-ROW GRID: Left (Snapshot + Trainer Adoption) | Right (Period + Reading Split spanning both) ═══ */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "14px", gridTemplateRows: "auto 1fr" }}>

//           {/* ── Left Top: Snapshot cards ── */}
//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
//             {/* Card: Trainers */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.blue}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Trainers</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.newTrainers > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newTrainers} this wk</span>}
//                   <Ico type="people" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between mt-3">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{tTotal}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                   <div className="flex items-center gap-2 mt-1">
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{tActive} Active</span>
//                     <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {tTotal}</span>
//                   </div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last4WeeksTrainers} width={64} height={28} color={R.blue} />
//                   <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
//                 </div>
//               </div>
//               <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
//                 <div style={{ width: `${adoptionRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.blue}, ${R.green})`, transition: "width 0.6s ease" }} />
//               </div>
//               <div className="flex items-center justify-between mt-1.5">
//                 <span style={{ fontSize: "10px", color: R.tm }}>Adoption</span>
//                 <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{adoptionRate}%</span>
//               </div>
//             </div>

//             {/* Card: Clients */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.green}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Clients</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.newClients > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newClients} this wk</span>}
//                   <Ico type="person" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between mt-3">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{cTotal}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                   <div className="flex items-center gap-2 mt-1">
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{cActive} Active</span>
//                     <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {cTotal}</span>
//                   </div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last4WeeksClients} width={64} height={28} color={R.green} />
//                   <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
//                 </div>
//               </div>
//               <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
//                 <div style={{ width: `${engagementRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.green}, #10B981)`, transition: "width 0.6s ease" }} />
//               </div>
//               <div className="flex items-center justify-between mt-1.5">
//                 <span style={{ fontSize: "10px", color: R.tm }}>Engagements</span>
//                 <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{engagementRate}%</span>
//               </div>
//             </div>

//             {/* Card: Readings */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px", borderLeft: "3px solid #7C3AED", height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Readings</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.reads > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: "#7C3AED", backgroundColor: "#7C3AED12", padding: "2px 6px", borderRadius: "4px" }}>{wkStats.reads} this wk</span>}
//                   <Ico type="trend" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{allTimeTotalReads}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last7Days} width={90} height={32} color="#7C3AED" />
//                   <span style={{ fontSize: "9px", color: R.tm }}>Last 7 days</span>
//                 </div>
//               </div>
//               <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
//                 {[["Trainers", networkTrainerCount, R.blue], ["Clients", networkClientCount, R.green]].map(([l, v, c]) => (
//                   <div key={l} className="flex items-center gap-2">
//                     <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: c, flexShrink: 0 }} />
//                     <span style={{ fontSize: "11px", color: R.ts, flex: 1 }}>{l}</span>
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.tp }}>{v}</span>
//                     {networkSplitTotal > 0 && <span style={{ fontSize: "10px", color: R.tm }}>({Math.round((v / networkSplitTotal) * 100)}%)</span>}
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* ── Right: Period + Reading Split — spans 2 rows ── */}
//           <div className="analytics-card-animate" style={{ gridRow: "1 / 3", gridColumn: 2, alignSelf: "start", borderRadius: "16px", padding: "28px 24px", background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)", color: "#ffffff", position: "relative", overflow: "hidden", transition: "box-shadow 0.3s ease, transform 0.3s ease", display: "flex", flexDirection: "column" }}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, { boxShadow: "0 8px 32px rgba(15,23,42,0.4)", transform: "translateY(-2px)" })}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none" })}>

//             {/* Header */}
//             <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
//               <div>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "4px" }}>Period Overview</div>
//                 <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.3px" }}>{periodLabel}</span>
//                 {/* Whose readings these are: the selected admin, or all members by default. */}
//                 <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px", letterSpacing: "-0.1px" }}>
//                   {selTa ? (selTa.email || selTa.name || periodReads.scope?.name) : "All Members"}
//                 </div>
//               </div>
//               <div className="flex items-center" style={{ backgroundColor: "rgba(148,163,184,0.12)", borderRadius: "8px", padding: "2px", gap: "2px" }}>
//                 {[["today", "D"], ["week", "W"], ["month", "M"]].map(([k, l]) => (
//                   <button key={k} onClick={() => setPeriod(k)}
//                     className="cursor-pointer transition-all duration-200"
//                     style={{ padding: "5px 12px", fontSize: "11px", fontWeight: period === k ? 700 : 500, backgroundColor: period === k ? R.blue : "transparent", color: "#ffffff", border: "none", borderRadius: "6px", opacity: period === k ? 1 : 0.6 }}>{l}</button>
//                 ))}
//               </div>
//             </div>

//             {/* Hero metric — Total Readings (summed across the period) */}
//             <div className="text-center" style={{ padding: "8px 0 20px" }}>
//               <div style={{ fontSize: "44px", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1, opacity: periodReads.loading ? 0.4 : 1, transition: "opacity 0.2s ease" }}>{periodTotalReads}</div>
//               <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", letterSpacing: "0.3px" }}>Total Readings</div>
//             </div>

//             {/* Onboarding metrics — 2 compact cards side by side */}
//             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
//               {[
//                 { val: pm.newTrainers, prev: ppm?.newTrainers, label: "Trainers", sub: "Onboarded", color: R.blue, type: "trainers" },
//                 { val: pm.newClients, prev: ppm?.newClients, label: "Clients", sub: "Onboarded", color: R.green, type: "clients" },
//               ].map((item) => (
//                 <div
//                   key={item.label}
//                   role="button"
//                   tabIndex={0}
//                   title={`View ${item.label.toLowerCase()} onboarded ${periodWord}`}
//                   onClick={() => openOnboarding(item.type)}
//                   onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOnboarding(item.type); } }}
//                   onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(148,163,184,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
//                   onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(148,163,184,0.06)"; e.currentTarget.style.transform = "none"; }}
//                   className="cursor-pointer"
//                   style={{ padding: "14px", borderRadius: "12px", backgroundColor: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.1)", transition: "background-color 0.2s ease, transform 0.2s ease", outline: "none" }}
//                 >
//                   <div className="flex items-center justify-between">
//                     <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: item.color }} />
//                     {item.prev != null && item.val !== item.prev && (
//                       <span style={{ fontSize: "10px", fontWeight: 600, color: item.val >= item.prev ? "#4ade80" : "#f87171" }}>
//                         {item.val >= item.prev ? "+" : ""}{item.val - item.prev}
//                       </span>
//                     )}
//                   </div>
//                   <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-1px", marginTop: "8px", lineHeight: 1 }}>{item.val}</div>
//                   <div className="flex items-center justify-between" style={{ marginTop: "4px" }}>
//                     <span style={{ fontSize: "11px", color: "#64748b" }}>{item.label} {item.sub}</span>
//                     <span style={{ fontSize: "11px", color: "#64748b" }}>›</span>
//                   </div>
//                 </div>
//               ))}
//             </div>

//             {/* Device Adoption + Reading Split — side by side */}
//             <div className="flex-1 flex gap-4" style={{ paddingTop: "20px", borderTop: "1px solid rgba(148,163,184,0.1)", marginTop: "20px" }}>

//               {/* Device Adoption — left column */}
//               <div className="flex-1 flex flex-col items-center" style={{ borderRight: "1px solid rgba(148,163,184,0.1)", paddingRight: "16px" }}>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Device Adoption</div>
//                 <Donut pct={pm.adoption} size={90} thickness={8} color={R.blue} bg="#0f172a" track="rgba(148,163,184,0.12)" textColor="#ffffff" />
//                 <div style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", marginTop: "12px" }}>{adoptionSubLabel}</div>
//               </div>

//               {/* Reading Split — right column */}
//               <div className="flex-1 flex flex-col items-center" style={{ paddingLeft: "4px" }}>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Reading Split</div>
//                 {(() => {
//                   const trPct = periodTotalReads > 0 ? Math.round((periodTrainerReads / periodTotalReads) * 100) : 0;
//                   return (
//                     <div className="flex flex-col items-center gap-4 flex-1 w-full">
//                       <div className="rounded-full flex items-center justify-center" style={{
//                         width: 90, height: 90,
//                         background: periodTotalReads > 0
//                           ? `conic-gradient(${R.blue} 0% ${trPct}%, ${R.green}80 ${trPct}% 100%)`
//                           : "rgba(148,163,184,0.12)"
//                       }}>
//                         <div className="rounded-full flex items-center justify-center" style={{ width: 70, height: 70, backgroundColor: "#0f172a" }}>
//                           <div className="text-center">
//                             <div style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1 }}>{periodTotalReads}</div>
//                             <div style={{ fontSize: "8px", color: "#64748b", marginTop: "2px" }}>readings</div>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="w-full" style={{ height: "5px", borderRadius: "3px", overflow: "hidden", display: "flex", backgroundColor: "rgba(148,163,184,0.12)" }}>
//                         {periodTotalReads > 0 && <>
//                           <div style={{ width: `${trPct}%`, height: "100%", backgroundColor: R.blue, transition: "width 0.4s ease" }} />
//                           <div style={{ flex: 1, height: "100%", backgroundColor: `${R.green}80` }} />
//                         </>}
//                       </div>

//                       <div className="flex flex-col gap-2 w-full">
//                         {[
//                           { label: "Trainers", val: periodTrainerReads, color: R.blue },
//                           { label: "Clients", val: periodClientReads, color: `${R.green}80` },
//                         ].map(s => (
//                           <div key={s.label} className="flex items-center gap-2" style={{ padding: "6px 10px", borderRadius: "8px", backgroundColor: "rgba(148,163,184,0.05)" }}>
//                             <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.color, flexShrink: 0 }} />
//                             <span style={{ fontSize: "11px", color: "#94a3b8", flex: 1 }}>{s.label}</span>
//                             <span style={{ fontSize: "14px", fontWeight: 700 }}>{s.val}</span>
//                             <span style={{ fontSize: "10px", color: "#475569" }}>({periodTotalReads > 0 ? Math.round((s.val / periodTotalReads) * 100) : 0}%)</span>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   );
//                 })()}
//               </div>
//             </div>
//           </div>

//           {/* ── Left Bottom: Trainer Adoption ── */}
//           <div className="p-5 analytics-card-animate" style={{ ...CS, display: "flex", flexDirection: "column", height: "420px" }}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Trainer Adoption</h2>
//                 <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are trainers using the device?</p>
//               </div>
//               <div className="flex items-center gap-4">
//                 <div className="text-center">
//                   <div style={{ fontSize: "20px", fontWeight: 700, color: R.tp, lineHeight: 1 }}>{tTotal}</div>
//                   <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Total</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="text-center">
//                   <div style={{ fontSize: "20px", fontWeight: 700, color: R.green, lineHeight: 1 }}>{tActive}</div>
//                   <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Active</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
//                   <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{adoptionRate}%</div>
//                   <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Adoption</div>
//                 </div>
//               </div>
//             </div>

//             {/* Tabs */}
//             <div className="flex gap-1 mt-4 p-1" style={{ backgroundColor: "#F1F5F9", borderRadius: "10px" }}>
//               {[
//                 { key: "all", dotColor: R.blue, count: tTotal, label: "All" },
//                 { key: "active", dotColor: R.green, count: tActive, label: `Active` },
//                 { key: "elite", dotColor: "#10B981", count: eliteCount, label: "Elite" },
//                 { key: "atrisk", dotColor: R.red, count: atRiskTrainerCount, label: "At Risk" },
//               ].map(t => (
//                 <button key={t.key} onClick={() => setTrainerTab(t.key)} className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer" style={{
//                   padding: "7px 10px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, letterSpacing: "-0.24px", transition: "all 0.2s ease",
//                   backgroundColor: trainerTab === t.key ? "#ffffff" : "transparent",
//                   color: trainerTab === t.key ? R.tp : R.tm,
//                   boxShadow: trainerTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
//                 }}>
//                   <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.dotColor }} />
//                   <span>{t.count}</span>
//                   <span style={{ fontWeight: 500 }}>{t.label}</span>
//                 </button>
//               ))}
//             </div>

//             {/* Tab content — table fills available space */}
//             <div className="mt-3 flex-1 flex flex-col" style={{ overflow: "hidden" }}>
//               {(() => {
//                 const tabs = { all: rawTabTr, active: activeTrainers, elite: eliteTrainers, atrisk: atRiskTrainers };
//                 const list = tabs[trainerTab] || [];
//                 if (list.length === 0) return <div className="flex flex-col items-center justify-center flex-1 gap-3">
//                   <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
//                     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
//                   </div>
//                   <div className="text-center">
//                     <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>No trainers in this group</div>
//                     <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>Try selecting a different tab</div>
//                   </div>
//                 </div>;
//                 if (trainerTab === "all") return <AccTable rows={list} cols={[
//                   {
//                     key: "removed", label: "Off", align: "center", val: r => removedTrainerKeys.has(r.user_id) ? 1 : 0,
//                     render: r => <input type="checkbox" checked={removedTrainerKeys.has(r.user_id)} onChange={() => toggleTrainerRemoved(r.user_id)}
//                       title="Temporarily remove this trainer and their clients from all metrics"
//                       style={{ cursor: "pointer", width: 14, height: 14, accentColor: R.red }} />
//                   },
//                   { key: "name", label: "Trainer", val: r => r.name || "—", render: r => <span style={{ textDecoration: removedTrainerKeys.has(r.user_id) ? "line-through" : "none", opacity: removedTrainerKeys.has(r.user_id) ? 0.45 : 1 }}>{r.name || "—"}</span> },
//                   { key: "realClientCount", label: "Clients", align: "center", val: r => r.realClientCount ?? 0 },
//                   { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//                   { key: "selfTests", label: "Tests", align: "center", val: r => r.selfTests ?? 0 },
//                   { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
//                   {
//                     key: "status", label: "Status", align: "right", val: r => r.pct >= ELITE_THRESHOLD ? 2 : r.pct >= ACTIVE_THRESHOLD ? 1 : 0, render: r => r.pct >= ELITE_THRESHOLD
//                       ? <span style={badgeStyle(R.greenLight, R.green)}>Elite</span>
//                       : r.pct >= ACTIVE_THRESHOLD
//                         ? <span style={badgeStyle(R.blueLight, R.blue)}>Active</span>
//                         : <span style={badgeStyle("#fef2f2", R.red)}>At Risk</span>
//                   },
//                 ]} />;
//                 return <AccTable rows={list} cols={trainerCols} />;
//               })()}
//             </div>

//             <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #EEF2F6" }}>
//               <div className="italic" style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px" }}>Adoption = Trainers with reading rate {"≥"} {ACTIVE_THRESHOLD}% / Total trainers ({tActive}/{tTotal} = {adoptionRate}%)</div>
//               <div className="mt-2" style={deltaStyle(trainerWeekDelta)}>
//                 <DeltaArrow v={trainerWeekDelta} />{Math.abs(trainerWeekDelta)} {trainerWeekDelta === 1 || trainerWeekDelta === -1 ? "trainer" : "trainers"} this week vs last
//               </div>
//             </div>
//           </div>

//         </div>

//         {/* ═══ ROW 3: CLIENT ENGAGEMENT (wide) + READING RATE COHORTS ═══ */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "stretch" }}>
//           {/* Client Engagement */}
//           <div className="p-5 analytics-card-animate" style={CS}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Client Engagement</h2>
//                 <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are clients engaged and consistent?</p>
//               </div>
//               <div className="flex items-center gap-4">
//                 <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
//                   <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{avgActivity}%</div>
//                   <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Avg Rate</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="flex gap-3">
//                   <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.green }}>{highestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>High</div></div>
//                   <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.red }}>{lowestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>Low</div></div>
//                 </div>
//               </div>
//             </div>

//             {/* Clients by Goal — compact */}
//             <div className="flex gap-3 mt-3">
//               {[["fat_loss", "Fat Loss", R.orange], ["muscle_gain", "Muscle Gain", R.green]].map(([k, l, c]) => (
//                 <div key={k} className="flex-1 p-2.5" style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", borderLeft: `3px solid ${c}` }}>
//                   <div style={{ fontSize: "16px", fontWeight: 700, color: R.tp }}>{curGoals[k] || 0}</div>
//                   <div style={{ fontSize: "10px", color: R.tm }}>{l}</div>
//                 </div>
//               ))}
//             </div>

//             {/* Client table */}
//             <div className="mt-3 pt-3" style={{ borderTop: "1px solid #EEF2F6", height: "200px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
//               <AccTable rows={tabCl} cols={[
//                 { key: "name", label: "Client", val: r => r.name || "—" },
//                 { key: "profile_id", label: "Profile ID", val: r => r.profile_id || "—", className: "text-muted font-mono" },
//                 { key: "fitness_goal", label: "Goal", val: r => goalLabel(r.fitness_goal), render: r => <span style={{ fontSize: "11px", fontWeight: 500, padding: "3px 10px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
//                 { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//                 { key: "readingDays", label: "Tests", align: "center", val: r => r.readingDays ?? 0 },
//                 { key: "metabolism_score", label: "Score", align: "center", val: r => r.metabolism_score ?? null, render: r => r.metabolism_score != null ? <span style={{ fontWeight: 600, color: R.tp }}>{Math.round(r.metabolism_score)}</span> : <span style={{ color: R.td }}>—</span> },
//                 { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
//               ]} />
//             </div>
//             <div className="mt-2" style={deltaStyle(readingsWeekDelta)}>
//               <DeltaArrow v={readingsWeekDelta} />{Math.abs(readingsWeekDelta)} readings this week vs last week
//             </div>
//           </div>

//           {/* Reading Rate Cohorts — 2-column layout */}
//           <div className="p-5 analytics-card-animate" style={CS}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Reading Rate Cohorts</h2>
//             <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Clients grouped by reading rate — and the trainers coaching each tier.</p>

//             <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "28px", marginTop: "16px" }}>

//               {/* Left: Distribution chart */}
//               <div className="flex flex-col gap-2 pt-1">
//                 {cohortData.map((tier, i) => {
//                   const active = cohortTab === i;
//                   const barPct = maxCohortCount > 0 ? Math.max((tier.count / maxCohortCount) * 100, tier.count > 0 ? 8 : 0) : 0;
//                   return (
//                     <div key={i} className="cursor-pointer" onClick={() => setCohortTab(i)}
//                       style={{ padding: "6px 10px", borderRadius: "10px", transition: "all 0.2s", backgroundColor: active ? `${tier.color}08` : "transparent", border: active ? `1px solid ${tier.color}20` : "1px solid transparent" }}>
//                       <div className="flex items-center justify-between" style={{ marginBottom: "5px" }}>
//                         <span style={{ fontSize: "11px", fontWeight: active ? 700 : 500, color: active ? tier.color : R.ts }}>{tier.label}</span>
//                         <span style={{ fontSize: "12px", fontWeight: 700, color: active ? tier.color : R.tp }}>{tier.count} <span style={{ fontSize: "10px", fontWeight: 500, color: R.tm }}>({tier.pctOfTotal}%)</span></span>
//                       </div>
//                       <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
//                         <div style={{ width: `${barPct}%`, height: "100%", borderRadius: "3px", backgroundColor: tier.color, opacity: active ? 1 : 0.5, transition: "all 0.3s ease" }} />
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>

//               {/* Right: Selected cohort table */}
//               <div style={{ borderLeft: "1px solid #EEF2F6", paddingLeft: "24px", display: "flex", flexDirection: "column" }}>
//                 {cohortData[cohortTab] ? (
//                   cohortData[cohortTab].count === 0 ? (
//                     <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
//                       <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
//                         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
//                       </div>
//                       <div className="text-center">
//                         <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>No one in this cohort</div>
//                         <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>No trainers or clients fall in this range</div>
//                       </div>
//                     </div>
//                   ) : (<>
//                     <div className="flex gap-1 p-1 mb-3" style={{ backgroundColor: "#F1F5F9", borderRadius: "8px", alignSelf: "flex-start" }}>
//                       {[
//                         { key: "trainers", label: "Trainers", count: cohortData[cohortTab].trainersIn.length },
//                         { key: "clients", label: "Clients", count: cohortData[cohortTab].clientsIn.length },
//                       ].map(t => (
//                         <button key={t.key} onClick={() => setCohortSubTab(t.key)} className="cursor-pointer" style={{
//                           padding: "5px 12px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: 600, letterSpacing: "-0.2px", transition: "all 0.2s ease",
//                           backgroundColor: cohortSubTab === t.key ? "#ffffff" : "transparent",
//                           color: cohortSubTab === t.key ? R.tp : R.tm,
//                           boxShadow: cohortSubTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
//                         }}>
//                           {t.label} <span style={{ color: cohortSubTab === t.key ? R.blue : R.tm, marginLeft: "2px" }}>{t.count}</span>
//                         </button>
//                       ))}
//                     </div>
//                     <div style={{ height: "240px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
//                       {cohortSubTab === "trainers" ? (
//                         cohortData[cohortTab].trainersIn.length > 0
//                           ? <AccTable rows={cohortData[cohortTab].trainersIn} cols={cohortTrainerCols} />
//                           : <div className="flex flex-col items-center justify-center gap-2 py-6">
//                             <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No trainers in this range</div>
//                             <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
//                           </div>
//                       ) : (
//                         cohortData[cohortTab].clientsIn.length > 0
//                           ? <AccTable rows={cohortData[cohortTab].clientsIn} cols={clientCols} />
//                           : <div className="flex flex-col items-center justify-center gap-2 py-6">
//                             <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No clients in this range</div>
//                             <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
//                           </div>
//                       )}
//                     </div>
//                   </>)
//                 ) : null}
//               </div>

//             </div>
//           </div>
//         </div>


//         {/* ═══ FOOTER ═══ */}
//         <div className="flex items-start gap-2.5" style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px", padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #EEF2F6" }}>
//           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
//           <span><strong style={{ color: R.ts }}>Active</strong> = Reading rate {"≥"} {ACTIVE_THRESHOLD}% {"·"} <strong style={{ color: R.ts }}>Reading Rate</strong> = Reading days / Days since onboarded {"·"} All clients are counted, including trainer self-test profiles, which also feed trainer adoption.</span>
//         </div>
//       </div>
//     </div>
//   );
// }



















// "use client";

// import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// import { toast } from "sonner";
// import { useDispatch, useSelector } from "react-redux";
// import { getAdminGroups, selectAdminGroups, selectAdminGroupsRaw, selectPrimaryGroupName } from "@/store/adminGroupsSlice";
// import { getGroupDetails, selectGroupDetails, selectGroupDetailsLoading, selectGroupCounts } from "@/store/groupDetailsSlice";

// const TIMEZONES = { "America/Chicago": "Houston, TX", "Asia/Kolkata": "India (IST)" };
// const DEFAULT_TZ = "America/Chicago";
// const ACTIVE_THRESHOLD = 60;
// const EXECUTIVE_TAS = ["Derek", "Evan"];
// const BLUE = "#308BF9";
// const R = {
//   dark: "#252525", blue: "#308bf9", blueLight: "#e9f3ff",
//   green: "#3faf58", greenLight: "#eaffef", red: "#e74c3c", orange: "#e48326", amber: "#ffbf2d",
//   tp: "#252525", ts: "#535359", tm: "#738298", td: "#a1a1a1",
//   border: "#e1e6ed", surface: "#f5f7fa", white: "#ffffff",
//   rCard: "15px", rBadge: "6px", rPill: "33px",
//   shadow: "0 20px 60px rgba(37,37,37,0.08), 0 6px 16px rgba(37,37,37,0.04), 0 1px 3px rgba(37,37,37,0.03)",
// };

// function tzNow(tz) { return new Date(new Date().toLocaleString("en-US", { timeZone: tz })); }
// function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
// function fmtRange(r) { if (!r) return ""; return `${fmtDate(r.start)} – ${fmtDate(r.end)}`; }
// function daysBetween(a, b) {
//   const da = new Date(a), db = new Date(b);
//   if (isNaN(da) || isNaN(db)) return 0;
//   return Math.max(0, Math.round((new Date(da.getFullYear(), da.getMonth(), da.getDate()) - new Date(db.getFullYear(), db.getMonth(), db.getDate())) / -86400000));
// }

// const COHORTS = [90, 70, 50, 25, 10];
// function getCohort(pct) { for (const t of COHORTS) if (pct >= t) return `${t}%+`; return "<10%"; }
// function goalColor(g) { if (!g) return R.tm; const l = g.toLowerCase(); if (l.includes("fat")) return R.orange; if (l.includes("loss")) return R.red; if (l.includes("gain") || l.includes("muscle")) return R.green; return R.blue; }
// function goalLabel(g) { if (!g) return "—"; const l = g.toLowerCase(); if (l.includes("fat")) return "Fat Loss"; if (l.includes("weight")) return "Weight Loss"; if (l.includes("muscle") || l.includes("gain")) return "Muscle Gain"; return g; }

// function isMaskedMatch(m, r) {
//   if (!m || !r) return false;
//   const mp = m.toLowerCase().split("@"), rp = r.toLowerCase().split("@");
//   if (mp.length !== 2 || rp.length !== 2 || mp[1] !== rp[1]) return false;
//   if (mp[0].length < 2 || rp[0].length < 2) return false;
//   return mp[0][0] === rp[0][0] && mp[0][1] === rp[0][1] && mp[0].slice(-1) === rp[0].slice(-1);
// }
// function isMaskedNameMatch(m, r) {
//   if (!m || !r) return false;
//   const mw = m.toLowerCase().trim().split(/\s+/), rw = r.toLowerCase().trim().split(/\s+/);
//   if (!mw.length || mw.length !== rw.length) return false;
//   return mw.every((w, i) => w.length >= 2 && rw[i].length >= 2 && w[0] === rw[i][0] && w[1] === rw[i][1] && w.slice(-1) === rw[i].slice(-1));
// }
// function isSelfTest(client, trainers) {
//   const ce = (client.email || "").toLowerCase().trim(), cn = (client.name || "").trim();
//   return trainers.some(t => { const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
// }

// function getPeriodRange(p, now) {
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   if (p === "today") return { start: today, end: today };
//   if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); return { start: m, end: today }; }
//   if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
//   return null;
// }
// function getPrevRange(p, now) {
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   if (p === "today") { const y = new Date(today); y.setDate(y.getDate() - 1); return { start: y, end: y }; }
//   if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); const ps = new Date(m); ps.setDate(m.getDate() - 1); const pm = new Date(ps); pm.setDate(ps.getDate() - 6); return { start: pm, end: ps }; }
//   if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 0) };
//   return null;
// }
// function inRange(ds, r) { if (!r) return true; if (!ds) return false; const d = new Date(ds); if (isNaN(d)) return false; const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return day >= r.start && day <= r.end; }
// function prevLbl(p, now) { if (p === "today") return "yesterday"; if (p === "week") return "last week"; if (p === "month") return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", { month: "short" }); return null; }

// function periodMetrics(clients, trainers, rdm, range) {
//   const nT = !range ? trainers.length : trainers.filter(t => inRange(t.created_at, range)).length;
//   const nC = !range ? clients.length : clients.filter(c => inRange(c.onboardedDate, range)).length;
//   let reads = 0, readers = 0;
//   clients.forEach(c => { const d = rdm[c.profile_id] || []; const n = !range ? d.length : d.filter(x => inRange(x.date, range)).length; reads += n; if (n > 0) readers++; });
//   return { newTrainers: nT, newClients: nC, reads, readers, adoption: clients.length > 0 ? Math.round((readers / clients.length) * 100) : 0 };
// }

// function pctChange(cur, prev) {
//   if (prev === 0 && cur === 0) return { val: 0, label: "0%" };
//   if (prev === 0) return { val: 100, label: "100%" };
//   const v = Math.round(((cur - prev) / prev) * 100);
//   return { val: v, label: `${Math.abs(v)}%` };
// }

// /* ══════════════════════════════════════════════════════════════════════
//    REAL DATA ADAPTER — get_group_details.php
//    Maps the GETGROUPDETAILS response into the shape the dashboard renders from:
//      group_members (admins) → Trainer-Admin tabs (taList)
//      trainers               → trainers under their parent admin (trainersMap)
//      clients                → attributed to a TA via owner code (allClients)
//      trainers/clients total_tests → Tests count + reading-rate numerator
//      latest_test.date_time  → anchors the "today / this period" reads
//    The API gives test COUNTS (total_tests) but not per-test DATES, so count- and
//    rate-based metrics are exact while period/"today" reads use the latest test only.
//    ══════════════════════════════════════════════════════════════════════ */
// function buildFromGroupDetails(gd, now = new Date()) {
//   const taList = [];
//   const trainersMap = {};
//   const allClients = [];
//   const readingDatesMap = {};

//   const members = Array.isArray(gd?.group_members) ? gd.group_members : [];
//   const trainers = Array.isArray(gd?.trainers) ? gd.trainers : [];
//   const clients = Array.isArray(gd?.clients) ? gd.clients : [];

//   // Group members flagged "admin" become the Trainer-Admin tabs. If none are
//   // flagged, treat every member as an admin so the dashboard still populates.
//   const admins = members.filter(m => (m.role || "").toLowerCase() === "admin");
//   const taMembers = admins.length ? admins : members;

//   // Group members (admins) are NEVER clients. Any client profile whose email
//   // matches a group member's email is the admin themselves, not a real client,
//   // and must be excluded from all client lists/counts.
//   const memberEmails = new Set(members.map(m => (m.email || "").toLowerCase().trim()).filter(Boolean));
//   // Email → member, so an admin's own self-test profile (a client row matching
//   // their email) can be attributed back to that admin's dietician code.
//   const memberByEmail = new Map(members.filter(m => m.email).map(m => [(m.email || "").toLowerCase().trim(), m]));

//   // Admins are ALSO returned inside `trainers[]` (role: "admin", null parent) and
//   // are counted in `counts.trainers`. They ARE their group's Trainer-Admin tabs,
//   // but an admin can personally coach clients and take readings, so we now also
//   // surface them as trainer rows in the Trainer Adoption list (see adminEntry
//   // below). Nothing is dropped from the trainer total — counts.trainers already
//   // includes them, and each admin appears exactly once as a trainer row.
//   const excludedTrainerAdminCount = 0;

//   taMembers.forEach(m => {
//     const uid = m.dietician_id || m.email;
//     taList.push({
//       user_id: uid,
//       name: m.name && m.name !== "NA" ? m.name : (m.email || "—"),
//       email: m.email || "",
//       partner_code: m.dietician_id || "",
//       created_at: m.created_at || null, // admin join date (added to group_members by the backend)
//     });

//     // Trainers whose parent admin is this member.
//     const myTrainers = trainers
//       .filter(t => (t.parent_admin_email || "").toLowerCase() === (m.email || "").toLowerCase())
//       .map(t => ({
//         user_id: t.partner_code,
//         name: t.name && t.name !== "NA" ? t.name : (t.email || "—"),
//         email: t.email || "",
//         partner_code: t.partner_code || "",
//         dietician_id: t.partner_code || "",
//         created_at: t.created_at || null,
//         total_tests: typeof t.total_tests === "number" ? t.total_tests : null,
//         total_clients: typeof t.total_clients === "number" ? t.total_clients : null,
//         total_tested_clients: typeof t.total_tested_clients === "number" ? t.total_tested_clients : null,
//         is_self: false,
//       }));

//     // The admin themselves, surfaced as a trainer row (is_self:false → shown in the
//     // Trainer Adoption list) so admins like Derek/Evan appear alongside their team,
//     // with their OWN totals (clients coached, tests taken, tested clients). Their
//     // dietician code stays in the code set, so admin-owned clients still attribute
//     // to this TA. Blank email → no client is mis-detected as the admin's self-test
//     // (admin self-test profiles are already excluded upstream and tracked in
//     // adminSelfByCode). is_admin flags the row for any admin-specific presentation.
//     const adminEntry = {
//       user_id: `admin_${uid}`,
//       name: m.name && m.name !== "NA" ? m.name : (m.email || "—"),
//       email: "",
//       partner_code: m.dietician_id || "",
//       dietician_id: m.dietician_id || "",
//       created_at: m.created_at || null,
//       total_tests: typeof m.total_tests === "number" ? m.total_tests : null,
//       total_clients: typeof m.total_clients === "number" ? m.total_clients : null,
//       total_tested_clients: typeof m.total_tested_clients === "number" ? m.total_tested_clients : null,
//       is_self: false,
//       is_admin: true,
//     };

//     trainersMap[uid] = { trainers: [...myTrainers, adminEntry] };
//   });

//   let excludedAdminCount = 0;
//   // An admin's own device tests: a client row whose email matches a member is the
//   // admin self-testing. Keep it out of the client lists (admins are never clients)
//   // but record the activity so the cohort can show the admin as a trainer when
//   // they've personally taken readings. Keyed by the admin's dietician code.
//   const adminSelfByCode = {};
//   clients.forEach(c => {
//     const pid = c.profile_id;
//     if (!pid) return;
//     const cEmail = (c.email || "").toLowerCase().trim();
//     // Skip admins — a client profile that matches a group member's email is the
//     // admin, not a client — but capture their own test activity first.
//     if (memberEmails.has(cEmail)) {
//       excludedAdminCount++;
//       const code = (memberByEmail.get(cEmail)?.dietician_id || "").toUpperCase();
//       if (code) {
//         const prev = adminSelfByCode[code] || { total_tests: 0, joined: null, latest: null };
//         const joined = c.joined_dttm || c.created_at || null;
//         adminSelfByCode[code] = {
//           total_tests: prev.total_tests + (typeof c.total_tests === "number" ? c.total_tests : 0),
//           joined: prev.joined && joined ? (new Date(prev.joined) <= new Date(joined) ? prev.joined : joined) : (prev.joined || joined),
//           latest: c.latest_test?.date_time || prev.latest,
//         };
//       }
//       return;
//     }
//     allClients.push({
//       profile_id: pid,
//       name: c.profile_name || "—",
//       email: c.email || "",
//       dietitian_id: c.dietician_id || c.owner?.partner_code || "",
//       fitness_goal: c.fitness_goal || "",
//       total_tests: typeof c.total_tests === "number" ? c.total_tests : null,
//       // Latest test's metabolism score (0–100) from get_group_details — the most
//       // recent reading's result, distinct from the reading-frequency Rate %.
//       metabolism_score: typeof c.latest_test?.metabolism_score === "number" ? c.latest_test.metabolism_score : null,
//       associated_dietitian: { name: c.owner?.name || "—" },
//       client: { joined_dttm: c.joined_dttm || c.created_at || null },
//       test_history: { last_test_date_time: c.latest_test?.date_time || null },
//     });
//     // Per-test dates aren't in the response; the latest test anchors period/"today" reads.
//     readingDatesMap[pid] = c.latest_test?.date_time ? [{ date: c.latest_test.date_time }] : [];
//   });

//   return { taList, trainersMap, allClients, readingDatesMap, excludedAdminCount, excludedTrainerAdminCount, adminSelfByCode };
// }

// const ICO_COLORS = { people: R.blue, person: R.green, "person-add": R.orange, trend: "#7c3aed" };
// function Ico({ type, color }) {
//   const c = color || ICO_COLORS[type] || R.blue;
//   return (
//     <div className="w-10 h-10 flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110" style={{ background: `linear-gradient(135deg, ${c}18, ${c}08)`, borderRadius: R.rCard, border: `1px solid ${c}15` }}>
//       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//         {type === "person" && <><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a7 7 0 0114 0v1" /></>}
//         {type === "people" && <><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-1a5 5 0 0110 0v1" /><circle cx="18" cy="9" r="3" /><path d="M22 21v-1a4 4 0 00-3-3.87" /></>}
//         {type === "person-add" && <><circle cx="10" cy="7" r="3.5" /><path d="M3 21v-1a5 5 0 0110 0" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></>}
//         {type === "trend" && <><polyline points="22 12 18 8 14 12 10 8 2 16" /></>}
//       </svg>
//     </div>
//   );
// }

// function Sparkline({ data, width = 80, height = 28, color = R.blue, filled = true }) {
//   if (!data || data.length < 2) return null;
//   const max = Math.max(...data, 1);
//   const min = Math.min(...data, 0);
//   const range = max - min || 1;
//   const pts = data.map((v, i) => [
//     (i / (data.length - 1)) * width,
//     height - 2 - ((v - min) / range) * (height - 4),
//   ]);
//   const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
//   const area = `${line} L${width},${height} L0,${height} Z`;
//   return (
//     <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
//       {filled && <path d={area} fill={`${color}15`} />}
//       <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
//     </svg>
//   );
// }

// function Donut({ pct, size = 120, thickness = 10, color = R.blue, label, bg, track, textColor }) {
//   const [animPct, setAnimPct] = useState(0);
//   useEffect(() => { const t = setTimeout(() => setAnimPct(pct), 50); return () => clearTimeout(t); }, [pct]);
//   const innerBg = bg || R.white;
//   const trackColor = track || R.surface;
//   const ringBorder = bg ? "none" : `0 0 0 3px ${R.white}, 0 0 0 4px ${R.border}`;
//   return (
//     <div className="flex flex-col items-center gap-1">
//       <div className="rounded-full flex items-center justify-center" style={{ width: size, height: size, background: `conic-gradient(${color} 0% ${animPct}%, ${trackColor} ${animPct}% 100%)`, transition: "background 0.8s ease-out", boxShadow: ringBorder }}>
//         <div className="rounded-full flex items-center justify-center" style={{ width: size - thickness * 2, height: size - thickness * 2, backgroundColor: innerBg }}>
//           <span className="font-extrabold" style={{ fontSize: size * 0.25, color: textColor || R.tp, letterSpacing: "-0.4px" }}>{animPct}%</span>
//         </div>
//       </div>
//       {label && <span style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{label}</span>}
//     </div>
//   );
// }

// function AccTable({ rows, cols }) {
//   const [sort, setSort] = useState({ key: null, asc: true });
//   const sorted = sort.key ? [...rows].sort((a, b) => {
//     const av = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(a) : a[sort.key];
//     const bv = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(b) : b[sort.key];
//     if (av == null && bv == null) return 0;
//     if (av == null) return 1;
//     if (bv == null) return -1;
//     const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
//     return sort.asc ? cmp : -cmp;
//   }) : rows;
//   const toggle = (key) => setSort(s => s.key === key ? { key, asc: !s.asc } : { key, asc: true });
//   const arrow = (key) => sort.key !== key ? "↕" : sort.asc ? "↑" : "↓";
//   const thBase = { fontWeight: 500, padding: "8px 0", fontSize: "10px", color: R.tm, letterSpacing: "-0.2px", borderBottom: `1px solid ${R.border}` };
//   return (
//     <div style={{ display: "flex", flexDirection: "column", fontSize: "12px", letterSpacing: "-0.24px", flex: 1, minHeight: 0 }}>
//       <div className="uppercase" style={{ display: "flex", backgroundColor: "#ffffff", position: "relative", zIndex: 2, flexShrink: 0 }}>
//         {cols.map(c => (
//           <div key={c.key} className="font-semibold cursor-pointer select-none"
//             style={{ ...thBase, flex: 1, textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" }}
//             onClick={() => toggle(c.key)}>
//             {c.label} <span style={{ fontSize: "9px" }}>{arrow(c.key)}</span>
//           </div>
//         ))}
//       </div>
//       <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
//         {sorted.map((r, i) => (
//           <div key={i} className="transition-colors duration-150" style={{ display: "flex", borderBottom: `1px solid ${R.surface}`, backgroundColor: i % 2 === 1 ? `${R.surface}80` : "transparent", cursor: "default" }}
//             onMouseEnter={e => e.currentTarget.style.backgroundColor = `${R.blueLight}60`}
//             onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 1 ? `${R.surface}80` : "transparent"}>
//             {cols.map(c => (
//               <div key={c.key} style={{ flex: 1, padding: "8px 0", textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left", color: c.className?.includes("text-muted") || c.className?.includes("text-secondary") ? R.ts : R.tp }}>
//                 {c.render ? c.render(r) : (typeof c.val === "function" ? c.val(r) : r[c.key])}
//               </div>
//             ))}
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// export default function AnalyticsDashboard() {
//   const dispatch = useDispatch();
//   // MANAGEADMINGROUPS response — captured at login into Redux (setAdminGroups),
//   // re-fetched here if the in-memory store was reset (e.g. hard refresh).
//   const adminGroups = useSelector(selectAdminGroups);
//   const adminGroupsRaw = useSelector(selectAdminGroupsRaw);
//   // group_name for get_group_details comes from the MANAGEADMINGROUPS response.
//   const primaryGroupName = useSelector(selectPrimaryGroupName);
//   const groupDetails = useSelector(selectGroupDetails);
//   const groupDetailsLoading = useSelector(selectGroupDetailsLoading);
//   // Authoritative group totals { members, trainers, clients } from the response.
//   const groupCounts = useSelector(selectGroupCounts);

//   // Entire GETGROUPDETAILS response stored on this page (all client pages merged).
//   const [groupDetailsResponse, setGroupDetailsResponse] = useState(null);

//   const [taList, setTaList] = useState([]);
//   const [trainersMap, setTrainersMap] = useState({});
//   const [allClients, setAllClients] = useState([]);
//   const [readingDatesMap, setReadingDatesMap] = useState({});
//   // Clients dropped because their email matched a group member (admin). Subtracted
//   // from the backend's authoritative client count so admins are never counted.
//   const [excludedAdminCount, setExcludedAdminCount] = useState(0);
//   // Admins are returned inside trainers[] and counted in counts.trainers, but are
//   // shown as Trainer-Admin tabs, not trainer rows — subtract them from the total.
//   const [excludedTrainerAdminCount, setExcludedTrainerAdminCount] = useState(0);
//   // Admin (group-member) code → their own self-test activity ({ total_tests, joined }).
//   const [adminSelfByCode, setAdminSelfByCode] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [loadingPhase, setLoadingPhase] = useState("Connecting...");
//   const [error, setError] = useState(null);
//   const [activeTab, setActiveTab] = useState("overview");
//   const [tabDdOpen, setTabDdOpen] = useState(false);
//   const tabDdRef = useRef(null);
//   const [period, setPeriod] = useState("today");
//   const compare = true;
//   const [timezone, setTimezone] = useState(DEFAULT_TZ);
//   const [clock, setClock] = useState("");
//   const [openAcc, setOpenAcc] = useState(new Set());
//   const [trainerTab, setTrainerTab] = useState("all");
//   const [cohortTab, setCohortTab] = useState(0);
//   const [cohortSubTab, setCohortSubTab] = useState("trainers");

//   useEffect(() => {
//     const tick = () => setClock(new Date().toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }));
//     tick();
//     const id = setInterval(tick, 10000);
//     return () => clearInterval(id);
//   }, [timezone]);

//   useEffect(() => {
//     const handler = (e) => { if (tabDdRef.current && !tabDdRef.current.contains(e.target)) setTabDdOpen(false); };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const loadData = useCallback(async () => {
//     setError(null);
//     try {
//       const now = new Date();
//       let source;
//       if (groupDetails) {
//         // Real data from get_group_details.php.
//         source = buildFromGroupDetails(groupDetails, now);
//       } else if (primaryGroupName) {
//         // We know which group to load but its details haven't arrived yet —
//         // keep the loader up; this effect re-runs once groupDetails lands.
//         setLoading(true);
//         return;
//       } else {
//         // No admin group in context — nothing to show.
//         source = { taList: [], trainersMap: {}, allClients: [], readingDatesMap: {}, excludedAdminCount: 0, excludedTrainerAdminCount: 0, adminSelfByCode: {} };
//       }
//       setTaList(source.taList);
//       setTrainersMap(source.trainersMap);
//       setAllClients(source.allClients);
//       setReadingDatesMap(source.readingDatesMap);
//       setExcludedAdminCount(source.excludedAdminCount || 0);
//       setExcludedTrainerAdminCount(source.excludedTrainerAdminCount || 0);
//       setAdminSelfByCode(source.adminSelfByCode || {});
//       setLoading(false);
//     } catch (e) {
//       setError(e?.message || "Failed to load");
//       toast.error(e?.message || "Failed");
//       setLoading(false);
//     }
//   }, [groupDetails, primaryGroupName]);

//   useEffect(() => { loadData(); }, [loadData]);

//   // If the MANAGEADMINGROUPS payload wasn't handed off from login (e.g. the user
//   // hard-refreshed this page and the in-memory Redux store reset), re-fetch it.
//   useEffect(() => {
//     if (!adminGroupsRaw) dispatch(getAdminGroups());
//   }, [adminGroupsRaw, dispatch]);

//   // The stored MANAGEADMINGROUPS response is now available to this dashboard via
//   // `adminGroups` (response.groups) and `adminGroupsRaw` (full payload).
//   useEffect(() => {
//     if (adminGroupsRaw) console.log("Admin groups (from Redux):", adminGroupsRaw);
//   }, [adminGroupsRaw]);

//   // Once we know the group name (from Redux), pull that group's details. Use a
//   // high limit so every client loads in one shot — the dashboard's totals are
//   // derived from the loaded set, so partial pages would under-count.
//   useEffect(() => {
//     if (primaryGroupName) {
//       dispatch(getGroupDetails({ groupName: primaryGroupName, page: 1, limit: 50, search: "", fetchAll: true }));
//     }
//   }, [primaryGroupName, dispatch]);

//   // Refresh button: re-fetch the group from the API when we have a group name,
//   // otherwise just rebuild from whatever is in state.
//   const handleRefresh = useCallback(() => {
//     if (primaryGroupName) {
//       dispatch(getGroupDetails({ groupName: primaryGroupName, page: 1, limit: 50, search: "", fetchAll: true }));
//     } else {
//       loadData();
//     }
//   }, [primaryGroupName, dispatch, loadData]);

//   useEffect(() => {
//     if (groupDetails) {
//       // Store the entire GETGROUPDETAILS response in a page-level variable.
//       setGroupDetailsResponse(groupDetails);
 
//     }
//   }, [groupDetails]);

//   const now = tzNow(timezone);

//   const computeTa = useCallback((ta) => {
//     if (!ta) return null;
//     const all = (trainersMap[ta.user_id] || { trainers: [] }).trainers;
//     const nonSelf = all.filter(t => !t.is_self);
//     const codes = new Set(all.map(t => (t.partner_code || t.dietician_id || "").toUpperCase()));
//     const taCl = allClients.filter(c => codes.has((c.dietitian_id || c.partner_code || "").toUpperCase()));
//     // Show ALL clients owned by this TA's codes — including profiles whose
//     // email/name matches a trainer (previously hidden as "self-tests").
//     const real = taCl;
//     // Still identify self-test profiles so each trainer's own test activity /
//     // adoption is computed from their self-profile below.
//     const selfT = taCl.filter(c => isSelfTest(c, all));

//     const enrich = c => {
//       const dates = readingDatesMap[c.profile_id] || [];
//       // Prefer the API's authoritative test count; fall back to reading dates (mock).
//       const rd = c.total_tests != null ? c.total_tests : dates.length;
//       const sorted = dates.map(d => d.date).filter(Boolean).sort();
//       const last = sorted.length ? sorted[sorted.length - 1] : null;
//       const onb = c.client?.joined_dttm || (sorted.length ? sorted[0] : null);
//       const lastT = c.test_history?.last_test_date_time || last;
//       const ds = onb ? daysBetween(onb, now) : 0;
//       const pct = ds > 0 ? Math.min(100, Math.round((rd / ds) * 100)) : 0;
//       const code = (c.dietitian_id || "").toUpperCase();
//       const tr = all.find(t => (t.partner_code || t.dietician_id || "").toUpperCase() === code);
//       return { ...c, trainerName: tr?.name || c.associated_dietitian?.name || "—", readingDays: rd, onboardedDate: onb, daysSince: ds, pct, cohort: getCohort(pct), lastDate: lastT };
//     };

//     const clients = real.map(enrich).sort((a, b) => b.pct - a.pct);
//     const trainers = nonSelf.map(t => {
//       const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim();
//       const tc = (t.partner_code || t.dietician_id || "").toUpperCase();
//       const sc = selfT.find(c => { const ce = (c.email || "").toLowerCase().trim(), cn = (c.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
//       const allDates = sc ? (readingDatesMap[sc.profile_id] || []) : [];
//       const ds = t.created_at ? daysBetween(t.created_at, now) : 0;
//       const dates = t.created_at ? allDates.filter(d => !d.date || new Date(d.date) >= new Date(new Date(t.created_at).getFullYear(), new Date(t.created_at).getMonth(), new Date(t.created_at).getDate())) : allDates;
//       // Prefer the API's authoritative counts; fall back to derived values (mock).
//       const rd = t.total_tests != null ? t.total_tests : dates.length;
//       const pct = ds > 0 ? Math.min(100, Math.round((rd / ds) * 100)) : 0;
//       const realClientCount = t.total_clients != null ? t.total_clients : clients.filter(c => (c.dietitian_id || "").toUpperCase() === tc).length;
//       // Clients under this trainer who have taken at least one test (backend-authoritative; fall back to deriving from reads).
//       const testedClientCount = t.total_tested_clients != null ? t.total_tested_clients : clients.filter(c => (c.dietitian_id || "").toUpperCase() === tc && (c.readingDays || 0) > 0).length;
//       // The trainer's OWN tests — from their self-test client profile (sc). 0 if the backend stripped it (email-matched self-profiles are excluded from the clients array).
//       const selfTests = sc ? (sc.total_tests != null ? sc.total_tests : (readingDatesMap[sc.profile_id] || []).length) : 0;
//       return { ...t, daysSince: ds, readingDays: rd, selfTests, pct, cohort: getCohort(pct), realClientCount, testedClientCount, hasSelfTest: !!sc, selfProfileId: sc?.profile_id || null };
//     }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount);

//     const goals = { weight_loss: 0, fat_loss: 0, muscle_gain: 0 };
//     clients.forEach(c => { const g = (c.fitness_goal || "").toLowerCase(); if (g in goals) goals[g]++; });
//     return { ta, trainers, clients, totalTrainers: nonSelf.length, activeTrainers: trainers.filter(t => t.pct >= ACTIVE_THRESHOLD).length, totalClients: clients.length, activeClients: clients.filter(c => c.pct >= ACTIVE_THRESHOLD).length, goals };
//   }, [trainersMap, allClients, readingDatesMap, now]);

//   const taData = useMemo(() => { const m = {}; taList.forEach(ta => { m[ta.user_id] = computeTa(ta); }); return m; }, [taList, computeTa]);
//   const allTrainers = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.trainers.map(t => ({ ...t, taName: ta.name })) : []; }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount), [taList, taData]);
//   const allRealClients = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.clients : []; }).sort((a, b) => b.pct - a.pct), [taList, taData]);
//   const totals = useMemo(() => {
//     const v = Object.values(taData).filter(Boolean);
//     return { trainers: v.reduce((s, x) => s + x.totalTrainers, 0), activeT: v.reduce((s, x) => s + x.activeTrainers, 0), clients: v.reduce((s, x) => s + x.totalClients, 0), activeC: v.reduce((s, x) => s + x.activeClients, 0), goals: { fat_loss: v.reduce((s, x) => s + x.goals.fat_loss, 0), muscle_gain: v.reduce((s, x) => s + x.goals.muscle_gain, 0), weight_loss: v.reduce((s, x) => s + x.goals.weight_loss, 0) } };
//   }, [taData]);

//   const selTa = activeTab !== "overview" ? taList.find(t => t.user_id === activeTab) : null;
//   const selData = selTa ? taData[selTa.user_id] : null;
//   const tabCl = activeTab === "overview" ? allRealClients : (selData?.clients || []);
//   const tabTr = activeTab === "overview" ? allTrainers : (selData?.trainers || []);
//   const avgActivity = useMemo(() => { if (!tabCl.length) return 0; return Math.round(tabCl.reduce((s, c) => s + c.pct, 0) / tabCl.length); }, [tabCl]);

//   if (loading) return (
//     <div className="flex flex-col items-center justify-center gap-5" style={{ height: "calc(100vh - 130px)" }}>
//       <div className="flex items-center gap-2">
//         {[0, 1, 2].map(i => (
//           <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: R.blue, animation: `loaderBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
//         ))}
//       </div>
//       <div style={{ fontSize: "13px", color: R.ts, fontWeight: 500, letterSpacing: "-0.26px" }}>{loadingPhase}</div>
//     </div>
//   );

//   if (error) return (
//     <div className="flex flex-col items-center justify-center gap-3" style={{ height: "calc(100vh - 130px)" }}>
//       <div className="max-w-md text-center" style={{ background: "#fef2f2", border: `1px solid ${R.red}30`, color: R.red, borderRadius: R.rCard, padding: "16px", fontSize: "13px", letterSpacing: "-0.26px" }}>{error}</div>
//       <button onClick={handleRefresh} className="cursor-pointer" style={{ borderRadius: R.rPill, background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 20px", letterSpacing: "-0.24px", border: "none" }}>Retry</button>
//     </div>
//   );

//   // Overview Trainers/Clients totals come from the authoritative `counts` in the
//   // GETGROUPDETAILS response, falling back to the derived totals (demo/mock).
//   const tTotal = activeTab === "overview" ? Math.max(0, (groupCounts?.trainers ?? totals.trainers) - excludedTrainerAdminCount) : (selData?.totalTrainers ?? 0);
//   const tActive = activeTab === "overview" ? totals.activeT : (selData?.activeTrainers ?? 0);
//   // Subtract admin profiles that the backend counted as clients (0 if it already excluded them).
//   const cTotal = activeTab === "overview" ? Math.max(0, (groupCounts?.clients ?? totals.clients) - excludedAdminCount) : (selData?.totalClients ?? 0);
//   const cActive = activeTab === "overview" ? totals.activeC : (selData?.activeClients ?? 0);
//   const curGoals = activeTab === "overview" ? totals.goals : (selData?.goals || { fat_loss: 0, muscle_gain: 0, weight_loss: 0 });

//   const range = getPeriodRange(period, now);
//   const prevR = compare ? getPrevRange(period, now) : null;
//   const pm = periodMetrics(tabCl, tabTr, readingDatesMap, range);
//   const ppm = prevR ? periodMetrics(tabCl, tabTr, readingDatesMap, prevR) : null;

//   const adoptionRate = tTotal > 0 ? Math.round((tActive / tTotal) * 100) : 0;
//   const engagementRate = cTotal > 0 ? Math.round((cActive / cTotal) * 100) : 0;
//   const activeTrainers = tabTr.filter(t => t.pct >= ACTIVE_THRESHOLD);
//   const eliteTrainers = tabTr.filter(t => t.pct >= 100);
//   const atRiskTrainers = tabTr.filter(t => t.pct < 30);
//   const eliteCount = eliteTrainers.length;
//   const atRiskTrainerCount = atRiskTrainers.length;
//   const highestRate = tabCl.length > 0 ? Math.max(...tabCl.map(c => c.pct)) : 0;
//   const lowestRate = tabCl.length > 0 ? Math.min(...tabCl.map(c => c.pct)) : 0;

//   const todayR = getPeriodRange("today", now);
//   const yesterdayR = getPrevRange("today", now);
//   const todayStats = periodMetrics(tabCl, tabTr, readingDatesMap, todayR);
//   const yesterdayStats = periodMetrics(tabCl, tabTr, readingDatesMap, yesterdayR);

//   const wkR = getPeriodRange("week", now);
//   const pwkR = getPrevRange("week", now);
//   const wkStats = periodMetrics(tabCl, tabTr, readingDatesMap, wkR);
//   const pwkStats = periodMetrics(tabCl, tabTr, readingDatesMap, pwkR);

//   const trainerWeekDelta = wkStats.newTrainers - pwkStats.newTrainers;
//   const readingsWeekDelta = wkStats.reads - pwkStats.reads;
//   const clientWeekDelta = wkStats.newClients - pwkStats.newClients;

//   const last7Days = (() => {
//     const days = [];
//     for (let i = 6; i >= 0; i--) {
//       const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
//       const r = { start: d, end: d };
//       let count = 0;
//       tabCl.forEach(c => { (readingDatesMap[c.profile_id] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
//       tabTr.forEach(t => { if (t.selfProfileId) (readingDatesMap[t.selfProfileId] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
//       days.push(count);
//     }
//     return days;
//   })();

//   const last4WeeksTrainers = (() => {
//     const weeks = [];
//     for (let w = 3; w >= 0; w--) {
//       const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
//       const start = new Date(end); start.setDate(end.getDate() - 6);
//       weeks.push(tabTr.filter(t => inRange(t.created_at, { start, end })).length);
//     }
//     return weeks;
//   })();

//   const last4WeeksClients = (() => {
//     const weeks = [];
//     for (let w = 3; w >= 0; w--) {
//       const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
//       const start = new Date(end); start.setDate(end.getDate() - 6);
//       weeks.push(tabCl.filter(c => inRange(c.onboardedDate, { start, end })).length);
//     }
//     return weeks;
//   })();

//   // All readings live on client profiles now (trainer self-test profiles are
//   // shown as clients too). Partition the client reads by whether the profile is
//   // a trainer's own self-test, so the Trainers/Clients split stays meaningful
//   // WITHOUT double-counting: Total == sum of client tests.
//   const selfPidSet = new Set(tabTr.map(t => t.selfProfileId).filter(Boolean));
//   const allTimeClientReads = tabCl.reduce((s, c) => s + (c.readingDays || 0), 0);
//   const allTimeTrainerReads = tabCl.reduce((s, c) => selfPidSet.has(c.profile_id) ? s + (c.readingDays || 0) : s, 0);
//   const allTimeTotalReads = allTimeClientReads;
//   // Readings-card split as people counts — mirror the snapshot cards exactly so
//   // the split totals match the Trainers/Clients cards above. Using cTotal (not the
//   // sum of each trainer's total_clients) keeps admin-owned clients — the ones under
//   // the admin's own code, not any non-self trainer — in the client count.
//   const networkTrainerCount = tTotal;
//   const networkClientCount = cTotal;
//   const networkSplitTotal = networkTrainerCount + networkClientCount;
//   // Same partition for the selected period: total is the client reads in range;
//   // the trainer slice is the self-test subset of those, never an added bucket.
//   const periodTotalReads = pm.reads;
//   const periodTrainerReads = range
//     ? tabCl.reduce((s, c) => selfPidSet.has(c.profile_id) ? s + (readingDatesMap[c.profile_id] || []).filter(x => inRange(x.date, range)).length : s, 0)
//     : allTimeTrainerReads;
//   const periodClientReads = Math.max(0, periodTotalReads - periodTrainerReads);
//   const prevTotalReads = ppm ? ppm.reads : 0;
//   const periodLabel = period === "today" ? `TODAY (${fmtDate(range?.start).toUpperCase()})`
//     : period === "week" ? `THIS WEEK (${fmtRange(range).toUpperCase()})`
//       : period === "month" ? `THIS MONTH (${fmtRange(range).toUpperCase()})`
//         : "ALL TIME";

//   const CTIERS = [
//     { label: "100%", min: 100, max: 100, color: R.blue },
//     { label: "90% – 99%", min: 90, max: 99, color: R.blue },
//     { label: "70% – 89%", min: 70, max: 89, color: R.blue },
//     { label: "50% – 69%", min: 50, max: 69, color: R.blue },
//     { label: "30% – 49%", min: 30, max: 49, color: R.orange },
//     { label: "<30%", min: 0, max: 29, color: R.red },
//   ];
//   // Bucket clients by their reading rate. Trainer self-test profiles also appear
//   // in tabCl, so exclude them — the cohort's people axis is real clients only.
//   const cohortClients = tabCl.filter(c => !selfPidSet.has(c.profile_id));
//   // Group-member (admin) codes: an admin who directly owns a client is NOT a
//   // trainer, so never surface them in the cohort's Trainers tab.
//   const adminCodeSet = new Set(taList.map(ta => (ta.partner_code || "").toUpperCase()).filter(Boolean));
//   // Resolve a client's coaching trainer (by dietitian code) to the enriched
//   // trainer row so the Trainers tab can show that trainer's own stats.
//   const trByCode = new Map();
//   tabTr.forEach(t => { const code = (t.partner_code || t.dietician_id || "").toUpperCase(); if (code) trByCode.set(code, t); });
//   const totalPeople = cohortClients.length;
//   const cohortData = CTIERS.map(tier => {
//     const clientsIn = cohortClients.filter(c => c.pct >= tier.min && c.pct <= tier.max);
//     // Bind trainers to the band: the distinct trainers who coach the clients in it
//     // (the same trainers named in the client rows), each with a count of how many
//     // of their clients land here. Admin-owned clients contribute no trainer row.
//     const byTrainer = new Map();
//     clientsIn.forEach(c => {
//       const code = (c.dietitian_id || "").toUpperCase();
//       const isAdmin = adminCodeSet.has(code);
//       // Admins appear in the Trainers tab only for bands where a client they
//       // directly own has actually taken readings (skip their zero-reading clients).
//       const adminSelf = isAdmin ? adminSelfByCode[code] : null;
//       if (isAdmin && !((c.readingDays ?? 0) > 0)) return;
//       const key = code || (c.trainerName || "—");
//       let entry = byTrainer.get(key);
//       if (!entry) {
//         const tr = trByCode.get(code);
//         // Admin's Own Rate is their own self-test rate (tests ÷ days since they joined).
//         let pct = tr ? tr.pct : null;
//         if (isAdmin && adminSelf) {
//           const ds = adminSelf.joined ? daysBetween(adminSelf.joined, now) : 0;
//           pct = ds > 0 ? Math.min(100, Math.round((adminSelf.total_tests / ds) * 100)) : 0;
//         }
//         entry = { ...(tr || {}), name: tr?.name || c.trainerName || "—", partner_code: tr?.partner_code || code || "—", taName: tr?.taName || c.taName, pct, _clientsHere: 0, _self: isAdmin };
//         byTrainer.set(key, entry);
//       }
//       entry._clientsHere += 1;
//     });
//     const trainersIn = Array.from(byTrainer.values());
//     const count = clientsIn.length;
//     return { ...tier, count, trainersIn, clientsIn, pctOfTotal: totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0 };
//   });
//   const maxCohortCount = Math.max(...cohortData.map(c => c.count), 1);

//   const onboardedTrainersToday = tabTr.filter(t => inRange(t.created_at, todayR));
//   const onboardedClientsToday = tabCl.filter(c => inRange(c.onboardedDate, todayR));
//   const readingsToday = tabCl.filter(c => { const d = readingDatesMap[c.profile_id] || []; return d.some(x => inRange(x.date, todayR)); });
//   const onboardedTrainersYesterday = tabTr.filter(t => inRange(t.created_at, yesterdayR));
//   const onboardedClientsYesterday = tabCl.filter(c => inRange(c.onboardedDate, yesterdayR));

//   const toggleAcc = (key) => setOpenAcc(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

//   const riskyTrainers = tabTr.filter(t => t.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);
//   const riskyClients = tabCl.filter(c => c.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);

//   const tChange = pctChange(todayStats.newTrainers, yesterdayStats.newTrainers);
//   const cChange = pctChange(todayStats.newClients, yesterdayStats.newClients);
//   const rChange = pctChange(todayStats.reads, yesterdayStats.reads);

//   const rateColor = (pct) => pct >= ACTIVE_THRESHOLD ? R.green : pct > 0 ? R.orange : R.red;
//   const rateStyle = (pct) => ({ fontWeight: 600, color: rateColor(pct) });
//   const RateCell = ({ pct }) => (
//     <div className="flex items-center gap-2" style={{ justifyContent: "flex-end" }}>
//       <div style={{ width: "36px", height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
//         <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: "2px", backgroundColor: rateColor(pct), transition: "width 0.4s ease" }} />
//       </div>
//       <span style={rateStyle(pct)}>{pct}%</span>
//     </div>
//   );
//   const badgeStyle = (bg, fg) => ({ fontSize: "10px", fontWeight: 500, padding: "2px 8px", borderRadius: R.rBadge, backgroundColor: bg, color: fg, letterSpacing: "-0.2px" });

//   const trainerCols = [
//     { key: "name", label: "Name", val: r => r.name || "—" },
//     { key: "partner_code", label: "Code", val: r => r.partner_code || "—", className: "text-muted font-mono" },
//     ...(activeTab === "overview" ? [{ key: "taName", label: "TA", val: r => r.taName || "—", className: "text-secondary" }] : []),
//     { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//     { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
//     { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
//   ];
//   const clientCols = [
//     { key: "name", label: "Name", val: r => r.name || "—" },
//     { key: "trainerName", label: "Trainer", val: r => r.trainerName || "—", className: "text-secondary" },
//     { key: "fitness_goal", label: "Goal", render: r => <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
//     { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//     { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
//     { key: "metabolism_score", label: "Score", align: "center", val: r => r.metabolism_score ?? null, render: r => r.metabolism_score != null ? <span style={{ fontWeight: 600, color: R.tp }}>{Math.round(r.metabolism_score)}</span> : <span style={{ color: R.td }}>—</span> },
//     { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
//   ];
//   // Trainers shown inside a cohort band are the coaches of that band's clients, so
//   // the columns describe that binding: how many of their clients are in this band,
//   // plus the trainer's own self-test rate (— when it's the admin's own code).
//   const cohortTrainerCols = [
//     { key: "name", label: "Trainer", val: r => r.name || "—" },
//     { key: "partner_code", label: "Code", val: r => r.partner_code || "—", className: "text-muted font-mono" },
//     { key: "taName", label: "TA", val: r => r._self ? "self" : (r.taName || "—"), className: "text-secondary" },
//     { key: "_clientsHere", label: "Clients Here", align: "center", val: r => r._clientsHere ?? 0 },
//     { key: "pct", label: "Own Rate", align: "right", render: r => r.pct == null ? <span style={{ fontSize: "11px", color: R.tm }}>—</span> : <RateCell pct={r.pct} /> },
//   ];

//   const CS = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #EEF2F6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.3s ease, transform 0.3s ease", position: "relative", overflow: "hidden" };
//   const csHover = { boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", transform: "translateY(-2px)" };
//   const csReset = { boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transform: "none" };

//   const maxGoal = Math.max(curGoals.fat_loss, curGoals.muscle_gain, curGoals.weight_loss, 1);

//   const deltaStyle = (v) => ({ borderRadius: "8px", padding: "6px 12px", fontSize: "12px", letterSpacing: "-0.24px", fontWeight: 500, backgroundColor: "#F8FAFC", color: R.ts, border: "1px solid #EEF2F6" });
//   const DeltaArrow = ({ v }) => <span style={{ fontWeight: 700, color: v >= 0 ? R.green : R.red, marginRight: "4px" }}>{v >= 0 ? "↑" : "↓"}</span>;

//   return (
//     <div className="overflow-y-scroll custom-scrollbar" style={{ height: "calc(100vh - 130px)", fontFamily: "'Poppins', sans-serif", backgroundColor: "#F5F7FA" }}>
//       {/* ═══ HEADER ═══ */}
//       <div className="flex items-center justify-between py-3 sticky top-0 z-10" style={{ backgroundColor: "#F5F7FA", borderBottom: "1px solid #EEF2F6" }}>
//         {/* ── Left: Page title as dropdown ── */}
//         <div ref={tabDdRef} style={{ position: "relative" }}>
//           <button onClick={() => setTabDdOpen(o => !o)}
//             className="flex items-center gap-2 cursor-pointer transition-all duration-200"
//             style={{ background: "none", border: "none", padding: "4px 0", outline: "none" }}>
//             <span style={{ fontSize: "18px", fontWeight: 700, color: R.tp, letterSpacing: "-0.36px" }}>
//               {activeTab === "overview" ? "Overview" : taList.find(t => t.user_id === activeTab)?.name || "—"}
//             </span>
//             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={R.tm} strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: tabDdOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
//           </button>

//           {tabDdOpen && (
//             <div className="absolute left-0 z-50" style={{ top: "calc(100% + 6px)", minWidth: 220, backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #EEF2F6", boxShadow: "0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)", padding: "6px", animation: "fadeSlideUp 0.15s ease-out" }}>
//               <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>View</div>
//               <button onClick={() => { setActiveTab("overview"); setTabDdOpen(false); }}
//                 className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
//                 style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: activeTab === "overview" ? R.blueLight : "transparent", color: activeTab === "overview" ? R.blue : R.ts, fontSize: "13px", fontWeight: activeTab === "overview" ? 600 : 400, letterSpacing: "-0.26px" }}
//                 onMouseEnter={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = R.surface; }}
//                 onMouseLeave={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = "transparent"; }}>
//                 <span className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: "8px", backgroundColor: activeTab === "overview" ? R.blue + "18" : R.surface }}>
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={activeTab === "overview" ? R.blue : R.tm} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
//                 </span>
//                 Overview
//               </button>
//               {taList.length > 0 && <>
//                 <div style={{ height: "1px", backgroundColor: R.border, margin: "6px 10px" }} />
//                 <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>Trainer Admins</div>
//               </>}
//               {taList.map((t, i) => {
//                 const isActive = activeTab === t.user_id;
//                 const dotColor = [R.blue, R.green, R.orange, "#7c3aed"][i % 4];
//                 return (
//                   <button key={t.user_id} onClick={() => { setActiveTab(t.user_id); setTabDdOpen(false); }}
//                     className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
//                     style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: isActive ? R.blueLight : "transparent", color: isActive ? R.blue : R.ts, fontSize: "13px", fontWeight: isActive ? 600 : 400, letterSpacing: "-0.26px" }}
//                     onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = R.surface; }}
//                     onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}>
//                     <span className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: "8px", background: isActive ? `linear-gradient(135deg, ${R.blue}, ${R.dark})` : R.surface, color: isActive ? R.white : R.ts, fontSize: "11px", fontWeight: 700 }}>
//                       {(t.name || "?")[0]}
//                     </span>
//                     <div className="flex-1 text-left">
//                       <div className="truncate">{t.name}</div>
//                       {t.email && <div className="truncate" style={{ fontSize: "11px", color: R.tm, fontWeight: 400 }}>{t.email}</div>}
//                     </div>
//                     <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
//                   </button>
//                 );
//               })}
//             </div>
//           )}
//         </div>

//         {/* ── Right: Controls ── */}
//         <div className="flex items-center gap-3">
//           {/* Refresh */}
//           <button onClick={handleRefresh} className="flex items-center justify-center cursor-pointer transition-all duration-200"
//             style={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: "#ffffff", border: "1px solid #EEF2F6", color: R.tm }}
//             onMouseEnter={e => { e.currentTarget.style.backgroundColor = R.blueLight; e.currentTarget.style.color = R.blue; e.currentTarget.style.borderColor = R.blue + "40"; }}
//             onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.color = R.tm; e.currentTarget.style.borderColor = "#EEF2F6"; }}>
//             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
//           </button>

//           {/* Timezone + Clock cluster */}
//           <div className="flex items-center gap-2" style={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #EEF2F6", padding: "6px 12px" }}>
//             <div className="flex items-center" style={{ backgroundColor: R.surface, borderRadius: "8px", padding: "2px", gap: "2px" }}>
//               {Object.entries(TIMEZONES).map(([tz, label]) => (
//                 <button key={tz} onClick={() => setTimezone(tz)}
//                   className="cursor-pointer transition-all duration-200"
//                   style={{ padding: "4px 10px", fontSize: "11px", fontWeight: timezone === tz ? 600 : 500, letterSpacing: "-0.22px", backgroundColor: timezone === tz ? R.dark : "transparent", color: timezone === tz ? R.white : R.ts, border: "none", borderRadius: "6px" }}
//                   onMouseEnter={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = R.border; e.currentTarget.style.color = R.tp; } }}
//                   onMouseLeave={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = R.ts; } }}>{label}</button>
//               ))}
//             </div>
//             <div style={{ width: "1px", height: "20px", backgroundColor: R.border }} />
//             <div className="flex items-center gap-1.5 whitespace-nowrap" style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px" }}>
//               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
//               <span>{clock}</span>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="flex flex-col gap-5 pb-8 pt-2">

//         {/* ═══ TA PROFILE (individual tabs only) ═══ */}
//         {selTa && (
//           <div className="flex items-center gap-4" style={{ ...CS, padding: "16px 24px" }}>
//             <div className="w-10 h-10 flex items-center justify-center font-bold text-white" style={{ borderRadius: "12px", background: `linear-gradient(135deg, ${R.dark} 0%, ${R.blue} 100%)`, fontSize: "18px", letterSpacing: "-0.36px" }}>{(selTa.name || "?")[0]}</div>
//             <div className="flex-1">
//               <div style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.3px", color: R.tp }}>{selTa.name}</div>
//               <div style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{selTa.email}</div>
//             </div>
//             <div className="flex gap-8 shrink-0">
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Code</div><div className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: R.tp, letterSpacing: "-0.26px" }}>{selTa.partner_code}</div></div>
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Since</div><div style={{ fontSize: "13px", fontWeight: 600, color: R.tp, letterSpacing: "-0.26px" }}>{fmtDate(selTa.created_at)}</div></div>
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Days Active</div><div style={{ fontSize: "13px", fontWeight: 700, color: R.blue, letterSpacing: "-0.26px" }}>{selTa.created_at ? daysBetween(selTa.created_at, now) : "—"}</div></div>
//             </div>
//           </div>
//         )}

//         {/* ═══ 2-ROW GRID: Left (Snapshot + Trainer Adoption) | Right (Period + Reading Split spanning both) ═══ */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "14px", gridTemplateRows: "auto 1fr" }}>

//           {/* ── Left Top: Snapshot cards ── */}
//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
//             {/* Card: Trainers */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.blue}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Trainers</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.newTrainers > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newTrainers} this wk</span>}
//                   <Ico type="people" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between mt-3">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{tTotal}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                   <div className="flex items-center gap-2 mt-1">
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{tActive} Active</span>
//                     <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {tTotal}</span>
//                   </div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last4WeeksTrainers} width={64} height={28} color={R.blue} />
//                   <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
//                 </div>
//               </div>
//               <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
//                 <div style={{ width: `${adoptionRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.blue}, ${R.green})`, transition: "width 0.6s ease" }} />
//               </div>
//               <div className="flex items-center justify-between mt-1.5">
//                 <span style={{ fontSize: "10px", color: R.tm }}>Adoption</span>
//                 <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{adoptionRate}%</span>
//               </div>
//             </div>

//             {/* Card: Clients */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.green}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Clients</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.newClients > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newClients} this wk</span>}
//                   <Ico type="person" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between mt-3">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{cTotal}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                   <div className="flex items-center gap-2 mt-1">
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{cActive} Active</span>
//                     <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {cTotal}</span>
//                   </div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last4WeeksClients} width={64} height={28} color={R.green} />
//                   <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
//                 </div>
//               </div>
//               <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
//                 <div style={{ width: `${engagementRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.green}, #10B981)`, transition: "width 0.6s ease" }} />
//               </div>
//               <div className="flex items-center justify-between mt-1.5">
//                 <span style={{ fontSize: "10px", color: R.tm }}>Engagements</span>
//                 <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{engagementRate}%</span>
//               </div>
//             </div>

//             {/* Card: Readings */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px", borderLeft: "3px solid #7C3AED", height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Readings</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.reads > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: "#7C3AED", backgroundColor: "#7C3AED12", padding: "2px 6px", borderRadius: "4px" }}>{wkStats.reads} this wk</span>}
//                   <Ico type="trend" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{allTimeTotalReads}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last7Days} width={90} height={32} color="#7C3AED" />
//                   <span style={{ fontSize: "9px", color: R.tm }}>Last 7 days</span>
//                 </div>
//               </div>
//               <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
//                 {[["Trainers", networkTrainerCount, R.blue], ["Clients", networkClientCount, R.green]].map(([l, v, c]) => (
//                   <div key={l} className="flex items-center gap-2">
//                     <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: c, flexShrink: 0 }} />
//                     <span style={{ fontSize: "11px", color: R.ts, flex: 1 }}>{l}</span>
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.tp }}>{v}</span>
//                     {networkSplitTotal > 0 && <span style={{ fontSize: "10px", color: R.tm }}>({Math.round((v / networkSplitTotal) * 100)}%)</span>}
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* ── Right: Period + Reading Split — spans 2 rows ── */}
//           <div className="analytics-card-animate" style={{ gridRow: "1 / 3", gridColumn: 2, alignSelf: "start", borderRadius: "16px", padding: "28px 24px", background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)", color: "#ffffff", position: "relative", overflow: "hidden", transition: "box-shadow 0.3s ease, transform 0.3s ease", display: "flex", flexDirection: "column" }}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, { boxShadow: "0 8px 32px rgba(15,23,42,0.4)", transform: "translateY(-2px)" })}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none" })}>

//             {/* Header */}
//             <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
//               <div>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "4px" }}>Period Overview</div>
//                 <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.3px" }}>{periodLabel}</span>
//               </div>
//               <div className="flex items-center" style={{ backgroundColor: "rgba(148,163,184,0.12)", borderRadius: "8px", padding: "2px", gap: "2px" }}>
//                 {[["today", "D"], ["week", "W"], ["month", "M"]].map(([k, l]) => (
//                   <button key={k} onClick={() => setPeriod(k)}
//                     className="cursor-pointer transition-all duration-200"
//                     style={{ padding: "5px 12px", fontSize: "11px", fontWeight: period === k ? 700 : 500, backgroundColor: period === k ? R.blue : "transparent", color: "#ffffff", border: "none", borderRadius: "6px", opacity: period === k ? 1 : 0.6 }}>{l}</button>
//                 ))}
//               </div>
//             </div>

//             {/* Hero metric — Total Readings */}
//             <div className="text-center" style={{ padding: "8px 0 20px" }}>
//               <div style={{ fontSize: "44px", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1 }}>{periodTotalReads}</div>
//               <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", letterSpacing: "0.3px" }}>Total Readings</div>
//               {ppm && (
//                 <div className="flex items-center justify-center gap-1.5 mt-2">
//                   <span style={{ fontSize: "11px", fontWeight: 600, color: periodTotalReads >= prevTotalReads ? "#4ade80" : "#f87171" }}>
//                     {periodTotalReads >= prevTotalReads ? "↑" : "↓"} {Math.abs(periodTotalReads - prevTotalReads)}
//                   </span>
//                   <span style={{ fontSize: "11px", color: "#475569" }}>vs {prevLbl(period, now)}</span>
//                 </div>
//               )}
//             </div>

//             {/* Onboarding metrics — 2 compact cards side by side */}
//             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
//               {[
//                 { val: pm.newTrainers, prev: ppm?.newTrainers, label: "Trainers", sub: "Onboarded", color: R.blue },
//                 { val: pm.newClients, prev: ppm?.newClients, label: "Clients", sub: "Onboarded", color: R.green },
//               ].map((item) => (
//                 <div key={item.label} style={{ padding: "14px", borderRadius: "12px", backgroundColor: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.1)" }}>
//                   <div className="flex items-center justify-between">
//                     <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: item.color }} />
//                     {item.prev != null && item.val !== item.prev && (
//                       <span style={{ fontSize: "10px", fontWeight: 600, color: item.val >= item.prev ? "#4ade80" : "#f87171" }}>
//                         {item.val >= item.prev ? "+" : ""}{item.val - item.prev}
//                       </span>
//                     )}
//                   </div>
//                   <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-1px", marginTop: "8px", lineHeight: 1 }}>{item.val}</div>
//                   <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{item.label} {item.sub}</div>
//                 </div>
//               ))}
//             </div>

//             {/* Device Adoption + Reading Split — side by side */}
//             <div className="flex-1 flex gap-4" style={{ paddingTop: "20px", borderTop: "1px solid rgba(148,163,184,0.1)", marginTop: "20px" }}>

//               {/* Device Adoption — left column */}
//               <div className="flex-1 flex flex-col items-center" style={{ borderRight: "1px solid rgba(148,163,184,0.1)", paddingRight: "16px" }}>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Device Adoption</div>
//                 <Donut pct={avgActivity} size={90} thickness={8} color={R.blue} bg="#0f172a" track="rgba(148,163,184,0.12)" textColor="#ffffff" />
//                 <div style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", marginTop: "12px" }}>Avg Reading Rate</div>
//               </div>

//               {/* Reading Split — right column */}
//               <div className="flex-1 flex flex-col items-center" style={{ paddingLeft: "4px" }}>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Reading Split</div>
//                 {(() => {
//                   const trPct = periodTotalReads > 0 ? Math.round((periodTrainerReads / periodTotalReads) * 100) : 0;
//                   return (
//                     <div className="flex flex-col items-center gap-4 flex-1 w-full">
//                       <div className="rounded-full flex items-center justify-center" style={{
//                         width: 90, height: 90,
//                         background: periodTotalReads > 0
//                           ? `conic-gradient(${R.blue} 0% ${trPct}%, ${R.green}80 ${trPct}% 100%)`
//                           : "rgba(148,163,184,0.12)"
//                       }}>
//                         <div className="rounded-full flex items-center justify-center" style={{ width: 70, height: 70, backgroundColor: "#0f172a" }}>
//                           <div className="text-center">
//                             <div style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1 }}>{periodTotalReads}</div>
//                             <div style={{ fontSize: "8px", color: "#64748b", marginTop: "2px" }}>readings</div>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="w-full" style={{ height: "5px", borderRadius: "3px", overflow: "hidden", display: "flex", backgroundColor: "rgba(148,163,184,0.12)" }}>
//                         {periodTotalReads > 0 && <>
//                           <div style={{ width: `${trPct}%`, height: "100%", backgroundColor: R.blue, transition: "width 0.4s ease" }} />
//                           <div style={{ flex: 1, height: "100%", backgroundColor: `${R.green}80` }} />
//                         </>}
//                       </div>

//                       <div className="flex flex-col gap-2 w-full">
//                         {[
//                           { label: "Trainers", val: periodTrainerReads, color: R.blue },
//                           { label: "Clients", val: periodClientReads, color: `${R.green}80` },
//                         ].map(s => (
//                           <div key={s.label} className="flex items-center gap-2" style={{ padding: "6px 10px", borderRadius: "8px", backgroundColor: "rgba(148,163,184,0.05)" }}>
//                             <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.color, flexShrink: 0 }} />
//                             <span style={{ fontSize: "11px", color: "#94a3b8", flex: 1 }}>{s.label}</span>
//                             <span style={{ fontSize: "14px", fontWeight: 700 }}>{s.val}</span>
//                             <span style={{ fontSize: "10px", color: "#475569" }}>({periodTotalReads > 0 ? Math.round((s.val / periodTotalReads) * 100) : 0}%)</span>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   );
//                 })()}
//               </div>
//             </div>
//           </div>

//           {/* ── Left Bottom: Trainer Adoption ── */}
//           <div className="p-5 analytics-card-animate" style={{ ...CS, display: "flex", flexDirection: "column", height: "420px" }}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Trainer Adoption</h2>
//                 <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are trainers using the device?</p>
//               </div>
//               <div className="flex items-center gap-4">
//                 <div className="text-center">
//                   <div style={{ fontSize: "20px", fontWeight: 700, color: R.tp, lineHeight: 1 }}>{tTotal}</div>
//                   <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Total</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="text-center">
//                   <div style={{ fontSize: "20px", fontWeight: 700, color: R.green, lineHeight: 1 }}>{tActive}</div>
//                   <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Active</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
//                   <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{adoptionRate}%</div>
//                   <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Adoption</div>
//                 </div>
//               </div>
//             </div>

//             {/* Tabs */}
//             <div className="flex gap-1 mt-4 p-1" style={{ backgroundColor: "#F1F5F9", borderRadius: "10px" }}>
//               {[
//                 { key: "all", dotColor: R.blue, count: tTotal, label: "All" },
//                 { key: "active", dotColor: R.green, count: tActive, label: `Active` },
//                 { key: "elite", dotColor: "#10B981", count: eliteCount, label: "Elite" },
//                 { key: "atrisk", dotColor: R.red, count: atRiskTrainerCount, label: "At Risk" },
//               ].map(t => (
//                 <button key={t.key} onClick={() => setTrainerTab(t.key)} className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer" style={{
//                   padding: "7px 10px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, letterSpacing: "-0.24px", transition: "all 0.2s ease",
//                   backgroundColor: trainerTab === t.key ? "#ffffff" : "transparent",
//                   color: trainerTab === t.key ? R.tp : R.tm,
//                   boxShadow: trainerTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
//                 }}>
//                   <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.dotColor }} />
//                   <span>{t.count}</span>
//                   <span style={{ fontWeight: 500 }}>{t.label}</span>
//                 </button>
//               ))}
//             </div>

//             {/* Tab content — table fills available space */}
//             <div className="mt-3 flex-1 flex flex-col" style={{ overflow: "hidden" }}>
//               {(() => {
//                 const tabs = { all: tabTr, active: activeTrainers, elite: eliteTrainers, atrisk: atRiskTrainers };
//                 const list = tabs[trainerTab] || [];
//                 if (list.length === 0) return <div className="flex flex-col items-center justify-center flex-1 gap-3">
//                   <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
//                     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
//                   </div>
//                   <div className="text-center">
//                     <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>No trainers in this group</div>
//                     <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>Try selecting a different tab</div>
//                   </div>
//                 </div>;
//                 if (trainerTab === "all") return <AccTable rows={list} cols={[
//                   { key: "name", label: "Trainer", val: r => r.name || "—" },
//                   { key: "realClientCount", label: "Clients", align: "center", val: r => r.realClientCount ?? 0 },
//                   { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//                   { key: "readingDays", label: "Tests", align: "center", val: r => r.readingDays ?? 0 },
//                   { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
//                   {
//                     key: "status", label: "Status", align: "right", val: r => r.pct >= ELITE_THRESHOLD ? 2 : r.pct >= ACTIVE_THRESHOLD ? 1 : 0, render: r => r.pct >= ELITE_THRESHOLD
//                       ? <span style={badgeStyle(R.greenLight, R.green)}>Elite</span>
//                       : r.pct >= ACTIVE_THRESHOLD
//                         ? <span style={badgeStyle(R.blueLight, R.blue)}>Active</span>
//                         : <span style={badgeStyle("#fef2f2", R.red)}>At Risk</span>
//                   },
//                 ]} />;
//                 return <AccTable rows={list} cols={trainerCols} />;
//               })()}
//             </div>

//             <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #EEF2F6" }}>
//               <div className="italic" style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px" }}>Adoption = Trainers with reading rate {"≥"} {ACTIVE_THRESHOLD}% / Total trainers ({tActive}/{tTotal} = {adoptionRate}%)</div>
//               <div className="mt-2" style={deltaStyle(trainerWeekDelta)}>
//                 <DeltaArrow v={trainerWeekDelta} />{Math.abs(trainerWeekDelta)} {trainerWeekDelta === 1 || trainerWeekDelta === -1 ? "trainer" : "trainers"} this week vs last
//               </div>
//             </div>
//           </div>

//         </div>

//         {/* ═══ ROW 3: CLIENT ENGAGEMENT (wide) + READING RATE COHORTS ═══ */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "stretch" }}>
//           {/* Client Engagement */}
//           <div className="p-5 analytics-card-animate" style={CS}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Client Engagement</h2>
//                 <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are clients engaged and consistent?</p>
//               </div>
//               <div className="flex items-center gap-4">
//                 <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
//                   <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{avgActivity}%</div>
//                   <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Avg Rate</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="flex gap-3">
//                   <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.green }}>{highestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>High</div></div>
//                   <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.red }}>{lowestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>Low</div></div>
//                 </div>
//               </div>
//             </div>

//             {/* Clients by Goal — compact */}
//             <div className="flex gap-3 mt-3">
//               {[["fat_loss", "Fat Loss", R.orange], ["muscle_gain", "Muscle Gain", R.green]].map(([k, l, c]) => (
//                 <div key={k} className="flex-1 p-2.5" style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", borderLeft: `3px solid ${c}` }}>
//                   <div style={{ fontSize: "16px", fontWeight: 700, color: R.tp }}>{curGoals[k] || 0}</div>
//                   <div style={{ fontSize: "10px", color: R.tm }}>{l}</div>
//                 </div>
//               ))}
//             </div>

//             {/* Client table */}
//             <div className="mt-3 pt-3" style={{ borderTop: "1px solid #EEF2F6", height: "200px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
//               <AccTable rows={tabCl} cols={[
//                 { key: "name", label: "Client", val: r => r.name || "—" },
//                 { key: "profile_id", label: "Profile ID", val: r => r.profile_id || "—", className: "text-muted font-mono" },
//                 { key: "fitness_goal", label: "Goal", val: r => goalLabel(r.fitness_goal), render: r => <span style={{ fontSize: "11px", fontWeight: 500, padding: "3px 10px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
//                 { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//                 { key: "readingDays", label: "Tests", align: "center", val: r => r.readingDays ?? 0 },
//                 { key: "metabolism_score", label: "Score", align: "center", val: r => r.metabolism_score ?? null, render: r => r.metabolism_score != null ? <span style={{ fontWeight: 600, color: R.tp }}>{Math.round(r.metabolism_score)}</span> : <span style={{ color: R.td }}>—</span> },
//                 { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
//               ]} />
//             </div>
//             <div className="mt-2" style={deltaStyle(readingsWeekDelta)}>
//               <DeltaArrow v={readingsWeekDelta} />{Math.abs(readingsWeekDelta)} readings this week vs last week
//             </div>
//           </div>

//           {/* Reading Rate Cohorts — 2-column layout */}
//           <div className="p-5 analytics-card-animate" style={CS}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Reading Rate Cohorts</h2>
//             <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Clients grouped by reading rate — and the trainers coaching each tier.</p>

//             <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "28px", marginTop: "16px" }}>

//               {/* Left: Distribution chart */}
//               <div className="flex flex-col gap-2 pt-1">
//                 {cohortData.map((tier, i) => {
//                   const active = cohortTab === i;
//                   const barPct = maxCohortCount > 0 ? Math.max((tier.count / maxCohortCount) * 100, tier.count > 0 ? 8 : 0) : 0;
//                   return (
//                     <div key={i} className="cursor-pointer" onClick={() => setCohortTab(i)}
//                       style={{ padding: "6px 10px", borderRadius: "10px", transition: "all 0.2s", backgroundColor: active ? `${tier.color}08` : "transparent", border: active ? `1px solid ${tier.color}20` : "1px solid transparent" }}>
//                       <div className="flex items-center justify-between" style={{ marginBottom: "5px" }}>
//                         <span style={{ fontSize: "11px", fontWeight: active ? 700 : 500, color: active ? tier.color : R.ts }}>{tier.label}</span>
//                         <span style={{ fontSize: "12px", fontWeight: 700, color: active ? tier.color : R.tp }}>{tier.count} <span style={{ fontSize: "10px", fontWeight: 500, color: R.tm }}>({tier.pctOfTotal}%)</span></span>
//                       </div>
//                       <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
//                         <div style={{ width: `${barPct}%`, height: "100%", borderRadius: "3px", backgroundColor: tier.color, opacity: active ? 1 : 0.5, transition: "all 0.3s ease" }} />
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>

//               {/* Right: Selected cohort table */}
//               <div style={{ borderLeft: "1px solid #EEF2F6", paddingLeft: "24px", display: "flex", flexDirection: "column" }}>
//                 {cohortData[cohortTab] ? (
//                   cohortData[cohortTab].count === 0 ? (
//                     <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
//                       <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
//                         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
//                       </div>
//                       <div className="text-center">
//                         <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>No one in this cohort</div>
//                         <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>No trainers or clients fall in this range</div>
//                       </div>
//                     </div>
//                   ) : (<>
//                     <div className="flex gap-1 p-1 mb-3" style={{ backgroundColor: "#F1F5F9", borderRadius: "8px", alignSelf: "flex-start" }}>
//                       {[
//                         { key: "trainers", label: "Trainers", count: cohortData[cohortTab].trainersIn.length },
//                         { key: "clients", label: "Clients", count: cohortData[cohortTab].clientsIn.length },
//                       ].map(t => (
//                         <button key={t.key} onClick={() => setCohortSubTab(t.key)} className="cursor-pointer" style={{
//                           padding: "5px 12px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: 600, letterSpacing: "-0.2px", transition: "all 0.2s ease",
//                           backgroundColor: cohortSubTab === t.key ? "#ffffff" : "transparent",
//                           color: cohortSubTab === t.key ? R.tp : R.tm,
//                           boxShadow: cohortSubTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
//                         }}>
//                           {t.label} <span style={{ color: cohortSubTab === t.key ? R.blue : R.tm, marginLeft: "2px" }}>{t.count}</span>
//                         </button>
//                       ))}
//                     </div>
//                     <div style={{ height: "240px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
//                       {cohortSubTab === "trainers" ? (
//                         cohortData[cohortTab].trainersIn.length > 0
//                           ? <AccTable rows={cohortData[cohortTab].trainersIn} cols={cohortTrainerCols} />
//                           : <div className="flex flex-col items-center justify-center gap-2 py-6">
//                             <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No trainers in this range</div>
//                             <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
//                           </div>
//                       ) : (
//                         cohortData[cohortTab].clientsIn.length > 0
//                           ? <AccTable rows={cohortData[cohortTab].clientsIn} cols={clientCols} />
//                           : <div className="flex flex-col items-center justify-center gap-2 py-6">
//                             <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No clients in this range</div>
//                             <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
//                           </div>
//                       )}
//                     </div>
//                   </>)
//                 ) : null}
//               </div>

//             </div>
//           </div>
//         </div>


//         {/* ═══ FOOTER ═══ */}
//         <div className="flex items-start gap-2.5" style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px", padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #EEF2F6" }}>
//           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
//           <span><strong style={{ color: R.ts }}>Active</strong> = Reading rate {"≥"} {ACTIVE_THRESHOLD}% {"·"} <strong style={{ color: R.ts }}>Reading Rate</strong> = Reading days / Days since onboarded {"·"} All clients are counted, including trainer self-test profiles, which also feed trainer adoption.</span>
//         </div>
//       </div>
//     </div>
//   );
// }





















// "use client";

// import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// import { toast } from "sonner";
// import {
//   fetchTrainerAdminListService,
//   fetchAllTrainersForSuperAdminService,
//   fetchSuperAdminAllClientsOverviewService,
//   fetchClientProfileDatesList,
// } from "@/services/authService";

// const TIMEZONES = { "America/Chicago": "Houston, TX", "Asia/Kolkata": "India (IST)" };
// const DEFAULT_TZ = "America/Chicago";
// const ACTIVE_THRESHOLD = 60;
// const EXECUTIVE_TAS = ["Derek", "Evan"];
// const BLUE = "#308BF9";
// const R = {
//   dark: "#252525", blue: "#308bf9", blueLight: "#e9f3ff",
//   green: "#3faf58", greenLight: "#eaffef", red: "#e74c3c", orange: "#e48326", amber: "#ffbf2d",
//   tp: "#252525", ts: "#535359", tm: "#738298", td: "#a1a1a1",
//   border: "#e1e6ed", surface: "#f5f7fa", white: "#ffffff",
//   rCard: "15px", rBadge: "6px", rPill: "33px",
//   shadow: "0 20px 60px rgba(37,37,37,0.08), 0 6px 16px rgba(37,37,37,0.04), 0 1px 3px rgba(37,37,37,0.03)",
// };

// function tzNow(tz) { return new Date(new Date().toLocaleString("en-US", { timeZone: tz })); }
// function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
// function fmtRange(r) { if (!r) return ""; return `${fmtDate(r.start)} – ${fmtDate(r.end)}`; }
// function daysBetween(a, b) {
//   const da = new Date(a), db = new Date(b);
//   if (isNaN(da) || isNaN(db)) return 0;
//   return Math.max(0, Math.round((new Date(da.getFullYear(), da.getMonth(), da.getDate()) - new Date(db.getFullYear(), db.getMonth(), db.getDate())) / -86400000));
// }

// const COHORTS = [90, 70, 50, 25, 10];
// function getCohort(pct) { for (const t of COHORTS) if (pct >= t) return `${t}%+`; return "<10%"; }
// function goalColor(g) { if (!g) return R.tm; const l = g.toLowerCase(); if (l.includes("fat")) return R.orange; if (l.includes("loss")) return R.red; if (l.includes("gain") || l.includes("muscle")) return R.green; return R.blue; }
// function goalLabel(g) { if (!g) return "—"; const l = g.toLowerCase(); if (l.includes("fat")) return "Fat Loss"; if (l.includes("weight")) return "Weight Loss"; if (l.includes("muscle") || l.includes("gain")) return "Muscle Gain"; return g; }

// function isMaskedMatch(m, r) {
//   if (!m || !r) return false;
//   const mp = m.toLowerCase().split("@"), rp = r.toLowerCase().split("@");
//   if (mp.length !== 2 || rp.length !== 2 || mp[1] !== rp[1]) return false;
//   if (mp[0].length < 2 || rp[0].length < 2) return false;
//   return mp[0][0] === rp[0][0] && mp[0][1] === rp[0][1] && mp[0].slice(-1) === rp[0].slice(-1);
// }
// function isMaskedNameMatch(m, r) {
//   if (!m || !r) return false;
//   const mw = m.toLowerCase().trim().split(/\s+/), rw = r.toLowerCase().trim().split(/\s+/);
//   if (!mw.length || mw.length !== rw.length) return false;
//   return mw.every((w, i) => w.length >= 2 && rw[i].length >= 2 && w[0] === rw[i][0] && w[1] === rw[i][1] && w.slice(-1) === rw[i].slice(-1));
// }
// function isSelfTest(client, trainers) {
//   const ce = (client.email || "").toLowerCase().trim(), cn = (client.name || "").trim();
//   return trainers.some(t => { const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
// }

// function getPeriodRange(p, now) {
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   if (p === "today") return { start: today, end: today };
//   if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); return { start: m, end: today }; }
//   if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
//   return null;
// }
// function getPrevRange(p, now) {
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   if (p === "today") { const y = new Date(today); y.setDate(y.getDate() - 1); return { start: y, end: y }; }
//   if (p === "week") { const d = today.getDay(), m = new Date(today); m.setDate(today.getDate() - ((d + 6) % 7)); const ps = new Date(m); ps.setDate(m.getDate() - 1); const pm = new Date(ps); pm.setDate(ps.getDate() - 6); return { start: pm, end: ps }; }
//   if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 0) };
//   return null;
// }
// function inRange(ds, r) { if (!r) return true; if (!ds) return false; const d = new Date(ds); if (isNaN(d)) return false; const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return day >= r.start && day <= r.end; }
// function prevLbl(p, now) { if (p === "today") return "yesterday"; if (p === "week") return "last week"; if (p === "month") return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", { month: "short" }); return null; }

// function periodMetrics(clients, trainers, rdm, range) {
//   const nT = !range ? trainers.length : trainers.filter(t => inRange(t.created_at, range)).length;
//   const nC = !range ? clients.length : clients.filter(c => inRange(c.onboardedDate, range)).length;
//   let reads = 0, readers = 0;
//   clients.forEach(c => { const d = rdm[c.profile_id] || []; const n = !range ? d.length : d.filter(x => inRange(x.date, range)).length; reads += n; if (n > 0) readers++; });
//   return { newTrainers: nT, newClients: nC, reads, readers, adoption: clients.length > 0 ? Math.round((readers / clients.length) * 100) : 0 };
// }

// const ICO_COLORS = { people: R.blue, person: R.green, "person-add": R.orange, trend: "#7c3aed" };
// function Ico({ type, color }) {
//   const c = color || ICO_COLORS[type] || R.blue;
//   return (
//     <div className="w-10 h-10 flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110" style={{ background: `linear-gradient(135deg, ${c}18, ${c}08)`, borderRadius: R.rCard, border: `1px solid ${c}15` }}>
//       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//         {type === "person" && <><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0114 0v1"/></>}
//         {type === "people" && <><circle cx="9" cy="7" r="3.5"/><path d="M2 21v-1a5 5 0 0110 0v1"/><circle cx="18" cy="9" r="3"/><path d="M22 21v-1a4 4 0 00-3-3.87"/></>}
//         {type === "person-add" && <><circle cx="10" cy="7" r="3.5"/><path d="M3 21v-1a5 5 0 0110 0"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></>}
//         {type === "trend" && <><polyline points="22 12 18 8 14 12 10 8 2 16"/></>}
//       </svg>
//     </div>
//   );
// }

// function Sparkline({ data, width = 80, height = 28, color = R.blue, filled = true }) {
//   if (!data || data.length < 2) return null;
//   const max = Math.max(...data, 1);
//   const min = Math.min(...data, 0);
//   const range = max - min || 1;
//   const pts = data.map((v, i) => [
//     (i / (data.length - 1)) * width,
//     height - 2 - ((v - min) / range) * (height - 4),
//   ]);
//   const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
//   const area = `${line} L${width},${height} L0,${height} Z`;
//   return (
//     <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
//       {filled && <path d={area} fill={`${color}15`} />}
//       <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
//     </svg>
//   );
// }

// function Donut({ pct, size = 120, thickness = 10, color = R.blue, label, bg, track, textColor }) {
//   const [animPct, setAnimPct] = useState(0);
//   useEffect(() => { const t = setTimeout(() => setAnimPct(pct), 50); return () => clearTimeout(t); }, [pct]);
//   const innerBg = bg || R.white;
//   const trackColor = track || R.surface;
//   const ringBorder = bg ? "none" : `0 0 0 3px ${R.white}, 0 0 0 4px ${R.border}`;
//   return (
//     <div className="flex flex-col items-center gap-1">
//       <div className="rounded-full flex items-center justify-center" style={{ width: size, height: size, background: `conic-gradient(${color} 0% ${animPct}%, ${trackColor} ${animPct}% 100%)`, transition: "background 0.8s ease-out", boxShadow: ringBorder }}>
//         <div className="rounded-full flex items-center justify-center" style={{ width: size - thickness * 2, height: size - thickness * 2, backgroundColor: innerBg }}>
//           <span className="font-extrabold" style={{ fontSize: size * 0.25, color: textColor || R.tp, letterSpacing: "-0.4px" }}>{animPct}%</span>
//         </div>
//       </div>
//       {label && <span style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{label}</span>}
//     </div>
//   );
// }

// function AccTable({ rows, cols }) {
//   const [sort, setSort] = useState({ key: null, asc: true });
//   const sorted = sort.key ? [...rows].sort((a, b) => {
//     const av = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(a) : a[sort.key];
//     const bv = typeof cols.find(c => c.key === sort.key)?.val === "function" ? cols.find(c => c.key === sort.key).val(b) : b[sort.key];
//     if (av == null && bv == null) return 0;
//     if (av == null) return 1;
//     if (bv == null) return -1;
//     const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
//     return sort.asc ? cmp : -cmp;
//   }) : rows;
//   const toggle = (key) => setSort(s => s.key === key ? { key, asc: !s.asc } : { key, asc: true });
//   const arrow = (key) => sort.key !== key ? "↕" : sort.asc ? "↑" : "↓";
//   const thBase = { fontWeight: 500, padding: "8px 0", fontSize: "10px", color: R.tm, letterSpacing: "-0.2px", borderBottom: `1px solid ${R.border}` };
//   return (
//     <div style={{ display: "flex", flexDirection: "column", fontSize: "12px", letterSpacing: "-0.24px", flex: 1, minHeight: 0 }}>
//       <div className="uppercase" style={{ display: "flex", backgroundColor: "#ffffff", position: "relative", zIndex: 2, flexShrink: 0 }}>
//         {cols.map(c => (
//           <div key={c.key} className="font-semibold cursor-pointer select-none"
//             style={{ ...thBase, flex: 1, textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" }}
//             onClick={() => toggle(c.key)}>
//             {c.label} <span style={{ fontSize: "9px" }}>{arrow(c.key)}</span>
//           </div>
//         ))}
//       </div>
//       <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
//         {sorted.map((r, i) => (
//           <div key={i} className="transition-colors duration-150" style={{ display: "flex", borderBottom: `1px solid ${R.surface}`, backgroundColor: i % 2 === 1 ? `${R.surface}80` : "transparent", cursor: "default" }}
//             onMouseEnter={e => e.currentTarget.style.backgroundColor = `${R.blueLight}60`}
//             onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 1 ? `${R.surface}80` : "transparent"}>
//             {cols.map(c => (
//               <div key={c.key} style={{ flex: 1, padding: "8px 0", textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left", color: c.className?.includes("text-muted") || c.className?.includes("text-secondary") ? R.ts : R.tp }}>
//                 {c.render ? c.render(r) : (typeof c.val === "function" ? c.val(r) : r[c.key])}
//               </div>
//             ))}
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// function pctChange(cur, prev) {
//   if (prev === 0 && cur === 0) return { val: 0, label: "0%" };
//   if (prev === 0) return { val: 100, label: "100%" };
//   const v = Math.round(((cur - prev) / prev) * 100);
//   return { val: v, label: `${Math.abs(v)}%` };
// }

// export default function AnalyticsDashboard() {
//   const [taList, setTaList] = useState([]);
//   const [trainersMap, setTrainersMap] = useState({});
//   const [allClients, setAllClients] = useState([]);
//   const [readingDatesMap, setReadingDatesMap] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [loadingPhase, setLoadingPhase] = useState("Connecting...");
//   const [error, setError] = useState(null);
//   const [activeTab, setActiveTab] = useState("overview");
//   const [tabDdOpen, setTabDdOpen] = useState(false);
//   const tabDdRef = useRef(null);
//   const [period, setPeriod] = useState("today");
//   const compare = true;
//   const [timezone, setTimezone] = useState(DEFAULT_TZ);
//   const [clock, setClock] = useState("");
//   const [openAcc, setOpenAcc] = useState(new Set());
//   const [trainerTab, setTrainerTab] = useState("all");
//   const [cohortTab, setCohortTab] = useState(0);
//   const [cohortSubTab, setCohortSubTab] = useState("trainers");

//   useEffect(() => {
//     const tick = () => setClock(new Date().toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }));
//     tick();
//     const id = setInterval(tick, 10000);
//     return () => clearInterval(id);
//   }, [timezone]);

//   useEffect(() => {
//     const handler = (e) => { if (tabDdRef.current && !tabDdRef.current.contains(e.target)) setTabDdOpen(false); };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const loadData = useCallback(async () => {
//     setLoading(true); setError(null);
//     try {
//       setLoadingPhase("Fetching Trainer Admins...");
//       const taRes = await fetchTrainerAdminListService();
//       const tas = (taRes?.existing || []).filter(t => EXECUTIVE_TAS.some(n => (t.name || "").toLowerCase().includes(n.toLowerCase())));
//       setTaList(tas);
//       setLoadingPhase("Fetching trainer networks...");
//       const tMap = {};
//       await Promise.all(tas.map(async ta => {
//         try {
//           // Super-admin scoped: actor_user_id is the super-admin (from token),
//           // trainer_admin_user_id targets this TA. Paginate to collect all.
//           const trainers = [];
//           let p = 1, keep = true;
//           while (keep) {
//             const r = await fetchAllTrainersForSuperAdminService({ page: p, limit: 100, trainerAdminUserId: ta.user_id, status: "all" });
//             const batch = Array.isArray(r?.data) ? r.data : [];
//             trainers.push(...batch);
//             const total = r?.pagination?.total ?? trainers.length;
//             keep = batch.length > 0 && trainers.length < total && p < 50;
//             p++;
//           }
//           tMap[ta.user_id] = { trainers };
//         } catch { tMap[ta.user_id] = { trainers: [] }; }
//       }));
//       setTrainersMap(tMap);
//       setLoadingPhase("Fetching all clients...");
//       let arr = [], pg = 1, more = true;
//       while (more) { setLoadingPhase(`Fetching clients (page ${pg})...`); const r = await fetchSuperAdminAllClientsOverviewService({ page: pg, limit: 50, type: "all" }); const b = r?.clients || []; arr = arr.concat(b); more = r?.pagination?.has_more === true && b.length > 0; pg++; if (pg > 20) break; }
//       setAllClients(arr);
//       setLoadingPhase("Fetching reading history...");
//       const dm = {};
//       const batches = []; for (let i = 0; i < arr.length; i += 5) batches.push(arr.slice(i, i + 5));
//       let f = 0;
//       for (const batch of batches) { await Promise.all(batch.map(async c => { if (!c.profile_id) return; try { const r = await fetchClientProfileDatesList(c.profile_id, c.dietitian_id || ""); dm[c.profile_id] = r?.data?.dates || []; } catch { dm[c.profile_id] = []; } })); f += batch.length; setLoadingPhase(`Reading history (${f}/${arr.length})...`); }
//       setReadingDatesMap(dm);
//     } catch (e) { setError(e?.message || "Failed to load"); toast.error(e?.message || "Failed"); }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { loadData(); }, [loadData]);
//   const now = tzNow(timezone);

//   const computeTa = useCallback((ta) => {
//     if (!ta) return null;
//     const all = (trainersMap[ta.user_id] || { trainers: [] }).trainers;
//     const nonSelf = all.filter(t => !t.is_self);
//     const codes = new Set(all.map(t => (t.partner_code || t.dietician_id || "").toUpperCase()));
//     const taCl = allClients.filter(c => codes.has((c.dietitian_id || c.partner_code || "").toUpperCase()));
//     const real = taCl.filter(c => !isSelfTest(c, all));
//     const selfT = taCl.filter(c => isSelfTest(c, all));

//     const enrich = c => {
//       const dates = readingDatesMap[c.profile_id] || [];
//       const rd = dates.length;
//       const sorted = dates.map(d => d.date).filter(Boolean).sort();
//       const last = sorted.length ? sorted[sorted.length - 1] : null;
//       const onb = c.client?.joined_dttm || (sorted.length ? sorted[0] : null);
//       const lastT = c.test_history?.last_test_date_time || last;
//       const ds = onb ? daysBetween(onb, now) : 0;
//       const pct = ds > 0 ? Math.min(100, Math.round((rd / ds) * 100)) : 0;
//       const code = (c.dietitian_id || "").toUpperCase();
//       const tr = all.find(t => (t.partner_code || t.dietician_id || "").toUpperCase() === code);
//       return { ...c, trainerName: tr?.name || c.associated_dietitian?.name || "—", readingDays: rd, onboardedDate: onb, daysSince: ds, pct, cohort: getCohort(pct), lastDate: lastT };
//     };

//     const clients = real.map(enrich).sort((a, b) => b.pct - a.pct);
//     const trainers = nonSelf.map(t => {
//       const te = (t.email || "").toLowerCase().trim(), tn = (t.name || "").trim();
//       const tc = (t.partner_code || t.dietician_id || "").toUpperCase();
//       const sc = selfT.find(c => { const ce = (c.email || "").toLowerCase().trim(), cn = (c.name || "").trim(); return ce === te || isMaskedMatch(ce, te) || isMaskedNameMatch(cn, tn); });
//       const allDates = sc ? (readingDatesMap[sc.profile_id] || []) : [];
//       const ds = t.created_at ? daysBetween(t.created_at, now) : 0;
//       const dates = t.created_at ? allDates.filter(d => !d.date || new Date(d.date) >= new Date(new Date(t.created_at).getFullYear(), new Date(t.created_at).getMonth(), new Date(t.created_at).getDate())) : allDates;
//       const rd = dates.length;
//       const pct = ds > 0 ? Math.min(100, Math.round((rd / ds) * 100)) : 0;
//       return { ...t, daysSince: ds, readingDays: rd, pct, cohort: getCohort(pct), realClientCount: clients.filter(c => (c.dietitian_id || "").toUpperCase() === tc).length, hasSelfTest: !!sc, selfProfileId: sc?.profile_id || null };
//     }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount);

//     const goals = { weight_loss: 0, fat_loss: 0, muscle_gain: 0 };
//     clients.forEach(c => { const g = (c.fitness_goal || "").toLowerCase(); if (g in goals) goals[g]++; });
//     return { ta, trainers, clients, totalTrainers: nonSelf.length, activeTrainers: trainers.filter(t => t.pct >= ACTIVE_THRESHOLD).length, totalClients: clients.length, activeClients: clients.filter(c => c.pct >= ACTIVE_THRESHOLD).length, goals };
//   }, [trainersMap, allClients, readingDatesMap, now]);

//   const taData = useMemo(() => { const m = {}; taList.forEach(ta => { m[ta.user_id] = computeTa(ta); }); return m; }, [taList, computeTa]);
//   const allTrainers = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.trainers.map(t => ({ ...t, taName: ta.name })) : []; }).sort((a, b) => b.pct - a.pct || b.realClientCount - a.realClientCount), [taList, taData]);
//   const allRealClients = useMemo(() => taList.flatMap(ta => { const d = taData[ta.user_id]; return d ? d.clients : []; }).sort((a, b) => b.pct - a.pct), [taList, taData]);
//   const totals = useMemo(() => {
//     const v = Object.values(taData).filter(Boolean);
//     return { trainers: v.reduce((s, x) => s + x.totalTrainers, 0), activeT: v.reduce((s, x) => s + x.activeTrainers, 0), clients: v.reduce((s, x) => s + x.totalClients, 0), activeC: v.reduce((s, x) => s + x.activeClients, 0), goals: { fat_loss: v.reduce((s, x) => s + x.goals.fat_loss, 0), muscle_gain: v.reduce((s, x) => s + x.goals.muscle_gain, 0), weight_loss: v.reduce((s, x) => s + x.goals.weight_loss, 0) } };
//   }, [taData]);

//   const selTa = activeTab !== "overview" ? taList.find(t => t.user_id === activeTab) : null;
//   const selData = selTa ? taData[selTa.user_id] : null;
//   const tabCl = activeTab === "overview" ? allRealClients : (selData?.clients || []);
//   const tabTr = activeTab === "overview" ? allTrainers : (selData?.trainers || []);
//   const avgActivity = useMemo(() => { if (!tabCl.length) return 0; return Math.round(tabCl.reduce((s, c) => s + c.pct, 0) / tabCl.length); }, [tabCl]);

//   if (loading) return (
//     <div className="flex flex-col items-center justify-center gap-5" style={{ height: "calc(100vh - 130px)" }}>
//       <div className="flex items-center gap-2">
//         {[0, 1, 2].map(i => (
//           <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: R.blue, animation: `loaderBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
//         ))}
//       </div>
//       <div style={{ fontSize: "13px", color: R.ts, fontWeight: 500, letterSpacing: "-0.26px" }}>{loadingPhase}</div>
//     </div>
//   );

//   if (error) return (
//     <div className="flex flex-col items-center justify-center gap-3" style={{ height: "calc(100vh - 130px)" }}>
//       <div className="max-w-md text-center" style={{ background: "#fef2f2", border: `1px solid ${R.red}30`, color: R.red, borderRadius: R.rCard, padding: "16px", fontSize: "13px", letterSpacing: "-0.26px" }}>{error}</div>
//       <button onClick={loadData} className="cursor-pointer" style={{ borderRadius: R.rPill, background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 20px", letterSpacing: "-0.24px", border: "none" }}>Retry</button>
//     </div>
//   );

//   const tTotal = activeTab === "overview" ? totals.trainers : (selData?.totalTrainers ?? 0);
//   const tActive = activeTab === "overview" ? totals.activeT : (selData?.activeTrainers ?? 0);
//   const cTotal = activeTab === "overview" ? totals.clients : (selData?.totalClients ?? 0);
//   const cActive = activeTab === "overview" ? totals.activeC : (selData?.activeClients ?? 0);
//   const curGoals = activeTab === "overview" ? totals.goals : (selData?.goals || { fat_loss: 0, muscle_gain: 0, weight_loss: 0 });

//   const range = getPeriodRange(period, now);
//   const prevR = compare ? getPrevRange(period, now) : null;
//   const pm = periodMetrics(tabCl, tabTr, readingDatesMap, range);
//   const ppm = prevR ? periodMetrics(tabCl, tabTr, readingDatesMap, prevR) : null;

//   const adoptionRate = tTotal > 0 ? Math.round((tActive / tTotal) * 100) : 0;
//   const engagementRate = cTotal > 0 ? Math.round((cActive / cTotal) * 100) : 0;
//   const activeTrainers = tabTr.filter(t => t.pct >= ACTIVE_THRESHOLD);
//   const eliteTrainers = tabTr.filter(t => t.pct >= 100);
//   const atRiskTrainers = tabTr.filter(t => t.pct < 30);
//   const eliteCount = eliteTrainers.length;
//   const atRiskTrainerCount = atRiskTrainers.length;
//   const highestRate = tabCl.length > 0 ? Math.max(...tabCl.map(c => c.pct)) : 0;
//   const lowestRate = tabCl.length > 0 ? Math.min(...tabCl.map(c => c.pct)) : 0;

//   const todayR = getPeriodRange("today", now);
//   const yesterdayR = getPrevRange("today", now);
//   const todayStats = periodMetrics(tabCl, tabTr, readingDatesMap, todayR);
//   const yesterdayStats = periodMetrics(tabCl, tabTr, readingDatesMap, yesterdayR);

//   const wkR = getPeriodRange("week", now);
//   const pwkR = getPrevRange("week", now);
//   const wkStats = periodMetrics(tabCl, tabTr, readingDatesMap, wkR);
//   const pwkStats = periodMetrics(tabCl, tabTr, readingDatesMap, pwkR);

//   const trainerWeekDelta = wkStats.newTrainers - pwkStats.newTrainers;
//   const readingsWeekDelta = wkStats.reads - pwkStats.reads;
//   const clientWeekDelta = wkStats.newClients - pwkStats.newClients;

//   const last7Days = (() => {
//     const days = [];
//     for (let i = 6; i >= 0; i--) {
//       const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
//       const r = { start: d, end: d };
//       let count = 0;
//       tabCl.forEach(c => { (readingDatesMap[c.profile_id] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
//       tabTr.forEach(t => { if (t.selfProfileId) (readingDatesMap[t.selfProfileId] || []).forEach(x => { if (inRange(x.date, r)) count++; }); });
//       days.push(count);
//     }
//     return days;
//   })();

//   const last4WeeksTrainers = (() => {
//     const weeks = [];
//     for (let w = 3; w >= 0; w--) {
//       const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
//       const start = new Date(end); start.setDate(end.getDate() - 6);
//       weeks.push(tabTr.filter(t => inRange(t.created_at, { start, end })).length);
//     }
//     return weeks;
//   })();

//   const last4WeeksClients = (() => {
//     const weeks = [];
//     for (let w = 3; w >= 0; w--) {
//       const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
//       const start = new Date(end); start.setDate(end.getDate() - 6);
//       weeks.push(tabCl.filter(c => inRange(c.onboardedDate, { start, end })).length);
//     }
//     return weeks;
//   })();

//   const allTimeTrainerReads = tabTr.reduce((s, t) => {
//     if (!t.selfProfileId) return s;
//     return s + (readingDatesMap[t.selfProfileId] || []).length;
//   }, 0);
//   const allTimeClientReads = tabCl.reduce((s, c) => s + (c.readingDays || 0), 0);
//   const allTimeTotalReads = allTimeTrainerReads + allTimeClientReads;
//   const periodTrainerReads = range ? tabTr.reduce((s, t) => {
//     if (!t.selfProfileId) return s;
//     const dates = readingDatesMap[t.selfProfileId] || [];
//     return s + dates.filter(x => inRange(x.date, range)).length;
//   }, 0) : allTimeTrainerReads;
//   const periodClientReads = pm.reads;
//   const periodTotalReads = periodTrainerReads + periodClientReads;
//   const prevTrainerReads = prevR ? tabTr.reduce((s, t) => {
//     if (!t.selfProfileId) return s;
//     const dates = readingDatesMap[t.selfProfileId] || [];
//     return s + dates.filter(x => inRange(x.date, prevR)).length;
//   }, 0) : 0;
//   const prevClientReads = ppm ? ppm.reads : 0;
//   const prevTotalReads = prevTrainerReads + prevClientReads;
//   const periodLabel = period === "today" ? `TODAY (${fmtDate(range?.start).toUpperCase()})`
//     : period === "week" ? `THIS WEEK (${fmtRange(range).toUpperCase()})`
//     : period === "month" ? `THIS MONTH (${fmtRange(range).toUpperCase()})`
//     : "ALL TIME";

//   const CTIERS = [
//     { label: "100%", min: 100, max: 100, color: R.blue },
//     { label: "90% – 99%", min: 90, max: 99, color: R.blue },
//     { label: "70% – 89%", min: 70, max: 89, color: R.blue },
//     { label: "50% – 69%", min: 50, max: 69, color: R.blue },
//     { label: "<30%", min: 0, max: 29, color: R.red },
//   ];
//   const totalPeople = tabTr.length + tabCl.length;
//   const cohortData = CTIERS.map(tier => {
//     const trainersIn = tabTr.filter(t => t.pct >= tier.min && t.pct <= tier.max);
//     const clientsIn = tabCl.filter(c => c.pct >= tier.min && c.pct <= tier.max);
//     const count = trainersIn.length + clientsIn.length;
//     return { ...tier, count, trainersIn, clientsIn, pctOfTotal: totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0 };
//   });
//   const maxCohortCount = Math.max(...cohortData.map(c => c.count), 1);

//   const onboardedTrainersToday = tabTr.filter(t => inRange(t.created_at, todayR));
//   const onboardedClientsToday = tabCl.filter(c => inRange(c.onboardedDate, todayR));
//   const readingsToday = tabCl.filter(c => { const d = readingDatesMap[c.profile_id] || []; return d.some(x => inRange(x.date, todayR)); });
//   const onboardedTrainersYesterday = tabTr.filter(t => inRange(t.created_at, yesterdayR));
//   const onboardedClientsYesterday = tabCl.filter(c => inRange(c.onboardedDate, yesterdayR));

//   const toggleAcc = (key) => setOpenAcc(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

//   const riskyTrainers = tabTr.filter(t => t.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);
//   const riskyClients = tabCl.filter(c => c.pct < ACTIVE_THRESHOLD).sort((a, b) => a.pct - b.pct);

//   const tChange = pctChange(todayStats.newTrainers, yesterdayStats.newTrainers);
//   const cChange = pctChange(todayStats.newClients, yesterdayStats.newClients);
//   const rChange = pctChange(todayStats.reads, yesterdayStats.reads);

//   const rateColor = (pct) => pct >= ACTIVE_THRESHOLD ? R.green : pct > 0 ? R.orange : R.red;
//   const rateStyle = (pct) => ({ fontWeight: 600, color: rateColor(pct) });
//   const RateCell = ({ pct }) => (
//     <div className="flex items-center gap-2" style={{ justifyContent: "flex-end" }}>
//       <div style={{ width: "36px", height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
//         <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: "2px", backgroundColor: rateColor(pct), transition: "width 0.4s ease" }} />
//       </div>
//       <span style={rateStyle(pct)}>{pct}%</span>
//     </div>
//   );
//   const badgeStyle = (bg, fg) => ({ fontSize: "10px", fontWeight: 500, padding: "2px 8px", borderRadius: R.rBadge, backgroundColor: bg, color: fg, letterSpacing: "-0.2px" });

//   const trainerCols = [
//     { key: "name", label: "Name", val: r => r.name || "—" },
//     { key: "partner_code", label: "Code", val: r => r.partner_code || "—", className: "text-muted font-mono" },
//     ...(activeTab === "overview" ? [{ key: "taName", label: "TA", val: r => r.taName || "—", className: "text-secondary" }] : []),
//     { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//     { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
//     { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
//   ];
//   const clientCols = [
//     { key: "name", label: "Name", val: r => r.name || "—" },
//     { key: "trainerName", label: "Trainer", val: r => r.trainerName || "—", className: "text-secondary" },
//     { key: "fitness_goal", label: "Goal", render: r => <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
//     { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//     { key: "readingDays", label: "Readings", align: "center", val: r => r.readingDays ?? 0 },
//     { key: "pct", label: "Rate %", align: "right", render: r => <RateCell pct={r.pct} /> },
//   ];

//   const CS = { backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #EEF2F6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.3s ease, transform 0.3s ease", position: "relative", overflow: "hidden" };
//   const csHover = { boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", transform: "translateY(-2px)" };
//   const csReset = { boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transform: "none" };

//   const maxGoal = Math.max(curGoals.fat_loss, curGoals.muscle_gain, curGoals.weight_loss, 1);

//   const deltaStyle = (v) => ({ borderRadius: "8px", padding: "6px 12px", fontSize: "12px", letterSpacing: "-0.24px", fontWeight: 500, backgroundColor: "#F8FAFC", color: R.ts, border: "1px solid #EEF2F6" });
//   const DeltaArrow = ({ v }) => <span style={{ fontWeight: 700, color: v >= 0 ? R.green : R.red, marginRight: "4px" }}>{v >= 0 ? "↑" : "↓"}</span>;

//   return (
//     <div className="overflow-y-scroll custom-scrollbar" style={{ height: "calc(100vh - 130px)", fontFamily: "'Poppins', sans-serif", backgroundColor: "#F5F7FA" }}>
//       {/* ═══ HEADER ═══ */}
//       <div className="flex items-center justify-between py-3 sticky top-0 z-10" style={{ backgroundColor: "#F5F7FA", borderBottom: "1px solid #EEF2F6" }}>
//         {/* ── Left: Page title as dropdown ── */}
//         <div ref={tabDdRef} style={{ position: "relative" }}>
//           <button onClick={() => setTabDdOpen(o => !o)}
//             className="flex items-center gap-2 cursor-pointer transition-all duration-200"
//             style={{ background: "none", border: "none", padding: "4px 0", outline: "none" }}>
//             <span style={{ fontSize: "18px", fontWeight: 700, color: R.tp, letterSpacing: "-0.36px" }}>
//               {activeTab === "overview" ? "Overview" : taList.find(t => t.user_id === activeTab)?.name || "—"}
//             </span>
//             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={R.tm} strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: tabDdOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6"/></svg>
//           </button>

//           {tabDdOpen && (
//             <div className="absolute left-0 z-50" style={{ top: "calc(100% + 6px)", minWidth: 220, backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #EEF2F6", boxShadow: "0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)", padding: "6px", animation: "fadeSlideUp 0.15s ease-out" }}>
//               <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>View</div>
//               <button onClick={() => { setActiveTab("overview"); setTabDdOpen(false); }}
//                 className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
//                 style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: activeTab === "overview" ? R.blueLight : "transparent", color: activeTab === "overview" ? R.blue : R.ts, fontSize: "13px", fontWeight: activeTab === "overview" ? 600 : 400, letterSpacing: "-0.26px" }}
//                 onMouseEnter={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = R.surface; }}
//                 onMouseLeave={e => { if (activeTab !== "overview") e.currentTarget.style.backgroundColor = "transparent"; }}>
//                 <span className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: "8px", backgroundColor: activeTab === "overview" ? R.blue + "18" : R.surface }}>
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={activeTab === "overview" ? R.blue : R.tm} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
//                 </span>
//                 Overview
//               </button>
//               {taList.length > 0 && <>
//                 <div style={{ height: "1px", backgroundColor: R.border, margin: "6px 10px" }} />
//                 <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: R.tm }}>Trainer Admins</div>
//               </>}
//               {taList.map((t, i) => {
//                 const isActive = activeTab === t.user_id;
//                 const dotColor = [R.blue, R.green, R.orange, "#7c3aed"][i % 4];
//                 return (
//                   <button key={t.user_id} onClick={() => { setActiveTab(t.user_id); setTabDdOpen(false); }}
//                     className="flex items-center gap-2.5 w-full cursor-pointer transition-all duration-150"
//                     style={{ padding: "8px 10px", borderRadius: "10px", border: "none", backgroundColor: isActive ? R.blueLight : "transparent", color: isActive ? R.blue : R.ts, fontSize: "13px", fontWeight: isActive ? 600 : 400, letterSpacing: "-0.26px" }}
//                     onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = R.surface; }}
//                     onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}>
//                     <span className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: "8px", background: isActive ? `linear-gradient(135deg, ${R.blue}, ${R.dark})` : R.surface, color: isActive ? R.white : R.ts, fontSize: "11px", fontWeight: 700 }}>
//                       {(t.name || "?")[0]}
//                     </span>
//                     <div className="flex-1 text-left">
//                       <div className="truncate">{t.name}</div>
//                       {t.email && <div className="truncate" style={{ fontSize: "11px", color: R.tm, fontWeight: 400 }}>{t.email}</div>}
//                     </div>
//                     <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
//                   </button>
//                 );
//               })}
//             </div>
//           )}
//         </div>

//         {/* ── Right: Controls ── */}
//         <div className="flex items-center gap-3">
//           {/* Refresh */}
//           <button onClick={loadData} className="flex items-center justify-center cursor-pointer transition-all duration-200"
//             style={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: "#ffffff", border: "1px solid #EEF2F6", color: R.tm }}
//             onMouseEnter={e => { e.currentTarget.style.backgroundColor = R.blueLight; e.currentTarget.style.color = R.blue; e.currentTarget.style.borderColor = R.blue + "40"; }}
//             onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.color = R.tm; e.currentTarget.style.borderColor = "#EEF2F6"; }}>
//             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
//           </button>

//           {/* Timezone + Clock cluster */}
//           <div className="flex items-center gap-2" style={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #EEF2F6", padding: "6px 12px" }}>
//             <div className="flex items-center" style={{ backgroundColor: R.surface, borderRadius: "8px", padding: "2px", gap: "2px" }}>
//               {Object.entries(TIMEZONES).map(([tz, label]) => (
//                 <button key={tz} onClick={() => setTimezone(tz)}
//                   className="cursor-pointer transition-all duration-200"
//                   style={{ padding: "4px 10px", fontSize: "11px", fontWeight: timezone === tz ? 600 : 500, letterSpacing: "-0.22px", backgroundColor: timezone === tz ? R.dark : "transparent", color: timezone === tz ? R.white : R.ts, border: "none", borderRadius: "6px" }}
//                   onMouseEnter={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = R.border; e.currentTarget.style.color = R.tp; } }}
//                   onMouseLeave={e => { if (timezone !== tz) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = R.ts; } }}>{label}</button>
//               ))}
//             </div>
//             <div style={{ width: "1px", height: "20px", backgroundColor: R.border }} />
//             <div className="flex items-center gap-1.5 whitespace-nowrap" style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px" }}>
//               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
//               <span>{clock}</span>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="flex flex-col gap-5 pb-8 pt-2">

//         {/* ═══ TA PROFILE (individual tabs only) ═══ */}
//         {selTa && (
//           <div className="flex items-center gap-4" style={{ ...CS, padding: "16px 24px" }}>
//             <div className="w-10 h-10 flex items-center justify-center font-bold text-white" style={{ borderRadius: "12px", background: `linear-gradient(135deg, ${R.dark} 0%, ${R.blue} 100%)`, fontSize: "18px", letterSpacing: "-0.36px" }}>{(selTa.name || "?")[0]}</div>
//             <div className="flex-1">
//               <div style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.3px", color: R.tp }}>{selTa.name}</div>
//               <div style={{ fontSize: "12px", color: R.tm, letterSpacing: "-0.24px" }}>{selTa.email}</div>
//             </div>
//             <div className="flex gap-8 shrink-0">
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Code</div><div className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: R.tp, letterSpacing: "-0.26px" }}>{selTa.partner_code}</div></div>
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Since</div><div style={{ fontSize: "13px", fontWeight: 600, color: R.tp, letterSpacing: "-0.26px" }}>{fmtDate(selTa.created_at)}</div></div>
//               <div className="text-center"><div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: R.tm, letterSpacing: "-0.2px" }}>Days Active</div><div style={{ fontSize: "13px", fontWeight: 700, color: R.blue, letterSpacing: "-0.26px" }}>{selTa.created_at ? daysBetween(selTa.created_at, now) : "—"}</div></div>
//             </div>
//           </div>
//         )}

//         {/* ═══ 2-ROW GRID: Left (Snapshot + Trainer Adoption) | Right (Period + Reading Split spanning both) ═══ */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "14px", gridTemplateRows: "auto 1fr" }}>

//           {/* ── Left Top: Snapshot cards ── */}
//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
//             {/* Card: Trainers */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.blue}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Trainers</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.newTrainers > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newTrainers} this wk</span>}
//                   <Ico type="people" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between mt-3">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{tTotal}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                   <div className="flex items-center gap-2 mt-1">
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{tActive} Active</span>
//                     <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {tTotal}</span>
//                   </div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last4WeeksTrainers} width={64} height={28} color={R.blue} />
//                   <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
//                 </div>
//               </div>
//               <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
//                 <div style={{ width: `${adoptionRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.blue}, ${R.green})`, transition: "width 0.6s ease" }} />
//               </div>
//               <div className="flex items-center justify-between mt-1.5">
//                 <span style={{ fontSize: "10px", color: R.tm }}>Adoption</span>
//                 <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{adoptionRate}%</span>
//               </div>
//             </div>

//             {/* Card: Clients */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px 20px 16px", borderLeft: `3px solid ${R.green}`, height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Clients</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.newClients > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: R.green, backgroundColor: `${R.green}12`, padding: "2px 6px", borderRadius: "4px" }}>+{wkStats.newClients} this wk</span>}
//                   <Ico type="person" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between mt-3">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{cTotal}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                   <div className="flex items-center gap-2 mt-1">
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.green }}>{cActive} Active</span>
//                     <span style={{ fontSize: "10px", color: R.tm, opacity: 0.7 }}>/ {cTotal}</span>
//                   </div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last4WeeksClients} width={64} height={28} color={R.green} />
//                   <span style={{ fontSize: "9px", color: R.tm }}>4 wk trend</span>
//                 </div>
//               </div>
//               <div className="mt-3" style={{ height: "4px", borderRadius: "2px", backgroundColor: "#F1F5F9" }}>
//                 <div style={{ width: `${engagementRate}%`, height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${R.green}, #10B981)`, transition: "width 0.6s ease" }} />
//               </div>
//               <div className="flex items-center justify-between mt-1.5">
//                 <span style={{ fontSize: "10px", color: R.tm }}>Engagement</span>
//                 <span style={{ fontSize: "11px", fontWeight: 700, color: R.tp }}>{engagementRate}%</span>
//               </div>
//             </div>

//             {/* Card: Readings */}
//             <div className="analytics-card-animate" style={{ ...CS, padding: "20px", borderLeft: "3px solid #7C3AED", height: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}
//               onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//               onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>
//               <div className="flex items-center justify-between">
//                 <span style={{ fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px" }}>Readings</span>
//                 <div className="flex items-center gap-2">
//                   {wkStats.reads > 0 && <span style={{ fontSize: "10px", fontWeight: 600, color: "#7C3AED", backgroundColor: "#7C3AED12", padding: "2px 6px", borderRadius: "4px" }}>{wkStats.reads} this wk</span>}
//                   <Ico type="trend" />
//                 </div>
//               </div>
//               <div className="flex items-end justify-between">
//                 <div>
//                   <div style={{ fontSize: "36px", fontWeight: 800, color: R.tp, letterSpacing: "-1px", lineHeight: 1 }}>{allTimeTotalReads}</div>
//                   <div style={{ fontSize: "11px", color: R.ts, marginTop: "4px" }}>All Time</div>
//                 </div>
//                 <div className="flex flex-col items-end gap-0.5">
//                   <Sparkline data={last7Days} width={90} height={32} color="#7C3AED" />
//                   <span style={{ fontSize: "9px", color: R.tm }}>Last 7 days</span>
//                 </div>
//               </div>
//               <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
//                 {[["Trainers", allTimeTrainerReads, R.blue], ["Clients", allTimeClientReads, R.green]].map(([l, v, c]) => (
//                   <div key={l} className="flex items-center gap-2">
//                     <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: c, flexShrink: 0 }} />
//                     <span style={{ fontSize: "11px", color: R.ts, flex: 1 }}>{l}</span>
//                     <span style={{ fontSize: "12px", fontWeight: 700, color: R.tp }}>{v}</span>
//                     {allTimeTotalReads > 0 && <span style={{ fontSize: "10px", color: R.tm }}>({Math.round((v / allTimeTotalReads) * 100)}%)</span>}
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* ── Right: Period + Reading Split — spans 2 rows ── */}
//           <div className="analytics-card-animate" style={{ gridRow: "1 / 3", gridColumn: 2, alignSelf: "start", borderRadius: "16px", padding: "28px 24px", background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)", color: "#ffffff", position: "relative", overflow: "hidden", transition: "box-shadow 0.3s ease, transform 0.3s ease", display: "flex", flexDirection: "column" }}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, { boxShadow: "0 8px 32px rgba(15,23,42,0.4)", transform: "translateY(-2px)" })}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, { boxShadow: "none", transform: "none" })}>

//             {/* Header */}
//             <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
//               <div>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "4px" }}>Period Overview</div>
//                 <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.3px" }}>{periodLabel}</span>
//               </div>
//               <div className="flex items-center" style={{ backgroundColor: "rgba(148,163,184,0.12)", borderRadius: "8px", padding: "2px", gap: "2px" }}>
//                 {[["today", "D"], ["week", "W"], ["month", "M"]].map(([k, l]) => (
//                   <button key={k} onClick={() => setPeriod(k)}
//                     className="cursor-pointer transition-all duration-200"
//                     style={{ padding: "5px 12px", fontSize: "11px", fontWeight: period === k ? 700 : 500, backgroundColor: period === k ? R.blue : "transparent", color: "#ffffff", border: "none", borderRadius: "6px", opacity: period === k ? 1 : 0.6 }}>{l}</button>
//                 ))}
//               </div>
//             </div>

//             {/* Hero metric — Total Readings */}
//             <div className="text-center" style={{ padding: "8px 0 20px" }}>
//               <div style={{ fontSize: "44px", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1 }}>{periodTotalReads}</div>
//               <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", letterSpacing: "0.3px" }}>Total Readings</div>
//               {ppm && (
//                 <div className="flex items-center justify-center gap-1.5 mt-2">
//                   <span style={{ fontSize: "11px", fontWeight: 600, color: periodTotalReads >= prevTotalReads ? "#4ade80" : "#f87171" }}>
//                     {periodTotalReads >= prevTotalReads ? "↑" : "↓"} {Math.abs(periodTotalReads - prevTotalReads)}
//                   </span>
//                   <span style={{ fontSize: "11px", color: "#475569" }}>vs {prevLbl(period, now)}</span>
//                 </div>
//               )}
//             </div>

//             {/* Onboarding metrics — 2 compact cards side by side */}
//             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
//               {[
//                 { val: pm.newTrainers, prev: ppm?.newTrainers, label: "Trainers", sub: "Onboarded", color: R.blue },
//                 { val: pm.newClients, prev: ppm?.newClients, label: "Clients", sub: "Onboarded", color: R.green },
//               ].map((item) => (
//                 <div key={item.label} style={{ padding: "14px", borderRadius: "12px", backgroundColor: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.1)" }}>
//                   <div className="flex items-center justify-between">
//                     <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: item.color }} />
//                     {item.prev != null && item.val !== item.prev && (
//                       <span style={{ fontSize: "10px", fontWeight: 600, color: item.val >= item.prev ? "#4ade80" : "#f87171" }}>
//                         {item.val >= item.prev ? "+" : ""}{item.val - item.prev}
//                       </span>
//                     )}
//                   </div>
//                   <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-1px", marginTop: "8px", lineHeight: 1 }}>{item.val}</div>
//                   <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{item.label} {item.sub}</div>
//                 </div>
//               ))}
//             </div>

//             {/* Device Adoption + Reading Split — side by side */}
//             <div className="flex-1 flex gap-4" style={{ paddingTop: "20px", borderTop: "1px solid rgba(148,163,184,0.1)", marginTop: "20px" }}>

//               {/* Device Adoption — left column */}
//               <div className="flex-1 flex flex-col items-center" style={{ borderRight: "1px solid rgba(148,163,184,0.1)", paddingRight: "16px" }}>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Device Adoption</div>
//                 <Donut pct={avgActivity} size={90} thickness={8} color={R.blue} bg="#0f172a" track="rgba(148,163,184,0.12)" textColor="#ffffff" />
//                 <div style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", marginTop: "12px" }}>Avg Reading Rate</div>
//               </div>

//               {/* Reading Split — right column */}
//               <div className="flex-1 flex flex-col items-center" style={{ paddingLeft: "4px" }}>
//                 <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: "16px" }}>Reading Split</div>
//                 {(() => {
//                   const trPct = periodTotalReads > 0 ? Math.round((periodTrainerReads / periodTotalReads) * 100) : 0;
//                   return (
//                   <div className="flex flex-col items-center gap-4 flex-1 w-full">
//                     <div className="rounded-full flex items-center justify-center" style={{
//                       width: 90, height: 90,
//                       background: periodTotalReads > 0
//                         ? `conic-gradient(${R.blue} 0% ${trPct}%, ${R.green}80 ${trPct}% 100%)`
//                         : "rgba(148,163,184,0.12)"
//                     }}>
//                       <div className="rounded-full flex items-center justify-center" style={{ width: 70, height: 70, backgroundColor: "#0f172a" }}>
//                         <div className="text-center">
//                           <div style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1 }}>{periodTotalReads}</div>
//                           <div style={{ fontSize: "8px", color: "#64748b", marginTop: "2px" }}>readings</div>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="w-full" style={{ height: "5px", borderRadius: "3px", overflow: "hidden", display: "flex", backgroundColor: "rgba(148,163,184,0.12)" }}>
//                       {periodTotalReads > 0 && <>
//                         <div style={{ width: `${trPct}%`, height: "100%", backgroundColor: R.blue, transition: "width 0.4s ease" }} />
//                         <div style={{ flex: 1, height: "100%", backgroundColor: `${R.green}80` }} />
//                       </>}
//                     </div>

//                     <div className="flex flex-col gap-2 w-full">
//                       {[
//                         { label: "Trainers", val: periodTrainerReads, color: R.blue },
//                         { label: "Clients", val: periodClientReads, color: `${R.green}80` },
//                       ].map(s => (
//                         <div key={s.label} className="flex items-center gap-2" style={{ padding: "6px 10px", borderRadius: "8px", backgroundColor: "rgba(148,163,184,0.05)" }}>
//                           <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.color, flexShrink: 0 }} />
//                           <span style={{ fontSize: "11px", color: "#94a3b8", flex: 1 }}>{s.label}</span>
//                           <span style={{ fontSize: "14px", fontWeight: 700 }}>{s.val}</span>
//                           <span style={{ fontSize: "10px", color: "#475569" }}>({periodTotalReads > 0 ? Math.round((s.val / periodTotalReads) * 100) : 0}%)</span>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                   );
//                 })()}
//               </div>
//             </div>
//           </div>

//           {/* ── Left Bottom: Trainer Adoption ── */}
//           <div className="p-5 analytics-card-animate" style={{ ...CS, display: "flex", flexDirection: "column", height: "420px" }}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Trainer Adoption</h2>
//                 <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are trainers using the device?</p>
//               </div>
//               <div className="flex items-center gap-4">
//                 <div className="text-center">
//                   <div style={{ fontSize: "20px", fontWeight: 700, color: R.tp, lineHeight: 1 }}>{tTotal}</div>
//                   <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Total</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="text-center">
//                   <div style={{ fontSize: "20px", fontWeight: 700, color: R.green, lineHeight: 1 }}>{tActive}</div>
//                   <div style={{ fontSize: "10px", color: R.tm, marginTop: "2px" }}>Active</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
//                   <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{adoptionRate}%</div>
//                   <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Adoption</div>
//                 </div>
//               </div>
//             </div>

//             {/* Tabs */}
//             <div className="flex gap-1 mt-4 p-1" style={{ backgroundColor: "#F1F5F9", borderRadius: "10px" }}>
//               {[
//                 { key: "all", dotColor: R.blue, count: tTotal, label: "All" },
//                 { key: "active", dotColor: R.green, count: tActive, label: `Active` },
//                 { key: "elite", dotColor: "#10B981", count: eliteCount, label: "Elite" },
//                 { key: "atrisk", dotColor: R.red, count: atRiskTrainerCount, label: "At Risk" },
//               ].map(t => (
//                 <button key={t.key} onClick={() => setTrainerTab(t.key)} className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer" style={{
//                   padding: "7px 10px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, letterSpacing: "-0.24px", transition: "all 0.2s ease",
//                   backgroundColor: trainerTab === t.key ? "#ffffff" : "transparent",
//                   color: trainerTab === t.key ? R.tp : R.tm,
//                   boxShadow: trainerTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
//                 }}>
//                   <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.dotColor }} />
//                   <span>{t.count}</span>
//                   <span style={{ fontWeight: 500 }}>{t.label}</span>
//                 </button>
//               ))}
//             </div>

//             {/* Tab content — table fills available space */}
//             <div className="mt-3 flex-1 flex flex-col" style={{ overflow: "hidden" }}>
//               {(() => {
//                 const tabs = { all: tabTr, active: activeTrainers, elite: eliteTrainers, atrisk: atRiskTrainers };
//                 const list = tabs[trainerTab] || [];
//                 if (list.length === 0) return <div className="flex flex-col items-center justify-center flex-1 gap-3">
//                   <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
//                     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
//                   </div>
//                   <div className="text-center">
//                     <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>No trainers in this group</div>
//                     <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>Try selecting a different tab</div>
//                   </div>
//                 </div>;
//                 if (trainerTab === "all") return <AccTable rows={list} cols={[
//                   { key: "name", label: "Trainer", val: r => r.name || "—" },
//                   { key: "realClientCount", label: "Clients", align: "center", val: r => r.realClientCount ?? 0 },
//                   { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//                   { key: "readingDays", label: "Tests", align: "center", val: r => r.readingDays ?? 0 },
//                   { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
//                   { key: "status", label: "Status", align: "right", val: r => r.pct >= ELITE_THRESHOLD ? 2 : r.pct >= ACTIVE_THRESHOLD ? 1 : 0, render: r => r.pct >= ELITE_THRESHOLD
//                     ? <span style={badgeStyle(R.greenLight, R.green)}>Elite</span>
//                     : r.pct >= ACTIVE_THRESHOLD
//                       ? <span style={badgeStyle(R.blueLight, R.blue)}>Active</span>
//                       : <span style={badgeStyle("#fef2f2", R.red)}>At Risk</span>
//                   },
//                 ]} />;
//                 return <AccTable rows={list} cols={trainerCols} />;
//               })()}
//             </div>

//             <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #EEF2F6" }}>
//               <div className="italic" style={{ fontSize: "10px", color: R.tm, letterSpacing: "-0.2px" }}>Adoption = Trainers with reading rate {"≥"} {ACTIVE_THRESHOLD}% / Total trainers ({tActive}/{tTotal} = {adoptionRate}%)</div>
//               <div className="mt-2" style={deltaStyle(trainerWeekDelta)}>
//                 <DeltaArrow v={trainerWeekDelta} />{Math.abs(trainerWeekDelta)} {trainerWeekDelta === 1 || trainerWeekDelta === -1 ? "trainer" : "trainers"} this week vs last
//               </div>
//             </div>
//           </div>

//         </div>

//         {/* ═══ ROW 3: CLIENT ENGAGEMENT (wide) + READING RATE COHORTS ═══ */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "stretch" }}>
//           {/* Client Engagement */}
//           <div className="p-5 analytics-card-animate" style={CS}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Client Engagement</h2>
//                 <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Are clients engaged and consistent?</p>
//               </div>
//               <div className="flex items-center gap-4">
//                 <div className="text-center" style={{ backgroundColor: `${R.blue}0A`, padding: "6px 12px", borderRadius: "10px" }}>
//                   <div style={{ fontSize: "24px", fontWeight: 800, color: R.blue, lineHeight: 1 }}>{avgActivity}%</div>
//                   <div style={{ fontSize: "10px", color: R.blue, marginTop: "2px", opacity: 0.6 }}>Avg Rate</div>
//                 </div>
//                 <div style={{ width: "1px", height: "28px", backgroundColor: "#EEF2F6" }} />
//                 <div className="flex gap-3">
//                   <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.green }}>{highestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>High</div></div>
//                   <div className="text-center"><span style={{ fontSize: "13px", fontWeight: 700, color: R.red }}>{lowestRate}%</span><div style={{ fontSize: "9px", color: R.tm }}>Low</div></div>
//                 </div>
//               </div>
//             </div>

//             {/* Clients by Goal — compact */}
//             <div className="flex gap-3 mt-3">
//               {[["fat_loss", "Fat Loss", R.orange], ["muscle_gain", "Muscle Gain", R.green]].map(([k, l, c]) => (
//                 <div key={k} className="flex-1 p-2.5" style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", borderLeft: `3px solid ${c}` }}>
//                   <div style={{ fontSize: "16px", fontWeight: 700, color: R.tp }}>{curGoals[k] || 0}</div>
//                   <div style={{ fontSize: "10px", color: R.tm }}>{l}</div>
//                 </div>
//               ))}
//             </div>

//             {/* Client table */}
//             <div className="mt-3 pt-3" style={{ borderTop: "1px solid #EEF2F6", height: "200px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
//               <AccTable rows={tabCl} cols={[
//                 { key: "name", label: "Client", val: r => r.name || "—" },
//                 { key: "fitness_goal", label: "Goal", val: r => goalLabel(r.fitness_goal), render: r => <span style={{ fontSize: "11px", fontWeight: 500, padding: "3px 10px", borderRadius: R.rPill, color: goalColor(r.fitness_goal), backgroundColor: goalColor(r.fitness_goal) + "15", letterSpacing: "-0.22px" }}>{goalLabel(r.fitness_goal)}</span> },
//                 { key: "daysSince", label: "Days", align: "center", val: r => r.daysSince ?? 0 },
//                 { key: "readingDays", label: "Tests", align: "center", val: r => r.readingDays ?? 0 },
//                 { key: "pct", label: "Rate", align: "right", render: r => <RateCell pct={r.pct} /> },
//               ]} />
//             </div>
//             <div className="mt-2" style={deltaStyle(readingsWeekDelta)}>
//               <DeltaArrow v={readingsWeekDelta} />{Math.abs(readingsWeekDelta)} readings this week vs last week
//             </div>
//           </div>

//           {/* Reading Rate Cohorts — 2-column layout */}
//           <div className="p-5 analytics-card-animate" style={CS}
//             onMouseEnter={e => Object.assign(e.currentTarget.style, csHover)}
//             onMouseLeave={e => Object.assign(e.currentTarget.style, csReset)}>

//             <h2 style={{ fontSize: "18px", fontWeight: 600, color: R.tp, letterSpacing: "-0.36px" }}>Reading Rate Cohorts</h2>
//             <p className="mt-0.5" style={{ fontSize: "12px", color: R.ts, letterSpacing: "-0.24px" }}>Where do your clients & trainers stand?</p>

//             <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "28px", marginTop: "16px" }}>

//               {/* Left: Distribution chart */}
//               <div className="flex flex-col gap-2 pt-1">
//                 {cohortData.map((tier, i) => {
//                   const active = cohortTab === i;
//                   const barPct = maxCohortCount > 0 ? Math.max((tier.count / maxCohortCount) * 100, tier.count > 0 ? 8 : 0) : 0;
//                   return (
//                     <div key={i} className="cursor-pointer" onClick={() => setCohortTab(i)}
//                       style={{ padding: "6px 10px", borderRadius: "10px", transition: "all 0.2s", backgroundColor: active ? `${tier.color}08` : "transparent", border: active ? `1px solid ${tier.color}20` : "1px solid transparent" }}>
//                       <div className="flex items-center justify-between" style={{ marginBottom: "5px" }}>
//                         <span style={{ fontSize: "11px", fontWeight: active ? 700 : 500, color: active ? tier.color : R.ts }}>{tier.label}</span>
//                         <span style={{ fontSize: "12px", fontWeight: 700, color: active ? tier.color : R.tp }}>{tier.count} <span style={{ fontSize: "10px", fontWeight: 500, color: R.tm }}>({tier.pctOfTotal}%)</span></span>
//                       </div>
//                       <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "#F1F5F9", overflow: "hidden" }}>
//                         <div style={{ width: `${barPct}%`, height: "100%", borderRadius: "3px", backgroundColor: tier.color, opacity: active ? 1 : 0.5, transition: "all 0.3s ease" }} />
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>

//               {/* Right: Selected cohort table */}
//               <div style={{ borderLeft: "1px solid #EEF2F6", paddingLeft: "24px", display: "flex", flexDirection: "column" }}>
//                 {cohortData[cohortTab] ? (
//                   cohortData[cohortTab].count === 0 ? (
//                     <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
//                       <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "#F8FAFC", border: "1px solid #EEF2F6" }}>
//                         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
//                       </div>
//                       <div className="text-center">
//                         <div style={{ fontSize: "13px", fontWeight: 600, color: R.ts }}>No one in this cohort</div>
//                         <div style={{ fontSize: "11px", color: R.tm, marginTop: "4px" }}>No trainers or clients fall in this range</div>
//                       </div>
//                     </div>
//                   ) : (<>
//                     <div className="flex gap-1 p-1 mb-3" style={{ backgroundColor: "#F1F5F9", borderRadius: "8px", alignSelf: "flex-start" }}>
//                       {[
//                         { key: "trainers", label: "Trainers", count: cohortData[cohortTab].trainersIn.length },
//                         { key: "clients", label: "Clients", count: cohortData[cohortTab].clientsIn.length },
//                       ].map(t => (
//                         <button key={t.key} onClick={() => setCohortSubTab(t.key)} className="cursor-pointer" style={{
//                           padding: "5px 12px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: 600, letterSpacing: "-0.2px", transition: "all 0.2s ease",
//                           backgroundColor: cohortSubTab === t.key ? "#ffffff" : "transparent",
//                           color: cohortSubTab === t.key ? R.tp : R.tm,
//                           boxShadow: cohortSubTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
//                         }}>
//                           {t.label} <span style={{ color: cohortSubTab === t.key ? R.blue : R.tm, marginLeft: "2px" }}>{t.count}</span>
//                         </button>
//                       ))}
//                     </div>
//                     <div style={{ height: "240px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
//                       {cohortSubTab === "trainers" ? (
//                         cohortData[cohortTab].trainersIn.length > 0
//                           ? <AccTable rows={cohortData[cohortTab].trainersIn} cols={trainerCols} />
//                           : <div className="flex flex-col items-center justify-center gap-2 py-6">
//                               <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No trainers in this range</div>
//                               <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
//                             </div>
//                       ) : (
//                         cohortData[cohortTab].clientsIn.length > 0
//                           ? <AccTable rows={cohortData[cohortTab].clientsIn} cols={clientCols} />
//                           : <div className="flex flex-col items-center justify-center gap-2 py-6">
//                               <div style={{ fontSize: "12px", fontWeight: 600, color: R.ts }}>No clients in this range</div>
//                               <div style={{ fontSize: "11px", color: R.tm }}>Try selecting a different cohort</div>
//                             </div>
//                       )}
//                     </div>
//                   </>)
//                 ) : null}
//               </div>

//             </div>
//           </div>
//         </div>


//         {/* ═══ FOOTER ═══ */}
//         <div className="flex items-start gap-2.5" style={{ fontSize: "11px", color: R.tm, letterSpacing: "-0.22px", padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #EEF2F6" }}>
//           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={R.blue} strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
//           <span><strong style={{ color: R.ts }}>Active</strong> = Reading rate {"≥"} {ACTIVE_THRESHOLD}% {"·"} <strong style={{ color: R.ts }}>Reading Rate</strong> = Reading days / Days since onboarded {"·"} Self-test by trainers are excluded from client counts but included in trainer adoption.</span>
//         </div>
//       </div>
//     </div>
//   );
// }
