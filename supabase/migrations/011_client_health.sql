-- ===================================================================
-- One-row-per-client health snapshot for the "Paszport zdrowia" panel.
-- Weight is intentionally NOT here — it lives in client_weight_log
-- (migration 008) so we keep history. This table holds everything else
-- the trainer might want to know at a glance + a free-form note.
-- ===================================================================

create table public.client_health (
  client_id   uuid primary key references public.profiles(id) on delete cascade,
  note        text,
  height_cm   int    check (height_cm is null or (height_cm > 50 and height_cm < 300)),
  fms_score   int    check (fms_score is null or (fms_score >= 0 and fms_score <= 21)),
  resting_hr  int    check (resting_hr is null or (resting_hr > 20 and resting_hr < 220)),
  updated_at  timestamptz not null default now()
);

alter table public.client_health enable row level security;

create policy "client_health read own"   on public.client_health for select using  (auth.uid() = client_id);
create policy "client_health insert own" on public.client_health for insert with check (auth.uid() = client_id);
create policy "client_health update own" on public.client_health for update using  (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "client_health delete own" on public.client_health for delete using  (auth.uid() = client_id);

create or replace function public.touch_client_health_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger client_health_touch_updated
  before update on public.client_health
  for each row execute function public.touch_client_health_updated_at();
