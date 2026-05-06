-- ===================================================================
-- 026_trainer_profile_fields
-- Adds the granular fields that /studio/profile (design 28) edits
-- directly: mission line, location split into city/district/work_mode/
-- radius, client-goals chips alongside specializations, and a social
-- JSONB for instagram/youtube/etc. + a phone column on profiles.
-- All fields nullable / defaulted so existing rows stay valid.
-- ===================================================================

alter table public.profiles
  add column if not exists phone text;

alter table public.trainers
  add column if not exists mission text not null default '';

alter table public.trainers
  add column if not exists city text not null default '';

alter table public.trainers
  add column if not exists district text not null default '';

-- work_mode: 'stationary' (only on-site), 'online' (only remote),
-- 'both' (default — most trainers do both).
alter table public.trainers
  add column if not exists work_mode text not null default 'both'
  check (work_mode in ('stationary', 'online', 'both'));

alter table public.trainers
  add column if not exists travel_radius_km int not null default 15
  check (travel_radius_km between 0 and 200);

-- Free-text labels — separate from the fixed `specializations` lookup
-- because client goals are personal ("Powrót po kontuzji",
-- "Pierwsze kroki w gym") and don't fit the marketplace filter set.
alter table public.trainers
  add column if not exists client_goals text[] not null default '{}';

-- Social handles + contact: { instagram, youtube, tiktok, facebook,
-- website, phone, email }. JSONB so we can add networks without
-- another migration. Public profile reads what it needs; missing keys
-- just don't render.
alter table public.trainers
  add column if not exists social jsonb not null default '{}'::jsonb;
