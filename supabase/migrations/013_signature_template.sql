-- =====================================================
-- 013 — Signature template tables: membership_tiers + press_mentions
-- =====================================================
-- Run in Supabase Dashboard → SQL Editor.
--
-- Signature is the "personal brand" template. Two new owned-content tables that
-- exist alongside `services` and `packages` (NOT a replacement — packages still
-- power Premium/Cinematic/etc. Membership tiers are a Signature-only concept of
-- "you join, with reciprocal commitment", different from "you buy a bundle").
--
-- press_mentions are owner-curated media quotes ("Vogue Polska wrote about me"),
-- which sit between testimonials (real customers) and certifications (formal
-- credentials) — a third axis of social proof.

-- =====================================================
-- 1. membership_tiers
-- =====================================================
create table if not exists membership_tiers (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null references trainers(id) on delete cascade,
  position     int  not null default 0,
  tier_label   text not null default 'Bronze',     -- "Bronze" / "Silver" / "Gold"
  name         text not null,                       -- e.g. "Essentials", "Signature Method"
  description  text,
  price        int  not null default 0,             -- monthly price in zł
  period       text not null default 'miesiąc',     -- "miesiąc" / "kwartał" / etc.
  items        text[] not null default '{}',        -- bullet list
  featured     bool not null default false,         -- gold "Najczęściej wybierane" badge
  cta_text     text,                                -- "Dołącz do Silver →"
  created_at   timestamptz not null default now()
);
create index if not exists membership_tiers_trainer_pos_idx
  on membership_tiers(trainer_id, position);

-- =====================================================
-- 2. press_mentions
-- =====================================================
create table if not exists press_mentions (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null references trainers(id) on delete cascade,
  position     int  not null default 0,
  publication  text not null,                       -- "VOGUE POLSKA", "Forbes Women"
  quote        text not null,                       -- the pulled quote
  meta         text,                                -- "Wydanie 09/2025 · Profile: Anna K."
  publication_style text not null default 'serif',  -- 'serif' (italic) | 'bold' (uppercase wordmark)
  created_at   timestamptz not null default now()
);
create index if not exists press_mentions_trainer_pos_idx
  on press_mentions(trainer_id, position);

-- =====================================================
-- 3. RLS — owner-managed, public-readable
-- =====================================================
alter table membership_tiers enable row level security;
alter table press_mentions enable row level security;

-- Drop-then-create to keep migration re-runnable.
drop policy if exists "membership_tiers: public read"  on membership_tiers;
drop policy if exists "membership_tiers: owner write"  on membership_tiers;
drop policy if exists "membership_tiers: owner update" on membership_tiers;
drop policy if exists "membership_tiers: owner delete" on membership_tiers;

create policy "membership_tiers: public read"
  on membership_tiers for select
  using (true);
create policy "membership_tiers: owner write"
  on membership_tiers for insert to authenticated
  with check (trainer_id = auth.uid());
create policy "membership_tiers: owner update"
  on membership_tiers for update to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());
create policy "membership_tiers: owner delete"
  on membership_tiers for delete to authenticated
  using (trainer_id = auth.uid());

drop policy if exists "press_mentions: public read"  on press_mentions;
drop policy if exists "press_mentions: owner write"  on press_mentions;
drop policy if exists "press_mentions: owner update" on press_mentions;
drop policy if exists "press_mentions: owner delete" on press_mentions;

create policy "press_mentions: public read"
  on press_mentions for select
  using (true);
create policy "press_mentions: owner write"
  on press_mentions for insert to authenticated
  with check (trainer_id = auth.uid());
create policy "press_mentions: owner update"
  on press_mentions for update to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());
create policy "press_mentions: owner delete"
  on press_mentions for delete to authenticated
  using (trainer_id = auth.uid());
