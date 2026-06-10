"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * /account/trainer — Mój trener (design 40).
 *
 * Four modes via top switcher: O Marku / Opinie / Nasza historia / Znajdź
 * innego. The primary trainer is the most-frequent one across this client's
 * bookings (server-side). Most data is real (trainer profile + bio + specs +
 * certifications + services + packages + reviews + availability_rules);
 * "online status" + "response time" are synthesized from message history.
 */

export type TrainerHero = {
  slug: string;
  trainerId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  avatarFocal: string | null;
  tagline: string;
  location: string;
  rating: number;
  reviewCount: number;
  experienceYears: number;
  clientsCount: number;
  /** True when last message from trainer < 30 minutes ago. Synthesized — there
   *  is no presence column on profiles yet. */
  onlineNow: boolean;
  /** Verification status from certifications: "verified" if any cert is
   *  reviewed-verified, "pending" otherwise. Mostly cosmetic. */
  verified: boolean;
  /** Median response delta in hours (msgs the trainer sent reply for). */
  responseHours: number | null;
};

export type SpecBadge = { id: string; label: string; emoji: string; description?: string };

export type CertBadge = {
  id: string;
  text: string;
  verified: boolean;
};

export type ServiceTile = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
};

export type PackageTile = {
  id: string;
  name: string;
  description: string;
  price: number;
  sessionsTotal: number | null;
  pricePerSession: number | null;
  isCurrent: boolean;
};

export type AvailabilityWindow = {
  /** "Pn-Pt", "Sob", "Niedz" — Polish day-range label. */
  range: string;
  /** "6:00 – 21:00" or "nieczynne". */
  hours: string;
};

export type ReviewItem = {
  id: string;
  authorName: string;
  authorInitials: string;
  authorAvatarUrl: string | null;
  isMe: boolean;
  rating: number;
  text: string;
  createdAtLabel: string;
  reply: { text: string; atLabel: string } | null;
  /** When migration 029 categories are present. */
  cats?: { wiedza: number | null; atmosfera: number | null; punktualnosc: number | null; efekty: number | null } | null;
};

export type ReviewSummary = {
  rating: number;
  total: number;
  /** Distribution: index 0 = 1★, 4 = 5★. */
  bucket: [number, number, number, number, number];
  /** Per-category averages, null when not enough data. */
  catAvg: { wiedza: number | null; atmosfera: number | null; punktualnosc: number | null; efekty: number | null };
};

export type CollabHistory = {
  startIso: string;
  startLabel: string;
  monthsCoaching: number;
  totalSessions: number;
  attendancePct: number;
  bestMonthLabel: string | null;
  bestMonthCount: number;
  currentStreakWeeks: number;
};

export type MojTrenerData = {
  hero: TrainerHero | null;
  about: string;
  specs: SpecBadge[];
  certs: CertBadge[];
  services: ServiceTile[];
  packages: PackageTile[];
  availability: AvailabilityWindow[];
  /** Smallest upcoming open slot label (e.g. "piątek 9 maja, 6:30") — null when computation isn't ready. */
  nextSlotLabel: string | null;
  reviews: ReviewItem[];
  reviewSummary: ReviewSummary | null;
  collab: CollabHistory | null;
  /** Pending reviews this client owes (history sessions without a review). */
  pendingReviews: number;
};

type Mode = "about" | "reviews" | "history" | "find";

export default function MojTrener({ data }: { data: MojTrenerData }) {
  const [mode, setMode] = useState<Mode>("about");
  if (!data.hero) {
    return <NoTrainerState />;
  }
  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      <Topbar hero={data.hero} collab={data.collab} />
      <Hero hero={data.hero} />
      <ModeBar
        mode={mode}
        onChange={setMode}
        reviewCount={data.reviewSummary?.total ?? data.reviews.length}
        sessionCount={data.collab?.totalSessions ?? 0}
      />
      <ModeBanner mode={mode} hero={data.hero} collab={data.collab} reviewSummary={data.reviewSummary} pending={data.pendingReviews} />

      {mode === "about" && (
        <AboutPanel
          about={data.about}
          specs={data.specs}
          certs={data.certs}
          services={data.services}
          packages={data.packages}
          availability={data.availability}
          nextSlotLabel={data.nextSlotLabel}
          responseHours={data.hero.responseHours}
          location={data.hero.location}
        />
      )}
      {mode === "reviews" && (
        <ReviewsPanel
          summary={data.reviewSummary}
          reviews={data.reviews}
          pending={data.pendingReviews}
          trainerSlug={data.hero.slug}
        />
      )}
      {mode === "history" && <HistoryPanel collab={data.collab} hero={data.hero} />}
      {mode === "find" && <FindPanel />}
    </div>
  );
}

