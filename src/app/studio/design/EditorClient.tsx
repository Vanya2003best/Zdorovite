"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { ProfileCustomization, SectionId, TemplateName } from "@/types";
import { ENABLE_PAGES } from "@/lib/feature-flags";
import { updateDesign } from "./actions";
import { togglePublished } from "@/app/trainers/[id]/edit-actions";
import type { DayRule } from "@/app/studio/availability/page";
import StudioNavMenu from "../StudioNavMenu";
import NotificationsBell from "@/components/NotificationsBell";
import AccountMenu from "@/components/AccountMenu";
import type { Notification } from "@/lib/db/notifications";
import { undoCustomization, redoCustomization, resetCinematicCopy } from "@/app/trainers/[id]/cinematic-copy-actions";
import { EditingPageContext } from "@/app/trainers/[id]/EditingPageContext";
import { pinScrollFor } from "@/app/trainers/[id]/keep-scroll";
import { templates } from "@/data/templates";
import PageRowActions from "@/app/studio/pages/PageRowActions";
import { createTrainerPage } from "@/app/studio/pages/actions";

type Props = {
  slug: string;
  trainerId: string;
  trainerName: string;
  trainerEmail: string | null;
  avatarUrl: string | null;
  avatarFocal: string | null;
  published: boolean;
  initial: ProfileCustomization;
  completion: { pct: number; tip: string };
  counts: Partial<Record<SectionId, number>>;
  availabilityByDow: Record<number, DayRule | null>;
  notifications: { recent: Notification[]; unread: number };
  /** The actual client-facing profile rendered server-side with isEmbed=editMode=true.
   *  We re-fetch via router.refresh() after each debounced save so design changes
   *  reflect in the live preview. */
  previewSlot: ReactNode;
  /** Depth of customization._history — drives Cofnij button enabled state. */
  historyDepth: number;
  /** Depth of customization._redoStack — drives Powtórz button enabled state. */
  redoDepth: number;
  /** Whether trainer has any custom Cinematic copy at all — drives Reset button visibility. */
  hasCinematicCopy: boolean;
  /** When set, the editor scopes all customization mutations to that
   *  `trainer_pages` row (a secondary page) instead of trainers.customization
   *  (the primary page). Comes from `?page={id}` URL param. */
  pageId?: string;
  /** All pages owned by the trainer — rendered in the right-side "Moje strony"
   *  collapsible. Each entry links to `/studio/design?page={id}` (or no param
   *  for the primary page) so the trainer can swap which page they're editing
   *  without leaving the design surface. */
  pages: Array<{
    id: string;
    slug: string;
    title: string | null;
    template: TemplateName;
    isPrimary: boolean;
    status: "draft" | "published";
  }>;
};

type TemplateOption = { id: TemplateName; label: string; sub: string; thumb: string; bar: string };

