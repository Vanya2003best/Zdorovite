-- ===================================================================
-- 032_client_reviews
-- Closes the "client physically cannot leave a review" gap from the
-- 2026-07 launch audit: the WRITE path for reviews. Schema-wise most
-- pieces already exist (001: reviews + author_id; 029: booking_id +
-- cat_* + photos) — what's missing:
--
--   1. one-review-per-session guarantee: UNIQUE on booking_id.
--      Partial index, because legacy seed reviews keep
--      booking_id IS NULL (and NULLs never collide anyway).
--   2. a tight INSERT path: 001's permissive "reviews insert author"
--      policy lets ANY authenticated user insert a review for ANY
--      trainer as long as author_id = auth.uid(). We add a
--      RESTRICTIVE policy that ANDs with it, so an insert must ALSO
--      point at the author's own COMPLETED booking with the reviewed
--      trainer. SELECT is untouched ("reviews read all" stays).
--
-- NOTE: 001's UNIQUE(trainer_id, author_id) stays — the product rule
-- remains "one review per client per trainer"; the new index adds
-- "…and one per session" on top. Additive DDL only (no DROP /
-- DELETE / UPDATE of anything pre-existing), safe to re-run.
-- ===================================================================

-- 1. One review per booking.
create unique index if not exists reviews_booking_unique_idx
  on public.reviews(booking_id)
  where booking_id is not null;

-- 2. Restrictive INSERT policy. Combined with 001's permissive
--    "reviews insert author" (auth.uid() = author_id), an insert by
--    role `authenticated` now requires BOTH:
--      • the author is the caller, AND
--      • booking_id points at the caller's own completed booking
--        with the reviewed trainer.
--    service_role bypasses RLS (seed scripts keep working); anon was
--    never able to insert (the permissive policy already fails it).
--    The EXISTS subquery runs under bookings' own RLS — "bookings
--    read participant" lets the client see their own rows, so the
--    check resolves without recursion.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'reviews'
      and policyname = 'reviews insert completed booking only'
  ) then
    create policy "reviews insert completed booking only"
      on public.reviews
      as restrictive
      for insert
      to authenticated
      with check (
        reviews.booking_id is not null
        and exists (
          select 1
          from public.bookings b
          where b.id         = reviews.booking_id
            and b.client_id  = (select auth.uid())
            and b.trainer_id = reviews.trainer_id
            and b.status     = 'completed'
        )
      );
  end if;
end $$;
