"use server";

import { createClient } from "@/lib/supabase/server";
import type { CinematicCopy, AboutChapter, CinematicTestimonial, ProfileCustomization } from "@/types";
import { sanitizeRichHTML } from "./sanitize-rich";
import { loadCustomization, saveCustomization, saveDirect } from "@/lib/db/page-customization";

/** Every text field in CinematicCopy goes through sanitizeRichHTML on save.
 *  Plain text without tags is unchanged by the sanitiser, but allowing rich
 *  on every field gives the trainer the selection toolbar everywhere — so
 *  e.g. they can highlight a single word in "Czas odpowiedzi" if they want.
 *  Defense-in-depth: client also sanitises before sending. */
const RICH_FIELDS: ReadonlySet<string> = new Set([
  "aboutH2Line1", "aboutH2Line2",
  "servicesH2", "packagesH2", "packagesSubcopy",
  "galleryH2", "reviewsH2", "certificationsH2",
  "finaleH2Line1", "finaleH2Line2", "finaleSubcopy",
  "finaleCtaPrimary", "finaleCtaSecondary",
  "fullbleedQuote", "fullbleedMetaTop", "fullbleedMetaBottom",
  "statStaz", "statKlienci", "statOpinii", "statResponse",
  "casesH2",
  "videoIntroTitle", "videoIntroSubtitle",
]);

const FALLBACK_TITLES = ["01 / Zaczęło się", "02 / Metoda", "03 / Z kim pracuję"];
const FALLBACK_HEADS = ["Skąd przyszłaś.", "Jak pracujesz.", "Z kim."];

/**
 * Return a real `aboutChapters` array — either the trainer's saved one, or a
 * fresh array materialised from the synthesized read-mode fallback (split of
 * trainer.about + hardcoded Polish titles). Always returns the same shape so
 * mutation actions can append/remove/update without first checking for the
 * "synthesized but not saved" edge case.
 */
function materializeChapters(
  customization: ProfileCustomization,
  aboutText: string,
): AboutChapter[] {
  const existing = customization.cinematicCopy?.aboutChapters;
  if (existing && existing.length > 0) return [...existing];

  const blocks = aboutText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);
  // Stable IDs so subsequent mutations target the same row even if the trainer
  // edits about in another tab — based on index since the materialization is
  // a one-shot conversion at first edit time.
  // ID matches `fb_{i}` produced by CinematicProfile's read-mode fallback,
  // so a chapter that was just visible in the UI keeps the same identity once
  // it gets persisted by the first edit/delete/add action.
  return blocks.map((body, i) => ({
    id: `fb_${i}`,
    title: FALLBACK_TITLES[i] ?? `0${i + 1} /`,
    head: FALLBACK_HEADS[i] ?? "—",
    body,
  }));
}

/** Single-string field updater. `field` is a key of CinematicCopy (excluding array-shaped collections). */
type CopyStringKey = Exclude<keyof CinematicCopy, "aboutChapters" | "testimonials">;

const ALLOWED_KEYS: ReadonlySet<string> = new Set<CopyStringKey>([
  "aboutLabel", "certificationsLabel", "servicesLabel",
  "packagesLabel", "galleryLabel", "reviewsLabel",
  "aboutH2Line1", "aboutH2Line2",
  "servicesH2", "packagesH2", "packagesSubcopy",
  "galleryH2", "reviewsH2", "certificationsH2",
  "finaleH2Line1", "finaleH2Line2", "finaleSubcopy",
  "finaleCtaPrimary", "finaleCtaSecondary",
  "fullbleedQuote", "fullbleedMetaTop", "fullbleedMetaBottom",
  "statStaz", "statKlienci", "statOpinii", "statResponse",
  "videoIntroTitle", "videoIntroSubtitle",
  "heroPhotoFocal",
  "casesLabel", "casesH2", "casesSub",
]);

