"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callQwen } from "@/lib/qwen";
import { randomUUID } from "node:crypto";
import { updateTrainerField } from "./edit-actions";
import { updateStudioCopyField } from "./studio-copy-actions";
import { updateCinematicCopyField } from "./cinematic-copy-actions";
import { updateLuxuryCopyField } from "./luxury-copy-actions";
import { updateSignatureCopyField } from "./signature-copy-actions";
import { getSpecLabel } from "@/data/specializations";
import type { StudioCopy, StudioCaseStudy, ProfileCustomization } from "@/types";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";

// ===== Template-aware section copy writer =====
//
// Each template stores its section labels/H2/subtitles in a different
// customization bag. Premium reuses studioCopy; Cozy/default uses studioCopy
// too; Cinematic/Luxury/Signature each have their own. This dispatcher
// routes the AI-suggested h2/sub into the correct bag for the active page.
type TemplateName =
  | "premium"
  | "cozy"
  | "studio"
  | "cinematic"
  | "luxury"
  | "signature";

async function writeSectionCopy(
  template: TemplateName,
  field: string,
  value: string,
): Promise<{ ok: true } | { error: string }> {
  if (template === "cinematic") return updateCinematicCopyField(field, value);
  if (template === "luxury") return updateLuxuryCopyField(field, value);
  if (template === "signature") return updateSignatureCopyField(field, value);
  // premium / cozy / studio all share the studioCopy bag.
  return updateStudioCopyField(field, value);
}

// ===== Shared trainer context =====
//
// One trip to the DB to pull every piece of "who is this trainer + what's
// on their page" the AI generators need. Every per-section / per-item
// generator builds its prompt off this same blob, so the model stays
// consistent across the page (services don't contradict the about text,
// packages don't repeat names of existing services, etc.).
//
// Returned as a pre-formatted multiline string so generators can drop it
// straight into the user prompt. Cheaper than passing structured data
// and re-formatting in each generator.
async function loadTrainerContextString(userId: string): Promise<string> {
  const supabase = await createClient();

  const [
    { data: trainer },
    { data: specRows },
    { data: services },
    { data: packages },
  ] = await Promise.all([
    supabase
      .from("trainers")
      .select("name, about, experience, location, tagline, rating, review_count, customization, ai_context")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("trainer_specializations")
      .select("specialization_id")
      .eq("trainer_id", userId),
    supabase
      .from("services")
      .select("name, description, duration, price")
      .eq("trainer_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("packages")
      .select("name, description, items, price, period")
      .eq("trainer_id", userId)
      .order("position", { ascending: true }),
  ]);

  // Cases live in per-template copy bags (customization.cinematicCopy.cases,
  // signatureCopy.cases, etc.) — pull whichever bag matches the active
  // template. Each case typically has { title, body/summary, … } fields.
  type CaseRow = { title?: string; summary?: string; body?: string };
  const customization = (trainer?.customization ?? {}) as Record<string, unknown>;
  const allCaseBags: CaseRow[] = [];
  for (const key of [
    "cinematicCopy",
    "signatureCopy",
    "studioCopy",
    "luxuryCopy",
  ]) {
    const bag = customization[key] as { cases?: CaseRow[] } | undefined;
    if (bag?.cases && Array.isArray(bag.cases)) {
      allCaseBags.push(...bag.cases);
    }
  }
  // Dedupe by title (multiple template bags may have the same case).
  const seenTitles = new Set<string>();
  const caseStudies = allCaseBags
    .filter((c) => {
      const t = c.title?.trim();
      if (!t || seenTitles.has(t)) return false;
      seenTitles.add(t);
      return true;
    })
    .slice(0, 5);

  const specLabels = (specRows ?? [])
    .map((r) => getSpecLabel(r.specialization_id))
    .filter(Boolean)
    .join(", ");

  const lines: string[] = [];
  lines.push("=== KONTEKST PROFILU TRENERA ===");
  if (trainer?.name) lines.push(`Imię: ${trainer.name}`);
  if (trainer?.experience != null) lines.push(`Doświadczenie: ${trainer.experience} lat`);
  if (trainer?.location) lines.push(`Lokalizacja: ${trainer.location}`);
  if (specLabels) lines.push(`Specjalizacje: ${specLabels}`);
  if (trainer?.tagline) lines.push(`Tagline: ${trainer.tagline}`);
  if (trainer?.rating && trainer?.review_count) {
    lines.push(`Ocena: ${trainer.rating} (${trainer.review_count} opinii)`);
  }

  // ai_context — the trainer's own structured answers from /studio/profile.
  // This is the strongest signal we have for tone + audience + angle, so
  // it goes ABOVE the auto-generated about. Generators are explicitly told
  // to prioritise this over guessing from past content.
  const ai = (trainer?.ai_context ?? {}) as {
    background?: string;
    targetAudience?: string;
    methodology?: string;
    differentiators?: string;
    tonePreference?: string;
  };
  const aiLabels: Record<string, string> = {
    background: "HISTORIA / WYKSZTAŁCENIE",
    targetAudience: "GRUPA DOCELOWA",
    methodology: "METODA / JAK WYGLĄDA WSPÓŁPRACA",
    differentiators: "CZYM SIĘ WYRÓŻNIA",
    tonePreference: "STYL / TON KOMUNIKACJI",
  };
  const aiKeys = Object.keys(aiLabels) as (keyof typeof aiLabels)[];
  const hasAnyAi = aiKeys.some((k) => (ai[k] ?? "").trim().length > 0);
  if (hasAnyAi) {
    lines.push("");
    lines.push("--- ODPOWIEDZI TRENERA Z ANKIETY (najważniejsze źródło) ---");
    for (const k of aiKeys) {
      const v = (ai[k] ?? "").trim();
      if (!v) continue;
      lines.push(`${aiLabels[k]}: ${v}`);
    }
    lines.push("--- KONIEC ODPOWIEDZI ANKIETOWYCH ---");
  }

  if (trainer?.about) {
    lines.push("");
    lines.push('OPIS „O MNIE" (pełna treść):');
    // No truncation — generators rely on this as the primary context for
    // matching tone and angle. Qwen-plus has plenty of context budget.
    lines.push(trainer.about);
  }

  if (services && services.length > 0) {
    lines.push("");
    lines.push("OBECNE USŁUGI NA STRONIE:");
    services.forEach((s, i) => {
      lines.push(
        `${i + 1}. ${s.name} — ${s.duration} min, ${s.price} zł${s.description ? ` · ${s.description}` : ""}`,
      );
    });
  }

  if (packages && packages.length > 0) {
    lines.push("");
    lines.push("OBECNE PAKIETY NA STRONIE:");
    packages.forEach((p, i) => {
      const items = (p.items ?? []).join(" · ");
      lines.push(
        `${i + 1}. ${p.name} — ${p.price} zł${p.period ? ` / ${p.period}` : ""}${p.description ? ` · ${p.description}` : ""}${items ? ` (zawiera: ${items})` : ""}`,
      );
    });
  }

  if (caseStudies.length > 0) {
    lines.push("");
    lines.push("OBECNE KEJSY/HISTORIE KLIENTÓW:");
    caseStudies.forEach((c, i) => {
      const blurb = c.summary ?? c.body ?? "";
      const trimmed = blurb.length > 200 ? blurb.slice(0, 200) + "…" : blurb;
      lines.push(`${i + 1}. ${c.title}${trimmed ? ` — ${trimmed}` : ""}`);
    });
  }

  return lines.join("\n");
}

/**
 * AI item-level rewriters for /studio/design.
 *
 * Each generator returns 3 variants in one Qwen call (cheaper + faster than
 * three separate calls, and the model picks distinct angles when explicitly
 * asked for "wyraźnie różne" variants).
 *
 * Apply actions write a single chosen variant to the master table, mirroring
 * the same field-by-field saves that manual editors use — no separate
 * "AI-authored" path. Once committed it's just data.
 *
 * IMPORTANT: PRICE and PERIOD are intentionally NOT in the generator's
 * output schema. The trainer asked us never to touch pricing automatically.
 */

// ===== Shared system prompt =====
// The marketing-copywriter persona. Kept here (not per-generator) so all
// item types share the same voice — services/packages/cases on one page
// should read like one author wrote them.
const SYSTEM_PROMPT = `Jesteś profesjonalnym copywriterem polskiego rynku fitness, specjalizującym się w stronach trenerów osobistych w segmencie premium B2C. Piszesz po polsku.

ZASADY STYLU:
- Pewnie, konkretnie, krótko. Bez frazesów typu "pasja od dziecka", "totalna transformacja", "spełnij marzenia".
- Konkretne efekty/elementy zamiast emocji. Liczby, tygodnie, części ciała, mierzalne rezultaty.
- Zero emoji. Zero wykrzykników. Zero capslocka.
- Polski język. Bez kalek z angielskiego.
- NIE WYMYŚLAJ certyfikatów, tytułów, lat doświadczenia ani liczb klientów. Jeśli faktów mało, pisz ogólniej.
- Każdy z 3 wariantów ma być WYRAŹNIE inny — różny kąt, różna grupa docelowa lub różny poziom szczegółowości. Nie mogą być przeparafrazowaniami siebie.
- Jeśli w kontekście znajdują się "ODPOWIEDZI TRENERA Z ANKIETY", traktuj je jako NAJWAŻNIEJSZE źródło — to słowa samego trenera o sobie, jego klientach, metodzie i preferowanym stylu. Dopasuj ton i akcenty pod te odpowiedzi, nawet jeśli kłócą się z wcześniejszym auto-wygenerowanym opisem "O mnie".

ZAWSZE zwracasz poprawny JSON dokładnie według schematu w pytaniu użytkownika.`;

// ===== Package variants =====

type PackageVariant = {
  name: string;
  description: string;
  items: string[];
};

export async function generatePackageVariants(
  packageId: string,
  changeRequest: string,
): Promise<{ variants: PackageVariant[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Pull the package itself, the trainer's profile snippets, and sibling
  // package names. The siblings keep the model from generating a duplicate
  // ("Reset" when there's already a "Reset"); the trainer profile gives the
  // model real context to riff on.
  const [{ data: pkg }, context] = await Promise.all([
    supabase
      .from("packages")
      .select("id, name, description, items, price, period, trainer_id")
      .eq("id", packageId)
      .eq("trainer_id", user.id)
      .maybeSingle(),
    loadTrainerContextString(user.id),
  ]);

  if (!pkg) return { error: "Pakiet nie został znaleziony" };

  const userPrompt = buildPackagePrompt({
    pkg,
    context,
    changeRequest,
  });

  const result = await callQwen<{ variants: PackageVariant[] }>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    // Higher temperature so the 3 variants spread across distinct angles
    // instead of converging on one safe answer.
    temperature: 0.85,
  });

  if ("error" in result) return result;
  if (!Array.isArray(result.variants) || result.variants.length !== 3) {
    return { error: "AI zwrócił nieprawidłową liczbę wariantów" };
  }
  // Light shape validation — defend against the model dropping a field.
  for (const v of result.variants) {
    if (
      typeof v.name !== "string" ||
      typeof v.description !== "string" ||
      !Array.isArray(v.items)
    ) {
      return { error: "AI zwrócił wariant w nieprawidłowym kształcie" };
    }
    // Coerce items to strings (Qwen sometimes returns nested objects).
    v.items = v.items
      .map((it) => (typeof it === "string" ? it : String(it)))
      .filter((it) => it.length > 0);
  }

  return { variants: result.variants };
}

