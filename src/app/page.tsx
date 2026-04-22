import Link from "next/link";
import { specializations } from "@/data/specializations";
import { trainers } from "@/data/mock-trainers";
import TrainerCard from "@/components/TrainerCard";

export default function Home() {
  const topTrainers = trainers.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Znajdź trenera idealnego dla{" "}
            <span className="text-emerald-200">Ciebie</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-emerald-100">
            Zdorovite to platforma, gdzie najlepsi trenerzy w Polsce prezentują
            swoje usługi. Filtruj po specjalizacji, czytaj opinie i wybierz
            trenera dopasowanego do Twoich celów.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/trainers"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg shadow-emerald-900/20 hover:bg-emerald-50 transition"
            >
              Przeglądaj trenerów
            </Link>
            <Link
              href="#"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Dołącz jako trener
            </Link>
          </div>
        </div>
      </section>

      {/* Specializations */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900">
          Czego szukasz?
        </h2>
        <p className="mt-2 text-gray-600">
          Wybierz kategorię, która Cię interesuje
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {specializations.map((spec) => (
            <Link
              key={spec.id}
              href={`/trainers?spec=${spec.id}`}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md hover:border-emerald-300"
            >
              <span className="text-3xl">{spec.icon}</span>
              <span className="text-sm font-medium text-gray-700">
                {spec.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Top trainers */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Najwyżej oceniani trenerzy
              </h2>
              <p className="mt-2 text-gray-600">
                Sprawdź trenerów z najlepszymi opiniami
              </p>
            </div>
            <Link
              href="/trainers"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition"
            >
              Zobacz wszystkich &rarr;
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topTrainers.map((trainer) => (
              <TrainerCard key={trainer.id} trainer={trainer} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-2xl bg-emerald-600 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Jesteś trenerem? Dołącz do Zdorovite!
          </h2>
          <p className="mt-3 text-emerald-100 max-w-lg mx-auto">
            Stwórz swoją profesjonalną wizytówkę, pokaż usługi i portfolio,
            docieraj do nowych klientów.
          </p>
          <Link
            href="#"
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg hover:bg-emerald-50 transition"
          >
            Zarejestruj się za darmo
          </Link>
        </div>
      </section>
    </div>
  );
}
