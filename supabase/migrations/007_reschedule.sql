-- ===================================================================
-- Reschedule requests for bookings.
--
-- Either party of a booking can propose a new start/end time. The OTHER
-- party then accepts or declines. The requester can cancel their own
-- pending proposal. Accepting is the trigger that mutates the booking
-- itself (done from the server action, atomically).
--
-- The chat surfaces these as "booking-card" messages: when a proposal
-- is created, the same server action posts a message with
-- message_type = 'reschedule_proposal' linking back via
-- reschedule_request_id. Status updates also produce small ack
-- messages so the chat stays a live audit trail.
-- ===================================================================

create type public.reschedule_status as enum (
  'pending', 'accepted', 'declined', 'cancelled'
);

create table public.reschedule_requests (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  requested_by    uuid not null references public.profiles(id) on delete cascade,
  proposed_start  timestamptz not null,
  proposed_end    timestamptz not null,
  reason          text,
  status          public.reschedule_status not null default 'pending',
  responded_at    timestamptz,
  responded_by    uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),

  check (proposed_end > proposed_start),
  -- "Either you respond, or you don't" — keep status and responded_at honest.
  check (
    (status in ('accepted','declined') and responded_at is not null and responded_by is not null)
    or (status in ('pending','cancelled'))
  )
);

create index reschedule_booking_idx on public.reschedule_requests(booking_id, created_at desc);

alter table public.reschedule_requests enable row level security;

-- READ: any participant of the related booking.
create policy "reschedule read participant"
  on public.reschedule_requests for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.client_id = auth.uid() or b.trainer_id = auth.uid())
    )
  );

-- INSERT: must be a booking participant, requested_by must equal self.
create policy "reschedule insert participant"
  on public.reschedule_requests for insert
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.client_id = auth.uid() or b.trainer_id = auth.uid())
    )
  );

-- UPDATE — accept/decline by the OTHER party.
-- Must move status from 'pending' → 'accepted' | 'declined' and stamp responded_by.
create policy "reschedule decision by other"
  on public.reschedule_requests for update
  using (
    status = 'pending'
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (
          (b.client_id  = auth.uid() and requested_by = b.trainer_id) or
          (b.trainer_id = auth.uid() and requested_by = b.client_id)
        )
    )
  )
  with check (
    status in ('accepted','declined')
    and responded_by = auth.uid()
  );

-- UPDATE — cancel by the requester. Only while still pending.
create policy "reschedule cancel by requester"
  on public.reschedule_requests for update
  using (status = 'pending' and requested_by = auth.uid())
  with check (status = 'cancelled');

-- ===================================================================
-- messages: extend with a typed payload pointer so chat can render
-- booking-cards (Design 24B) without a separate attachments table.
-- ===================================================================

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists reschedule_request_id uuid
    references public.reschedule_requests(id) on delete cascade;

-- Lightweight check so future code can grep the known set:
alter table public.messages
  add constraint messages_type_known
  check (message_type in ('text', 'reschedule_proposal', 'reschedule_response'));

-- Index for "reschedule responses for request X"
create index if not exists messages_reschedule_idx
  on public.messages(reschedule_request_id)
  where reschedule_request_id is not null;

-- Realtime publication already covers all rows of public.messages.
-- Add reschedule_requests too so frontends can subscribe to status changes
-- without polling.
alter publication supabase_realtime add table public.reschedule_requests;