function buildPackagePrompt(args: {
  pkg: {
    name: string;
    description: string | null;
    items: string[] | null;
    price: number;
    period: string | null;
  };
  context: string;
  changeRequest: string;
}): string {
  const { pkg, context, changeRequest } = args;

  return `${context}

=== ZADANIE ===
KONKRETNY PAKIET DO PRZEPISANIA:
- Nazwa: ${pkg.name}
- Opis: ${pkg.description ?? "(pusty)"}
- Pozycje: ${(pkg.items ?? []).map((i) => `• ${i}`).join("\n  ") || "(brak)"}
- Cena: ${pkg.price} zł / ${pkg.period ?? "—"}  (NIE ZMIENIAJ — dla kontekstu)

PROŚBA TRENERA: ${changeRequest.trim() || "Przepisz ten pakiet w sposób bardziej atrakcyjny dla klienta. Zachowaj sens, popraw styl i czytelność. Dopasuj do reszty profilu (zwłaszcza opisu O mnie)."}

Wygeneruj DOKŁADNIE 3 warianty, każdy z innym akcentem (np. wariant 1 — efektowy, wariant 2 — racjonalny/metodyczny, wariant 3 — emocjonalny/wynikowy). Zwróć JSON dokładnie w tym kształcie:

{
  "variants": [
    {
      "name": "<2-4 słowa, mocna i konkretna nazwa>",
      "description": "<1-2 zdania, max 160 znaków>",
      "items": ["<4-7 punktów, każdy 3-8 słów, konkrety nie marketing>"]
    },
    { ...drugi wariant... },
    { ...trzeci wariant... }
  ]
}

NIE DODAWAJ pól "price" ani "period" — pozostają niezmienione.`;
}

