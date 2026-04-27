"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ProfileCustomization, SectionId, TemplateName } from "@/types";
import { updateDesign } from "./actions";
import { togglePublished } from "@/app/trainers/[id]/edit-actions";
import EditableText from "@/components/EditableText";
import InlineServicesEditor from "@/app/trainers/[id]/InlineServicesEditor";
import InlinePackagesEditor from "@/app/trainers/[id]/InlinePackagesEditor";
import ImageUpload from "./ImageUpload";
import { templates } from "@/data/templates";

type PreviewService = { id: string; name: string; description: string; price: number; duration: number };
type PreviewPackage = { id: string; name: string; description: string; items: string[]; price: number; period?: string; featured: boolean };

type PreviewData = {
  avatarUrl: string | null;
  coverImage: string | null;
  tagline: string | null;
  about: string | null;
  location: string | null;
  rating: number | null;
  reviewCount: number | null;
  services: PreviewService[];
  packages: PreviewPackage[];
};

type Props = {
  slug: string;
  trainerName: string;
  published: boolean;
  initial: ProfileCustomization;
  completion: { pct: number; tip: string };
  counts: Partial<Record<SectionId, number>>;
  preview: PreviewData;
};

type TemplateOption = { id: TemplateName; label: string; sub: string; thumb: string; bar: string };

const TEMPLATES: TemplateOption[] = [
  { id: "minimal", label: "Minimal", sub: "Czysty, biały",
    thumb: "linear-gradient(135deg,#f1f5f9,#ffffff)", bar: "#cbd5e1" },
  { id: "sport", label: "Sport", sub: "Ciemny, neon",
    thumb: "linear-gradient(135deg,#020617,#1e293b)", bar: "#a3e635" },
  { id: "premium", label: "Premium", sub: "Glass, gradient",
    thumb: "linear-gradient(135deg,#ecfdf5,#d1fae5)", bar: "#10b981" },
  { id: "cozy", label: "Cozy", sub: "Ciepły, beż",
    thumb: "linear-gradient(135deg,#fef3e0,#fbbf77)", bar: "#ea580c" },
];

const PRO_TEMPLATES: TemplateOption[] = [
  { id: "luxury", label: "Luxury", sub: "Editorial, serif",
    thumb: "linear-gradient(135deg,#f6f1e8,#fbf8f1)", bar: "#8a7346" },
  { id: "studio", label: "Studio", sub: "Bento, ostry",
    thumb: "linear-gradient(135deg,#fafaf7,#ffffff)", bar: "#ff5722" },
  { id: "cinematic", label: "Cinematic", sub: "Mrok, big type",
    thumb: "linear-gradient(135deg,#0a0a0c,#1f1f23)", bar: "#d4ff00" },
  { id: "signature", label: "Signature", sub: "Burgundy, brand",
    thumb: "linear-gradient(135deg,#f6f1ea,#ede4d6)", bar: "#7d1f1f" },
];

const SWATCHES = ["#10b981", "#14b8a6", "#0ea5e9", "#6366f1", "#ec4899", "#f97316", "#f59e0b"];

const SECTION_LABELS: Record<SectionId, string> = {
  about: "O mnie",
  services: "Usługi",
  packages: "Pakiety",
  gallery: "Galeria",
  certifications: "Certyfikaty",
  reviews: "Opinie",
};

const TEMPLATE_LABEL: Record<TemplateName, string> = {
  minimal: "Minimal", sport: "Sport", premium: "Premium", cozy: "Cozy",
  luxury: "Luxury", studio: "Studio", cinematic: "Cinematic", signature: "Signature",
};

const ACCENT_LABEL_BY_HEX: Record<string, string> = {
  "#10b981": "Emerald", "#14b8a6": "Teal", "#0ea5e9": "Sky", "#6366f1": "Indigo",
  "#ec4899": "Pink", "#f97316": "Orange", "#f59e0b": "Amber",
};

