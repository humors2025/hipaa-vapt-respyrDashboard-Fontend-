"use client";

// "Watch & Plan" tab — condensed during-session cheat sheet.
// Rolls up fields that already appear elsewhere in deeper tabs, stacked into
// the engineer's six-card grid so the trainer has one screen to glance at
// while running the session.
//
// Reads:
//   warmup_check.what_to_monitor[]            — Card 1
//   red_flags[]                               — Card 2
//   trainer_coaching_cues[]                   — Card 3
//   progression_permission.{load,volume,density,technical}_progression
//                                             — Card 4
//   next_session_plan.{if_scores_improve,if_scores_same,if_scores_worse}
//                                             — Card 5
//   (Card 6 is a static trainer takeaway)

import { fmt } from "./helpers";

const PROGRESSION_FIELDS = [
  { key: "load_progression",      label: "Heavier weight" },
  { key: "volume_progression",    label: "More volume" },
  { key: "density_progression",   label: "Less rest" },
  { key: "technical_progression", label: "Cleaner technique" },
];

const ALLOWED_VALUES = new Set(["allowed", "yes", "true"]);
const DENIED_VALUES  = new Set(["denied", "no", "false"]);

function isAllowed(v) { return ALLOWED_VALUES.has(String(v || "").toLowerCase()) || v === true; }
function isDenied(v)  { return DENIED_VALUES.has(String(v || "").toLowerCase()) || v === false; }

function Card({ children, className = "" }) {
  return (
    <section className={`bg-white rounded-[10px] border border-[#E1E6ED] p-5 flex flex-col ${className}`}>
      {children}
    </section>
  );
}

function NumberBadge({ n, color }) {
  return (
    <span
      className="inline-flex w-5 h-5 rounded-full text-white text-[11px] font-bold items-center justify-center"
      style={{ backgroundColor: color }}
    >
      {n}
    </span>
  );
}

function CardTitle({ n, color, children }) {
  return (
    <div className="flex items-center gap-2">
      <NumberBadge n={n} color={color} />
      <h3 className="text-[#252525] text-[13px] font-bold tracking-[-0.02em]">{children}</h3>
    </div>
  );
}

// ---------- Card 1 — Warm-up Check ----------

