import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificationsEditor from "./CertificationsEditor";
import AvatarTile from "./AvatarTile";
import AiContextForm from "./AiContextForm";
import type { AiContext } from "./ai-context-actions";
import type { Certification } from "@/types";

/**
 * Moje konto — trainer's account-level page. Strictly the things that DON'T
 * belong on the public profile and aren't editable from /studio/design:
 *   - identity preview (name + email — read-only)
 *   - certifications + verification (with PDF/URL upload)
 *   - settings (publish toggle, links to design + availability)
 *
 * Everything visible on the public profile (tagline, about, location, languages,
 * specializations, services, packages, gallery, cover, avatar, price, experience)
 * lives in /studio/design — the visual editor with live preview. Edits propagate
 * to whichever template is active because services/packages/etc. are shared
 * trainer-data tables.
 */
export default async function StudioProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/profile");

  // Try with avatar_focal (migration 020); fall back gracefully on 42703.
  let profile: { display_name: string | null; avatar_url: string | null; avatar_focal?: string | null } | null = null;
  const profileFull = await supabase
    .from("profiles")
    .select("display_name, avatar_url, avatar_focal")
    .eq("id", user.id)
    .single();
  if (profileFull.error?.code === "42703") {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data ? { ...data, avatar_focal: null } : null;
  } else {
    profile = profileFull.data;
  }

  // Try with ai_context first (migration 019); if the column doesn't exist
  // yet (42703) fall back to just `slug` so the page still loads. The
  // AiContextForm below tolerates `ai_context: null` and falls through to
  // empty-field defaults — the page is functional even without the migration.
  let trainer: { slug: string; ai_context?: Record<string, unknown> | null } | null = null;
  const trainerFull = await supabase
    .from("trainers")
    .select("slug, ai_context")
    .eq("id", user.id)
    .maybeSingle();
  if (trainerFull.error?.code === "42703") {
    const { data } = await supabase
      .from("trainers")
      .select("slug")
      .eq("id", user.id)
      .maybeSingle();
    trainer = data ? { slug: data.slug, ai_context: null } : null;
  } else {
    trainer = trainerFull.data;
  }

  if (!trainer) {
    // Logged-in user without a trainers row — the trainer-onboarding flow
    // for an existing account is /account/become-trainer (just fills in the
    // trainer-only fields), NOT /register/trainer (which creates a brand
    // new auth user). Sending an authenticated user to the latter just
    // confuses them — they'd be asked to enter email + password again.
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10">
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
          <p className="text-slate-500">Najpierw dokończ rejestrację jako trener.</p>
          <Link
            href="/account/become-trainer"
            className="inline-flex mt-4 h-10 items-center px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
          >
            Stań się trenerem →
          </Link>
        </div>
      </div>
    );
  }

  // certifications — try the full SELECT (new columns from migration 014).
  // On code 42703 (undefined column = migration not yet applied), retry with
  // just the original columns so the page still renders. The Editor UI then
  // only shows text + delete; URL/file controls write to columns that don't
  // exist yet so they'll error on the user's first save attempt — that's
  // their cue to apply the migration.
  let certs: Certification[] = [];
  const certsFull = await supabase
    .from("certifications")
    .select("id, text, verification_url, attachment_url, attachment_filename, position")
    .eq("trainer_id", user.id)
    .order("position", { ascending: true });
  if (certsFull.error?.code === "42703") {
    const certsLegacy = await supabase
      .from("certifications")
      .select("id, text, position")
      .eq("trainer_id", user.id)
      .order("position", { ascending: true });
    certs = (certsLegacy.data ?? []).map((c: { id: string; text: string; }) => ({
      id: c.id,
      text: c.text,
    }));
  } else if (certsFull.data) {
    certs = certsFull.data.map((c: { id: string; text: string; verification_url: string | null; attachment_url: string | null; attachment_filename: string | null; }) => ({
      id: c.id,
      text: c.text,
      verificationUrl: c.verification_url ?? undefined,
      attachmentUrl: c.attachment_url ?? undefined,
      attachmentFilename: c.attachment_filename ?? undefined,
    }));
  }

  const aiContext = (trainer.ai_context ?? {}) as AiContext;

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10 grid gap-5">
      {/* Page header is intentionally absent — the studio top-bar already
          shows "Moje konto · Dane, certyfikaty, ustawienia" via StudioPageTitle,
          so a duplicate <h1> here just stretches the page. The link to the
          design editor is moved into the Settings card at the bottom. */}

      {/* AI context — fill once, reused by every AI generator on
          /studio/design (about/services/packages). Sits at the top of the
          page so a freshly-onboarded trainer sees it first. */}
      <AiContextForm initial={aiContext} />

      {/* Identity — avatar is account-level (lives in profiles.avatar_url, not
          trainers row), so it's editable here rather than in /studio/design.
          Click the avatar tile (or the pencil overlay) to upload. */}
      <Card>
        <div className="flex items-center gap-4">
          <AvatarTile
            currentUrl={profile?.avatar_url ?? null}
            currentFocal={profile?.avatar_focal ?? null}
          />
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight truncate">
              {profile?.display_name ?? "Bez nazwy"}
            </div>
            <div className="text-[13px] text-slate-500 truncate">{user.email}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              JPG / PNG / WebP, max 5 MB · przeciągnij zdjęcie aby dopasować kadr
            </div>
          </div>
        </div>
      </Card>

      {/* Certifications — the only piece of content edited here, with verification */}
      <Card>
        <CardHeader
          title="Certyfikaty i dyplomy"
          hint={`${certs.length} ${certs.length === 1 ? "certyfikat" : "certyfikatów"}`}
        />
        <p className="text-[12px] text-slate-500 mt-1 mb-4 leading-[1.55] max-w-[640px]">
          Dodaj swoje certyfikaty z linkiem do publicznego rejestru wystawcy (np. EREPS, AWF) lub załącz skan dyplomu.
          Na publicznej stronie obok każdego certyfikatu pojawi się badge weryfikacji, który klient może kliknąć.
        </p>
        <CertificationsEditor certs={certs} />
      </Card>

      {/* Settings — links to other studio surfaces */}
      <Card>
        <CardHeader title="Ustawienia" />
        <div className="grid gap-3 mt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <strong className="text-[14px] text-slate-900">Adres profilu</strong>
              <p className="text-[12px] text-slate-500 mt-0.5">
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">nazdrow.pl/trainers/{trainer.slug}</code>
              </p>
            </div>
            <Link
              href="/account/become-trainer"
              className="text-[13px] text-emerald-700 hover:underline font-medium"
            >
              Zmień slug →
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              <strong className="text-[14px] text-slate-900">Profil publiczny</strong>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Szablon, kolory, treść (o mnie, usługi, pakiety, galeria)
              </p>
            </div>
            <Link href="/studio/design" className="text-[13px] text-emerald-700 hover:underline font-medium">
              Otwórz edytor →
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              <strong className="text-[14px] text-slate-900">Godziny pracy</strong>
              <p className="text-[12px] text-slate-500 mt-0.5">Kiedy klienci mogą rezerwować sesje</p>
            </div>
            <Link href="/studio/availability" className="text-[13px] text-emerald-700 hover:underline font-medium">
              Otwórz edytor →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      {children}
    </section>
  );
}

function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
      {hint && <span className="text-[12px] text-slate-500">{hint}</span>}
    </div>
  );
}
