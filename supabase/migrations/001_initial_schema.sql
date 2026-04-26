-- ===================================================================
-- NaZdrow! initial schema
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run.
-- ===================================================================

-- Extensions (Supabase has pgcrypto + uuid-ossp enabled by default)
create extension if not exists "pgcrypto";

-- =====================================================
-- 1. Lookup: specializations (fixed small set)
-- =====================================================
create table public.specializations (
  id    text primary key,              -- 'weight-loss', 'yoga', etc.
  label text not null,                 -- 'Odchudzanie', 'Joga'
  icon  text not null                  -- emoji
);

insert into public.specializations (id, label, icon) values
  ('weight-loss',   'Odchudzanie',      '🔥'),
  ('muscle-gain',   'Masa mięśniowa',   '💪'),
  ('rehabilitation','Rehabilitacja',    '🩺'),
  ('flexibility',   'Rozciąganie',      '🧘'),
  ('cardio',        'Cardio',           '❤️'),
  ('strength',      'Siła',             '🏋️'),
  ('crossfit',      'CrossFit',         '⚡'),
  ('yoga',          'Joga',             '🧘‍♀️'),
  ('martial-arts',  'Sztuki walki',     '🥊'),
  ('nutrition',     'Dietetyka',        '🥗');

-- =====================================================
-- 2. profiles (1-to-1 with auth.users)
-- =====================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  is_trainer   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- 3. trainers (extends profile)
-- =====================================================
create table public.trainers (
  id              uuid primary key references public.profiles(id) on delete cascade,
  slug            text unique not null,
  tagline         text not null default '',
  about           text not null default '',
  experience      int  not null default 0,
  price_from      int  not null default 0,
  location        text not null default '',
  languages       text[] not null default '{}',
  cover_image     text,
  rating          numeric(2,1) not null default 0,
  review_count    int not null default 0,
  customization   jsonb not null default '{
    "template":"minimal",
    "accentColor":"#10b981",
    "sections":[
      {"id":"about","visible":true},
      {"id":"services","visible":true},
      {"id":"packages","visible":true},
      {"id":"gallery","visible":true},
      {"id":"certifications","visible":true},
      {"id":"reviews","visible":true}
    ],
    "serviceLayout":"cards",
    "galleryLayout":"grid"
  }'::jsonb,
  published       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index trainers_slug_idx on public.trainers(slug);
create index trainers_published_idx on public.trainers(published);

-- =====================================================
-- 4. trainer_specializations (M:N)
-- =====================================================
create table public.trainer_specializations (
  trainer_id        uuid references public.trainers(id) on delete cascade,
  specialization_id text references public.specializations(id) on delete cascade,
  primary key (trainer_id, specialization_id)
);

create index trainer_spec_trainer_idx on public.trainer_specializations(trainer_id);
create index trainer_spec_spec_idx on public.trainer_specializations(specialization_id);

-- =====================================================
-- 5. services (offered by trainer, single sessions)
-- =====================================================
create table public.services (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  name        text not null,
  description text not null default '',
  duration    int  not null default 60,   -- minutes
  price       int  not null,              -- grosze or whole złoty (we store whole zł for MVP)
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index services_trainer_idx on public.services(trainer_id);

-- =====================================================
-- 6. packages (bundles)
-- =====================================================
create table public.packages (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  name        text not null,
  description text not null default '',
  items       text[] not null default '{}',
  price       int  not null,
  period      text,                       -- 'miesiąc', '4 tyg.', etc. or null
  featured    boolean not null default false,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index packages_trainer_idx on public.packages(trainer_id);

-- =====================================================
-- 7. certifications
-- =====================================================
create table public.certifications (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  text        text not null,             -- 'Trener personalny — APS Warszawa'
  file_url    text,                      -- optional uploaded scan
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index certifications_trainer_idx on public.certifications(trainer_id);

-- =====================================================
-- 8. gallery_photos
-- =====================================================
create table public.gallery_photos (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  url         text not null,
  caption     text,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index gallery_trainer_idx on public.gallery_photos(trainer_id);

-- =====================================================
-- 9. reviews
-- =====================================================
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  text        text not null,
  created_at  timestamptz not null default now(),
  unique (trainer_id, author_id)          -- one review per client per trainer
);

create index reviews_trainer_idx on public.reviews(trainer_id);

-- Trigger: recompute trainer.rating + review_count on review insert/delete/update
create or replace function public.recalc_trainer_rating()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  tid uuid := coalesce(new.trainer_id, old.trainer_id);
begin
  update public.trainers set
    rating       = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where trainer_id = tid), 0),
    review_count = (select count(*) from public.reviews where trainer_id = tid)
  where id = tid;
  return null;
end;
$$;

drop trigger if exists reviews_recalc on public.reviews;
create trigger reviews_recalc
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_trainer_rating();

-- =====================================================
-- 10. favorites
-- =====================================================
create table public.favorites (
  client_id  uuid references public.profiles(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, trainer_id)
);

-- =====================================================
-- 11. bookings
-- =====================================================
create type public.booking_status as enum (
  'pending',     -- created, awaiting payment
  'paid',        -- payment succeeded, upcoming
  'confirmed',   -- trainer confirmed (optional step)
  'completed',   -- session happened
  'cancelled',
  'no_show'
);

create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.profiles(id) on delete restrict,
  trainer_id        uuid not null references public.trainers(id) on delete restrict,
  service_id        uuid references public.services(id) on delete set null,
  package_id        uuid references public.packages(id) on delete set null,
  start_time        timestamptz not null,
  end_time          timestamptz not null,
  status            public.booking_status not null default 'pending',
  price             int not null,                 -- zł
  payment_intent_id text,                          -- Stripe PI id
  note              text,                          -- client note to trainer
  created_at        timestamptz not null default now(),

  check (end_time > start_time),
  check ((service_id is null) <> (package_id is null))  -- exactly one
);