// ===== About text variants =====
//
// Each variant carries its own section header set: `text` (body),
// `h2` (section heading, rich — em/strong allowed), `sub` (subtitle).
// All three are committed together when the trainer accepts a variant.

type AboutVariant = { text: string; h2: string; sub: string };

export async function generateAboutVariants(
  changeRequest: string,
): Promise<{ variants: AboutVariant[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const context = await loadTrainerContextString(user.id);

  const userPrompt = `${context}

=== ZADANIE ===
PROŚBA TRENERA: ${changeRequest.trim() || "Napisz dobry, marketingowo skuteczny opis 'O mnie' — kim jestem, dla kogo pracuję, jak wygląda współpraca, jaki wynik mogą oczekiwać klienci. Dopasuj do reszty profilu (specjalizacje, usługi, pakiety powyżej)."}

Wygeneruj DOKŁADNIE 3 warianty opisu O mnie, każdy z innym akcentem (np. wariant 1 — metodyczny/ekspercki, wariant 2 — ciepły/relacyjny, wariant 3 — wynikowy/efektowy).

Każdy wariant zawiera:
- "h2": tytuł sekcji, 2-4 słowa, mocny i konkretny. Może zawierać <em> wokół jednego słowa-akcentu (np. "Filozofia <em>pracy</em>"). Nie używaj cudzysłowów, kropki na końcu nie potrzebujesz.
- "sub": jednoczdaniowy podtytuł sekcji, max 120 znaków, bez kropki na końcu — krótki tagline który spina H2 z treścią.
- "text": treść 200-300 słów, pisana w pierwszej osobie liczby pojedynczej, w 2-3 akapitach (akapity rozdziel pustą linią). Bez nagłówka w środku — sam tekst.

Wszystkie 3 warianty muszą się WYRAŹNIE różnić H2/sub/textem (nie tylko tekstem).

Zwróć JSON dokładnie w tym kształcie:
{
  "variants": [
    { "h2": "...", "sub": "...", "text": "..." },
    { "h2": "...", "sub": "...", "text": "..." },
    { "h2": "...", "sub": "...", "text": "..." }
  ]
}`;

  const result = await callQwen<{ variants: AboutVariant[] }>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.85,
  });

  if ("error" in result) return result;
  if (!Array.isArray(result.variants) || result.variants.length !== 3) {
    return { error: "AI zwrócił nieprawidłową liczbę wariantów" };
  }
  for (const v of result.variants) {
    if (typeof v.text !== "string" || v.text.trim().length < 50) {
      return { error: "AI zwrócił zbyt krótki wariant" };
    }
    if (typeof v.h2 !== "string" || !v.h2.trim()) {
      return { error: "AI nie zwrócił tytułu sekcji" };
    }
    if (typeof v.sub !== "string") {
      return { error: "AI nie zwrócił podtytułu sekcji" };
    }
    v.text = v.text.trim();
    v.h2 = v.h2.trim();
    v.sub = v.sub.trim();
  }

  return { variants: result.variants };
}

export async function applyAboutVariant(
  text: string,
  h2?: string,
  sub?: string,
  template: TemplateName = "premium",
): Promise<{ ok: true } | { error: string }> {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length < 50) return { error: "Tekst jest zbyt krótki" };
  if (trimmed.length > 3000) return { error: "Tekst przekracza limit 3000 znaków" };

  // Body goes to the trainer.about column — shared across all templates.
  const bodyRes = await updateTrainerField("about", trimmed);
  if ("error" in bodyRes) return bodyRes;

  // H2 and sub go to the per-template copy bag (cinematicCopy / luxuryCopy /
  // signatureCopy / studioCopy depending on template).
  if (typeof h2 === "string" && h2.trim()) {
    const r = await writeSectionCopy(template, "aboutH2", h2.trim());
    if ("error" in r) return r;
  }
  if (typeof sub === "string") {
    const r = await writeSectionCopy(template, "aboutSub", sub.trim());
    if ("error" in r) return r;
  }
  return { ok: true };
}

// ===== Service variants (single item) =====

type ServiceVariant = {
  name: string;
  description: string;
  duration: number;
};

export async function generateServiceVariants(
  serviceId: string,
  changeRequest: string,
): Promise<{ variants: ServiceVariant[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const [{ data: svc }, context] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration, price, trainer_id")
      .eq("id", serviceId)
      .eq("trainer_id", user.id)
      .maybeSingle(),
    loadTrainerContextString(user.id),
  ]);

  if (!svc) return { error: "Usługa nie została znaleziona" };

  const userPrompt = `${context}

=== ZADANIE ===
KONKRETNA USŁUGA DO PRZEPISANIA:
- Nazwa: ${svc.name}
- Opis: ${svc.description ?? "(pusty)"}
- Czas trwania: ${svc.duration} min
- Cena: ${svc.price} zł (NIE ZMIENIAJ — dla kontekstu)

PROŚBA TRENERA: ${changeRequest.trim() || "Przepisz tę usługę bardziej atrakcyjnie i konkretnie. Zachowaj sens, popraw styl. Dopasuj do reszty profilu (opis O mnie, inne usługi i pakiety powyżej)."}

Wygeneruj DOKŁADNIE 3 warianty, każdy z innym akcentem. Zwróć JSON dokładnie w tym kształcie:

{
  "variants": [
    { "name": "<2-5 słów>", "description": "<1-2 zdania, max 200 znaków>", "duration": <liczba minut, 15-180> },
    { ...drugi wariant... },
    { ...trzeci wariant... }
  ]
}

NIE DODAWAJ pola "price" — pozostaje niezmienione.`;

  const result = await callQwen<{ variants: ServiceVariant[] }>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.85,
  });

  if ("error" in result) return result;
  if (!Array.isArray(result.variants) || result.variants.length !== 3) {
    return { error: "AI zwrócił nieprawidłową liczbę wariantów" };
  }
  for (const v of result.variants) {
    if (
      typeof v.name !== "string" ||
      typeof v.description !== "string" ||
      typeof v.duration !== "number" ||
      !Number.isFinite(v.duration)
    ) {
      return { error: "AI zwrócił wariant w nieprawidłowym kształcie" };
    }
    v.duration = Math.max(0, Math.min(480, Math.round(v.duration)));
  }

  return { variants: result.variants };
}

export async function applyServiceVariant(
  serviceId: string,
  variant: ServiceVariant,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const name = String(variant.name ?? "").trim().slice(0, 80);
  const description = String(variant.description ?? "").trim().slice(0, 250);
  const duration = Number.isFinite(variant.duration)
    ? Math.max(0, Math.min(480, Math.round(variant.duration)))
    : 60;

  if (!name) return { error: "Nazwa nie może być pusta" };

  const { error } = await supabase
    .from("services")
    .update({ name, description, duration, is_placeholder: false })
    .eq("id", serviceId)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true };
}

