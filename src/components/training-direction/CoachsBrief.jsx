"use client";

// "Coach's Brief" tab — the trainer's thinking and session shape.
// Reads:
//   trainer_thinking_summary  — 4 short paragraphs explaining the call
//   session_objective         — one-line goal
//   session_structure         — 5 phases (warmup → cooldown)
//   trainer_coaching_cues     — array of coaching prompts
//   global_trainer_note       — long narrative (collapsible)

const PHASES = [
  { key: "warmup",          label: "Warm-up" },
  { key: "main_block",      label: "Main block" },
  { key: "accessory_block", label: "Accessories" },
  { key: "conditioning",    label: "Conditioning" },
  { key: "cooldown",        label: "Cool-down" },
];

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

function ThinkingBlock({ label, text }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[#A1A1A1] text-[10px] uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-[#252525] text-[13px] leading-[1.5]">{text || "—"}</div>
    </div>
  );
}

export default function CoachsBrief({ data }) {
  const thinking = data?.trainer_thinking_summary || {};
  const objective = data?.session_objective;
  const structure = data?.session_structure || {};
  const cues = Array.isArray(data?.trainer_coaching_cues) ? data.trainer_coaching_cues : [];
  const note = data?.global_trainer_note;

  const hasThinking = Object.values(thinking).some(Boolean);
  const hasStructure = Object.values(structure).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {/* Trainer thinking — 4 stacked blocks in a single card so the labels read together */}
      {hasThinking && (
        <Card>
          <CardTitle>Trainer Thinking</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mt-4">
            <ThinkingBlock label="Current status"        text={thinking.current_status} />
            <ThinkingBlock label="What the scores say"   text={thinking.what_scores_say} />
            <ThinkingBlock label="Trainer interpretation" text={thinking.trainer_interpretation} />
            <ThinkingBlock label="Main training decision" text={thinking.main_training_decision} />
          </div>
        </Card>
      )}

      {/* Session objective — single line, blue accent to surface it */}
      {objective && (
        <section className="bg-[#308BF9] rounded-[10px] p-5 text-white">
          <div className="text-[11px] uppercase tracking-wide font-semibold opacity-80">Session objective</div>
          <div className="text-[15px] font-semibold leading-[1.4] mt-1.5">{objective}</div>
        </section>
      )}

      {/* Session structure — 5 phases as a vertical timeline */}
      {hasStructure && (
        <Card>
          <CardTitle>Session Structure</CardTitle>
          <ol className="mt-4 flex flex-col gap-3">
            {PHASES.map((p, i) => {
              const text = structure[p.key];
              if (!text) return null;
              return (
                <li key={p.key} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#EEF4FE] text-[#308BF9] text-[12px] font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="text-[#252525] text-[13px] font-semibold">{p.label}</div>
                    <div className="text-[#535359] text-[12px] mt-0.5 leading-[1.5]">{text}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* Coaching cues — bullet list */}
      {cues.length > 0 && (
        <Card>
          <CardTitle>Coaching cues</CardTitle>
          <ul className="mt-4 flex flex-col gap-2">
            {cues.map((cue, i) => (
              <li key={i} className="flex gap-2 text-[#535359] text-[13px] leading-[1.5]">
                <span className="text-[#308BF9] flex-shrink-0 font-bold">·</span>
                <span>{typeof cue === "string" ? cue : (cue.text || JSON.stringify(cue))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Trainer note — long narrative if present */}
      {note && (
        <Card>
          <CardTitle>Trainer note</CardTitle>
          <p className="mt-3 text-[#535359] text-[13px] leading-[1.6] whitespace-pre-wrap">
            {note}
          </p>
        </Card>
      )}
    </div>
  );
}
