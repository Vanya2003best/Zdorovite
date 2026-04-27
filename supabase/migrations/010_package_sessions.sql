-- ===================================================================
-- Add a denominator to packages so the "X / Y sesji" progress bar on
-- the client dashboard ("Aktywne pakiety") can show real progress.
-- Existing rows get NULL — the UI treats NULL as "X sesji" (no bar).
-- ===================================================================

alter table public.packages
  add column if not exists sessions_total int
    check (sessions_total is null or (sessions_total > 0 and sessions_total <= 200));
