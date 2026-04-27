-- ===================================================================
-- In-app notifications.
--
-- One row per delivered event. The recipient marks them read by
-- clicking through (or via "mark all"). Server actions emit through
-- the SECURITY DEFINER public.emit_notification function, which
-- bypasses RLS so a trainer can push a notification to a client (and
-- vice-versa) without each side needing INSERT privileges on the
-- other's rows.
-- ===================================================================

create type public.notification_kind as enum (
  'booking_requested',     -- trainer: "Klient wysłał prośbę o rezerwację"
  'booking_confirmed',     -- client:  "Trener potwierdził rezerwację"
  'booking_declined',      -- client:  "Trener odrzucił prośbę"
  'booking_cancelled',     -- counterparty: "Sesja anulowana"
  'reschedule_proposed',   -- counterparty: "Nowa propozycja zmiany terminu"
  'reschedule_accepted',   -- requester:    "Twoja propozycja zaakceptowana"
  'reschedule_declined'    -- requester:    "Twoja propozycja odrzucona"
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null,
  body        text,
  link        text,
  related_id  text,                                  -- denormalised booking_id / reschedule_id / message_id for app-side dedup
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Hot read paths on the dashboard bell.
create index notifications_user_recent_idx on public.notifications(user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

-- READ / UPDATE: own rows only.
create policy "notifications read own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications update own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications delete own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- INSERT is gated entirely through the SECURITY DEFINER function below.
-- No row-level INSERT policy = direct inserts from the user JWT are denied,
-- but the function can write because it runs as the owner.

create or replace function public.emit_notification(
  target_user_id uuid,
  notif_kind text,
  notif_title text,
  notif_body text default null,
  notif_link text default null,
  notif_related_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  if auth.uid() = target_user_id then
    raise exception 'cannot emit notification for self';
  end if;

  insert into public.notifications (user_id, kind, title, body, link, related_id)
  values (target_user_id, notif_kind::public.notification_kind, notif_title, notif_body, notif_link, notif_related_id)
  returning id into new_id;

  return new_id;
end;
$$;

-- Lock down: only authenticated callers, and only via the named signature.
revoke all on function public.emit_notification(uuid, text, text, text, text, text) from public;
grant execute on function public.emit_notification(uuid, text, text, text, text, text) to authenticated;

-- Realtime: lets the bell dropdown subscribe and live-update.
alter publication supabase_realtime add table public.notifications;
