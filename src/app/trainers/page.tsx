"use client";

import { useState } from "react";
import Link from "next/link";
import { Specialization } from "@/types";
import { trainers } from "@/data/mock-trainers";
import { specializations } from "@/data/specializations";
import TrainerCard from "@/components/TrainerCard";

export default function TrainersPage() {
  const [filters, setFilters] = useState<Specialization[]>([]);

  const filtered =
    filters.length === 0
      ? trainers
      : trainers.filter((t) =>
          filters.some((f) => t.specializations.includes(f))
        );

  function toggle(id: Specialization) {
    setFilters((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  return (
    <div>
      {/* Search hero */}
      <section className="bg-gradient-to-b from-green-50 to-white border-b border-slate-200">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-6 pb-7">
          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-1.5 text-[13px] text-slate-500 mb-4">
            <Link href="/" className="hover:text-slate-900 transition">Strona główna</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            <span className="text-slate-900">Katalog trenerów</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Trenerzy personalni w Polsce
          </h1>
          <p className="text-[15px] text-slate-600 mt-2 mb-6">
            {trainers.length} zweryfikowanych ekspertów. Dopasuj filtry poniżej.
          </p>

          {/* Search bar */}
          <div className="hidden sm:grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm max-w-[960px]">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] hover:bg-slate-50 transition cursor-pointer">
              <svg className="text-slate-500 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-[0.06em] font-medium">Specjalizacja</div>
                <div className="text-sm text-slate-900 font-medium">Dowolna</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] hover:bg-slate-50 transition cursor-pointer">
              <svg className="text-slate-500 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-[0.06em] font-medium">Miasto</div>
                <div className="text-sm text-slate-900 font-medium">Warszawa</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] hover:bg-slate-50 transition cursor-pointer">
              <svg className="text-slate-500 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-[0.06em] font-medium">Termin</div>
                <div className="text-sm text-slate-400">Dowolny</div>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              Szukaj
            </button>
          </div>
        </div>
      </section>

      {/* Sticky filter pills */}
      <section className="sticky top-16 z-40 bg-white/92 backdrop-blur-lg border-b border-slate-200">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-3.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {specializations.map((spec) => {
            const active = filters.includes(spec.id);
            return (
              <button
                key={spec.id}
                onClick={() => toggle(spec.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[13px] font-medium border transition ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                <span>{spec.icon}</span>
                {spec.label}
              </button>
            );
          })}
          <div className="w-px h-6 bg-slate-200 shrink-0" />
          <button className="shrink-0 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[13px] font-medium border border-slate-200 bg-white text-slate-700 hover:border-slate-400 transition">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
            Więcej filtrów
          </button>
          {filters.length > 0 && (
            <button
              onClick={() => setFilters([])}
              className="shrink-0 text-[13px] font-medium text-slate-500 hover:text-slate-700 transition px-2"
            >
              Wyczyść
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* Results row */}
        <div className="flex justify-between items-center py-5">
          <div className="text-[15px] text-slate-700">
            <strong className="text-slate-900 font-semibold">{filtered.length} trenerów</strong>
            {filters.length > 0 && (
              <span> · {filters.map((f) => specializations.find((s) => s.id === f)?.label).join(", ")}</span>
            )}
          </div>
          <button className="hidden sm:inline-flex items-center gap-2.5 px-3.5 py-2 border border-slate-200 rounded-[10px] bg-white text-[13px] hover:border-slate-400 transition">
            Sortuj: <strong className="text-slate-900">Najlepsze dopasowanie</strong>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>

        {/* Layout: sidebar + grid */}
        <div className="sm:grid sm:grid-cols-[260px_1fr] sm:gap-8 pb-16">
          {/* Sidebar — desktop only */}
          <aside className="hidden sm:block sticky top-[144px] self-start space-y-4">
            {/* Price */}
            <div className="border border-slate-200 rounded-[14px] p-4.5 bg-white">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-900 mb-3">Cena (zł / sesja)</h4>
              <div className="relative h-1 bg-slate-200 rounded-full mt-2.5">
                <div className="absolute left-[15%] right-[25%] top-0 bottom-0 bg-emerald-500 rounded-full" />
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-sm" style={{ left: "15%" }} />
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-sm" style={{ left: "75%" }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-mono mt-2">
                <span>60 zł</span><span>350 zł</span>
              </div>
            </div>

            {/* Rating */}
            <div className="border border-slate-200 rounded-[14px] p-4.5 bg-white">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-900 mb-3">Ocena</h4>
              {[
                { label: "4.5★ i wyżej", count: 184, checked: true },
                { label: "4.0★ i wyżej", count: 248, checked: false },
                { label: "Wszystkie", count: 284, checked: false },
              ].map((item) => (
                <label key={item.label} className="flex items-center justify-between py-1.5 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
                  <span className="inline-flex items-center gap-2.5">
                    <input type="checkbox" defaultChecked={item.checked} className="w-4 h-4 accent-emerald-500" />
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-400">{item.count}</span>
                </label>
              ))}
            </div>

            {/* Training type */}
            <div className="border border-slate-200 rounded-[14px] p-4.5 bg-white">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-900 mb-3">Rodzaj treningu</h4>
              {[
                { label: "W sali", count: 142, checked: true },
                { label: "U klienta", count: 88, checked: true },
                { label: "Online", count: 96, checked: false },
                { label: "W parku", count: 42, checked: false },
              ].map((item) => (
                <label key={item.label} className="flex items-center justify-between py-1.5 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
                  <span className="inline-flex items-center gap-2.5">
                    <input type="checkbox" defaultChecked={item.checked} className="w-4 h-4 accent-emerald-500" />
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-400">{item.count}</span>
                </label>
              ))}
            </div>

            {/* Languages */}
            <div className="border border-slate-200 rounded-[14px] p-4.5 bg-white">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-900 mb-3">Języki</h4>
              {[
                { label: "Polski", count: 284, checked: true },
                { label: "Angielski", count: 187, checked: false },
                { label: "Niemiecki", count: 34, checked: false },
                { label: "Ukraiński", count: 62, checked: false },
              ].map((item) => (
                <label key={item.label} className="flex items-center justify-between py-1.5 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
                  <span className="inline-flex items-center gap-2.5">
                    <input type="checkbox" defaultChecked={item.checked} className="w-4 h-4 accent-emerald-500" />
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-400">{item.count}</span>
                </label>
              ))}
            </div>

            <button className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:border-slate-400 transition">
              Wyczyść filtry
            </button>
          </aside>

          {/* Grid */}
          <div>
            {filtered.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
                <p className="text-lg font-medium text-slate-500">Brak trenerów dla wybranych filtrów</p>
                <button onClick={() => setFilters([])} className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                  Wyczyść filtry
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((trainer) => (
                  <TrainerCard key={trainer.id} trainer={trainer} />
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-1.5 pt-12">
              <button className="min-w-[40px] h-10 rounded-[10px] border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center hover:border-slate-400 transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button className="min-w-[40px] h-10 rounded-[10px] bg-slate-900 text-white text-sm font-medium inline-flex items-center justify-center">1</button>
              <button className="min-w-[40px] h-10 rounded-[10px] border border-slate-200 bg-white text-slate-700 text-sm font-medium inline-flex items-center justify-center hover:border-slate-400 transition">2</button>
              <button className="min-w-[40px] h-10 rounded-[10px] border border-slate-200 bg-white text-slate-700 text-sm font-medium inline-flex items-center justify-center hover:border-slate-400 transition">3</button>
              <span className="px-2 text-slate-400">…</span>
              <button className="min-w-[40px] h-10 rounded-[10px] border border-slate-200 bg-white text-slate-700 text-sm font-medium inline-flex items-center justify-center hover:border-slate-400 transition">24</button>
              <button className="min-w-[40px] h-10 rounded-[10px] border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center hover:border-slate-400 transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
