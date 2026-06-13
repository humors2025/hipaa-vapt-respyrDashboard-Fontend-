"use client";

// "Today's Session" tab — full session detail with load guidance, why-this-lift,
// substitutions, exclusions, and warmup checks.
// Reads:
//   exercise_strategy.main_lift             — exercise + load_guidance + why + substitution
//   exercise_strategy.accessories[]         — same shape, multiple
//   exercise_strategy.exclusions[]          — excluded exercises with reason
//   exercise_strategy.conditioning          — included flag + type + duration + rationale
//   warmup_check                            — what_to_monitor[] + decision_rule
//   training_prescription                   — for the prescription summary at top

function Card({ children, className = "" }) {
  return (
    <section className={`bg-white rounded-[10px] border border-[#E1E6ED] p-5 ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ children }) {
  return <h3 className="text-[#252525] text-[14px] font-bold tracking-[-0.02em]">{children}</h3>;
}

function ExerciseDetail({ kind, ex }) {
  if (!ex || (!ex.exercise && !ex.sets_reps)) return null;
  return (
    <div className="flex flex-col gap-3 py-4 border-b border-[#F5F7FA] last:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">{kind}</div>
          <div className="text-[#252525] text-[16px] font-bold mt-0.5">{ex.exercise || "—"}</div>
          {ex.category && (
            <div className="text-[#A1A1A1] text-[11px] mt-0.5">{ex.category.replace(/_/g, " ")}</div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[#252525] text-[14px] font-bold">{ex.sets_reps || "—"}</div>
          <div className="text-[#A1A1A1] text-[11px]">RPE {ex.rpe_target ?? "—"}</div>
        </div>
      </div>

      {ex.load_guidance && (
        <div className="text-[#535359] text-[12px] leading-[1.5]">
          <span className="text-[#A1A1A1] uppercase text-[10px] tracking-wide font-semibold">Load · </span>
          {ex.load_guidance}
        </div>
      )}

      {ex.why_this_lift && (
        <div className="text-[#535359] text-[12px] leading-[1.5]">
          <span className="text-[#A1A1A1] uppercase text-[10px] tracking-wide font-semibold">Why · </span>
          {ex.why_this_lift}
        </div>
      )}

      {ex.substitution_if_unavailable && (
        <div className="text-[#535359] text-[12px]">
          <span className="text-[#A1A1A1] uppercase text-[10px] tracking-wide font-semibold">Substitute · </span>
          {ex.substitution_if_unavailable}
        </div>
      )}
    </div>
  );
}

export default function TodaysSession({ data }) {
  const tp = data?.training_prescription || {};
  const strategy = data?.exercise_strategy || {};
  const main = strategy.main_lift || {};
  const accessories = Array.isArray(strategy.accessories) ? strategy.accessories : [];
  const exclusions = Array.isArray(strategy.exclusions) ? strategy.exclusions : [];
  const conditioning = strategy.conditioning || {};
  const warmup = data?.warmup_check || {};
  const monitor = Array.isArray(warmup.what_to_monitor) ? warmup.what_to_monitor : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Prescription summary — small blue strip at top */}
      <section className="bg-[#308BF9] rounded-[10px] p-5 text-white">
        <div className="text-[11px] uppercase tracking-wide font-semibold opacity-80">Today's prescription</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-[13px]">
          <span>Volume <strong>{tp.volume || "—"}</strong></span>
          <span>RPE <strong>{tp.intensity_rpe || "—"}</strong>{tp.max_rpe ? ` (cap ${tp.max_rpe})` : ""}</span>
          <span>Length <strong>{tp.session_length || "—"}</strong></span>
          {tp.training_style && <span>Style <strong>{tp.training_style}</strong></span>}
          {tp.rest_time && <span>Rest <strong>{tp.rest_time}</strong></span>}
        </div>
      </section>

      {/* Main lift + accessories — one card, detailed rows */}
      <Card>
        <CardTitle>Lift list</CardTitle>
        <div className="mt-4">
          <ExerciseDetail kind="Main lift" ex={main} />
          {accessories.map((a, i) => (
            <ExerciseDetail key={i} kind={`Accessory ${i + 1}`} ex={a} />
          ))}
        </div>

        {/* Conditioning */}
        <div className="mt-4 pt-4 border-t border-[#F5F7FA]">
          <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">Conditioning</div>
          <div className="mt-1 text-[#252525] text-[13px] font-semibold">
            {conditioning.included
              ? `Included — ${conditioning.type || "—"}${conditioning.duration_min ? ` · ${conditioning.duration_min} min` : ""}`
              : "Skipped today"}
          </div>
          {conditioning.rationale && (
            <div className="text-[#535359] text-[12px] mt-1 leading-[1.5]">{conditioning.rationale}</div>
          )}
        </div>

        {/* Exclusions */}
        {exclusions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#F5F7FA]">
            <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">Excluded ({exclusions.length})</div>
            <div className="mt-2 flex flex-col gap-2">
              {exclusions.map((e, i) => (
                <div key={i} className="rounded-[8px] bg-[#FCEAEB] px-3 py-2">
                  <div className="text-[#B5363A] text-[12px] font-semibold">
                    {(e.excluded_exercise || "").replace("High-Intensity Interval Training", "HIIT")}
                  </div>
                  {e.reason && <div className="text-[#535359] text-[11px] mt-0.5">{e.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Warmup check */}
      {(monitor.length > 0 || warmup.decision_rule) && (
        <Card>
          <CardTitle>Warm-up check</CardTitle>
          {monitor.length > 0 && (
            <div className="mt-4">
              <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">What to monitor</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {monitor.map((item, i) => (
                  <div key={i} className="text-[#252525] text-[12px] flex items-baseline gap-2">
                    <span className="text-[#308BF9] font-bold">·</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {warmup.decision_rule && (
            <div className="mt-4 rounded-[8px] bg-[#F5F7FA] px-3 py-2.5">
              <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">Decision rule</div>
              <div className="text-[#535359] text-[12px] mt-1 leading-[1.5]">{warmup.decision_rule}</div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
