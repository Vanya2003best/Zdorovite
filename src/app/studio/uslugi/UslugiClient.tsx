"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  createService,
  updateService,
  deleteService,
} from "@/app/studio/services/actions";
import {
  createPackage,
  updatePackage,
  deletePackage,
} from "@/app/studio/packages/actions";

export type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  position: number;
};

export type Pkg = {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period: string | null;
  featured: boolean;
  position: number;
  sessions_total: number | null;
};

type Mode = "uslugi" | "pakiety" | "promocje";

/* ============ Service-type heuristic + palette (matches calendar) ============ */
type SType = "silowy" | "online" | "cardio" | "funkc" | "diag";
const TYPE_STYLE: Record<SType, { gradient: string; iconBg: string; iconText: string; label: string }> = {
  silowy: { gradient: "linear-gradient(135deg,#d1fae5,#a7f3d0)", iconBg: "#d1fae5", iconText: "#047857", label: "Siłowy" },
  online: { gradient: "linear-gradient(135deg,#dbeafe,#bfdbfe)", iconBg: "#dbeafe", iconText: "#1e40af", label: "Online" },
  cardio: { gradient: "linear-gradient(135deg,#fef3c7,#fde68a)", iconBg: "#fef3c7", iconText: "#b45309", label: "Cardio" },
  funkc:  { gradient: "linear-gradient(135deg,#fae8ff,#f5d0fe)", iconBg: "#fae8ff", iconText: "#86198f", label: "Funkc" },
  diag:   { gradient: "linear-gradient(135deg,#fee2e2,#fecaca)", iconBg: "#fee2e2", iconText: "#b91c1c", label: "Diagnostyka" },
};
function serviceType(name: string): SType {
  const t = name.toLowerCase();
  if (/online|zdaln|zoom|video|wideo/.test(t)) return "online";
  if (/funkc|mobil/.test(t)) return "funkc";
  if (/cardio|bieg|interw|spal/.test(t)) return "cardio";
  if (/diagn|fms|ocena|test|movement/.test(t)) return "diag";
  return "silowy";
}

