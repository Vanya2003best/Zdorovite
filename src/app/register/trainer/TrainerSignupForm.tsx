"use client";

import { useActionState, useEffect, useState } from "react";
import { registerTrainer, type TrainerSignupState } from "./actions";
import type { SpecializationInfo } from "@/types";

const LANGS = ["Polski", "Angielski", "Niemiecki", "Ukraiński", "Rosyjski", "Hiszpański"];

// Cyrillic → Latin transliteration table (Russian + Ukrainian common chars)
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", ё: "yo", є: "ye",
  ж: "zh", з: "z", и: "i", і: "i", ї: "yi", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h",
  ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (Polish ą,ę,ł,ó,ś,ż etc)
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function TrainerSignupForm({
  specializations,
}: {
  specializations: SpecializationInfo[];
}) {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [selectedSpecs, setSelectedSpecs] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState<TrainerSignupState, FormData>(
    registerTrainer,
    null,
  );

  // Auto-derive slug from display name unless user typed slug
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(displayName));
  }, [displayName, slugTouched]);

  const toggleSpec = (id: string) => {
    setSelectedSpecs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form action={action} className="grid gap-6">
      {/* Account section */}
      <fieldset className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.06em] text-emerald-700 px-2">
          Konto
        </legend>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Hasło</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
          <span className="text-[11px] text-slate-500">Min. 8 znaków.</span>
        </label>
      </fieldset>

      {/* Profile basics */}
      <fieldset className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.06em] text-emerald-700 px-2">
          Twój profil
        </legend>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Imię i nazwisko</span>
          <input
            name="display_name"
            type="text"
            required
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jan Kowalski"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Adres profilu</span>
          <span className="flex items-center gap-2">
            <span className="text-sm text-slate-500 shrink-0">nazdrow.pl/trainers/</span>
            <input
              name="slug"
              type="text"
              required
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              className="flex-1 h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm font-mono"
            />
          </span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Krótki opis (tagline)</span>
          <input
            name="tagline"
            type="text"
            required
            maxLength={120}
            placeholder="Trener siłowy z 5-letnim doświadczeniem"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
          <span className="text-[11px] text-slate-500">Jedno zdanie, które pojawi się w katalogu.</span>
        </label>

        <div>
          <span className="block text-[13px] font-semibold text-slate-700 mb-2.5">
            Specjalizacje <span className="text-slate-400 font-normal">(min. 1)</span>
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {specializations.map((spec) => {
              const active = selectedSpecs.has(spec.id);
              return (
                <label
                  key={spec.id}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${
                    active
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="specializations"
                    value={spec.id}
                    checked={active}
                    onChange={() => toggleSpec(spec.id)}
                    className="sr-only"
                  />
                  <span className="text-lg">{spec.icon}</span>
                  <span className="text-[13px] font-medium text-slate-900">{spec.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">Lata doświadczenia</span>
            <input
              name="experience"
              type="number"
              min={0}
              max={60}
              defaultValue={1}
              className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">Cena od (zł / sesja)</span>
            <input
              name="price_from"
              type="number"
              min={0}
              max={10000}
              step={1}
              defaultValue={100}
              className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
            />
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Lokalizacja</span>
          <input
            name="location"
            type="text"
            required
            autoComplete="address-level2"
            placeholder="Warszawa, Mokotów"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
        </label>

        <div>
          <span className="block text-[13px] font-semibold text-slate-700 mb-2.5">Języki</span>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <label
                key={l}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-slate-200 bg-white hover:border-slate-400 cursor-pointer transition has-[input:checked]:border-emerald-500 has-[input:checked]:bg-emerald-50"
              >
                <input
                  type="checkbox"
                  name={`lang_${l}`}
                  defaultChecked={l === "Polski"}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-[13px] font-medium text-slate-800">{l}</span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
          {state.error}
        </p>
      )}
      {state?.info && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
          {state.info}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[15px] font-semibold shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition disabled:opacity-60"
      >
        {pending ? "Tworzenie konta..." : "Załóż konto trenera"}
      </button>

      <p className="text-[11px] text-slate-500 text-center">
        Po utworzeniu konta wylądujesz w panelu Studio. Domyślne godziny pracy: pn-pt 09:00–18:00, można zmienić później.
      </p>
    </form>
  );
}