export default function EditorClient({ slug, trainerName, published, initial, completion, counts, preview }: Props) {
  const [template, setTemplate] = useState<TemplateName>(initial.template);
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [sections, setSections] = useState(initial.sections);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [savedAt, setSavedAt] = useState<number | null>(Date.now());
  const [savedAgo, setSavedAgo] = useState("teraz");
  const [pubPending, startPubTransition] = useTransition();

  const colorInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await updateDesign({ template, accentColor, sections });
      setSavedAt(Date.now());
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [template, accentColor, sections]);

  useEffect(() => {
    const tick = () => {
      if (!savedAt) return setSavedAgo("");
      const s = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
      setSavedAgo(s < 5 ? "teraz" : s < 60 ? `${s}s temu` : `${Math.round(s / 60)} min temu`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [savedAt]);

  // Section drag-and-drop
  const dragIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const onDragStart = (i: number) => () => { dragIndex.current = i; setDragging(i); };
  const onDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === i) return;
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current!, 1);
      next.splice(i, 0, moved);
      dragIndex.current = i;
      return next;
    });
  };
  const onDragEnd = () => { dragIndex.current = null; setDragging(null); };

  const toggleSection = (id: SectionId) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

  const accentLabel = ACCENT_LABEL_BY_HEX[accentColor.toLowerCase()] ?? "Custom";
  const templateLabel = TEMPLATE_LABEL[template];

  return (
    <div className="flex flex-col bg-slate-100 min-h-[calc(100vh-56px-84px)] lg:min-h-[calc(100vh-56px)]">
      {/* ===== EDITOR ACTION BAR — saved-status + viewport toggle + publish.
          Brand/menu chrome lives in the layout's StudioSidebar/TopBar. */}
      <div className="bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-5 py-2.5 gap-3 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Zapisano · {savedAgo}
        </span>
        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex bg-slate-100 rounded-[9px] p-[3px] gap-[2px]">
            {(["desktop", "mobile"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] text-[12px] transition ${
                  viewport === v ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {v === "desktop" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>
                )}
                {v === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
          <Link
            href={`/trainers/${slug}`}
            target="_blank"
            className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[13px] font-medium text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /></svg>
            Podgląd
          </Link>
          <button
            type="button"
            disabled={pubPending}
            onClick={() => startPubTransition(async () => { await togglePublished(); })}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[10px] text-[13px] font-semibold transition disabled:opacity-60 bg-slate-900 text-white hover:bg-black"
          >
            {pubPending ? "..." : published ? "Cofnij publikację" : "Opublikuj"}
          </button>
        </div>
      </div>

      {/* ===== LAYOUT — preview LEFT, settings RIGHT (per user request) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] flex-1 min-h-0">

        {/* The settings aside is below in DOM order; CSS grid + lg:order
            classes flip them visually so preview renders LEFT on lg+. */}

        {/* ===== SETTINGS PANEL (visually on the right via lg:order-2) ===== */}
        <aside className="bg-white lg:border-l lg:border-slate-200 border-b lg:border-b-0 border-slate-200 overflow-y-auto lg:order-2 max-h-[calc(100vh-56px-56px-84px)] lg:max-h-none">
          {/* Completion card — margin: 16px 20px 0 20px */}
          <div className="mt-4 mx-5 p-3.5 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex justify-between items-baseline">
              <span className="text-[12px] text-slate-700 font-medium">Profil wypełniony</span>
              <span className="text-[18px] font-semibold text-emerald-700 tabular-nums">{completion.pct}%</span>
            </div>
            <div className="h-1 mt-2 bg-emerald-100 rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${completion.pct}%` }} />
            </div>
            <div className="text-[11px] text-slate-600 mt-2">{completion.tip}</div>
          </div>

          {/* Templates block — padding 20px 20px 24px, bottom border */}
          <div className="px-5 pt-5 pb-6 border-b border-slate-200">
            <h3 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500 mb-3">Szablon wizualny</h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <TemplateCard key={t.id} option={t} active={template === t.id} onPick={setTemplate} />
              ))}
            </div>

            {/* Pro tier */}
            <div className="mt-5 flex items-center justify-between">
              <h3 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Plan Pro</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                ✦ Pro
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Zaawansowane szablony z unikalnym layoutem.</p>
            <div className="grid grid-cols-2 gap-2">
              {PRO_TEMPLATES.map((t) => (
                <TemplateCard key={t.id} option={t} active={template === t.id} onPick={setTemplate} pro />
              ))}
            </div>
          </div>

          {/* Accent color block */}
          <div className="px-5 pt-5 pb-6 border-b border-slate-200">
            <h3 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500 mb-3">Kolor akcentu</h3>
            <div className="flex gap-2 flex-wrap items-center">
              {SWATCHES.map((c) => {
                const active = accentColor.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccentColor(c)}
                    aria-label={c}
                    className={`relative w-8 h-8 rounded-full border-2 border-white transition ${
                      active ? "shadow-[0_0_0_2px_#0f172a]" : "shadow-[0_0_0_1px_#e2e8f0] hover:shadow-[0_0_0_1px_#94a3b8]"
                    }`}
                    style={{ background: c }}
                  >
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-[14px] font-bold">✓</span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 text-slate-500 inline-flex items-center justify-center bg-white hover:border-slate-500"
                title="Własny kolor"
              >
                +
              </button>
              <input
                ref={colorInputRef}
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="sr-only"
              />
              {!SWATCHES.some((c) => c.toLowerCase() === accentColor.toLowerCase()) && (
                <span
                  className="w-8 h-8 rounded-full border-2 border-white shadow-[0_0_0_2px_#0f172a] inline-flex items-center justify-center text-white text-[14px] font-bold"
                  style={{ background: accentColor }}
                  title={accentColor}
                >
                  ✓
                </span>
              )}
            </div>
          </div>

          {/* Section order block */}
          <div className="px-5 pt-5 pb-6 border-b border-slate-200">
            <h3 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500 mb-3">Kolejność sekcji</h3>
            <ul className="grid gap-1.5">
              {sections.map((s, i) => {
                const count = counts[s.id];
                return (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={onDragStart(i)}
                    onDragOver={onDragOver(i)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border bg-slate-50 cursor-grab active:cursor-grabbing ${
                      dragging === i
                        ? "opacity-50 border-dashed border-emerald-400 bg-white shadow-[0_6px_18px_rgba(16,185,129,0.2)]"
                        : "border-slate-200"
                    } ${!s.visible ? "opacity-60" : ""}`}
                  >
                    <svg className="text-slate-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="9" cy="19" r="1.4" />
                      <circle cx="15" cy="5" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="15" cy="19" r="1.4" />
                    </svg>
                    <span className="text-[13px] font-medium flex-1 text-slate-900">{SECTION_LABELS[s.id]}</span>
                    {typeof count === "number" && (
                      <span className="text-[11px] text-slate-500 tabular-nums">{count}</span>
                    )}
                    <label className="relative inline-block w-8 h-[18px] shrink-0">
                      <input
                        type="checkbox"
                        checked={s.visible}
                        onChange={() => toggleSection(s.id)}
                        className="sr-only peer"
                      />
                      <span className="absolute inset-0 cursor-pointer bg-slate-300 rounded-full transition peer-checked:bg-emerald-500" />
                      <span className="absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full transition peer-checked:translate-x-[14px]" />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

        </aside>

        {/* ===== PREVIEW CANVAS — visually LEFT (lg:order-1) ===== */}
        <section
          className="relative overflow-y-auto lg:order-1"
          style={{
            backgroundColor: "#f8fafc",
            backgroundImage: "radial-gradient(circle at 15px 15px, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <div className="flex items-center justify-between px-7 pt-6 pb-5">
            <div className="text-[13px] text-slate-600">
              Podgląd · <strong className="text-slate-900">{templateLabel} · {accentLabel}</strong>
            </div>
            <Link
              href={`/trainers/${slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 hover:border-slate-400 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M10 14L21 3" /></svg>
              Otwórz w nowej karcie
            </Link>
          </div>

          <span className="absolute top-6 right-7 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] text-slate-700 font-medium shadow-[0_1px_3px_rgba(2,6,23,.04)] hidden">
            <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500">
              <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
            </span>
            Live preview
          </span>

          <div className="px-4 sm:px-7 pb-10">
            <div
              className="mx-auto bg-white rounded-[20px] overflow-hidden shadow-[0_32px_64px_-32px_rgba(2,6,23,0.2),0_0_0_1px_#e2e8f0] transition-[max-width] duration-300"
              style={{ maxWidth: viewport === "desktop" ? 880 : 390 }}
            >
              <PreviewMock
                template={template}
                trainerName={trainerName}
                accentColor={accentColor}
                preview={preview}
                visibleSections={new Set(sections.filter((s) => s.visible).map((s) => s.id))}
                sectionOrder={sections.map((s) => s.id)}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================================
// PreviewMock — рендерит мокап с использованием стилей выбранного шаблона.
// Когда юзер переключает Cozy/Sport/Premium/Minimal — обложка, аватар, типографика
// и заголовки секций реально меняют вид. Услуги/пакеты используют inline-редакторы
// (общий вид во всех шаблонах для удобства редактирования).
// ============================================================

function PreviewMock({
  template,
  trainerName,
  accentColor,
  preview,
  visibleSections,
  sectionOrder,
}: {
  template: TemplateName;
  trainerName: string;
  accentColor: string;
  preview: PreviewData;
  visibleSections: Set<SectionId>;
  sectionOrder: SectionId[];
}) {
  const s = templates[template] ?? templates.premium;
  const cover = preview.coverImage;
  const isPremium = template === "premium";
  const isSport = template === "sport";
  const isDark = template === "sport" || template === "cinematic";

  return (
    <div className={s.pageBg}>
      {/* Cover — uses template's coverBg + height */}
      <div className={`relative ${s.coverBg} ${s.coverHeight} overflow-hidden`}>
        {cover && (
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        {s.coverOverlay && <div className={s.coverOverlay} />}
        <div className="absolute top-3 right-3 z-10">
          <ImageUpload
            variant="cover"
            currentUrl={cover}
            removable
            trigger={
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/95 backdrop-blur-md border border-white text-[12px] font-medium text-slate-800 shadow-sm hover:bg-white transition">
                ✎ {cover ? "Zmień okładkę" : "Dodaj okładkę"}
              </span>
            }
          />
        </div>
      </div>

      {/* Hero — Premium uses glass card; other templates use simpler in-flow layout */}
      {isPremium ? (
        <div className="-mt-[50px] mx-7 relative z-10 bg-white/[0.88] backdrop-blur-[14px] border border-white/70 rounded-2xl p-[18px] flex gap-4 items-center shadow-[0_12px_28px_-12px_rgba(2,6,23,0.12)]">
          <HeroAvatar avatarUrl={preview.avatarUrl} trainerName={trainerName} avatarStyle={s.avatarStyle} />
          <HeroText
            trainerName={trainerName} preview={preview} s={s} isDark={isDark}
          />
        </div>
      ) : (
        <div className="px-6 -mt-9 relative z-10 pb-2">
          <HeroAvatar avatarUrl={preview.avatarUrl} trainerName={trainerName} avatarStyle={s.avatarStyle} />
          <div className="mt-3.5">
            <h2 className={s.nameStyle + " m-0"}>
              {isSport
                ? <>{trainerName.split(" ")[0]}<br />{trainerName.split(" ").slice(1).join(" ")}</>
                : trainerName}
            </h2>
            <div className={`mt-1 ${s.tagStyle}`}>
              <EditableText
                field="tagline"
                initial={preview.tagline ?? ""}
                maxLength={200}
                placeholder="Dodaj tagline (jedno zdanie o sobie)"
              />
            </div>
            <div className={`mt-3 flex gap-3.5 flex-wrap items-center ${s.metaStyle}`}>
              {preview.rating !== null && (
                <span>★ {preview.rating} · {preview.reviewCount ?? 0}</span>
              )}
              <span className="inline-flex items-center gap-1">
                📍
                <EditableText
                  field="location"
                  initial={preview.location ?? ""}
                  maxLength={100}
                  placeholder="Miasto"
                />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Body — sections in chosen order, only visible ones */}
      <div className="px-7 pt-6 pb-7 grid gap-[18px]">
        {sectionOrder.filter((id) => visibleSections.has(id)).map((id) => {
          if (id === "about") return <AboutMock key={id} text={preview.about} sectionTitleStyle={s.sectionTitleStyle} bodyText={s.bodyText} />;
          if (id === "services") return <ServicesMock key={id} services={preview.services} accent={accentColor} sectionTitleStyle={s.sectionTitleStyle} />;
          if (id === "packages") return <PackagesMock key={id} packages={preview.packages} accent={accentColor} sectionTitleStyle={s.sectionTitleStyle} />;
          if (id === "gallery") return <PlaceholderMock key={id} title="Galeria" sectionTitleStyle={s.sectionTitleStyle} hint="Dodaj zdjęcia z sesji w sekcji „Mój profil”." />;
          if (id === "certifications") return <PlaceholderMock key={id} title="Certyfikaty" sectionTitleStyle={s.sectionTitleStyle} hint="Lista certyfikatów pojawi się tutaj." />;
          if (id === "reviews") return <PlaceholderMock key={id} title="Opinie" sectionTitleStyle={s.sectionTitleStyle} hint="Opinie klientów po pierwszych sesjach." />;
          return null;
        })}
      </div>
    </div>
  );
}

function TemplateCard({
  option,
  active,
  onPick,
  pro = false,
}: {
  option: TemplateOption;
  active: boolean;
  onPick: (id: TemplateName) => void;
  pro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(option.id)}
      className={`text-left rounded-[10px] border bg-white p-2.5 relative transition ${
        active
          ? "border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
          : "border-slate-200 hover:border-slate-400"
      }`}
    >
      <div className="aspect-[4/3] rounded-md mb-2 relative overflow-hidden" style={{ background: option.thumb }}>
        <div className="absolute top-[5px] left-[5px] flex gap-[2px]">
          {[0, 1, 2].map((i) => <span key={i} className="w-1 h-1 rounded-full bg-white/60" />)}
        </div>
        <span className="absolute left-1.5 right-[60%] h-0.5 rounded-[1px]" style={{ top: "28%", background: option.bar, opacity: 0.55 }} />
        <span className="absolute left-1.5 right-[30%] h-0.5 rounded-[1px]" style={{ top: "44%", background: option.bar, opacity: 0.45 }} />
        <span className="absolute left-1.5 right-[40%] h-0.5 rounded-[1px]" style={{ top: "60%", background: option.bar, opacity: 0.55 }} />
        {pro && (
          <span className="absolute bottom-[5px] right-[5px] text-[8px] font-bold tracking-wider uppercase px-1 py-px rounded-sm bg-white/90 text-amber-700 shadow-sm">
            ✦ Pro
          </span>
        )}
      </div>
      <div className="text-[12px] font-medium text-slate-900">{option.label}</div>
      <div className="text-[10px] text-slate-500">{option.sub}</div>
      {active && (
        <span className="absolute top-[7px] right-[7px] w-[18px] h-[18px] rounded-full bg-emerald-500 text-white inline-flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
      )}
    </button>
  );
}

// Avatar with the upload button overlay; uses template's avatarStyle for size/border/shape.
function HeroAvatar({
  avatarUrl,
  trainerName,
  avatarStyle,
}: {
  avatarUrl: string | null;
  trainerName: string;
  avatarStyle: string;
}) {
  return (
    <div className="relative inline-block shrink-0">
      <div className={avatarStyle + " overflow-hidden"}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full inline-flex items-center justify-center text-emerald-700 font-semibold text-2xl bg-emerald-50">
            {(trainerName || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <ImageUpload
        variant="avatar"
        currentUrl={avatarUrl}
        className="absolute -bottom-1 -right-1"
        trigger={
          <span className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-600 inline-flex items-center justify-center text-[11px] shadow-sm hover:border-slate-400 transition">
            ✎
          </span>
        }
      />
    </div>
  );
}

// Premium-style hero text — name + tagline (editable) + meta with location editable
function HeroText({
  trainerName,
  preview,
  s,
  isDark,
}: {
  trainerName: string;
  preview: PreviewData;
  s: typeof templates[TemplateName];
  isDark: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <h2 className={s.nameStyle + " m-0 truncate"}>{trainerName}</h2>
      <div className={`mt-0.5 ${s.tagStyle}`}>
        <EditableText
          field="tagline"
          initial={preview.tagline ?? ""}
          maxLength={200}
          placeholder="Dodaj tagline (jedno zdanie o sobie)"
        />
      </div>
      <div className={`mt-1.5 flex gap-3 flex-wrap items-center ${s.metaStyle}`}>
        {preview.rating !== null && (
          <span className={isDark ? "text-current" : ""}>★ {preview.rating} · {preview.reviewCount ?? 0}</span>
        )}
        <span className="inline-flex items-center gap-1">
          📍
          <EditableText
            field="location"
            initial={preview.location ?? ""}
            maxLength={100}
            placeholder="Miasto"
          />
        </span>
      </div>
    </div>
  );
}

// Section title — uses template's sectionTitleStyle (different per template).
// Falls back to accent color span if the template style doesn't already pin a color.
function SectionTitle({ sectionTitleStyle, children }: { sectionTitleStyle: string; children: React.ReactNode }) {
  return <h4 className={sectionTitleStyle + " m-0"}>{children}</h4>;
}

function AboutMock({ text, sectionTitleStyle, bodyText }: { text: string | null; sectionTitleStyle: string; bodyText: string }) {
  return (
    <div>
      <SectionTitle sectionTitleStyle={sectionTitleStyle}>O mnie</SectionTitle>
      <p className={bodyText + " m-0"}>
        <EditableText
          field="about"
          initial={text ?? ""}
          multiline
          maxLength={3000}
          placeholder="Opowiedz o sobie, swoim podejściu, doświadczeniu, klientach z którymi pracujesz…"
        />
      </p>
    </div>
  );
}

function ServicesMock({ services, sectionTitleStyle }: { services: PreviewData["services"]; accent: string; sectionTitleStyle: string }) {
  return (
    <div>
      <SectionTitle sectionTitleStyle={sectionTitleStyle}>Usługi</SectionTitle>
      <InlineServicesEditor services={services} />
    </div>
  );
}

function PackagesMock({ packages, sectionTitleStyle }: { packages: PreviewData["packages"]; accent: string; sectionTitleStyle: string }) {
  return (
    <div>
      <SectionTitle sectionTitleStyle={sectionTitleStyle}>Pakiety</SectionTitle>
      <InlinePackagesEditor packages={packages} />
    </div>
  );
}

function PlaceholderMock({ title, hint, sectionTitleStyle }: { title: string; hint: string; sectionTitleStyle: string }) {
  return (
    <div>
      <SectionTitle sectionTitleStyle={sectionTitleStyle}>{title}</SectionTitle>
      <p className="text-[12px] text-slate-400 italic m-0">{hint} <span className="text-slate-300">(wkrótce edycja)</span></p>
    </div>
  );
}
