/**
 * Wipe `customization.cinematicCopy.testimonials` from a trainer's primary
 * customization (and any trainer_pages rows). Use when seeded demo
 * testimonials are inflating the public review count past the real number
 * of DB reviews.
 *
 * Run:
 *   npx tsx scripts/clear-cinematic-testimonials.ts            # ivan-zhigalin
 *   npx tsx scripts/clear-cinematic-testimonials.ts <slug>
 */

import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const TRAINER_SLUG = process.argv[2] ?? "ivan-zhigalin";

type Customization = {
  cinematicCopy?: { testimonials?: unknown[]; [k: string]: unknown };
  [k: string]: unknown;
};

function strip(c: Customization | null | undefined): { next: Customization; removed: number } {
  const before = c?.cinematicCopy?.testimonials?.length ?? 0;
  if (!c?.cinematicCopy) return { next: (c ?? {}) as Customization, removed: 0 };
  const { testimonials: _drop, ...restCopy } = c.cinematicCopy as { testimonials?: unknown[] };
  void _drop;
  const next: Customization = { ...c, cinematicCopy: restCopy };
  return { next, removed: before };
}

async function main() {
  const { data: trainer, error } = await admin
    .from("trainers")
    .select("id, slug, customization")
    .eq("slug", TRAINER_SLUG)
    .maybeSingle();
  if (error) throw error;
  if (!trainer) {
    console.error(`Trainer "${TRAINER_SLUG}" not found.`);
    process.exit(1);
  }

  const primary = strip(trainer.customization as Customization);
  if (primary.removed > 0) {
    const { error: upErr } = await admin
      .from("trainers")
      .update({ customization: primary.next })
      .eq("id", trainer.id);
    if (upErr) throw upErr;
    console.log(`Primary: removed ${primary.removed} testimonial(s) from trainers.customization.`);
  } else {
    console.log("Primary: no testimonials to remove.");
  }

  const { data: pages, error: pagesErr } = await admin
    .from("trainer_pages")
    .select("id, slug, customization")
    .eq("trainer_id", trainer.id);
  if (pagesErr) throw pagesErr;

  for (const p of pages ?? []) {
    const res = strip(p.customization as Customization);
    if (res.removed === 0) {
      console.log(`  page ${p.slug}: no testimonials.`);
      continue;
    }
    const { error: upErr } = await admin
      .from("trainer_pages")
      .update({ customization: res.next })
      .eq("id", p.id);
    if (upErr) throw upErr;
    console.log(`  page ${p.slug}: removed ${res.removed} testimonial(s).`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
