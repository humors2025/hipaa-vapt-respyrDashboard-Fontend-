"use client";

// "Coach's Playbook" tab — the rules engine for the session.
// Reads:
//   exercise_strategy.constraints_applied  — session caps, category caps
//   progression_permission                 — what may be progressed today
//   next_session_plan                      — what to do based on tomorrow's scores
//   red_flags                              — explicit blockers (rare)
//
// Layout:
//   1. Caps banner       — overall session ceiling (RPE / volume / mode)
//   2. Movement caps     — card grid, sorted most-restrictive-first
//   3. Progression       — Allowed | Locked split with reason
//   4. Next session      — 3 scenario cards (improve / same / worse)
//   5. Red flags (rare)  — surfaced only when present

const CATEGORY_LABELS = {
  compound_barbell:       "Barbell",
  compound_machine:       "Machine",
  compound_dumbbell:      "Dumbbell",
  compound_bodyweight:    "Bodyweight",
  isolation_single_joint: "Isolation",
  conditioning:           "Conditioning",
};

const CATEGORY_INITIALS = {
  compound_barbell:       "BB",
  compound_machine:       "MC",
  compound_dumbbell:      "DB",
  compound_bodyweight:    "BW",
  isolation_single_joint: "IS",
  conditioning:           "CN",
};

const PROGRESSION_FIELDS = [
  { key: "load_progression",      label: "Load" },
  { key: "volume_progression",    label: "Volume" },
  { key: "density_progression",   label: "Density (rest cuts)" },
  { key: "technical_progression", label: "Technical (tempo, ROM)" },
];

const ALLOWED_VALUES = new Set(["allowed", "yes", "true"]);
const DENIED_VALUES  = new Set(["denied", "no", "false"]);
const PARTIAL_VALUES = new Set(["small_only", "limited", "partial"]);

function isAllowed(v) { return ALLOWED_VALUES.has(String(v || "").toLowerCase()) || v === true; }
function isDenied(v)  { return DENIED_VALUES.has(String(v || "").toLowerCase()) || v === false; }
function isPartial(v) { return PARTIAL_VALUES.has(String(v || "").toLowerCase()); }