export async function updateCinematicCopyField(
  field: string,
  value: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ALLOWED_KEYS.has(field)) return { error: "Nieznane pole" };

  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const cinematicCopy: CinematicCopy = { ...(ctx.customization.cinematicCopy ?? {}) };
  // Empty string clears override (revert to default fallback).
  const trimmed = value.trim();
  if (trimmed === "") {
    delete cinematicCopy[field as CopyStringKey];
  } else {
    // Rich fields run through HTML allowlist; plain fields are stored verbatim
    // (sanitizer is a no-op on text without tags anyway, but skipping the call
    // for plain fields keeps user-typed `<` characters intact).
    cinematicCopy[field as CopyStringKey] = RICH_FIELDS.has(field)
      ? sanitizeRichHTML(trimmed)
      : trimmed;
  }

  const next = { ...ctx.customization, cinematicCopy };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

/** Append a fresh chapter to aboutChapters. Returns ok+id so client can scroll/focus.
 *  Materialises the synthesized read-mode fallback first if the trainer has
 *  about-text but no saved chapters yet — otherwise the +Dodaj click would wipe
 *  the visible fallback paragraphs in favour of just the new placeholder. */
export async function addAboutChapter(pageId?: string): Promise<
  { ok: true; chapter: AboutChapter } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const existing = materializeChapters(ctx.customization, ctx.about);
  const idx = existing.length;
  const id = `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const chapter: AboutChapter = {
    id,
    title: `0${idx + 1} / Nowy rozdział`,
    head: "Tytuł rozdziału.",
    body: "Opowiedz tutaj coś o sobie...",
  };

  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      aboutChapters: [...existing, chapter],
    },
  };

  const res = await saveCustomization(ctx.userId, ctx.customization, next, pageId);
  if ("error" in res) return res;
  return { ok: true, chapter };
}

export async function removeAboutChapter(id: string, pageId?: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  // Materialise so deleting one of the fallback paragraphs preserves the others.
  const existing = materializeChapters(ctx.customization, ctx.about);
  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      aboutChapters: existing.filter((c) => c.id !== id),
    },
  };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

export async function updateAboutChapterField(
  id: string,
  field: "title" | "head" | "body",
  value: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  // Materialise so editing a fallback chapter for the first time saves all
  // siblings too (otherwise we'd be saving just the edited one and losing the rest).
  const existing = materializeChapters(ctx.customization, ctx.about);
  if (!existing.find((c) => c.id === id)) return { error: "Rozdział nie istnieje" };

  // All three chapter text fields (title/head/body) are rich — defense-in-depth
  // sanitisation against anything that didn't come from our toolbar.
  const sanitised = sanitizeRichHTML(value);

  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      aboutChapters: existing.map((c) =>
        c.id === id ? { ...c, [field]: sanitised } : c,
      ),
    },
  };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

/**
 * Pop the last snapshot off _history and apply it. The undone state itself is
 * NOT pushed back to history — that would create an infinite loop where every
 * undo also creates an undo entry. Net effect: history shortens by one each
 * undo, just like a normal stack pop.
 *
 * If the popped snapshot carries `_restoreOnUndo`, the deleted side-effect row
 * (service / package — entities that live outside customization JSONB) is
 * re-inserted BEFORE the snapshot is applied. Customization JSONB cases live
 * inside the snapshot itself so they restore via the normal apply.
 */
export async function undoCustomization(pageId?: string): Promise<
  { ok: true; remaining: number } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const history = ctx.customization._history ?? [];
  if (history.length === 0) return { error: "Nic do cofnięcia" };

  const lastSnapshotRaw = history[history.length - 1]!;
  const remainingHistory = history.slice(0, -1);

  // Strip _restoreOnUndo before applying the snapshot — it's metadata for
  // this function only, not part of the customization shape.
  const { _restoreOnUndo, ...lastSnapshot } = lastSnapshotRaw;
  // Snapshot the CURRENT state for the redo stack so Powtórz can re-apply
  // exactly what we're about to undo. The _redoAction carries the same
  // payload that drove undo — the redo dispatcher uses it to re-execute
  // the side effect (re-delete a service, re-update a field, etc.).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _history: _h, _redoStack: _rs, ...currentSnap } = ctx.customization;
  const redoStack = (ctx.customization._redoStack ?? []).slice(-19);
  const newRedoEntry = _restoreOnUndo
    ? { ...currentSnap, _redoAction: _restoreOnUndo }
    : { ...currentSnap };
  const restored: ProfileCustomization = {
    ...lastSnapshot,
    _history: remainingHistory,
    _redoStack: [...redoStack, newRedoEntry],
  };

  if (_restoreOnUndo) {
    const supabase = await createClient();
    switch (_restoreOnUndo.kind) {
      case "serviceDeleted": {
        const { error } = await supabase.from("services").insert(_restoreOnUndo.row);
        if (error) return { error: `Nie udało się przywrócić usługi: ${error.message}` };
        break;
      }
      case "serviceCreated": {
        // Reverse of "create" is delete. Cancel any bookings against it
        // first (same FK protection as removeService).
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("service_id", _restoreOnUndo.id);
        const { error } = await supabase
          .from("services")
          .delete()
          .eq("id", _restoreOnUndo.id)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się cofnąć dodania usługi: ${error.message}` };
        break;
      }
      case "serviceUpdated": {
        const { error } = await supabase
          .from("services")
          .update(_restoreOnUndo.before)
          .eq("id", _restoreOnUndo.id)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się cofnąć zmiany usługi: ${error.message}` };
        break;
      }
      case "packageDeleted": {
        const { error } = await supabase.from("packages").insert(_restoreOnUndo.row);
        if (error) return { error: `Nie udało się przywrócić pakietu: ${error.message}` };
        break;
      }
      case "packageCreated": {
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("package_id", _restoreOnUndo.id);
        const { error } = await supabase
          .from("packages")
          .delete()
          .eq("id", _restoreOnUndo.id)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się cofnąć dodania pakietu: ${error.message}` };
        break;
      }
      case "packageUpdated": {
        const { error } = await supabase
          .from("packages")
          .update(_restoreOnUndo.before)
          .eq("id", _restoreOnUndo.id)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się cofnąć zmiany pakietu: ${error.message}` };
        break;
      }
      case "trainerUpdated": {
        const { error } = await supabase
          .from("trainers")
          .update(_restoreOnUndo.before)
          .eq("id", ctx.userId);
        if (error) return { error: `Nie udało się cofnąć zmiany profilu: ${error.message}` };
        break;
      }
      case "specializationAdded": {
        // Reverse of "added" is delete.
        const { error } = await supabase
          .from("trainer_specializations")
          .delete()
          .eq("trainer_id", ctx.userId)
          .eq("specialization_id", _restoreOnUndo.specId);
        if (error) return { error: `Nie udało się cofnąć dodania specjalizacji: ${error.message}` };
        break;
      }
      case "specializationRemoved": {
        const { error } = await supabase
          .from("trainer_specializations")
          .insert({ trainer_id: ctx.userId, specialization_id: _restoreOnUndo.specId });
        // unique_violation = already re-added, treat as success.
        if (error && error.code !== "23505") {
          return { error: `Nie udało się przywrócić specjalizacji: ${error.message}` };
        }
        break;
      }
    }
  }

  const res = await saveDirect(ctx.userId, restored, pageId);
  if ("error" in res) return res;
  return { ok: true, remaining: remainingHistory.length };
}

/**
 * Pop the last entry off `_redoStack` and re-apply it. Mirror of
 * `undoCustomization`: a side-effect mutation gets re-executed via the
 * `_redoAction` payload, then the customization snapshot is applied. The
 * popped entry's snapshot is pushed back onto `_history` (with its
 * `_restoreOnUndo` set to the same action) so Cofnij can immediately walk
 * the trainer back again.
 */
export async function redoCustomization(pageId?: string): Promise<
  { ok: true; remaining: number } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const redoStack = ctx.customization._redoStack ?? [];
  if (redoStack.length === 0) return { error: "Nic do powtórzenia" };

  const lastRedoRaw = redoStack[redoStack.length - 1]!;
  const remainingRedo = redoStack.slice(0, -1);
  const { _redoAction, ...lastRedo } = lastRedoRaw;

  // The "current state" before redo becomes a new history entry — so Cofnij
  // can walk back. We attach the same _restoreOnUndo as the action being
  // redone so the next undo knows how to revert it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _history: _h, _redoStack: _rs, ...currentSnap } = ctx.customization;
  const history = (ctx.customization._history ?? []).slice(-19);
  const newHistoryEntry = _redoAction
    ? { ...currentSnap, _restoreOnUndo: _redoAction }
    : { ...currentSnap };

  const restored: ProfileCustomization = {
    ...lastRedo,
    _history: [...history, newHistoryEntry],
    _redoStack: remainingRedo,
  };

  if (_redoAction) {
    const supabase = await createClient();
    switch (_redoAction.kind) {
      // Inverse direction of every undo case below.
      case "serviceDeleted": {
        // Original mutation was DELETE → redo means delete again.
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("service_id", _redoAction.row.id as string);
        const { error } = await supabase
          .from("services")
          .delete()
          .eq("id", _redoAction.row.id as string)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się powtórzyć usunięcia usługi: ${error.message}` };
        break;
      }
      case "serviceCreated": {
        // Original was CREATE → redo means insert again.
        const { error } = await supabase.from("services").insert(_redoAction.row);
        if (error) return { error: `Nie udało się powtórzyć dodania usługi: ${error.message}` };
        break;
      }
      case "serviceUpdated": {
        const { error } = await supabase
          .from("services")
          .update(_redoAction.after)
          .eq("id", _redoAction.id)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się powtórzyć zmiany usługi: ${error.message}` };
        break;
      }
      case "packageDeleted": {
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("package_id", _redoAction.row.id as string);
        const { error } = await supabase
          .from("packages")
          .delete()
          .eq("id", _redoAction.row.id as string)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się powtórzyć usunięcia pakietu: ${error.message}` };
        break;
      }
      case "packageCreated": {
        const { error } = await supabase.from("packages").insert(_redoAction.row);
        if (error) return { error: `Nie udało się powtórzyć dodania pakietu: ${error.message}` };
        break;
      }
      case "packageUpdated": {
        const { error } = await supabase
          .from("packages")
          .update(_redoAction.after)
          .eq("id", _redoAction.id)
          .eq("trainer_id", ctx.userId);
        if (error) return { error: `Nie udało się powtórzyć zmiany pakietu: ${error.message}` };
        break;
      }
      case "trainerUpdated": {
        const { error } = await supabase
          .from("trainers")
          .update(_redoAction.after)
          .eq("id", ctx.userId);
        if (error) return { error: `Nie udało się powtórzyć zmiany profilu: ${error.message}` };
        break;
      }
      case "specializationAdded": {
        const { error } = await supabase
          .from("trainer_specializations")
          .insert({ trainer_id: ctx.userId, specialization_id: _redoAction.specId });
        if (error && error.code !== "23505") {
          return { error: `Nie udało się powtórzyć dodania specjalizacji: ${error.message}` };
        }
        break;
      }
      case "specializationRemoved": {
        const { error } = await supabase
          .from("trainer_specializations")
          .delete()
          .eq("trainer_id", ctx.userId)
          .eq("specialization_id", _redoAction.specId);
        if (error) return { error: `Nie udało się powtórzyć usunięcia specjalizacji: ${error.message}` };
        break;
      }
    }
  }

  const res = await saveDirect(ctx.userId, restored, pageId);
  if ("error" in res) return res;
  return { ok: true, remaining: remainingRedo.length };
}

