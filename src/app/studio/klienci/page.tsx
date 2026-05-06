import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddClientButton from "./AddClientButton";

type ClientRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  goal: string | null;
  tags: string[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * /studio/klienci — trainer's client roster.
 *
 * Shows trainer_clients rows (manual entries + auto-imported from
 * bookings — auto-import lands in createBooking in a later iteration).
 * Search filters by display_name / email / phone client-side; for
 * 50-200 clients no need for server-side full-text yet.
 *
 * Tolerant of migration 023 not being applied — empty list with a
 * "Funkcja wkrótce" notice.
 */
export default async function KlienciList() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/klienci");

  const { data: clients, error } = await supabase
    .from("trainer_clients")
    .select("id, display_name, email, phone, goal, tags, archived_at, created_at, updated_at")
    .eq("trainer_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  // Migration 023 not applied — graceful fallback.
  const migrationMissing = error?.code === "42P01";
  const list = (clients ?? []) as ClientRow[];

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-slate-900 m-0">
            Klienci
          </h1>
          <p className="text-[13px] text-slate-500 mt-1 m-0">
            {list.length} {list.length === 1 ? "klient" : list.length < 5 ? "klienci" : "klientów"}
            {list.length > 0 ? " — kliknij żeby zobaczyć szczegóły" : ""}
          </p>
        </div>
        <AddClientButton />
      </header>

      {migrationMissing ? (
        <EmptyMigrationNotice />
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-2">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/studio/klienci/${c.id}`}
                className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-sm transition"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-[14px] shrink-0">
                  {(c.display_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14.5px] font-semibold tracking-tight text-slate-900 truncate">
                      {c.display_name}
                    </span>
                    {c.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10.5px] tracking-[0.04em] uppercase font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-px rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {c.goal && (
                    <p className="text-[12.5px] text-slate-600 mt-0.5 line-clamp-1 m-0">
                      🎯 {c.goal}
                    </p>
                  )}
                  <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span className="truncate">✉️ {c.email}</span>}
                    {!c.phone && !c.email && <span className="italic">brak kontaktu</span>}
                  </div>
                </div>
                <div className="shrink-0 text-slate-400 mt-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 px-6 text-center">
      <p className="text-[15px] text-slate-700 font-medium m-0">
        Jeszcze nikogo na liście.
      </p>
      <p className="text-[13px] text-slate-500 mt-2 max-w-[440px] mx-auto m-0">
        Dodaj klientów ręcznie (np. tych co płacą gotówką) — będziesz mieć
        ich notatki, cele i historię w jednym miejscu. Klienci platformowi
        też się tutaj pojawią automatycznie po pierwszej rezerwacji.
      </p>
    </div>
  );
}

function EmptyMigrationNotice() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 py-12 px-6 text-center">
      <p className="text-[14px] text-amber-800 font-semibold m-0">
        Funkcja wkrótce dostępna
      </p>
      <p className="text-[12.5px] text-amber-700 mt-2 max-w-[480px] mx-auto m-0">
        Sekcja Klienci wymaga migracji 023. Zastosuj ją w panelu Supabase, a
        roster zacznie działać.
      </p>
    </div>
  );
}
