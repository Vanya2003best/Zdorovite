import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientDetail from "./ClientDetail";

export default async function KlientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/studio/klienci/${id}`);

  const { data, error } = await supabase
    .from("trainer_clients")
    .select("id, display_name, email, phone, goal, notes, tags, created_at")
    .eq("id", id)
    .eq("trainer_id", user.id)
    .maybeSingle();

  // Migration 023 not applied → table missing → graceful 404 with hint.
  if (error?.code === "42P01") {
    return (
      <div className="mx-auto max-w-[860px] px-4 sm:px-8 py-10">
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 py-12 px-6 text-center">
          <p className="text-[14px] text-amber-800 font-semibold m-0">
            Funkcja wkrótce dostępna
          </p>
          <p className="text-[12.5px] text-amber-700 mt-2 m-0">
            Sekcja Klienci wymaga migracji 023.
          </p>
        </div>
      </div>
    );
  }

  if (!data) notFound();

  return (
    <ClientDetail
      client={{
        id: data.id,
        display_name: data.display_name,
        email: data.email,
        phone: data.phone,
        goal: data.goal,
        notes: data.notes,
        tags: data.tags ?? [],
        created_at: data.created_at,
      }}
    />
  );
}
