"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAbout } from "./profile-actions";
import { SaveBar } from "./BasicForm";

const MIN_BIO = 200;
const MAX_BIO = 600;
const MAX_MISSION = 200;

/**
 * "O mnie" section — bio text + mission quote, split out of the old
 * BasicForm so the left-column sections of the two-pane editor mirror
 * the public-profile order. Same SaveBar pattern as its siblings;
 * writes via updateProfileAbout (disjoint fields — no clobbering
 * with the identity form).
 */
export default function AboutForm({
  about: initialAbout,
  mission: initialMission,
}: {
  about: string;
  mission: string;
}) {
  const router = useRouter();

  const initial = { about: initialAbout, mission: initialMission };

  const [about, setAbout] = useState(initialAbout);
  const [mission, setMission] = useState(initialMission);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = about !== initial.about || mission !== initial.mission;

  const liveRef = useRef({ about, mission });
  useEffect(() => {
    liveRef.current = { about, mission };
  }, [about, mission]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await updateProfileAbout(liveRef.current);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  };

  const handleDiscard = () => {
    setAbout(initial.about);
    setMission(initial.mission);
    setError(null);
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4">
          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-slate-700">
              O mnie
              <span className="text-[11px] text-slate-500 font-normal ml-1.5">
                · Markdown · {MIN_BIO}–{MAX_BIO} znaków
              </span>
            </span>
            <textarea
              value={about}
              maxLength={MAX_BIO + 200}
              onChange={(e) => setAbout(e.target.value)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 min-h-[140px] leading-[1.5] resize-y"
            />
            <div
              className={
                "text-[11px] text-right " +
                (about.length > MAX_BIO
                  ? "text-rose-600"
                  : about.length >= MIN_BIO
                    ? "text-emerald-600"
                    : "text-slate-500")
              }
            >
              {about.length} / {MAX_BIO}
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-slate-700">
              Misja
              <span className="text-[11px] text-slate-500 font-normal ml-1.5">
                · krótkie zdanie, pokazuje się jako cytat
              </span>
            </span>
            <input
              value={mission}
              maxLength={MAX_MISSION}
              onChange={(e) => setMission(e.target.value)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              placeholder="Np. „Nie ma magicznych planów. Jest konsekwencja."
            />
          </label>
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
