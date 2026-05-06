"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { replaceClientGoals, replaceSpecializations } from "./profile-actions";

type Spec = { id: string; label: string; icon: string };

// Coalesce rapid clicks into a single server write — clicks accepted
// instantly via optimistic state; save fires this many ms after the
// last click. 400 ms is short enough to feel "saves on its own" but
// long enough that a 5-chip pick burst goes as one round-trip.
const SAVE_DEBOUNCE_MS = 400;

const GOAL_SUGGESTIONS = [
  "Pierwsze kroki w gym",
  "Powrót po kontuzji",
  "Przygotowanie do zawodów",
  "Postura i mobilność",
  "Trening dla seniorów",
  "Spalanie tłuszczu",
  "Budowanie pewności siebie",
  "Poprawa wydolności",
];

export default function SpecializationsForm({
  allSpecs,
  selected: initialSelected,
  clientGoals: initialGoals,
  suggestionSeed,
}: {
  allSpecs: Spec[];
  selected: string[];
  clientGoals: string[];
  suggestionSeed: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [goals, setGoals] = useState<string[]>(initialGoals);
  const [newGoal, setNewGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Refs hold the freshest values so the debounced save reads the
  // final state — not whatever was current when the timer was set.
  const selectedRef = useRef(selected);
  const goalsRef = useRef(goals);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  const specsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending debounce when the component unmounts so a
  // refresh after navigation doesn't fire on an unmounted form.
  useEffect(() => {
    return () => {
      if (specsTimer.current) clearTimeout(specsTimer.current);
      if (goalsTimer.current) clearTimeout(goalsTimer.current);
    };
  }, []);

  const scheduleSpecsSave = () => {
    if (specsTimer.current) clearTimeout(specsTimer.current);
    specsTimer.current = setTimeout(async () => {
      setSaving(true);
      const res = await replaceSpecializations(selectedRef.current);
      setSaving(false);
      if ("error" in res) setError(res.error);
      else router.refresh();
    }, SAVE_DEBOUNCE_MS);
  };

  const scheduleGoalsSave = () => {
    if (goalsTimer.current) clearTimeout(goalsTimer.current);
    goalsTimer.current = setTimeout(async () => {
      setSaving(true);
      const res = await replaceClientGoals(goalsRef.current);
      setSaving(false);
      if ("error" in res) setError(res.error);
      else router.refresh();
    }, SAVE_DEBOUNCE_MS);
  };

  const toggleSpec = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
    setError(null);
    scheduleSpecsSave();
  };

  const addGoal = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setNewGoal("");
      return;
    }
    if (goals.includes(trimmed)) {
      setNewGoal("");
      return;
    }
    if (goals.length >= 12) {
      setError("Maksymalnie 12 celów.");
      return;
    }
    setGoals((prev) => [...prev, trimmed]);
    setNewGoal("");
    setError(null);
    scheduleGoalsSave();
  };

  const removeGoal = (text: string) => {
    setGoals((prev) => prev.filter((g) => g !== text));
    setError(null);
    scheduleGoalsSave();
  };

  const unusedSuggestions = GOAL_SUGGESTIONS.filter((s) => !goals.includes(s));

  // Tiny "Sugeruj na podstawie bio" — picks specs whose Polish label
  // (lowercased) appears as a substring of the bio. Pure heuristic,
  // doesn't call any AI. The trainer can still toggle manually.
  const suggestFromBio = () => {
    const seed = suggestionSeed.toLowerCase();
    if (!seed) return;
    const hits = allSpecs
      .filter((s) => seed.includes(s.label.toLowerCase()))
      .map((s) => s.id)
      .filter((id) => !selected.includes(id))
      .slice(0, 3);
    if (hits.length === 0) {
      setError("Bio jest puste lub nie zawiera nazw specjalizacji.");
      return;
    }
    setSelected((prev) => [...prev, ...hits]);
    setError(null);
    scheduleSpecsSave();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">Specjalizacje</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                Wpływa na to, w jakich filtrach katalogu się pojawisz. Wybierz 3–6.
              </p>
            </div>
            {saving && (
              <span className="text-[11px] text-slate-400 italic shrink-0 mt-1">
                zapisuję…
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={suggestFromBio}
            className="text-[12.5px] text-emerald-700 font-semibold px-2.5 py-1.5 rounded-[7px] hover:bg-emerald-50"
          >
            Sugeruj na podstawie bio
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allSpecs.map((s) => {
            const isOn = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSpec(s.id)}
                className={
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition " +
                  (isOn
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300")
                }
              >
                <span>{s.icon}</span>
                {s.label}
                {isOn && <span className="text-slate-400 ml-1">×</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="mb-3">
          <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">
            Cele klientów, z którymi pracujesz
          </h3>
          <p className="text-[12px] text-slate-500 mt-1">
            Pojawia się jako badge na profilu i pomaga klientowi szybciej zdecydować.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {goals.map((g) => (
            <span
              key={g}
              className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-[12.5px] font-medium"
            >
              {g}
              <button
                type="button"
                onClick={() => removeGoal(g)}
                className="text-emerald-700/60 hover:text-emerald-900 text-[14px] leading-none"
              >
                ×
              </button>
            </span>
          ))}
          {unusedSuggestions.slice(0, 5).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addGoal(s)}
              className="bg-white text-slate-600 border border-dashed border-slate-300 px-3 py-1.5 rounded-full text-[12.5px] font-medium hover:border-slate-400"
            >
              + {s}
            </button>
          ))}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addGoal(newGoal);
          }}
        >
          <input
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            maxLength={60}
            placeholder="Dodaj własny cel…"
            className="flex-1 px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
          />
          <button
            type="submit"
            disabled={!newGoal.trim()}
            className="text-[13px] font-medium px-3.5 py-2 rounded-[8px] bg-slate-900 text-white disabled:opacity-50"
          >
            Dodaj
          </button>
        </form>
      </div>

      {error && <div className="text-[12px] text-rose-600 bg-rose-50 px-3 py-2 rounded-[8px]">{error}</div>}
    </section>
  );
}
