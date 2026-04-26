"use client";

import { useActionState, useState } from "react";
import { becomeTrainer, type BecomeTrainerState } from "./actions";
import type { SpecializationInfo } from "@/types";

const LANGS = ["Polski", "Angielski", "Niemiecki", "Ukraiński", "Rosyjski", "Hiszpański"];

type Existing = {
  slug: string;
  tagline: string;
  about: string;
  experience: number;
  price_from: number;
  location: string;
  languages: string[];
} | null;

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
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function BecomeTrainerForm({
  displayName,
  isTrainer,
  existing,
  existingSpecs,
  specializations,
}: {
  displayName: string;
  isTrainer: boolean;
  existing: Existing;
  existingSpecs: string[];
  specializations: SpecializationInfo[];
}) {
  const [slug, setSlug] = useState(existing?.slug ?? slugify(displayName));
  const [selectedSpecs, setSelectedSpecs] = useState<Set<string>>(new Set(existingSpecs));
  const [state, action, pending] = useActionState<BecomeTrainerState, FormData>(
    becomeTrainer,
    null,
  );

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
      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
          Adres profilu (slug)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 shrink-0">nazdrow.pl/trainers/</span>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="flex-1 h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm font-mono"
            placeholder="jan-kowalski"
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">Tylko małe litery, cyfry i myślniki. Min. 3 znaki.</p>
      </div>

      {/* Tagline */}
      <div>
        <label htmlFor="tagline" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
          Tagline (krótki opis)
        </label>
        <input
          id="tagline"
          name="tagline"
          type="text"
          required
          maxLength={120}
          defaultValue={existing?.tagline ?? ""}
          placeholder="Pomogę Ci schudnąć zdrowo i bez efektu jo-jo"
          className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
        />
        <p className="text-[11px] text-slate-500 mt-1.5">Jedno zdanie, które pojawi się w katalogu. Max 120 znaków.</p>
      </div>

      {/* About */}
      <div>
        <label htmlFor="about" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
          O sobie (opcjonalnie)
        </label>
        <textarea
          id="about"
          name="about"
          rows={5}
          maxLength={2000}
          defaultValue={existing?.about ?? ""}
          placeholder="Kim jesteś, z kim pracujesz, jakie masz podejście, jakie rezultaty osiągają Twoi klienci..."
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm leading-relaxed"
        />
        <p className="text-[11px] text-slate-500 mt-1.5">Można wypełnić teraz lub później.</p>
      </div>

      {/* Specializations */}
      <div>
        <span className="block text-[13px] font-semibold text-slate-700 mb-2.5">
          Specjalizacje <span className="text-slate-400 font-normal">(wybierz 1-3)</span>
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

      {/* Experience + price_from row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="experience" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
            Lata doświadczenia
          </label>
          <input
            id="experience"
            name="experience"
            type="number"
            min={0}
            max={60}
            defaultValue={existing?.experience ?? 1}
            className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
        </div>
        <div>
          <label htmlFor="price_from" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
            Cena od (zł / sesja)
          </label>
          <input
            id="price_from"
            name="price_from"
            type="number"
            min={0}
            max={10000}
            step={1}
            defaultValue={existing?.price_from ?? 100}
            className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="location" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
          Lokalizacja
        </label>
        <input
          id="location"
          name="location"
          type="text"
          required
          defaultValue={existing?.location ?? ""}
          placeholder="Warszawa, Mokotów"
          className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
        />
      </div>

      {/* Languages */}
      <div>
        <span className="block text-[13px] font-semibold text-slate-700 mb-2.5">Języki</span>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => {
            const checked = existing?.languages?.includes(l) ?? l === "Polski";
            return (
              <label
                key={l}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-slate-200 bg-white hover:border-slate-400 cursor-pointer transition has-[input:checked]:border-emerald-500 has-[input:checked]:bg-emerald-50"
              >
                <input
                  type="checkbox"
                  name={`lang_${l}`}
                  defaultChecked={checked}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-[13px] font-medium text-slate-800">{l}</span>
              </label>
            );
          })}
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[15px] font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition disabled:opacity-60"
      >
        {pending ? "Zapisywanie..." : isTrainer ? "Zapisz zmiany" : "Zostań trenerem"}
      </button>

      {!isTrainer && (
        <p className="text-[11px] text-slate-500 text-center">
          Po zapisaniu Twój profil pojawi się w katalogu. Godziny pracy — domyślnie pn-pt 09:00–18:00, można zmienić później.
        </p>
      )}
    </form>
  );
}
