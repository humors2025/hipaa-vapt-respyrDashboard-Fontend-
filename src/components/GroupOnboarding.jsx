"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { getAdminGroups, selectAdminGroupsRaw, selectPrimaryGroupName } from "@/store/adminGroupsSlice";
import { fetchGroupOnboardingService } from "@/services/authService";

const PAGE_LIMIT = 10;
const R = {
  dark: "#252525", blue: "#308bf9", blueLight: "#e9f3ff",
  green: "#3faf58", greenLight: "#eaffef", red: "#e74c3c", orange: "#e48326", amber: "#ffbf2d",
  tp: "#252525", ts: "#535359", tm: "#738298", td: "#a1a1a1",
  border: "#e1e6ed", surface: "#f5f7fa", white: "#ffffff",
  rCard: "15px", rBadge: "6px", rPill: "33px",
};
const CS = {
  backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #EEF2F6",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "trainers", label: "Trainers" },
  { key: "clients", label: "Clients" },
];

function fmtDay(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d)) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d)) return s;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
function goalLabel(g) {
  if (!g) return "—";
  const l = String(g).toLowerCase();
  if (l.includes("fat")) return "Fat Loss";
  if (l.includes("weight")) return "Weight Loss";
  if (l.includes("muscle") || l.includes("gain")) return "Muscle Gain";
  return g;
}
function badgeStyle(bg, fg) {
  return { display: "inline-block", padding: "3px 10px", borderRadius: R.rBadge, backgroundColor: bg, color: fg, fontSize: "11px", fontWeight: 600, letterSpacing: "-0.22px", whiteSpace: "nowrap" };
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2" style={{ padding: "48px 16px", color: R.tm }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: R.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>—</div>
      <div style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "-0.26px" }}>{text}</div>
    </div>
  );
}