/**
 * Clear cinematicCopy entirely, reverting all Cinematic copy back to the
 * hardcoded Polish defaults. This IS pushed to history so it can be undone.
 */
export async function resetCinematicCopy(pageId?: string): Promise<
  { ok: true } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cinematicCopy, ...rest } = ctx.customization;
  return saveCustomization(ctx.userId, ctx.customization, rest as ProfileCustomization);
}

/**
 * Inspect history depth — used by client to enable/disable the Cofnij button.
 */
export async function getHistoryDepth(pageId?: string): Promise<{ depth: number }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return { depth: 0 };
  return { depth: (ctx.customization._history ?? []).length };
}

// =============================================================================
// Testimonials (manual reviews) — JSON in customization.cinematicCopy
// =============================================================================

export async function addTestimonial(pageId?: string): Promise<
  { ok: true; testimonial: CinematicTestimonial } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const existing = ctx.customization.cinematicCopy?.testimonials ?? [];
  const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const testimonial: CinematicTestimonial = {
    id,
    authorName: "Imię klienta",
    rating: 5,
    text: "Tu wpisz słowa od klienta...",
    date: "",
  };
  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      testimonials: [...existing, testimonial],
    },
  };
  const res = await saveCustomization(ctx.userId, ctx.customization, next, pageId);
  if ("error" in res) return res;
  return { ok: true, testimonial };
}

