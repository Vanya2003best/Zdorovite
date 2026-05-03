/**
 * One-shot: promote an existing auth user to a fully-set-up trainer.
 *
 * Use case: you registered (so auth.users + profiles exist) but the
 * trainers row was never created (e.g. you stopped at the email-confirm
 * step of /register/trainer, or registered through OAuth which skips the
 * trainer onboarding entirely). Running this:
 *   - flips profiles.role = 'trainer'
 *   - upserts a trainers row with minimal sensible defaults
 *   - inserts default Mon-Fri 9-18 availability
 *   - adds one specialization so the catalog filter doesn't hide you
 *   - calls seed_trainer_placeholders so the new profile is non-empty
 *
 * Idempotent — safe to re-run; ON CONFLICT clauses keep existing data.
 *
 * Run:  npx tsx scripts/promote-to-trainer.ts <email>
 *   e.g. npx tsx scripts/promote-to-trainer.ts ivan@example.com
 *
 * Optional flags via env (override defaults):
 *   TRAINER_SLUG=ivan-zhigalin
 *   TRAINER_TAGLINE="Trener personalny"
 *   TRAINER_LOCATION="Wrocław"
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (tsx doesn't auto-load).
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

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npx tsx scripts/promote-to-trainer.ts <email>");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || "trener";
  let n = 1;
  // Loop until we find a free slug. Bounded at 50 attempts so a corrupt
  // table can't hang the script.
  for (let i = 0; i < 50; i++) {
    const { data } = await admin.from("trainers").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`.slice(0, 40);
  }
  throw new Error("Could not find a free slug after 50 attempts");
}

async function main() {
  // 1. Find auth user by email
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("Failed to list users:", listErr.message);
    process.exit(1);
  }
  const user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.error(`No auth user found with email ${email}`);
    process.exit(1);
  }
  console.log(`Found auth user: ${user.id}`);

  // 2. Read profile (must already exist via handle_new_user trigger)
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name || email.split("@")[0] || "Trener";

  // 3. Flip profile role
  const { error: profErr } = await admin
    .from("profiles")
    .update({ role: "trainer", display_name: displayName })
    .eq("id", user.id);
  if (profErr) {
    console.error("Failed to update profile role:", profErr.message);
    process.exit(1);
  }
  console.log("✓ profiles.role = 'trainer'");

  // 4. Upsert trainers row. Existing row → preserved (ON CONFLICT id DO NOTHING
  //    semantics via upsert without ignoreDuplicates would still update; we
  //    want minimal disruption, so check first.
  const { data: existing } = await admin
    .from("trainers")
    .select("id, slug")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    console.log(`✓ trainers row already exists (slug: ${existing.slug}) — leaving as-is`);
  } else {
    const slugBase = process.env.TRAINER_SLUG?.trim() || slugify(displayName);
    const slug = await uniqueSlug(slugBase);
    const tagline = process.env.TRAINER_TAGLINE?.trim() || "Trener personalny";
    const location = process.env.TRAINER_LOCATION?.trim() || "Wrocław";

    const { error: tErr } = await admin.from("trainers").insert({
      id: user.id,
      slug,
      tagline,
      about: "",
      experience: 0,
      price_from: 100,
      location,
      languages: ["Polski"],
      published: false,
    });
    if (tErr) {
      console.error("Failed to insert trainer row:", tErr.message);
      process.exit(1);
    }
    console.log(`✓ trainers row inserted (slug: ${slug})`);
  }

  // 5. Default availability — only if none yet
  const { data: avail } = await admin
    .from("availability_rules")
    .select("id")
    .eq("trainer_id", user.id)
    .limit(1);
  if (!avail || avail.length === 0) {
    const { error: aErr } = await admin.from("availability_rules").insert(
      [1, 2, 3, 4, 5].map((dow) => ({
        trainer_id: user.id,
        day_of_week: dow,
        start_time: "09:00",
        end_time: "18:00",
      })),
    );
    if (aErr) console.warn("⚠ availability insert failed:", aErr.message);
    else console.log("✓ availability_rules inserted (Mon-Fri 9-18)");
  } else {
    console.log("✓ availability_rules already present — leaving as-is");
  }

  // 6. At least one specialization (so the catalog filter doesn't hide you)
  const { data: specs } = await admin
    .from("trainer_specializations")
    .select("specialization_id")
    .eq("trainer_id", user.id)
    .limit(1);
  if (!specs || specs.length === 0) {
    // Use a known canonical id from src/data/specializations.ts. "silownia"
    // is the gym/strength one and is broadly applicable.
    const { error: sErr } = await admin
      .from("trainer_specializations")
      .insert({ trainer_id: user.id, specialization_id: "silownia" });
    if (sErr) console.warn("⚠ specialization insert failed:", sErr.message);
    else console.log("✓ specialization 'silownia' added");
  } else {
    console.log("✓ trainer_specializations already populated — leaving as-is");
  }

  // 7. Seed placeholders (services / packages / gallery / certs).
  //    Function is no-op when those tables already have data for this trainer.
  const { error: rpcErr } = await admin.rpc("seed_trainer_placeholders", {
    trainer_id_arg: user.id,
  });
  if (rpcErr) console.warn("⚠ seed_trainer_placeholders failed:", rpcErr.message);
  else console.log("✓ seed_trainer_placeholders ran");

  console.log("\n✅ Done. Refresh /studio/profile — your account is a trainer now.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
