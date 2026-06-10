"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SubmitClubInput = {
  chainId?: string;
  newChainName?: string;
  newChainWebsite?: string;
  newChainColor?: string;
  branchName: string;
  city: string;
  address: string;
  recruitingOpen: boolean;
  recruitingMessage?: string;
  contactEmail: string;
  contactPhone: string;
  nip?: string;
};

export type SubmitClubResult =
  | {
      ok: true;
      data: { chainSlug: string; branchSlug: string };
      chainSlug: string;
      branchSlug: string;
    }
  | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{7,20}$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, message: string): string | { error: string } {
  if (typeof value !== "string") return { error: message };
  return value.trim();
}

function optionalString(value: unknown, fieldName: string): string | undefined | { error: string } {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return { error: `Nieprawidłowe pole: ${fieldName}.` };
  return value;
}

export async function submitClub(
  input: SubmitClubInput,
): Promise<SubmitClubResult> {
  try {
    if (!isObject(input)) return { error: "Nieprawidłowe dane klubu." };

    const branchName = requiredString(input.branchName, "Podaj nazwę klubu.");
    if (typeof branchName !== "string") return branchName;
    const city = requiredString(input.city, "Podaj miasto.");
    if (typeof city !== "string") return city;
    const address = requiredString(input.address, "Podaj adres.");
    if (typeof address !== "string") return address;
    const contactEmailRaw = requiredString(input.contactEmail, "Podaj email kontaktowy.");
    if (typeof contactEmailRaw !== "string") return contactEmailRaw;
    const contactPhone = requiredString(input.contactPhone, "Podaj telefon kontaktowy.");
    if (typeof contactPhone !== "string") return contactPhone;
    if (typeof input.recruitingOpen !== "boolean") return { error: "Nieprawidłowy status rekrutacji." };

    const chainIdRaw = optionalString(input.chainId, "sieć");
    if (typeof chainIdRaw !== "string" && chainIdRaw !== undefined) return chainIdRaw;
    const newChainNameRaw = optionalString(input.newChainName, "nazwa sieci");
    if (typeof newChainNameRaw !== "string" && newChainNameRaw !== undefined) return newChainNameRaw;
    const newChainWebsiteRaw = optionalString(input.newChainWebsite, "strona sieci");
    if (typeof newChainWebsiteRaw !== "string" && newChainWebsiteRaw !== undefined) return newChainWebsiteRaw;
    const newChainColorRaw = optionalString(input.newChainColor, "kolor sieci");
    if (typeof newChainColorRaw !== "string" && newChainColorRaw !== undefined) return newChainColorRaw;
    const recruitingMessageRaw = optionalString(input.recruitingMessage, "wiadomość rekrutacyjna");
    if (typeof recruitingMessageRaw !== "string" && recruitingMessageRaw !== undefined) return recruitingMessageRaw;
    const nipRaw = optionalString(input.nip, "NIP");
    if (typeof nipRaw !== "string" && nipRaw !== undefined) return nipRaw;

    const contactEmail = contactEmailRaw.trim().toLowerCase();
    const chainIdInput = chainIdRaw?.trim() || undefined;
    const newChainName = newChainNameRaw?.trim() || undefined;

    if (!branchName) return { error: "Podaj nazwę klubu." };
    if (branchName.length > 80) return { error: "Nazwa klubu max 80 znaków." };
    if (!city) return { error: "Podaj miasto." };
    if (!address) return { error: "Podaj adres." };
    if (!EMAIL_RE.test(contactEmail)) return { error: "Nieprawidłowy email kontaktowy." };
    if (!PHONE_RE.test(contactPhone)) return { error: "Nieprawidłowy telefon kontaktowy." };
    if (!chainIdInput && !newChainName) {
      return { error: "Wybierz sieć lub podaj nazwę nowej." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Musisz być zalogowany aby zgłosić klub." };

    let chainId = chainIdInput;
    let chainSlug: string;

    if (chainId) {
      const { data: chainRow, error: chainReadErr } = await supabase
        .from("gym_chains")
        .select("id, slug, status")
        .eq("id", chainId)
        .single();
      if (chainReadErr) return { error: chainReadErr.message };
      if (!chainRow) return { error: "Wybrana sieć nie istnieje." };
      chainSlug = chainRow.slug;
      chainId = chainRow.id;
    } else {
      if (!newChainName) return { error: "Podaj nazwę nowej sieci." };
      if (newChainName.length > 60) return { error: "Nazwa sieci max 60 znaków." };
      let slug = slugify(newChainName);
      if (slug.length < 2) return { error: "Niepoprawna nazwa sieci (min. 2 znaki alfanumeryczne)." };

      for (let n = 0; n < 50; n++) {
        const candidate = n === 0 ? slug : `${slug}-${n + 1}`;
        const { data: existing, error: existingErr } = await supabase
          .from("gym_chains")
          .select("id")
          .eq("slug", candidate)
          .maybeSingle();
        if (existingErr) return { error: existingErr.message };
        if (!existing) {
          slug = candidate;
          break;
        }
      }

      const { data: inserted, error: chainErr } = await supabase
        .from("gym_chains")
        .insert({
          name: newChainName,
          slug,
          status: "pending",
          brand_color: newChainColorRaw?.trim() || null,
          website: newChainWebsiteRaw?.trim() || null,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          nip: nipRaw?.trim() || null,
          registered_by: user.id,
          registered_at: new Date().toISOString(),
        })
        .select("id, slug")
        .single();
      if (chainErr || !inserted) {
        return { error: chainErr?.message ?? "Nie udało się dodać sieci." };
      }
      chainId = inserted.id;
      chainSlug = inserted.slug;
    }

    let branchSlug = slugify(`${city}-${branchName}`);
    if (branchSlug.length < 2) branchSlug = "klub-" + Date.now().toString(36);
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? branchSlug : `${branchSlug}-${n + 1}`;
      const { data: existing, error: existingErr } = await supabase
        .from("gym_branches")
        .select("id")
        .eq("chain_id", chainId)
        .eq("slug", candidate)
        .maybeSingle();
      if (existingErr) return { error: existingErr.message };
      if (!existing) {
        branchSlug = candidate;
        break;
      }
    }

    const { error: branchErr } = await supabase.from("gym_branches").insert({
      chain_id: chainId,
      name: branchName,
      slug: branchSlug,
      city,
      address,
      recruiting_open: input.recruitingOpen,
      recruiting_message: recruitingMessageRaw?.trim() || null,
      status: "pending",
      contact_email: contactEmail,
      contact_phone: contactPhone,
      registered_by: user.id,
      registered_at: new Date().toISOString(),
    });
    if (branchErr) return { error: branchErr.message };

    revalidatePath("/sieci");
    revalidatePath(`/sieci/${chainSlug}`);

    return {
      ok: true,
      data: { chainSlug, branchSlug },
      chainSlug,
      branchSlug,
    };
  } catch (err) {
    console.error("submitClub", err);
    return { error: DEFAULT_ERROR };
  }
}
