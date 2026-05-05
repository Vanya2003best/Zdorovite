"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SubmitClubInput = {
  // Chain fields. If chainId is set, we attach to the existing chain; if it's
  // empty AND newChainName is set, we register a new chain too.
  chainId?: string;
  newChainName?: string;
  newChainWebsite?: string;
  newChainColor?: string;
  // Branch fields.
  branchName: string;
  city: string;
  address: string;
  recruitingOpen: boolean;
  recruitingMessage?: string;
  // Contact (required — verification calls this).
  contactEmail: string;
  contactPhone: string;
  nip?: string;
};

export type SubmitClubResult =
  | { ok: true; chainSlug: string; branchSlug: string }
  | { error: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{7,20}$/;

export async function submitClub(
  input: SubmitClubInput,
): Promise<SubmitClubResult> {
  // Validation — everything explicit so the form can surface the right field.
  const branchName = input.branchName.trim();
  const city = input.city.trim();
  const address = input.address.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  const contactPhone = input.contactPhone.trim();

  if (!branchName) return { error: "Podaj nazwę klubu." };
  if (branchName.length > 80) return { error: "Nazwa klubu max 80 znaków." };
  if (!city) return { error: "Podaj miasto." };
  if (!address) return { error: "Podaj adres." };
  if (!EMAIL_RE.test(contactEmail)) return { error: "Nieprawidłowy email kontaktowy." };
  if (!PHONE_RE.test(contactPhone)) return { error: "Nieprawidłowy telefon kontaktowy." };
  if (!input.chainId && !input.newChainName?.trim()) {
    return { error: "Wybierz sieć lub podaj nazwę nowej." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany aby zgłosić klub." };

  // 1. Resolve chain — either reuse existing or insert new.
  let chainId = input.chainId;
  let chainSlug: string;

  if (chainId) {
    const { data: chainRow } = await supabase
      .from("gym_chains")
      .select("id, slug, status")
      .eq("id", chainId)
      .single();
    if (!chainRow) return { error: "Wybrana sieć nie istnieje." };
    chainSlug = chainRow.slug;
    chainId = chainRow.id;
  } else {
    const newName = input.newChainName!.trim();
    if (newName.length > 60) return { error: "Nazwa sieci max 60 znaków." };
    let slug = slugify(newName);
    if (slug.length < 2) return { error: "Niepoprawna nazwa sieci (min. 2 znaki alfanumeryczne)." };

    // Slug uniqueness — auto-suffix if collision.
    for (let n = 0; n < 50; n++) {
      const { data: existing } = await supabase
        .from("gym_chains")
        .select("id")
        .eq("slug", n === 0 ? slug : `${slug}-${n + 1}`)
        .maybeSingle();
      if (!existing) {
        if (n > 0) slug = `${slug}-${n + 1}`;
        break;
      }
    }

    const { data: inserted, error: chainErr } = await supabase
      .from("gym_chains")
      .insert({
        name: newName,
        slug,
        status: "pending",
        brand_color: input.newChainColor?.trim() || null,
        website: input.newChainWebsite?.trim() || null,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        nip: input.nip?.trim() || null,
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

  // 2. Insert branch — slug auto-built from city + name.
  let branchSlug = slugify(`${city}-${branchName}`);
  if (branchSlug.length < 2) branchSlug = "klub-" + Date.now().toString(36);
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? branchSlug : `${branchSlug}-${n + 1}`;
    const { data: existing } = await supabase
      .from("gym_branches")
      .select("id")
      .eq("chain_id", chainId)
      .eq("slug", candidate)
      .maybeSingle();
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
    recruiting_open: !!input.recruitingOpen,
    recruiting_message: input.recruitingMessage?.trim() || null,
    status: "pending",
    contact_email: contactEmail,
    contact_phone: contactPhone,
    registered_by: user.id,
    registered_at: new Date().toISOString(),
  });
  if (branchErr) return { error: branchErr.message };

  revalidatePath("/sieci");
  revalidatePath(`/sieci/${chainSlug}`);
  // TODO: send email to NaZdrow! admin (founder@nazdrow.pl) via Resend with
  // chain+branch+contact details. Wired in next iteration once email
  // provider is configured.

  return { ok: true, chainSlug, branchSlug };
}
