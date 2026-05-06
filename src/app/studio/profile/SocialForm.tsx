"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateSocial } from "./profile-actions";
import { SaveBar } from "./BasicForm";

type Props = {
  instagram: string;
  youtube: string;
  tiktok: string;
  facebook: string;
  website: string;
  phone: string;
  email: string;
};

export default function SocialForm(initial: Props) {
  const router = useRouter();
  const [state, setState] = useState<Props>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = (Object.keys(initial) as (keyof Props)[]).some((k) => state[k] !== initial[k]);

  const liveRef = useRef(state);
  useEffect(() => {
    liveRef.current = state;
  }, [state]);

  const update = (k: keyof Props, v: string) => {
    setState((s) => ({ ...s, [k]: v }));
    setError(null);
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await updateSocial(liveRef.current);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  };

  const handleDiscard = () => {
    setState(initial);
    setError(null);
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">Social i kontakt</h3>
          <p className="text-[12px] text-slate-500 mt-1">
            Pokazane jako ikonki na profilu. Email i telefon zobaczy klient dopiero po pierwszej rezerwacji.
          </p>
        </div>

        <div className="space-y-2">
          <Row icon={<InstagramIcon />} label="Instagram">
            <input
              value={state.instagram}
              maxLength={200}
              onChange={(e) => update("instagram", e.target.value)}
              placeholder="instagram.com/twoje-konto"
              className="px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 w-full"
            />
          </Row>

          <Row icon={<YouTubeIcon />} label="YouTube">
            <input
              value={state.youtube}
              maxLength={200}
              onChange={(e) => update("youtube", e.target.value)}
              placeholder="youtube.com/@twoj-kanal"
              className="px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 w-full"
            />
          </Row>

          <Row icon={<TikTokIcon />} label="TikTok">
            <input
              value={state.tiktok}
              maxLength={200}
              onChange={(e) => update("tiktok", e.target.value)}
              placeholder="tiktok.com/@twoje-konto"
              className="px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 w-full"
            />
          </Row>

          <Row icon={<FacebookIcon />} label="Facebook">
            <input
              value={state.facebook}
              maxLength={200}
              onChange={(e) => update("facebook", e.target.value)}
              placeholder="facebook.com/twoje-konto"
              className="px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 w-full"
            />
          </Row>

          <Row icon={<WebsiteIcon />} label="Strona">
            <input
              value={state.website}
              maxLength={200}
              onChange={(e) => update("website", e.target.value)}
              placeholder="twoja-strona.pl"
              className="px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 w-full"
            />
          </Row>

          <div className="border-t border-slate-100 pt-3 mt-3 space-y-2">
            <Row icon={<PhoneIcon />} label="Telefon">
              <input
                value={state.phone}
                maxLength={40}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+48 123 456 789"
                className="px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 w-full"
              />
            </Row>

            <Row icon={<EmailIcon />} label="Email">
              <input
                value={state.email}
                maxLength={120}
                onChange={(e) => update("email", e.target.value)}
                placeholder="ty@example.com"
                className="px-3 py-2 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 w-full"
              />
            </Row>
          </div>
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

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-2.5 items-center">
      <div className="w-8 h-8 rounded-[8px] bg-slate-50 text-slate-700 flex items-center justify-center" aria-label={label}>
        {icon}
      </div>
      {children}
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.6 6.5a4.4 4.4 0 01-3.5-2.1V14a5.5 5.5 0 11-5.5-5.5h.4v2.6a3 3 0 102.5 3V2h2.6a4.4 4.4 0 003.5 4.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12a10 10 0 10-11.5 9.9v-7H8v-3h2.5V9.5a3.5 3.5 0 013.7-3.8c1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6v1.9h2.7l-.4 3h-2.3v7A10 10 0 0022 12z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92V21a1 1 0 01-1.11 1A19.79 19.79 0 012 4.11 1 1 0 013 3h4.09a1 1 0 011 .75l1 4a1 1 0 01-.27 1L7 10a16 16 0 007 7l1.21-1.82a1 1 0 011-.27l4 1a1 1 0 01.75 1z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}
