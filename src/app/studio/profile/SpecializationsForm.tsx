"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replaceClientGoals, replaceSpecializations } from "./profile-actions";

type Spec = { id: string; label: string; icon: string };

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
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [goals, setGoals] = useState<string[]>(initialGoals);
  const [newGoal, setNewGoal] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleSpec = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    setSelected(next);
    setError(null);
    startTransition(async () => {
      const res = await replaceSpecializations(next);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const addGoal = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || goals.includes(trimmed)) {
      setNewGoal("");
      return;
    }
    if (goals.length >= 12) {
      setError("Maksymalnie 12 celów.");
      return;
    }
    const next = [...goals, trimmed];
    setGoals(next);
    setNewGoal("");
    setError(null);
    startTransition(async () => {
      const res = await replaceClientGoals(next);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const removeGoal = (text: string) => {
    const next = goals.filter((g) => g !== text);
    setGoals(next);
    setError(null);
    startTransition(async () => {
      const res = await replaceClientGoals(next);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
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
    const next = [...selected, ...hits];
    setSelected(next);
    setError(null);
    startTransition(async () => {
      const res = await replaceSpecializations(next);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">Specjalizacje</h3>
            <p className="text-[12px] text-slate-500 mt-1">
              Wpływa na to, w jakich filtrach katalogu się pojawisz. Wybierz 3–6.
            </p>
          </div>
          <button
            type="button"
            onClick={suggestFromBio}
            className="text-[12.5px] text-emerald-700 font-semibold px-2.5 py-1.5 rounded-[7px] hover:bg-emerald-50 disabled:opacity-50"
            disabled={pending}
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
                disabled={pending}
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
                disabled={pending}
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
              disabled={pending}
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
            disabled={pending || !newGoal.trim()}
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
