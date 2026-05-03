-- 019_trainer_ai_context.sql
--
-- Per-trainer "AI context" — structured answers the trainer fills in once
-- under /studio/profile. Used by every AI generator on /studio/design as
-- the primary signal for tone + audience + angle. Keeps the public-facing
-- About / Services / Packages copy aligned with the trainer's actual
-- positioning instead of generic fitness boilerplate.
--
-- Stored as jsonb so we can grow the schema (add new sections, drop unused
-- ones) without another migration. Server-side validation lives in
-- trainer-ai-context-actions.ts.

alter table public.trainers
  add column ai_context jsonb not null default '{}'::jsonb;

comment on column public.trainers.ai_context is
  'Structured AI prompt context — { background, targetAudience, methodology, differentiators, tonePreference }. Filled in /studio/profile.';
