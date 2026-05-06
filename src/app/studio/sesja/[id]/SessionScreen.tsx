"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSessionNotes, markSessionCompleted } from "../actions";
import { markBookingPaid, type PaymentMethod } from "../../finanse/actions";

type SessionData = {
  id: string;
  startTime: string;
  endTime: string | null;
  status: string;
  serviceName: string;
  servicePrice: number;
  paymentStatus: string | null;
  sessionNotes: string | null;
  client: {
    profileId: string | null;
    displayName: string;
    avatarUrl: string | null;
    avatarFocal: string | null;
    /** From trainer_clients — null if we have no roster entry yet. */
    rosterId: string | null;
    goal: string | null;
    tags: string[];
    clientNotes: string | null;
  };
  pastSessions: {
    id: string;
    startTime: string;
    serviceName: string;
    sessionNotes: string | null;
  }[];
};

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "blik", label: "BLIK" },
  { id: "cash", label: "Gotówka" },
  { id: "transfer", label: "Przelew" },
  { id: "package", label: "Pakiet" },
  { id: "platform", label: "NaZdrow!" },
];

/**
 * Session-w-trakcie screen. Mobile-first — trainer is in the gym holding
 * their phone. Three states drive the bottom CTA:
 *
 *   1. status == 'confirmed' / 'pending' / 'paid' (pre-completion):
 *      → "Zakończ sesję" big green button
 *   2. status == 'completed' AND payment_status == 'pending':
 *      → method picker (BLIK / Gotówka / Pakiet / NaZdrow! / Przelew)
 *   3. status == 'completed' AND payment_status == 'paid':
 *      → "Zakończone i opłacone ✓" + link back to Pulpit
 *
 * Notes textarea auto-saves on blur. Past sessions feed into a small
 * collapsible at the bottom so trainer can quickly recall what worked
 * last time without leaving this screen.
 */
