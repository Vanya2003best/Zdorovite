import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/auth";
import { cancelMyBooking } from "./actions";

type SP = Promise<{ booked?: string }>;

type BookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  note: string | null;
  service: { name: string; duration: number } | null;
  trainer: {
    slug: string;
    profile: { display_name: string; avatar_url: string | null } | null;
    location: string;
  } | null;
};

export default async function BookingsPage(props: { searchParams: SP }) {
  const { booked } = await props.searchParams;
  const { user } = await requireClient("/account/bookings");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id, start_time, end_time, status, price, note,
      service:services ( name, duration ),
      trainer:trainers (
        slug,
        location,
        profile:profiles!id ( display_name, avatar_url )
      )
    `)
    .eq("client_id", user.id)
    .order("start_time", { ascending: false });

  if (error) throw error;
  const bookings = (data ?? []) as unknown as BookingRow[];

  const upcoming = bookings.filter((b) => new Date(b.start_time) > new Date() && b.status !== "cancelled");
  const past = bookings.filter((b) => new Date(b.start_time) <= new Date() || b.status === "cancelled");

  return (
    <div className="mx-auto max-w-[860px] px-5 sm:px-6 py-8 sm:py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Twoje rezerwacje</h1>
      <p className="text-sm text-slate-600 mt-2 mb-8">
        <Link href="/account" className="text-emerald-700 hover:underline">
          ← Wróć do konta
        </Link>
      </p>

      {booked && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 mb-8 flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          </span>
          <div>
            <p className="font-semibold text-emerald-900">Rezerwacja potwierdzona</p>
            <p className="text-sm text-emerald-800 mt-0.5">Trener otrzymał Twoje zgłoszenie.</p>
          </div>
        </div>
      )}

      {bookings.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
          <p className="text-lg font-medium text-slate-500">Brak rezerwacji</p>
          <Link href="/trainers" className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700">
            Znajdź trenera →
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium mb-4">Nadchodzące</h2>
          <div className="grid gap-3">
            {upcoming.map((b) => <BookingCard key={b.id} booking={b} canCancel />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-[13px] uppercase tracking-[0.08em] text-slate-500 font-medium mb-4">Poprzednie</h2>
          <div className="grid gap-3">
            {past.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function BookingCard({ booking: b, canCancel = false }: { booking: BookingRow; canCancel?: boolean }) {
  const dateStr = new Date(b.start_time).toLocaleDateString("pl-PL", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw",
  });
  const timeStr = new Date(b.start_time).toLocaleTimeString("pl-PL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
  });
  const statusLabel: Record<string, string> = {
    pending: "Oczekuje na płatność",
    confirmed: "Potwierdzone",
    paid: "Opłacone",
    completed: "Zakończone",
    cancelled: "Anulowane",
    no_show: "Nie przybył/a",
  };
  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-emerald-100 text-emerald-800",
    paid: "bg-emerald-100 text-emerald-800",
    completed: "bg-slate-100 text-slate-700",
    cancelled: "bg-red-100 text-red-800",
    no_show: "bg-red-100 text-red-800",
  };

  const trainerName = b.trainer?.profile?.display_name ?? "Trener";
  const trainerAvatar = b.trainer?.profile?.avatar_url;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start gap-4">
      {trainerAvatar ? (
        <img src={trainerAvatar} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0">
          {trainerName.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <strong className="text-slate-900">{trainerName}</strong>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor[b.status] ?? "bg-slate-100 text-slate-700"}`}>
            {statusLabel[b.status] ?? b.status}
          </span>
        </div>
        <div className="text-sm text-slate-700">
          {b.service?.name ?? "Usługa"} · {dateStr}, {timeStr}
        </div>
        {b.trainer?.location && <div className="text-xs text-slate-500 mt-0.5">📍 {b.trainer.location}</div>}
        {b.note && <div className="text-xs text-slate-500 mt-1.5 italic">&ldquo;{b.note}&rdquo;</div>}
        {canCancel && b.status !== "cancelled" && (
          <form action={cancelMyBooking} className="mt-3">
            <input type="hidden" name="booking_id" value={b.id} />
            <button
              type="submit"
              className="text-[12px] text-red-600 font-medium hover:text-red-700 transition"
            >
              Anuluj rezerwację
            </button>
          </form>
        )}
      </div>
      <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">{b.price} zł</div>
    </div>
  );
}
