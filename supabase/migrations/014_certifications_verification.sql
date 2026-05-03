-- =====================================================
-- 014 — Certifications verification (self-verifiable)
-- =====================================================
-- Run in Supabase Dashboard → SQL Editor.
--
-- Phase 1 of cert verification: trainer can attach a verification URL (link to
-- the issuer's directory page — EREPS, AWF Warszawa, FMS, etc.) and/or upload
-- a PDF/image of the diploma. Public profile shows the cert text + a badge
-- next to it that visitors can click to self-verify. Phase 2 (admin-stamped
-- "✓ Zweryfikowane przez NaZdrow") would add `verified_at`/`verified_by` columns.

alter table public.certifications
  add column if not exists verification_url    text,
  add column if not exists attachment_url      text,
  add column if not exists attachment_filename text;

-- =====================================================
-- 1. cert-attachments storage bucket
-- =====================================================
-- Public read so the trainer's profile can show "📎 PDF" links straight to
-- the file. 10 MB is enough for scanned diplomas (PDF or JPG/PNG).
-- Path convention: cert-attachments/{user_id}/{cert_id}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cert-attachments', 'cert-attachments', true, 10485760,
   array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cert-attachments: public read"  on storage.objects;
drop policy if exists "cert-attachments: own write"    on storage.objects;
drop policy if exists "cert-attachments: own update"   on storage.objects;
drop policy if exists "cert-attachments: own delete"   on storage.objects;

create policy "cert-attachments: public read"
  on storage.objects for select
  using (bucket_id = 'cert-attachments');
create policy "cert-attachments: own write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'cert-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cert-attachments: own update"
  on storage.objects for update to authenticated
  using (bucket_id = 'cert-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cert-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cert-attachments: own delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cert-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
