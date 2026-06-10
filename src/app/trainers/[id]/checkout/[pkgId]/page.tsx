import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTrainerBySlug } from "@/lib/db/trainers";
import { createClient } from "@/lib/supabase/server";

export default async function PackageCheckoutPage(props: {
  params: Promise<{ id: string; pkgId: string }>;
}) {
  const { id, pkgId } = await props.params;

  const trainer = await getTrainerBySlug(id);
  if (!trainer) notFound();

  const pkg = (trainer.packages ?? []).find((p) => p.id === pkgId);
  if (!pkg) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/trainers/${id}/checkout/${pkgId}`);

  const total = pkg.price;

  return (
    <div className="mx-auto max-w-[920px] px-5 sm:px-6 py-8 sm:py-10 pb-24">
      <nav className="text-[13px] text-slate-500 mb-5 flex items-center gap-1.5">
        <Link href={`/trainers/${id}`} className="hover:text-slate-900 transition inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Wróć do profilu
        </Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[18px] bg-white border border-slate-200 p-6 sm:p-8 shadow-[0_1px_3px_rgba(2,6,23,.04)]">
          <div className="text-[11px] tracking-[0.12em] uppercase text-orange-600 font-semibold mb-2">
            Pakiet
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-semibold tracking-tight text-slate-900 mb-1">
            {pkg.name}
          </h1>
          {pkg.description && (
            <p className="text-[14px] text-slate-600 leading-relaxed mb-5">{pkg.description}</p>
          )}

          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="text-[12px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-3">
              Co zawiera pakiet
            </div>
            <ul className="grid gap-2.5">
              {pkg.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14px] text-slate-700 leading-relaxed">
                  <span className="mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-start gap-3">
              <span className="text-emerald-600 text-lg shrink-0 leading-none mt-0.5">💬</span>
              <div className="text-[13px] text-emerald-900 leading-relaxed">
                <strong className="font-semibold">Płatność u trenera bezpośrednio.</strong>
                {" "}Po kliknięciu „Zarezerwuj pakiet" otworzymy czat z trenerem — ustalicie formę płatności
                (BLIK, przelew lub gotówka), a po opłaceniu zaczynacie umawiać sesje.
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[18px] bg-white border border-slate-200 p-6 shadow-[0_1px_3px_rgba(2,6,23,.04)] h-fit lg:sticky lg:top-6">
          <div className="flex items-center gap-3 mb-5">
            {trainer.avatar && (
              <img
                src={trainer.avatar}
                alt=""
                className="w-10 h-10 rounded-[10px] object-cover"
                style={{ objectPosition: trainer.avatarFocal || "center" }}
              />
            )}
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900 truncate">{trainer.name}</div>
              <div className="text-[12px] text-slate-500 truncate">{trainer.location}</div>
            </div>
          </div>

          <div className="text-[12px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-2">
            Podsumowanie
          </div>
          <div className="grid gap-2 text-[14px]">
            <div className="flex justify-between">
              <span className="text-slate-600">{pkg.name}</span>
              <span className="text-slate-900 font-medium">{total.toLocaleString("pl-PL")} zł</span>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-slate-200">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-slate-600">Cena pakietu</span>
              <span className="text-[26px] font-semibold tracking-tight text-slate-900">
                {total.toLocaleString("pl-PL")} zł
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Płatność u trenera — BLIK, przelew lub gotówka
            </div>
          </div>

          <Link
            href={`/trainers/${id}/book-package/${pkg.id}`}
            className="mt-5 block w-full py-3.5 px-4 bg-slate-900 text-white rounded-full text-[14px] font-semibold hover:bg-black transition text-center"
          >
            Zarezerwuj pakiet
          </Link>

          <Link
            href={`/trainers/${id}#packages`}
            className="mt-3 block w-full py-3 text-center text-[13px] text-slate-600 hover:text-slate-900 transition"
          >
            Zmień pakiet
          </Link>
        </aside>
      </div>
    </div>
  );
}
