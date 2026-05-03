-- =====================================================
-- 012 — Storage bucket for trainer intro videos
-- =====================================================
-- Run this in Supabase Dashboard → SQL Editor.
-- Creates a 'videos' bucket used by the Cinematic template's hero play-card to
-- host a short trainer intro clip (mp4 / webm / mov). Same path convention as
-- covers (single file per trainer, replaced on upload):
--   videos/{user_id}/intro.{ext}
--
-- 50 MB limit (free-tier plan ceiling — Supabase rejected 100 MB at create-time)
-- covers ~45s of HD phone footage at typical bitrates. RLS rules mirror the
-- covers bucket: public read for the hosted clip, owner-only write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos', 'videos', true, 52428800, array['video/mp4','video/webm','video/quicktime'])  -- 50 MB
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos: public read"  on storage.objects;
drop policy if exists "videos: own write"    on storage.objects;
drop policy if exists "videos: own update"   on storage.objects;
drop policy if exists "videos: own delete"   on storage.objects;

create policy "videos: public read"
  on storage.objects for select
  using (bucket_id = 'videos');
create policy "videos: own write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: own update"
  on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: own delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
