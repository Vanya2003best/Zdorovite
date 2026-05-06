-- ===================================================================
-- 027_trainer_display_name
-- Adds a trainer-level "Wyświetlana nazwa" — an optional public
-- display name that overrides profiles.display_name on the public
-- profile (e.g. "Trener Marek" while the legal name is "Marek Nowak").
-- Nullable so existing rows keep showing profiles.display_name as
-- they do today.
-- ===================================================================

alter table public.trainers
  add column if not exists display_name text;