export async function removeTestimonial(id: string, pageId?: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const existing = ctx.customization.cinematicCopy?.testimonials ?? [];
  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      testimonials: existing.filter((t) => t.id !== id),
    },
  };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

export async function updateTestimonialField(
  id: string,
  field: "authorName" | "text" | "date",
  value: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const existing = ctx.customization.cinematicCopy?.testimonials ?? [];
  if (!existing.find((t) => t.id === id)) return { error: "Opinia nie istnieje" };

  // text field allows rich (lime accents); name + date are plain.
  const sanitised = field === "text" ? sanitizeRichHTML(value) : value;

  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      testimonials: existing.map((t) =>
        t.id === id ? { ...t, [field]: sanitised } : t,
      ),
    },
  };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

export async function updateTestimonialRating(
  id: string,
  rating: number,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  const existing = ctx.customization.cinematicCopy?.testimonials ?? [];
  if (!existing.find((t) => t.id === id)) return { error: "Opinia nie istnieje" };

  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      testimonials: existing.map((t) =>
        t.id === id ? { ...t, rating: clamped } : t,
      ),
    },
  };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

/**
 * Avatar URLs keyed by seed authorName. Used both by seedDemoTestimonials when
 * planting fresh sample reviews and by backfillTestimonialAvatars to retro-add
 * portraits to seed testimonials that were planted before avatar URLs existed.
 * Stock Unsplash portraits with crop=faces, gendered roughly to match first names.
 */
