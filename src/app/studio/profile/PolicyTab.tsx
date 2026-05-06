"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglePublished } from "@/app/trainers/[id]/edit-actions";

/**
 * Polityka i prywatność tab — combines two account-level controls that
 * affect what's visible on the public profile but aren't editable
 * fields per se: publish toggle and the "danger zone" (hide profile,
 * delete account). Hide-profile is the same operation as un-publishing,
 * exposed here for users who think of it as a different gesture.
 */
export default function PolicyTab({ slug: _slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleHide = () => {
    if (!confirm("Schować profil? Nowi klienci nie będą Cię widzieć w katalogu, dotychczasowe sesje i historia pozostają.")) {
      return;
    }
    startTransition(async () => {
      await togglePublished();
      router.refresh();
    });
  };

  const handleDelete = () => {
    alert("Usunięcie konta wymaga kontaktu z zespołem. Napisz na pomoc@nazdrow.pl — odpowiadamy w ciągu 24 godz.");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">Widoczność profilu</h3>
        <p className="text-[12px] text-slate-500 mt-1 mb-4 leading-[1.55] max-w-[640px]">
          Aby publikować profil, musisz mieć wypełnione: zdjęcie, bio, co najmniej 3 specjalizacje,
          1 usługę i 1 certyfikat. Schowanie profilu zatrzymuje nowe rezerwacje, ale historia i
          bieżące sesje pozostają.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/studio/design"
            className="text-[13px] font-medium px-3.5 py-2 rounded-[9px] bg-slate-900 text-white hover:bg-black"
          >
            Otwórz edytor profilu
          </Link>
          <Link
            href="/studio/availability"
            className="text-[13px] font-medium px-3.5 py-2 rounded-[9px] bg-white border border-slate-200 hover:bg-slate-50"
          >
            Godziny pracy
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">Adres profilu (slug)</h3>
        <p className="text-[12px] text-slate-500 mt-1 mb-3 leading-[1.55]">
          Adres URL, pod którym Twój profil jest dostępny publicznie. Zmiana wymaga kontaktu z zespołem
          — przekierujemy stary link do nowego, żebyś nie stracił/a SEO.
        </p>
        <code className="bg-slate-100 px-2 py-1 rounded text-[12px]">
          nazdrow.pl/trainers/{_slug}
        </code>
      </section>

      <section
        className="rounded-2xl border p-5 sm:p-6"
        style={{ background: "#fef2f2", borderColor: "#fecaca" }}
      >
        <h3 className="m-0 text-[14px] font-bold text-rose-700">Strefa niebezpieczna</h3>
        <p className="text-[12px] text-rose-900/80 mt-1.5 mb-3.5 leading-[1.55]">
          Schowanie profilu zatrzymuje nowe rezerwacje, ale historia i bieżące sesje pozostają.
          Usunięcie konta jest nieodwracalne.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleHide}
            disabled={pending}
            className="text-[12.5px] font-semibold bg-white text-rose-700 border border-rose-200 px-3.5 py-2 rounded-[8px] hover:bg-rose-50 disabled:opacity-50"
          >
            Schowaj profil
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="text-[12.5px] font-semibold bg-white text-rose-700 border border-rose-200 px-3.5 py-2 rounded-[8px] hover:bg-rose-50"
          >
            Usuń konto
          </button>
        </div>
      </section>
    </div>
  );
}
