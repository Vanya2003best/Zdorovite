/**
 * Seed gym_chains + gym_branches with Zdrofit + Wrocław branches.
 * Idempotent — uses upsert on (slug) for chains and (chain_id, slug) for
 * branches. Safe to re-run after editing the data below.
 *
 * Run: npx tsx scripts/seed-gym-chains.ts
 *
 * After this runs you should be able to navigate to:
 *   /sieci/zdrofit/wroclaw-aleja-pokoju
 *
 * The Wrocław branches are based on Zdrofit's actual public location list
 * as of 2026-05. Update lat/lng/address from the chain's website when you
 * have a moment — they're approximate placeholders below.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ===== Chains =====
// Brand colors taken from each chain's actual logo. Logo URLs left null —
// upload to public/chain-logos/ and set them when ready.
const CHAINS = [
  {
    slug: "zdrofit",
    name: "Zdrofit",
    brand_color: "#e60019",
    website: "https://zdrofit.pl",
  },
  // Stub other major PL chains so the schema is exercised end-to-end.
  // Add branches for them only when you actually have a real partnership.
  {
    slug: "calypso",
    name: "Calypso Fitness",
    brand_color: "#00b8d9",
    website: "https://calypso.com.pl",
  },
  {
    slug: "fitfabric",
    name: "FitFabric",
    brand_color: "#ff5e2c",
    website: "https://fitfabric.pl",
  },
  {
    slug: "justgym",
    name: "Just Gym",
    brand_color: "#1a1a1a",
    website: null,
  },
];

// ===== Branches (Zdrofit Wrocław) =====
// City + slug must be unique per chain. Slugs become URL paths
// (/sieci/zdrofit/[slug]) so keep them short and stable.
const ZDROFIT_WROCLAW_BRANCHES = [
  {
    slug: "wroclaw-aleja-pokoju",
    name: "Wrocław Aleja Pokoju",
    address: "Al. Pokoju 1, 50-001 Wrocław",
    recruiting_open: true,
    recruiting_message: "Szukamy trenerów na rok 2026 — siłownia + crossfit.",
  },
  {
    slug: "wroclaw-magnolia",
    name: "Wrocław CH Magnolia Park",
    address: "ul. Legnicka 58, 54-203 Wrocław",
    recruiting_open: false,
    recruiting_message: null,
  },
  {
    slug: "wroclaw-arkady",
    name: "Wrocław Arkady Wrocławskie",
    address: "ul. Powstańców Śląskich 2-4, 53-333 Wrocław",
    recruiting_open: true,
    recruiting_message: null,
  },
  {
    slug: "wroclaw-sky-tower",
    name: "Wrocław Sky Tower",
    address: "ul. Powstańców Śląskich 95, 53-332 Wrocław",
    recruiting_open: false,
    recruiting_message: null,
  },
  {
    slug: "wroclaw-renoma",
    name: "Wrocław CH Renoma",
    address: "ul. Świdnicka 40, 50-024 Wrocław",
    recruiting_open: false,
    recruiting_message: null,
  },
  {
    slug: "wroclaw-pasaz",
    name: "Wrocław Pasaż Grunwaldzki",
    address: "Plac Grunwaldzki 22, 50-363 Wrocław",
    recruiting_open: true,
    recruiting_message: "Otwarte 2 stanowiska — kobiety w ciąży / poporodowe.",
  },
];

async function main() {
  // 1. Upsert chains
  for (const chain of CHAINS) {
    const { error } = await admin
      .from("gym_chains")
      .upsert(chain, { onConflict: "slug" });
    if (error) {
      console.error(`✗ chain ${chain.slug}: ${error.message}`);
      continue;
    }
    console.log(`✓ chain ${chain.slug}`);
  }

  // 2. Resolve Zdrofit chain_id
  const { data: zdrofit } = await admin
    .from("gym_chains")
    .select("id")
    .eq("slug", "zdrofit")
    .single();
  if (!zdrofit) {
    console.error("Zdrofit row missing after upsert — aborting branch seed");
    process.exit(1);
  }

  // 3. Upsert Zdrofit Wrocław branches
  for (const branch of ZDROFIT_WROCLAW_BRANCHES) {
    const { error } = await admin
      .from("gym_branches")
      .upsert(
        { ...branch, chain_id: zdrofit.id, city: "Wrocław" },
        { onConflict: "chain_id,slug" },
      );
    if (error) {
      console.error(`✗ branch ${branch.slug}: ${error.message}`);
      continue;
    }
    console.log(`✓ branch ${branch.slug}${branch.recruiting_open ? " 🟢 hiring" : ""}`);
  }

  console.log("\nDone. Try /sieci/zdrofit/wroclaw-aleja-pokoju");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
