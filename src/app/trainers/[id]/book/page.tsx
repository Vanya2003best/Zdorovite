import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrainerBySlug } from "@/lib/db/trainers";
import { getAvailableSlots } from "@/lib/db/availability";
import { warsawDateOffset } from "@/lib/time";
import BookingForm from "./BookingForm";

type SP = Promise<{ date?: string; service?: string }>;

export default async function BookPage(props: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  const { id } = await props.params;
  const { date: dateParam, service: serviceParam } = await props.searchParams;

  const trainer = await getTrainerBySlug(id);
  if (!trainer) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/trainers/${id}/book`);

  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("id, services(id, name, description, duration, price, position)")
    .eq("slug", id)
    .single();
  if (!trainerRow) notFound();

  const services = (trainerRow.services ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration: s.duration,
      price: s.price,
    }));

  const today = warsawDateOffset(0);
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const initialSlots = await getAvailableSlots(trainerRow.id, date);

  return (
    <div className="mx-auto max-w-[1100px] px-5 sm:px-6 py-8 sm:py-10 pb-24">
      <nav className="text-[13px] text-slate-500 mb-5 flex items-center gap-1.5">
        <Link href={`/trainers/${id}`} className="hover:text-slate-900 transition inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Wróć do profilu
        </Link>
      </nav>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Ten trener nie udostępnił jeszcze żadnych usług.
        </div>
      ) : (
        <BookingForm
          trainerSlug={id}
          trainerId={trainerRow.id}
          trainerName={trainer.name}
          trainerAvatar={trainer.avatar}
          trainerLocation={trainer.location}
          services={services}
          initialServiceId={serviceParam && services.some((s) => s.id === serviceParam) ? serviceParam : undefined}
          initialDate={date}
          initialSlots={initialSlots}
        />
      )}
    </div>
  );
}
