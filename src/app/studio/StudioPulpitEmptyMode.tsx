import Link from "next/link";

/**
 * Pulpit · Empty/onboarding mode (design 42, m-empty).
 *
 * Shown on Day 1 when the trainer just signed up — no services, no
 * bookings, profile incomplete. The point is to lead them through the
 * 3 onboarding steps and surface "good practices on start" copy.
 *
 * Real signals wired:
 *   - displayName    — for the greeting
 *   - profilePct     — for the progress bar (0–100)
 *   - onboardingDone — { profile, services, availability } booleans
 * Everything else (specific tips copy, support-card text) is static.
 */
export default function StudioPulpitEmptyMode({
  displayName,
  profilePct,
  onboardingDone,
}: {
  displayName: string;
  profilePct: number;
  onboardingDone: { profile: boolean; services: boolean; availability: boolean };
}) {
  const stepsDone = Number(onboardingDone.profile) + Number(onboardingDone.services) + Number(onboardingDone.availability);
  const totalSteps = 3;
  const progress = Math.round((stepsDone / totalSteps) * 100);

  return (
    <section className="bg-slate-50 py-5">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 grid gap-5">
        {/* PAGE HEAD */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="m-0 text-[26px] text-[#002f34] font-extrabold tracking-[-0.025em]">
              Witaj na pokładzie, {displayName}! 👋
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 m-0">
              Twoje konto NaZdrow! jest gotowe. Jeszcze {totalSteps - stepsDone} {totalSteps - stepsDone === 1 ? "krok" : "kroki"} i ruszamy z klientami.
            </p>
          </div>
          <button type="button" className="px-4 py-2.5 rounded-[7px] bg-white border border-slate-300 text-[#002f34] text-[13px] font-bold hover:bg-slate-50 transition">
            Obejrzyj tutorial (3 min)
          </button>
        </div>

        {/* HERO — dark teal panel with progress + checklist */}
        <div className="relative overflow-hidden rounded-2xl p-7 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-7 items-center text-white" style={{ background: "linear-gradient(135deg, #002f34 0%, #004a52 100%)" }}>
          {/* Decorative radial accent */}
          <span
            className="absolute -right-24 -top-24 w-[360px] h-[360px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(217,119,87,0.35) 0%, transparent 70%)" }}
          />
          <div className="relative z-10">
            <h2 className="m-0 mb-1.5 text-[22px] tracking-[-0.015em] font-bold">
              Zacznij od konfiguracji profilu
            </h2>
            <p className="m-0 mb-4 text-white/80 text-[14px] leading-relaxed max-w-[580px]">
              Im pełniej uzupełnisz profil, tym wyżej pokażesz się w wynikach wyszukiwania. Trenerzy z kompletnym profilem dostają średnio <b className="text-white font-bold">4× więcej</b> wiadomości w pierwszym tygodniu.
            </p>
            <div className="bg-white/10 h-2 rounded-md overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-md" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[12px] text-white/70">
              <b className="text-white font-bold">{stepsDone} z {totalSteps} kroków</b> · profil w {profilePct}% · pozostało ~{Math.max(5, (totalSteps - stepsDone) * 5)} min
            </div>
          </div>
          <div className="relative z-10 flex flex-col gap-2">
            <ChecklistItem done label="Załóż konto" />
            <ChecklistItem done={onboardingDone.profile} now={!onboardingDone.profile} label="Uzupełnij profil zawodowy" />
            <ChecklistItem done={onboardingDone.services} now={onboardingDone.profile && !onboardingDone.services} label="Dodaj pierwszą usługę" />
            <ChecklistItem done={onboardingDone.availability} now={onboardingDone.services && !onboardingDone.availability} label="Ustaw godziny pracy" />
          </div>
        </div>

        {/* 3 onboarding cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          <OnboardingCard
            n={1}
            now={!onboardingDone.profile}
            done={onboardingDone.profile}
            title="Uzupełnij profil zawodowy"
            body="Zdjęcie, opis, certyfikaty, doświadczenie — to widzą klienci."
            cta={onboardingDone.profile ? "Edytuj profil" : "Dokończ profil →"}
            href="/studio/profile"
          />
          <OnboardingCard
            n={2}
            now={onboardingDone.profile && !onboardingDone.services}
            done={onboardingDone.services}
            title="Dodaj swoje usługi"
            body="Stworzymy z Tobą Twoją pierwszą usługę — cena, czas, opis, format treningu. Zajmie 3 min."
            cta={onboardingDone.services ? "Zarządzaj usługami" : "Zacznij dodawać →"}
            href="/studio/uslugi"
          />
          <OnboardingCard
            n={3}
            now={onboardingDone.services && !onboardingDone.availability}
            done={onboardingDone.availability}
            title="Ustaw dostępność"
            body="Zaznacz, w których dniach i godzinach przyjmujesz klientów."
            cta={onboardingDone.availability ? "Otwórz kalendarz" : "Otwórz kalendarz →"}
            href="/studio/calendar"
          />
        </div>

        {/* Tips + support */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="bg-white rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,47,52,0.06)]">
            <h3 className="m-0 mb-3 text-[13px] tracking-[0.04em] text-[#002f34] font-extrabold uppercase flex items-center">
              Dobre praktyki na start
              <Link href="/jak-to-dziala" className="ml-auto text-[11.5px] text-slate-500 font-semibold normal-case tracking-normal hover:text-emerald-700">
                Wszystkie wskazówki →
              </Link>
            </h3>
            <div className="grid gap-1.5">
              <Tip icon="📸" title="Dodaj 5+ zdjęć — trenerzy z galerią mają 3× więcej kliknięć" sub="Profilowe, zdjęcia z siłowni, z klientami (za zgodą), efekty przed-po." />
              <Tip icon="💬" tone="b" title="Pierwszą wiadomość odpisz w ciągu 1 godziny" sub="Klienci wybierają trenerów, którzy odpowiadają szybko. Aplikacja mobilna pomoże." />
              <Tip icon="🎁" tone="c" title="Zaoferuj pierwszą sesję gratis lub w niższej cenie" sub="To najszybszy sposób na pierwsze opinie. Zwykle wystarczy 3-5 sesji żeby ruszyć." />
              <Tip icon="🏅" tone="d" title="Dodaj certyfikaty — zwiększają konwersję o 32%" sub="EREPS, PTA, APMP, REPS, dietetyk kliniczny. Zweryfikujemy w 24h." />
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 text-center">
              <h4 className="m-0 mb-1.5 text-[14px] text-orange-900 font-extrabold">🎓 Spotkanie z opiekunem</h4>
              <p className="m-0 mb-3 text-[12px] text-orange-800 leading-snug">
                Pierwszy miesiąc na platformie? Zarezerwuj 30 minut z naszym specjalistą onboardingu. Pomożemy ustawić profil, cennik i strategię.
              </p>
              <button type="button" className="w-full px-4 py-2.5 bg-orange-700 hover:bg-orange-800 text-white rounded-md text-[12.5px] font-bold transition">
                Zarezerwuj — gratis
              </button>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,47,52,0.06)]">
              <h3 className="m-0 mb-3 text-[13px] tracking-[0.04em] text-[#002f34] font-extrabold uppercase">
                Dla nowych trenerów
              </h3>
              <div className="grid gap-2.5">
                <ResourceLink title="📘 Przewodnik: pierwsze 30 dni" sub="Krok po kroku — jak zdobyć pierwszych 5 klientów." />
                <ResourceLink title="💸 Cennik — ile brać za sesję?" sub="Mediana w Warszawie · 135 zł / 60 min." />
                <ResourceLink title="👥 Społeczność trenerów" sub="Grupa na Discord · 2 400 trenerów wymienia się tipami." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChecklistItem({ done, now, label }: { done?: boolean; now?: boolean; label: string }) {
  return (
    <div
      className={
        "rounded-lg px-3 py-2.5 text-[11.5px] flex items-center gap-2 " +
        (done
          ? "bg-white/5 text-white/50 line-through"
          : now
            ? "bg-orange-500/18 border border-orange-400 text-white font-bold"
            : "bg-white/8 border border-white/12 text-white/85")
      }
    >
      <span
        className={
          "w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px] shrink-0 " +
          (done
            ? "bg-emerald-600 text-white"
            : now
              ? "bg-orange-500 text-white"
              : "border-[1.5px] border-white/30 bg-transparent text-transparent")
        }
      >
        {done ? "✓" : now ? "→" : ""}
      </span>
      {label}
    </div>
  );
}