function Card({ children, className = "" }) {
  return (
    <section className={`bg-white rounded-[10px] border border-[#E1E6ED] p-5 ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ children, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[#252525] text-[14px] font-bold tracking-[-0.02em]">{children}</h3>
      {hint && <span className="text-[#A1A1A1] text-[11px]">{hint}</span>}
    </div>
  );
}

// ---------- Caps banner (top) ----------

function CapsBanner({ constraints }) {
  if (!constraints || Object.keys(constraints).length === 0) return null;

  return (
    <section className="bg-[#308BF9] rounded-[10px] p-5 text-white">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold opacity-80">Session ceiling</div>
          <div className="text-[18px] font-bold mt-1">{constraints.training_mode || "—"}</div>
        </div>
        <div className="flex items-baseline gap-x-6 gap-y-2 flex-wrap text-[13px]">
          <span>RPE cap <strong className="text-[18px]">{constraints.session_max_rpe ?? "—"}</strong></span>
          <span>Volume <strong>{constraints.volume_cap || "—"}</strong></span>
          {constraints.primary_limiter && (
            <span className="opacity-90">Limiter <strong>{constraints.primary_limiter}</strong></span>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- Movement caps (card grid) ----------

function CategoryCard({ name, cap }) {
  const allowed = isAllowed(cap.allowed);
  const failureDenied = isDenied(cap.failure);

  // Decide the status pill text + tone. Failure rule is folded into the
  // allowed pill rather than shown as a separate parallel tag — it's a
  // sub-rule within allowed categories, not an independent state.
  let pillLabel = "Not allowed";
  let pillBg = "#FCEAEB";
  let pillText = "#B5363A";
  if (allowed) {
    pillLabel = failureDenied ? "Allowed · no failure" : "Allowed · failure ok";
    pillBg = "#E5F6EE";
    pillText = "#1F7A4A";
  }

  return (
    <div className={`rounded-[10px] border p-4 flex flex-col gap-3 ${allowed ? "border-[#E1E6ED] bg-white" : "border-[#F0AAB0] bg-[#FCEAEB]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">
            {CATEGORY_INITIALS[name] || ""}
          </div>
          <div className="text-[#252525] text-[13px] font-bold mt-0.5">
            {CATEGORY_LABELS[name] || name.replace(/_/g, " ")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">RPE cap</div>
          <div className="text-[#252525] text-[24px] font-bold leading-none mt-0.5">{cap.max_rpe ?? "—"}</div>
        </div>
      </div>
      <span
        className="inline-flex self-start rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
        style={{ backgroundColor: pillBg, color: pillText }}
      >
        {pillLabel}
      </span>
    </div>
  );
}

function MovementCaps({ constraints }) {
  const caps = constraints.category_caps || {};
  const entries = Object.entries(caps);
  if (entries.length === 0) return null;

  // Sort by max_rpe ascending — most restrictive first.
  entries.sort((a, b) => (a[1].max_rpe ?? 99) - (b[1].max_rpe ?? 99));

  return (
    <Card>
      <CardTitle hint="Most restrictive first">Movement caps</CardTitle>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
        {entries.map(([name, cap]) => (
          <CategoryCard key={name} name={name} cap={cap} />
        ))}
      </div>
    </Card>
  );
}

// ---------- Progression permission ----------

function ProgressionLane({ tone, label, items }) {
  if (items.length === 0) return null;
  const palette = tone === "allowed"
    ? { bg: "#E5F6EE", text: "#1F7A4A", chipBg: "#FFFFFF" }
    : tone === "partial"
      ? { bg: "#FFF4E0", text: "#A66B00", chipBg: "#FFFFFF" }
      : { bg: "#FCEAEB", text: "#B5363A", chipBg: "#FFFFFF" };

  return (
    <div className="rounded-[10px] p-4" style={{ backgroundColor: palette.bg }}>
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: palette.text }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {items.map((item) => (
          <span
            key={item.key}
            className="inline-flex rounded-full text-[12px] font-semibold px-3 py-1"
            style={{ backgroundColor: palette.chipBg, color: palette.text }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressionPermission({ progression }) {
  const items = PROGRESSION_FIELDS
    .map((f) => ({ ...f, value: progression[f.key] }))
    .filter((f) => f.value);

  if (items.length === 0) return null;

  const allowed = items.filter((f) => isAllowed(f.value));
  const partial = items.filter((f) => isPartial(f.value));
  const locked  = items.filter((f) => isDenied(f.value) && !isPartial(f.value));

  const overallAllowed = isAllowed(progression.allowed);

  return (
    <Card>
      <CardTitle hint={overallAllowed ? "Progression permitted" : "Progression denied today"}>
        Progression permission
      </CardTitle>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <ProgressionLane tone="allowed" label="Allowed today"  items={allowed} />
        <ProgressionLane tone="partial" label="Partial / limited" items={partial} />
        <ProgressionLane tone="locked"  label="Locked today"   items={locked} />
      </div>

      {(progression.type || progression.reason) && (
        <div className="mt-4 rounded-[8px] bg-[#F5F7FA] px-3 py-2.5">
          {progression.type && (
            <div className="text-[#252525] text-[12px] font-semibold leading-[1.5]">{progression.type}</div>
          )}
          {progression.reason && (
            <div className="text-[#A1A1A1] text-[11px] mt-1">{progression.reason}</div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- Next session plan ----------

function NextSessionPlan({ plan }) {
  const scenarios = [
    { key: "if_scores_improve", label: "If scores improve",  arrow: "↑", text: plan.if_scores_improve, accent: "#1F7A4A", bg: "#E5F6EE" },
    { key: "if_scores_same",    label: "If scores stay same", arrow: "→", text: plan.if_scores_same,    accent: "#A66B00", bg: "#FFF4E0" },
    { key: "if_scores_worse",   label: "If scores worsen",    arrow: "↓", text: plan.if_scores_worse,   accent: "#B5363A", bg: "#FCEAEB" },
  ].filter((s) => s.text);

  if (scenarios.length === 0) return null;

  return (
    <Card>
      <CardTitle>Next session plan</CardTitle>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((s) => (
          <div key={s.key} className="rounded-[10px] border border-[#E1E6ED] overflow-hidden flex flex-col">
            <div
              className="px-4 py-2 flex items-center justify-between gap-2"
              style={{ backgroundColor: s.bg, color: s.accent }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">{s.label}</span>
              <span className="text-[16px] font-bold leading-none">{s.arrow}</span>
            </div>
            <div className="p-4 text-[#252525] text-[12px] leading-[1.5] flex-1">
              {s.text}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- Red flags ----------

function RedFlags({ flags }) {
  if (flags.length === 0) return null;
  return (
    <Card>
      <CardTitle>Red flags</CardTitle>
      <ul className="mt-4 flex flex-col gap-2">
        {flags.map((flag, i) => (
          <li key={i} className="rounded-[8px] bg-[#FCEAEB] px-3 py-2 text-[#B5363A] text-[12px] leading-[1.5]">
            {typeof flag === "string" ? flag : (flag.message || JSON.stringify(flag))}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- Compose ----------

export default function CoachsPlaybook({ data }) {
  const constraints = data?.exercise_strategy?.constraints_applied || {};
  const progression = data?.progression_permission || {};
  const nextSession = data?.next_session_plan || {};
  const redFlags = Array.isArray(data?.red_flags) ? data.red_flags : [];

  return (
    <div className="flex flex-col gap-4">
      <CapsBanner constraints={constraints} />
      <MovementCaps constraints={constraints} />
      <ProgressionPermission progression={progression} />
      <NextSessionPlan plan={nextSession} />
      <RedFlags flags={redFlags} />
    </div>
  );
}
