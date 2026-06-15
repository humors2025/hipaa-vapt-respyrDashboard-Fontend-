"use client";

// "At a Glance" tab — single-page snapshot of today's training direction.
// Layout follows a strict top-down hierarchy:
//   1. Hero (full)        - readiness, status, mode (DOMINANT)
//   2. Plan + Rules       - the action layer (60/40)
//   3. Metabolism (full)  - the "why" behind the plan
//   4. Macros + Live      - tactical reference (50/50)
//   5. Client strip       - demographics + energy as compact footer
//
// Re-skinned to dashboard tokens. Defensive on every field.

import { fmt, round, STATUS_TONE, FATIGUE_TONE, MARKER_TONE, signalAccent } from "./helpers";
import { zoneLabel } from "@/lib/utils";

// ---------- Shared tiny bits ----------

function Pill({ tone, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ backgroundColor: tone?.bg || "#F5F7FA", color: tone?.text || "#535359" }}
    >
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <section className={`bg-white rounded-[10px] border border-[#E1E6ED] p-5 ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ children }) {
  return (
    <h3 className="text-[#252525] text-[14px] font-bold tracking-[-0.02em]">{children}</h3>
  );
}

// ============== TIER 1: HERO ==============

function ReadinessHero({ snap, oneLiner, tp }) {
  const status = snap.status || "—";
  const statusTone = STATUS_TONE[status];
  const fatigueTone = FATIGUE_TONE[snap.fatigue_risk];
  const dayFocus = (snap.day_focus || "").replace(/ Day$/i, "");

  return (
    <section className="bg-[#308BF9] rounded-[10px] p-6 text-white">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-end gap-5">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide font-semibold opacity-80">
              Training Readiness
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[56px] font-bold leading-none tracking-[-0.02em]">
                {fmt(snap.training_readiness_score, 1)}
              </span>
              <span className="text-[18px] font-semibold opacity-80">/100</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 pb-2">
            <div className="text-[18px] font-bold">{snap.training_mode || "—"}</div>
            <div className="flex items-center gap-2 flex-wrap">
              {statusTone && <Pill tone={statusTone}>{zoneLabel(status)}</Pill>}
              {fatigueTone && <Pill tone={fatigueTone}>{snap.fatigue_risk} fatigue</Pill>}
              {dayFocus && (
                <span className="text-[12px] opacity-90">
                  · {dayFocus}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          {snap.primary_limiter && (
            <div className="text-[12px] opacity-90">
              Primary limiter
              <div className="text-[14px] font-bold mt-0.5">{snap.primary_limiter}</div>
            </div>
          )}
          {tp.intensity_rpe && (
            <div className="text-[12px] opacity-90 mt-3">
              RPE range
              <div className="text-[14px] font-bold mt-0.5">
                {tp.intensity_rpe}{tp.max_rpe ? ` (cap ${tp.max_rpe})` : ""}
              </div>
            </div>
          )}
        </div>
      </div>
      {oneLiner && (
        <p className="text-[13px] leading-[1.5] mt-5 pt-4 border-t border-white/15 italic opacity-95">
          {oneLiner}
        </p>
      )}
    </section>
  );
}

// ============== TIER 2: PLAN + RULES ==============

function TodaysPlanCard({ strategy, perf }) {
  const main = strategy.main_lift || {};
  const accessories = Array.isArray(strategy.accessories) ? strategy.accessories : [];
  const exclusions = Array.isArray(strategy.exclusions) ? strategy.exclusions : [];

  return (
    <Card>
      <CardTitle>Today's Plan</CardTitle>

      <div className="mt-4 flex flex-col">
        {main.exercise && (
          <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-[#F5F7FA]">
            <div className="min-w-0">
              <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">Main lift</div>
              <div className="text-[#252525] text-[16px] font-bold mt-0.5 truncate">{main.exercise}</div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-[#252525] text-[14px] font-bold">{main.sets_reps || "—"}</div>
              <div className="text-[#A1A1A1] text-[11px]">RPE {main.rpe_target ?? "—"}</div>
            </div>
          </div>
        )}

        {accessories.map((a, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 py-2 border-b border-[#F5F7FA] last:border-0">
            <span className="text-[#535359] text-[13px] truncate">{a.exercise || "—"}</span>
            <span className="text-[#535359] text-[12px] flex-shrink-0">
              {a.sets_reps || "—"} <span className="text-[#A1A1A1]">· RPE {a.rpe_target ?? "—"}</span>
            </span>
          </div>
        ))}

        {!strategy.conditioning?.included && (
          <div className="text-[#A1A1A1] text-[11px] italic pt-2">Conditioning skipped today.</div>
        )}
      </div>

      {exclusions.length > 0 && (
        <div className="mt-4 rounded-[8px] bg-[#FCEAEB] px-3 py-2">
          <span className="text-[#B5363A] text-[10px] font-semibold uppercase tracking-wide">
            Excluded ({exclusions.length}):{" "}
          </span>
          <span className="text-[#535359] text-[11px]">
            {exclusions
              .map((e) => (e.excluded_exercise || "").replace("High-Intensity Interval Training", "HIIT"))
              .join(" · ")}
          </span>
        </div>
      )}

      {/* Performance expectation as small footer */}
      {(perf.strength_output || perf.endurance) && (
        <div className="mt-4 pt-3 border-t border-[#F5F7FA] flex items-baseline gap-5 text-[11px] text-[#535359]">
          {perf.strength_output && (
            <span>Strength: <strong className="text-[#252525]">{perf.strength_output}</strong></span>
          )}
          {perf.endurance && (
            <span>Endurance: <strong className="text-[#252525]">{perf.endurance}</strong></span>
          )}
        </div>
      )}
    </Card>
  );
}

function HardRulesCard({ tp, conditioningIncluded }) {
  const rules = [
    { label: "RPE cap",        value: tp.max_rpe != null ? `≤ ${tp.max_rpe}` : "—" },
    { label: "Volume",         value: tp.volume || "—" },
    { label: "Session length", value: tp.session_length || "—" },
    { label: "Conditioning",   value: conditioningIncluded ? "Included" : "Skipped" },
  ];

  return (
    <Card>
      <CardTitle>Hard Rules</CardTitle>

      <div className="mt-4 flex flex-col">
        {rules.map((r, i) => (
          <div key={r.label} className={`flex items-baseline justify-between py-2 ${i < rules.length - 1 ? "border-b border-[#F5F7FA]" : ""}`}>
            <span className="text-[#A1A1A1] text-[11px] uppercase tracking-wide font-semibold">{r.label}</span>
            <span className="text-[#252525] text-[13px] font-semibold">{r.value}</span>
          </div>
        ))}
      </div>

      {tp.failure_rule && (
        <div className="mt-4 rounded-[8px] bg-[#F5F7FA] px-3 py-2 text-[11px] text-[#535359] leading-[1.5]">
          {tp.failure_rule}
        </div>
      )}
    </Card>
  );
}

// ============== TIER 3: METABOLISM SIGNALS ==============

function MetabolismSignals({ signals, topDriver }) {
  if (!Array.isArray(signals) || signals.length === 0) {
    return (
      <Card>
        <CardTitle>Metabolism Signals</CardTitle>
        <div className="mt-4 rounded-[8px] border border-dashed border-[#E1E6ED] p-4 text-center text-[#A1A1A1] text-[12px]">
          No signal data available.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle>Metabolism Signals</CardTitle>
        <span className="text-[#A1A1A1] text-[11px]">Six axes powering today's readiness</span>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {signals.map((s, i) => {
          const isTop = s.signal && s.signal === topDriver;
          const accent = signalAccent({ tier: s.tier, isTopDriver: isTop });
          const marker = MARKER_TONE[s.marker_source];
          return (
            <div
              key={`${s.signal || i}`}
              className="rounded-[8px] border border-[#E1E6ED] p-3 flex flex-col gap-1.5 border-l-[3px]"
              style={{ borderLeftColor: accent.border }}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="text-[#535359] text-[10px] font-semibold uppercase tracking-wide leading-tight">
                  {isTop ? "★ " : ""}{s.signal || "—"}
                </div>
                {marker && (
                  <span
                    className="flex-shrink-0 text-[8px] font-semibold uppercase tracking-wide"
                    style={{ color: marker.text }}
                  >
                    {marker.short}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[20px] font-bold leading-none" style={{ color: accent.text }}>
                  {fmt(s.score, 1)}
                </span>
                {s.tier === "limiter" && (
                  <span className="text-[9px] font-semibold text-[#B5363A] uppercase">limiter</span>
                )}
              </div>
              <div className="text-[#A1A1A1] text-[10px] leading-tight">
                {isTop ? "Top driver" : (s.zone_label || "—")}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============== TIER 4: MACROS + LIVE RULES ==============

function MacrosCard({ macros, energy, foodSummary }) {
  const deficit = energy.deficit_or_surplus_kcal;
  const deficitLabel = deficit == null ? "—" : `${deficit > 0 ? "+" : ""}${round(deficit)} kcal`;
  const items = [
    { label: "kcal",    value: round(macros.calories) },
    { label: "Protein", value: `${round(macros.protein_g)}g`, sub: macros.protein_g_per_kg ? `${fmt(macros.protein_g_per_kg, 1)}/kg` : null },
    { label: "Carbs",   value: `${round(macros.carbs_g)}g`,   sub: macros.carbs_g_per_kg   ? `${fmt(macros.carbs_g_per_kg, 1)}/kg`   : null },
    { label: "Fat",     value: `${round(macros.fat_g)}g` },
    { label: "Fiber",   value: `${round(macros.fiber_g)}g` },
  ];

  return (
    <Card>
      <CardTitle>Today's Macros</CardTitle>

      <div className="mt-4 flex flex-col">
        {items.map((m, i) => (
          <div key={m.label} className={`flex items-baseline justify-between py-2 ${i < items.length - 1 ? "border-b border-[#F5F7FA]" : ""}`}>
            <span className="text-[#A1A1A1] text-[11px] uppercase tracking-wide font-semibold">{m.label}</span>
            <span className="text-[#252525] text-[13px] font-semibold">
              {m.value}
              {m.sub && <span className="text-[#A1A1A1] font-normal ml-2">{m.sub}</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[#F5F7FA] flex items-baseline gap-4 flex-wrap text-[11px] text-[#535359]">
        <span>vs TDEE: <strong className={deficit != null && deficit > 0 ? "text-[#1F7A4A]" : "text-[#B5363A]"}>{deficitLabel}</strong></span>
        {foodSummary?.focus_count != null && <span>Focus: <strong className="text-[#252525]">{foodSummary.focus_count}</strong></span>}
        {foodSummary?.avoid_count != null && <span>Avoid: <strong className="text-[#252525]">{foodSummary.avoid_count}</strong></span>}
      </div>
    </Card>
  );
}

function LiveRulesCard({ rules }) {
  const items = [
    { label: "If client feels strong",   text: rules.if_client_feels_strong },
    { label: "If client fatigues early", text: rules.if_client_fatigues_early },
    { label: "If discomfort occurs",     text: rules.if_discomfort_occurs },
  ];

  return (
    <Card>
      <CardTitle>Live Rules</CardTitle>

      <div className="mt-4 flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={item.label} className={`${i < items.length - 1 ? "pb-3 border-b border-[#F5F7FA]" : ""}`}>
            <div className="text-[#A1A1A1] text-[11px] uppercase tracking-wide font-semibold">{item.label}</div>
            <div className="text-[#252525] text-[12px] mt-1 leading-[1.5]">{item.text || "—"}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============== TIER 5: FOOTER STRIP (Client + Energy) ==============

function ClientEnergyStrip({ snapshot, energy }) {
  const sex = snapshot.sex ? snapshot.sex.charAt(0).toUpperCase() + snapshot.sex.slice(1) : null;
  const eaOk = energy.ea_flag === "ok" || energy.ea_flag === "supportive";
  const eaText = energy.energy_availability_kcal_per_kg_ffm != null
    ? `${fmt(energy.energy_availability_kcal_per_kg_ffm, 1)} kcal/kg FFM ${eaOk ? "✓" : "⚠"}`
    : null;

  const items = [
    snapshot.age != null && `${snapshot.age} y`,
    sex,
    snapshot.height_cm != null && `${snapshot.height_cm} cm`,
    snapshot.weight_kg != null && `${snapshot.weight_kg} kg`,
    snapshot.bmi != null && `BMI ${fmt(snapshot.bmi, 1)}`,
  ].filter(Boolean);

  return (
    <div className="bg-[#F5F7FA] rounded-[10px] px-5 py-3 flex items-center gap-x-6 gap-y-2 flex-wrap text-[11px] text-[#535359]">
      <span className="text-[#A1A1A1] uppercase tracking-wide font-semibold text-[10px]">Client</span>
      <span>{items.join(" · ")}</span>
      <span className="text-[#A1A1A1]">|</span>
      <span className="text-[#A1A1A1] uppercase tracking-wide font-semibold text-[10px]">Energy</span>
      <span>BMR <strong className="text-[#252525]">{round(energy.bmr_kcal)}</strong></span>
      <span>TDEE <strong className="text-[#252525]">{round(energy.tdee_kcal)}</strong></span>
      <span>Target <strong className="text-[#252525]">{round(energy.target_kcal)}</strong></span>
      {eaText && (
        <span>
          EA <strong style={{ color: eaOk ? "#1F7A4A" : "#A66B00" }}>{eaText}</strong>
        </span>
      )}
    </div>
  );
}

// ============== Page composition ==============

export default function AtAGlance({ data }) {
  const snap = data?.readiness_snapshot || {};
  const tp = data?.training_prescription || {};
  const strategy = data?.exercise_strategy || {};
  const why = data?.why_todays_plan || {};
  const perf = data?.performance_expectation || {};
  const liveRules = data?.real_time_decision_rule || {};
  const macros = why.final_macros || {};
  const energy = why.energy_budget || {};
  const snapshot = why.client_snapshot || {};
  const foodSummary = why.food_direction_summary || {};
  const signals = why.metabolism_signals || [];
  const topDriver = why.drivers?.top_positive_driver;
  const conditioningIncluded = Boolean(strategy.conditioning?.included);

  return (
    <div className="flex flex-col gap-4">
      {/* Tier 1: HERO */}
      <ReadinessHero snap={snap} oneLiner={why.trainer_one_liner} tp={tp} />

      {/* Tier 2: Plan (lead) + Hard Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7"><TodaysPlanCard strategy={strategy} perf={perf} /></div>
        <div className="lg:col-span-5"><HardRulesCard tp={tp} conditioningIncluded={conditioningIncluded} /></div>
      </div>

      {/* Tier 3: WHY (full width) */}
      <MetabolismSignals signals={signals} topDriver={topDriver} />

      {/* Tier 4: Tactical reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MacrosCard macros={macros} energy={energy} foodSummary={foodSummary} />
        <LiveRulesCard rules={liveRules} />
      </div>

      {/* Tier 5: Compact footer strip */}
      <ClientEnergyStrip snapshot={snapshot} energy={energy} />
    </div>
  );
}
