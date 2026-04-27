import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/auth";
import { getPendingRescheduleMap, type RescheduleRequest } from "@/lib/db/reschedule";
import RescheduleDialog from "@/components/RescheduleDialog";
import { cancelMyBooking } from "./actions";

type SP = Promise<{ booked?: string; tab?: string }>;

type BookingRow = {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  note: string | null;
  service: { name: string; duration: number } | null;
  package: { name: string } | null;
  trainer: {
    slug: string;
    profile: { display_name: string; avatar_url: string | null } | null;
    location: string;
  } | null;
};

const PL_DAY_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekuje",
  confirmed: "Potwierdzone",
  paid: "Opłacone",
  completed: "Ukończona",
  cancelled: "Anulowane",
  no_show: "Nie przybył/a",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export default async function BookingsPage(props: { searchParams: SP }) {
  const { booked, tab } = await props.searchParams;
  const showHistory = tab === "history";
  const { user } = await requireClient("/account/bookings");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id, trainer_id, start_time, end_time, status, price, note,
      service:services ( name, duration ),
      package:packages ( name ),
      trainer:trainers (
        slug, location,
        profile:profiles!id ( display_name, avatar_url )
      )
    `)
    .eq("client_id", user.id)
    .order("start_time", { ascending: true });

  if (error) throw error;
  const bookings = (data ?? []) as unknown as BookingRow[];

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.start_time) > now && b.status !== "cancelled");
  const past = bookings
    .filter((b) => new Date(b.start_time) <= now || b.status === "cancelled")
    .reverse();

  const visible = showHistory ? past : upcoming;
  const nextId = upcoming[0]?.id;

  // Pending reschedule requests for upcoming bookings — drives the "czeka na zmianę" badge
  // and hides the "Przenieś" button (one open request at a time).
  const pendingResMap = await getPendingRescheduleMap(upcoming.map((b) => b.id));

  return (
    <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-5 sm:py-8">
      {/* Mobile header — page title */}
      <header className="md:hidden mb-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          Wszystkie sesje
        </div>
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">
          {upcoming.length} zaplanowanych
        </h1>
      </header>
      {/* Desktop header */}
      <header className="hidden md:block mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Twoje sesje</h1>
        <p className="text-sm text-slate-600 mt-1.5">
          {upcoming.length} nadchodzących · {past.length} w historii
        </p>
      </header>

      {booked && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 mb-5 flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-emerald-900">Rezerwacja potwierdzona</p>
            <p className="text-sm text-emerald-800 mt-0.5">Trener otrzymał Twoje zgłoszenie.</p>
          </div>
        </div>
      )}

      {/* Segmented control */}
      <div className="inline-flex p-[3px] bg-slate-100 rounded-full mb-4 text-xs">
        <Link
          href="/account/bookings"
          className={`px-3.5 py-1.5 rounded-full font-medium transition ${
            !showHistory
              ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Nadchodzące · {upcoming.length}
        </Link>
        <Link
          href="/account/bookings?tab=history"
          className={`px-3.5 py-1.5 rounded-full font-medium transition ${
            showHistory
              ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Historia · {past.length}
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-12 text-center">
          <p className="text-base font-medium text-slate-500">
            {showHistory ? "Brak sesji w historii." : "Nie masz zaplanowanych sesji."}
          </p>
          {!showHistory && (
            <Link
              href="/trainers"
              className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Znajdź trenera →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-2.5">
          {visible.map((b) => (
            <SessionCard
              key={b.id}
              booking={b}
              isPast={showHistory}
              isNext={b.id === nextId}
              pendingReschedule={pendingResMap.get(b.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  booking: b,
  isPast,
  isNext,
  pendingReschedule,
}: {
  booking: BookingRow;
  isPast: boolean;
  isNext: boolean;
  pendingReschedule: RescheduleRequest | null;
}) {
  const d = new Date(b.start_time);
  const trainerName = b.trainer?.profile?.display_name ?? "Trener";
  const what = b.package?.name
    ? `${b.package.name}`
    : b.service?.name ?? "Sesja";
  const completed = b.status === "completed";
  const cancelled = b.status === "cancelled";

  return (
    <div className={`bg-white border border-slate-200 rounded-[14px] p-3.5 grid grid-cols-[64px_1fr] gap-3 ${isPast ? "opacity-90" : ""}`}>
      {/* Date tile */}
      <div className={`rounded-[10px] text-center py-2 ${
        isNext ? "bg-emerald-50" : isPast ? "bg-slate-100" : "bg-slate-50"
      }`}>
        <div className={`text-[9px] uppercase font-bold tracking-wider ${
          isNext ? "text-emerald-700" : "text-slate-500"
        }`}>
          {PL_DAY_SHORT[d.getDay()]} {d.getDate()}
        </div>
        <div className={`text-[22px] font-bold tracking-[-0.02em] leading-tight my-0.5 ${
          isPast && !isNext ? "text-slate-700" : "text-slate-900"
        }`}>
          {d.getDate()}
        </div>
        <div className="text-[10px] text-slate-700 font-semibold">{fmtTime(b.start_time)}</div>
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <div className="text-[13px] font-semibold truncate">{what}</div>
        <div className="text-[11.5px] text-slate-600 mt-0.5">
          <div className="truncate">
            {trainerName}
            {b.service?.duration ? ` · ${b.service.duration} min` : ""}
            {cancelled ? " · anulowana" : completed ? " · ukończona" : ""}
          </div>
          <div className="flex gap-2 items-center mt-1 flex-wrap text-[11px]">
            {b.trainer?.location && (
              <span className="inline-flex gap-1 items-center text-slate-500">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {b.trainer.location}
              </span>
            )}
            {!isPast && !cancelled && (
              <span className="inline-flex items-center text-slate-500">
                · {STATUS_LABEL[b.status] ?? b.status}
              </span>
            )}
            {isNext && (
              <span className="text-emerald-700 font-medium">· Najbliższa</span>
            )}
          </div>
        </div>

        {!isPast && !cancelled ? (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            <Link
              href={`/account/messages?with=${b.trainer_id}`}
              className="px-2.5 py-1 rounded-[7px] text-[11px] font-medium bg-slate-900 text-white hover:bg-black transition"
            >
              Otwórz
            </Link>
            {pendingReschedule ? (
              <Link
                href={`/account/messages?with=${b.trainer_id}`}
                className="px-2.5 py-1 rounded-[7px] text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
              >
                Czeka na zmianę
              </Link>
            ) : (
              <RescheduleDialog
                bookingId={b.id}
                trainerId={b.trainer_id}
                currentStartIso={b.start_time}
                durationMin={b.service?.duration ?? 60}
                triggerLabel="Przenieś"
              />
            )}
            <form action={cancelMyBooking}>
              <input type="hidden" name="booking_id" value={b.id} />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-[7px] text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-400 transition"
              >
                Anuluj
              </button>
            </form>
            <span className="ml-auto text-[12px] font-semibold text-slate-900 self-center">{b.price} zł</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-900">{b.price} zł</span>
            {completed && (
              // TODO: only show if no review by this client for this trainer; needs query against reviews table
              <Link
                href={`/trainers/${b.trainer?.slug ?? ""}#reviews`}
                className="ml-auto inline-flex gap-1.5 items-center px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium border border-amber-300 bg-gradient-to-br from-amber-50 to-white text-amber-800 hover:border-amber-400 transition"
              >
                <span className="text-amber-600">★★★★★</span>
                Wystaw opinię
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
