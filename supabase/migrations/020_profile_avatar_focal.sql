-- 020_profile_avatar_focal.sql
--
-- Drag-to-pan focal point for the trainer's avatar. Mirrors the focal-point
-- pattern used everywhere else in the editor (StudioCopy.heroPhotoFocal,
-- StudioCaseStudy.photoFocal, customization.coverFocal, etc.). Stored as a
-- CSS object-position string ("30% 45%"); null/empty means default ("center").
--
-- Lives on `profiles` rather than `trainers` because the avatar itself is on
-- `profiles.avatar_url` — every trainer is a profile, and a focal point
-- without an underlying photo would be meaningless.

alter table public.profiles
  add column avatar_focal text;

comment on column public.profiles.avatar_focal is
  'CSS object-position for the avatar photo (e.g. "30% 45%"). Set via drag-pan in /studio/profile.';
