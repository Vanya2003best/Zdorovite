import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Kupony — placeholder route. Full feature lands later (discount codes
 * the trainer can attach to packages / hand to clients to seed referrals).
 * For now the sidebar link points here and the page surfaces a "coming
 * soon" panel instead of 404'ing.
 */
export default async function StudioKuponyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/kupony");

  return (
    <div className="mx-auto max-w-[860px] px-6 sm:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] m-0">Kupony</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Kody rabatowe dla pakietów i jednorazowych sesji.
        </p>
      </header>

      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 py-16 text-center">
        <div className="text-3xl mb-3">🎟️</div>
        <p className="text-[15px] font-semibold text-slate-700 m-0">Wkrótce</p>
        <p className="text-[13px] text-slate-500 mt-1.5 max-w-[420px] mx-auto leading-relaxed">
          Pracujemy nad generatorem kuponów (procentowe rabaty, dwa-za-jeden,
          zniżki na pakiety). Damy znać gdy będzie gotowe.
        </p>
      </div>
    </div>
  );
}