/* ====================== TOPBAR ====================== */

function Topbar({ hero, collab }: { hero: TrainerHero; collab: CollabHistory | null }) {
  const sub = (() => {
    const parts: string[] = [`${hero.name}`];
    if (collab) parts.push(`${collab.monthsCoaching} ${plural(collab.monthsCoaching, "miesiąc", "miesiące", "miesięcy")} współpracy`);
    if (collab) parts.push(`${collab.totalSessions} ${plural(collab.totalSessions, "sesja", "sesje", "sesji")}`);
    if (hero.rating > 0) parts.push(`${hero.rating.toFixed(1)} ⭐`);
    return parts.join(" · ");
  })();
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-3.5">
      <div>
        <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Mój trener</h1>
        <div className="text-[12.5px] text-slate-500 mt-1">{sub}</div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/trainers/${hero.slug}/book`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
        >
          + Zarezerwuj sesję
        </Link>
      </div>
    </div>
  );
}

/* ====================== HERO ====================== */

function Hero({ hero }: { hero: TrainerHero }) {
  return (
    <div className="rounded-[16px] bg-white border border-slate-200 p-5 sm:p-6 mb-4 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-5 lg:items-center">
      <div className="relative shrink-0">
        {hero.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.avatarUrl}
            alt={hero.name}
            className="w-[88px] h-[88px] rounded-full object-cover"
            style={{ objectPosition: hero.avatarFocal || "center" }}
          />
        ) : (
          <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white inline-flex items-center justify-center text-[28px] font-bold">
            {hero.initials}
          </div>
        )}
        {hero.onlineNow && (
          <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
        )}
      </div>

      <div>
        <div className="text-[20px] font-bold tracking-[-0.018em] flex items-center gap-2 flex-wrap">
          <Link href={`/trainers/${hero.slug}`} className="hover:underline">
            {hero.name}
          </Link>
          {hero.verified && (
            <span className="text-[10.5px] uppercase tracking-[0.06em] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ Zweryfikowany
            </span>
          )}
        </div>
        {hero.tagline && (
          <div className="text-[13px] text-slate-600 mt-1">{hero.tagline}</div>
        )}
        <div className="flex items-center gap-4 flex-wrap mt-2.5 text-[12px] text-slate-600">
          {hero.location && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {hero.location}
            </span>
          )}
          {hero.rating > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-amber-500">★</span>
              <b className="text-slate-900">{hero.rating.toFixed(1)}</b>
              <span className="text-slate-500">· {hero.reviewCount} opinii</span>
            </span>
          )}
          {hero.experienceYears > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <b className="text-slate-900">{hero.experienceYears}</b>
              <span className="text-slate-500">{plural(hero.experienceYears, "rok", "lata", "lat")} doświadczenia</span>
            </span>
          )}
          {hero.clientsCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <b className="text-slate-900">{hero.clientsCount}</b>
              <span className="text-slate-500">{plural(hero.clientsCount, "klient", "klientów", "klientów")}</span>
            </span>
          )}
          {hero.onlineNow && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
              ● Online teraz
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:items-end">
        <Link
          href={`/account/messages?with=${hero.trainerId}`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[9px] bg-slate-900 text-white text-[13px] font-semibold hover:bg-black w-full lg:w-auto justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Napisz wiadomość
        </Link>
        <div className="flex gap-2 w-full">
          <Link
            href={`/trainers/${hero.slug}/book`}
            className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-[9px] bg-white border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-300"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Zarezerwuj
          </Link>
          <Link
            href={`/trainers/${hero.slug}`}
            className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-[9px] bg-white border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-300"
          >
            Profil publiczny
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ====================== MODE BAR ====================== */

function ModeBar({
  mode,
  onChange,
  reviewCount,
  sessionCount,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  reviewCount: number;
  sessionCount: number;
}) {
  return (
    <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
      <div className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium">
        {(
          [
            { id: "about", label: "O trenerze", badge: "" },
            { id: "reviews", label: "Opinie", badge: reviewCount > 0 ? String(reviewCount) : "" },
            { id: "history", label: "Nasza historia", badge: sessionCount > 0 ? String(sessionCount) : "" },
            { id: "find", label: "Znajdź innego", badge: "" },
          ] as { id: Mode; label: string; badge: string }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={
              "inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] whitespace-nowrap transition " +
              (mode === m.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:text-slate-900")
            }
          >
            <ModeIcon id={m.id} />
            {m.label}
            {m.badge && (
              <span
                className={
                  "text-[10.5px] font-semibold px-[6px] py-[1px] rounded-[5px] " +
                  (mode === m.id ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700")
                }
              >
                {m.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeBanner({
  mode,
  hero,
  collab,
  reviewSummary,
  pending,
}: {
  mode: Mode;
  hero: TrainerHero;
  collab: CollabHistory | null;
  reviewSummary: ReviewSummary | null;
  pending: number;
}) {
  const cls = "flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 border ";
  if (mode === "about") {
    return (
      <div className={cls + "bg-emerald-50 border-emerald-200 text-emerald-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {collab
              ? `${collab.monthsCoaching} ${plural(collab.monthsCoaching, "miesiąc", "miesiące", "miesięcy")} z trenerem · ${collab.totalSessions} ${plural(collab.totalSessions, "sesja", "sesje", "sesji")} · obecność ${collab.attendancePct}%`
              : `Trener: ${hero.name}`}
          </b>
          <div className="text-emerald-800/80 mt-0.5">
            {hero.responseHours != null
              ? `Średni czas odpowiedzi: ~${hero.responseHours} h.`
              : "Pisz śmiało — trener odpowie najszybciej, jak będzie mógł."}
          </div>
        </div>
      </div>
    );
  }
  if (mode === "reviews") {
    return (
      <div className={cls + "bg-amber-50 border-amber-200 text-amber-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-amber-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {reviewSummary
              ? `${reviewSummary.rating.toFixed(2)} / 5 · ${reviewSummary.total} ${plural(reviewSummary.total, "opinia", "opinie", "opinii")}`
              : "Brak opinii"}
            {pending > 0 && ` · masz ${pending} ${plural(pending, "nieoddaną opinię", "nieoddane opinie", "nieoddanych opinii")}`}
          </b>
          <div className="text-amber-800/80 mt-0.5">
            Opinie pomagają innym wybrać trenera. Twoja opinia zawsze publikowana jest po sesji.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "history") {
    return (
      <div className={cls + "bg-sky-50 border-sky-200 text-sky-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-sky-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1015 6" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {collab
              ? `${collab.totalSessions} ${plural(collab.totalSessions, "sesja", "sesje", "sesji")} od ${collab.startLabel} · obecność ${collab.attendancePct}%`
              : "Brak historii sesji"}
          </b>
          <div className="text-sky-800/80 mt-0.5">
            {collab?.bestMonthLabel
              ? `Najlepszy miesiąc: ${collab.bestMonthLabel} (${collab.bestMonthCount} ${plural(collab.bestMonthCount, "sesja", "sesje", "sesji")}).`
              : "Zarezerwuj kolejną sesję, by rozwijać współpracę."}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cls + "bg-slate-100 border-slate-200 text-slate-700"}>
      <span className="w-7 h-7 rounded-[8px] bg-slate-500 text-white inline-flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /></svg>
      </span>
      <div>
        <b className="font-semibold">Szukasz drugiego trenera?</b>
        <div className="text-slate-500 mt-0.5">
          Zmiana lub dodanie trenera nie kasuje historii ani planów — wszystko zostaje.
        </div>
      </div>
    </div>
  );
}

/* ====================== ABOUT PANEL ====================== */

function AboutPanel({
  about,
  specs,
  certs,
  services,
  packages,
  availability,
  nextSlotLabel,
  responseHours,
  location,
}: {
  about: string;
  specs: SpecBadge[];
  certs: CertBadge[];
  services: ServiceTile[];
  packages: PackageTile[];
  availability: AvailabilityWindow[];
  nextSlotLabel: string | null;
  responseHours: number | null;
  location: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-4">
        <Card>
          <CardHeader title="O trenerze" />
          {about ? (
            <div className="text-[13px] text-slate-700 leading-[1.65] whitespace-pre-wrap">{about}</div>
          ) : (
            <p className="text-[13px] text-slate-500">Trener jeszcze nie dodał opisu o sobie.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Specjalizacje" sub={specs.length > 0 ? `${specs.length} obszarów` : ""} />
          {specs.length === 0 ? (
            <p className="text-[13px] text-slate-500">Trener nie wskazał jeszcze specjalizacji.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {specs.map((s) => (
                <div key={s.id} className="flex gap-2.5 items-start">
                  <span className="w-8 h-8 rounded-[8px] bg-slate-100 inline-flex items-center justify-center text-[16px] shrink-0">
                    {s.emoji}
                  </span>
                  <div>
                    <div className="text-[12.5px] font-semibold text-slate-900">{s.label}</div>
                    {s.description && (
                      <div className="text-[11px] text-slate-500 leading-[1.4] mt-0.5">{s.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Kwalifikacje i certyfikaty" sub={certs.length > 0 ? `${certs.length} pozycji` : ""} />
          {certs.length === 0 ? (
            <p className="text-[13px] text-slate-500">Brak dodanych certyfikatów.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {certs.map((c) => (
                <div key={c.id} className="flex gap-3 items-start">
                  <span className="w-9 h-9 rounded-[9px] bg-slate-100 inline-flex items-center justify-center shrink-0 text-[16px]">
                    🎓
                  </span>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-slate-900 flex items-center gap-2">
                      {c.text}
                      {c.verified && (
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          ✓ Zweryfikowany
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Cennik i pakiety" sub={`${services.length + packages.length} pozycji`} />
          <div className="flex flex-col gap-2.5">
            {packages.map((p) => (
              <div
                key={p.id}
                className={
                  "p-3.5 rounded-[10px] border flex justify-between items-center " +
                  (p.isCurrent
                    ? "border-emerald-500 bg-emerald-50/60"
                    : "border-slate-200 bg-white")
                }
              >
                <div>
                  <div className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
                    {p.name}
                    {p.isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-white bg-emerald-500 rounded-full px-2 py-0.5">
                        Twój
                      </span>
                    )}
                  </div>
                  {p.sessionsTotal && p.pricePerSession != null && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.sessionsTotal} sesji · {p.pricePerSession.toFixed(0)} PLN/sesja
                    </div>
                  )}
                </div>
                <div className="text-[18px] font-bold text-slate-900 tabular-nums">{p.price} PLN</div>
              </div>
            ))}
            {services.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-[10px] border border-slate-200 bg-white flex justify-between items-center"
              >
                <div>
                  <div className="text-[13px] font-bold text-slate-900">{s.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{s.durationMin} min · {s.description.slice(0, 60)}{s.description.length > 60 ? "…" : ""}</div>
                </div>
                <div className="text-[18px] font-bold text-slate-900 tabular-nums">{s.price} PLN</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Dostępność" />
          {availability.length === 0 ? (
            <p className="text-[12.5px] text-slate-500">Trener nie wprowadził jeszcze grafiku.</p>
          ) : (
            <div className="text-[12px] text-slate-700 leading-[1.8]">
              {availability.map((a) => (
                <div key={a.range} className="flex justify-between">
                  <span className="text-slate-900 font-semibold">{a.range}</span>
                  <span className={a.hours === "nieczynne" ? "text-slate-400" : ""}>{a.hours}</span>
                </div>
              ))}
            </div>
          )}
          {nextSlotLabel && (
            <div className="mt-3 px-3 py-2.5 bg-emerald-50 rounded-[8px] text-[11.5px] text-emerald-700">
              ⚡ <b>Następny wolny:</b> {nextSlotLabel}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Lokalizacja" />
          <div className="text-[12.5px] leading-[1.55] text-slate-700">
            {location ? (
              <>
                <b className="text-slate-900">📍 {location}</b>
                <div className="text-[11.5px] text-slate-500 mt-1">
                  Sesje stacjonarne i online (Zoom).
                </div>
              </>
            ) : (
              <span className="text-slate-500">Lokalizacja nie podana.</span>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Czas odpowiedzi" />
          <div className="text-[32px] font-bold tracking-[-0.025em] text-slate-900 tabular-nums leading-none">
            {responseHours != null ? `${responseHours}` : "—"}
            <span className="text-[14px] text-slate-500 font-medium ml-1">h</span>
          </div>
          <div className="text-[11.5px] text-slate-500 mt-1">
            {responseHours != null ? "Średnio · ostatnie wiadomości" : "Brak danych"}
          </div>
        </Card>
      </div>
    </>
  );
}

/* ====================== REVIEWS PANEL ====================== */

function ReviewsPanel({
  summary,
  reviews,
  pending,
  trainerSlug,
}: {
  summary: ReviewSummary | null;
  reviews: ReviewItem[];
  pending: number;
  trainerSlug: string;
}) {
  return (
    <>
      {summary && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="text-center">
              <div className="text-[48px] font-bold tracking-[-0.025em] text-slate-900 leading-none">
                {summary.rating.toFixed(2)}
              </div>
              <div className="text-amber-500 text-[18px] mt-1">★★★★★</div>
              <div className="text-[12px] text-slate-500 mt-1">
                {summary.total} {plural(summary.total, "opinia", "opinie", "opinii")}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {([5, 4, 3, 2, 1] as const).map((n) => {
                const count = summary.bucket[n - 1];
                const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-2.5 text-[12px]">
                    <span className="text-slate-700 w-6 shrink-0">{n}★</span>
                    <div className="flex-1 h-[6px] bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-slate-700 font-bold tabular-nums w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {summary.catAvg.wiedza != null && (
            <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <CatScore label="Wiedza" value={summary.catAvg.wiedza} />
              <CatScore label="Atmosfera" value={summary.catAvg.atmosfera} />
              <CatScore label="Punktualność" value={summary.catAvg.punktualnosc} />
              <CatScore label="Efekty" value={summary.catAvg.efekty} />
            </div>
          )}
        </Card>
      )}

      {pending > 0 && (
        <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-[11px] flex items-center justify-between gap-4 flex-wrap">
          <div className="text-[12.5px] text-amber-900">
            <b>Masz {pending} {plural(pending, "nieoddaną opinię", "nieoddane opinie", "nieoddanych opinii")}</b> · podziel się wrażeniami z minionych sesji.
          </div>
          <Link
            href="/account/bookings?mode=history"
            className="inline-flex items-center h-8 px-3 rounded-[7px] bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600"
          >
            Wystaw opinie
          </Link>
        </div>
      )}

      <Card>
        <CardHeader title={`Opinie · ${reviews.length} pokazane`} />
        {reviews.length === 0 ? (
          <p className="text-[13px] text-slate-500">Brak opinii o tym trenerze.</p>
        ) : (
          <div className="flex flex-col">
            {reviews.map((r, i) => (
              <ReviewBlock key={r.id} r={r} isLast={i === reviews.length - 1} />
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
          <Link
            href={`/trainers/${trainerSlug}#reviews`}
            className="text-[12px] text-emerald-700 font-semibold hover:underline"
          >
            Zobacz wszystkie na profilu →
          </Link>
        </div>
      </Card>
    </>
  );
}

function CatScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.07em] text-slate-500 font-bold">{label}</div>
      <div className="text-[18px] font-bold text-slate-900 mt-0.5">
        {value != null ? `${value.toFixed(2)} ★` : "—"}
      </div>
    </div>
  );
}

function ReviewBlock({ r, isLast }: { r: ReviewItem; isLast: boolean }) {
  return (
    <div className={"py-4 " + (isLast ? "" : "border-b border-slate-100")}>
      <div className="flex items-start gap-3 mb-2">
        {r.authorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.authorAvatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 inline-flex items-center justify-center font-bold text-[12px] shrink-0">
            {r.authorInitials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-slate-900 flex items-center gap-2 flex-wrap">
            {r.authorName}
            {r.isMe && (
              <span className="text-[10px] uppercase tracking-[0.06em] font-bold text-white bg-emerald-500 rounded-full px-2 py-0.5">
                Ty
              </span>
            )}
            <span className="text-[11.5px] text-slate-500 font-normal">· {r.createdAtLabel}</span>
          </div>
          <div className="text-amber-500 text-[14px] mt-0.5">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
        </div>
      </div>
      <div className="text-[13px] text-slate-700 leading-[1.55] pl-12">{r.text}</div>
      {r.reply && (
        <div className="mt-2.5 ml-12 pl-3 border-l-2 border-emerald-200 text-[12.5px] text-slate-700 leading-[1.55]">
          <div className="text-[10.5px] uppercase tracking-[0.06em] font-bold text-emerald-700 mb-1">
            ↳ Trener odpowiedział · {r.reply.atLabel}
          </div>
          {r.reply.text}
        </div>
      )}
    </div>
  );
}

/* ====================== HISTORY PANEL ====================== */

function HistoryPanel({ collab, hero }: { collab: CollabHistory | null; hero: TrainerHero }) {
  if (!collab) {
    return (
      <Card>
        <PlaceholderEmpty text="Brak historii sesji z tym trenerem. Zarezerwuj pierwszą — pojawi się tu jako linia współpracy." />
      </Card>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatTile label="Współpraca" value={`${collab.monthsCoaching}`} unit={plural(collab.monthsCoaching, "miesiąc", "miesiące", "miesięcy")} detail={`od ${collab.startLabel}`} />
        <StatTile label="Sesje" value={String(collab.totalSessions)} unit="" detail={`obecność ${collab.attendancePct}%`} accent={collab.attendancePct >= 90 ? "good" : "neutral"} />
        <StatTile label="Pasmo" value={`${collab.currentStreakWeeks}`} unit="tyg." detail={collab.currentStreakWeeks > 0 ? "aktualne" : "rozpocznij"} accent={collab.currentStreakWeeks > 0 ? "good" : "neutral"} />
        <StatTile label="Najlepszy mies." value={collab.bestMonthLabel ?? "—"} unit="" detail={collab.bestMonthCount > 0 ? `${collab.bestMonthCount} ${plural(collab.bestMonthCount, "sesja", "sesje", "sesji")}` : ""} />
      </div>

      <Card>
        <CardHeader title="Linia współpracy" />
        <div className="rounded-[12px] border-2 border-dashed border-slate-200 px-6 py-8 text-center">
          <p className="text-[13px] text-slate-500 leading-[1.5] max-w-[480px] mx-auto">
            Pełna oś czasowa współpracy z trenerem (sesje · plany · PRy · pomiary) pojawi się po wprowadzeniu modułu trackingu treningowego.
          </p>
          <div className="text-[12px] text-slate-700 mt-3">
            Na razie historię sesji znajdziesz w{" "}
            <Link href="/account/bookings?mode=history" className="text-emerald-700 font-semibold underline">
              Moje treningi · Historia
            </Link>
            , a postępy — w{" "}
            <Link href={`/trainers/${hero.slug}`} className="text-emerald-700 font-semibold underline">
              Postępy
            </Link>
            .
          </div>
        </div>
      </Card>
    </>
  );
}

function StatTile({
  label,
  value,
  unit,
  detail,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  accent?: "good" | "neutral";
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.07em] text-slate-500 font-semibold mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-[20px] font-bold tabular-nums tracking-[-0.02em] text-slate-900">{value}</span>
        {unit && <span className="text-[12px] font-medium text-slate-500">{unit}</span>}
      </div>
      {detail && (
        <div
          className={
            "text-[11px] mt-0.5 " +
            (accent === "good" ? "text-emerald-700 font-semibold" : "text-slate-500")
          }
        >
          {detail}
        </div>
      )}
    </div>
  );
}

/* ====================== FIND PANEL ====================== */

function FindPanel() {
  return (
    <Card>
      <CardHeader title="Znajdź innego trenera" />
      <div className="rounded-[12px] border-2 border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-[13px] text-slate-500 leading-[1.5] max-w-[480px] mx-auto">
          Możesz pracować z więcej niż jednym trenerem — np. siła + dietetyk lub joga w dodatku do
          treningu siłowego. Zmiana lub dodanie drugiego trenera nie kasuje historii ani planów.
        </p>
        <Link
          href="/"
          className="inline-flex items-center mt-4 h-10 px-4 rounded-[9px] bg-slate-900 text-white text-[13px] font-semibold hover:bg-black"
        >
          Otwórz katalog trenerów →
        </Link>
      </div>
    </Card>
  );
}

/* ====================== NO TRAINER ====================== */

function NoTrainerState() {
  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0 mb-4">Mój trener</h1>
      <div className="rounded-[16px] bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 p-6 sm:p-8 text-center">
        <div className="text-[18px] font-bold text-slate-900 mb-2">Nie masz jeszcze trenera</div>
        <p className="text-[13px] text-slate-600 max-w-[480px] mx-auto leading-[1.5] mb-4">
          Po zarezerwowaniu pierwszej sesji ten panel ożywie — pokaże profil Twojego trenera, opinie,
          pakiety, historię współpracy i szybki kontakt.
        </p>
        <Link
          href="/"
          className="inline-flex items-center h-10 px-4 rounded-[9px] bg-slate-900 text-white text-[13px] font-semibold hover:bg-black"
        >
          Otwórz katalog trenerów →
        </Link>
      </div>
    </div>
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

function PlaceholderEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-[12px] border-2 border-dashed border-slate-200 py-10 px-6 text-center">
      <p className="text-[13px] text-slate-500 leading-[1.5] max-w-[480px] mx-auto">{text}</p>
    </div>
  );
}

function ModeIcon({ id }: { id: Mode }) {
  if (id === "about")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0116 0v1" />
      </svg>
    );
  if (id === "reviews")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5" />
      </svg>
    );
  if (id === "history")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 1015 6" />
      </svg>
    );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4-4" />
    </svg>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}
