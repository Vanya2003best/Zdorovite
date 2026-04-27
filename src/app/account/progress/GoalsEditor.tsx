"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveGoal, createGoal, updateGoalCurrent } from "@/lib/actions/goals";
import type { Goal } from "@/lib/db/goals";

const PL_MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

function fmtTargetDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${PL_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export default function GoalsEditor({ initialGoals }: { initialGoals: Goal[] }) {
  return (
    <div className="grid">
      {initialGoals.length === 0 && <NoGoalsHint />}
      {initialGoals.map((g) => (
        <GoalRow key={g.id} goal={g} />
      ))}
      <NewGoalForm />
    </div>
  );
}

function NoGoalsHint() {
  return (
    <p className="text-xs text-slate-500 leading-relaxed mb-2">
      Nie masz jeszcze celów. Dodaj pierwszy poniżej — śledzenie postępu działa dla każdego celu z liczbową wartością („Schudnąć do 78 kg", „5 km biegu", „6 podciągnięć"…).
    </p>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fmtNumber(goal.currentValue));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const pct = Math.round(goal.pct * 100);
  const onSave = () => {
    setError(null);
    const n = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(n)) {
      setError("Niepoprawna liczba.");
      return;
    }
    startTransition(async () => {
      const res = await updateGoalCurrent(goal.id, n);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onArchive = () => {
    if (!window.confirm(`Zarchiwizować cel „${goal.title}"?`)) return;
    startTransition(async () => {
      const res = await archiveGoal(goal.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex justify-between items-baseline mb-1.5 text-[12.5px] gap-3">
        <span className="font-semibold flex-1 truncate">{goal.title}</span>
        <span className="text-emerald-700 font-semibold shrink-0">{pct}%</span>
        <button
          type="button"
          onClick={onArchive}
          disabled={pending}
          aria-label="Zarchiwizuj cel"
          className="text-slate-400 hover:text-slate-700 transition disabled:opacity-50"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="h-1 bg-slate-100 rounded overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-500 gap-2">
        <span className="truncate">
          {goal.targetDate ? `Cel: ${fmtTargetDate(goal.targetDate)}` : ""}
          {goal.targetDate && goal.note ? " · " : ""}
          {goal.note ?? ""}
        </span>
        <span className="shrink-0 inline-flex items-center gap-1.5">
          {editing ? (
            <>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-[11px] text-slate-900 outline-none focus:border-emerald-400 text-right"
              />
              <span className="text-slate-400">{goal.unit ?? ""}</span>
              <button
                type="button"
                onClick={onSave}
                disabled={pending}
                className="text-emerald-700 font-semibold hover:underline disabled:opacity-50"
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setValue(fmtNumber(goal.currentValue)); }}
                disabled={pending}
                className="text-slate-500 hover:text-slate-700"
              >
                Anuluj
              </button>
            </>
          ) : (
            <>
              <span>
                {fmtNumber(goal.currentValue)}
                {goal.unit ? ` ${goal.unit}` : ""} / {fmtNumber(goal.targetValue)}
                {goal.unit ? ` ${goal.unit}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-emerald-700 font-medium hover:underline"
              >
                Edytuj
              </button>
            </>
          )}
        </span>
      </div>
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function NewGoalForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [start, setStart] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const reset = () => {
    setTitle(""); setUnit(""); setStart(""); setTarget(""); setDate("");
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const s = parseFloat(start.replace(",", "."));
    const t = parseFloat(target.replace(",", "."));
    if (!title.trim()) { setError("Tytuł jest wymagany."); return; }
    if (!Number.isFinite(s) || !Number.isFinite(t)) { setError("Wartości muszą być liczbami."); return; }
    startTransition(async () => {
      const res = await createGoal({
        title,
        unit: unit.trim() || undefined,
        startValue: s,
        targetValue: t,
        targetDate: date || undefined,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-emerald-700 font-medium hover:underline self-start"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Dodaj cel
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 p-3 border border-slate-200 rounded-[10px] bg-slate-50 grid gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tytuł celu (np. Schudnąć do 78 kg)"
        maxLength={120}
        required
        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-[8px] text-[12.5px] outline-none focus:border-emerald-400"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="Start"
          required
          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-[8px] text-[12.5px] outline-none focus:border-emerald-400"
        />
        <input
          type="text"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Cel"
          required
          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-[8px] text-[12.5px] outline-none focus:border-emerald-400"
        />
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Jednostka (kg, km…)"
          maxLength={20}
          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-[8px] text-[12.5px] outline-none focus:border-emerald-400"
        />
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-[8px] text-[12.5px] outline-none focus:border-emerald-400"
      />
      {error && <p className="text-[11.5px] text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); }}
          disabled={pending}
          className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-slate-700 hover:bg-slate-100 transition"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 rounded-[8px] bg-slate-900 text-white text-[12px] font-semibold hover:bg-black transition disabled:opacity-50"
        >
          {pending ? "..." : "Dodaj cel"}
        </button>
      </div>
    </form>
  );
}