// ===== Service set variants (whole section regen) =====

type ServiceSetVariant = {
  set: ServiceVariant[];
};

type ServiceSetResponse = {
  count?: number;
  // ONE shared header for the whole generation, applied along with the
  // chosen variant set. Keeps preview cleaner — trainer doesn't compare
  // 3 different headers; the section heading is a once-decision.
  h2: string;
  sub: string;
  variants: ServiceSetVariant[];
};

export async function generateServiceSetVariants(
  changeRequest: string,
): Promise<{ h2: string; sub: string; variants: ServiceSetVariant[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const context = await loadTrainerContextString(user.id);

  const userPrompt = `${context}

=== ZADANIE ===
PROŚBA TRENERA (może być w dowolnym języku): ${changeRequest.trim() || "Zaproponuj kompletny zestaw usług dla tego trenera — typowe formaty, w które klienci wchodzą najczęściej. Dopasuj do opisu O mnie powyżej."}

WYMAGANIA:
- Wygeneruj DOKŁADNIE 3 WARIANTY (3 osobne propozycje zestawu).
- LICZBA USŁUG W KAŻDYM WARIANCIE: jeśli trener wyraźnie podał liczbę (cyfrą lub słownie, w jakimkolwiek języku — np. „4 usługi", „cztery formaty", „four services", „две тренировки"), użyj DOKŁADNIE tej liczby. Jeśli nie podał — użyj 3. Liczba musi być z zakresu 1-7. WSZYSTKIE 3 WARIANTY MUSZĄ ZAWIERAĆ TĘ SAMĄ LICZBĘ USŁUG.
- Każdy wariant ma się WYRAŹNIE różnić od pozostałych (np. wariant 1 — klasyczny indywidualny, wariant 2 — z naciskiem na pary/grupy, wariant 3 — z naciskiem na online/zdalne).
- NIE DODAWAJ pola "price" — cena pozostaje do ustalenia przez trenera.
- Niezależnie od języka prośby, nazwy i opisy usług ZAWSZE PISZ PO POLSKU (to polski rynek).
- Zaproponuj JEDEN wspólny tytuł H2 sekcji ("h2") i JEDEN podtytuł ("sub") dla całej generacji. H2 — 2-4 słowa, mocny, może zawierać <em> wokół jednego słowa-akcentu (np. "Pojedyncze <em>sesje</em>"). Sub — jedno zdanie, max 120 znaków, bez kropki na końcu.

Zwróć JSON dokładnie w tym kształcie:
{
  "h2": "<tytuł sekcji z opcjonalnym <em>>",
  "sub": "<jednoczdaniowy podtytuł>",
  "count": <liczba 1-7 którą zinterpretowałeś z prośby>,
  "variants": [
    {
      "set": [
        { "name": "<2-5 słów>", "description": "<1-2 zdania, max 200 znaków>", "duration": <liczba minut> }
      ]
    },
    { "set": [ ...kolejny wariant, ta sama liczba usług... ] },
    { "set": [ ...trzeci wariant, ta sama liczba usług... ] }
  ]
}`;

  const result = await callQwen<ServiceSetResponse>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.9,
  });

  if ("error" in result) return result;
  if (!Array.isArray(result.variants) || result.variants.length !== 3) {
    return { error: "AI zwrócił nieprawidłową liczbę wariantów" };
  }
  if (typeof result.h2 !== "string" || !result.h2.trim()) {
    return { error: "AI nie zwrócił tytułu sekcji" };
  }
  if (typeof result.sub !== "string") {
    return { error: "AI nie zwrócił podtytułu sekcji" };
  }

  const firstLen = result.variants[0]?.set?.length ?? 0;
  if (firstLen < 1 || firstLen > 7) {
    return {
      error: `AI zwrócił zestaw ${firstLen} usług — oczekiwano 1-7. Spróbuj ponownie.`,
    };
  }
  for (const v of result.variants) {
    if (!Array.isArray(v.set) || v.set.length !== firstLen) {
      return {
        error: "AI zwrócił warianty o różnej liczbie usług. Spróbuj ponownie.",
      };
    }
    for (const s of v.set) {
      if (
        typeof s.name !== "string" ||
        typeof s.description !== "string" ||
        typeof s.duration !== "number"
      ) {
        return { error: "AI zwrócił usługę w nieprawidłowym kształcie" };
      }
      s.duration = Math.max(0, Math.min(480, Math.round(s.duration)));
    }
  }

  return {
    h2: result.h2.trim(),
    sub: result.sub.trim(),
    variants: result.variants,
  };
}

/**
 * APPEND the AI-generated set to the trainer's existing services.
 *
 * Append (not replace) was chosen for two reasons:
 *  1. It avoids the `bookings_check1` violation triggered by deleting a
 *     service with linked bookings (FK is ON DELETE SET NULL → the
 *     booking's service_id goes null while package_id is also null,
 *     failing the XOR constraint).
 *  2. It matches the trainer's mental model: AI is a generator of new
 *     ideas, not a replacement for what the trainer already curated.
 *     Old services stay; the trainer prunes manually if needed.
 *
 * Future improvement (tracked separately): snapshot service fields into
 * bookings at booking-create time so deleting a service no longer
 * affects the booking — that unlocks the "Replace all" UX without the
 * constraint problem. Big enough to deserve its own migration + backfill,
 * so kept out of this AI feature.
 */
export async function applyServiceSet(
  set: ServiceVariant[],
  h2?: string,
  sub?: string,
  template: TemplateName = "premium",
): Promise<{ ok: true; inserted: number } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  if (!Array.isArray(set) || set.length === 0) {
    return { error: "Pusty zestaw usług" };
  }

  // Section header (h2/sub) goes to {template}Copy.servicesH2/servicesSub.
  // Done before the inserts so a failure here doesn't leave the trainer
  // with new services + stale header.
  if (typeof h2 === "string" && h2.trim()) {
    const r = await writeSectionCopy(template, "servicesH2", h2.trim());
    if ("error" in r) return r;
  }
  if (typeof sub === "string") {
    const r = await writeSectionCopy(template, "servicesSub", sub.trim());
    if ("error" in r) return r;
  }

  const rows = set.map((s, i) => ({
    trainer_id: user.id,
    name: String(s.name ?? "").trim().slice(0, 80) || `Usługa ${i + 1}`,
    description: String(s.description ?? "").trim().slice(0, 250),
    duration: Number.isFinite(s.duration)
      ? Math.max(0, Math.min(480, Math.round(s.duration)))
      : 60,
    // Price stays at 0 — AI never sets it; trainer must fill it in. Not
    // marked as placeholder because the content itself is real.
    price: 0,
    is_placeholder: false,
  }));

  const { error: insErr } = await supabase.from("services").insert(rows);
  if (insErr) return { error: insErr.message };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true, inserted: rows.length };
}

