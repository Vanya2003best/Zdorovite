"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Trainer, Specialization } from "@/types";
import { specializations } from "@/data/specializations";
import LocationPicker from "@/components/LocationPicker";

/**
 * URL-driven filter set. The supported fields (q, city, spec, price, sort, fav)
 * are honored by getTrainers() and produce a real narrowed result list. The
 * "unsupported" fields below (promo, since, format, time, gender, pro,
 * freeconsult, radius) are surfaced here so they show as active chips with
 * a working ×, but they don't yet narrow results — each is gated on a schema
 * addition (see TODO comments).
 */
export type CatalogFilters = {
  q?: string;
  city?: string;
  spec?: Specialization;
  price?: string;
  sort?: string;
  fav?: boolean;
  promo?: boolean;        // TODO: needs trainers.is_on_promo or promotions table
  since?: string;         // TODO: needs trainers.created_at
  format?: string;        // TODO: needs services.format flag
  time?: string;          // TODO: needs availability_rules aggregate
  gender?: string;        // TODO: needs profiles.gender
  pro?: boolean;          // TODO: needs trainers.tier
  freeconsult?: boolean;  // TODO: needs services.is_freeconsult
  radius?: string;        // TODO: needs trainers.lat/lng + user geolocation
};

/**
 * /trainers — OLX+ search results page.
 *
 * Visual reference: design 38-search-trenerzy-olx-plus.html.
 *
 * Layout (top → bottom):
 *   - Sticky search ribbon (4 fields + Szukaj button) under the dark
 *     studio chrome header
 *   - Breadcrumb row
 *   - Active filter chips with × and "Obserwuj wyszukiwanie"
 *   - Filters card — 10 dropdowns in a 5-col grid + price presets +
 *     checkbox row
 *   - Category sub-tabs (Wszystkie · Siłownia · Crossfit · …) with counts
 *   - Results header (count h1 + sort + view-toggle)
 *   - Two-column body: result cards on the left, sticky map + price
 *     insights + alert + similar searches on the right
 *   - SEO/FAQ section + related queries
 *
 * What's real vs mocked:
 *   - Trainer data (name, rating, reviewCount, priceFrom, location,
 *     specializations, avatar) — real from getTrainers().
 *   - Filtering (text query + specialization toggle) — real client-side.
 *   - Subtab counts — real (derived from `trainers.specializations`).
 *   - Active chips, filter dropdowns, price presets, checkboxes —
 *     mostly VISUAL only. Each control is wired to nothing yet; the
 *     existing query + specialization filters do the real work below.
 *   - Map pins, price insights, "obserwuj wyszukiwanie", availability
 *     slots, distance, badges (Pro / response time / VAT / cert / first
 *     session free) — MOCK. Each marked inline with the migration that
 *     would replace it.
 */

// V1.5 refined: deeper gradients (start → 600/700 stop) for richer photo
// blocks, paired with a radial-highlight overlay in the card itself.
const AVATAR_GRADIENTS = [
  "from-orange-400 to-orange-700",      // g1
  "from-cyan-400 to-cyan-800",          // g2
  "from-pink-400 to-pink-800",          // g3
  "from-slate-400 to-slate-700",        // g4
  "from-emerald-400 to-emerald-800",    // g5
  "from-violet-400 to-violet-800",      // g6
  "from-amber-300 to-amber-700",
  "from-blue-400 to-blue-800",
];

// MOCK: per-trainer availability slot. Real impl needs a derived view
// over `availability_rules` + `bookings` showing the next free hour.
const NEXT_SLOTS = ["dziś, 18:00", "jutro, 7:00", "dziś, 16:30", "piątek, 19:00", "dziś, 19:30", "jutro, 6:30"];

// MOCK: km from user. Real needs geolocation API + trainers.lat/lng.
const DISTANCES = ["1,2", "2,4", "3,8", "5,1", "0,8", "4,2"];

// MOCK: response-time badge. Real needs avg(messages.read_at - sent_at).
const RESPONSE_TIMES = ["15 min", "1h", "30 min", "2h", "45 min"];

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

type Props = {
  trainers: Trainer[];
  isLoggedIn: boolean;
  favActive: boolean;
  filters: CatalogFilters;
};

