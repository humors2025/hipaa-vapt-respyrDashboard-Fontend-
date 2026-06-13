"use client";

// "Food Direction" tab — trainer-facing food TYPE direction (not specific foods).
// Reads:
//   food_direction.macro_alignment      — calories / protein_g / fiber_g + alignment_note
//   food_direction.focus_food_types[]   — { type, reason, marker_basis }
//   food_direction.avoid_food_types[]   — same shape
//   food_direction.timing_emphasis      — string
//   food_direction.hydration_emphasis   — string
//   food_direction.axis_zones_used      — six metabolism axes that drove the call
//   food_direction.rules_applied[]      — rule-engine trace (ordered)
//   food_direction.rationale            — long paragraph
//
// Every focus/avoid line cites its marker basis, so the trainer can defend
// the call to the client. That citation is the differentiator vs a generic
// nutrition card — surface it prominently.

import { fmt, round, MARKER_TONE, signalAccent } from "./helpers";

// marker_basis values seen in payload:
//   mode_baseline, body_context, acetone, acetone-inverse,
//   ethanol, ethanol-inverse, hydrogen, hydrogen-inverse
//
// Map each to a marker-source pill (acetone/ethanol/hydrogen color) or a
// neutral pill (mode/body context aren't marker-derived).
function markerBasisPill(basis) {
  if (!basis) return { tone: { bg: "#F5F7FA", text: "#535359" }, short: "—", label: "—" };
  const b = String(basis).toLowerCase();
  if (b.startsWith("acetone"))  return { tone: MARKER_TONE.acetone,  short: "A", label: b.replace(/_/g, " ") };
  if (b.startsWith("ethanol"))  return { tone: MARKER_TONE.ethanol,  short: "E", label: b.replace(/_/g, " ") };
  if (b.startsWith("hydrogen")) return { tone: MARKER_TONE.hydrogen, short: "H", label: b.replace(/_/g, " ") };
  if (b === "mode_baseline")    return { tone: { bg: "#EEF4FE", text: "#1A56AF" }, short: "M", label: "mode baseline" };
  if (b === "body_context")     return { tone: { bg: "#F5F7FA", text: "#535359" }, short: "B", label: "body context" };
  return { tone: { bg: "#F5F7FA", text: "#535359" }, short: "·", label: b.replace(/_/g, " ") };
}

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

// ---------- Macro alignment banner ----------

