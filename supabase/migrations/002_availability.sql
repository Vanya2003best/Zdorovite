-- ===================================================================
-- NaZdrow! — trainer availability (working hours) + seed defaults
-- Run in Supabase SQL Editor after 001.
-- ===================================================================

create table public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),  -- 0=Sun, 1=Mon, … 6=Sat
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);

create index availability_rules_trainer_dow_idx
  on public.availability_rules (trainer_id, day_of_week);

alter table public.availability_rules enable row level security;

create policy "availability read all"
  on public.availability_rules for select using (true);

create policy "availability write own"
  on public.availability_rules for all
  using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

-- Default: Mon–Fri 09:00–18:00 for all existing trainers
insert into public.availability_rules (trainer_id, day_of_week, start_time, end_time)
select t.id, dow, time '09:00', time '18:00'
from public.trainers t, generate_series(1, 5) as dow;
