-- =====================================================
-- 015 — Multi-page model: trainer_pages
-- =====================================================
-- Run in Supabase Dashboard → SQL Editor.
--
-- Phase 1 of "one trainer, many pages" architecture (Linktree-style + Fiverr-
-- gigs hybrid). Each `trainer_pages` row is a fully-rendered public page with
-- its own template, slug and customization bag. ONE row per trainer is marked
-- `is_primary=true` and serves /trainers/{trainer-slug}. Other rows render
-- under /trainers/{trainer-slug}/p/{page-slug}.
--
-- Account-level data (services, packages, certifications, gallery_photos,
-- reviews, profile, identity) stays SHARED across pages — pages curate which
-- of those to show + per-page copy overrides via customization.signatureCopy
-- / cinematicCopy / etc. (Phase 2 adds explicit override fields).

create table if not exists public.trainer_pages (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null references trainers(id) on delete cascade,
  slug         text not null,
  template     text not null default 'minimal',
  customization jsonb not null default '{}'::jsonb,
  is_primary   boolean not null default false,
  -- 'draft' = visible only to owner. 'published' = public.
  status       text not null default 'draft',
  -- Optional human-readable label shown in Moje strony list ("Strona B2C",
  -- "Wersja angielska", "Retreat lato 2026"). Slug stays URL-safe.
  title        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (trainer_id, slug)
);

create index if not exists trainer_pages_trainer_idx
  on trainer_pages(trainer_id);

-- Enforce "exactly one primary page per trainer" with a partial unique index.
-- Adding a second primary fails; the only path is to flip the existing one off
-- first (handled by the setPrimaryPage server action with a transaction).
create unique index if not exists trainer_pages_one_primary_per_trainer
  on trainer_pages(trainer_id) where is_primary = true;

-- =====================================================
-- Backfill from existing trainers.customization
-- =====================================================
-- One row per trainer: pulls the current customization (with its template /
-- accentColor / sections / cinematicCopy / signatureCopy / etc.) into a new
-- "main" page marked is_primary. Existing public URL /trainers/{slug} keeps
-- working because routing falls back to the primary page.
insert into trainer_pages (trainer_id, slug, template, customization, is_primary, status, title)
select
  t.id,
  'main',
  coalesce(t.customization->>'template', 'minimal'),
  coalesce(t.customization, '{}'::jsonb),
  true,
  case when t.published then 'published' else 'draft' end,
  'Główna strona'
from trainers t
where not exists (
  select 1 from trainer_pages tp where tp.trainer_id = t.id
);

-- =====================================================
-- RLS
-- =====================================================
alter table trainer_pages enable row level security;

drop policy if exists "trainer_pages: public read"   on trainer_pages;
drop policy if exists "trainer_pages: owner write"   on trainer_pages;
drop policy if exists "trainer_pages: owner update"  on trainer_pages;
drop policy if exists "trainer_pages: owner delete"  on trainer_pages;

create policy "trainer_pages: public read"
  on trainer_pages for select
  using (status = 'published' or trainer_id = auth.uid());
create policy "trainer_pages: owner write"
  on trainer_pages for insert to authenticated
  with check (trainer_id = auth.uid());
create policy "trainer_pages: owner update"
  on trainer_pages for update to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());
create policy "trainer_pages: owner delete"
  on trainer_pages for delete to authenticated
  using (trainer_id = auth.uid());

-- Auto-update updated_at on row changes.
create or replace function public.touch_trainer_pages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trainer_pages_set_updated_at on trainer_pages;
create trigger trainer_pages_set_updated_at
  before update on trainer_pages
  for each row execute function public.touch_trainer_pages_updated_at();
