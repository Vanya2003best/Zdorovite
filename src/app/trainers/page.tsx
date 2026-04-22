"use client";

import { useState } from "react";
import { Specialization } from "@/types";
import { trainers } from "@/data/mock-trainers";
import TrainerCard from "@/components/TrainerCard";
import FilterBar from "@/components/FilterBar";

export default function TrainersPage() {
  const [filters, setFilters] = useState<Specialization[]>([]);

  const filtered =
    filters.length === 0
      ? trainers
      : trainers.filter((t) =>
          filters.some((f) => t.specializations.includes(f))
        );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Znajdź trenera</h1>
        <p className="mt-2 text-gray-600">
          {trainers.length} trenerów gotowych Ci pomóc
        </p>
      </div>

      <FilterBar selected={filters} onFilterChange={setFilters} />

      <div className="mt-8">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 py-16 text-center">
            <p className="text-lg font-medium text-gray-500">
              Brak trenerów dla wybranych filtrów
            </p>
            <button
              onClick={() => setFilters([])}
              className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Wyczyść filtry
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((trainer) => (
              <TrainerCard key={trainer.id} trainer={trainer} />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Wyświetlono {filtered.length} z {trainers.length} trenerów
        </p>
      </div>
    </div>
  );
}
