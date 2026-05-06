-- 024_booking_payments.sql
--
-- Booking payment lifecycle. Adds payment_status / payment_method /
-- paid_at to bookings so the no-commission +1 zł client-fee model has
-- a real UI surface — trainer can mark "BLIK 200 zł odebrane" /
-- "Sesja z pakietu 5/8" / "Platforma" after each session.
--
-- This is P3 of the trainer ecosystem plan. For now the trainer marks
-- everything manually (cash / BLIK / pakiet etc) — P7 wires in actual
-- Stripe integration where 'platform' status flips automatically on
-- webhook receipt.

alter table public.bookings
  add column payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'refunded', 'free')),
  -- 'package' = paid via a multi-session pakiet (no per-session cash flow);
  -- 'platform' = paid through NaZdrow! (Stripe/Przelewy24, +1 zł client fee);
  -- the rest are off-platform methods the trainer logs after the fact.
  add column payment_method text
    check (payment_method in (null, 'blik', 'cash', 'transfer', 'package', 'platform')),
  add column paid_at timestamptz,
  -- payment_amount holds what the CLIENT actually paid (so under +1 zł
  -- model it's price + 1). For off-platform methods it equals price.
  -- nullable until paid; useful for refund accounting later.
  add column payment_amount numeric(10, 2);

comment on column public.bookings.payment_status is
  'pending = awaiting payment; paid = settled (off-platform or via Stripe); refunded = money returned; free = giveaway/comp.';

-- Common query path: trainer's pending bookings sorted by start_time
-- (oldest first — those need attention first).
create index bookings_pending_payment_idx
  on public.bookings (trainer_id, start_time)
  where payment_status = 'pending';

-- Monthly income aggregation — bookings.paid_at is the time bucket.
create index bookings_paid_at_idx
  on public.bookings (trainer_id, paid_at)
  where payment_status = 'paid';
