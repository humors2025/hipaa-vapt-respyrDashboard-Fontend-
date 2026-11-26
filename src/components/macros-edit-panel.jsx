"use client";

/**
 * Edited macros for the Macros Analysis tab.
 *
 * Shows the test's real macros next to the hand-edited ones, who edited them
 * (name + user_id from their access token), and the date range the edit is
 * used for. While that range covers the week being planned, the diet-plan
 * worker plans from the edited numbers instead of the test's
 * (backend services/macroOverrides.js).
 *
 * APIs: get_macro_overrides / save_macro_override / remove_macro_override.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { selectMacroSummaryData } from "../store/macroSummarySlice";
import {
  fetchMacroOverrides,
  saveMacroOverride,
  removeMacroOverride,
  getAccessTokenEditor,
} from "../services/authService";

const FIELDS = [
  { key: "carbs_g", label: "Carbs", color: "#F4A261" },
  { key: "fat_g", label: "Fats", color: "#3A86FF" },
  { key: "protein_g", label: "Protein", color: "#E76F51" },
  { key: "fiber_g", label: "Fibre", color: "#2A9D8F" },
];

// Same rule as the backend (services/macroOverrides.js caloriesFromMacros):
// the test's calories moved by only what changed — protein 4, carbs 4, fat 9,
// fibre 2 kcal per gram. Without the test's numbers, the plain sum.
const KCAL = { protein_g: 4, carbs_g: 4, fat_g: 9, fiber_g: 2 };
const kcalSum = (m) => Object.entries(KCAL).reduce((acc, [k, w]) => acc + Number(m?.[k] || 0) * w, 0);
const caloriesOf = (m, base) =>
  base && Number(base.calories) > 0
    ? Math.max(0, Math.round(Number(base.calories) + kcalSum(m) - kcalSum(base)))
    : Math.round(kcalSum(m));

const fmt = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });

function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function niceDate(ymd) {
  if (!ymd) return "—";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const STATUS_STYLE = {
  active: "bg-[#E6F6EC] text-[#1E8E4A]",
  upcoming: "bg-[#E8F1FE] text-[#308BF9]",
  expired: "bg-[#F0F1F3] text-[#738298]",
  removed: "bg-[#FDECEC] text-[#D64545]",
};

function StatusChip({ status }) {
  return (
    <span
      className={`px-2 py-[2px] rounded-full text-[10px] font-semibold capitalize ${
        STATUS_STYLE[status] || STATUS_STYLE.expired
      }`}
    >
      {status}
    </span>
  );
}

function EditorLine({ who, when, verb = "Edited by" }) {
  if (!who) return null;
  return (
    <p className="text-[#535359] text-[11px] leading-[140%]">
      {verb} <span className="font-semibold text-[#252525]">{who.name || "Unknown"}</span>
      {who.user_id ? <span className="text-[#738298]"> ({who.user_id})</span> : null}
      {when ? <span className="text-[#738298]"> · {when}</span> : null}
    </p>
  );
}

function CompareTable({ real, edited, realLabel }) {
  const rows = [
    ...FIELDS.map((f) => ({ ...f, unit: "g" })),
    { key: "calories", label: "Calories", color: "#535359", unit: "kcal" },
  ];
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-[#738298] text-left">
          <th className="font-semibold py-1">Macro</th>
          <th className="font-semibold py-1 text-right">{realLabel}</th>
          <th className="font-semibold py-1 text-right">Edited</th>
          <th className="font-semibold py-1 text-right">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const a = real ? Number(real[r.key]) : null;
          const b = edited ? Number(edited[r.key]) : null;
          const diff = a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
          return (
            <tr key={r.key} className="border-t border-[#E1E6ED]">
              <td className="py-[6px]">
                <span className="inline-flex items-center gap-[5px] font-semibold text-[#252525]">
                  <span className="w-[6px] h-[6px] rounded-full" style={{ background: r.color }} />
                  {r.label}
                </span>
              </td>
              <td className="py-[6px] text-right text-[#535359]">
                {fmt(a)}
                {a !== null ? r.unit : ""}
              </td>
              <td className="py-[6px] text-right font-semibold text-[#252525]">
                {fmt(b)}
                {b !== null ? r.unit : ""}
              </td>
              <td
                className={`py-[6px] text-right font-semibold ${
                  diff > 0 ? "text-[#1E8E4A]" : diff < 0 ? "text-[#D64545]" : "text-[#738298]"
                }`}
              >
                {diff === null ? "—" : `${diff > 0 ? "+" : ""}${fmt(diff)}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EditModal({ initial, realLabel, real, editor, today, saving, error, onCancel, onSave }) {
  const [values, setValues] = useState(initial);
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));
  const calories = caloriesOf(values, real);
  const rangeDays =
    values.valid_from && values.valid_to
      ? Math.round((new Date(values.valid_to) - new Date(values.valid_from)) / 86400000) + 1
      : null;

  const localError = (() => {
    for (const f of FIELDS) {
      const v = values[f.key];
      if (v === "" || v === null || Number.isNaN(Number(v)) || Number(v) < 0) {
        return `Enter ${f.label.toLowerCase()} in grams`;
      }
    }
    if (!values.valid_from || !values.valid_to) return "Pick the start and end dates";
    if (values.valid_from < today) return "Start date cannot be in the past";
    if (values.valid_to < values.valid_from) return "End date must be on or after the start date";
    return null;
  })();

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-[520px] bg-white rounded-[15px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit macros"
      >
        <div>
          <p className="text-[#252525] text-[16px] font-semibold">Edit macros</p>
          <p className="text-[#738298] text-[12px] leading-[140%] mt-1">
            The diet plan uses these numbers instead of the test&apos;s for every plan week inside the
            dates below. The test results themselves are not changed.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="flex items-center gap-[5px] text-[#535359] text-[11px] font-semibold">
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: f.color }} />
                {f.label} (g)
                {real ? (
                  <span className="font-normal text-[#738298]">
                    · test {fmt(real[f.key])}g
                  </span>
                ) : null}
              </span>
              <input
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                className="border border-[#E1E6ED] rounded-[6px] px-3 py-2 text-[13px] text-[#252525] outline-none focus:border-[#308BF9]"
              />
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between bg-[#F5F7FA] rounded-[8px] px-3 py-2">
          <span className="text-[#535359] text-[12px] font-semibold">Calories (worked out)</span>
          <span className="text-[#252525] text-[14px] font-semibold">
            {fmt(calories)} kcal
            {real?.calories ? (
              <span className="text-[#738298] text-[11px] font-normal"> · test {fmt(real.calories)}</span>
            ) : null}
          </span>
        </div>
        <p className="text-[#738298] text-[10px] -mt-2">
          {real ? `${realLabel} calories, changed by` : "Worked out as"} protein 4 · carbs 4 · fat 9 · fibre 2 kcal per gram.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[11px] font-semibold">Use from</span>
            <input
              type="date"
              min={today}
              value={values.valid_from}
              onChange={(e) => set("valid_from", e.target.value)}
              className="border border-[#E1E6ED] rounded-[6px] px-3 py-2 text-[13px] text-[#252525] outline-none focus:border-[#308BF9]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#535359] text-[11px] font-semibold">Use until</span>
            <input
              type="date"
              min={values.valid_from || today}
              value={values.valid_to}
              onChange={(e) => set("valid_to", e.target.value)}
              className="border border-[#E1E6ED] rounded-[6px] px-3 py-2 text-[13px] text-[#252525] outline-none focus:border-[#308BF9]"
            />
          </label>
        </div>
        {rangeDays > 0 ? (
          <p className="text-[#738298] text-[11px] -mt-2">{rangeDays} day{rangeDays === 1 ? "" : "s"} (India dates, same as the diet plan weeks)</p>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-[#535359] text-[11px] font-semibold">Note (optional)</span>
          <textarea
            rows={2}
            maxLength={500}
            value={values.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Why the macros were changed"
            className="border border-[#E1E6ED] rounded-[6px] px-3 py-2 text-[13px] text-[#252525] outline-none focus:border-[#308BF9] resize-none"
          />
        </label>

        {editor ? (
          <p className="text-[#738298] text-[11px]">
            Saving as <span className="font-semibold text-[#252525]">{editor.name || "Unknown"}</span>
            {editor.user_id ? ` (${editor.user_id})` : ""}
          </p>
        ) : null}

        {error || (localError && values._touched) ? (
          <p className="text-[#D64545] text-[12px]">{error || localError}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-[6px] border border-[#E1E6ED] text-[#535359] text-[12px] font-semibold cursor-pointer hover:bg-[#F5F7FA]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (localError) {
                setValues((prev) => ({ ...prev, _touched: true }));
                return;
              }
              onSave({
                protein_g: Number(values.protein_g),
                carbs_g: Number(values.carbs_g),
                fat_g: Number(values.fat_g),
                fiber_g: Number(values.fiber_g),
                valid_from: values.valid_from,
                valid_to: values.valid_to,
                note: values.note?.trim() || undefined,
              });
            }}
            className="px-4 py-2 rounded-[6px] bg-[#252525] text-white text-[12px] font-semibold cursor-pointer hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-wait"
          >
            {saving ? "Saving…" : "Save edited macros"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MacrosEditPanel({ activeTab }) {
  const macroSummaryData = useSelector(selectMacroSummaryData);
  const [profileId, setProfileId] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    setProfileId(new URLSearchParams(window.location.search).get("profile_id"));
    setEditor(getAccessTokenEditor());
  }, []);

  const load = useCallback(async () => {
    if (!profileId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchMacroOverrides(profileId);
      setState({ loading: false, error: null, data: res?.data || null });
    } catch (err) {
      setState({ loading: false, error: err?.message || "Could not load edited macros", data: null });
    }
  }, [profileId]);

  useEffect(() => {
    if (activeTab === "macros") load();
  }, [activeTab, load]);

  const data = state.data;
  const overrides = data?.overrides || [];
  const today = data?.today || new Date().toISOString().slice(0, 10);

  // The one to show: what this week's plan uses, else the next upcoming one.
  const featured = useMemo(() => {
    if (!overrides.length) return null;
    if (data?.applies_to_current_plan_week) {
      const hit = overrides.find((o) => o.id === data.applies_to_current_plan_week);
      if (hit) return hit;
    }
    return (
      overrides
        .filter((o) => o.status === "upcoming")
        .sort((a, b) => (a.valid_from < b.valid_from ? -1 : 1))[0] || null
    );
  }, [overrides, data]);

  const appliesNow = featured && data?.applies_to_current_plan_week === featured.id;

  // Real macros of the test selected on the left (date strip).
  const selectedReal = macroSummaryData?.current_data?.final_macro_summary || null;
  const selectedTestId = macroSummaryData?.current_data?.test_id || null;
  const selectedTestDate = macroSummaryData?.current_data?.date_time || null;

  const realForFeatured = featured?.original_macro_summary || selectedReal;
  const realLabelFeatured = featured?.original_macro_summary ? "Real" : "Test";

  const canEdit = data?.available && !editor?.view_only;

  const openModal = () => {
    setSaveError(null);
    setModalOpen(true);
  };

  const initialValues = useMemo(() => {
    const src = featured?.edited_macro_summary || selectedReal || {};
    return {
      protein_g: src.protein_g ?? "",
      carbs_g: src.carbs_g ?? "",
      fat_g: src.fat_g ?? "",
      fiber_g: src.fiber_g ?? "",
      valid_from: today,
      valid_to: addDays(today, 6),
      note: "",
    };
  }, [featured, selectedReal, today, modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (values) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveMacroOverride(profileId, {
        ...values,
        ...(selectedTestId ? { base_test_id: selectedTestId } : {}),
      });
      setState({ loading: false, error: null, data: res?.data || null });
      setModalOpen(false);
    } catch (err) {
      setSaveError(err?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Remove these edited macros? Diet plans will go back to the test's macros for those dates.")) return;
    setRemovingId(id);
    try {
      const res = await removeMacroOverride(profileId, id);
      setState({ loading: false, error: null, data: res?.data || null });
    } catch (err) {
      window.alert(err?.message || "Could not remove");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="w-[356px] max-2xl:w-full max-2xl:shrink-0 pt-5 pb-5 px-[18px] bg-[#F5F7FA] rounded-[15px] flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[#738298] text-[12px] font-semibold uppercase">Edited macros</p>
        {canEdit ? (
          <button
            type="button"
            onClick={openModal}
            className="px-[11px] py-1 border border-[#E1E6ED] bg-white rounded-[4px] text-[#308BF9] text-[12px] font-semibold cursor-pointer hover:bg-[#F0F6FF]"
          >
            {featured ? "Edit again" : "Edit macros"}
          </button>
        ) : null}
      </div>

      {state.loading && !data ? (
        <p className="text-[#738298] text-[12px] py-4 text-center">Loading…</p>
      ) : state.error ? (
        <p className="text-[#D64545] text-[12px] py-2">{state.error}</p>
      ) : data && !data.available ? (
        <p className="text-[#738298] text-[12px] leading-[140%]">
          Editing macros is not switched on for this server yet.
        </p>
      ) : featured ? (
        <div className="bg-white rounded-[10px] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[#252525] text-[12px] font-semibold">
              {niceDate(featured.valid_from)} – {niceDate(featured.valid_to)}
            </p>
            <StatusChip status={featured.status} />
          </div>
          <p className={`text-[11px] font-semibold ${appliesNow ? "text-[#1E8E4A]" : "text-[#308BF9]"}`}>
            {appliesNow
              ? `Used for this week's diet plan (${niceDate(data.plan_week?.week_start_date)} – ${niceDate(data.plan_week?.week_end_date)})`
              : `Will be used from the plan week that includes ${niceDate(featured.valid_from)}`}
          </p>
          <CompareTable real={realForFeatured} edited={featured.edited_macro_summary} realLabel={realLabelFeatured} />
          {featured.base_test_date ? (
            <p className="text-[#738298] text-[10px]">Real = test of {niceDate(featured.base_test_date)}</p>
          ) : null}
          {featured.note ? (
            <p className="text-[#535359] text-[11px] italic leading-[140%]">&ldquo;{featured.note}&rdquo;</p>
          ) : null}
          <EditorLine who={featured.edited_by} when={featured.created_at ? niceDate(featured.created_at) : null} />
          {canEdit ? (
            <button
              type="button"
              disabled={removingId === featured.id}
              onClick={() => handleRemove(featured.id)}
              className="self-start text-[#D64545] text-[11px] font-semibold cursor-pointer hover:underline disabled:opacity-50"
            >
              {removingId === featured.id ? "Removing…" : "Remove edit"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[#738298] text-[12px] leading-[140%]">
          No edits. The diet plan uses the macros from the client&apos;s latest test.
        </p>
      )}

      {overrides.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="self-start text-[#308BF9] text-[11px] font-semibold cursor-pointer hover:underline"
          >
            {showHistory ? "Hide" : "Show"} all edits ({overrides.length})
          </button>
          {showHistory
            ? overrides.map((o) => (
                <div key={o.id} className="bg-white rounded-[8px] p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[#252525] text-[11px] font-semibold">
                      {niceDate(o.valid_from)} – {niceDate(o.valid_to)}
                    </p>
                    <StatusChip status={o.status} />
                  </div>
                  <p className="text-[#535359] text-[11px]">
                    {FIELDS.map((f) => `${f.label} ${fmt(o.edited_macro_summary[f.key])}g`).join(" · ")} ·{" "}
                    {fmt(o.edited_macro_summary.calories)} kcal
                  </p>
                  {o.original_macro_summary ? (
                    <p className="text-[#738298] text-[10px]">
                      Real: {FIELDS.map((f) => `${f.label} ${fmt(o.original_macro_summary[f.key])}g`).join(" · ")} ·{" "}
                      {fmt(o.original_macro_summary.calories)} kcal
                    </p>
                  ) : null}
                  <EditorLine who={o.edited_by} when={o.created_at ? niceDate(o.created_at) : null} />
                  {o.removed_by ? (
                    <EditorLine verb="Removed by" who={o.removed_by} when={o.removed_at ? niceDate(o.removed_at) : null} />
                  ) : null}
                </div>
              ))
            : null}
        </div>
      ) : null}

      {modalOpen ? (
        <EditModal
          initial={initialValues}
          real={selectedReal}
          realLabel={selectedTestDate ? `Test ${niceDate(selectedTestDate)}` : "Test"}
          editor={editor}
          today={today}
          saving={saving}
          error={saveError}
          onCancel={() => setModalOpen(false)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
