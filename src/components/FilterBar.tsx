"use client";

import { useState } from "react";
import { Specialization } from "@/types";
import { specializations } from "@/data/specializations";

interface FilterBarProps {
  selected: Specialization[];
  onFilterChange: (filters: Specialization[]) => void;
}

export default function FilterBar({ selected, onFilterChange }: FilterBarProps) {
  const [search, setSearch] = useState("");

  function toggle(id: Specialization) {
    if (selected.includes(id)) {
      onFilterChange(selected.filter((s) => s !== id));
    } else {
      onFilterChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj trenera po imieniu lub mieście..."
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pl-10 text-sm shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {specializations.map((spec) => {
          const active = selected.includes(spec.id);
          return (
            <button
              key={spec.id}
              onClick={() => toggle(spec.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-gray-300 bg-white text-gray-700 hover:border-emerald-400 hover:bg-emerald-50"
              }`}
            >
              <span>{spec.icon}</span>
              {spec.label}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button
            onClick={() => onFilterChange([])}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            Wyczyść filtry
          </button>
        )}
      </div>
    </div>
  );
}

export { type FilterBarProps };