export default function CatalogClient({ trainers, favActive, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state mirrors the URL so typing in q/city is snappy without a
  // server round-trip per keystroke. On submit (`form action="/"`) the
  // form serializes these into URL params and the server re-filters.
  //
  // City input intentionally starts EMPTY (and is NOT synced from
  // filters.city) — OLX behavior: the location field is for entering a
  // NEW search, not displaying current state. The current city filter
  // is shown in the FilterChipRow below; user can click × to clear or
  // type something new to overwrite.
  const [query, setQuery] = useState(filters.q ?? "");
  const [city, setCity] = useState("");
  const [activeSpec, setActiveSpec] = useState<Specialization | "all">(filters.spec ?? "all");
  const [view, setView] = useState<"list" | "grid" | "map">("list");

  // Sync local state when URL changes (back/forward, chip removal, etc.)
  useEffect(() => { setQuery(filters.q ?? ""); }, [filters.q]);
  useEffect(() => { setActiveSpec(filters.spec ?? "all"); }, [filters.spec]);

  /** Update one or more URL params, leaving the rest intact. Pass `null`
   *  to remove a param. Uses `replace` (not push) so chip × actions don't
   *  spam history. */
  function updateUrl(patches: Record<string, string | null>, scrollToResults = true) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(patches)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    const hash = scrollToResults ? "#wyniki" : "";
    router.replace(pathname + (qs ? `?${qs}` : "") + hash);
  }

  const q = normalize(query.trim());

  // Real filter pipeline: text query (>=2 chars) on name + spec match
  const filtered = useMemo(
    () =>
      trainers.filter((t) => {
        if (activeSpec !== "all" && !t.specializations.includes(activeSpec)) return false;
        if (q.length >= 2 && !normalize(t.name).includes(q)) return false;
        return true;
      }),
    [trainers, q, activeSpec],
  );

  // Real counts per specialization for the subtabs
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: trainers.length };
    for (const s of specializations) {
      m[s.id] = trainers.filter((t) => t.specializations.includes(s.id)).length;
    }
    return m;
  }, [trainers]);

  // Real price stats for the insights side card
  const priceStats = useMemo(() => {
    const prices = filtered.map((t) => t.priceFrom).filter((p) => p > 0).sort((a, b) => a - b);
    if (prices.length === 0) return { median: 0, min: 0, max: 0, inBudget: 0 };
    const median = prices[Math.floor(prices.length / 2)];
    const inBudget = Math.round((prices.filter((p) => p >= 80 && p <= 200).length / prices.length) * 100);
    return { median, min: prices[0], max: prices[prices.length - 1], inBudget };
  }, [filtered]);

  // Top 8 subtabs sorted by count desc (after "Wszystkie")
  const subtabSpecs = useMemo(
    () =>
      [...specializations]
        .map((s) => ({ ...s, count: counts[s.id] ?? 0 }))
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 7),
    [counts],
  );

  // Infinite-scroll display window. Auto-loads first AUTO_LOAD_CAP cards
  // as user scrolls, then stops to keep the footer / SEO / city-grid
  // reachable — beyond the cap the user has to click "Pokaż więcej" to
  // expand, otherwise they can scroll past to the rest of the page.
  // Reset both counters whenever the active filter changes.
  const PAGE_SIZE = 6;
  const AUTO_LOAD_CAP = 30;
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [activeSpec, query, city, favActive]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Auto-load only kicks in until we hit the cap. After that the
    // sentinel is replaced by a manual "Pokaż więcej" button.
    if (displayCount >= AUTO_LOAD_CAP) return;
    if (displayCount >= filtered.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDisplayCount((n) => Math.min(n + PAGE_SIZE, AUTO_LOAD_CAP, filtered.length));
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [displayCount, filtered.length]);

  const visibleResults = filtered.slice(0, displayCount);
  const atAutoCap = displayCount >= AUTO_LOAD_CAP && displayCount < filtered.length;
  const remaining = filtered.length - displayCount;

  // Sticky context header — shown when user has scrolled past the dark
  // teal hero (~240px). Pinned BELOW the public header (top-16 = 64px,
  // matching h-16 chrome height) at z-40 so it slides in under the
  // header instead of covering it.
  const [showContext, setShowContext] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setShowContext(window.scrollY > 240);
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const activeSpecLabel = activeSpec !== "all"
    ? specializations.find((sp) => sp.id === activeSpec)?.label
    : null;

  return (
    <div className="bg-slate-100 min-h-screen">

      {/* ====================== STICKY CONTEXT BAR ====================== */}
      {/* Pinned just under the public header (top-16, z-40). Slides in
          when the hero scrolls out of view. Active chips here have ×
          handlers to clear filters without scrolling back up. */}
      <div
        className={
          "fixed top-16 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-transform duration-200 " +
          (showContext ? "translate-y-0" : "-translate-y-[150%] pointer-events-none")
        }
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-14 flex items-center gap-3 flex-wrap">
          <h2 className="text-[15px] font-extrabold text-[#002f34] tracking-[-0.01em] m-0 truncate min-w-0">
            Trenerzy{city ? ` w ${city}` : ""} · <span className="text-emerald-600">{filtered.length}</span> ofert
          </h2>
          {/* Chip cluster is desktop-only — on mobile the 56px bar keeps
              just the count + jump-to-search so nothing overflows. */}
          {(activeSpecLabel || city) && (
            <div className="hidden sm:flex items-center gap-3">
              <span className="w-px h-4 bg-slate-200" />
              <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold">Filtry:</span>
              {city && (
                <button
                  type="button"
                  onClick={() => updateUrl({ city: null })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#002f34] text-white rounded text-[11.5px] font-semibold hover:bg-slate-900 transition"
                >
                  {city}
                  <span className="opacity-60 text-[12px]">×</span>
                </button>
              )}
              {activeSpecLabel && (
                <button
                  type="button"
                  onClick={() => updateUrl({ spec: null })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#002f34] text-white rounded text-[11.5px] font-semibold hover:bg-slate-900 transition"
                >
                  {activeSpecLabel}
                  <span className="opacity-60 text-[12px]">×</span>
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="ml-auto shrink-0 text-[12px] text-slate-500 font-semibold hover:text-[#002f34] inline-flex items-center gap-1 min-h-[44px] sm:min-h-0"
          >
            ↑ Wyszukiwarka
          </button>
        </div>
      </div>

      {/* ====================== DARK TEAL HERO ====================== */}
      {/* Marketing-style hero — generic title + social-proof stats line
          above the search-card. The dynamic per-search title ("Trenerzy
          w Warszawie · 7 ofert") and filter chips live in the sticky
          context bar above instead, shown once user scrolls past hero. */}
      <section className="text-white pt-6 pb-6" style={{ background: "#002f34" }}>
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <h1 className="m-0 mb-2 text-[24px] sm:text-[36px] leading-[1.15] sm:leading-[1.1] tracking-[-0.025em] font-bold">
            Znajdź trenera personalnego w Polsce
          </h1>
          <p className="text-[13px] sm:text-[15px] text-white/75 max-w-[640px] mb-5 m-0">
            {/* MOCK: hardcoded marketing copy — replace with real COUNT()
                queries when we want live numbers in the hero. */}
            <b className="text-white font-bold">240 zweryfikowanych trenerów</b> · <b className="text-white font-bold">12 400 opinii</b> · <b className="text-white font-bold">38 000 odbytych sesji</b>
          </p>

          {/* Mobile (<sm): 2-col grid — q and city full-width rows, radius +
              price side by side, format below, big Szukaj at the bottom.
              Each cell gets its own border + taller padding for touch. The
              `order-*` utilities only reorder the mobile grid; at sm+ every
              cell resets to DOM order and the original single-row layout
              with 1px divider columns stays pixel-identical. */}
          <form
            action="/#wyniki"
            className="grid grid-cols-2 sm:grid-cols-[1.4fr_1px_1.1fr_1px_0.85fr_1px_0.95fr_1px_0.9fr_140px] gap-1.5 sm:gap-0 items-stretch bg-white border-[1.5px] border-[#002f34] rounded-[10px] p-1.5 sm:p-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          >
            <label className="col-span-2 sm:col-span-1 border border-slate-200 sm:border-0 min-h-[52px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 cursor-pointer min-w-0 hover:bg-slate-100 rounded-md transition">
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold leading-tight">Czego szukasz</div>
              <input
                name="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="trener personalny — siłownia"
                className="text-[13.5px] text-slate-900 font-semibold w-full border-0 outline-none bg-transparent placeholder:text-slate-400 min-h-[28px] sm:min-h-0"
              />
            </label>
            <div className="bg-slate-200 my-1 hidden sm:block" />
            <div className="col-span-2 sm:col-span-1 border border-slate-200 sm:border-0 min-h-[52px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 min-w-0 hover:bg-slate-100 rounded-md transition">
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold leading-tight">Lokalizacja</div>
              <LocationPicker
                name="city"
                value={city}
                onChange={setCity}
                onPick={(v) => updateUrl({ city: v.length > 0 ? v : null })}
                placeholder="Cała Polska — wpisz miasto"
              />
            </div>
            <div className="bg-slate-200 my-1 hidden sm:block" />
            <label className="border border-slate-200 sm:border-0 min-h-[52px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 cursor-pointer min-w-0 hover:bg-slate-100 rounded-md transition">
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold leading-tight">Promień</div>
              <select name="radius" defaultValue="5" className="text-[13.5px] text-slate-900 font-semibold w-full border-0 outline-none bg-transparent appearance-none cursor-pointer min-h-[28px] sm:min-h-0">
                <option value="2">+ 2 km</option>
                <option value="5">+ 5 km</option>
                <option value="10">+ 10 km</option>
                <option value="25">+ 25 km</option>
                <option value="50">+ 50 km</option>
                <option value="100">+ 100 km</option>
                <option value="">Bez limitu</option>
              </select>
            </label>
            <div className="bg-slate-200 my-1 hidden sm:block" />
            <label className="order-last sm:order-none col-span-2 sm:col-span-1 border border-slate-200 sm:border-0 min-h-[52px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 cursor-pointer min-w-0 hover:bg-slate-100 rounded-md transition">
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold leading-tight">Format</div>
              <select name="format" className="text-[13.5px] text-slate-900 font-semibold w-full border-0 outline-none bg-transparent appearance-none cursor-pointer min-h-[28px] sm:min-h-0">
                <option value="">Stacjonarnie + Online</option>
                <option value="onsite">Tylko stacjonarnie</option>
                <option value="online">Tylko online</option>
              </select>
            </label>
            <div className="bg-slate-200 my-1 hidden sm:block" />
            <label className="border border-slate-200 sm:border-0 min-h-[52px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 cursor-pointer min-w-0 hover:bg-slate-100 rounded-md transition">
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold leading-tight">Cena / sesja</div>
              <select name="price" className="text-[13.5px] text-slate-900 font-semibold w-full border-0 outline-none bg-transparent appearance-none cursor-pointer min-h-[28px] sm:min-h-0">
                <option value="80-200">80–200 zł</option>
                <option value="0-80">do 80 zł</option>
                <option value="200-">200+ zł</option>
              </select>
            </label>
            <button
              type="submit"
              className="order-last sm:order-none col-span-2 sm:col-auto bg-emerald-500 hover:bg-emerald-600 text-white rounded-md flex items-center justify-center gap-1.5 font-bold text-[15px] sm:text-[13.5px] min-h-[48px] sm:min-h-0 py-3 sm:py-0 px-4 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Szukaj
            </button>
          </form>

          {/* Quick-filter chip row — "Popularne" preset shortcuts that
              deep-link into common search filters. Each chip is a real
              `<Link>` to `/?<filter>=...` so the page reloads with the
              filter applied. MOCK counts on Promocje/Nowi until we have
              active_promotions + trainers.created_at aggregates. */}
          <div className="mt-3.5 flex gap-2 items-center flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5 sm:pb-0">
            <span className="text-[12px] text-white/65 font-medium mr-1 shrink-0">Popularne:</span>
            <QuickChip href="/?sort=top#wyniki">🏆 Top tygodnia</QuickChip>
            <QuickChip href="/?promo=1#wyniki">🔥 Promocje<b className="ml-1 text-emerald-300 font-bold">12</b></QuickChip>
            <QuickChip href="/?price=0-100#wyniki">💰 Tańsze niż 100 zł</QuickChip>
            <QuickChip href="/?since=30d#wyniki">✨ Nowi trenerzy<b className="ml-1 text-emerald-300 font-bold">8</b></QuickChip>
            <QuickChip href="/?format=online#wyniki">💻 Online</QuickChip>
            <QuickChip href="/?time=morning#wyniki">🌅 Poranny grafik</QuickChip>
            <QuickChip href="/?gender=f#wyniki">👩 Trenerki</QuickChip>
            <QuickChip href="/?spec=rehabilitation#wyniki">🩺 Po kontuzji</QuickChip>
          </div>
        </div>
      </section>

      {/* ====================== CATEGORY ICON BAR ====================== */}
      {/* Design 46 catbar: 10 colored icon tiles. Sticky under the chrome
          so a user scrolling through results can re-pick a category. */}
      <CategoryIconBar
        activeSpec={activeSpec}
        counts={counts}
        onPick={(s) => updateUrl({ spec: s === "all" ? null : s })}
      />

      {/* ====================== FILTER CHIP ROW ====================== */}
      <FilterChipRow
        filters={filters}
        onClearOne={(key) => updateUrl({ [key]: null })}
        onClearAll={() => router.push(pathname)}
      />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">

        {/* ============================ RESULTS HEAD ============================ */}
        <div className="flex items-center justify-between py-3.5 gap-3 flex-wrap">
          <div>
            <h1 className="m-0 text-[20px] sm:text-[22px] tracking-[-0.02em] text-[#002f34] font-extrabold">
              {favActive ? "Twoi ulubieni trenerzy" : "Trener personalny"}
              {city && !favActive && ` · ${city}`} — <span className="text-emerald-600">{filtered.length}</span> ofert
            </h1>
            <div className="text-[12.5px] text-slate-500 mt-0.5">
              {/* MOCK: "23 nowych w tym tyg." + radius copy */}
              Promień 5 km · ostatnia aktualizacja przed chwilą · {Math.min(23, filtered.length)} nowych w tym tyg.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-slate-500">Sortuj:</span>
            <button type="button" className="px-3 py-2 border border-slate-300 rounded-md text-[13px] font-semibold text-[#002f34] bg-white hover:border-[#002f34] inline-flex items-center gap-1.5 transition">
              Wybrane dla Ciebie
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            <div className="inline-flex bg-white border border-slate-300 rounded-md overflow-hidden">
              <ViewToggleBtn on={view === "list"} onClick={() => setView("list")} title="Lista">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </ViewToggleBtn>
              <ViewToggleBtn on={view === "grid"} onClick={() => setView("grid")} title="Kafelki">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </ViewToggleBtn>
              {/* Map view is desktop-only in the MVP — hidden below sm. */}
              <ViewToggleBtn on={view === "map"} onClick={() => setView("map")} title="Mapa" className="hidden sm:flex ">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              </ViewToggleBtn>
            </div>
          </div>
        </div>

        {/* ============================ PROMO ROW ============================ */}
        {/* Design 46 promo strip — 3 cards contextualised to the search.
            Mobile: horizontal swipe row bleeding to screen edges; desktop
            keeps the 2fr/1fr/1fr grid. */}
        <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-[2fr_1fr_1fr] gap-3 sm:gap-3.5 mb-5">
          <PromoCard tone="dark" emoji="⭐" title="Polecane przez NaZdrow! Pro" body={`Trenerzy Pro · gwarancja zwrotu po 1. sesji`} cta="Zobacz wszystkich Pro" href="/?pro=1#wyniki" />
          <PromoCard tone="amber" emoji="🔥" title="Promocje tygodnia" body="12 trenerów do −30%" cta="Sprawdź" href="/?promo=1#wyniki" />
          <PromoCard tone="emerald" emoji="🎁" title="Pierwsza sesja gratis" body="41 trenerów bez ryzyka" cta="Wypróbuj" href="/?freeconsult=1#wyniki" />
        </div>

        {/* ============================ LAYOUT ============================ */}
        {/* Single-column: results take the full container width. The
            sticky map + price insights + alert + similar-searches aside
            was removed per user request — felt visually crowded and the
            map wasn't wired to a real provider yet. */}
        <div className="pb-7">
          <div className="flex flex-col gap-2.5">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-[10px] p-10 text-center">
                <div className="text-[15px] font-semibold text-slate-900 mb-1">Brak wyników</div>
                <p className="text-[13px] text-slate-500 m-0">Spróbuj rozszerzyć kryteria wyszukiwania.</p>
              </div>
            ) : (
              visibleResults.map((t, i) => (
                <ResultCard key={t.id} trainer={t} index={i} featured={i === 0} />
              ))
            )}

            {/* PROMO INSERT — between cards, sponsored row */}
            {filtered.length >= 3 && (
              <div className="rounded-[10px] px-5 py-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center text-white" style={{ background: "linear-gradient(135deg, #002f34 0%, #004a52 100%)" }}>
                <div>
                  <h3 className="m-0 mb-1 text-[16px] tracking-[-0.015em] font-bold">
                    💎 Wypróbuj NaZdrow! Pro — gwarancja zwrotu po 1. sesji
                  </h3>
                  <p className="m-0 text-[12.5px] text-white/78">
                    Trenerzy Pro przechodzą dodatkową weryfikację. Jeśli nie polubisz pierwszej sesji, zwrócimy 100% kosztów. Bez pytań.
                  </p>
                </div>
                <Link href="/?pro=1#wyniki" className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 font-bold text-[13px] rounded-md whitespace-nowrap">
                  Zobacz 38 trenerów Pro →
                </Link>
              </div>
            )}

            {/* Infinite scroll: auto-load up to AUTO_LOAD_CAP via the
                IntersectionObserver sentinel, then switch to a manual
                "Pokaż więcej" button so the rest of the page (city grid,
                SEO/FAQ, footer) becomes reachable for users with 100+
                results. The user explicitly asked for this — they want
                to be able to skim FAQ while loading is "on pause". */}
            {atAutoCap ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <button
                  type="button"
                  onClick={() => setDisplayCount((n) => Math.min(n + PAGE_SIZE * 2, filtered.length))}
                  className="px-6 py-3 bg-[#002f34] hover:bg-slate-900 text-white text-[13.5px] font-bold rounded-md transition inline-flex items-center gap-2"
                >
                  Pokaż więcej trenerów
                  <span className="bg-white/15 px-2 py-0.5 rounded text-[11.5px] font-bold">
                    +{Math.min(PAGE_SIZE * 2, remaining)}
                  </span>
                </button>
                <div className="text-[12px] text-slate-500">
                  Pokazano <b className="text-[#002f34] font-bold">{visibleResults.length}</b> z {filtered.length} · {remaining} pozostało
                </div>
              </div>
            ) : visibleResults.length < filtered.length ? (
              <div ref={sentinelRef} className="flex justify-center items-center gap-2 py-6 text-[13px] text-slate-500 font-medium">
                <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-[#002f34] animate-spin" />
                Ładuję kolejnych trenerów… ({visibleResults.length} / {filtered.length})
              </div>
            ) : filtered.length > 0 ? (
              <div className="flex justify-center items-center py-6 text-[13px] text-slate-500 font-medium">
                Pokazano wszystkich {filtered.length} {filtered.length === 1 ? "trenera" : filtered.length < 5 ? "trenerów" : "trenerów"} ✓
              </div>
            ) : null}
          </div>

        </div>
      </div>

      {/* ============================ CITY GRID ============================ */}
      <CityGridSection activeCity={city} />

      {/* ============================ SEO / FAQ ============================ */}
      <section className="bg-white border-t border-slate-200 mt-3 py-7">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <h2 className="text-[20px] tracking-[-0.02em] m-0 mb-3.5 text-[#002f34] font-extrabold">
            Trener personalny w {city || "Polsce"} — najczęstsze pytania
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FaqRow open question="Ile kosztuje trener personalny?">
              Mediana w naszym serwisie to {priceStats.median || 135} zł za sesję 60 min. Najtańsze oferty zaczynają się od {priceStats.min || 85} zł, a topowi specjaliści sięgają {priceStats.max || 290} zł. Pakiety 4–8 sesji są zwykle 10–20% tańsze.
            </FaqRow>
            <FaqRow question="Jak sprawdzić czy trener jest zweryfikowany?">
              Każdy trener z zieloną odznaką ✓ ma potwierdzony certyfikat, dokument tożsamości i przynajmniej 5 zweryfikowanych opinii klientów. Trenerzy „NaZdrow! Pro" przechodzą dodatkową weryfikację.
            </FaqRow>
            <FaqRow question="Czy mogę odwołać sesję bez kosztów?">
              Standardowa polityka to bezkosztowe odwołanie do 12h przed sesją. Każdy trener może mieć własne zasady — sprawdź regulamin na jego profilu przed rezerwacją.
            </FaqRow>
            <FaqRow question="Trening online czy stacjonarny — co wybrać?">
              Online jest tańszy (średnio o 25%) i bardziej elastyczny. Stacjonarnie pozwala trenerowi korygować technikę i daje dostęp do sprzętu. Dla początkujących polecamy minimum 4 pierwsze sesje stacjonarnie.
            </FaqRow>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-200">
            {[
              "Trener personalny Mokotów", "Trener personalny Wola", "Trener personalny Ursynów",
              "Trener personalny Bemowo", "Trener crossfit Warszawa", "Trener boksu Warszawa",
              "Dietetyk Warszawa", "Trener online cała Polska", "Trener z planem żywieniowym",
              "Trener dla kobiet po ciąży", "Trener po kontuzji",
            ].map((q) => (
              <Link key={q} href={`/?q=${encodeURIComponent(q)}#wyniki`} className="text-[12px] px-2.5 py-1 bg-slate-100 hover:bg-[#002f34] hover:text-white rounded-full text-[#002f34] font-semibold transition">
                {q}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================== Subcomponents ============================== */

function ActiveChips({
  city, activeSpec, onClearSpec, onClearCity,
}: {
  city: string;
  activeSpec: Specialization | "all";
  onClearSpec: () => void;
  onClearCity: () => void;
}) {
  const chips: Array<{ label: string; onClear: () => void }> = [];
  if (city) chips.push({ label: `${city} + 5 km`, onClear: onClearCity });
  if (activeSpec !== "all") {
    const s = specializations.find((sp) => sp.id === activeSpec);
    if (s) chips.push({ label: s.label, onClear: onClearSpec });
  }
  // MOCK: extra chip examples — would come from real filter state
  chips.push({ label: "Cena 80–200 zł", onClear: () => {} });
  chips.push({ label: "Online + Stacjonarnie", onClear: () => {} });
  chips.push({ label: "Ocena ≥ 4,5", onClear: () => {} });

  return (
    <div className="flex gap-1.5 flex-wrap items-center pb-3.5 pt-1">
      {chips.map((c, i) => (
        // V1.5 refined: chips are white with dark-teal border (was emerald
        // tinted) — calmer, less competing with the rest of the UI.
        <span key={i} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-white border border-[#002f34] text-[#002f34] rounded-md text-[12px] font-semibold">
          {c.label}
          <button type="button" onClick={c.onClear} aria-label={`Usuń filtr ${c.label}`} className="w-[18px] h-[18px] rounded inline-flex items-center justify-center text-slate-600 hover:bg-[#002f34]/8 hover:text-[#002f34] transition">
            ×
          </button>
        </span>
      ))}
      <button type="button" className="text-[12px] text-red-600 font-semibold underline ml-1">
        Wyczyść wszystkie ({chips.length})
      </button>
      <button type="button" className="ml-auto px-3 py-1.5 bg-white border border-[#002f34] text-[#002f34] rounded-md text-[12px] font-bold inline-flex items-center gap-1.5 hover:bg-slate-50 transition">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
        Obserwuj wyszukiwanie
      </button>
    </div>
  );
}

function FiltersCard({ counts: _counts }: { counts: Record<string, number> }) {
  return (
    // V1.5 refined: soft shadow ring instead of hard border, smaller h3
    // (14px uppercase) instead of 16px regular.
    <div className="bg-white rounded-xl p-5 pb-3 mb-4 shadow-[0_0_0_1px_rgba(0,47,52,0.06)]">
      <h3 className="m-0 mb-3.5 text-[14px] font-extrabold tracking-[-0.005em] text-[#002f34] flex items-center gap-2 uppercase">
        Filtry
        <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">aktywnych 6</span>
        <button type="button" className="ml-auto text-[12px] text-[#002f34] font-bold underline normal-case">
          Pokaż filtry zaawansowane ▾
        </button>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 gap-y-3">
        <FilterField label="Specjalizacja" value="Siłownia, redukcja" />
        <PriceRange />
        <FilterField label="Format treningu" value="Stacjonarnie + Online" />
        <FilterField label="Ocena minimalna" value="⭐ 4,5 i więcej" />
        <FilterField label="Doświadczenie" placeholder="Wszystkie" />
        <FilterField label="Płeć trenera" placeholder="Bez znaczenia" />
        <FilterField label="Język" value="Polski + Angielski" />
        <FilterField label="Dostępność" value="W tym tygodniu" />
        <FilterField label="Pora dnia" value="Wieczorami (po 17:00)" />
        <FilterField label="Certyfikaty" placeholder="Wszystkie" />
      </div>

      <div className="flex gap-1 mt-3.5 flex-wrap items-center">
        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.07em] mr-1.5">Szybkie zakresy:</span>
        {["do 80 zł", "80–120 zł", "120–180 zł", "180–250 zł", "250+ zł"].map((p, i) => (
          <button key={p} type="button" className={"text-[11px] px-2 py-0.5 rounded font-medium transition " + (i === 1 ? "bg-[#002f34] text-white" : "bg-slate-100 text-slate-600 hover:bg-[#002f34] hover:text-white")}>
            {p}
          </button>
        ))}
      </div>

      {/* CHECKBOX ROW */}
      <div className="flex gap-4 mt-1.5 pt-3.5 border-t border-slate-200 flex-wrap">
        <CheckRow checked label="Tylko ze zdjęciem profilowym" count={218} />
        <CheckRow checked label="Pierwsza sesja gratis" count={41} />
        <CheckRow label="Promocja / rabat" count={12} />
        <CheckRow label="NaZdrow! Pro" count={38} />
        <CheckRow label="Faktura VAT" count={186} />
        <CheckRow label="Płatność BLIK / karta" count={231} />
      </div>
    </div>
  );
}

function FilterField({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[12px] text-[#002f34] font-bold">{label}</label>
      <button type="button" className={"h-[38px] border border-slate-300 rounded-md px-3 text-[13px] bg-white flex items-center gap-1.5 hover:border-[#002f34] transition font-medium " + (value ? "text-[#002f34]" : "text-slate-400 font-normal")}>
        <span className="truncate flex-1 text-left">{value || placeholder}</span>
        <span className="text-slate-500 shrink-0">▾</span>
      </button>
    </div>
  );
}

function PriceRange() {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[12px] text-[#002f34] font-bold">Cena za sesję (zł)</label>
      <div className="grid grid-cols-2 gap-1.5">
        <input defaultValue="80" className="h-[38px] border border-slate-300 rounded-md px-3 text-[13px] text-[#002f34] font-medium outline-none focus:border-[#002f34] transition" />
        <input defaultValue="200" className="h-[38px] border border-slate-300 rounded-md px-3 text-[13px] text-[#002f34] font-medium outline-none focus:border-[#002f34] transition" />
      </div>
    </div>
  );
}

function CheckRow({ checked, label, count }: { checked?: boolean; label: string; count: number }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-[#002f34] font-medium cursor-pointer">
      <input type="checkbox" defaultChecked={checked} className="sr-only peer" />
      <span className={"w-[18px] h-[18px] border-[1.5px] rounded inline-flex items-center justify-center font-extrabold text-[11px] transition " + (checked ? "bg-[#002f34] border-[#002f34] text-white" : "border-slate-300 bg-white text-transparent peer-checked:bg-[#002f34] peer-checked:border-[#002f34] peer-checked:text-white")}>
        ✓
      </span>
      {label}
      <span className="text-slate-500 font-medium text-[11.5px]">({count})</span>
    </label>
  );
}

function SubTab({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-[13.5px] font-semibold whitespace-nowrap pb-2.5 -mb-3 border-b-2 transition " +
        (on ? "text-[#002f34] border-emerald-500" : "text-slate-500 border-transparent hover:text-[#002f34]")
      }
    >
      {label}{" "}
      <b className={"ml-0.5 font-bold " + (on ? "text-emerald-600" : "text-[#002f34]")}>{count}</b>
    </button>
  );
}

function ViewToggleBtn({ on, onClick, title, children, className }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={"w-[38px] h-[36px] items-center justify-center transition " + (className ?? "flex ") + (on ? "bg-[#002f34] text-white" : "bg-white text-slate-500 hover:text-[#002f34]")}
    >
      {children}
    </button>
  );
}

/* ============================== ResultCard ============================== */

function ResultCard({ trainer, index, featured }: { trainer: Trainer; index: number; featured: boolean }) {
  const grad = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const slot = NEXT_SLOTS[index % NEXT_SLOTS.length];
  const distance = DISTANCES[index % DISTANCES.length];
  const response = RESPONSE_TIMES[index % RESPONSE_TIMES.length];

  // MOCK: badges rotated by index. Real impl reads from trainers.is_pro,
  // trainers.first_session_free, trainers.has_vat, etc.
  const isPro = index % 3 === 0;
  // Featured (first) card always gets the gift pill — it's the strongest
  // social-proof signal and shouldn't be randomly hidden on the most
  // visible position.
  const hasFreeFirst = featured || index % 4 === 0;
  const hasVat = index % 2 === 0;
  const isPromo = index === 2; // 3rd card: −20% ribbon
  const isNew = index === 5;   // 6th card: NOWY ribbon
  const photoCount = 7 + (index * 3) % 10;
  // MOCK: package discount label
  const pkgPct = [10, null, 20, 15, null, 10][index % 6];
  const pkgPrice = pkgPct ? Math.round(trainer.priceFrom * 4 * (1 - pkgPct / 100)) : null;
  const oldPrice = isPromo ? Math.round(trainer.priceFrom / 0.8) : null;

  // V1.5 refined: soft shadow rings instead of hard borders.
  // Featured card uses an emerald-500 ring + warm shadow for emphasis.
  const cardShadow = featured
    ? "shadow-[0_0_0_1.5px_rgb(16,185,129),0_4px_16px_rgba(16,185,129,0.18)]"
    : "shadow-[0_0_0_1px_rgba(0,47,52,0.06),0_2px_8px_rgba(0,47,52,0.04)] hover:shadow-[0_0_0_1px_rgba(0,47,52,0.12),0_6px_20px_rgba(0,47,52,0.08)]";

  return (
    <Link
      href={`/trainers/${trainer.id}`}
      className={
        // items-center: vertically centres each column in the row.
        // The right column (price + slot + gift + 2 buttons) is the
        // tallest; without items-center the photo would stick to the
        // top of the cell and leave a gap below.
        "bg-white rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-[260px_1fr_210px] gap-[18px] items-center cursor-pointer relative transition hover:-translate-y-px " +
        cardShadow
      }
    >
      {/* ============================ PHOTO ============================ */}
      <div className={"relative aspect-[4/3] rounded-lg flex items-center justify-center text-white font-bold text-[60px] tracking-[-0.02em] overflow-hidden bg-gradient-to-br " + grad}>
        {/* Radial highlight overlay — adds depth to flat gradients */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 60%)" }}
        />
        {trainer.avatar ? (
          <Image
            src={trainer.avatar}
            alt={trainer.name}
            fill
            sizes="260px"
            className="object-cover"
            style={{ objectPosition: trainer.avatarFocal || "center" }}
          />
        ) : (
          <span className="relative z-10">{initialsOf(trainer.name)}</span>
        )}

        {/* Ribbon — featured / promo / new */}
        {featured && (
          <span className="absolute top-2.5 left-0 px-2.5 py-1 bg-[#002f34] text-white text-[10px] font-extrabold tracking-[0.06em] inline-flex items-center gap-1.5 rounded-r">
            <span className="text-orange-400 text-[11px]">★</span> WYRÓŻNIONE
          </span>
        )}
        {!featured && isPromo && oldPrice && (
          <span className="absolute top-2.5 left-0 px-2.5 py-1 bg-red-600 text-white text-[10px] font-extrabold tracking-[0.06em] inline-flex items-center gap-1.5 rounded-r">
            <span className="text-amber-100 font-extrabold">%</span> −20%
          </span>
        )}
        {!featured && !isPromo && isNew && (
          <span className="absolute top-2.5 left-0 px-2.5 py-1 bg-emerald-700 text-white text-[10px] font-extrabold tracking-[0.06em] inline-flex items-center gap-1.5 rounded-r">
            ✨ NOWY
          </span>
        )}

        {/* Heart — visual only */}
        <span className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/96 flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.1)]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </span>

        {/* Photo count */}
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-[#002f34]/80 text-white text-[10.5px] rounded font-semibold backdrop-blur-sm">
          {photoCount} zdjęć
        </span>
      </div>

      {/* ============================ BODY ============================ */}
      {/* justify-center: when the body content is shorter than the photo
          + right column (which has 4 stacked rows: price/slot/gift/actions),
          centre it vertically instead of leaving a big gap below the
          signals row. Matches the proportion the design lands on. */}
      <div className="flex flex-col justify-center py-1.5 min-w-0">
        {/* Hierarchy fix: trainer NAME comes first, biggest weight.
            Previously the small uppercase ctx-line ("TRENER OSOBISTY ·
            <tagline>") sat above and pulled the eye away from the
            person. Per UX feedback — clients are scanning for an
            individual, not a slogan. */}
        <h3 className="m-0 mb-1 text-[18px] font-extrabold text-[#002f34] tracking-[-0.015em] leading-[1.2] flex items-center gap-1.5 flex-wrap">
          <span className="truncate">{trainer.name}</span>
          <span className="text-emerald-600 text-[14px]">✓</span>
          {isPro && (
            <span className="text-white bg-[#002f34] px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-[0.06em]">
              NaZdrow! Pro
            </span>
          )}
        </h3>

        {/* Subtitle — role + tagline, normal-case 13px. No more uppercase
            shouty styling. Falls back to just the role when no tagline. */}
        <div className="text-[13px] text-slate-600 mb-1.5 leading-[1.35]">
          <span className="font-semibold text-slate-700">Trener osobisty</span>
          {trainer.tagline && (
            <>
              <span className="text-slate-400 mx-1.5">·</span>
              <span>{trainer.tagline}</span>
            </>
          )}
        </div>

        {/* Stars row — visual ★★★★★ glyphs filled by rating */}
        <div className="text-[13px] text-[#002f34] font-semibold flex items-center gap-1.5 mb-2">
          <span className="text-amber-500 tracking-[0.5px]">{starGlyphs(trainer.rating)}</span>
          <span>{trainer.rating.toFixed(1).replace(".", ",")}</span>
          <span className="text-slate-500 font-medium">· {trainer.reviewCount} opinii · {trainer.experience} lat doświadczenia</span>
        </div>

        {/* Description */}
        {trainer.about && (
          <p className="text-[12.5px] text-slate-700 leading-[1.5] m-0 mb-2.5 line-clamp-2">
            {trainer.about}
          </p>
        )}

        {/* Meta row — each item gets its own icon prefix for visual
            scan-ability. Format chip uses a small monitor/screen icon,
            location uses a pin, languages use a globe. */}
        <div className="flex items-center flex-wrap text-[12px] text-slate-700 font-medium gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="text-[#002f34] font-semibold">Stacjonarnie + Online</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{trainer.location}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            <span>PL · EN</span>
          </span>
        </div>

        {/* Signals row — separated by border-top */}
        <div className="flex gap-3.5 mt-3 pt-3 border-t border-slate-200 flex-wrap">
          {trainer.certifications?.[0] && (
            <Signal>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Cert. {trainer.certifications[0].slice(0, 24)}{trainer.certifications[0].length > 24 ? "…" : ""}
            </Signal>
          )}
          <Signal>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Odpowiada w {response}
          </Signal>
          {hasVat && (
            <Signal muted>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Faktura VAT
            </Signal>
          )}
          <Signal muted>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
              <path d="M12 22s-8-4.5-8-12a8 8 0 0116 0c0 7.5-8 12-8 12z" />
            </svg>
            {distance} km od Ciebie
          </Signal>
        </div>
      </div>

      {/* ============================ RIGHT ============================ */}
      {/* Tighter spacing per UX feedback — price/pkg/slot/gift/actions
          all close together, less wasted whitespace. justify-between
          removed; let content stack tight from top. Mobile: the column
          stacks under the body, so the desktop left border becomes a
          top border. */}
      <div className="flex flex-col gap-2 py-1 pt-3 border-t border-slate-200 sm:pt-1 sm:border-t-0 sm:pl-4 sm:border-l">
        {/* Price block */}
        <div>
          <div className="text-[9.5px] uppercase tracking-[0.12em] text-slate-500 font-bold mb-0.5">Od</div>
          <div className="text-[26px] font-extrabold text-[#002f34] tracking-[-0.025em] tabular-nums leading-none">
            {oldPrice && <s className="text-[12px] text-slate-400 font-medium mr-1">{oldPrice}</s>}
            {trainer.priceFrom}
            <small className="text-[14px] text-[#002f34] font-bold ml-px">zł</small>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">sesja 60 min</div>
          {pkgPct && pkgPrice && (
            <div className="text-[11.5px] text-emerald-600 font-bold flex items-center gap-1.5 mt-1.5">
              <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">−{pkgPct}%</span>
              pakiet 4× = {pkgPrice} zł
            </div>
          )}
        </div>

        {/* Slot — tighter top margin (was 16px+ via gap-3.5, now ~8px) */}
        <div className="pt-1.5 border-t border-dashed border-slate-200">
          <div className="text-[9.5px] uppercase tracking-[0.12em] text-slate-500 font-bold mb-0.5">Najbliższy slot</div>
          <div className="text-[14px] font-extrabold text-[#002f34] tracking-[-0.01em] inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {slot}
          </div>
        </div>

        {/* Gift pill — now also on featured card (was hidden by random
            index check). Strongest social proof should always show on
            the highlighted result. */}
        {hasFreeFirst && (
          <div className="bg-orange-50 border border-dashed border-orange-300 text-orange-900 px-2 py-1 rounded-md text-[11px] font-bold text-center inline-flex items-center justify-center gap-1">
            🎁 1. sesja gratis
          </div>
        )}

        {/* Actions — side by side on mobile (both thumb-reachable),
            stacked in the narrow right column on desktop. */}
        <div className="grid grid-cols-2 gap-1.5 mt-0.5 sm:flex sm:flex-col">
          <button type="button" className="py-3 sm:py-2.5 min-h-[44px] sm:min-h-0 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[13px] font-extrabold transition">
            Umów wizytę
          </button>
          <button type="button" className="py-3 sm:py-2 min-h-[44px] sm:min-h-0 bg-white border border-slate-300 hover:border-[#002f34] text-[#002f34] rounded-md text-[12.5px] font-extrabold transition">
            Napisz
          </button>
        </div>
      </div>
    </Link>
  );
}

function Bullet() {
  return (
    <span className="w-[3px] h-[3px] rounded-full bg-slate-400 mx-2 inline-block" aria-hidden="true" />
  );
}

function Signal({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={"inline-flex items-center gap-1.5 text-[11.5px] " + (muted ? "text-slate-600 font-medium" : "text-[#002f34] font-semibold")}>
      {children}
    </span>
  );
}

// Visual ★★★★★ row — filled stars per integer part of rating, half-star
// when fractional. Falls back to 5 outline stars when rating is 0.
function starGlyphs(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "★" : "") + "☆".repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
}

function QuickChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-[12px] text-white font-medium transition whitespace-nowrap shrink-0 min-h-[36px] sm:min-h-0"
    >
      {children}
    </Link>
  );
}

function FaqRow({ open, question, children }: { open?: boolean; question: string; children: React.ReactNode }) {
  return (
    <details open={open} className="bg-slate-100 rounded-md p-3 group">
      <summary className="text-[13.5px] font-bold text-[#002f34] cursor-pointer list-none flex justify-between items-center [&::-webkit-details-marker]:hidden">
        {question}
        <span className="text-slate-500 text-[16px] group-open:hidden">+</span>
        <span className="text-slate-500 text-[16px] hidden group-open:block">–</span>
      </summary>
      <p className="m-0 mt-2 text-[12.5px] text-slate-700 leading-relaxed">{children}</p>
    </details>
  );
}

/* ====================== Category Icon Bar (design 46) ====================== */
// Per-tile colored backgrounds — matches design 46's c1..c10 palette.
const CAT_TONES: Record<string, string> = {
  "weight-loss":    "bg-amber-100",
  "muscle-gain":    "bg-blue-100",
  "rehabilitation": "bg-teal-100",
  "flexibility":    "bg-pink-100",
  "cardio":         "bg-red-100",
  "strength":       "bg-indigo-100",
  "crossfit":       "bg-cyan-100",
  "yoga":           "bg-orange-100",
  "martial-arts":   "bg-violet-100",
  "nutrition":      "bg-yellow-100",
};

function CategoryIconBar({
  activeSpec, counts, onPick,
}: {
  activeSpec: Specialization | "all";
  counts: Record<string, number>;
  onPick: (s: Specialization | "all") => void;
}) {
  // 3-row stacked tile layout (per user revert): icon on top, label
  // below, count under that. Non-sticky — lives in normal page flow.
  return (
    <section className="bg-white border-b border-slate-200 shadow-[0_2px_6px_rgba(0,0,0,0.03)] py-3">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 flex gap-0 overflow-x-auto scrollbar-hide">
        {specializations.map((spec) => {
          const on = activeSpec === spec.id;
          const count = counts[spec.id] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={spec.id}
              type="button"
              onClick={() => onPick(on ? "all" : (spec.id as Specialization))}
              className={
                "flex-1 min-w-[92px] flex flex-col items-center gap-1.5 px-1.5 py-1.5 cursor-pointer text-center rounded-lg transition " +
                (on ? "bg-slate-100" : "hover:bg-slate-100")
              }
            >
              <span
                className={
                  "w-12 h-12 rounded-xl flex items-center justify-center text-[22px] transition " +
                  (CAT_TONES[spec.id] ?? "bg-slate-100") +
                  (on ? " ring-2 ring-[#002f34]" : "")
                }
              >
                {spec.icon}
              </span>
              <span className="text-[11.5px] font-semibold text-[#002f34] leading-tight">{spec.label}</span>
              <span className="text-[10px] text-slate-500">{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ====================== Filter Chip Row (design 46 .frow) ====================== */

const SORT_LABELS: Record<string, string> = {
  top: "Wybrane dla Ciebie",
  rating: "Najwyższa ocena",
  "price-asc": "Cena rosnąco",
  "price-desc": "Cena malejąco",
};

const FORMAT_LABELS: Record<string, string> = {
  online: "💻 Online",
  onsite: "🏋️ Stacjonarnie",
};

const TIME_LABELS: Record<string, string> = {
  morning: "🌅 Poranny grafik",
  afternoon: "☀️ Popołudnie",
  evening: "🌆 Wieczór",
  weekend: "📅 Weekend",
};

const GENDER_LABELS: Record<string, string> = {
  f: "👩 Trenerki",
  m: "👨 Trenerzy",
};

function FilterChipRow({
  filters,
  onClearOne,
  onClearAll,
}: {
  filters: CatalogFilters;
  onClearOne: (key: keyof CatalogFilters) => void;
  onClearAll: () => void;
}) {
  type ActiveChip = {
    key: keyof CatalogFilters;
    label: string;
    /** Soft chips reflect an URL param that doesn't yet narrow results — the
     *  active-chip is the user-visible "we registered your click", but the
     *  trainer count won't actually change until the schema dependency lands.
     *  Rendered in muted tone so it's distinguishable from real filters. */
    soft?: boolean;
  };
  const chips: ActiveChip[] = [];
  if (filters.city) chips.push({ key: "city", label: filters.city });
  if (filters.spec) {
    const s = specializations.find((sp) => sp.id === filters.spec);
    if (s) chips.push({ key: "spec", label: s.label });
  }
  if (filters.q) chips.push({ key: "q", label: `„${filters.q}”` });
  if (filters.price) {
    chips.push({ key: "price", label: `Cena ${filters.price.replace("-", "–")} zł` });
  }
  if (filters.sort) {
    chips.push({ key: "sort", label: `Sortuj: ${SORT_LABELS[filters.sort] ?? filters.sort}` });
  }
  if (filters.promo)       chips.push({ key: "promo",       label: "🔥 Promocje",          soft: true });
  if (filters.since)       chips.push({ key: "since",       label: "✨ Nowi trenerzy",     soft: true });
  if (filters.format)      chips.push({ key: "format",      label: FORMAT_LABELS[filters.format] ?? filters.format, soft: true });
  if (filters.time)        chips.push({ key: "time",        label: TIME_LABELS[filters.time] ?? filters.time, soft: true });
  if (filters.gender)      chips.push({ key: "gender",      label: GENDER_LABELS[filters.gender] ?? filters.gender, soft: true });
  if (filters.pro)         chips.push({ key: "pro",         label: "⭐ Pro",               soft: true });
  if (filters.freeconsult) chips.push({ key: "freeconsult", label: "🎁 1. sesja gratis", soft: true });
  if (filters.radius && filters.radius !== "5") {
    chips.push({ key: "radius", label: `+ ${filters.radius} km`, soft: true });
  }

  const softCount = chips.filter((c) => c.soft).length;

  // Mobile: the pill row collapses behind a "Filtry (N)" toggle so the
  // section stays one compact row; desktop (sm+) always shows the pills.
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // id="wyniki" — every filter shortcut (Popular chips / category tiles /
    // promo cards / Szukaj submit / city grid) navigates with #wyniki so the
    // user lands at the filter+results section instead of staring at the
    // hero after each click. scroll-mt-20 clears the sticky public header.
    <section id="wyniki" className="bg-white border-b border-slate-200 py-3 scroll-mt-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        {/* Mobile toggle row — "Filtry" with active-filter count. */}
        <div className="flex sm:hidden gap-2 items-center">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] flex-1 justify-center bg-white border border-[#002f34] text-[#002f34] rounded-md text-[13.5px] font-bold hover:bg-slate-50 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filtry
            {chips.length > 0 && (
              <span className="bg-[#002f34] text-white text-[11px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">
                {chips.length}
              </span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={"transition-transform " + (mobileOpen ? "rotate-180" : "")}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button type="button" aria-label="Obserwuj wyszukiwanie" className="inline-flex items-center justify-center w-11 min-h-[44px] bg-amber-100 text-amber-900 rounded-md text-[16px] font-bold hover:bg-amber-200 transition">
            🔔
          </button>
        </div>

        {/* Row 1 — filter controls (visual only for now; phase 3 wiring).
            Hidden on mobile until the "Filtry" toggle opens it. */}
        <div className={(mobileOpen ? "flex mt-2.5 pt-2.5 border-t border-slate-100 sm:mt-0 sm:pt-0 sm:border-t-0" : "hidden") + " sm:flex gap-1.5 items-center flex-wrap"}>
          <FilterPill label="Cena" />
          <FilterPill label="Ocena" />
          <FilterPill label="Dostępność" />
          <FilterPill label="Doświadczenie" />
          <FilterPill label="Płeć" />
          <FilterPill label="Język" />

          <button type="button" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[40px] sm:min-h-0 bg-white border border-[#002f34] text-[#002f34] rounded-md text-[12.5px] font-bold hover:bg-slate-50 transition">
            ⊞ Wszystkie filtry
          </button>

          <button type="button" className="ml-auto hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 rounded-md text-[12px] font-bold hover:bg-amber-200 transition">
            🔔 Obserwuj wyszukiwanie
          </button>
        </div>

        {/* Row 2 — applied filter state. */}
        {chips.length > 0 && (
          <div className="flex gap-1.5 items-center flex-wrap mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold mr-1">Filtry:</span>
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onClearOne(c.key)}
                title={c.soft ? "Filtr zostanie podpięty po dodaniu danych — kliknij, by zdjąć" : undefined}
                className={
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition " +
                  (c.soft
                    ? "bg-white border border-dashed border-[#002f34]/40 text-[#002f34] hover:bg-slate-50"
                    : "bg-[#002f34] text-white hover:bg-slate-900")
                }
              >
                {c.label}
                <span className="opacity-60 ml-0.5 text-[13px]">×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={onClearAll}
              className="text-slate-500 text-[12px] underline font-medium ml-1"
            >
              Wyczyść {chips.length}
            </button>
            {softCount > 0 && (
              <span className="text-[11px] text-slate-400 ml-auto italic">
                {softCount === 1 ? "1 filtr" : `${softCount} filtrów`} oczekuje na dane — wynik bez zmian
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function FilterPill({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] sm:min-h-0 bg-white border border-slate-200 text-[#002f34] rounded-md text-[12.5px] font-medium hover:border-[#002f34] transition"
    >
      {label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

/* ====================== Promo Card (design 46 promo-row) ====================== */
function PromoCard({
  tone, emoji, title, body, cta, href,
}: {
  tone: "dark" | "amber" | "emerald";
  emoji: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  const bgCls =
    tone === "dark"
      ? "text-white"
      : tone === "amber"
        ? "bg-amber-100 text-amber-900"
        : "bg-emerald-50 text-emerald-900";
  const bg =
    tone === "dark"
      ? { background: "linear-gradient(135deg, #002f34 0%, #004a52 100%)" }
      : undefined;
  return (
    <Link
      href={href}
      className={"relative overflow-hidden rounded-xl px-6 py-5 min-h-[130px] min-w-[264px] shrink-0 sm:min-w-0 sm:shrink flex flex-col justify-center transition hover:-translate-y-0.5 " + bgCls}
      style={bg}
    >
      <h3 className="text-[17px] leading-tight tracking-[-0.015em] font-bold m-0 mb-1">{title}</h3>
      <p className={"text-[12.5px] m-0 leading-snug " + (tone === "dark" ? "text-white/80" : "")}>{body}</p>
      <span className="mt-3 text-[12px] font-bold inline-flex items-center gap-1">
        {cta} →
      </span>
      <span className="absolute right-4 bottom-3 text-[64px] opacity-85 leading-none pointer-events-none">{emoji}</span>
    </Link>
  );
}

/* ====================== City Grid (design 46 city tiles) ====================== */
// MOCK: per-city counts hardcoded. Real impl needs aggregate view over
// trainers.location with a per-location counter.
const CITIES_GRID: Array<{ name: string; count: number }> = [
  { name: "Warszawa",  count: 178 },
  { name: "Kraków",    count: 84 },
  { name: "Wrocław",   count: 62 },
  { name: "Poznań",    count: 48 },
  { name: "Gdańsk",    count: 44 },
  { name: "Łódź",      count: 31 },
  { name: "Katowice",  count: 28 },
  { name: "Lublin",    count: 22 },
  { name: "Szczecin",  count: 19 },
  { name: "Białystok", count: 14 },
  { name: "Rzeszów",   count: 11 },
  { name: "Online (cała PL)", count: 94 },
];

function CityGridSection({ activeCity }: { activeCity: string }) {
  return (
    <section className="bg-slate-100 py-7">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="m-0 text-[18px] tracking-[-0.015em] font-bold text-[#002f34]">
            Trenerzy w innych miastach
          </h2>
          <Link href="/" className="text-[12.5px] text-[#002f34] font-bold underline hover:no-underline">
            Wszystkie miasta →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CITIES_GRID.map((c) => {
            const on = c.name === activeCity;
            return (
              <Link
                key={c.name}
                href={`/?city=${encodeURIComponent(c.name)}#wyniki`}
                className={
                  "rounded-lg px-3.5 py-3 flex justify-between items-center group transition " +
                  (on ? "bg-[#002f34] text-white" : "bg-white hover:bg-[#002f34] hover:text-white")
                }
              >
                <span className="text-[12.5px] font-bold">{c.name}</span>
                <span className={"text-[11px] " + (on ? "text-white/75" : "text-slate-500 group-hover:text-white/75")}>{c.count}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
