-- ===================================================================
-- 030_availability_overrides
-- Per-date overrides on top of the recurring weekly availability_rules.
--
-- The trainer's default schedule lives in `availability_rules` (one row
-- per day_of_week × shift). That covers the common "I work Mon-Fri 9-5
-- every week" case, but breaks the moment the trainer needs a one-off
-- exception: vacation, conference, sick day, doubled hours for a single
-- weekend, etc. Without this table the only way to express "next Tuesday
-- I'm closed" is to delete the recurring Tuesday rule, which then breaks
-- every future Tuesday too.
--
-- Resolution rule (computed in the app layer):
--   For a given (trainer_id, target_date):
--     1. If `availability_overrides` has a row for that date → use it.
--        - is_closed = true → trainer unavailable that day, period.
--        - is_closed = false → use this row's start_time/end_time as the
--          single shift for that day. (Multi-shift overrides are
--          modelled as multiple rows — same composite key tuple but
--          different start_time, all with is_closed=false.)
--     2. Otherwise fall back to the recurring `availability_rules` row
--        for that date's day_of_week.
--
-- The (trainer_id, date, start_time) primary key lets a single date
-- carry multiple shifts (e.g. 06:00-12:00 + 16:00-22:00) the same way
-- availability_rules does on the recurring side. is_closed rows use a
-- sentinel start_time of '00:00' so the PK still works for "this date
-- is closed" — UI never inserts a closed override alongside open shifts.
-- ===================================================================

create table if not exists public.availability_overrides (
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  -- The specific calendar date the override applies to. We rely on the
  -- trainer's local timezone (Europe/Warsaw) at app level — the column
  -- is plain `date` so the override is timezone-agnostic ("on May 15").
  date date not null,
  start_time time not null default '00:00',
  end_time time,
  is_closed boolean not null default false,
  -- Optional human-readable label the trainer can attach: "Konferencja",
  -- "Urlop", "Choroba". Surface in calendar tooltip + dialog header.
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite PK: same date can have multiple open shifts but never two
  -- rows with the exact same start_time. is_closed rows are pinned to
  -- start_time '00:00' so they're singletons-per-date by construction.
  primary key (trainer_id, date, start_time),
  -- Open-shift rows must have an end_time; closed-day rows must not.
  -- The check keeps the data consistent without requiring a trigger.
  constraint availability_overrides_shape check (
    (is_closed = true and end_time is null)
    or (is_closed = false and end_time is not null and end_time > start_time)
  )
);

-- Hot path: load all overrides for one trainer in a date window (the
-- visible calendar week). Index covers the common (trainer, date-range)
-- query pattern.
create index if not exists availability_overrides_trainer_date_idx
  on public.availability_overrides(trainer_id, date);

-- ----- RLS -----
alter table public.availability_overrides enable row level security;

-- Trainer can read/write their own overrides only.
drop policy if exists availability_overrides_owner_select on public.availability_overrides;
create policy availability_overrides_owner_select on public.availability_overrides
  for select using (auth.uid() = trainer_id);

drop policy if exists availability_overrides_owner_insert on public.availability_overrides;
create policy availability_overrides_owner_insert on public.availability_overrides
  for insert with check (auth.uid() = trainer_id);

drop policy if exists availability_overrides_owner_update on public.availability_overrides;
create policy availability_overrides_owner_update on public.availability_overrides
  for update using (auth.uid() = trainer_id);

drop policy if exists availability_overrides_owner_delete on public.availability_overrides;
create policy availability_overrides_owner_delete on public.availability_overrides
  for delete using (auth.uid() = trainer_id);

-- Public read: clients booking a session need to know the trainer's
-- available slots for a given date. Pair with the existing
-- availability_rules public-read policy so /book free-slot calculation
-- can see both layers.
drop policy if exists availability_overrides_public_select on public.availability_overrides;
create policy availability_overrides_public_select on public.availability_overrides
  for select using (true);

-- updated_at touch trigger — share the existing helper if present.
create or replace function public.tg_availability_overrides_touch()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists availability_overrides_touch on public.availability_overrides;
create trigger availability_overrides_touch
  before update on public.availability_overrides
  for each row execute function public.tg_availability_overrides_touch();