/**
 * REPLACE all existing services with the AI-generated set.
 *
 * Safe to delete services with linked bookings now that bookings carry
 * their own snapshot fields (migration 018) — the FK becomes NULL on
 * delete but the booking still displays the service name/description/etc.
 * the client originally booked. Trainer + client both keep their record;
 * the public profile no longer shows the deleted service.
 */
export async function applyServiceSetReplace(
  set: ServiceVariant[],
  h2?: string,
  sub?: string,
  template: TemplateName = "premium",
): Promise<
  { ok: true; removed: number; added: number } | { error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  if (!Array.isArray(set) || set.length === 0) {
    return { error: "Pusty zestaw usług" };
  }

  if (typeof h2 === "string" && h2.trim()) {
    const r = await writeSectionCopy(template, "servicesH2", h2.trim());
    if ("error" in r) return r;
  }
  if (typeof sub === "string") {
    const r = await writeSectionCopy(template, "servicesSub", sub.trim());
    if ("error" in r) return r;
  }

  // Count existing services (just so we can return the removed count for
  // the UI). We could skip this and trust DELETE's row count, but this is
  // cheaper to surface to the user.
  const { data: existingServices } = await supabase
    .from("services")
    .select("id")
    .eq("trainer_id", user.id);
  const removedCount = (existingServices ?? []).length;

  // Wipe all of this trainer's services. Bookings.service_id will go NULL
  // via ON DELETE SET NULL — fine, snapshot fields cover display.
  const { error: delErr } = await supabase
    .from("services")
    .delete()
    .eq("trainer_id", user.id);
  if (delErr) return { error: delErr.message };

  // Insert the new set.
  const rows = set.map((s, i) => ({
    trainer_id: user.id,
    name: String(s.name ?? "").trim().slice(0, 80) || `Usługa ${i + 1}`,
    description: String(s.description ?? "").trim().slice(0, 250),
    duration: Number.isFinite(s.duration)
      ? Math.max(0, Math.min(480, Math.round(s.duration)))
      : 60,
    price: 0,
    is_placeholder: false,
  }));
  const { error: insErr } = await supabase.from("services").insert(rows);
  if (insErr) return { error: insErr.message };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);

  return { ok: true, removed: removedCount, added: rows.length };
}

// ===== Package set variants (whole section regen) =====

type PackageSetItem = {
  name: string;
  description: string;
  items: string[];
  period: string;
};

type PackageSetVariant = { set: PackageSetItem[] };

type PackageSetResponse = {
  count?: number;
  h2: string;
  sub: string;
  variants: PackageSetVariant[];
};

export async function generatePackageSetVariants(
  changeRequest: string,
): Promise<{ h2: string; sub: string; variants: PackageSetVariant[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const context = await loadTrainerContextString(user.id);

  const userPrompt = `${context}

=== ZADANIE ===
PROŚBA TRENERA (może być w dowolnym języku): ${changeRequest.trim() || "Zaproponuj kompletny zestaw pakietów dla tego trenera. Pakiety to długoterminowe programy z rabatem względem sesji pojedynczych. Dopasuj do reszty profilu (zwłaszcza opisu O mnie i listy usług powyżej)."}

WYMAGANIA:
- Wygeneruj DOKŁADNIE 3 WARIANTY (3 osobne propozycje zestawu pakietów).
- LICZBA PAKIETÓW W KAŻDYM WARIANCIE: jeśli trener wyraźnie podał liczbę (cyfrą lub słownie, w jakimkolwiek języku — np. „4 pakiety", „dwa programy", „three packages"), użyj DOKŁADNIE tej liczby. Jeśli nie podał — użyj 3. Liczba musi być z zakresu 1-5. WSZYSTKIE 3 WARIANTY MUSZĄ ZAWIERAĆ TĘ SAMĄ LICZBĘ PAKIETÓW.
- Każdy wariant ma się WYRAŹNIE różnić od pozostałych w doborze formatów (np. wariant 1 — krótkie startery, wariant 2 — głębokie transformacje, wariant 3 — abonamentowe długoterminowe).
- NIE DODAWAJ pola "price" — cena pozostaje do ustalenia przez trenera.
- Niezależnie od języka prośby, nazwy / opisy / pozycje / okres ZAWSZE PISZ PO POLSKU.
- Zaproponuj JEDEN wspólny tytuł H2 sekcji ("h2") i JEDEN podtytuł ("sub") dla całej generacji. H2 — 2-4 słowa, mocny, może zawierać <em> wokół jednego słowa-akcentu (np. "Zaplanuj <em>transformację</em>"). Sub — jedno zdanie, max 120 znaków, bez kropki na końcu.

Zwróć JSON dokładnie w tym kształcie:
{
  "h2": "<tytuł sekcji>",
  "sub": "<jednoczdaniowy podtytuł>",
  "count": <liczba 1-5>,
  "variants": [
    {
      "set": [
        {
          "name": "<2-5 słów, mocna nazwa>",
          "description": "<1-2 zdania, max 200 znaków>",
          "items": ["<4-7 punktów, każdy 3-8 słów, konkretne efekty/elementy>"],
          "period": "<np. „4 tygodnie", „8 tygodni", „12 tygodni", „miesiąc">"
        }
      ]
    },
    { "set": [ ...drugi wariant, ta sama liczba pakietów... ] },
    { "set": [ ...trzeci wariant, ta sama liczba pakietów... ] }
  ]
}`;

  const result = await callQwen<PackageSetResponse>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.9,
  });

  if ("error" in result) return result;
  if (!Array.isArray(result.variants) || result.variants.length !== 3) {
    return { error: "AI zwrócił nieprawidłową liczbę wariantów" };
  }
  if (typeof result.h2 !== "string" || !result.h2.trim()) {
    return { error: "AI nie zwrócił tytułu sekcji" };
  }
  if (typeof result.sub !== "string") {
    return { error: "AI nie zwrócił podtytułu sekcji" };
  }

  const firstLen = result.variants[0]?.set?.length ?? 0;
  if (firstLen < 1 || firstLen > 5) {
    return {
      error: `AI zwrócił zestaw ${firstLen} pakietów — oczekiwano 1-5. Spróbuj ponownie.`,
    };
  }
  for (const v of result.variants) {
    if (!Array.isArray(v.set) || v.set.length !== firstLen) {
      return {
        error: "AI zwrócił warianty o różnej liczbie pakietów. Spróbuj ponownie.",
      };
    }
    for (const p of v.set) {
      if (
        typeof p.name !== "string" ||
        typeof p.description !== "string" ||
        !Array.isArray(p.items) ||
        typeof p.period !== "string"
      ) {
        return { error: "AI zwrócił pakiet w nieprawidłowym kształcie" };
      }
      // Coerce items to strings (Qwen sometimes nests objects).
      p.items = p.items
        .map((it) => (typeof it === "string" ? it : String(it)))
        .filter((it) => it.length > 0);
    }
  }

  return {
    h2: result.h2.trim(),
    sub: result.sub.trim(),
    variants: result.variants,
  };
}

