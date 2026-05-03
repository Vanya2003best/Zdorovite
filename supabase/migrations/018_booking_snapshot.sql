-- 018_booking_snapshot.sql
--
-- Snapshot service / package fields onto each booking row.
--
-- Why: the original schema referenced services + packages by FK with
-- `ON DELETE SET NULL` and a check constraint `(service_id is null) <>
-- (package_id is null)` — exactly one must be set. That meant deleting
-- a service the booking pointed to would leave both ID columns NULL and
-- the check would fail. Effect: trainer couldn't delete a service that
-- had any booking attached.
--
-- New model: at booking creation time we copy the service/package's
-- displayable fields into the booking row itself. The FK can still go
-- to NULL on deletion — the booking is now self-contained, the trainer
-- and client both see what was originally booked, and the trainer is
-- free to manage their service catalogue without legacy lock-in.
--
-- The XOR check is replaced with a softer invariant: at least one
-- snapshot (service_name OR package_name) must be present on every
-- booking. That tells display code which "kind" of booking it was even
-- after both FKs go null.

-- 1. Snapshot columns ----------------------------------------------

alter table public.bookings
  add column service_name        text,
  add column service_description text,
  add column service_duration    int,
  add column service_price       int,
  add column package_name        text,
  add column package_description text,
  add column package_items       jsonb,
  add column package_price       int,
  add column package_period      text;

-- 2. Backfill from currently-linked services / packages ------------
-- Existing bookings have service_id or package_id set; pull the live
-- values into the snapshot so display code can stop joining once the
-- FK is allowed to go NULL.

update public.bookings b
   set service_name        = s.name,
       service_description = s.description,
       service_duration    = s.duration,
       service_price       = s.price
  from public.services s
 where b.service_id = s.id
   and b.service_name is null;

update public.bookings b
   set package_name        = p.name,
       package_description = p.description,
       package_items       = to_jsonb(p.items),
       package_price       = p.price,
       package_period      = p.period
  from public.packages p
 where b.package_id = p.id
   and b.package_name is null;

-- 3. Drop the XOR check that blocked service deletion --------------
-- The constraint was unnamed in the original migration and Postgres
-- auto-generated `bookings_check1` (because `bookings_check` was
-- already taken by the `end_time > start_time` invariant).

alter table public.bookings drop constraint bookings_check1;

-- 4. New softer invariant: at least one snapshot must be present ---
-- Guarantees every booking row carries enough info to be displayed
-- without joining to services/packages.

alter table public.bookings
  add constraint bookings_snapshot_present
  check (service_name is not null or package_name is not null);