export default function SessionScreen({ session }: { session: SessionData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(session.sessionNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const onNotesBlur = () => {
    if (notes === (session.sessionNotes ?? "")) return;
    setError(null);
    startTransition(async () => {
      const res = await saveSessionNotes(session.id, notes);
      if ("error" in res) setError(res.error);
    });
  };

  const onComplete = () => {
    setError(null);
    startTransition(async () => {
      // Save any unsaved notes first.
      if (notes !== (session.sessionNotes ?? "")) {
        const noteRes = await saveSessionNotes(session.id, notes);
        if ("error" in noteRes) {
          setError(noteRes.error);
          return;
        }
      }
      const res = await markSessionCompleted(session.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onPay = (method: PaymentMethod) => {
    setError(null);
    startTransition(async () => {
      const res = await markBookingPaid(session.id, method);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const isCompleted = session.status === "completed";
  const isPaid = session.paymentStatus === "paid";
  const sessionTime = formatSessionTime(session.startTime);

  return (
    <div className="mx-auto max-w-[640px] px-4 sm:px-6 py-5 sm:py-8 grid gap-4 pb-32">
      {/* Breadcrumb */}
      <Link
        href="/studio"
        className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 transition w-fit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Wróć do pulpitu
      </Link>

      {/* Hero — client + time */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-[22px] shrink-0 overflow-hidden">
            {session.client.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.client.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{ objectPosition: session.client.avatarFocal || "center" }}
              />
            ) : (
              (session.client.displayName || "?").charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-tight text-slate-900 m-0 truncate">
              {session.client.displayName}
            </h1>
            <p className="text-[13px] text-slate-600 m-0 mt-0.5">
              {sessionTime} · {session.serviceName}
            </p>
            {session.client.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {session.client.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="text-[10.5px] tracking-[0.04em] uppercase font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-px rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          {session.client.rosterId && (
            <Link
              href={`/studio/klienci/${session.client.rosterId}`}
              className="text-[12.5px] text-slate-700 hover:text-slate-900 underline-offset-2 hover:underline"
            >
              Karta klienta →
            </Link>
          )}
        </div>
      </div>

      {/* Goal + client notes (read-only — edit in /studio/klienci/[id]) */}
      {(session.client.goal || session.client.clientNotes) && (
        <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-4 grid gap-2">
          {session.client.goal && (
            <div>
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-emerald-700 mb-0.5">
                Cel
              </div>
              <div className="text-[14px] text-slate-900">🎯 {session.client.goal}</div>
            </div>
          )}
          {session.client.clientNotes && (
            <div>
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-emerald-700 mb-0.5">
                Notatki o kliencie
              </div>
              <div className="text-[12.5px] text-slate-700 whitespace-pre-wrap leading-[1.5]">
                {session.client.clientNotes}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session notes — the main work surface */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-[12.5px] font-semibold tracking-[0.08em] uppercase text-slate-500 m-0 mb-3">
          Notatki z dzisiejszej sesji
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onNotesBlur}
          placeholder="Przysiad 4×8 80 kg · martwy 3×5 110 kg · forma OK, zmęczenie ok 7/10. Następnym razem +5 kg w przysiadzie."
          maxLength={4000}
          rows={6}
          className="w-full text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 resize-vertical leading-[1.5]"
          autoFocus={!isCompleted}
        />
        <p className="text-[11px] text-slate-400 mt-1.5 m-0">
          {notes.length} / 4000 · zapisuje się automatycznie po wyjściu z pola
        </p>
      </div>

      {/* History collapsible */}
      <details
        open={showHistory}
        onToggle={(e) => setShowHistory((e.target as HTMLDetailsElement).open)}
        className="bg-white rounded-2xl border border-slate-200"
      >
        <summary className="cursor-pointer px-5 py-3.5 text-[13px] font-medium text-slate-700 flex items-center justify-between">
          <span>
            Poprzednie sesje
            {session.pastSessions.length > 0 && (
              <span className="text-slate-400 ml-1.5">({session.pastSessions.length})</span>
            )}
          </span>
          <svg
            className={`text-slate-400 transition ${showHistory ? "rotate-180" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        {showHistory && (
          <div className="px-5 pb-5 grid gap-2.5">
            {session.pastSessions.length === 0 ? (
              <p className="text-[12.5px] text-slate-500 m-0">
                To pierwsza sesja z tym klientem.
              </p>
            ) : (
              session.pastSessions.map((p) => (
                <div key={p.id} className="border-l-2 border-emerald-300 pl-3">
                  <div className="text-[12px] text-slate-500">
                    {formatSessionTime(p.startTime)} · {p.serviceName}
                  </div>
                  {p.sessionNotes ? (
                    <p className="text-[13px] text-slate-700 mt-0.5 m-0 leading-[1.5] whitespace-pre-wrap line-clamp-4">
                      {p.sessionNotes}
                    </p>
                  ) : (
                    <p className="text-[12px] text-slate-400 italic mt-0.5 m-0">
                      Bez notatek
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </details>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Bottom action bar — sticky on mobile so the CTA is always reachable */}
      <div className="fixed bottom-0 left-0 right-0 sm:static bg-white border-t border-slate-200 sm:border-0 sm:bg-transparent px-4 py-3 sm:p-0 sm:mt-2 z-10">
        <div className="max-w-[640px] mx-auto">
          {!isCompleted ? (
            <button
              type="button"
              onClick={onComplete}
              disabled={pending}
              className="w-full h-14 rounded-2xl bg-emerald-600 text-white text-[15px] font-semibold hover:bg-emerald-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {pending ? "Kończę..." : "Zakończ sesję"}
            </button>
          ) : !isPaid ? (
            <div className="grid gap-2">
              <div className="text-[12.5px] font-semibold tracking-[0.06em] uppercase text-slate-600 text-center">
                Sesja zakończona — wybierz metodę płatności
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={pending}
                    onClick={() => onPay(m.id)}
                    className="h-12 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[11.5px] text-slate-500 text-center mt-1">
                Suma: {session.servicePrice} zł
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-center">
              <div className="text-[14px] font-semibold text-emerald-800">
                ✓ Sesja zakończona i opłacona
              </div>
              <Link
                href="/studio"
                className="text-[12.5px] text-emerald-700 hover:underline mt-1 inline-block"
              >
                Wróć do pulpitu →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `dziś ${time}`;
  if (diff === 1) return `wczoraj ${time}`;
  if (diff === -1) return `jutro ${time}`;
  if (diff > 0 && diff < 7) return `${diff} dni temu`;
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: target.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }) + " " + time;
}