/**
 * APPEND the chosen AI-generated packages onto the trainer's existing list.
 * Snapshots in bookings (migration 018) keep historical bookings intact
 * regardless of later edits.
 */
export async function applyPackageSet(
  set: PackageSetItem[],
  h2?: string,
  sub?: string,
  template: TemplateName = "premium",
): Promise<{ ok: true; inserted: number } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  if (!Array.isArray(set) || set.length === 0) {
    return { error: "Pusty zestaw pakietów" };
  }

  if (typeof h2 === "string" && h2.trim()) {
    const r = await writeSectionCopy(template, "packagesH2", h2.trim());
    if ("error" in r) return r;
  }
  if (typeof sub === "string") {
    const r = await writeSectionCopy(template, "packagesSub", sub.trim());
    if ("error" in r) return r;
  }

  const rows = set.map((p, i) => ({
    trainer_id: user.id,
    name: String(p.name ?? "").trim().slice(0, 80) || `Pakiet ${i + 1}`,
    description: String(p.description ?? "").trim().slice(0, 250),
    items: Array.isArray(p.items)
      ? p.items
          .map((it) => String(it ?? "").trim())
          .filter((it) => it.length > 0)
          .slice(0, 12)
      : [],
    period: String(p.period ?? "").trim().slice(0, 40) || null,
    // Price stays 0 — AI never sets it; trainer fills it manually.
    price: 0,
    is_placeholder: false,
  }));

  const { error: insErr } = await supabase.from("packages").insert(rows);
  if (insErr) return { error: insErr.message };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);

  return { ok: true, inserted: rows.length };
}

/**
 * REPLACE all existing packages with the chosen AI-generated set. Safe to
 * delete packages with linked bookings — the bookings carry their own
 * snapshot fields (migration 018), so they keep displaying the original
 * package name in trainer's calendar and client's bookings list even
 * after the source row is gone.
 */
export async function applyPackageSetReplace(
  set: PackageSetItem[],
  h2?: string,
  sub?: string,
  template: TemplateName = "premium",
): Promise<{ ok: true; removed: number; added: number } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  if (!Array.isArray(set) || set.length === 0) {
    return { error: "Pusty zestaw pakietów" };
  }

  if (typeof h2 === "string" && h2.trim()) {
    const r = await writeSectionCopy(template, "packagesH2", h2.trim());
    if ("error" in r) return r;
  }
  if (typeof sub === "string") {
    const r = await writeSectionCopy(template, "packagesSub", sub.trim());
    if ("error" in r) return r;
  }

  const { data: existingPackages } = await supabase
    .from("packages")
    .select("id")
    .eq("trainer_id", user.id);
  const removedCount = (existingPackages ?? []).length;

  const { error: delErr } = await supabase
    .from("packages")
    .delete()
    .eq("trainer_id", user.id);
  if (delErr) return { error: delErr.message };

  const rows = set.map((p, i) => ({
    trainer_id: user.id,
    name: String(p.name ?? "").trim().slice(0, 80) || `Pakiet ${i + 1}`,
    description: String(p.description ?? "").trim().slice(0, 250),
    items: Array.isArray(p.items)
      ? p.items
          .map((it) => String(it ?? "").trim())
          .filter((it) => it.length > 0)
          .slice(0, 12)
      : [],
    period: String(p.period ?? "").trim().slice(0, 40) || null,
    price: 0,
    is_placeholder: false,
  }));
  const { error: insErr } = await supabase.from("packages").insert(rows);
  if (insErr) return { error: insErr.message };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);

  return { ok: true, removed: removedCount, added: rows.length };
}

// ===== Apply a chosen package variant =====

export async function applyPackageVariant(
  packageId: string,
  variant: PackageVariant,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Light validation — bound the data we accept from the client. The
  // generator already validated shape, but this action can be called with
  // any payload so we re-check.
  const name = String(variant.name ?? "").trim().slice(0, 120);
  const description = String(variant.description ?? "").trim().slice(0, 400);
  const items = Array.isArray(variant.items)
    ? variant.items
        .map((it) => String(it ?? "").trim())
        .filter((it) => it.length > 0)
        .slice(0, 12)
    : [];

  if (!name) return { error: "Nazwa nie może być pusta" };

  const { error } = await supabase
    .from("packages")
    .update({
      name,
      description,
      items,
      // Once AI-edited, the package is no longer a placeholder.
      is_placeholder: false,
    })
    .eq("id", packageId)
    .eq("trainer_id", user.id);

  if (error) return { error: error.message };

  // Refresh both the editor canvas and the public profile so the change
  // shows up immediately on next navigation.
  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);

  return { ok: true };
}

// ===== Case-study set variants =====
//
// All five PRO templates share `customization.studioCopy.cases` —
// CinematicCases, LuxuryCases, SignatureCases, StudioCasesEditor and
// PremiumCases all read/write the same array, just with template-native
// styling on the public render. So one generator + one apply pair covers
// every template — only the visual chrome (collapsed pill + section H2
// keys) varies per template.

type CaseSetItem = {
  tag: string;
  title: string;
  body: string;
  stat1: string;
  stat1Label: string;
  stat2: string;
  stat2Label: string;
  stat3: string;
  stat3Label: string;
};

type CaseSetVariant = { set: CaseSetItem[] };

type CaseSetResponse = {
  count?: number;
  h2: string;
  sub: string;
  variants: CaseSetVariant[];
};

