"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildLocationOptions,
  formatVoivodeship,
  getCitiesInVoivodeship,
  normalizeLocationQuery,
  PL_CITIES,
  PL_VOIVODESHIPS,
  type LocationOption,
} from "@/data/pl-locations";

type Props = {
  /** Controlled value — usually the parent's `city` state. */
  value: string;
  /** Fires on every change (typing or pick). Parent stores into URL on submit. */
  onChange: (next: string) => void;
  /** Native input name — used by the surrounding `<form>` on submit. */
  name?: string;
  placeholder?: string;
  inputClassName?: string;
  /** Fires when user explicitly picks an option (click / Enter in dropdown). */
  onPick?: (value: string) => void;
};

/**
 * OLX-style location combobox. Two modes:
 *
 * - **Browse** (default when open with no fresh typing): hierarchical
 *   drill-down — Cała Polska → 16 województw → cities → districts.
 * - **Search**: kicks in the moment user types something that doesn't
 *   exactly match the last committed pick. Flat substring filter across
 *   ~130 options (cities + districts).
 *
 * The input is controlled; `lastCommittedRef` tracks what the user last
 * picked so we can tell typing from picked-value display ("Warszawa,
 * Mokotów" still in the input after a pick is NOT a search query).
 *
 * Picking a leaf (city without districts, "Cała {city}", or district)
 * fires `onPick(value)` so the parent can apply the filter immediately
 * (OLX behavior). Picking a non-leaf (Cała Polska, województwo, city
 * with districts) drills deeper, not commits.
 */
