-- ===================================================================
-- 028_cert_verification_workflow
-- Phase 2 of cert verification: trainer-attached evidence (URL or
-- file) goes into a 'pending' admin queue instead of being trusted
-- automatically. Admin approves → 'verified' (shown publicly) or
-- rejects with a reason → 'rejected' (still visible to the trainer
-- in /studio/profile so they know why, but not on the public page).
--
-- Status enum:
--   unverified — no evidence attached yet (default for new rows)
--   pending    — trainer attached evidence, awaiting admin review
--   verified   — admin approved (shown on public profile)
--   rejected   — admin rejected (with reject_reason explaining why)
--
-- Trigger: any insert/update that adds or changes verification_url
-- or attachment_url flips the row to 'pending' and clears the
-- review fields. Admin's status update doesn't touch evidence
-- columns, so it's not in the trigger's WHEN clause.
-- ===================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'cert_verification_status') then
    create type cert_verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
  end if;
end $$;

alter table public.certifications
  add column if not exists verification_status cert_verification_status not null default 'unverified',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reject_reason text;

-- One-time backfill: rows that already have evidence go into the
-- pending queue for admin review. Pre-028 they were treated as
-- "verified" by mapTrainer (URL/attachment presence === verified).
-- This intentionally throws everyone into the queue once so the
-- admin gets a clean baseline; future evidence changes flow through
-- the same path via the trigger below.
update public.certifications
set verification_status = 'pending'
where verification_status = 'unverified'
  and (verification_url is not null or attachment_url is not null);

-- Trigger function — pushes the row to 'pending' whenever the
-- evidence columns change to a non-null value. Runs BEFORE so the
-- caller doesn't need to know about the workflow.
create or replace function public.cert_evidence_to_pending()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Only react when the row actually has evidence attached after
  -- the change. Clearing both columns leaves the existing status
  -- alone (the trainer might be temporarily editing).
  if (new.verification_url is null and new.attachment_url is null) then
    return new;
  end if;

  -- Insert path: any row created with evidence starts pending.
  if (TG_OP = 'INSERT') then
    new.verification_status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.reject_reason := null;
    return new;
  end if;

  -- Update path: only re-queue if the evidence values actually
  -- changed. Otherwise admin's plain status update wouldn't fire
  -- this in the first place (trigger is OF those columns) — but be
  -- defensive in case someone re-saves the same URL.
  if (
    coalesce(new.verification_url, '') is distinct from coalesce(old.verification_url, '')
    or coalesce(new.attachment_url, '') is distinct from coalesce(old.attachment_url, '')
  ) then
    new.verification_status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.reject_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists cert_evidence_to_pending_trg on public.certifications;
create trigger cert_evidence_to_pending_trg
  before insert or update of verification_url, attachment_url
  on public.certifications
  for each row execute function public.cert_evidence_to_pending();

-- Index for the admin queue listing — pending first, then by
-- creation time so oldest pending surfaces at the top.
create index if not exists certifications_status_idx
  on public.certifications(verification_status, created_at);