export async function generateCaseSetVariants(
  changeRequest: string,
): Promise<{ h2: string; sub: string; variants: CaseSetVariant[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const context = await loadTrainerContextString(user.id);

  const userPrompt = `${context}

=== ZADANIE ===
PROŚBA TRENERA (może być w dowolnym języku): ${changeRequest.trim() || "Wymyśl realistyczne historie klientów (kejsy) dopasowane do mojego profilu i grupy docelowej. Konkretne sytuacje wyjściowe, mierzalne efekty po pracy, cytat lub pointa w body."}

WYMAGANIA:
- Wygeneruj DOKŁADNIE 3 WARIANTY (3 osobne propozycje zestawu kejsów).
- LICZBA KEJSÓW W KAŻDYM WARIANCIE: jeśli trener wyraźnie podał liczbę (cyfrą lub słownie, w jakimkolwiek języku), użyj DOKŁADNIE tej liczby. Jeśli nie podał — użyj 3. Liczba musi być z zakresu 1-5. WSZYSTKIE 3 WARIANTY MUSZĄ ZAWIERAĆ TĘ SAMĄ LICZBĘ KEJSÓW.
- Każdy wariant ma się WYRAŹNIE różnić (np. wariant 1 — rehabilitacja po urazach, wariant 2 — odchudzanie i powrót do formy, wariant 3 — sportowe wyniki / progres siłowy).
- Każdy kejs ma WIARYGODNIE pasować do profilu trenera: jeśli ankieta mówi "kobiety 30-50 po porodzie", nie wymyślaj kejsa o przygotowaniu maratończyka. Jeśli specjalizacje mówią "siła + crossfit", trzymaj się tej kategorii.
- NIE WYMYŚLAJ konkretnych imion klientów — używaj inicjałów ("Klient P., 42 lata") lub anonimowych etykiet ("Manager IT, 38 lat"). Liczb i mierzalnych efektów używaj odważnie, ale realistycznie.
- Niezależnie od języka prośby, treści ZAWSZE PISZ PO POLSKU.
- Zaproponuj JEDEN wspólny tytuł H2 sekcji ("h2") i JEDEN podtytuł ("sub"). H2 — 2-4 słowa, mocny, może zawierać <em> wokół jednego słowa-akcentu (np. "Wybrane <em>drogi</em>"). Sub — jedno zdanie, max 120 znaków, bez kropki na końcu.

Każdy kejs zawiera 9 pól (wszystkie obowiązkowe — żadne nie może być puste):
- "tag": kategoria, 1-3 słowa, np. "Rehabilitacja kręgosłupa", "Odchudzanie po porodzie"
- "title": tytuł historii, 1 zdanie z konkretem przed→po, np. "Powrót do siłowni po zerwaniu więzadła"
- "body": opis 2-3 zdania, max 300 znaków, opowiada przebieg pracy
- "stat1" + "stat1Label": pierwsza mierzalna liczba i co oznacza (np. "24 tyg" / "Od urazu do gry")
- "stat2" + "stat2Label": druga (np. "-12 kg" / "W 6 miesięcy")
- "stat3" + "stat3Label": trzecia (np. "3×/tydz" / "Częstotliwość treningów")

Zwróć JSON dokładnie w tym kształcie:
{
  "h2": "<tytuł sekcji>",
  "sub": "<jednoczdaniowy podtytuł>",
  "count": <liczba 1-5>,
  "variants": [
    {
      "set": [
        { "tag": "...", "title": "...", "body": "...", "stat1": "...", "stat1Label": "...", "stat2": "...", "stat2Label": "...", "stat3": "...", "stat3Label": "..." }
      ]
    },
    { "set": [ ...drugi wariant... ] },
    { "set": [ ...trzeci wariant... ] }
  ]
}`;

  const result = await callQwen<CaseSetResponse>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.9,
  });

  if ("error" in result) return result;
  if (!Array.isArray(result.variants) || result.variants.length !== 3) {
    return { error: "AI zwrócił nieprawidłową liczbę wariantów" };
  }
  if (typeof result.h2 !== "string" || !result.h2.trim()) {
    return { error: "AI nie zwrócił tytułu sekcji" };
  }
  if (typeof result.sub !== "string") {
    return { error: "AI nie zwrócił podtytułu sekcji" };
  }

  const firstLen = result.variants[0]?.set?.length ?? 0;
  if (firstLen < 1 || firstLen > 5) {
    return {
      error: `AI zwrócił zestaw ${firstLen} kejsów — oczekiwano 1-5. Spróbuj ponownie.`,
    };
  }
  for (const v of result.variants) {
    if (!Array.isArray(v.set) || v.set.length !== firstLen) {
      return { error: "AI zwrócił warianty o różnej liczbie kejsów. Spróbuj ponownie." };
    }
    for (const c of v.set) {
      // Soft validation — coerce missing fields to empty strings rather
      // than reject the whole batch, since stat fields are sometimes
      // dropped by the model on busy generations.
      c.tag = String(c.tag ?? "").trim();
      c.title = String(c.title ?? "").trim();
      c.body = String(c.body ?? "").trim();
      c.stat1 = String(c.stat1 ?? "").trim();
      c.stat1Label = String(c.stat1Label ?? "").trim();
      c.stat2 = String(c.stat2 ?? "").trim();
      c.stat2Label = String(c.stat2Label ?? "").trim();
      c.stat3 = String(c.stat3 ?? "").trim();
      c.stat3Label = String(c.stat3Label ?? "").trim();
      if (!c.title) {
        return { error: "AI zwrócił kejs bez tytułu. Spróbuj ponownie." };
      }
    }
  }

  return {
    h2: result.h2.trim(),
    sub: result.sub.trim(),
    variants: result.variants,
  };
}

// ===== Per-item case rewrite (single case → 3 variants) =====

/**
 * Per-item case rewrite. Mirrors `generateServiceVariants` /
 * `generatePackageVariants` — takes one case in studioCopy.cases by id, asks
 * the model for 3 alternative phrasings of just that case (same 9 fields),
 * and returns the variants for the trainer to preview + apply.
 *
 * Cases live in customization.studioCopy.cases, so this reads the JSONB row
 * straight from `loadCustomization` instead of going to a side-effect table.
 */
