/**
 * Diagnostic: dump all auth users + whether they have a trainers row.
 * Run: npx tsx scripts/list-users.ts
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

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const { data: trainers } = await admin
    .from("trainers")
    .select("id, slug, published");
  const tMap = new Map((trainers ?? []).map((t) => [t.id, t]));
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role, display_name");
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  console.log(`\nTotal auth users: ${list.users.length}\n`);
  for (const u of list.users) {
    const t = tMap.get(u.id);
    const p = pMap.get(u.id);
    console.log(
      `${u.email?.padEnd(35)} | id=${u.id.slice(0, 8)}.. | ` +
        `role=${(p?.role ?? "—").padEnd(8)} | ` +
        `name=${(p?.display_name ?? "—").padEnd(20)} | ` +
        `trainer=${t ? `slug:${t.slug} pub:${t.published}` : "no"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