export default function UslugiClient({
  mode: initialMode,
  services,
  packages,
  monthBookings,
}: {
  mode: Mode;
  services: Service[];
  packages: Pkg[];
  monthBookings: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: Mode = (["uslugi", "pakiety", "promocje"] as const).includes(
    (searchParams.get("mode") ?? "") as Mode,
  )
    ? ((searchParams.get("mode") ?? "uslugi") as Mode)
    : initialMode;

  const counts = {
    services: services.length,
    packages: packages.length,
    promocje: 0,
  };

  const avgPrice =
    services.length > 0
      ? Math.round(services.reduce((acc, s) => acc + s.price, 0) / services.length)
      : 0;
  const avgDuration =
    services.length > 0
      ? Math.round(services.reduce((acc, s) => acc + s.duration, 0) / services.length)
      : 0;

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-7 py-5 sm:py-7">
      {/* Topbar */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[26px] font-semibold tracking-[-0.022em] m-0">
            {mode === "pakiety" ? "Pakiety" : mode === "promocje" ? "Promocje" : "Usługi"}
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-1">
            {counts.services} {counts.services === 1 ? "usługa" : counts.services < 5 ? "usługi" : "usług"} ·{" "}
            {counts.packages} {counts.packages === 1 ? "pakiet" : counts.packages < 5 ? "pakiety" : "pakietów"} ·{" "}
            {monthBookings} {monthBookings === 1 ? "rezerwacja" : monthBookings < 5 ? "rezerwacje" : "rezerwacji"} w tym miesiącu
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled
            title="Wkrótce — import z arkusza Excel/Google Sheets"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20" />
            </svg>
            Importuj cennik
          </button>
          <button
            type="button"
            disabled
            title="Wkrótce — eksport cennika do PDF"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Eksport PDF
          </button>
          <PrimaryAddButton mode={mode} />
        </div>
      </div>

      {/* Mode switcher */}
      <ModeSwitcher mode={mode} counts={counts} />

      {/* Content per mode */}
      <div className="mt-5">
        {mode === "uslugi" && (
          <UslugiPanel services={services} avgPrice={avgPrice} avgDuration={avgDuration} />
        )}
        {mode === "pakiety" && <PakietyPanel packages={packages} services={services} />}
        {mode === "promocje" && <PromocjePanel />}
      </div>
    </div>
  );
}

/* ============ Mode switcher ============ */
function ModeSwitcher({
  mode,
  counts,
}: {
  mode: Mode;
  counts: { services: number; packages: number; promocje: number };
}) {
  const items: { id: Mode; label: string; count: number; icon: React.ReactNode }[] = [
    {
      id: "uslugi",
      label: "Usługi",
      count: counts.services,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
        </svg>
      ),
    },
    {
      id: "pakiety",
      label: "Pakiety",
      count: counts.packages,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: "promocje",
      label: "Promocje",
      count: counts.promocje,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 12V8H6a2 2 0 010-4h12v4M4 6v12a2 2 0 002 2h14v-4M18 12H6a2 2 0 100 4h12v-4z" />
        </svg>
      ),
    },
  ];
  return (
    <div className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium" role="tablist">
      {items.map((m) => {
        const on = mode === m.id;
        const href = m.id === "uslugi" ? "/studio/uslugi" : `/studio/uslugi?mode=${m.id}`;
        return (
          <Link
            key={m.id}
            href={href}
            scroll={false}
            role="tab"
            aria-selected={on}
            className={
              "px-4 py-1.5 rounded-[7px] inline-flex items-center gap-2 transition " +
              (on
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            {m.icon}
            {m.label}
            {m.count > 0 && (
              <span
                className={
                  "text-[10.5px] font-semibold px-1.5 py-px rounded-[5px] " +
                  (on ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700")
                }
              >
                {m.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ============ Primary "+ Add" button — dispatches based on mode ============ */
function PrimaryAddButton({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      if (mode === "uslugi") {
        const fd = new FormData();
        fd.set("name", "Nowa usługa");
        fd.set("description", "Opisz krótko, co klient dostaje na sesji.");
        fd.set("duration", "60");
        fd.set("price", "150");
        await createService(fd);
      } else if (mode === "pakiety") {
        const fd = new FormData();
        fd.set("name", "Nowy pakiet");
        fd.set("description", "Pakiet sesji ze zniżką.");
        fd.set("price", "550");
        fd.set("period", "");
        fd.set("items", "Sesja 1\nSesja 2\nSesja 3\nSesja 4");
        fd.set("featured", "false");
        await createPackage(fd);
      }
      router.refresh();
    });
  };

  if (mode === "promocje") {
    return (
      <button
        type="button"
        disabled
        title="Wkrótce — generator kodów promocyjnych"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60"
      >
        + Nowy kod
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black disabled:opacity-60"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {pending ? "Dodaję…" : mode === "pakiety" ? "Nowy pakiet" : "Nowa usługa"}
    </button>
  );
}

/* ============ Summary 4-card strip ============ */
function SummaryStrip({
  cards,
}: {
  cards: { label: string; value: string; unit?: string; detail?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.07em] text-slate-500 font-semibold">{c.label}</div>
          <div className="text-[22px] font-bold tracking-[-0.02em] text-slate-900 mt-1 tabular-nums">
            {c.value}
            {c.unit && <span className="text-[12px] text-slate-500 font-medium ml-1">{c.unit}</span>}
          </div>
          {c.detail && <div className="text-[11px] text-slate-500 mt-1">{c.detail}</div>}
        </div>
      ))}
    </div>
  );
}

/* ============ USŁUGI panel ============ */
function UslugiPanel({
  services,
  avgPrice,
  avgDuration,
}: {
  services: Service[];
  avgPrice: number;
  avgDuration: number;
}) {
  return (
    <div>
      <SummaryStrip
        cards={[
          { label: "Aktywne usługi", value: String(services.length), unit: services.length === 1 ? "usługa" : services.length < 5 ? "usługi" : "usług" },
          { label: "Średnia cena", value: avgPrice > 0 ? String(avgPrice) : "—", unit: avgPrice > 0 ? "PLN" : undefined },
          { label: "Średni czas", value: avgDuration > 0 ? String(avgDuration) : "—", unit: avgDuration > 0 ? "min" : undefined },
          { label: "Najpopularniejsza", value: services[0]?.name.split(" ")[0] ?? "—", detail: services[0] ? `${services[0].price} PLN` : "Dodaj pierwszą usługę" },
        ]}
      />
      {services.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 px-6 py-16 text-center">
          <div className="text-[15px] font-semibold text-slate-700">Brak usług</div>
          <p className="text-[12.5px] text-slate-500 mt-1.5 max-w-[420px] mx-auto leading-[1.55]">
            Dodaj pierwszą usługę przez przycisk „+ Nowa usługa". Pojawi się na Twoim publicznym profilu i klienci będą mogli ją rezerwować.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [desc, setDesc] = useState(service.description);
  const [duration, setDuration] = useState(service.duration);
  const [price, setPrice] = useState(service.price);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = useMemo(() => TYPE_STYLE[serviceType(service.name)], [service.name]);

  const save = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", service.id);
      fd.set("name", name);
      fd.set("description", desc);
      fd.set("duration", String(duration));
      fd.set("price", String(price));
      await updateService(fd);
      setEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", service.id);
      await deleteService(fd);
      router.refresh();
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden flex flex-col hover:border-slate-300 hover:shadow-md transition">
      {/* Cover with gradient by service type */}
      <div className="h-[90px] relative px-3.5 py-3 flex items-end" style={{ background: cfg.gradient }}>
        <div className="absolute top-3 right-3 w-9 h-9 rounded-[10px] bg-white/70 backdrop-blur flex items-center justify-center text-slate-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
          </svg>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[10.5px] font-semibold uppercase tracking-[0.06em] bg-white border border-slate-200 text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 pt-3.5 flex-1">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-[16px] font-semibold tracking-[-0.015em] text-slate-900 mb-1.5 border border-emerald-500 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        ) : (
          <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-slate-900 m-0 mb-1.5">{name}</h3>
        )}
        <div className="flex gap-2.5 flex-wrap text-[11.5px] text-slate-500 mb-2.5">
          {editing ? (
            <>
              <label className="inline-flex items-center gap-1">
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(15, Number(e.target.value) || 0))}
                  className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-center"
                />
                min
              </label>
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {duration} min
            </span>
          )}
        </div>
        {editing ? (
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="w-full text-[12.5px] text-slate-700 leading-[1.45] mb-3 border border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-emerald-500 resize-y"
          />
        ) : (
          desc && <p className="text-[12.5px] text-slate-700 leading-[1.45] m-0 mb-3 line-clamp-3">{desc}</p>
        )}
      </div>

      {/* Foot — price + edit/save */}
      <div className="flex items-end justify-between px-4 pb-3.5 gap-2.5">
        <div>
          {editing ? (
            <div className="inline-flex items-center gap-1 bg-white border border-emerald-500 rounded-[6px] px-2 py-1">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
                className="w-16 text-[18px] font-bold tracking-[-0.02em] text-slate-900 tabular-nums focus:outline-none"
              />
              <span className="text-[12px] font-medium text-slate-500">PLN</span>
            </div>
          ) : (
            <div className="text-[22px] font-bold tracking-[-0.02em] text-slate-900 tabular-nums">
              {price}
              <span className="text-[13px] font-medium text-slate-500 ml-1">PLN</span>
            </div>
          )}
          <div className="text-[10.5px] text-emerald-700 mt-0.5 font-medium">za sesję</div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex gap-1.5 px-3 py-2.5 border-t border-slate-100 bg-slate-50">
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 h-7 inline-flex items-center justify-center text-[11.5px] font-semibold rounded-[7px] bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(service.name);
                setDesc(service.description);
                setDuration(service.duration);
                setPrice(service.price);
                setEditing(false);
              }}
              className="flex-1 h-7 inline-flex items-center justify-center text-[11.5px] font-medium rounded-[7px] bg-white text-slate-700 border border-slate-200"
            >
              Anuluj
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 h-7 inline-flex items-center justify-center gap-1 text-[11.5px] font-medium rounded-[7px] bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edytuj
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className={
                "h-7 inline-flex items-center justify-center px-3 text-[11.5px] font-semibold rounded-[7px] transition disabled:opacity-50 " +
                (confirmDelete
                  ? "bg-rose-600 text-white hover:bg-rose-700 animate-pulse"
                  : "bg-white text-slate-500 border border-slate-200 hover:text-rose-600")
              }
              title={confirmDelete ? "Kliknij ponownie, aby potwierdzić" : "Usuń"}
            >
              {confirmDelete ? (
                "Potwierdź"
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ PAKIETY panel ============ */
function PakietyPanel({ packages, services }: { packages: Pkg[]; services: Service[] }) {
  const totalSessions = packages.reduce((acc, p) => acc + (p.sessions_total ?? 0), 0);
  const avgDiscount =
    services.length > 0 && packages.length > 0
      ? (() => {
          const avgServicePrice = services.reduce((a, s) => a + s.price, 0) / services.length;
          const avgPkgPerSession = packages.reduce((a, p) => {
            const total = p.sessions_total ?? Math.max(1, p.items.length);
            return a + p.price / total;
          }, 0) / packages.length;
          return Math.max(0, Math.round((1 - avgPkgPerSession / avgServicePrice) * 100));
        })()
      : 0;

  return (
    <div>
      <SummaryStrip
        cards={[
          { label: "Aktywne pakiety", value: String(packages.length), unit: packages.length === 1 ? "pakiet" : packages.length < 5 ? "pakiety" : "pakietów" },
          { label: "Łącznie sesji", value: String(totalSessions || "—"), unit: totalSessions ? "sesji" : undefined },
          { label: "Śr. zniżka", value: avgDiscount > 0 ? String(avgDiscount) : "—", unit: avgDiscount > 0 ? "%" : undefined },
          { label: "Wyróżniony", value: packages.find((p) => p.featured)?.name?.split(" ")[0] ?? "—", detail: packages.find((p) => p.featured) ? "popularne" : "Nie ustawiono" },
        ]}
      />
      {packages.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 px-6 py-16 text-center">
          <div className="text-[15px] font-semibold text-slate-700">Brak pakietów</div>
          <p className="text-[12.5px] text-slate-500 mt-1.5 max-w-[420px] mx-auto leading-[1.55]">
            Dodaj pakiet sesji ze zniżką — średnio konwertują 34% lepiej niż pojedyncze usługi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map((p) => (
            <PackageCard key={p.id} pkg={p} services={services} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg, services }: { pkg: Pkg; services: Service[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pkg.name);
  const [desc, setDesc] = useState(pkg.description);
  const [price, setPrice] = useState(pkg.price);
  const [period, setPeriod] = useState(pkg.period ?? "");
  const [featured, setFeatured] = useState(pkg.featured);
  const [items, setItems] = useState(pkg.items.join("\n"));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Estimated saving vs buying single sessions, only meaningful when
  // we have at least one service to compare against.
  const sessions = pkg.sessions_total ?? Math.max(1, pkg.items.length);
  const singlesEquivalent =
    services.length > 0
      ? Math.round((services.reduce((a, s) => a + s.price, 0) / services.length) * sessions)
      : 0;
  const savingPct =
    singlesEquivalent > 0 ? Math.max(0, Math.round((1 - pkg.price / singlesEquivalent) * 100)) : 0;
  const perSession = sessions > 0 ? Math.round(pkg.price / sessions) : 0;

  const save = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", pkg.id);
      fd.set("name", name);
      fd.set("description", desc);
      fd.set("price", String(price));
      fd.set("period", period);
      fd.set("items", items);
      fd.set("featured", featured ? "true" : "false");
      await updatePackage(fd);
      setEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", pkg.id);
      await deletePackage(fd);
      router.refresh();
    });
  };

  return (
    <div
      className={
        "bg-white rounded-[14px] p-5 relative transition hover:shadow-md " +
        (pkg.featured ? "border-2 border-emerald-500" : "border border-slate-200 hover:border-slate-300")
      }
    >
      {pkg.featured && (
        <span className="absolute -top-2.5 right-4 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full">
          Najpopularniejszy
        </span>
      )}

      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full text-[11px] font-semibold text-slate-700 mb-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
        {sessions} {sessions === 1 ? "sesja" : sessions < 5 ? "sesje" : "sesji"}
      </div>

      {editing ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-[18px] font-semibold tracking-[-0.015em] text-slate-900 m-0 mb-1 border border-emerald-500 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      ) : (
        <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-slate-900 m-0 mb-1">{name}</h3>
      )}
      {editing ? (
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className="w-full text-[12.5px] text-slate-500 leading-[1.45] mb-4 border border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-emerald-500 resize-y"
        />
      ) : (
        desc && <p className="text-[12.5px] text-slate-500 leading-[1.45] m-0 mb-4">{desc}</p>
      )}

      <div className="flex items-baseline gap-2.5 mb-1.5">
        {editing ? (
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 text-[32px] font-bold tracking-[-0.025em] text-slate-900 tabular-nums border border-emerald-500 rounded-[6px] px-2 py-0 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        ) : (
          <span className="text-[32px] font-bold tracking-[-0.025em] text-slate-900 tabular-nums">{price}</span>
        )}
        <span className="text-[16px] font-medium text-slate-500">PLN</span>
        {!editing && savingPct > 0 && (
          <span className="text-[14px] text-slate-400 line-through tabular-nums">{singlesEquivalent}</span>
        )}
      </div>
      {!editing && savingPct > 0 && (
        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded mb-3">
          oszczędność {savingPct}%
        </span>
      )}
      {!editing && perSession > 0 && (
        <div className="text-[11.5px] text-slate-500 mb-4 tabular-nums">
          {perSession} PLN za sesję
        </div>
      )}

      {/* Includes list */}
      {editing ? (
        <textarea
          value={items}
          onChange={(e) => setItems(e.target.value)}
          rows={4}
          placeholder="Każda pozycja w nowej linii"
          className="w-full text-[12.5px] text-slate-700 leading-[1.45] border-t border-slate-100 pt-4 border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-emerald-500 resize-y"
        />
      ) : (
        <div className="flex flex-col gap-2 pt-3.5 border-t border-slate-100">
          {pkg.items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-[12.5px] text-slate-700 leading-[1.4]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="shrink-0 mt-0.5">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Editing extras */}
      {editing && (
        <div className="grid gap-2 mt-3 pt-3 border-t border-slate-100">
          <label className="text-[11px] font-semibold text-slate-700 inline-flex items-center gap-2">
            Okres ważności (np. "60 dni"):
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              maxLength={40}
              className="border border-slate-200 rounded px-2 py-1 text-[12px] font-normal flex-1"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-[12px] text-slate-700 select-none">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            Wyróżnij jako "Najpopularniejszy"
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 mt-4 pt-3.5 border-t border-slate-100">
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 h-8 inline-flex items-center justify-center text-[12px] font-semibold rounded-[7px] bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(pkg.name);
                setDesc(pkg.description);
                setPrice(pkg.price);
                setPeriod(pkg.period ?? "");
                setFeatured(pkg.featured);
                setItems(pkg.items.join("\n"));
                setEditing(false);
              }}
              className="flex-1 h-8 inline-flex items-center justify-center text-[12px] font-medium rounded-[7px] bg-white text-slate-700 border border-slate-200"
            >
              Anuluj
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 h-8 inline-flex items-center justify-center gap-1 text-[12px] font-medium rounded-[7px] bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
            >
              Edytuj
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className={
                "h-8 inline-flex items-center justify-center px-3 text-[12px] font-semibold rounded-[7px] transition disabled:opacity-50 " +
                (confirmDelete
                  ? "bg-rose-600 text-white hover:bg-rose-700 animate-pulse"
                  : "bg-white text-slate-500 border border-slate-200 hover:text-rose-600")
              }
            >
              {confirmDelete ? "Potwierdź" : "Usuń"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ PROMOCJE panel — placeholder ============ */
function PromocjePanel() {
  return (
    <div>
      <SummaryStrip
        cards={[
          { label: "Aktywne kody", value: "—", detail: "wkrótce" },
          { label: "Wykorzystane", value: "—", detail: "ostatnie 30 dni" },
          { label: "Vouchery", value: "—", detail: "prezentowe" },
          { label: "Średnia zniżka", value: "—" },
        ]}
      />
      <div className="rounded-2xl border-2 border-dashed border-slate-300 px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-[12px] bg-amber-100 text-amber-700 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 12V8H6a2 2 0 010-4h12v4M4 6v12a2 2 0 002 2h14v-4M18 12H6a2 2 0 100 4h12v-4z" />
          </svg>
        </div>
        <div className="text-[16px] font-semibold text-slate-900">Wkrótce — Promocje i vouchery</div>
        <p className="text-[12.5px] text-slate-500 mt-2 max-w-[480px] mx-auto leading-[1.55]">
          Generuj kody zniżkowe (np. <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">WIOSNA20</code>),
          vouchery prezentowe (klient kupuje, prezentuje znajomemu) i sezonowe promocje. Pojawi się w kolejnej aktualizacji.
        </p>
      </div>
    </div>
  );
}