const SEED_AVATARS: Record<string, string> = {
  "Marcin K.": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=faces",
  "Anna W.": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=faces",
  "Tomasz P.": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&h=160&fit=crop&crop=faces",
  "Kasia M.": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=faces",
  "Magdalena R.": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=faces",
};

/**
 * Retro-add avatars to existing seed testimonials that lack them. Matches by
 * authorName against the SEED_AVATARS map; non-seed testimonials and those that
 * already have an avatar are left alone. Returns the number of rows updated so
 * the client can show a meaningful confirmation toast.
 */
export async function backfillTestimonialAvatars(pageId?: string): Promise<
  { ok: true; updated: number } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const existing = ctx.customization.cinematicCopy?.testimonials ?? [];
  let updated = 0;
  const next_testimonials = existing.map((t) => {
    if (t.authorAvatar) return t;
    const url = SEED_AVATARS[t.authorName];
    if (!url) return t;
    updated += 1;
    return { ...t, authorAvatar: url };
  });

  if (updated === 0) {
    return { error: "Wszystkie opinie już mają zdjęcia (lub żadna nie pasuje do przykładowych autorów)." };
  }

  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      testimonials: next_testimonials,
    },
  };
  const res = await saveCustomization(ctx.userId, ctx.customization, next, pageId);
  if ("error" in res) return res;
  return { ok: true, updated };
}

