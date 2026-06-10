import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CLIENTS } from "@/data/mock-clients";
import ClientDetail from "./ClientDetail";

/**
 * /studio/klienci/[id] — client detail.
 *
 * Two ID shapes coexist while migration 023 (trainer_clients) is still
 * being rolled out everywhere:
 *   1. Real UUIDs from the trainer_clients table — fetched server-side.
 *   2. Mock IDs ("c-anna-nowak", "c-piotr-kowalski"…) from the /studio/
 *      klienci list, which still runs off `data/mock-clients.ts` until
 *      the CRM tables are wired end-to-end. We translate those into the
 *      same ClientData shape so the OLX-style detail design renders
 *      identically regardless of source.
 * Anything not in either set falls through to notFound().
 */
export default async function KlientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Mock branch — list still uses MOCK_CLIENTS, so any "c-*" id should
  // resolve client-side without ever touching supabase.
  if (id.startsWith("c-")) {
    const mock = MOCK_CLIENTS.find((m) => m.id === id);
    if (!mock) notFound();
    return (
      <ClientDetail
        client={{
          id: mock.id,
          display_name: mock.name,
          email: mock.email,
          phone: mock.phone,
          goal: null,
          notes: null,
          tags: mock.tags,
          // Mock created_at — approximate from "Klient od stycznia 2026"
          // style trailingMeta. Falls back to today when no date hint.
          created_at: new Date("2026-01-12").toISOString(),
        }}
      />
    );
  }

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
