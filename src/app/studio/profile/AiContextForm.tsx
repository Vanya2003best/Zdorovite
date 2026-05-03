"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAiContextField, type AiContext } from "./ai-context-actions";

type FieldDef = {
  key: keyof AiContext;
  label: string;
  hint: string;
  placeholder: string;
};

const FIELDS: FieldDef[] = [
  {
    key: "background",
    label: "Twoja historia / wykształcenie",
    hint: "Skąd przyszedłeś do treningu, jakie kursy/studia, ile lat realnej praktyki, ważne momenty kariery.",
    placeholder:
      "Np. Trener osobisty od 6 lat. Skończyłem AWF Warszawa, specjalizacja trener osobisty. Wcześniej zawodowo grałem w piłkę. Pracowałem 3 lata w sieciówce, ostatnie 2 lata prowadzę własne studio na Mokotowie.",
  },
  {
    key: "targetAudience",
    label: "Grupa docelowa — kim są Twoi klienci",
    hint: "Wiek, etap życia, co chcą osiągnąć, czego się boją. Im konkretniej, tym lepszy będzie marketing.",
    placeholder:
      "Np. Kobiety 30-50 po ciąży, które chcą wrócić do formy bez przeciążania pleców. Najczęściej pracują biurowo, mało czasu, dużo stresu. Nie lubią siłowni — preferują kameralne studio + plan w domu.",
  },
  {
    key: "methodology",
    label: "Metoda — jak wygląda współpraca",
    hint: "Etapy: pierwsza konsultacja, ocena, plan, częstotliwość, kontakt poza sesjami, mierzenie postępu.",
    placeholder:
      "Np. Zaczynamy od bezpłatnej 30-min konsultacji + ocena postawy. W pierwszym miesiącu dwa razy w tygodniu na sali — uczę techniki. Potem 1×/tydz + plan domowy. Pomiary co 4 tygodnie, kontakt na WhatsApp 6 dni.",
  },
  {
    key: "differentiators",
    label: "Czym się wyróżniasz",
    hint: "Co masz innego niż 100 trenerów obok? Konkrety, nie hasła.",
    placeholder:
      "Np. Diagnostyka FMS przed startem (rzadko kto to robi). Plan domowy z wideo do każdego ćwiczenia. Bez „magicznych” diet — tylko co naprawdę działa. Klient ma stały kontakt ze mną, nie z botem.",
  },
  {
    key: "tonePreference",
    label: "Styl komunikacji",
    hint: "Jaki ton ma mieć tekst na stronie — surowy/wymagający, ciepły/wspierający, racjonalny/metodyczny, premium/profesjonalny? AI dopasuje pod ten styl wszystkie sekcje.",
    placeholder:
      "Np. Ciepły, wspierający, ale konkretny. Bez frazesów typu „spełnij swoje marzenia”. Liczby i fakty zamiast emocji. Nie używaj wielkich słów, mów po ludzku.",
  },
];

export default function AiContextForm({ initial }: { initial: AiContext }) {
  const router = useRouter();
  const [values, setValues] = useState<AiContext>(initial);
  const [pending, startTransition] = useTransition();
  const [savedField, setSavedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filledCount = FIELDS.filter((f) => (values[f.key] ?? "").trim().length > 0).length;
  const totalCount = FIELDS.length;
  const allFilled = filledCount === totalCount;

  const onCommit = (key: keyof AiContext, value: string) => {
    if ((initial[key] ?? "") === value) return; // no change
    setError(null);
    startTransition(async () => {
      const res = await updateAiContextField(key, value);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSavedField(key);
      setTimeout(() => setSavedField(null), 1500);
      router.refresh();
    });
  };

  return (
    <section className="bg-gradient-to-b from-violet-50 to-white border-2 border-violet-200 rounded-2xl p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700 mb-1.5">
            ✨ Kontekst AI
          </div>
          <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-slate-900 m-0">
            Wypełnij to raz — AI zaprojektuje Ci całą stronę
          </h2>
          <p className="text-[13.5px] text-slate-600 mt-1.5 max-w-[640px] leading-relaxed">
            Im więcej powiesz nam o sobie i swoich klientach, tym lepiej AI
            napisze opis „O mnie”, dobierze usługi i pakiety, dopasuje ton.
            Każde pole zapisuje się automatycznie po wyjściu z niego.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[26px] font-semibold tracking-tight text-violet-700">
            {filledCount}/{totalCount}
          </div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
            {allFilled ? "Komplet" : "Wypełnione"}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {FIELDS.map((f) => {
          const value = values[f.key] ?? "";
          const filled = value.trim().length > 0;
          return (
            <div
              key={f.key}
              className={`bg-white rounded-xl border p-4 transition ${
                filled ? "border-violet-300" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <label className="text-[14.5px] font-semibold text-slate-900">
                  {f.label}
                </label>
                {savedField === f.key ? (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    ✓ zapisano
                  </span>
                ) : filled ? (
                  <span className="text-[11px] text-violet-700 font-medium inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    Wypełnione
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Pusto</span>
                )}
              </div>
              <p className="text-[12.5px] text-slate-500 mb-2.5 leading-relaxed">
                {f.hint}
              </p>
              <textarea
                value={value}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
                onBlur={(e) => onCommit(f.key, e.target.value.trim())}
                disabled={pending}
                rows={5}
                placeholder={f.placeholder}
                className="w-full text-[14px] leading-[1.55] p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-400 resize-vertical bg-white min-h-[120px]"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-[12.5px] text-slate-600 leading-relaxed">
        Po zapisaniu pól idź do{" "}
        <a
          href="/studio/design"
          className="text-violet-700 font-medium underline-offset-4 hover:underline"
        >
          /studio/design
        </a>{" "}
        i kliknij <strong>✨ Przepisz AI</strong> nad sekcją „O mnie”,
        „Usługi” lub „Pakiety”. AI użyje tego kontekstu, żeby dopasować
        tekst do Twojego stylu i klientów.
      </div>
    </section>
  );
}
