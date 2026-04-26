"use client";

import { useState, useTransition } from "react";
import { updateAvailability } from "./actions";
import type { DayRule } from "./page";

const DAYS = [
  { dow: 1, label: "Poniedziałek" },
  { dow: 2, label: "Wtorek" },
  { dow: 3, label: "Środa" },
  { dow: 4, label: "Czwartek" },
  { dow: 5, label: "Piątek" },
  { dow: 6, label: "Sobota" },
  { dow: 0, label: "Niedziela" },
];

type DayState = { enabled: boolean; start: string; end: string };

export default function AvailabilityEditor({
  initialByDow,
}: {
  initialByDow: Record<number, DayRule | null>;
}) {
  const [days, setDays] = useState<Record<number, DayState>>(() => {
    const map: Record<number, DayState> = {};
    DAYS.forEach((d) => {
      const r = initialByDow[d.dow];
      map[d.dow] = {
        enabled: r !== null,
        start: r?.start ?? "09:00",
        end: r?.end ?? "18:00",
      };
    });
    return map;
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggleDay = (dow: number) => {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], enabled: !prev[dow].enabled } }));
  };
  const setDayTime = (dow: number, field: "start" | "end", value: string) => {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }));
  };

  const copyToAll = () => {
    const template = days[1]; // Monday
    setDays((prev) => {
      const next: Record<number, DayState> = { ...prev };
      DAYS.forEach((d) => {
        if (d.dow !== 1) next[d.dow] = { ...template };
      });
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateAvailability(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {DAYS.map((d, i) => {
          const state = days[d.dow];
          return (
            <div
              key={d.dow}
              className={`grid grid-cols-[1fr_auto] sm:grid-cols-[180px_1fr] gap-4 sm:gap-6 items-center px-4 sm:px-5 py-4 ${
                i < DAYS.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <label className="inline-flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name={`d${d.dow}_enabled`}
                  checked={state.enabled}
                  onChange={() => toggleDay(d.dow)}
                  className="w-5 h-5 accent-emerald-500"
                />
                <span className={`text-[14px] font-medium ${state.enabled ? "text-slate-900" : "text-slate-400"}`}>
                  {d.label}
                </span>
              </label>
              {state.enabled ? (
                <div className="inline-flex items-center gap-2 justify-end sm:justify-start">
                  <input
                    type="time"
                    name={`d${d.dow}_start`}
                    value={state.start}
                    onChange={(e) => setDayTime(d.dow, "start", e.target.value)}
                    className="h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-sm font-mono"
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="time"
                    name={`d${d.dow}_end`}
                    value={state.end}
                    onChange={(e) => setDayTime(d.dow, "end", e.target.value)}
                    className="h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-sm font-mono"
                  />
                </div>
              ) : (
                <span className="text-[13px] text-slate-400 text-right sm:text-left">Wolne</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={copyToAll}
          className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-slate-400 transition"
        >
          Skopiuj godziny z poniedziałku na wszystkie dni
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-[13px] text-emerald-700 font-medium inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              </span>
              Zapisano
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="h-11 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition disabled:opacity-60"
          >
            {pending ? "Zapisywanie..." : "Zapisz godziny"}
          </button>
        </div>
      </div>
    </form>
  );
}
