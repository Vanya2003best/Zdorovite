-- 023_trainer_clients.sql
--
-- Trainer-private "client roster" — one row per (trainer, client)
-- relationship. Two flavours:
--   1. Linked: client is a NaZdrow! user (booked through platform).
--      profile_id points at their profiles row.
--   2. Manual: trainer typed in someone who pays cash and never used
--      the site. profile_id stays null; display_name/phone/email
--      hold the contact.
--
-- Either way the trainer's NOTES / TAGS / GOAL live here — those are
-- per-trainer-per-client opinions that don't belong on the shared
-- profiles row. A different trainer working with the same person sees
-- their own notes, not the first trainer's.
--
-- This table is the foundation for the entire /studio/klienci surface
-- (P2 of the trainer ecosystem plan). Subsequent iterations will JOIN:
--   - bookings  → session history per client
--   - payments  → finanse per client (after P3 mark-as-paid)
--   - measurements (future) → postęp per client

create table public.trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  -- Linked-mode: pointer to the platform profiles row. NULL for manual entries.
  profile_id uuid references public.profiles(id) on delete set null,
  -- Manual-mode contact (used when profile_id is null; also fallback when a
  -- linked profile lacks a phone/email).
  display_name text not null,
  email text,
  phone text,
  -- Trainer's private fields. notes is markdown-friendly free text.
  notes text,
  goal text,
  tags text[] not null default '{}',
  -- Soft-archive — clients who finished but trainer wants to keep history.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.trainer_clients is
  'Trainer-private CRM — manual + auto-derived client roster. One row per trainer-client pair.';

-- Don't let auto-import (in createBooking) duplicate a row that already
-- exists for the same (trainer, profile) pair. Manual entries skip this
-- by virtue of profile_id being NULL.
create unique index trainer_clients_unique_profile
  on public.trainer_clients (trainer_id, profile_id)
  where profile_id is not null;

-- Common query path: "show this trainer's roster, newest first."
create index trainer_clients_trainer_idx
  on public.trainer_clients (trainer_id, created_at desc);

-- Auto-touch updated_at on any UPDATE. Keeps the "ostatnia aktualizacja"
-- field in the UI honest without each editor having to remember.
create or replace function public.touch_trainer_clients_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trainer_clients_touch_updated_at
  before update on public.trainer_clients
  for each row execute function public.touch_trainer_clients_updated_at();

-- ===== RLS =====
alter table public.trainer_clients enable row level security;

-- Trainer sees only their own roster — no cross-leakage between trainers.
create policy "trainer_clients read own"
  on public.trainer_clients for select
  using (auth.uid() = trainer_id);

create policy "trainer_clients insert own"
  on public.trainer_clients for insert
  with check (auth.uid() = trainer_id);

create policy "trainer_clients update own"
  on public.trainer_clients for update
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);

create policy "trainer_clients delete own"
  on public.trainer_clients for delete
  using (auth.uid() = trainer_id);
