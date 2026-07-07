-- ===================================================================
-- 033_trainerapp_bridge
-- NaZdrow → TrainerApp data bridge (Стратегия витрины, п.2) + авто-completed.
--
-- NaZdrow = витрина + запись; вся CRM живёт в TrainerApp (отдельный
-- Supabase-проект). Мост односторонний: новая бронь / отмена / перенос
-- в NaZdrow появляется в TrainerApp (upsert клиента + запись в календарь).
-- Обратного потока нет; вместо него — почасовой pg_cron, который
-- автоматически переводит прошедшие confirmed/paid брони в completed,
-- чтобы клиенту открывалась форма отзыва.
--
-- Архитектура: transactional outbox. Триггер на bookings пишет событие
-- в bridge_outbox ТОЛЬКО для тренеров, замапленных в trainerapp_links.
-- Edge Function `bridge-deliver` (см. supabase/functions/bridge-deliver)
-- разгребает outbox и доставляет в TrainerApp REST. pg_cron каждые
-- 2 минуты дёргает функцию через pg_net, если есть недоставленные.
--
-- Секреты (НЕ в этом файле):
--   * Vault-секрет `bridge_secret` — служебный заголовок x-bridge-secret,
--     который проверяет Edge Function (создаётся отдельно:
--     select vault.create_secret('<random>', 'bridge_secret');).
--   * Секреты функции TRAINERAPP_URL / TRAINERAPP_SERVICE_KEY /
--     BRIDGE_SECRET — через `supabase secrets set`.
--
-- Идемпотентно: можно выполнять повторно.
-- ===================================================================

-- ------------------------------------------------------------------
-- 0. Extensions: pg_cron (планировщик) + pg_net (async HTTP из БД)
-- ------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ------------------------------------------------------------------
-- 1. trainerapp_links — маппинг тренеров NaZdrow → TrainerApp.
--    Пустая таблица = мост выключен (триггер ничего не пишет).
--    Строку добавляет владелец руками, когда тренер заводит TrainerApp.
-- ------------------------------------------------------------------
create table if not exists public.trainerapp_links (
  nazdrow_trainer_id    uuid primary key references public.trainers(id) on delete cascade,
  trainerapp_trainer_id uuid not null,
  created_at            timestamptz not null default now()
);

comment on table public.trainerapp_links is
  'NaZdrow trainer → TrainerApp trainer (profiles.id в проекте pcmolcbgabznpqregcsp). Управляется вручную service-ролью.';

-- RLS: никаких политик => доступ только у service role / postgres.
alter table public.trainerapp_links enable row level security;
revoke all on table public.trainerapp_links from anon, authenticated;

-- ------------------------------------------------------------------
-- 2. bridge_outbox — журнал событий на доставку (transactional outbox)
-- ------------------------------------------------------------------
create table if not exists public.bridge_outbox (
  id           bigserial primary key,
  booking_id   uuid not null,
  event        text not null check (event in ('created', 'cancelled', 'rescheduled')),
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  delivered_at timestamptz,
  attempts     int not null default 0,
  last_error   text
);

create index if not exists bridge_outbox_undelivered_idx
  on public.bridge_outbox (id)
  where delivered_at is null;

alter table public.bridge_outbox enable row level security;
revoke all on table public.bridge_outbox from anon, authenticated;

-- ------------------------------------------------------------------
-- 3. Триггер: bookings → bridge_outbox (только замапленные тренеры)
--    INSERT                      → 'created'
--    UPDATE status → cancelled   → 'cancelled'
--    UPDATE start_time изменился → 'rescheduled'
-- ------------------------------------------------------------------
create or replace function public.bridge_enqueue_booking()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_event        text;
  v_client_name  text;
  v_client_phone text;
begin
  -- Мост активен только для замапленных тренеров.
  if not exists (
    select 1 from trainerapp_links l where l.nazdrow_trainer_id = new.trainer_id
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then
      return new; -- бронь, созданная сразу отменённой, не доставляем
    end if;
    v_event := 'created';
  else -- UPDATE
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      v_event := 'cancelled';
    elsif new.start_time is distinct from old.start_time then
      v_event := 'rescheduled';
    else
      return new; -- прочие изменения (заметки, оплата, completed) не мостим
    end if;
  end if;

  select p.display_name, nullif(btrim(coalesce(p.phone, '')), '')
    into v_client_name, v_client_phone
  from profiles p
  where p.id = new.client_id;

  insert into bridge_outbox (booking_id, event, payload)
  values (
    new.id,
    v_event,
    jsonb_build_object(
      'booking_id',         new.id,
      'event',              v_event,
      'nazdrow_trainer_id', new.trainer_id,
      'client_name',        coalesce(v_client_name, 'Klient NaZdrow'),
      'client_phone',       v_client_phone,
      'starts_at',          new.start_time,
      'ends_at',            new.end_time,
      'service_name',       coalesce(new.service_name, new.package_name),
      'price',              new.price,
      'status',             new.status,
      'note',               new.note
    )
  );

  return new;
end;
$$;

drop trigger if exists bookings_bridge_outbox on public.bookings;
create trigger bookings_bridge_outbox
  after insert or update on public.bookings
  for each row execute function public.bridge_enqueue_booking();

-- ------------------------------------------------------------------
-- 4. Авто-completed: раз в час прошедшие confirmed/paid брони
--    (сессия закончилась >24ч назад) переводятся в completed —
--    это открывает клиенту форму отзыва. end_time в bookings NOT NULL.
--    (cron.schedule с тем же jobname идемпотентно обновляет job.)
-- ------------------------------------------------------------------
select cron.schedule(
  'nazdrow-auto-complete-bookings',
  '7 * * * *',
  $$
  update public.bookings
     set status = 'completed'
   where status in ('confirmed', 'paid')
     and end_time < now() - interval '24 hours'
  $$
);

-- ------------------------------------------------------------------
-- 5. Доставка: каждые 2 минуты pg_net POST в Edge Function
--    bridge-deliver, только если есть недоставленные события.
--    Секрет заголовка читается из Vault в момент запуска job.
-- ------------------------------------------------------------------
select cron.schedule(
  'nazdrow-bridge-deliver-ping',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://cnrgttflzxwcahlbhnsc.supabase.co/functions/v1/bridge-deliver',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-bridge-secret', (select decrypted_secret
                            from vault.decrypted_secrets
                           where name = 'bridge_secret')
    ),
    body    := '{}'::jsonb
  )
  where exists (
    select 1 from public.bridge_outbox
     where delivered_at is null and attempts < 5
  )
  $$
);