function WarmupCheckCard({ warmup }) {
  const monitor = Array.isArray(warmup?.what_to_monitor) ? warmup.what_to_monitor : [];
  return (
    <Card>
      <CardTitle n={1} color="#308BF9">Warm-up Check</CardTitle>
      {monitor.length > 0 && (
        <div className="mt-3">
          <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">Watch for</div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {monitor.map((item, i) => (
              <li key={i} className="flex gap-2 text-[#252525] text-[12px] leading-[1.45]">
                <span className="text-[#308BF9] flex-shrink-0 font-bold">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {warmup?.decision_rule && (
        <div className="mt-3 rounded-[8px] bg-[#FFF4E0] border-l-[3px] border-[#A66B00] px-3 py-2">
          <div className="text-[#A66B00] text-[9px] uppercase tracking-wide font-bold">Bail-out rule</div>
          <div className="text-[#252525] text-[11px] leading-[1.45] mt-0.5">{warmup.decision_rule}</div>
        </div>
      )}
    </Card>
  );
}

// ---------- Card 2 — Red Flags ----------

function RedFlagsCard({ flags }) {
  return (
    <Card>
      <CardTitle n={2} color="#B5363A">Red Flags ({flags.length})</CardTitle>
      <div className="mt-3 flex-1">
        {flags.length === 0 ? (
          <div className="text-[#A1A1A1] text-[12px]">No red flags surfaced today.</div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {flags.map((flag, i) => {
              const text = typeof flag === "string" ? flag : (flag.message || JSON.stringify(flag));
              return (
                <li key={i} className="flex gap-2 text-[12px] text-[#B5363A] leading-[1.45]">
                  <span className="flex-shrink-0 font-bold">·</span>
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ---------- Card 3 — Coaching Cues ----------

function CoachingCuesCard({ cues }) {
  return (
    <Card>
      <CardTitle n={3} color="#534AB7">Coaching Cues</CardTitle>
      {cues.length === 0 ? (
        <div className="mt-3 text-[#A1A1A1] text-[12px]">No coaching cues surfaced today.</div>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {cues.map((cue, i) => {
            const text = typeof cue === "string" ? cue : (cue.text || JSON.stringify(cue));
            return (
              <li key={i} className="flex gap-2 text-[#252525] text-[12px] leading-[1.45]">
                <span className="text-[#534AB7] flex-shrink-0 font-bold">·</span>
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- Card 4 — Can You Push It? ----------

function CanYouPushCard({ progression }) {
  const cells = PROGRESSION_FIELDS.map((f) => {
    const v = progression[f.key];
    const allowed = isAllowed(v);
    const denied  = isDenied(v) && !allowed;
    return { ...f, value: v, allowed, denied };
  });

  return (
    <Card>
      <CardTitle n={4} color="#A66B00">Can you push it?</CardTitle>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {cells.map((c) => {
          const palette = c.allowed
            ? { bg: "#E5F6EE", text: "#1F7A4A", label: "Yes" }
            : c.denied
              ? { bg: "#FCEAEB", text: "#B5363A", label: "No" }
              : { bg: "#F5F7FA", text: "#535359", label: "—" };
          return (
            <div
              key={c.key}
              className="rounded-[8px] px-3 py-2 flex items-center justify-between gap-2"
              style={{ backgroundColor: palette.bg }}
            >
              <span className="text-[11px] font-medium" style={{ color: palette.text }}>{c.label}</span>
              <span className="text-[12px] font-bold" style={{ color: palette.text }}>{palette.label}</span>
            </div>
          );
        })}
      </div>
      {progression.reason && (
        <div className="mt-3 text-[#535359] text-[11px] leading-[1.45]">
          <span className="text-[#252525] font-semibold">Why · </span>
          {progression.reason}
        </div>
      )}
    </Card>
  );
}

// ---------- Card 5 — Next Session ----------

function NextSessionCard({ plan }) {
  const rows = [
    { key: "if_scores_improve", arrow: "↑", label: "Better", text: plan.if_scores_improve, accent: "#1F7A4A", bg: "#E5F6EE" },
    { key: "if_scores_same",    arrow: "→", label: "Same",   text: plan.if_scores_same,    accent: "#A66B00", bg: "#FFF4E0" },
    { key: "if_scores_worse",   arrow: "↓", label: "Worse",  text: plan.if_scores_worse,   accent: "#B5363A", bg: "#FCEAEB" },
  ].filter((r) => r.text);

  return (
    <Card>
      <CardTitle n={5} color="#0F6E56">Next Session</CardTitle>
      {rows.length === 0 ? (
        <div className="mt-3 text-[#A1A1A1] text-[12px]">No next-session plan provided.</div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.key}
              className="rounded-[8px] px-3 py-2 flex items-baseline gap-3"
              style={{ backgroundColor: r.bg }}
            >
              <span className="text-[11px] font-bold flex-shrink-0" style={{ color: r.accent }}>
                {r.arrow} {r.label}
              </span>
              <span className="text-[#252525] text-[11px] leading-[1.45]">{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------- Card 6 — Trainer Takeaway ----------

function TrainerTakeawayCard() {
  return (
    <Card>
      <CardTitle n={6} color="#5F5E5A">Trainer Takeaway</CardTitle>
      <p className="mt-3 rounded-[8px] bg-[#F5F7FA] px-3 py-2.5 text-[#252525] text-[12px] leading-[1.55]">
        Read food direction like the food equivalent of exercise strategy. Every line traces back to a
        marker source <strong>(acetone / ethanol / hydrogen)</strong> + a numeric threshold the trainer can quote.
      </p>
      <p className="mt-2 pt-2 border-t border-[#F5F7FA] text-[#A1A1A1] text-[10px] leading-[1.45] italic">
        <strong className="text-[#535359] not-italic">Note · </strong>
        Non-clinical decision support based on daily metabolism trends.
        Does not diagnose or treat medical conditions.
      </p>
    </Card>
  );
}

// ---------- Compose ----------

export default function WatchAndPlan({ data }) {
  const warmup = data?.warmup_check || {};
  const flags = Array.isArray(data?.red_flags) ? data.red_flags : [];
  const cues = Array.isArray(data?.trainer_coaching_cues) ? data.trainer_coaching_cues : [];
  const progression = data?.progression_permission || {};
  const nextSession = data?.next_session_plan || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <WarmupCheckCard warmup={warmup} />
      <CoachingCuesCard cues={cues} />
      <NextSessionCard plan={nextSession} />
      <RedFlagsCard flags={flags} />
      <CanYouPushCard progression={progression} />
      <TrainerTakeawayCard />
    </div>
  );
}
