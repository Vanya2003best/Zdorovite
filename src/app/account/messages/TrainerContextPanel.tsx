import Link from "next/link";

/**
 * Right-rail context for the active conversation in /account/messages.
 * Mirrors the trainer-side ClientContextPanel — shows what we know about
 * the trainer the client is chatting with: avatar/name, since-when, total
 * session count, upcoming session, active package status.
 */

type Booking = {
  start_time: string;
  service_name?: string | null;
  package_name?: string | null;
  service?: { name: string | null } | null;
  package?: { name: string | null } | null;
};

export type ActivePackage = {
  name: string;
  done: number;
  total: number;
};

export default function TrainerContextPanel({
  trainerSlug,
  name,
  avatar,
  tagline,
  location,
  rating,
  reviewCount,
  firstBookingAt,
  upcoming,
  totalBookings,
  activePackage,
}: {
  trainerSlug: string | null;
  name: string;
  avatar: string | null;
  tagline: string | null;
  location: string | null;
  rating: number | null;
  reviewCount: number;
  firstBookingAt: string | null;
  upcoming: Booking | null;
  totalBookings: number;
  activePackage: ActivePackage | null;
}) {
  const isMyTrainer = totalBookings > 0;
  const sinceLabel = firstBookingAt
    ? `Twój trener od ${new Date(firstBookingAt).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`
    : "Pierwsza rozmowa — brak sesji";

  return (
    <aside className="hidden lg:block bg-white border-l border-slate-200 overflow-y-auto">
      {/* Header */}
      <div className="pt-6 px-5 text-center">
        <div className="w-20 h-20 rounded-full overflow-hidden mx-auto border-2 border-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] bg-emerald-50">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full inline-flex items-center justify-center font-semibold text-2xl text-emerald-700">
              {(name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <h3 className="text-[17px] font-semibold tracking-tight mt-3">{name || "Trener"}</h3>
        {tagline && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 px-3">{tagline}</p>}
        <p className="text-[12px] text-slate-500 mt-1">{sinceLabel}</p>
        {(rating ?? 0) > 0 && (
          <div className="text-[12px] text-slate-700 mt-1.5 inline-flex items-center gap-1">
            <span className="text-amber-500">★</span>
            <b className="text-slate-900">{rating!.toFixed(1)}</b>
            <span className="text-slate-500">· {reviewCount} opinii</span>
          </div>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-1.5 px-4 pt-4 pb-4 border-b border-slate-200">
        {trainerSlug ? (
          <>
            <Link
              href={`/trainers/${trainerSlug}`}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 hover:border-slate-300 transition text-center"
            >
              Profil
            </Link>
            <Link
              href={`/trainers/${trainerSlug}/book`}
              className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] text-emerald-700 hover:border-emerald-300 transition text-center font-medium"
            >
              Zarezerwuj
            </Link>
            <Link
              href="/account/package"
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 hover:border-slate-300 transition text-center"
            >
              Pakiet
            </Link>
          </>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-500 cursor-not-allowed"
          >
            Brak danych trenera
          </button>
        )}
      </div>

      {/* Status / collaboration */}
      <Section title={isMyTrainer ? "Aktywna współpraca" : "Status"}>
        {isMyTrainer ? (
          <div className="rounded-[10px] bg-emerald-50 border border-emerald-200 p-3">
            <div className="text-[13px] font-semibold text-slate-900">
              {totalBookings} {totalBookings === 1 ? "sesja" : totalBookings < 5 ? "sesje" : "sesji"} razem
            </div>
            {firstBookingAt && (
              <div className="text-[11px] text-slate-600 mt-0.5">
                Pierwsza: {new Date(firstBookingAt).toLocaleDateString("pl-PL")}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[10px] bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-900">
            Brak sesji jeszcze — to wasz pierwszy kontakt.
          </div>
        )}
      </Section>

      {/* Active package */}
      {activePackage && (
        <Section title="Pakiet">
          <div className="rounded-[10px] bg-white border border-slate-200 p-3">
            <div className="text-[13px] font-semibold text-slate-900">{activePackage.name}</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-[11px] text-slate-500">Wykorzystane</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">
                {activePackage.done} / {activePackage.total}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                style={{ width: `${Math.min(100, Math.round((activePackage.done / Math.max(1, activePackage.total)) * 100))}%` }}
              />
            </div>
          </div>
        </Section>
      )}

      {/* Upcoming session */}
      <Section title="Najbliższa sesja">
        {upcoming ? (
          <ul className="grid gap-2.5">
            <Row
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              }
              label={new Date(upcoming.start_time).toLocaleDateString("pl-PL", { weekday: "long" })}
              value={new Date(upcoming.start_time).toLocaleString("pl-PL", {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            <Row
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              }
              label="Usługa"
              value={
                upcoming.service_name ??
                upcoming.package_name ??
                upcoming.service?.name ??
                upcoming.package?.name ??
                "Sesja"
              }
            />
            {location && (
              <Row
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                }
                label="Miejsce"
                value={location}
              />
            )}
          </ul>
        ) : (
          <p className="text-[12px] text-slate-500">
            Brak nadchodzących sesji.
            {trainerSlug && (
              <>
                {" "}
                <Link href={`/trainers/${trainerSlug}/book`} className="text-emerald-700 font-semibold hover:underline">
                  Zarezerwuj →
                </Link>
              </>
            )}
          </p>
        )}
      </Section>

      {/* Help / report */}
      <Section title="Wsparcie">
        <div className="text-[11.5px] text-slate-500 leading-[1.5]">
          W razie problemów z sesją lub trenerem napisz do nas:{" "}
          <a href="mailto:hello@nazdrow.pl" className="text-emerald-700 font-semibold">
            hello@nazdrow.pl
          </a>
          .
        </div>
      </Section>

    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 last:border-b-0">
      <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li className="flex gap-2.5 items-center">
      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-500 capitalize">{label}</div>
        <div className="text-[13px] text-slate-900 font-medium truncate">{value}</div>
      </div>
    </li>
  );
}
