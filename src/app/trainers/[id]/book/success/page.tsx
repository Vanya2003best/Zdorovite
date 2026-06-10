import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SuccessRing from "@/components/states/SuccessRing";

export default async function BookingSuccessPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: trainerSlug } = await props.params;
  const { id: bookingId } = await props.searchParams;

  if (!bookingId) redirect(`/trainers/${trainerSlug}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/trainers/${trainerSlug}`);

  // Plain left joins (no !inner): if RLS happens to hide the trainer
  // row from the client (e.g. profile flipped to unpublished between
  // the redirect and this read), we still render the confirmation
  // with the slug-based fallback name instead of returning 404.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, start_time, price, service_name, service_duration, service:services(name, duration), trainer:trainers(id, slug, location, profile:profiles(display_name))")
    .eq("id", bookingId)
    .eq("client_id", user.id)
    .maybeSingle();

  // PostgREST returns nested rows as either an object or an array depending on the join shape;
  // normalise by always picking the first element when given an array.
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  type TrainerJoin = { profile?: { display_name?: string | null } | { display_name?: string | null }[] | null };
  type ServiceJoin = { name: string | null };

  // Render even if the booking row can't be read — the row was just
  // inserted by the action. We fall back to the slug for the trainer
  // name and a generic "Sesja" / "wkrótce" for missing fields.
  const trainer = booking
    ? pickOne(booking.trainer as TrainerJoin | TrainerJoin[] | null)
    : null;
  const service = booking
    ? pickOne(booking.service as ServiceJoin | ServiceJoin[] | null)
    : null;
  const trainerName =
    (trainer ? pickOne(trainer.profile)?.display_name : null) ?? trainerSlug.replace(/-/g, " ");

  const startDate = booking?.start_time ? new Date(booking.start_time) : null;
  const dateLabel = startDate
    ? startDate.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "long" })
    : "—";
  const timeLabel = startDate
    ? startDate.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
    : "";
  const serviceName =
    (booking as { service_name?: string | null } | null)?.service_name ?? service?.name ?? "Sesja";
  const bookingNum = `#${String(booking?.id ?? bookingId).slice(0, 8).toUpperCase()}`;

  return (
    <div className="mx-auto max-w-[520px] px-5 sm:px-6 py-12 sm:py-16 text-center">
      <div className="flex justify-center mb-5">
        <SuccessRing size={88} />
      </div>
      <h1 className="text-[22px] font-semibold tracking-tight">Sesja zarezerwowana</h1>
      <p className="text-[14px] text-slate-600 mt-2 mb-6 max-w-[320px] mx-auto leading-relaxed">
        Wysłaliśmy potwierdzenie na Twój email. Trener zobaczy Twoją rezerwację za chwilę.
      </p>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-left grid gap-2 mb-5 max-w-[360px] mx-auto">
        <Row label="Trener" value={trainerName} />
        <Row label="Termin" value={timeLabel ? `${dateLabel} · ${timeLabel}` : "Szczegóły w Moich rezerwacjach"} />
        <Row label="Usługa" value={serviceName} />
        <Row label="Nr" value={bookingNum} mono />
      </div>

      <div className="flex gap-2 justify-center flex-wrap">
        <Link
          href="/account/bookings"
          className="h-10 inline-flex items-center px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-800 hover:border-slate-400 transition"
        >
          Moje rezerwacje
        </Link>
        <Link
          href={`/trainers/${trainerSlug}`}
          className="h-10 inline-flex items-center px-4 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-black transition"
        >
          Wróć do profilu
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className={`text-slate-900 font-medium ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
