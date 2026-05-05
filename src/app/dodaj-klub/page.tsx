import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AddClubForm from "./AddClubForm";

/**
 * /dodaj-klub — public page for gym managers to register their club on
 * NaZdrow!. Two paths:
 *  - Register a NEW chain (and the first branch under it)
 *  - Add a branch to an EXISTING chain (Zdrofit, Calypso, …)
 *
 * Submission creates a `pending` row visible only to its registrant via
 * RLS until NaZdrow! verifies. After verification the branch lands on
 * /sieci/[chain]/[branch] and trainers can self-claim affiliation.
 *
 * Auth-gated: must be signed in (so we can attribute registered_by + the
 * registrant can come back and see status). Anonymous → /login?next=...
 */
export default async function AddClubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dodaj-klub");

  // Pull list of active chains for the dropdown. New-chain mode is also
  // available (the form lets the user toggle between existing-chain and
  // new-chain). Sorted alphabetically — there are 4-10 chains in PL, no
  // search needed.
  const { data: chains } = await supabase
    .from("gym_chains")
    .select("id, name, slug")
    .eq("status", "active")
    .order("name");

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section className="px-4 sm:px-6 pt-12 pb-8 sm:pt-16">
          <div className="max-w-[760px] mx-auto">
            <div className="flex items-center gap-2 mb-4 text-[12.5px] text-slate-500">
              <Link href="/" className="hover:text-slate-800">Główna</Link>
              <span>/</span>
              <span className="text-slate-700">Dla klubów</span>
            </div>
            <h1 className="text-[32px] sm:text-[44px] font-semibold tracking-[-0.02em] text-slate-900 m-0 leading-[1.05]">
              Twój klub na NaZdrow!
            </h1>
            <p className="text-[15px] sm:text-[17px] text-slate-600 mt-4 leading-[1.55] max-w-[640px]">
              Pasywny rekruting trenerów. Klub w katalogu. Bez umowy, bez prowizji,
              bez SEO. Trenerzy zgłaszają się sami — Ty potwierdzasz w jednym kliknięciu.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 sm:px-6 pb-10">
          <div className="max-w-[760px] mx-auto grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Zgłoś klub",
                body: "Wypełnij krótki formularz — nazwa, adres, kontakt menedżera. Zajmuje 2 minuty.",
              },
              {
                step: "2",
                title: "Weryfikacja w 48h",
                body: "Dzwonimy lub piszemy żeby potwierdzić, że jesteś faktycznym przedstawicielem klubu.",
              },
              {
                step: "3",
                title: "Trenerzy się zgłaszają",
                body: "Twój klub trafia do katalogu. Trenerzy zgłaszają afiliację — Ty zatwierdzasz lub odrzucasz.",
              },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-[28px] font-semibold tracking-tight text-slate-300 leading-none">
                  {s.step}
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight mt-3 mb-1.5">
                  {s.title}
                </h3>
                <p className="text-[12.5px] text-slate-600 leading-[1.5] m-0">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Form */}
        <section className="px-4 sm:px-6 pb-16">
          <div className="max-w-[760px] mx-auto">
            <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-slate-900 mb-5">
              Zgłoś klub
            </h2>
            <AddClubForm chains={chains ?? []} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