/**
 * One-shot seeder for trainers who want a starter set of believable testimonials
 * to dress up an empty profile (or migrate legacy reviews from elsewhere). Adds
 * 5 sample Polish reviews with mixed scenarios — weight loss, rehabilitation,
 * sceptical-converted, professional client. Trainer can edit or remove any
 * afterwards. Refuses to run if testimonials already exist (no accidental dupes).
 */
export async function seedDemoTestimonials(pageId?: string): Promise<
  { ok: true; count: number } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const existing = ctx.customization.cinematicCopy?.testimonials ?? [];
  if (existing.length > 0) {
    return { error: "Masz już dodane opinie — najpierw je usuń, jeśli chcesz wgrać przykładowe." };
  }

  const now = Date.now();
  const seed: CinematicTestimonial[] = [
    {
      id: `t_seed_${now}_1`,
      authorName: "Marcin K.",
      rating: 5,
      text: "Trener z głową. Łączy wiedzę z intuicją. Po trzech miesiącach pracy zrzuciłem 14 kg i wróciłem do biegania bez bólu kolan. Konkretne plany, jasne komunikaty, zero owijania w bawełnę.",
      date: "Klient indywidualny · 02.2026",
      authorAvatar: SEED_AVATARS["Marcin K."],
    },
    {
      id: `t_seed_${now}_2`,
      authorName: "Anna W.",
      rating: 5,
      text: "Najlepszy trener z którym pracowałam. Każda sesja to coś nowego, plan dopasowany do mojego rytmu pracy i życia. Polecam każdemu, kto chce się realnie zmienić, a nie tylko obejrzeć trening na YouTube.",
      date: "Plan 3 miesięczny · 01.2026",
      authorAvatar: SEED_AVATARS["Anna W."],
    },
    {
      id: `t_seed_${now}_3`,
      authorName: "Tomasz P.",
      rating: 5,
      text: "Sceptycznie podchodziłem do trenerów osobistych — myślałem, że to wciskanie kitu. Pierwsze efekty po trzech tygodniach, po pół roku — nowa sylwetka, więcej energii, lepszy sen. Bez ściemy.",
      date: "Indywidualny program · 12.2025",
      authorAvatar: SEED_AVATARS["Tomasz P."],
    },
    {
      id: `t_seed_${now}_4`,
      authorName: "Kasia M.",
      rating: 5,
      text: "Profesjonalizm, cierpliwość, konkretne wyniki. Tłumaczy każde ćwiczenie i mówi, po co je robimy — nie ma przypadkowych ruchów. Wreszcie czuję, że trening ma sens, a nie jest tylko biciem rekordów na siłowni.",
      date: "Pakiet Premium · 03.2026",
      authorAvatar: SEED_AVATARS["Kasia M."],
    },
    {
      id: `t_seed_${now}_5`,
      authorName: "Magdalena R.",
      rating: 5,
      text: "Zaczynałam od zera, po kontuzji barku, z lękiem przed siłownią. Znalazł podejście do mnie i mojego ograniczenia — bez parcia, bez wstydu. Teraz robię rzeczy, o których przez dwa lata tylko marzyłam.",
      date: "Rehabilitacja + trening · 11.2025",
      authorAvatar: SEED_AVATARS["Magdalena R."],
    },
  ];

  const next: ProfileCustomization = {
    ...ctx.customization,
    cinematicCopy: {
      ...(ctx.customization.cinematicCopy ?? {}),
      testimonials: seed,
    },
  };
  const res = await saveCustomization(ctx.userId, ctx.customization, next, pageId);
  if ("error" in res) return res;
  return { ok: true, count: seed.length };
}
