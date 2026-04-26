/**
 * Seed script: imports mock trainers into Supabase.
 * Idempotent — safe to re-run. Creates demo auth.users for each trainer and each review author.
 *
 * Run:  npx tsx scripts/seed-trainers.ts
 */

import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { trainers } from "../src/data/mock-trainers";
import { specializations } from "../src/data/specializations";

// -------- Load .env.local manually (tsx doesn't auto-load it) --------
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "DemoPass_2026!";

// ------------------------- helpers --------------------------

/** Create auth.user if missing, return uuid. Uses admin API. */
async function ensureUser(
  email: string,
  displayName: string,
  avatarUrl?: string,
): Promise<string> {
  // Try to find existing user
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName, avatar_url: avatarUrl },
  });
  if (error) throw error;
  return data.user.id;
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ------------------------- main ----------------------------

async function main() {
  console.log(`Seeding ${trainers.length} trainers into ${SUPABASE_URL}...`);

  // Safety check: verify specializations seed matches DB
  const { count: specCount } = await admin
    .from("specializations")
    .select("*", { count: "exact", head: true });
  if ((specCount ?? 0) !== specializations.length) {
    console.warn(`Specializations in DB (${specCount}) != local (${specializations.length}). Run migration first?`);
  }

  // Cache: review author name -> auth user id
  const clientCache = new Map<string, string>();

  for (const t of trainers) {
    console.log(`\n→ ${t.name} (${t.id})`);

    // 1. Ensure auth user for trainer
    const trainerEmail = `demo-trainer+${t.id}@nazdrow.local`;
    const trainerId = await ensureUser(trainerEmail, t.name, t.avatar);
    console.log(`   auth user: ${trainerId}`);

    // 2. Update profile (trigger already created the row)
    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        display_name: t.name,
        avatar_url: t.avatar,
        is_trainer: true,
      })
      .eq("id", trainerId);
    if (profileErr) throw profileErr;

    // 3. Upsert trainer row
    const { error: trainerErr } = await admin.from("trainers").upsert(
      {
        id: trainerId,
        slug: t.id,
        tagline: t.tagline,
        about: t.about,
        experience: t.experience,
        price_from: t.priceFrom,
        location: t.location,
        languages: t.languages,
        cover_image: null,
        customization: t.customization,
        published: true,
      },
      { onConflict: "id" },
    );
    if (trainerErr) throw trainerErr;

    // 4. Clean + insert trainer_specializations
    await admin.from("trainer_specializations").delete().eq("trainer_id", trainerId);
    const { error: specErr } = await admin.from("trainer_specializations").insert(
      t.specializations.map((s) => ({ trainer_id: trainerId, specialization_id: s })),
    );
    if (specErr) throw specErr;

    // 5. Replace services
    await admin.from("services").delete().eq("trainer_id", trainerId);
    const { error: svcErr } = await admin.from("services").insert(
      t.services.map((s, i) => ({
        trainer_id: trainerId,
        name: s.name,
        description: s.description,
        duration: s.duration,
        price: s.price,
        position: i,
      })),
    );
    if (svcErr) throw svcErr;

    // 6. Replace packages
    await admin.from("packages").delete().eq("trainer_id", trainerId);
    const { error: pkgErr } = await admin.from("packages").insert(
      t.packages.map((p, i) => ({
        trainer_id: trainerId,
        name: p.name,
        description: p.description,
        items: p.items,
        price: p.price,
        period: p.period ?? null,
        featured: p.featured ?? false,
        position: i,
      })),
    );
    if (pkgErr) throw pkgErr;

    // 7. Replace certifications
    await admin.from("certifications").delete().eq("trainer_id", trainerId);
    const { error: certErr } = await admin.from("certifications").insert(
      t.certifications.map((c, i) => ({
        trainer_id: trainerId,
        text: c,
        position: i,
      })),
    );
    if (certErr) throw certErr;

    // 8. Gallery photos (none in mock data — skip)

    // 9. Replace reviews (needs author profiles)
    await admin.from("reviews").delete().eq("trainer_id", trainerId);
    for (const r of t.reviews) {
      let authorId = clientCache.get(r.authorName);
      if (!authorId) {
        const authorSlug = slugifyName(r.authorName);
        const authorEmail = `demo-client+${authorSlug}@nazdrow.local`;
        authorId = await ensureUser(authorEmail, r.authorName);
        clientCache.set(r.authorName, authorId);
      }
      const { error: revErr } = await admin.from("reviews").insert({
        trainer_id: trainerId,
        author_id: authorId,
        rating: r.rating,
        text: r.text,
        created_at: `${r.date}T12:00:00Z`,
      });
      if (revErr) throw revErr;
    }

    console.log(`   ✓ ${t.services.length} services, ${t.packages.length} packages, ${t.reviews.length} reviews`);
  }

  console.log(`\n✅ Seed complete. Demo users created (password: ${DEMO_PASSWORD}).`);
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e);
  process.exit(1);
});