function MacroAlignment({ alignment }) {
  if (!alignment) return null;
  const { calories, protein_g, fiber_g, alignment_note } = alignment;
  return (
    <section className="bg-[#308BF9] rounded-[10px] p-5 text-white">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold opacity-80">Today's macro target</div>
          <div className="flex items-baseline gap-x-6 gap-y-1 flex-wrap mt-1.5 text-[13px]">
            <span>Calories <strong className="text-[18px]">{round(calories)}</strong></span>
            <span>Protein <strong>{fmt(protein_g, 0)}g</strong></span>
            <span>Fiber <strong>{fmt(fiber_g, 0)}g</strong></span>
          </div>
        </div>
        {alignment_note && (
          <p className="flex-1 min-w-[220px] text-[12px] leading-[1.5] opacity-90">
            {alignment_note}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- Focus / Avoid food-type lists ----------

function FoodTypeRow({ item }) {
  const pill = markerBasisPill(item.marker_basis);
  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-[#F5F7FA] last:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-[#252525] text-[13px] font-semibold leading-[1.4] flex-1 min-w-0">
          {item.type}
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0"
          style={{ backgroundColor: pill.tone.bg, color: pill.tone.text }}
          title={item.marker_basis}
        >
          <span className="opacity-70">{pill.short}</span>
          <span>{pill.label}</span>
        </span>
      </div>
      {item.reason && (
        <div className="text-[#535359] text-[12px] leading-[1.5]">{item.reason}</div>
      )}
    </div>
  );
}

function FoodTypeList({ tone, label, items, emptyText }) {
  const palette = tone === "focus"
    ? { bg: "#E5F6EE", text: "#1F7A4A" }
    : { bg: "#FCEAEB", text: "#B5363A" };
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[#252525] text-[14px] font-bold tracking-[-0.02em]">{label}</h3>
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: palette.bg, color: palette.text }}
        >
          {items.length}
        </span>
      </div>
      <div className="mt-2">
        {items.length === 0 ? (
          <div className="text-[#A1A1A1] text-[12px] py-3">{emptyText}</div>
        ) : (
          items.map((item, i) => <FoodTypeRow key={i} item={item} />)
        )}
      </div>
    </Card>
  );
}

// ---------- Timing + Hydration row ----------

function TimingHydration({ timing, hydration }) {
  if (!timing && !hydration) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {timing && (
        <Card>
          <CardTitle>Timing emphasis</CardTitle>
          <p className="mt-3 text-[#535359] text-[13px] leading-[1.55]">{timing}</p>
        </Card>
      )}
      {hydration && (
        <Card>
          <CardTitle>Hydration emphasis</CardTitle>
          <p className="mt-3 text-[#535359] text-[13px] leading-[1.55]">{hydration}</p>
        </Card>
      )}
    </div>
  );
}

// ---------- Axis zones used (the six signals that drove the call) ----------

function AxisZones({ zones }) {
  const entries = Object.values(zones || {});
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardTitle hint="What drove today's food direction">Metabolism axes used</CardTitle>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((z) => {
          const accent = signalAccent({ tier: z.tier });
          const marker = markerBasisPill(z.marker_source);
          return (
            <div
              key={z.axis_name}
              className="rounded-[10px] border p-3 flex flex-col gap-2"
              style={{ borderColor: accent.border, backgroundColor: accent.bg }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[#252525] text-[12px] font-bold">{z.axis_name}</div>
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: marker.tone.bg, color: marker.tone.text }}
                >
                  {marker.short}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[#252525] text-[18px] font-bold leading-none">{fmt(z.score, 1)}</span>
                <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: accent.text }}>
                  {z.zone_label || z.flag || "—"}
                </span>
              </div>
              {z.what_it_measures && (
                <div className="text-[#535359] text-[11px] leading-[1.45]">{z.what_it_measures}</div>
              )}
              {z.threshold_rule && (
                <div className="text-[#A1A1A1] text-[10px] leading-[1.4]">{z.threshold_rule}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Rules applied (rule-engine trace) ----------

function RulesApplied({ rules }) {
  if (!rules || rules.length === 0) return null;
  return (
    <Card>
      <CardTitle hint="Ordered rule-engine trace">Rules applied</CardTitle>
      <ol className="mt-3 flex flex-col gap-2">
        {rules.map((rule, i) => (
          <li key={i} className="flex gap-2 text-[#535359] text-[12px] leading-[1.5]">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EEF4FE] text-[#308BF9] text-[10px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="flex-1">{rule}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------- Rationale (collapsible-feeling block) ----------

function Rationale({ text }) {
  if (!text) return null;
  return (
    <Card>
      <CardTitle>How this was built</CardTitle>
      <p className="mt-3 text-[#535359] text-[13px] leading-[1.6]">{text}</p>
    </Card>
  );
}

// ---------- Compose ----------

export default function FoodDirection({ data }) {
  const fd = data?.food_direction || {};
  const focus = Array.isArray(fd.focus_food_types) ? fd.focus_food_types : [];
  const avoid = Array.isArray(fd.avoid_food_types) ? fd.avoid_food_types : [];

  return (
    <div className="flex flex-col gap-4">
      <MacroAlignment alignment={fd.macro_alignment} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FoodTypeList
          tone="focus"
          label="Emphasize"
          items={focus}
          emptyText="No specific food types to emphasize today."
        />
        <FoodTypeList
          tone="avoid"
          label="Avoid"
          items={avoid}
          emptyText="No food types to actively avoid today."
        />
      </div>

      <TimingHydration timing={fd.timing_emphasis} hydration={fd.hydration_emphasis} />

      <AxisZones zones={fd.axis_zones_used} />
      <RulesApplied rules={fd.rules_applied} />
      <Rationale text={fd.rationale} />
    </div>
  );
}
