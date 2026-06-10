import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrainerBySlug } from "@/lib/db/trainers";
import { getAvailableSlots } from "@/lib/db/availability";
import { warsawDateOffset } from "@/lib/time";
import PackageBookingForm from "./PackageBookingForm";

type SP = Promise<{ date?: string }>;

/**
 * Dedicated package-booking flow. Live at /trainers/[id]/book-package/[pkgId].
 *
 * The reason this is a separate route from /book?package=...:
 *   - bookings table has check (service_id is null) <> (package_id is null)
 *     so a package booking MUST have service_id null. The service flow
 *     requires the user to pick a service first, which then sets service_id.
 *   - The UX should not ask "which service?" when the user already paid for
 *     a package — it's confusing and the answer is "the package itself".
 *
 * This page only asks for the FIRST session's date+time. The remaining
 * sessions are scheduled with the trainer over chat (or via /studio
 * tooling later).
 */
export default async function BookPackagePage(props: {
  params: Promise<{ id: string; pkgId: string }>;
  searchParams: SP;
}) {
  const { id, pkgId } = await props.params;
  const { date: dateParam } = await props.searchParams;

  const trainer = await getTrainerBySlug(id);
  if (!trainer) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/trainers/${id}/book-package/${pkgId}`);
  }

  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", id)
    .single();
  if (!trainerRow) notFound();

  const { data: pkg } = await supabase
    .from("packages")
    .select("id, name, description, items, price, period")
    .eq("id", pkgId)
    .eq("trainer_id", trainerRow.id)
    .maybeSingle();
  if (!pkg) notFound();

  const today = warsawDateOffset(0);
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const initialSlots = await getAvailableSlots(trainerRow.id, date);

  return (
    <div className="mx-auto max-w-[1100px] px-5 sm:px-6 py-8 sm:py-10 pb-24">
      <nav className="text-[13px] text-slate-500 mb-5 flex items-center gap-1.5">
        <Link
          href={`/trainers/${id}/checkout/${pkgId}`}
          className="hover:text-slate-900 transition inline-flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Wróć do podsumowania
        </Link>
      </nav>

      <PackageBookingForm
        trainerSlug={id}
        trainerId={trainerRow.id}
        trainerName={trainer.name}
        trainerAvatar={trainer.avatar}
        trainerAvatarFocal={trainer.avatarFocal}
        trainerLocation={trainer.location}
        pkg={{
          id: pkg.id,
          name: pkg.name,
          description: pkg.description ?? "",
          items: (pkg.items ?? []) as string[],
          price: pkg.price,
          period: pkg.period,
        }}
        initialDate={date}
        initialSlots={initialSlots}
      />
    </div>
  );
}
