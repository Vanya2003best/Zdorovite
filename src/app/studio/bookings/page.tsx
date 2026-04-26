import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  cancelAsTrainer,
  confirmBooking,
  markCompleted,
  markNoShow,
} from "./actions";

type BookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  note: string | null;
  service: { name: string; duration: number } | null;
  client: { display_name: string; avatar_url: string | null } | null;
};

export default async function TrainerBookingsPage() {
  // Layout already guarded auth + is_trainer; here we just fetch bookings.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/bookings");

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id, start_time, end_time, status, price, note,
      service:services ( name, duration ),
      client:profiles!client_id ( display_name, avatar_url )
    `)
    .eq("trainer_id", user.id)
    .order("start_time", { ascending: true });

  if (error) throw error;
  const bookings = (data ?? []) as unknown as BookingRow[];

  const now = new Date();
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter(
    (b) => new Date(b.start_time) > now && ["confirmed", "paid"].includes(b.status),
  );
  const past = bookings.filter(
    (b) => new Date(b.start_time) <= now || b.status === "cancelled",
  ).reverse();

  const totalEarnings = bookings
    .filter((b) => b.status === "completed" || b.status === "paid")
    .reduce((sum, b) => sum + b.price, 0);

  return (
    <div>
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Stat label="Oczekuje" value={pending.length} tone="amber" />
        <Stat label="Nadchodzące" value={upcoming.length} tone="emerald" />
        <Stat label="Wszystkie" value={bookings.length} tone="slate" />
        <Stat label="Zarobione" value={`${totalEarnings} zł`} tone="slate" />
      </div>

      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[13px] uppercase tracking-[0.08em] text-amber-700 font-medium mb-4">
            ⏳ Do potwierdzenia ({pending.length})
          </h2>
          <div className="grid gap-3">
            {pending.map((b) => (
              <TrainerBookingCard key={b.id} booking={b} view="pending" />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium mb-4">
            📅 Nadchodzące ({upcoming.length})
          </h2>
          <div className="grid gap-3">
            {upcoming.map((b) => (
              <TrainerBookingCard key={b.id} booking={b} view="upcoming" />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-[13px] uppercase tracking-[0.08em] text-slate-500 font-medium mb-4">
            Historia
          </h2>
          <div className="grid gap-3">
            {past.slice(0, 50).map((b) => (
              <TrainerBookingCard key={b.id} booking={b} view="past" />
            ))}
          </div>
        </section>
      )}

      {bookings.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
          <p className="text-lg font-medium text-slate-500">Brak rezerwacji</p>
          <p className="text-sm text-slate-400 mt-1">Gdy ktoś zarezerwuje u Ciebie sesję, pojawi się tu.</p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "emerald" | "amber" | "slate";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
      <div className="text-[12px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function TrainerBookingCard({
  booking: b,
  view,
}: {
  booking: BookingRow;
  view: "pending" | "upcoming" | "past";
}) {
  const date = new Date(b.start_time);
  const dateStr = date.toLocaleDateString("pl-PL", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw",
  });
  const timeStr = date.toLocaleTimeString("pl-PL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
  });
  const clientName = b.client?.display_name ?? "Klient";
  const clientAvatar = b.client?.avatar_url;
  const hasStarted = new Date(b.start_time) <= new Date();
  const isCancelled = b.status === "cancelled";
  const isCompleted = b.status === "completed";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      {/* Client avatar */}
      {clientAvatar ? (
        <img src={clientAvatar} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0">
          {clientName.charAt(0)}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-slate-900">{clientName}</strong>
          <StatusPill status={b.status} />
        </div>
        <div className="text-sm text-slate-700 mt-1">
          {b.service?.name ?? "Usługa"} · {dateStr}, {timeStr}
        </div>
        {b.note && (
          <div className="text-[13px] text-slate-600 mt-2.5 bg-slate-50 rounded-lg px-3 py-2 italic">
            &ldquo;{b.note}&rdquo;
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {view === "pending" && !isCancelled && (
            <>
              <form action={confirmBooking}>
                <input type="hidden" name="booking_id" value={b.id} />
                <button className="h-9 px-3.5 rounded-lg bg-emerald-500 text-white text-[13px] font-medium hover:brightness-105 transition">
                  Potwierdź
                </button>
              </form>
              <form action={cancelAsTrainer}>
                <input type="hidden" name="booking_id" value={b.id} />
                <button className="h-9 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition">
                  Odrzuć
                </button>
              </form>
            </>
          )}

          {view === "upcoming" && !isCancelled && (
            <form action={cancelAsTrainer}>
              <input type="hidden" name="booking_id" value={b.id} />
              <button className="h-9 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition">
                Anuluj
              </button>
            </form>
          )}

          {view === "past" && hasStarted && !isCancelled && !isCompleted && (
            <>
              <form action={markCompleted}>
                <input type="hidden" name="booking_id" value={b.id} />
                <button className="h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-black transition">
                  Zakończona
                </button>
              </form>
              <form action={markNoShow}>
                <input type="hidden" name="booking_id" value={b.id} />
                <button className="h-9 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition">
                  Nie przybył/a
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="text-base font-semibold text-slate-900 whitespace-nowrap">
        {b.price} zł
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: "Oczekuje",    cls: "bg-amber-100 text-amber-800" },
    confirmed: { label: "Potwierdzone",cls: "bg-emerald-100 text-emerald-800" },
    paid:      { label: "Opłacone",    cls: "bg-emerald-100 text-emerald-800" },
    completed: { label: "Zakończona",  cls: "bg-slate-200 text-slate-700" },
    cancelled: { label: "Anulowane",   cls: "bg-red-100 text-red-800" },
    no_show:   { label: "Nie przybył", cls: "bg-red-100 text-red-800" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}
