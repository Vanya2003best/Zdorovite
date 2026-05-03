/**
 * Apply migrations 018 + 019 if their target columns are missing.
 * Idempotent — checks for column existence first; safe to re-run.
 *
 * Run: npx tsx scripts/apply-pending-migrations.ts
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

async function hasColumn(table: string, col: string): Promise<boolean> {
  // Try select that column. 42703 = column does not exist.
  const { error } = await admin.from(table).select(col).limit(0);
  if (!error) return true;
  if (error.code === "42703") return false;
  // Other errors — log + assume column exists to avoid double-applying.
  console.warn(`hasColumn ${table}.${col}: ${error.code} ${error.message}`);
  return true;
}

async function runSql(sqlPath: string): Promise<void> {
  const sql = fs.readFileSync(sqlPath, "utf-8");
  // pg-meta exec_sql RPC is the only way to run arbitrary DDL via supabase-js.
  // Most projects don't have it; fall back to a direct fetch to the
  // postgres-meta /query endpoint (supabase exposes this on the project URL).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! + "/pg/query";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    throw new Error(`SQL apply failed (${res.status}): ${await res.text()}`);
  }
}

async function main() {
  // 019 — trainers.ai_context
  if (!(await hasColumn("trainers", "ai_context"))) {
    console.log("→ Applying 019_trainer_ai_context.sql...");
    try {
      await runSql(
        path.join(process.cwd(), "supabase/migrations/019_trainer_ai_context.sql"),
      );
      console.log("✓ 019 applied");
    } catch (e) {
      console.error("✗ 019 failed:", (e as Error).message);
      console.error(
        "\nFallback: paste this into Supabase Dashboard → SQL Editor:\n",
      );
      console.error(
        fs.readFileSync(
          path.join(process.cwd(), "supabase/migrations/019_trainer_ai_context.sql"),
          "utf-8",
        ),
      );
      process.exit(1);
    }
  } else {
    console.log("✓ trainers.ai_context already exists");
  }

  // 018 — bookings.service_name (snapshot)
  if (!(await hasColumn("bookings", "service_name"))) {
    console.log("→ 018 (booking snapshot) not applied — paste this into SQL Editor:\n");
    console.log(
      fs.readFileSync(
        path.join(process.cwd(), "supabase/migrations/018_booking_snapshot.sql"),
        "utf-8",
      ),
    );
  } else {
    console.log("✓ bookings.service_name already exists (018 applied)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
