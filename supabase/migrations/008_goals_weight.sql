-- ===================================================================
-- Goals and weight log for the client dashboard.
--
-- client_goals: a free-form list of measurable targets ("Schudnąć do
-- 78 kg", "Powrót do biegania · 5 km", "Pull-up bez gumy"). Stores
-- start/current/target and a unit so the UI can compute progress
-- direction-agnostically:
--   pct = clamp((current - start) / (target - start), 0, 1)
-- works for both lose-weight (start > current > target) and
-- run-further (start < current < target) goals.
--
-- client_weight_log: one weight reading per (client, day). Drives the
-- "−6,2 kg od stycznia" hero stat and the weight chart on /account/progress.
-- ===================================================================

create table public.client_goals (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  unit          text,
  start_value   numeric not null,
  current_value numeric not null,
  target_value  numeric not null,
  target_date   date,
  note          text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index client_goals_client_idx on public.client_goals(client_id, created_at desc);
create index client_goals_open_idx on public.client_goals(client_id) where archived_at is null;

alter table public.client_goals enable row level security;

create policy "goals read own"   on public.client_goals for select using  (auth.uid() = client_id);
create policy "goals insert own" on public.client_goals for insert with check (auth.uid() = client_id);
create policy "goals update own" on public.client_goals for update using  (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "goals delete own" on public.client_goals for delete using  (auth.uid() = client_id);

-- Touch updated_at on every UPDATE so the UI can sort/edit-stamp accurately.
create or replace function public.touch_client_goal_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger client_goals_touch_updated
  before update on public.client_goals
  for each row execute function public.touch_client_goal_updated_at();

-- ===================================================================
-- client_weight_log
-- ===================================================================

create table public.client_weight_log (
  client_id   uuid not null references public.profiles(id) on delete cascade,
  recorded_at date not null,
  weight_kg   numeric(5,2) not null check (weight_kg > 0 and weight_kg < 1000),
  note        text,
  created_at  timestamptz not null default now(),
  primary key (client_id, recorded_at)
);

create index client_weight_log_recent_idx on public.client_weight_log(client_id, recorded_at desc);

alter table public.client_weight_log enable row level security;

create policy "weight read own"   on public.client_weight_log for select using  (auth.uid() = client_id);
create policy "weight insert own" on public.client_weight_log for insert with check (auth.uid() = client_id);
create policy "weight update own" on public.client_weight_log for update using  (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "weight delete own" on public.client_weight_log for delete using  (auth.uid() = client_id);