function OnboardingCard({
  n, now, done, title, body, cta, href,
}: {
  n: number; now?: boolean; done?: boolean; title: string; body: string; cta: string; href: string;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,47,52,0.06)] transition hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(0,47,52,0.15),0_6px_16px_rgba(0,47,52,0.06)] " +
        (done ? "bg-emerald-50" : "bg-white")
      }
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className={
            "w-7 h-7 rounded-full inline-flex items-center justify-center font-extrabold text-[13px] text-white " +
            (done ? "bg-emerald-600" : now ? "bg-orange-500" : "bg-[#002f34]")
          }
        >
          {done ? "✓" : n}
        </span>
        {now && (
          <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-[0.06em]">teraz robisz</span>
        )}
        {done && (
          <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-[0.06em]">ukończone</span>
        )}
      </div>
      <h3 className="m-0 mb-1.5 text-[15px] font-extrabold text-[#002f34] tracking-[-0.01em]">
        {title}
      </h3>
      <p className="m-0 mb-3.5 text-[12.5px] text-slate-500 leading-snug">{body}</p>
      <span
        className={
          "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12.5px] font-bold transition " +
          (now
            ? "bg-orange-500 text-white"
            : "bg-white border border-slate-300 text-[#002f34]")
        }
      >
        {cta}
      </span>
    </Link>
  );
}

function Tip({
  icon, tone, title, sub,
}: {
  icon: string; tone?: "a" | "b" | "c" | "d"; title: string; sub: string;
}) {
  const iconCls =
    tone === "b" ? "bg-emerald-50 text-emerald-700" :
    tone === "c" ? "bg-blue-50 text-blue-700" :
    tone === "d" ? "bg-amber-100 text-amber-800" :
    "bg-orange-50 text-orange-600";
  return (
    <div className="grid grid-cols-[40px_1fr_auto] gap-3.5 items-center p-2.5 rounded-lg hover:bg-slate-50 transition cursor-pointer">
      <div className={"w-10 h-10 rounded-lg inline-flex items-center justify-center text-[18px] " + iconCls}>
        {icon}
      </div>
      <div>
        <h4 className="m-0 mb-0.5 text-[13px] text-[#002f34] font-bold">{title}</h4>
        <p className="m-0 text-[11.5px] text-slate-500">{sub}</p>
      </div>
      <span className="text-slate-500 text-[16px]">→</span>
    </div>
  );
}

function ResourceLink({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="py-2 px-1 cursor-pointer hover:bg-slate-50 rounded transition">
      <h4 className="m-0 mb-0.5 text-[13px] text-[#002f34] font-bold">{title}</h4>
      <p className="m-0 text-[11.5px] text-slate-500">{sub}</p>
    </div>
  );
}
