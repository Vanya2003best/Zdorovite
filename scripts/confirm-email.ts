/**
 * One-shot: mark a user's email as confirmed, bypassing the email link.
 *
 * Use case: dev / support need to verify an account whose owner can't
 * receive the confirmation email (typo, deliverability, etc.). Sets
 * auth.users.email_confirmed_at to now() via the admin API.
 *
 * Run:  npx tsx scripts/confirm-email.ts <email>
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npx tsx scripts/confirm-email.ts <email>");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
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
  console.log(`  email_confirmed_at: ${user.email_confirmed_at ?? "(null)"}`);

  if (user.email_confirmed_at) {
    console.log("✓ already confirmed — nothing to do");
    return;
  }

  const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (updErr) {
    console.error("Failed to confirm email:", updErr.message);
    process.exit(1);
  }
  console.log(`✓ email confirmed at ${updated.user?.email_confirmed_at}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
