-- 025_session_notes.sql
--
-- Per-session notes — separate from trainer_clients.notes which is
-- client-level (stable across all sessions). session_notes is what the
-- trainer types DURING / RIGHT AFTER a single session: "dziś PB w
-- przysiadzie 102 kg", "zrezygnowała z dwa pierwsze serie — kolano",
-- "dobra forma, zwiększamy obciążenie w przyszłym tygodniu".
--
-- Stored on bookings (not as a separate table) because every session
-- already has a 1:1 booking row, and the notes' lifetime mirrors the
-- booking's. Soft cap at 4000 chars enforced in the action layer.

alter table public.bookings
  add column session_notes text;

comment on column public.bookings.session_notes is
  'Trainer-private notes about THIS session — typed live during/after at the gym. Distinct from trainer_clients.notes which is client-level.';
