-- =====================================================
-- 005 — Storage buckets for avatars, covers, gallery
-- =====================================================
-- Run this in Supabase Dashboard → SQL Editor.
-- Creates 3 public read-only buckets and RLS policies that constrain writes
-- to {auth.uid()}/* paths so a user can only manage their own files.
--
-- File path convention:
--   avatars/{user_id}/avatar.{ext}              — single file, replaced on upload
--   covers/{user_id}/cover.{ext}                — single file, replaced on upload
--   gallery/{user_id}/{photo_id}.{ext}          — many files, photo_id from gallery_photos.id

-- =====================================================
-- 1. Create buckets (idempotent)
-- =====================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,  array['image/jpeg','image/png','image/webp']),  -- 5 MB
  ('covers',  'covers',  true, 10485760, array['image/jpeg','image/png','image/webp']),  -- 10 MB
  ('gallery', 'gallery', true, 10485760, array['image/jpeg','image/png','image/webp'])   -- 10 MB
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================
-- 2. RLS policies
-- =====================================================
-- Storage policies are defined on storage.objects with bucket_id filters.
-- Path-prefix check: (storage.foldername(name))[1] = auth.uid()::text
-- means "first folder in path equals your own user id".

-- Drop any existing same-name policies to keep this migration re-runnable.
drop policy if exists "avatars: public read"      on storage.objects;
drop policy if exists "avatars: own write"        on storage.objects;
drop policy if exists "avatars: own update"       on storage.objects;
drop policy if exists "avatars: own delete"       on storage.objects;
drop policy if exists "covers: public read"       on storage.objects;
drop policy if exists "covers: own write"         on storage.objects;
drop policy if exists "covers: own update"        on storage.objects;
drop policy if exists "covers: own delete"        on storage.objects;
drop policy if exists "gallery: public read"      on storage.objects;
drop policy if exists "gallery: own write"        on storage.objects;
drop policy if exists "gallery: own update"       on storage.objects;
drop policy if exists "gallery: own delete"       on storage.objects;

-- Avatars
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars: own write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Covers (trainers only — the trainers row gets a cover_image url)
create policy "covers: public read"
  on storage.objects for select
  using (bucket_id = 'covers');
create policy "covers: own write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers: own update"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "covers: own delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- Gallery
create policy "gallery: public read"
  on storage.objects for select
  using (bucket_id = 'gallery');
create policy "gallery: own write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gallery: own update"
  on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gallery: own delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);