export default function LocationPicker({
  value,
  onChange,
  name = "city",
  placeholder = "Cała Polska",
  inputClassName,
  onPick,
}: Props) {
  const [open, setOpen] = useState(false);
  const [browse, setBrowse] = useState<{ woj?: string; city?: string }>({});
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastCommittedRef = useRef(value);

  // ~130 entries, one-time build.
  const flatOptions = useMemo(() => buildLocationOptions(), []);

  // Search mode = input value diverges from the last picked value and
  // has at least 1 character. Reset on every fresh open.
  const searching =
    open && value.trim().length > 0 && value !== lastCommittedRef.current;

  const searchResults = useMemo(() => {
    if (!searching) return [];
    const q = normalizeLocationQuery(value.trim());
    return flatOptions.filter((o) => o.searchKey.includes(q)).slice(0, 60);
  }, [searching, value, flatOptions]);

  // Browse rows depend on current drill level.
  type BrowseRow =
    | { kind: "reset" }
    | { kind: "header"; label: string }
    | { kind: "voivodeship"; name: string; count: number }
    | { kind: "back"; label: string }
    | { kind: "cityWhole"; name: string }
    | { kind: "city"; name: string; hasDistricts: boolean }
    | { kind: "district"; city: string; name: string };

  const browseRows: BrowseRow[] = useMemo(() => {
    if (browse.city) {
      const c = PL_CITIES.find((x) => x.name === browse.city);
      const dists = c?.districts ?? [];
      const rows: BrowseRow[] = [
        { kind: "back", label: `← ${formatVoivodeship(browse.woj ?? "")}` },
        { kind: "cityWhole", name: browse.city },
        { kind: "header", label: "Wybierz dzielnicę" },
        ...dists.map<BrowseRow>((d) => ({ kind: "district", city: browse.city!, name: d })),
      ];
      return rows;
    }
    if (browse.woj) {
      const cities = getCitiesInVoivodeship(browse.woj);
      const rows: BrowseRow[] = [
        { kind: "back", label: "← Wszystkie województwa" },
        { kind: "header", label: `Miasta w: ${formatVoivodeship(browse.woj)}` },
        ...cities.map<BrowseRow>((c) => ({
          kind: "city",
          name: c.name,
          hasDistricts: (c.districts?.length ?? 0) > 0,
        })),
      ];
      return rows;
    }
    // Root level
    const rows: BrowseRow[] = [
      { kind: "reset" },
      { kind: "header", label: "Wybierz województwo" },
      ...PL_VOIVODESHIPS.map<BrowseRow>((w) => ({
        kind: "voivodeship",
        name: w,
        count: PL_CITIES.filter((c) => c.voivodeship === w).length,
      })),
    ];
    return rows;
  }, [browse]);

  // Indexes of pickable rows (skip headers) for keyboard nav.
  const pickableIdxs = useMemo(() => {
    if (searching) return searchResults.map((_, i) => i);
    return browseRows.map((r, i) => (r.kind === "header" ? -1 : i)).filter((i) => i !== -1);
  }, [searching, searchResults, browseRows]);

  useEffect(() => {
    setHighlight(0);
  }, [browse, searching]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  /** Open the dropdown AND reset drill path. Called from focus / typing
   *  / ArrowDown — anywhere that "starts an interaction". Resetting in
   *  one place (instead of a useEffect on `open`) avoids the prior bug
   *  where state churn during a drill click could reset the path
   *  mid-navigation. */
  function openFresh() {
    setOpen(true);
    setBrowse({});
    setHighlight(0);
  }

  function commit(picked: string) {
    onChange(picked);
    lastCommittedRef.current = picked;
    setOpen(false);
    setBrowse({});
    onPick?.(picked);
  }

  /** Click handler for the flat search results.
   *  - District options ("City, District") commit immediately.
   *  - City options drill into the district list when the city has any;
   *    otherwise commit. Picking a city is therefore never "skip district"
   *    unless the city has none — matches the user-requested flow:
   *    województwo → city → district → navigate. */
  function pickFromSearch(opt: LocationOption) {
    const isDistrict = opt.value.includes(",");
    if (isDistrict) {
      commit(opt.value);
      return;
    }
    const city = PL_CITIES.find((c) => c.name === opt.value);
    if (city && (city.districts?.length ?? 0) > 0) {
      // Drill: fill input with city name, reset lastCommitted so the
      // upcoming open is treated as browse mode, and switch to district list.
      onChange(city.name);
      lastCommittedRef.current = city.name;
      setBrowse({ woj: city.voivodeship, city: city.name });
      return;
    }
    commit(opt.value);
  }

  function handleRow(row: BrowseRow) {
    switch (row.kind) {
      case "reset":
        commit("");
        return;
      case "voivodeship":
        setBrowse({ woj: row.name });
        return;
      case "back":
        if (browse.city) setBrowse({ woj: browse.woj });
        else setBrowse({});
        return;
      case "city":
        if (row.hasDistricts) setBrowse({ woj: browse.woj, city: row.name });
        else commit(row.name);
        return;
      case "cityWhole":
        commit(row.name);
        return;
      case "district":
        commit(`${row.city}, ${row.name}`);
        return;
      case "header":
        return; // not clickable
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openFresh();
      return;
    }
    if (e.key === "Enter") {
      // Prevent the form from submitting while the dropdown is open —
      // Enter should pick the highlight, not trigger Szukaj.
      e.preventDefault();
      const idx = pickableIdxs[highlight];
      if (idx === undefined) return;
      if (searching) {
        const opt = searchResults[idx];
        if (opt) pickFromSearch(opt);
      } else {
        handleRow(browseRows[idx]);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, pickableIdxs.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        name={name}
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!open) openFresh(); }}
        onFocus={(e) => { openFresh(); e.currentTarget.select(); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName ?? "text-[13.5px] text-slate-900 font-semibold w-full border-0 outline-none bg-transparent placeholder:text-slate-400"}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && (
        // Dropdown is anchored to the LOKALIZACJA column edges (not the
        // inner input width), so negative left/right pulls it out by
        // the parent cell's px-3.5 (14px) padding on each side. The
        // dropdown sits *under* the form column: no top border / rounded
        // corners + low z so the column visually owns the top edge.
        <div
          role="listbox"
          className="absolute top-full z-[1] bg-white border border-t-0 border-slate-200 rounded-b-md shadow-[0_10px_24px_rgba(0,0,0,0.15)] max-h-[420px] overflow-y-auto"
          style={{ left: "-14px", right: "-14px" }}
        >
          {searching ? (
            searchResults.length === 0 ? (
              <div className="px-3 py-3 text-[12.5px] text-slate-500">
                Brak miast pasujących do „{value}".
              </div>
            ) : (
              <ul className="py-1">
                {searchResults.map((o, i) => {
                  const isDistrict = !!o.secondary && o.value.includes(",");
                  return (
                    <li
                      key={o.value}
                      role="option"
                      aria-selected={i === highlight}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); pickFromSearch(o); }}
                      onMouseEnter={() => setHighlight(i)}
                      className={
                        "px-3 py-2 cursor-pointer text-[13px] flex items-baseline gap-2 " +
                        (i === highlight ? "bg-emerald-50 text-[#002f34]" : "text-slate-800 hover:bg-slate-50")
                      }
                    >
                      <span className="w-3 shrink-0 text-slate-400 text-[11.5px]">
                        {isDistrict ? "↳" : ""}
                      </span>
                      <span className="font-semibold">{o.primary}</span>
                      {o.secondary && (
                        <span className="text-slate-400 text-[11.5px] truncate">
                          {isDistrict ? `w ${o.secondary}` : o.secondary}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <ul className="py-1">
              {browseRows.map((row, i) => {
                const hl = pickableIdxs[highlight] === i;
                if (row.kind === "header") {
                  return (
                    <li
                      key={`h-${i}`}
                      className="px-3 pt-3 pb-1 text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-bold"
                    >
                      {row.label}
                    </li>
                  );
                }
                if (row.kind === "back") {
                  return (
                    <li
                      key="back"
                      role="option"
                      aria-selected={hl}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRow(row); }}
                      onMouseEnter={() => setHighlight(pickableIdxs.indexOf(i))}
                      className={
                        "px-3 py-2 cursor-pointer text-[12.5px] font-semibold border-b border-slate-100 " +
                        (hl ? "bg-emerald-50 text-[#002f34]" : "text-slate-600 hover:bg-slate-50")
                      }
                    >
                      {row.label}
                    </li>
                  );
                }
                if (row.kind === "reset") {
                  return (
                    <li
                      key="reset"
                      role="option"
                      aria-selected={hl}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRow(row); }}
                      onMouseEnter={() => setHighlight(pickableIdxs.indexOf(i))}
                      className={
                        "px-3 py-2.5 cursor-pointer text-[13px] border-b border-slate-100 " +
                        (hl ? "bg-emerald-50" : "hover:bg-slate-50")
                      }
                    >
                      <div className="font-extrabold text-[#002f34] flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Cała Polska
                      </div>
                      <div className="text-[11.5px] text-slate-500 ml-[22px]">Wszyscy trenerzy w całym kraju</div>
                    </li>
                  );
                }
                if (row.kind === "voivodeship") {
                  return (
                    <li
                      key={`w-${row.name}`}
                      role="option"
                      aria-selected={hl}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRow(row); }}
                      onMouseEnter={() => setHighlight(pickableIdxs.indexOf(i))}
                      className={
                        "px-3 py-2 cursor-pointer text-[13px] flex items-center justify-between " +
                        (hl ? "bg-emerald-50 text-[#002f34]" : "text-slate-800 hover:bg-slate-50")
                      }
                    >
                      <span className="font-semibold">{formatVoivodeship(row.name)}</span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <span className="text-[11px]">{row.count}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18" /></svg>
                      </span>
                    </li>
                  );
                }
                if (row.kind === "city") {
                  return (
                    <li
                      key={`c-${row.name}`}
                      role="option"
                      aria-selected={hl}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRow(row); }}
                      onMouseEnter={() => setHighlight(pickableIdxs.indexOf(i))}
                      className={
                        "px-3 py-2 cursor-pointer text-[13px] flex items-center justify-between " +
                        (hl ? "bg-emerald-50 text-[#002f34]" : "text-slate-800 hover:bg-slate-50")
                      }
                    >
                      <span className="font-semibold">{row.name}</span>
                      {row.hasDistricts && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400"><polyline points="9 6 15 12 9 18" /></svg>
                      )}
                    </li>
                  );
                }
                if (row.kind === "cityWhole") {
                  return (
                    <li
                      key="wholeCity"
                      role="option"
                      aria-selected={hl}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRow(row); }}
                      onMouseEnter={() => setHighlight(pickableIdxs.indexOf(i))}
                      className={
                        "px-3 py-2.5 cursor-pointer text-[13px] border-b border-slate-100 " +
                        (hl ? "bg-emerald-50" : "hover:bg-slate-50")
                      }
                    >
                      <div className="font-extrabold text-[#002f34]">Cała {row.name}</div>
                      <div className="text-[11.5px] text-slate-500">Wszystkie dzielnice</div>
                    </li>
                  );
                }
                if (row.kind === "district") {
                  return (
                    <li
                      key={`d-${row.name}`}
                      role="option"
                      aria-selected={hl}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRow(row); }}
                      onMouseEnter={() => setHighlight(pickableIdxs.indexOf(i))}
                      className={
                        "px-3 py-2 cursor-pointer text-[13px] " +
                        (hl ? "bg-emerald-50 text-[#002f34]" : "text-slate-800 hover:bg-slate-50")
                      }
                    >
                      <span className="font-semibold">{row.name}</span>
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
