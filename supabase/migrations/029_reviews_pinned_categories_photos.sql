-- ===================================================================
-- 029_reviews_pinned_categories_photos
-- Adds the fields design 34's review cards depend on:
--   pinned_at     → trainer can pin a review to the top of /opinie
--                   and the public profile's reviews section
--   booking_id    → links a review back to the session it covers,
--                   so the card can show "Trening siłowy 1:1 · 8/8
--                   sesja pakietu" instead of a generic 'Sesja'
--   cat_*         → per-category 1–5 ratings; reviews left through
--                   the new flow can rate Wiedza/Atmosfera/
--                   Punktualność/Efekty separately. NULL on legacy
--                   rows so the bars only render when filled.
--   photos        → up to ~6 photo URLs the client can attach to a
--                   review (the design's coloured tile gallery).
--                   Default empty array so existing rows still match
--                   the new shape.
--
-- All fields nullable / defaulted so 028's mapping + the trainer
-- studio page keep rendering without changes until the trainer
-- actively fills them.
-- ===================================================================

alter table public.reviews
  add column if not exists pinned_at timestamptz,
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists cat_wiedza smallint check (cat_wiedza between 1 and 5),
  add column if not exists cat_atmosfera smallint check (cat_atmosfera between 1 and 5),
  add column if not exists cat_punktualnosc smallint check (cat_punktualnosc between 1 and 5),
  add column if not exists cat_efekty smallint check (cat_efekty between 1 and 5),
  add column if not exists photos text[] not null default '{}';

-- Pinned-first sort hits this index. Partial so we don't waste
-- space tracking unpinned (the common) case.
create index if not exists reviews_pinned_idx
  on public.reviews(trainer_id, pinned_at desc)
  where pinned_at is not null;

-- Fast lookup when surfacing 'Trening siłowy 1:1 · 8/8 sesja
-- pakietu' on a review card: review row → booking → service /
-- package name + position-in-package.
create index if not exists reviews_booking_idx
  on public.reviews(booking_id)
  where booking_id is not null;