export async function generateCaseVariants(
  caseId: string,
  changeRequest: string,
): Promise<{ variants: CaseSetItem[] } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const ctx = await loadCustomization();
  if ("error" in ctx) return ctx;

  const studioCopy = ctx.customization.studioCopy ?? {};
  const cases = studioCopy.cases ?? [];
  const target = cases.find((c) => c.id === caseId);
  if (!target) return { error: "Kejs nie został znaleziony" };

  const context = await loadTrainerContextString(user.id);

  const userPrompt = `${context}

=== ZADANIE ===
KONKRETNY KEJS DO PRZEPISANIA:
- Tag: ${target.tag ?? "(pusty)"}
- Tytuł: ${target.title ?? "(pusty)"}
- Opis: ${target.body ?? "(pusty)"}
- Stat 1: ${target.stat1 ?? "(pusty)"} (${target.stat1Label ?? ""})
- Stat 2: ${target.stat2 ?? "(pusty)"} (${target.stat2Label ?? ""})
- Stat 3: ${target.stat3 ?? "(pusty)"} (${target.stat3Label ?? ""})

PROŚBA TRENERA: ${changeRequest.trim() || "Przepisz ten kejs bardziej atrakcyjnie i konkretnie. Zachowaj sens i kategorię (tag), popraw styl tytułu i opisu, statystyki mogą zostać lub być przeformułowane. Dopasuj do reszty profilu."}

Wygeneruj DOKŁADNIE 3 warianty, każdy z innym akcentem (np. wariant 1 — silniej emocjonalny, wariant 2 — bardziej liczbowy, wariant 3 — bardziej narracyjny). Niezależnie od języka prośby, treści ZAWSZE PISZ PO POLSKU.

NIE WYMYŚLAJ konkretnego imienia klienta — używaj inicjałów ("Klient P., 42 lata") lub anonimowych etykiet ("Manager IT, 38 lat").

Każdy wariant musi mieć WSZYSTKIE 9 pól (żadne nie może być puste):
- "tag": 1-3 słowa
- "title": 1 zdanie z konkretem przed→po
- "body": 2-3 zdania, max 300 znaków
- "stat1" + "stat1Label", "stat2" + "stat2Label", "stat3" + "stat3Label"

Zwróć JSON dokładnie w tym kształcie:
{
  "variants": [
    { "tag": "...", "title": "...", "body": "...", "stat1": "...", "stat1Label": "...", "stat2": "...", "stat2Label": "...", "stat3": "...", "stat3Label": "..." },
    { ...drugi wariant... },
    { ...trzeci wariant... }
  ]
}`;

  const result = await callQwen<{ variants: CaseSetItem[] }>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.85,
  });

  if ("error" in result) return result;
  if (!Array.isArray(result.variants) || result.variants.length !== 3) {
    return { error: "AI zwrócił nieprawidłową liczbę wariantów" };
  }
  for (const v of result.variants) {
    v.tag = String(v.tag ?? "").trim();
    v.title = String(v.title ?? "").trim();
    v.body = String(v.body ?? "").trim();
    v.stat1 = String(v.stat1 ?? "").trim();
    v.stat1Label = String(v.stat1Label ?? "").trim();
    v.stat2 = String(v.stat2 ?? "").trim();
    v.stat2Label = String(v.stat2Label ?? "").trim();
    v.stat3 = String(v.stat3 ?? "").trim();
    v.stat3Label = String(v.stat3Label ?? "").trim();
    if (!v.title) return { error: "AI zwrócił wariant bez tytułu" };
  }

  return { variants: result.variants };
}

/**
 * Apply a single case variant — patches that specific case in
 * studioCopy.cases while leaving siblings untouched. Goes through
 * saveCustomization so the change shows up in _history for Cofnij.
 */
export async function applyCaseVariant(
  caseId: string,
  variant: CaseSetItem,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization();
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const cases = [...(studioCopy.cases ?? [])];
  const idx = cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return { error: "Kejs nie istnieje" };

  cases[idx] = {
    ...cases[idx]!,
    tag: variant.tag.slice(0, 60) || undefined,
    title: variant.title.slice(0, 200),
    body: variant.body.slice(0, 600),
    stat1: variant.stat1.slice(0, 40) || undefined,
    stat1Label: variant.stat1Label.slice(0, 60) || undefined,
    stat2: variant.stat2.slice(0, 40) || undefined,
    stat2Label: variant.stat2Label.slice(0, 60) || undefined,
    stat3: variant.stat3.slice(0, 40) || undefined,
    stat3Label: variant.stat3Label.slice(0, 60) || undefined,
  };
  studioCopy.cases = cases;

  const next: ProfileCustomization = { ...ctx.customization, studioCopy };
  return saveCustomization(ctx.userId, ctx.customization, next);
}

// ===== Apply: append vs replace =====
// Both write directly to customization.studioCopy via loadCustomization +
// saveCustomization, which keeps the existing snapshot/undo trail in
// _history alive. The AI's chosen H2/Sub go through writeSectionCopy on
// the active template (so Cinematic writes to cinematicCopy.casesH2 etc.).

function caseItemsToStudioCases(set: CaseSetItem[]): StudioCaseStudy[] {
  return set.map((c) => ({
    id: randomUUID(),
    tag: c.tag.slice(0, 60) || undefined,
    title: c.title.slice(0, 200),
    body: c.body.slice(0, 600),
    stat1: c.stat1.slice(0, 40) || undefined,
    stat1Label: c.stat1Label.slice(0, 60) || undefined,
    stat2: c.stat2.slice(0, 40) || undefined,
    stat2Label: c.stat2Label.slice(0, 60) || undefined,
    stat3: c.stat3.slice(0, 40) || undefined,
    stat3Label: c.stat3Label.slice(0, 60) || undefined,
  }));
}

export async function applyCaseSet(
  set: CaseSetItem[],
  h2?: string,
  sub?: string,
  template: TemplateName = "premium",
): Promise<{ ok: true; inserted: number } | { error: string }> {
  if (!Array.isArray(set) || set.length === 0) {
    return { error: "Pusty zestaw kejsów" };
  }

  if (typeof h2 === "string" && h2.trim()) {
    const r = await writeSectionCopy(template, "casesH2", h2.trim());
    if ("error" in r) return r;
  }
  if (typeof sub === "string") {
    const r = await writeSectionCopy(template, "casesSub", sub.trim());
    if ("error" in r) return r;
  }

  const ctx = await loadCustomization();
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const existing = [...(studioCopy.cases ?? [])];
  const additions = caseItemsToStudioCases(set);
  studioCopy.cases = [...existing, ...additions];

  const next: ProfileCustomization = { ...ctx.customization, studioCopy };
  const res = await saveCustomization(ctx.userId, ctx.customization, next);
  if ("error" in res) return res;
  return { ok: true, inserted: additions.length };
}

export async function applyCaseSetReplace(
  set: CaseSetItem[],
  h2?: string,
  sub?: string,
  template: TemplateName = "premium",
): Promise<{ ok: true; removed: number; added: number } | { error: string }> {
  if (!Array.isArray(set) || set.length === 0) {
    return { error: "Pusty zestaw kejsów" };
  }

  if (typeof h2 === "string" && h2.trim()) {
    const r = await writeSectionCopy(template, "casesH2", h2.trim());
    if ("error" in r) return r;
  }
  if (typeof sub === "string") {
    const r = await writeSectionCopy(template, "casesSub", sub.trim());
    if ("error" in r) return r;
  }

  const ctx = await loadCustomization();
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const removedCount = (studioCopy.cases ?? []).length;
  studioCopy.cases = caseItemsToStudioCases(set);

  const next: ProfileCustomization = { ...ctx.customization, studioCopy };
  const res = await saveCustomization(ctx.userId, ctx.customization, next);
  if ("error" in res) return res;
  return { ok: true, removed: removedCount, added: studioCopy.cases.length };
}