const TEMPLATES: TemplateOption[] = [
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

const SECTION_LABELS: Record<SectionId, string> = {
  about: "O mnie",
  cases: "Kejsy",
  services: "Usługi",
  packages: "Pakiety",
  gallery: "Galeria",
  certifications: "Certyfikaty",
  reviews: "Opinie",
};


export default function EditorClient({ slug, trainerId, trainerName, trainerEmail, avatarUrl, avatarFocal, published, initial, completion, counts, availabilityByDow, notifications, previewSlot, historyDepth, redoDepth, hasCinematicCopy, pageId, pages }: Props) {
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateName>(initial.template);
  const [sections, setSections] = useState(initial.sections);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [savedAt, setSavedAt] = useState<number | null>(Date.now());
  const [savedAgo, setSavedAgo] = useState("teraz");
  const [pubPending, startPubTransition] = useTransition();
  const [fullscreen, setFullscreen] = useState(false);
  // Plain state instead of useTransition so we can end the "..." pending UI
  // as soon as the DB write returns — router.refresh's SSR keeps running in
  // the background but the trainer doesn't have to wait for it to click
  // Cofnij again. The ref guards against double-fire from re-entrant clicks.
  const [undoBusy, setUndoBusy] = useState(false);
  const undoBusyRef = useRef(false);
  // Same pattern for Powtórz (Redo). Separate state so the buttons disable
  // independently — undoing while a previous redo is mid-write is fine.
  const [redoBusy, setRedoBusy] = useState(false);
  const redoBusyRef = useRef(false);
  const [resetPending, startResetTransition] = useTransition();

  // Refs declared up-front because the page-id render-time sync below relies on
  // skipFirst to suppress a spurious auto-save when state is re-initialised
  // from new props.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  // Render-time sync: when the user navigates between pages we used to remount
  // the whole editor via key={pageId} (which resets useState reliably but is
  // SLOW — it tears down the entire sidebar/header/preview-wrapper React tree
  // and rebuilds it from scratch). Instead we keep the component mounted and
  // re-init the page-scoped state (template/sections) here when pageId flips.
  // skipFirst.current = true is set so the auto-save useEffect below doesn't
  // fire from this prop sync — that bug is what required `key` originally.
  const lastPageIdRef = useRef(pageId);
  if (lastPageIdRef.current !== pageId) {
    lastPageIdRef.current = pageId;
    setTemplate(initial.template);
    setSections(initial.sections);
    setSavedAt(Date.now());
    skipFirst.current = true;
  }

  // Same render-time pattern for the `initial` prop itself: when an undo /
  // reset / external mutation flips the server-rendered template+sections to
  // values different from our local state, re-init from props. The auto-save
  // useEffect would otherwise immediately re-save the stale local state and
  // overwrite the undo. Stable JSON-stringify key avoids re-syncing on every
  // render — only when content actually changes. skipFirst suppresses the
  // post-sync auto-save re-fire.
  const initialKey = `${initial.template}|${initial.sections.map((s) => `${s.id}:${s.visible ? 1 : 0}`).join(",")}`;
  const lastInitialKey = useRef(initialKey);
  if (lastInitialKey.current !== initialKey) {
    lastInitialKey.current = initialKey;
    setTemplate(initial.template);
    setSections(initial.sections);
    setSavedAt(Date.now());
    skipFirst.current = true;
  }

  // Page-switch transition. SSR (services/packages/gallery counts, full preview
  // re-render) takes 300–800ms in dev per page switch. Wrapping router.push in
  // a transition gives us isPending → we dim the preview + show a spinner on
  // the clicked row immediately so the click feels acknowledged. The actual
  // nav happens in the background; the new SSR streams in when ready.
  const [navPending, startNavTransition] = useTransition();
  const [navTargetId, setNavTargetId] = useState<string | null>(null);

  // Same trick for template switching: SSR of the entire previewSlot
  // (Premium → Cinematic → Luxury, etc.) takes the same 300–800ms. Without
  // a transition the trainer clicks the new template card and sees the OLD
  // preview unchanged for half a second, which feels broken. Wrapping
  // setTemplate + router.refresh in a transition gives us a pending flag
  // for the dim+spinner overlay.
  const [templatePending, startTemplateTransition] = useTransition();

  const onPickTemplate = (name: TemplateName) => {
    if (templatePending || name === template) return;
    startTemplateTransition(async () => {
      setTemplate(name);
      // Persist BEFORE router.refresh. Otherwise we race the 200ms autosave
      // debounce: a fast dev SSR returns with the OLD initial.template, and
      // the render-time sync block at the top of this component then resets
      // local state to old — making the click appear to silently revert.
      // Awaiting the write guarantees the SSR sees the new template.
      await updateDesign(
        { template: name, accentColor: initial.accentColor, sections },
        pageId,
      );
      // setTemplate above triggered the autosave useEffect which scheduled a
      // 200ms debounced write of the same value. Cancel it — we just saved
      // explicitly, no need for a duplicate request.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  const onPickPage = (target: { id: string; isPrimary: boolean }) => {
    if (navPending) return;
    const isCurrent = target.isPrimary ? !pageId : pageId === target.id;
    if (isCurrent) return;
    setNavTargetId(target.id);
    startNavTransition(() => {
      router.push(target.isPrimary ? "/studio/design" : `/studio/design?page=${target.id}`);
    });
  };

  // Prefetch every page route on mount. Next caches the rendered RSC payloads
  // so subsequent clicks resolve from memory instead of triggering a fresh
  // SSR + DB round trip — turns the second visit to a page from ~500ms to
  // near-instant. We re-run when the page list itself changes (add/delete).
  useEffect(() => {
    for (const p of pages) {
      router.prefetch(p.isPrimary ? "/studio/design" : `/studio/design?page=${p.id}`);
    }
  }, [pages, router]);

  // Create-page mode — turns the "Szablon wizualny" section into a wizard:
  // header changes to "Wybierz szablon dla nowej strony", slug input shows up,
  // and clicking a template card creates a new trainer_pages row + redirects.
  // This replaces the old `/studio/pages/new` full-page flow with an inline one.
  const [createMode, setCreateMode] = useState(false);
  const [newSlug, setNewSlug] = useState(`strona-${pages.length + 1}`);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const startCreate = () => {
    setCreateMode(true);
    setNewSlug(`strona-${pages.length + 1}`);
    setCreateError(null);
  };
  const cancelCreate = () => {
    setCreateMode(false);
    setCreateError(null);
  };

  const onPickTemplateForCreate = async (tplId: TemplateName) => {
    if (creating) return;
    const slug = newSlug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) {
      setCreateError("Slug: 1–40 znaków, małe litery, cyfry, myślnik. Bez spacji.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    const fd = new FormData();
    fd.append("slug", slug);
    fd.append("template", tplId);
    fd.append("seed", "scratch");
    const res = await createTrainerPage(fd);
    setCreating(false);
    if ("error" in res) {
      setCreateError(res.error);
      return;
    }
    // Hop the editor to the new page. Full nav (not router.push) so the
    // server component re-runs and `pages` prop reflects the new row.
    window.location.assign(`/studio/design?page=${res.id}`);
  };

  const onUndo = async () => {
    // Two-phase pending so the button frees up as soon as the snapshot has
    // been popped from the DB — no need to keep "..." spinning through the
    // ~500ms canvas SSR. The trainer can click Cofnij again immediately to
    // walk further back; refreshes for queued clicks coalesce naturally
    // because router.refresh() is idempotent and Next debounces.
    if (undoBusyRef.current) return; // serialize against in-flight DB write
    undoBusyRef.current = true;
    setUndoBusy(true);
    try {
      const res = await undoCustomization(pageId);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      pinScrollFor(2000);
      router.refresh();
    } finally {
      setUndoBusy(false);
      undoBusyRef.current = false;
    }
  };

  const onRedo = async () => {
    if (redoBusyRef.current) return;
    redoBusyRef.current = true;
    setRedoBusy(true);
    try {
      const res = await redoCustomization(pageId);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      pinScrollFor(2000);
      router.refresh();
    } finally {
      setRedoBusy(false);
      redoBusyRef.current = false;
    }
  };

  const onReset = () => {
    if (!confirm("Cofnij wszystkie zmiany w tekstach Cinematic? Możesz to jeszcze cofnąć przez Cofnij.")) return;
    startResetTransition(async () => {
      const res = await resetCinematicCopy(pageId);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      pinScrollFor(2000);
      router.refresh();
    });
  };

  // Reset html { zoom: 1.1 } (set in globals.css for >=1500px viewports) for
  // the duration of the editor. The editor uses h-[calc(100vh-32px)] which
  // doesn't compose with zoom: 100vh CSS = 1080 renders at 1188 physical,
  // leaking ~108 physical px of body bg-slate-50 below the editor as page
  // scroll. Resetting zoom on the editor route is OK — wide-monitor zoom is a
  // public-page polish thing, the studio chrome doesn't benefit from it.
  // (overflow:hidden / overflow:clip on html+body do NOT prevent the scroll
  // under zoom; only resetting zoom does.)
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.zoom;
    html.style.zoom = "1";
    return () => { html.style.zoom = prev; };
  }, []);

  // Mirror the fullscreen flag onto <html> so the global CSS in globals.css can
  // hide the StudioLayout chrome (sidebar + mobile tabs) and zero out the
  // lg:ml-[280px] offset. We set BOTH a class and a data-attribute as a
  // redundancy — different CSS engines and Tailwind layer orderings have bitten
  // us before, and either selector working is enough. Cleanup on unmount restores
  // chrome — critical when the trainer navigates away while still in fullscreen.
  useEffect(() => {
    const html = document.documentElement;
    if (fullscreen) {
      html.classList.add("studio-fullscreen");
      html.setAttribute("data-studio-fullscreen", "1");
    } else {
      html.classList.remove("studio-fullscreen");
      html.removeAttribute("data-studio-fullscreen");
    }
    return () => {
      html.classList.remove("studio-fullscreen");
      html.removeAttribute("data-studio-fullscreen");
    };
  }, [fullscreen]);

  // Esc exits fullscreen — but only when the user isn't actively editing a field.
  // InlineEditable also listens for Esc to revert + blur the cell; if we always
  // exited fullscreen we'd kick the trainer out mid-edit, which would feel buggy.
  // Skip if focus is on a contenteditable element or a regular form input.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.isContentEditable) return;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  /** Wraps the preview canvas card. We use it to imperatively reorder + hide
   *  [data-section-id] elements as the user drags/toggles in the settings panel —
   *  bypassing the slow router.refresh() roundtrip so the canvas updates instantly.
   *  The server save still fires (debounced) for persistence. */
  const previewWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      await updateDesign({ template, accentColor: initial.accentColor, sections }, pageId);
      setSavedAt(Date.now());
      // router.refresh() not called here for sections-only changes — we already
      // applied them imperatively in the effect below. We DO refresh for template
      // changes since the whole preview component swaps out.
    }, 200);
    // On dep-change cleanup (e.g. user switches pages within the 200ms debounce
    // window), flush the pending save FIRST with the current closure's
    // template/sections/pageId so a quick reorder isn't lost. Without this
    // flush, the clearTimeout below cancels the in-flight save and the
    // trainer's reorder vanishes when they hop to a different page.
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        void updateDesign({ template, accentColor: initial.accentColor, sections }, pageId);
      }
    };
  }, [template, sections, initial.accentColor, pageId]);

  // Template change → router.refresh() is now driven from the click
  // handler `onPickTemplate` (wrapped in startTemplateTransition so we get
  // a pending flag for the loading overlay). This separate effect is no
  // longer needed; keeping it would double-refresh on every pick.

  // Imperative section reorder + visibility — runs every time `sections` changes
  // OR when previewSlot is replaced (e.g. after router.refresh on template change).
  // Looks up [data-section-id="<id>"] inside the preview wrapper, groups by parent
  // (templates have different layouts; some sections are direct siblings, some
  // sit in different containers), and re-appends them in the desired order.
  // Hidden sections get `display: none` instead of being removed.
  useEffect(() => {
    const wrapper = previewWrapperRef.current;
    if (!wrapper) return;
    const all = wrapper.querySelectorAll<HTMLElement>("[data-section-id]");
    if (all.length === 0) return;
    // Group by parent — some templates put sections in different containers.
    const byParent = new Map<HTMLElement, HTMLElement[]>();
    all.forEach((el) => {
      const p = el.parentElement as HTMLElement | null;
      if (!p) return;
      const list = byParent.get(p) ?? [];
      list.push(el);
      byParent.set(p, list);
    });
    // Build order map: section id → index
    const order = new Map<string, number>(sections.map((s, i) => [s.id as string, i]));
    const visibleMap = new Map<string, boolean>(sections.map((s) => [s.id as string, s.visible]));
    byParent.forEach((els, parent) => {
      // Sort within this parent only
      const sorted = [...els].sort((a, b) => {
        const ai = order.get(a.dataset.sectionId ?? "") ?? 999;
        const bi = order.get(b.dataset.sectionId ?? "") ?? 999;
        return ai - bi;
      });
      // Apply visibility
      sorted.forEach((el) => {
        const visible = visibleMap.get(el.dataset.sectionId ?? "") ?? true;
        el.style.display = visible ? "" : "none";
      });
      // Skip the DOM rewrite entirely if the existing tagged sequence already
      // matches `sorted`. Calling insertBefore on every section every time
      // previewSlot changes (i.e. after every router.refresh from an inline
      // edit) resets Chrome's scroll-anchor tracking and snaps the canvas
      // back to the top. The vast majority of refreshes don't change section
      // order; bailing early in that case keeps the canvas pinned.
      const sameOrder =
        els.length === sorted.length &&
        els.every((el, i) => el === sorted[i]);
      if (sameOrder) return;
      // Anchor = the first sibling AFTER all currently-tagged sections in the
      // parent's child list. We insertBefore(anchor) so the reordered tagged
      // block stays positioned BETWEEN its surrounding non-tagged siblings
      // (e.g. a hero above + a contact/footer section below). Using
      // appendChild here would push the entire tagged block past those
      // siblings to the end of the parent — that's the bug Luxury was hitting:
      // the unmarked "Porozmawiajmy" contact section ended up ABOVE the
      // tagged sections after every reorder.
      const childrenArr = Array.from(parent.children);
      let anchor: Element | null = null;
      for (let i = childrenArr.length - 1; i >= 0; i--) {
        if (els.includes(childrenArr[i] as HTMLElement)) {
          anchor = childrenArr[i + 1] ?? null;
          break;
        }
      }
      sorted.forEach((el) => parent.insertBefore(el, anchor));
    });
  }, [sections, previewSlot]);

  // Scroll-to-hash. Sidebar deep-links from /studio/nav-items send
  // /studio/design#services and #packages — when those land we find the
  // matching [data-section-id="services"] inside the preview and scroll
  // it into view inside the canvas scroller (NOT window — the canvas is
  // its own overflow-y-auto container). Re-runs on previewSlot change so
  // a hash-link from a fresh tab waits until SSR is done painting.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    // Same set of section ids the SECTION_LABELS uses — map "services"
    // and "packages" + the rest defensively in case future sidebar links
    // add more.
    const known = ["about", "cases", "services", "packages", "gallery", "certifications", "reviews"];
    if (!known.includes(hash)) return;
    // rAF queue so we wait for the latest layout pass — previewSlot may
    // have just remounted as part of this same render.
    const raf = requestAnimationFrame(() => {
      const wrapper = previewWrapperRef.current;
      if (!wrapper) return;
      const target = wrapper.querySelector<HTMLElement>(`[data-section-id="${hash}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [previewSlot]);

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

  // Section drag-and-drop. The previous implementation reordered state on every
  // dragOver event, which caused HTML5 D&D's hit-testing to fall apart: by the
  // time the user moved 2 slots, the DOM had already shifted and subsequent
  // dragOver fired on the wrong index. New approach: track hover, reorder once
  // on drop. dragOverIndex drives the visual indicator (highlight on hover slot).
  const dragIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const onDragStart = (i: number) => (e: React.DragEvent) => {
    dragIndex.current = i;
    setDragging(i);
    // Required by Firefox to start a drag at all.
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(i));
  };

  const onDragOver = (i: number) => (e: React.DragEvent) => {
    // preventDefault is required for the drop event to fire afterwards.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== i) setDragOverIdx(i);
  };

  const onDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) {
      setDragOverIdx(null);
      return;
    }
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragOverIdx(null);
  };

  const onDragEnd = () => {
    dragIndex.current = null;
    setDragging(null);
    setDragOverIdx(null);
  };

  const toggleSection = (id: SectionId) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };


  return (
    <div className="flex flex-col bg-slate-100 h-screen overflow-hidden">
      {/* ===== EDITOR TOP BAR — replaces the layout's StudioTopBar on /studio/design.
          Same h-14 chrome as everywhere else, but the right side carries
          editor-specific actions (viewport toggle / Podgląd / Opublikuj)
          alongside the notification bell. The layout's TopBar is hidden
          on this route via StudioTopBarSlot. */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-5 z-30 gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="lg:hidden">
            <StudioNavMenu trainerSlug={slug} trainerName={trainerName} avatarUrl={avatarUrl} avatarFocal={avatarFocal} />
          </div>
          <strong className="text-[14px] sm:text-[15px] font-semibold tracking-[-0.01em] truncate">
            Mój profil
          </strong>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-slate-500 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Zapisano · {savedAgo}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          {/* Undo / Redo — icon-only chrome. Tooltip carries the count
              + Polish label so the affordance is still discoverable; the
              header stays compact and visually quiet. */}
          <button
            type="button"
            onClick={onUndo}
            disabled={undoBusy || historyDepth === 0}
            title={historyDepth === 0 ? "Brak zmian do cofnięcia" : `Cofnij ostatnią zmianę (${historyDepth} w historii)`}
            aria-label="Cofnij"
            className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-[10px] text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {undoBusy ? (
              <span className="text-[12px] font-medium leading-none">…</span>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h11a5 5 0 015 5v0a5 5 0 01-5 5h-4M3 10l4-4M3 10l4 4" /></svg>
            )}
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={redoBusy || redoDepth === 0}
            title={redoDepth === 0 ? "Brak zmian do powtórzenia" : `Powtórz cofniętą zmianę (${redoDepth} w stosie)`}
            aria-label="Powtórz"
            className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-[10px] text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {redoBusy ? (
              <span className="text-[12px] font-medium leading-none">…</span>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H10a5 5 0 00-5 5v0a5 5 0 005 5h4M21 10l-4-4M21 10l-4 4" /></svg>
            )}
          </button>
          {/* Reset Cinematic copy back to defaults. Only shown when there are overrides
              to clear; this avoids a confusing always-visible danger button. */}
          {hasCinematicCopy && (
            <button
              type="button"
              onClick={onReset}
              disabled={resetPending}
              title="Przywróć teksty Cinematic do domyślnych"
              className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[13px] font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-60"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
              {resetPending ? "..." : "Reset"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Wyjdź z pełnego widoku (Esc)" : "Pełny widok"}
            className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[13px] font-medium text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition"
          >
            {fullscreen ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3M3 16h3a2 2 0 012 2v3M21 8h-3a2 2 0 01-2-2V3M16 21v-3a2 2 0 012-2h3" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" /></svg>
            )}
            {fullscreen ? "Wyjdź" : "Pełny widok"}
          </button>
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
            onClick={() =>
              startPubTransition(async () => {
                const res = await togglePublished();
                if ("error" in res) alert(res.error);
              })
            }
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[10px] text-[13px] font-semibold transition disabled:opacity-60 bg-slate-900 text-white hover:bg-black"
          >
            {pubPending ? "..." : published ? "Cofnij publikację" : "Opublikuj"}
          </button>
          <NotificationsBell
            myId={trainerId}
            initialNotifications={notifications.recent}
            initialUnreadCount={notifications.unread}
            messagesLink="/studio/messages"
          />
          <AccountMenu
            displayName={trainerName}
            email={trainerEmail}
            avatarUrl={avatarUrl}
            avatarFocal={avatarFocal}
          />
        </div>
      </header>

      {/* ===== LAYOUT — preview LEFT, settings RIGHT (per user request).
           Fullscreen mode collapses the grid to one column and hides the settings
           aside via `hidden`; combined with the global CSS that hides StudioLayout
           sidebar and zeroes its margin, the preview spans the entire viewport. */}
      <div className={`grid grid-cols-1 ${fullscreen ? "" : "lg:grid-cols-[1fr_360px]"} flex-1 min-h-0 overflow-hidden`}>

        {/* The settings aside is below in DOM order; CSS grid + lg:order
            classes flip them visually so preview renders LEFT on lg+. */}

        {/* ===== SETTINGS PANEL (visually on the right via lg:order-2) =====
             [contain:strict] is load-bearing: with only overflow-y-auto, Chrome
             leaks the panel's tall inner content (~2200px of templates/colors/
             sections/hours) into documentElement.scrollHeight, which adds
             page-level browser scroll and reveals bg-slate-50 below the editor.
             overflow-x-hidden alone does NOT fix the leak; contain:strict does. */}
        <aside className={`scrollbar-hide bg-white lg:border-l lg:border-slate-200 border-b lg:border-b-0 border-slate-200 overflow-y-auto [contain:strict] lg:order-2 min-h-0 ${fullscreen ? "hidden" : ""}`}>
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


          {/* Moje strony — list of trainer pages. Multi-page profiles are
              feature-flagged OFF in V1 (see lib/feature-flags.ts) — when
              ENABLE_PAGES is false the entire CollapsibleSection is skipped,
              the page-switching plumbing in this component still works for
              the primary page (which is the only page that exists then). */}
          {ENABLE_PAGES && (
          <CollapsibleSection
            title="Moje strony"
            storageKey="strony"
            description="Każda strona to oddzielna prezentacja Ciebie — z własnym szablonem i URL."
          >
            <ul className="grid gap-2">
              {pages.map((p) => {
                const tpl = templates[p.template];
                const isCurrent = pageId ? p.id === pageId : p.isPrimary;
                const isLoading = navPending && navTargetId === p.id;
                const onPick = () => onPickPage({ id: p.id, isPrimary: p.isPrimary });
                return (
                  <li
                    key={p.id}
                    className={`rounded-[10px] border bg-white p-2.5 transition ${
                      isCurrent
                        ? "border-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
                        : isLoading
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={onPick}
                        className={`w-9 h-9 rounded-md ${tpl?.coverBg ?? "bg-slate-100"} shrink-0 border border-slate-200 cursor-pointer relative`}
                        aria-label={`Edytuj ${p.title || p.slug}`}
                      >
                        {isLoading && (
                          <span className="absolute inset-0 inline-flex items-center justify-center bg-white/70 rounded-md">
                            <Spinner />
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onPick}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-[12.5px] tracking-tight text-slate-900 truncate">
                            {p.title || p.slug}
                          </strong>
                          {p.isPrimary && (
                            <span className="text-[9px] font-semibold tracking-[0.08em] uppercase bg-emerald-100 text-emerald-800 px-1.5 py-px rounded">
                              Główna
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-semibold tracking-[0.08em] uppercase px-1.5 py-px rounded ${
                              p.status === "published"
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {p.status === "published" ? "Live" : "Szkic"}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 mt-0.5 truncate">
                          {tpl?.label ?? p.template}
                        </div>
                      </button>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={onPick}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium transition ${
                          isCurrent ? "text-emerald-700" : isLoading ? "text-emerald-700" : "text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        {isCurrent ? "Edytujesz teraz" : isLoading ? "Otwieram..." : "Edytuj →"}
                      </button>
                      <PageRowActions
                        pageId={p.id}
                        isPrimary={p.isPrimary}
                        isPublished={p.status === "published"}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={startCreate}
              disabled={createMode}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-[10px] border border-dashed border-emerald-300 bg-emerald-50/50 text-[12px] font-medium text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 transition disabled:opacity-50 disabled:cursor-default"
            >
              <span className="text-base leading-none">+</span> Nowa strona
            </button>
            {createMode && (
              <p className="mt-2 text-[11px] text-emerald-700">
                ↓ Wybierz szablon dla nowej strony poniżej.
              </p>
            )}
          </CollapsibleSection>
          )}

          {/* Templates — doubles as the create-page picker. When `createMode` is
              on, the section header changes, a slug input + Cancel appear, and
              clicking a template card creates a new trainer_pages row instead
              of mutating the current page's template. */}
          <CollapsibleSection
            title={createMode ? "Wybierz szablon dla nowej strony" : "Szablon wizualny"}
            storageKey="szablon"
            open={createMode ? true : undefined}
          >
            {createMode && (
              <div className="grid gap-2 mb-4 p-3 rounded-[10px] bg-emerald-50/60 border border-emerald-200">
                <label className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-700">
                  Adres URL nowej strony
                </label>
                <div className="flex items-center gap-1.5">
                  <code className="bg-white px-1.5 py-1.5 rounded text-[10.5px] text-slate-500 shrink-0 border border-slate-200 font-mono">
                    /{slug}/
                  </code>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => { setNewSlug(e.target.value); setCreateError(null); }}
                    pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
                    placeholder="b2b"
                    maxLength={40}
                    className="flex-1 min-w-0 text-[12px] font-mono border border-slate-200 bg-white rounded-md px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                {createError && (
                  <p className="text-[11px] text-rose-700">{createError}</p>
                )}
                <p className="text-[10.5px] text-slate-600">
                  Małe litery, cyfry, myślnik. Klik w szablon → strona zostanie utworzona i otwarta tutaj.
                </p>
                <button
                  type="button"
                  onClick={cancelCreate}
                  disabled={creating}
                  className="self-start text-[11px] font-medium text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline disabled:opacity-60"
                >
                  Anuluj tworzenie
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <TemplateCard
                  key={t.id}
                  option={t}
                  active={!createMode && template === t.id}
                  onPick={createMode ? onPickTemplateForCreate : onPickTemplate}
                  disabled={creating}
                />
              ))}
            </div>

            {/* PRO sub-tier — same section, sub-header with Pro badge */}
            <div className="mt-5 flex items-center justify-between gap-2">
              <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Plan Pro</h4>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                ✦ Pro
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Zaawansowane szablony z unikalnym layoutem.</p>
            <div className="grid grid-cols-2 gap-2">
              {PRO_TEMPLATES.map((t) => (
                <TemplateCard
                  key={t.id}
                  option={t}
                  active={!createMode && template === t.id}
                  onPick={createMode ? onPickTemplateForCreate : onPickTemplate}
                  pro
                  disabled={creating}
                />
              ))}
            </div>
          </CollapsibleSection>

          {/* Section order — collapsible */}
          <CollapsibleSection title="Kolejność sekcji" storageKey="sekcji">
            <ul className="grid gap-1.5">
              {sections.map((s, i) => {
                // Cozy + Premium templates aren't a portfolio voice — Cozy is
                // warm/personal, Premium is clean/lifestyle — so case studies
                // don't fit either. Hide the toggle; existing data is left
                // alone in studioCopy.cases for trainers who switch to a
                // portfolio template (Studio / Cinematic / Luxury / Signature).
                if ((template === "cozy" || template === "premium") && s.id === "cases") return null;
                const count = counts[s.id];
                return (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={onDragStart(i)}
                    onDragOver={onDragOver(i)}
                    onDrop={onDrop(i)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border bg-slate-50 cursor-grab active:cursor-grabbing transition ${
                      dragging === i
                        ? "opacity-50 border-dashed border-emerald-400 bg-white shadow-[0_6px_18px_rgba(16,185,129,0.2)]"
                        : dragOverIdx === i && dragging !== null
                          ? "border-emerald-500 bg-emerald-50 shadow-[0_0_0_2px_rgba(16,185,129,0.3)]"
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
          </CollapsibleSection>

        </aside>

        {/* ===== PREVIEW CANVAS — visually LEFT (lg:order-1).
             In fullscreen we drop the dotted bg, padding, rounded card frame and
             max-width so the embedded profile renders edge-to-edge — same DOM, same
             editing affordances, just without the studio chrome around it. */}
        <section
          className="relative lg:order-1 min-h-0"
          style={
            fullscreen
              ? {}
              : (() => {
                  // Per-template canvas bg so the dotted editor backdrop doesn't
                  // peek out at the bottom when the preview's content ends. Match
                  // each template's primary bg colour; the dot pattern uses a
                  // slightly darker shade so it stays subtle but visible.
                  const tplBg: Record<string, { bg: string; dot: string }> = {
                    cinematic: { bg: "#0a0a0c", dot: "#1f1f23" },
                    signature: { bg: "#f6f1ea", dot: "#e4dccf" },
                    luxury:    { bg: "#f6f1e8", dot: "#d9cfb8" },
                  };
                  const palette = tplBg[template] ?? { bg: "#f8fafc", dot: "#e2e8f0" };
                  return {
                    backgroundColor: palette.bg,
                    backgroundImage: `radial-gradient(circle at 15px 15px, ${palette.dot} 1px, transparent 1px)`,
                    backgroundSize: "24px 24px",
                  };
                })()
          }
        >
          {/* Scroll happens in this inner container — NOT the outer <section> —
              so the absolute-positioned loading overlays below stay anchored to
              the section's visible viewport instead of being centered in the
              full scroll-content height (which puts the spinner off-screen
              when the trainer has scrolled down).
              data-canvas-scroller marks this element so pinScrollFor in
              keep-scroll.ts can find it directly instead of walking up the
              DOM from a [data-section-id] (the walk-up still works but this
              is faster and immune to template structures that wrap sections
              in extra scroll-capable containers). */}
          <div className="absolute inset-0 overflow-y-auto" data-canvas-scroller>
            <div className={fullscreen ? "" : "px-4 sm:px-7 pt-6 pb-10"}>
              <div
                className={
                  fullscreen
                    ? ""
                    // bg-transparent here — every template paints its OWN root bg
                    // (cinematic dark, signature cream, luxury ivory, etc.) so
                    // putting a hardcoded bg-white on the wrapper card causes a
                    // visible mismatch when the preview is shorter than the
                    // wrapper. Letting the template's bg flow through avoids it.
                    : "mx-auto bg-transparent rounded-[20px] overflow-hidden shadow-[0_32px_64px_-32px_rgba(2,6,23,0.2),0_0_0_1px_#e2e8f0] transition-[max-width] duration-300"
                }
                style={fullscreen ? {} : { maxWidth: viewport === "desktop" ? 1200 : 390 }}
                ref={previewWrapperRef}
              >
                {/* While templatePending, hide the preview entirely. Without
                    this, Next's RSC stream commits the new template's sections
                    in chunks while the old template's hero is still mounted,
                    producing a stacked Signature-on-top + Cinematic-below view
                    during the half-second SSR. min-h keeps the wrapper from
                    collapsing so the overlay still has a tall canvas to dim. */}
                <div
                  className={templatePending ? "invisible" : ""}
                  style={templatePending ? { minHeight: "80vh" } : undefined}
                >
                  <EditingPageContext.Provider value={{ pageId }}>{previewSlot}</EditingPageContext.Provider>
                </div>
              </div>
            </div>
          </div>
          {/* Page-switch loading overlay. Renders only while the navigation
              transition is in flight; gives a visible "we heard your click"
              signal so the dev-build SSR delay doesn't feel like a freeze.
              Sits at section level (NOT inside the scroll container) so the
              spinner stays centered on the visible canvas regardless of how
              far the trainer has scrolled inside the preview. */}
          {navPending && (
            <div className="absolute inset-0 z-20 bg-white/55 backdrop-blur-[2px] flex items-center justify-center pointer-events-none transition">
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white shadow-[0_10px_30px_rgba(2,6,23,0.15)] border border-slate-200">
                <Spinner />
                <span className="text-[12.5px] font-medium text-slate-700">Otwieram stronę...</span>
              </div>
            </div>
          )}
          {/* Same overlay for template switching — preview re-renders the
              entire Profile component server-side which takes ~500ms in
              dev. Without this the trainer clicks a new template and the
              old preview just sits there silently. */}
          {templatePending && (
            <div className="absolute inset-0 z-20 bg-white/55 backdrop-blur-[2px] flex items-center justify-center pointer-events-none transition">
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white shadow-[0_10px_30px_rgba(2,6,23,0.15)] border border-slate-200">
                <Spinner />
                <span className="text-[12.5px] font-medium text-slate-700">Wczytuję szablon...</span>
              </div>
            </div>
          )}
        </section>
      </div>

    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin text-emerald-600" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" strokeDashoffset="0" opacity="0.3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function TemplateCard({
  option,
  active,
  onPick,
  pro = false,
  disabled = false,
}: {
  option: TemplateOption;
  active: boolean;
  onPick: (id: TemplateName) => void;
  pro?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(option.id)}
      disabled={disabled}
      className={`text-left rounded-[10px] border bg-white p-2.5 relative transition disabled:opacity-50 disabled:cursor-wait ${
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

/**
 * Collapsible section in the settings aside. Click the header row to toggle.
 * State persists in localStorage so each trainer's preferences (e.g. always-
 * collapsed Plan Pro because they're on free) survive reloads.
 *
 * defaultOpen=true so first-time visitors see all sections expanded; collapse
 * is opt-in.
 */
function CollapsibleSection({
  title,
  storageKey,
  badge,
  description,
  defaultOpen = true,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  title: string;
  storageKey: string;
  badge?: ReactNode;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** When provided, the section is fully controlled — the parent owns open state.
   *  Used by the create-page flow to force-open Szablon while the wizard is active. */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const lsKey = `nz-aside-${storageKey}`;
  // SSR-safe init: state starts at `defaultOpen` so server + first client render
  // agree (no hydration mismatch). The persisted localStorage value is applied
  // in a useEffect right after mount, which causes a quick re-render but avoids
  // the React "Hydration failed" error from reading localStorage during render.
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const v = window.localStorage.getItem(lsKey);
    if (v !== null) setInternalOpen(v === "1");
  }, [lsKey]);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };
  useEffect(() => {
    if (isControlled || !hydrated.current) return;
    window.localStorage.setItem(lsKey, internalOpen ? "1" : "0");
  }, [lsKey, internalOpen, isControlled]);

  return (
    <div className="border-b border-slate-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50 transition group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500 group-hover:text-slate-700 transition truncate">
            {title}
          </h3>
          {badge}
        </div>
        <svg
          className={`text-slate-400 group-hover:text-slate-600 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5">
          {description && (
            <p className="text-[11px] text-slate-500 -mt-1 mb-3">{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

