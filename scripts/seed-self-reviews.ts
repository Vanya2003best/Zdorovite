/**
 * Seed 11 positive Polish reviews for a single trainer profile.
 *
 * Each review needs a real auth.user (the FK reviews.author_id references
 * profiles → auth.users; one review per client per trainer is unique-
 * constrained), so the script provisions 11 demo client accounts via the
 * Supabase admin API, then inserts a review from each. Idempotent: re-running
 * upserts the user list and re-upserts each review (delete-then-insert per
 * author so the script is safe to tweak + replay).
 *
 * Run:
 *   npx tsx scripts/seed-self-reviews.ts            # defaults to ivan-zhigalin
 *   npx tsx scripts/seed-self-reviews.ts <slug>     # custom trainer slug
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — same as seed-trainers.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const DEMO_PASSWORD = "DemoClient_2026!";
const TRAINER_SLUG = process.argv[2] ?? "ivan-zhigalin";

// 11 fake clients with Polish names + Unsplash portrait avatars (face-cropped).
// `dateOffsetDays` spreads created_at across the last ~14 months so the list
// reads as a natural drip of reviews rather than a single batch.
const REVIEWS: Array<{
  authorName: string;
  email: string;
  avatar: string;
  rating: number;
  text: string;
  dateOffsetDays: number;
}> = [
  {
    authorName: "Anna Kowalska",
    email: "demo-client+anna-kowalska@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Najlepszy trener z jakim współpracowałam. W 4 miesiące zrzuciłam 8 kg i całkowicie zmieniłam podejście do treningu. Polecam każdemu kto chce realnych efektów, a nie kolejnej diety-cud.",
    dateOffsetDays: 14,
  },
  {
    authorName: "Tomasz Nowak",
    email: "demo-client+tomasz-nowak@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Profesjonalne podejście, indywidualnie dopasowany plan i mnóstwo wiedzy. Każda sesja to konkrety — żadnego lania wody. Po pół roku różnica w sylwetce i samopoczuciu jest ogromna.",
    dateOffsetDays: 32,
  },
  {
    authorName: "Magdalena Wiśniewska",
    email: "demo-client+magdalena-wisniewska@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Po roku pracy z Ivanem czuję się jak nowo narodzona. Plecy przestały boleć, postawa się poprawiła, a do tego wreszcie polubiłam siłownię. Cierpliwość i profesjonalizm na najwyższym poziomie.",
    dateOffsetDays: 58,
  },
  {
    authorName: "Piotr Wójcik",
    email: "demo-client+piotr-wojcik@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Treningi z Ivanem to inwestycja, której nie żałuję. Konkretne ćwiczenia, jasne cele, regularny feedback. Widać rezultaty już po kilku tygodniach. Świetna komunikacja na WhatsAppie między sesjami.",
    dateOffsetDays: 81,
  },
  {
    authorName: "Katarzyna Lewandowska",
    email: "demo-client+katarzyna-lewandowska@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Polecam z całego serca. Ivan ma niesamowitą cierpliwość i potrafi wytłumaczyć każdy detal techniczny. Czuję się bezpiecznie i pewnie podczas treningów, nawet z dużymi obciążeniami.",
    dateOffsetDays: 105,
  },
  {
    authorName: "Michał Kamiński",
    email: "demo-client+michal-kaminski@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Po raz pierwszy w życiu trzymam się planu treningowego ponad 6 miesięcy. To zasługa Ivana — motywacja, wiedza i ludzkie podejście, bez oceniania na starcie.",
    dateOffsetDays: 134,
  },
  {
    authorName: "Paulina Dąbrowska",
    email: "demo-client+paulina-dabrowska@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Schudłam 12 kg w 5 miesięcy bez głodzenia się i bez dietetycznych szaleństw. Plan treningowy + lista zakupów = robi robotę. Sylwetka, której wcześniej nie miałam nawet w liceum.",
    dateOffsetDays: 167,
  },
  {
    authorName: "Krzysztof Zieliński",
    email: "demo-client+krzysztof-zielinski@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Zacząłem od zera w wieku 38 lat. Dziś podnoszę ciężary o których wcześniej nie marzyłem, a do tego doszły regularne treningi w domu. Ivan zna się na tym co robi.",
    dateOffsetDays: 198,
  },
  {
    authorName: "Marta Szymańska",
    email: "demo-client+marta-szymanska@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Treningi online działają tak samo dobrze jak personalne. Ivan dba o technikę nawet przez kamerę i zawsze odpowie na pytania w ciągu kilku godzin. Świetna komunikacja.",
    dateOffsetDays: 234,
  },
  {
    authorName: "Adam Woźniak",
    email: "demo-client+adam-wozniak@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Jako 45-latek z dwójką dzieci myślałem, że już za późno na poważne zmiany. Ivan udowodnił, że nie. Czuję się 10 lat młodszy, a poranne treningi stały się rytuałem.",
    dateOffsetDays: 285,
  },
  {
    authorName: "Joanna Kozłowska",
    email: "demo-client+joanna-kozlowska@nazdrow.local",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces",
    rating: 5,
    text: "Cenię konkret i Ivan dokładnie taki jest. Bez ściemy, bez magicznych dietek — tylko praca, technika i pomiary. Najlepsza decyzja jaką podjęłam w tym roku.",
    dateOffsetDays: 342,
  },
];

async function ensureUser(
  email: string,
  displayName: string,
  avatarUrl: string,
): Promise<string> {
  // Idempotent: list-then-create. The admin paginates so for our scale
  // (11 users) one page is enough.
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

async function main() {
  console.log(`Seeding ${REVIEWS.length} reviews for trainer "${TRAINER_SLUG}"…`);

  const { data: trainer, error: trainerErr } = await admin
    .from("trainers")
    .select("id, slug")
    .eq("slug", TRAINER_SLUG)
    .maybeSingle();
  if (trainerErr) throw trainerErr;
  if (!trainer) {
    console.error(`Trainer not found: slug=${TRAINER_SLUG}`);
    process.exit(1);
  }
  console.log(`Trainer id: ${trainer.id}`);

  for (const r of REVIEWS) {
    console.log(`  → ${r.authorName}`);
    const authorId = await ensureUser(r.email, r.authorName, r.avatar);

    // Profiles row is auto-created by trigger on auth.users insert; ensure
    // display_name + avatar are populated (the trigger may leave them null).
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ display_name: r.authorName, avatar_url: r.avatar })
      .eq("id", authorId);
    if (profileErr) throw profileErr;

    // Compute a created_at offset so the list reads as a natural drip rather
    // than 11 reviews timestamped to the same second.
    const createdAt = new Date(Date.now() - r.dateOffsetDays * 24 * 60 * 60 * 1000);

    // Re-runnable: wipe any existing review from this author then insert.
    // The unique (trainer_id, author_id) constraint blocks plain upsert
    // unless we list it as the conflict target — easier to just delete first.
    await admin
      .from("reviews")
      .delete()
      .eq("trainer_id", trainer.id)
      .eq("author_id", authorId);

    const { error: insertErr } = await admin.from("reviews").insert({
      trainer_id: trainer.id,
      author_id: authorId,
      rating: r.rating,
      text: r.text,
      created_at: createdAt.toISOString(),
    });
    if (insertErr) throw insertErr;
  }

  // Confirm the trigger has updated trainer.rating + review_count.
  const { data: updated } = await admin
    .from("trainers")
    .select("rating, review_count")
    .eq("id", trainer.id)
    .maybeSingle();
  console.log(
    `\nDone. Trainer rating=${updated?.rating ?? "?"}, review_count=${updated?.review_count ?? "?"}`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
