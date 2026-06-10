"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfile, signOut } from "./actions";

/**
 * /account/settings — Ustawienia (essentials only).
 *
 * Three sections: Profil (real, editable), Konto (email + sign-out), and
 * Powiadomienia / Język (read-only placeholders explaining current state).
 * Matches the visual style of other /account pages.
 */

export type UstawieniaData = {
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  avatarFocal: string | null;
};

export default function Ustawienia({ data }: { data: UstawieniaData }) {
  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      <div className="mb-3.5">
        <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Ustawienia</h1>
        <div className="text-[12.5px] text-slate-500 mt-1">
          Profil, konto i preferencje
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfileSection data={data} />
        <AccountSection email={data.email} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <NotificationsSection />
        <LanguageSection />
      </div>
    </div>
  );
}

/* ====================== PROFIL ====================== */

function ProfileSection({ data }: { data: UstawieniaData }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(data.displayName);
  const [phone, setPhone] = useState(data.phone ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty = displayName !== data.displayName || (phone || null) !== data.phone;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("display_name", displayName);
    fd.set("phone", phone);
    startTransition(async () => {
      const res = await updateProfile(fd);
      if ("error" in res) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Zapisano." });
      router.refresh();
    });
  };

  const initials = (data.displayName || "K")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card>
      <CardHeader title="Profil" sub="dane podstawowe" />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatarUrl}
              alt=""
              className="w-[64px] h-[64px] rounded-full object-cover shrink-0"
              style={{ objectPosition: data.avatarFocal || "center" }}
            />
          ) : (
            <span className="w-[64px] h-[64px] rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white inline-flex items-center justify-center font-bold text-[20px] shrink-0">
              {initials}
            </span>
          )}
          <div className="text-[12.5px] text-slate-500 leading-[1.5]">
            Zdjęcie profilowe pojawi się przy Twoich opiniach. Zmiana avatara — wkrótce.
          </div>
        </div>

        <Field label="Imię i nazwisko">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            className="w-full h-10 px-3 rounded-[9px] border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
          />
        </Field>

        <Field label="Telefon" hint="opcjonalnie · widoczny tylko dla Twoich trenerów">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="np. +48 600 000 000"
            inputMode="tel"
            maxLength={24}
            className="w-full h-10 px-3 rounded-[9px] border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
          />
        </Field>

        <div className="flex items-center gap-3 mt-1">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="inline-flex items-center h-9 px-4 rounded-[9px] bg-slate-900 text-white text-[13px] font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Zapisuję…" : "Zapisz zmiany"}
          </button>
          {msg && (
            <span
              className={
                "text-[12px] " +
                (msg.kind === "ok" ? "text-emerald-700" : "text-rose-600")
              }
            >
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

/* ====================== KONTO ====================== */

function AccountSection({ email }: { email: string }) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Konto" sub="logowanie i bezpieczeństwo" />

      <div className="flex flex-col gap-3.5">
        <Field label="E-mail" hint="zmiana adresu — napisz do nas na hello@nazdrow.pl">
          <input
            type="email"
            readOnly
            value={email}
            className="w-full h-10 px-3 rounded-[9px] border border-slate-200 bg-slate-50 text-[13px] text-slate-700 cursor-not-allowed"
          />
        </Field>

        <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
          <Link
            href="/login?reset=1"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-[9px] border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:border-slate-300 self-start"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Zmień hasło
          </Link>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirm("Wylogować się?")) return;
              signOut().then(() => router.push("/"));
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-[9px] border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:border-slate-300 self-start"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Wyloguj się
            </button>
          </form>
        </div>
      </div>
    </Card>
  );
}

/* ====================== POWIADOMIENIA ====================== */

function NotificationsSection() {
  return (
    <Card>
      <CardHeader title="Powiadomienia" sub="kanały kontaktu" />
      <div className="flex flex-col gap-2.5">
        <SettingRow
          label="E-mail"
          detail="Potwierdzenia rezerwacji, przypomnienia i wiadomości od trenera"
          state="on"
        />
        <SettingRow
          label="SMS"
          detail="Krytyczne przypomnienia (sesja jutro, anulowanie)"
          state="soon"
        />
        <SettingRow
          label="Push w aplikacji"
          detail="Aplikacja mobilna — wkrótce"
          state="soon"
        />
      </div>
      <p className="text-[11.5px] text-slate-500 mt-3.5 leading-[1.45]">
        Obecnie e-mail jest jedynym aktywnym kanałem. Po wprowadzeniu SMS i push
        będziesz mogła wybrać, które chcesz dostawać.
      </p>
    </Card>
  );
}

/* ====================== JĘZYK ====================== */

function LanguageSection() {
  return (
    <Card>
      <CardHeader title="Język i strefa czasu" sub="ustawienia regionalne" />
      <div className="flex flex-col gap-2.5">
        <SettingRow label="Język interfejsu" detail="Polski" state="locked" />
        <SettingRow label="Strefa czasu" detail="Europa/Warszawa (CET / CEST)" state="locked" />
        <SettingRow label="Format daty" detail="DD MMM YYYY · format polski" state="locked" />
      </div>
      <p className="text-[11.5px] text-slate-500 mt-3.5 leading-[1.45]">
        Język i strefa są na razie ustalone na potrzeby polskich trenerów i klientów.
        Kolejne języki — w planach.
      </p>
    </Card>
  );
}

/* ====================== SHARED ====================== */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-slate-200 rounded-[14px] px-5 py-[18px]">{children}</div>;
}

function CardHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex justify-between items-center mb-3.5">
      <h3 className="text-[14px] font-bold text-slate-900 m-0">{title}</h3>
      {sub && <span className="text-[11px] text-slate-500 font-medium">{sub}</span>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function SettingRow({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "on" | "off" | "locked" | "soon";
}) {
  const tag = (() => {
    if (state === "on") return { label: "Aktywne", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (state === "off") return { label: "Wyłączone", cls: "bg-slate-100 text-slate-600 border-slate-200" };
    if (state === "soon") return { label: "Wkrótce", cls: "bg-amber-50 text-amber-900 border-amber-200" };
    return { label: "Ustawione", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  })();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-dashed border-slate-100 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-slate-900">{label}</div>
        <div className="text-[11.5px] text-slate-500 mt-0.5 leading-[1.4]">{detail}</div>
      </div>
      <span className={`text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[3px] rounded-full border ${tag.cls} shrink-0`}>
        {tag.label}
      </span>
    </div>
  );
}
