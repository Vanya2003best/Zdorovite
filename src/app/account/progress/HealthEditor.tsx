"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateHealth } from "@/lib/actions/health";
import type { ClientHealth } from "@/lib/db/health";

const FIELDS: Array<{
  key: "height_cm" | "fms_score" | "resting_hr";
  label: string;
  unit: string;
  placeholder: string;
  hint: string;
}> = [
  { key: "height_cm",  label: "Wzrost",        unit: "cm",  placeholder: "np. 182", hint: "51 – 299" },
  { key: "fms_score",  label: "FMS",           unit: "/ 21", placeholder: "np. 14",  hint: "0 – 21" },
  { key: "resting_hr", label: "Tętno spocz.",  unit: "bpm", placeholder: "np. 62",  hint: "21 – 219" },
];

export default function HealthEditor({
  initial,
  latestWeightKg,
}: {
  initial: ClientHealth;
  /** Pulled from client_weight_log so we can render the row even when health is empty. */
  latestWeightKg: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateHealth(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const fmtKg = (kg: number) => `${kg.toFixed(1).replace(".", ",")} kg`;

  if (!editing) {
    return (
      <>
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] m-0">Paszport zdrowia</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11.5px] text-emerald-700 font-medium hover:underline"
          >
            Edytuj
          </button>
        </div>
        {initial.note ? (
          <p className="text-xs text-slate-700 leading-relaxed mb-3">{initial.note}</p>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            Dodaj notatkę o stanie zdrowia (kontuzje, ograniczenia, cele) — Twój trener zobaczy ją przy planowaniu sesji.
          </p>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <Tile label="Waga" value={latestWeightKg !== null ? fmtKg(latestWeightKg) : "—"} />
          <Tile label="Wzrost"       value={initial.heightCm  ? `${initial.heightCm} cm`  : "—"} />
          <Tile label="FMS"          value={initial.fmsScore  !== null ? `${initial.fmsScore} / 21` : "—"} />
          <Tile label="Tętno spocz." value={initial.restingHr ? `${initial.restingHr} bpm` : "—"} />
        </div>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] m-0">Paszport zdrowia</h2>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null); }}
          disabled={pending}
          className="text-[11.5px] text-slate-500 hover:text-slate-700"
        >
          Anuluj
        </button>
      </div>
      <label className="block mb-3">
        <span className="text-[11.5px] text-slate-500 mb-1 block">Notatka (kontuzje, cele, ograniczenia)</span>
        <textarea
          name="note"
          defaultValue={initial.note ?? ""}
          rows={2}
          maxLength={400}
          placeholder="np. ACL prawego kolana, 9 mies. po op. Cel: czerwiec — bieganie."
          className="w-full px-2.5 py-1.5 rounded-[8px] border border-slate-200 text-[12.5px] resize-none outline-none focus:border-emerald-400"
        />
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[11px] text-slate-500 block mb-0.5">{f.label}</span>
            <input
              type="text"
              inputMode="numeric"
              name={f.key}
              defaultValue={
                f.key === "height_cm"  ? initial.heightCm ?? "" :
                f.key === "fms_score"  ? initial.fmsScore ?? "" :
                                         initial.restingHr ?? ""
              }
              placeholder={f.placeholder}
              className="w-full px-2 py-1.5 rounded-[7px] border border-slate-200 text-[12px] outline-none focus:border-emerald-400"
            />
            <span className="text-[10px] text-slate-400 block mt-0.5">{f.unit} · {f.hint}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-[11.5px] text-red-600 mt-2">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full h-9 rounded-[8px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black transition disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : "Zapisz"}
      </button>
      <p className="text-[10.5px] text-slate-400 mt-2 text-center">
        Wagę dodajesz osobno — w karcie pomiarów wagi powyżej.
      </p>
    </form>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-xs font-semibold text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}