function Pager({ pagination, onPage }) {
  if (!pagination) return null;
  const { page = 1, limit = PAGE_LIMIT, total = 0, has_more = false } = pagination;
  if (total <= limit) return null;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const btn = (disabled) => ({
    borderRadius: R.rPill, border: `1px solid ${R.border}`, background: disabled ? R.surface : R.white,
    color: disabled ? R.td : R.tp, fontSize: "12px", fontWeight: 600, padding: "6px 16px",
    cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "-0.24px",
  });
  return (
    <div className="flex items-center justify-between" style={{ padding: "12px 18px", borderTop: `1px solid ${R.border}` }}>
      <div style={{ fontSize: "12px", color: R.tm }}>Showing {from}–{to} of {total}</div>
      <div className="flex items-center gap-2">
        <button style={btn(page <= 1)} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <button style={btn(!has_more)} disabled={!has_more} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function Table({ cols, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={{ textAlign: c.align || "left", padding: "10px 18px", fontSize: "11px", fontWeight: 600, color: R.tm, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: `1px solid ${R.border}`, whiteSpace: "nowrap" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.profile_id || row.partner_code || row.dietician_id || i} style={{ borderBottom: `1px solid ${R.border}` }}>
              {cols.map(c => (
                <td key={c.key} style={{ textAlign: c.align || "left", padding: "12px 18px", color: R.tp, letterSpacing: "-0.25px", whiteSpace: "nowrap" }}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useDispatch();
  const adminGroupsRaw = useSelector(selectAdminGroupsRaw);
  const primaryGroupName = useSelector(selectPrimaryGroupName);

  // Window + scope come from the analytics card that linked here.
  const dateFrom = params.get("from") || "";
  const dateTo = params.get("to") || dateFrom;
  const member = params.get("member") || "";
  const groupFromUrl = params.get("group") || "";
  const periodLabel = params.get("label") || "";

  const [type, setType] = useState(() => {
    const t = params.get("type");
    return TABS.some(x => x.key === t) ? t : "all";
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map());

  const groupName = groupFromUrl || primaryGroupName || "";

  // The group name normally arrives with the login payload; re-fetch it if the
  // in-memory store was reset (hard refresh / direct link into this page).
  useEffect(() => {
    if (!groupFromUrl && !adminGroupsRaw) dispatch(getAdminGroups());
  }, [groupFromUrl, adminGroupsRaw, dispatch]);

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedQ(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!groupName || !dateFrom) { if (!groupName) setLoading(true); return; }
    const key = `${groupName}|${dateFrom}|${dateTo}|${type}|${member}|${debouncedQ}|${page}`;
    if (!force && cacheRef.current.has(key)) { setData(cacheRef.current.get(key)); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGroupOnboardingService({
        groupName, dateFrom, dateTo, type, member, page, limit: PAGE_LIMIT, search: debouncedQ,
      });
      cacheRef.current.set(key, res);
      setData(res);
    } catch (e) {
      setError(e?.message || "Failed to load onboarding");
      toast.error(e?.message || "Failed to load onboarding");
    } finally {
      setLoading(false);
    }
  }, [groupName, dateFrom, dateTo, type, member, page, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  const trainers = data?.trainers || [];
  const clients = data?.clients || [];
  const counts = data?.counts || { new_trainers: 0, new_clients: 0, total: 0 };
  const showTrainers = type === "all" || type === "trainers";
  const showClients = type === "all" || type === "clients";

  const trainerCols = useMemo(() => [
    { key: "name", label: "Trainer", render: r => <span style={{ fontWeight: 600 }}>{r.name || r.profile_name || "—"}</span> },
    { key: "code", label: "Code", render: r => <span style={{ color: R.tm }}>{r.partner_code || r.dietician_id || "—"}</span> },
    { key: "email", label: "Email", render: r => <span style={{ color: R.ts }}>{r.email || "—"}</span> },
    { key: "phone", label: "Phone", render: r => <span style={{ color: R.ts }}>{r.phone_no || "NA"}</span> },
    { key: "owner", label: "Reports To", render: r => <span style={{ color: R.ts }}>{r.owner?.name || r.owner?.partner_code || "—"}</span> },
    { key: "onboarded", label: "Onboarded", render: r => <span style={{ color: R.ts }}>{fmtDateTime(r.onboarded_at || r.created_at)}</span> },
    { key: "tests", label: "Tests", align: "right", render: r => <span style={{ fontWeight: 600 }}>{r.total_tests ?? 0}</span> },
    { key: "status", label: "Status", align: "center", render: r => (
      <span style={r.activated ? badgeStyle(R.greenLight, R.green) : badgeStyle("#f4f6f9", R.tm)}>{r.activated ? "Activated" : "Pending"}</span>
    ) },
  ], []);

  const clientCols = useMemo(() => [
    { key: "name", label: "Client", render: r => <span style={{ fontWeight: 600 }}>{r.profile_name || "—"}</span> },
    { key: "trainer", label: "Trainer", render: r => <span style={{ color: R.ts }}>{r.owner?.name || r.dietician_id || "—"}</span> },
    { key: "email", label: "Email", render: r => <span style={{ color: R.ts }}>{r.email || "—"}</span> },
    { key: "demo", label: "Age / Gender", render: r => <span style={{ color: R.ts }}>{r.age || "—"} · {r.gender || "—"}</span> },
    { key: "goal", label: "Goal", render: r => <span style={badgeStyle(R.blueLight, R.blue)}>{goalLabel(r.fitness_goal)}</span> },
    { key: "region", label: "Region", render: r => <span style={{ color: R.ts, textTransform: "capitalize" }}>{r.region || r.location || "—"}</span> },
    { key: "onboarded", label: "Onboarded", render: r => <span style={{ color: R.ts }}>{fmtDateTime(r.onboarded_at)}</span> },
    { key: "tests", label: "Tests", align: "right", render: r => <span style={{ fontWeight: 600 }}>{r.total_tests ?? 0}</span> },
    { key: "score", label: "Latest Score", align: "right", render: r => (
      r.latest_test?.metabolism_score != null
        ? <span style={{ fontWeight: 600, color: R.green }}>{r.latest_test.metabolism_score}</span>
        : <span style={{ color: R.td }}>—</span>
    ) },
    { key: "status", label: "Status", align: "center", render: r => (
      <span style={r.activated ? badgeStyle(R.greenLight, R.green) : badgeStyle("#fff4e5", R.orange)}>{r.activated ? "Activated" : "Not tested"}</span>
    ) },
  ], []);

  const windowLabel = dateFrom === dateTo ? fmtDay(dateFrom) : `${fmtDay(dateFrom)} – ${fmtDay(dateTo)}`;
  // "today" / "this week" wording for the empty states, driven by the source card.
  const whenLabel = periodLabel || (dateFrom === dateTo ? "on this day" : "in this period");

  return (
    <div className="overflow-y-scroll custom-scrollbar" style={{ height: "calc(100vh - 130px)", fontFamily: "'Poppins', sans-serif", backgroundColor: R.surface }}>
      <div className="sticky top-0 z-10" style={{ backgroundColor: R.surface, padding: "18px 24px 12px", borderBottom: `1px solid ${R.border}` }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <button
              onClick={() => router.back()}
              className="cursor-pointer"
              style={{ border: "none", background: "transparent", color: R.blue, fontSize: "12px", fontWeight: 600, padding: 0, marginBottom: "6px", letterSpacing: "-0.24px" }}
            >
              ← Back to Analytics
            </button>
            <div style={{ fontSize: "20px", fontWeight: 700, color: R.tp, letterSpacing: "-0.6px" }}>Onboarding</div>
            <div style={{ fontSize: "12px", color: R.tm, marginTop: "2px", letterSpacing: "-0.24px" }}>
              {data?.group_name || groupName || "—"} · {windowLabel}
              {member ? ` · ${member}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              style={{ borderRadius: R.rPill, border: `1px solid ${R.border}`, background: R.white, padding: "8px 16px", fontSize: "12px", outline: "none", width: "220px", letterSpacing: "-0.24px" }}
            />
            <button
              onClick={() => load({ force: true })}
              className="cursor-pointer"
              style={{ borderRadius: R.rPill, border: "none", background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 18px", letterSpacing: "-0.24px" }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: "14px" }}>
          {TABS.map(t => {
            const active = type === t.key;
            const n = t.key === "trainers" ? counts.new_trainers : t.key === "clients" ? counts.new_clients : counts.total;
            return (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setPage(1); }}
                className="cursor-pointer"
                style={{ borderRadius: R.rPill, border: `1px solid ${active ? R.blue : R.border}`, background: active ? R.blue : R.white, color: active ? R.white : R.ts, fontSize: "12px", fontWeight: 600, padding: "7px 18px", letterSpacing: "-0.24px" }}
              >
                {t.label} {data ? `(${n ?? 0})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "20px 24px 40px" }}>
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ padding: "80px 0" }}>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: R.blue, animation: `loaderBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
            <div style={{ fontSize: "13px", color: R.ts, fontWeight: 500 }}>Loading onboarding…</div>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-3" style={{ padding: "60px 0" }}>
            <div className="max-w-md text-center" style={{ background: "#fef2f2", border: `1px solid ${R.red}30`, color: R.red, borderRadius: R.rCard, padding: "16px", fontSize: "13px" }}>{error}</div>
            <button onClick={() => load({ force: true })} className="cursor-pointer" style={{ borderRadius: R.rPill, background: R.blueLight, color: R.blue, fontSize: "12px", fontWeight: 600, padding: "8px 20px", border: "none" }}>Retry</button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="flex flex-col gap-5">
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              {[
                { label: "Trainers Onboarded", val: counts.new_trainers ?? 0, color: R.blue },
                { label: "Clients Onboarded", val: counts.new_clients ?? 0, color: R.green },
                { label: "Total", val: counts.total ?? 0, color: R.dark },
              ].map(s => (
                <div key={s.label} style={{ ...CS, padding: "18px 20px", borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-1px", color: R.tp, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: "11px", color: R.tm, marginTop: "6px", letterSpacing: "-0.22px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {showTrainers && (
              <div style={CS}>
                <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${R.border}` }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: R.tp, letterSpacing: "-0.3px" }}>Trainers</div>
                  <span style={badgeStyle(R.blueLight, R.blue)}>{data.trainers_pagination?.total ?? trainers.length}</span>
                </div>
                {trainers.length === 0
                  ? <EmptyState text={`No trainers onboarded ${whenLabel}`} />
                  : <>
                      <Table cols={trainerCols} rows={trainers} />
                      {type === "trainers" && <Pager pagination={data.trainers_pagination} onPage={setPage} />}
                    </>}
              </div>
            )}

            {showClients && (
              <div style={CS}>
                <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${R.border}` }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: R.tp, letterSpacing: "-0.3px" }}>Clients</div>
                  <span style={badgeStyle(R.greenLight, R.green)}>{data.clients_pagination?.total ?? clients.length}</span>
                </div>
                {clients.length === 0
                  ? <EmptyState text={`No clients onboarded ${whenLabel}`} />
                  : <>
                      <Table cols={clientCols} rows={clients} />
                      {type === "clients" && <Pager pagination={data.clients_pagination} onPage={setPage} />}
                    </>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Shared by /super-admin/onboarding and /trainer-admin/onboarding — both link here
// from their analytics "Onboarded" cards with the same query params, and the group
// scope the backend returns is already role-aware (actor_user_id from the token).
export default function GroupOnboarding() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
