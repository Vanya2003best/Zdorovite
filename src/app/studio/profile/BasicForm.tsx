"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateProfileBasic } from "./profile-actions";

const MAX_BIO = 600;
const MAX_TAGLINE = 200;
const MAX_MISSION = 200;

type Props = {
  avatarUrl: string | null;
  avatarFocal: string | null;
  displayName: string;
  email: string;
  tagline: string;
  about: string;
  mission: string;
  location: string;
  avatarSlot: ReactNode;
};

export default function BasicForm({
  displayName: initialDisplayName,
  email,
  tagline: initialTagline,
  about: initialAbout,
  mission: initialMission,
  location,
  avatarSlot,
}: Props) {
  const router = useRouter();

  const initial = {
    displayName: initialDisplayName,
    tagline: initialTagline,
    about: initialAbout,
    mission: initialMission,
  };

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [tagline, setTagline] = useState(initialTagline);
  const [about, setAbout] = useState(initialAbout);
  const [mission, setMission] = useState(initialMission);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    displayName !== initial.displayName ||
    tagline !== initial.tagline ||
    about !== initial.about ||
    mission !== initial.mission;

  // Track most recent dirty values via a ref so we can guard against
  // stale-closure saves when the user clicks Zapisz right after typing.
  const liveRef = useRef({ displayName, tagline, about, mission });
  useEffect(() => {
    liveRef.current = { displayName, tagline, about, mission };
  }, [displayName, tagline, about, mission]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await updateProfileBasic(liveRef.current);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  };

  const handleDiscard = () => {
    setDisplayName(initial.displayName);
    setTagline(initial.tagline);
    setAbout(initial.about);
    setMission(initial.mission);
    setError(null);
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">Profil podstawowy</h3>
          <p className="text-[12px] text-slate-500 mt-1">
            Zdjęcie, imię, krótkie bio i misja — najczęściej oglądana sekcja.
          </p>
        </div>

        <div className="flex gap-5 items-center">
          {/* Avatar (component injected so server-side actions stay attached) */}
          <div className="shrink-0">{avatarSlot}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-semibold tracking-[-0.015em] truncate">
              {displayName || "Bez nazwy"}
            </div>
            <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{email}</div>
            <div className="text-[12px] text-slate-700 mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {location}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                JPG / PNG / WebP, max 5 MB
              </span>
            </div>
          </div>
        </div>

        <div className="h-5" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Imię i nazwisko">
            <input
              value={displayName}
              maxLength={80}
              onChange={(e) => setDisplayName(e.target.value)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </Field>
          <Field
            label="Tagline"
            hint="(jedna linia, pokazuje się pod imieniem na profilu)"
          >
            <input
              value={tagline}
              maxLength={MAX_TAGLINE}
              onChange={(e) => setTagline(e.target.value)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </Field>

          <Field label="O mnie" hint={`Markdown · ${MAX_BIO} znaków`} full>
            <textarea
              value={about}
              maxLength={MAX_BIO + 200}
              onChange={(e) => setAbout(e.target.value)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 min-h-[110px] leading-[1.5] resize-y"
            />
            <div
              className={
                "text-[11px] text-right mt-1 " +
                (about.length > MAX_BIO ? "text-rose-600" : "text-slate-500")
              }
            >
              {about.length} / {MAX_BIO}
            </div>
          </Field>

          <Field label="Misja" hint="krótkie zdanie, pokazuje się jako cytat" full>
            <input
              value={mission}
              maxLength={MAX_MISSION}
              onChange={(e) => setMission(e.target.value)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              placeholder="Np. „Nie ma magicznych planów. Jest konsekwencja."
            />
          </Field>
        </div>
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={"grid gap-1.5 " + (full ? "md:col-span-2" : "")}>
      <span className="text-[12px] font-semibold text-slate-700">
        {label}
        {hint && <span className="text-[11px] text-slate-500 font-normal ml-1.5">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function SaveBar({
  dirty,
  saving,
  savedAt,
  error,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  // Tick "X min temu" once a minute so the savedAt label stays fresh.
  const [, force] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [savedAt]);

  if (!dirty && !saving && !error) {
    return savedAt ? (
      <div className="text-[12px] text-slate-500 mt-3 px-1">
        Zapisano {formatRelative(savedAt)}.
      </div>
    ) : null;
  }

  return (
    <div className="sticky bottom-4 z-30 mt-4 rounded-[12px] bg-slate-900 text-white px-4 py-3 flex flex-wrap gap-3 items-center justify-between shadow-[0_12px_40px_rgba(2,6,23,0.25)]">
      <div className="text-[13px] flex items-center gap-2.5">
        <span
          className={
            "w-2 h-2 rounded-full " +
            (error ? "bg-rose-400" : saving ? "bg-emerald-400 animate-pulse" : "bg-amber-400")
          }
        />
        {error ? (
          <span className="text-rose-200">Błąd: {error}</span>
        ) : saving ? (
          "Zapisuję…"
        ) : dirty ? (
          <>
            Niezapisane zmiany
            {savedAt && (
              <span className="text-slate-400">· ostatnio zapisano {formatRelative(savedAt)}</span>
            )}
          </>
        ) : (
          "Zapisano"
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || saving}
          className="text-[13px] font-semibold px-3.5 py-2 rounded-lg bg-transparent border border-white/20 text-white disabled:opacity-50"
        >
          Odrzuć
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="text-[13px] font-semibold px-3.5 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-50"
        >
          Zapisz zmiany
        </button>
      </div>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 60_000);
  if (diff < 1) return "przed chwilą";
  if (diff < 60) return `${diff} min temu`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h} godz. temu`;
  return new Date(ts).toLocaleDateString("pl-PL");
}
