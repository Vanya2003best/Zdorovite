"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateLocation } from "./profile-actions";
import { SaveBar } from "./BasicForm";

type WorkMode = "stationary" | "online" | "both";

const WORK_MODES: { id: WorkMode; label: string }[] = [
  { id: "both", label: "Stacjonarnie + online" },
  { id: "stationary", label: "Tylko stacjonarnie" },
  { id: "online", label: "Tylko online" },
];

const POLISH_CITIES = [
  "Warszawa",
  "Kraków",
  "Wrocław",
  "Poznań",
  "Łódź",
  "Gdańsk",
  "Szczecin",
  "Lublin",
  "Katowice",
  "Białystok",
  "Bydgoszcz",
  "Toruń",
  "Rzeszów",
];

export default function LocationForm({
  location: initLoc,
  city: initCity,
  district: initDistrict,
  workMode: initMode,
  travelRadiusKm: initRadius,
}: {
  location: string;
  city: string;
  district: string;
  workMode: WorkMode | string;
  travelRadiusKm: number;
}) {
  const router = useRouter();
  const initial = {
    location: initLoc,
    city: initCity,
    district: initDistrict,
    workMode: (["stationary", "online", "both"] as const).includes(initMode as WorkMode)
      ? (initMode as WorkMode)
      : "both",
    travelRadiusKm: initRadius,
  };

  const [location, setLocation] = useState(initial.location);
  const [city, setCity] = useState(initial.city);
  const [district, setDistrict] = useState(initial.district);
  const [workMode, setWorkMode] = useState<WorkMode>(initial.workMode);
  const [radius, setRadius] = useState<number>(initial.travelRadiusKm);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    location !== initial.location ||
    city !== initial.city ||
    district !== initial.district ||
    workMode !== initial.workMode ||
    radius !== initial.travelRadiusKm;

  const liveRef = useRef({ location, city, district, workMode, travelRadiusKm: radius });
  useEffect(() => {
    liveRef.current = { location, city, district, workMode, travelRadiusKm: radius };
  }, [location, city, district, workMode, radius]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await updateLocation(liveRef.current);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  };

  const handleDiscard = () => {
    setLocation(initial.location);
    setCity(initial.city);
    setDistrict(initial.district);
    setWorkMode(initial.workMode);
    setRadius(initial.travelRadiusKm);
    setError(null);
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold tracking-[-0.005em] m-0">Lokalizacja</h3>
          <p className="text-[12px] text-slate-500 mt-1">
            Gdzie prowadzisz treningi. Wpływa na sortowanie po odległości w katalogu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-[12px] font-semibold text-slate-700">Główne miejsce treningu</span>
            <input
              value={location}
              maxLength={100}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="np. Studio MN · ul. Marszałkowska 142, Warszawa"
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-slate-700">Miasto</span>
            <input
              list="city-suggestions"
              value={city}
              maxLength={80}
              onChange={(e) => setCity(e.target.value)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
            <datalist id="city-suggestions">
              {POLISH_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-slate-700">Dzielnica</span>
            <input
              value={district}
              maxLength={80}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="np. Mokotów"
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-slate-700">Tryb pracy</span>
            <select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value as WorkMode)}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            >
              {WORK_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-slate-700">
              Promień dojazdu <span className="text-[11px] text-slate-500 font-normal">· km</span>
            </span>
            <input
              type="number"
              min={0}
              max={200}
              value={radius}
              onChange={(e) => setRadius(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
              disabled={workMode === "online"}
              className="px-3 py-2.5 text-[13.5px] rounded-[9px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>
        </div>

        <MapPreview city={city || "Polska"} />
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  );
}

/**
 * Pure-CSS map placeholder — same gradient + grid + pin from design 28.
 * No real geocoding / Google Maps until V2; the field this previews is
 * `city`, so we only re-render when city text changes.
 */
function MapPreview({ city }: { city: string }) {
  return (
    <div className="mt-4 relative h-[180px] rounded-[12px] overflow-hidden border border-slate-200 bg-gradient-to-br from-sky-100 to-emerald-100">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <div
          className="w-7 h-7 rounded-[50%_50%_50%_0] bg-emerald-500 -rotate-45 shadow-[0_6px_20px_rgba(16,185,129,0.4)] flex items-center justify-center"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white rotate-45" />
        </div>
      </div>
      <div className="absolute left-3 bottom-3 text-[11px] font-semibold text-slate-700 bg-white/85 backdrop-blur px-2 py-1 rounded-md">
        {city}
      </div>
    </div>
  );
}