create index bookings_trainer_idx on public.bookings(trainer_id, start_time);
create index bookings_client_idx  on public.bookings(client_id, start_time);

-- Prevent double-booking the same trainer in overlapping time (excluding cancelled)
create extension if not exists btree_gist;
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    trainer_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status in ('pending','paid','confirmed'));

-- =====================================================
-- 12. messages (simple chat)
-- =====================================================
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  text       text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages(least(from_id, to_id), greatest(from_id, to_id), created_at);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- profiles: public read, self-write
alter table public.profiles enable row level security;
create policy "profiles read all"    on public.profiles for select using (true);
create policy "profiles update self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- trainers: public read (if published or owner), self-write
alter table public.trainers enable row level security;
create policy "trainers read published or own"
  on public.trainers for select
  using (published or auth.uid() = id);
create policy "trainers insert self"
  on public.trainers for insert
  with check (auth.uid() = id);
create policy "trainers update self"
  on public.trainers for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- specializations: public read, no writes from clients
alter table public.specializations enable row level security;
create policy "specializations read all" on public.specializations for select using (true);

-- trainer_specializations: read all, write by trainer
alter table public.trainer_specializations enable row level security;
create policy "trainer_spec read all" on public.trainer_specializations for select using (true);
create policy "trainer_spec write own"
  on public.trainer_specializations for all
  using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

-- services / packages / certifications / gallery: public read, trainer-write
alter table public.services          enable row level security;
alter table public.packages          enable row level security;
alter table public.certifications    enable row level security;
alter table public.gallery_photos    enable row level security;

create policy "services read all"     on public.services for select using (true);
create policy "services write own"    on public.services for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "packages read all"     on public.packages for select using (true);
create policy "packages write own"    on public.packages for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "certs read all"        on public.certifications for select using (true);
create policy "certs write own"       on public.certifications for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "gallery read all"      on public.gallery_photos for select using (true);
create policy "gallery write own"     on public.gallery_photos for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

-- reviews: public read, authenticated insert (MVP — tighten later to completed bookings)
alter table public.reviews enable row level security;
create policy "reviews read all"      on public.reviews for select using (true);
create policy "reviews insert author" on public.reviews for insert with check (auth.uid() = author_id);
create policy "reviews update author" on public.reviews for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "reviews delete author" on public.reviews for delete using (auth.uid() = author_id);

-- favorites: self only
alter table public.favorites enable row level security;
create policy "favorites read self"   on public.favorites for select using (auth.uid() = client_id);
create policy "favorites write self"  on public.favorites for all using (auth.uid() = client_id) with check (auth.uid() = client_id);

-- bookings: participants only
alter table public.bookings enable row level security;
create policy "bookings read participant"
  on public.bookings for select
  using (auth.uid() = client_id or auth.uid() = trainer_id);
create policy "bookings insert client"
  on public.bookings for insert
  with check (auth.uid() = client_id);
create policy "bookings update participant"
  on public.bookings for update
  using (auth.uid() = client_id or auth.uid() = trainer_id)
  with check (auth.uid() = client_id or auth.uid() = trainer_id);

-- messages: sender or receiver
alter table public.messages enable row level security;
create policy "messages read participant"
  on public.messages for select
  using (auth.uid() = from_id or auth.uid() = to_id);
create policy "messages insert sender"
  on public.messages for insert
  with check (auth.uid() = from_id);
create policy "messages update receiver" -- for marking read_at
  on public.messages for update
  using (auth.uid() = to_id) with check (auth.uid() = to_id);
