-- ===================================================================
-- 017 — Placeholder seed data for new trainers
-- ===================================================================
-- Run in Supabase Dashboard → SQL Editor.
--
-- New trainers used to see an empty profile after the signup form: no
-- services, no packages, no gallery — just blank states. This migration
-- adds an `is_placeholder` boolean to those tables and a `seed_trainer_
-- placeholders()` function the become-trainer action calls right after
-- creating the trainer row.
--
-- Behaviour for the trainer:
--   - On first /studio/design visit they see a complete-looking profile
--     with sample services / packages / gallery (faded, "Kliknij aby
--     spersonalizować" tooltip).
--   - When they edit any sample row, the matching is_placeholder flag
--     flips to false (handled in update server actions).
--   - The publish gate (set elsewhere) refuses to flip `published=true`
--     while is_placeholder rows are still around in the required slots.
--
-- Certifications are NOT seeded — per UX direction: trainer sees an
-- empty-state prompt "Dodaj certyfikat aby się wyświetliły".
-- ===================================================================

alter table public.services
  add column if not exists is_placeholder boolean not null default false;
alter table public.packages
  add column if not exists is_placeholder boolean not null default false;
alter table public.gallery_photos
  add column if not exists is_placeholder boolean not null default false;

-- =====================================================
-- Seed function
-- =====================================================
create or replace function public.seed_trainer_placeholders(trainer_id_arg uuid)
returns void
language plpgsql
as $$
begin
  -- Skip the seed if the trainer already has any services / packages /
  -- gallery rows. Only fresh accounts get the placeholders so we never
  -- clobber a returning trainer's real data.
  if exists (select 1 from public.services where trainer_id = trainer_id_arg)
    or exists (select 1 from public.packages where trainer_id = trainer_id_arg)
    or exists (select 1 from public.gallery_photos where trainer_id = trainer_id_arg)
  then
    return;
  end if;

  -- 4 services — covers the common offering shape (1:1 / consultation /
  -- online / duo). Prices in PLN, durations in minutes.
  insert into public.services (trainer_id, name, description, duration, price, position, is_placeholder)
  values
    (trainer_id_arg, 'Trening personalny 1:1', 'Indywidualnie dopasowany trening na sali z pełną kontrolą techniki.', 60, 200, 0, true),
    (trainer_id_arg, 'Konsultacja wstępna + plan', 'Pierwsza sesja: pomiary, cele, ułożenie spersonalizowanego planu na 4 tygodnie.', 60, 250, 1, true),
    (trainer_id_arg, 'Trening online', 'Sesja przez wideokonferencję — dla osób spoza Warszawy lub w trakcie podróży.', 45, 150, 2, true),
    (trainer_id_arg, 'Trening duo', 'Trening dla dwóch osób — para, znajomi, rodzeństwo. Cena za sesję, nie za osobę.', 60, 280, 3, true);

  -- 2 packages — short reset + longer transformation.
  insert into public.packages (trainer_id, name, description, items, price, period, featured, position, is_placeholder)
  values
    (
      trainer_id_arg,
      'Reset 4-tygodniowy',
      'Pierwszy miesiąc — pomiary, plan startowy, regularne sesje.',
      array[
        '4 treningi 1:1 (60 min)',
        'Plan startowy + pomiary',
        'Plan żywieniowy w PDF',
        'Tygodniowy raport progresu',
        'Wsparcie na WhatsApp 6 dni w tygodniu'
      ],
      650,
      '4 tygodnie',
      false,
      0,
      true
    ),
    (
      trainer_id_arg,
      'Transformacja 12-tygodniowa',
      'Pełna zmiana sylwetki — z planem, monitoringiem, korektą co 4 tygodnie.',
      array[
        '24 treningi 1:1 (2× w tygodniu)',
        'Pełny plan z korektą co 4 tygodnie',
        'Plan żywieniowy z rozpisanymi makroskładnikami',
        'Pomiary co 4 tygodnie (waga, obwody, zdjęcia kontrolne)',
        'Stały kontakt na WhatsApp',
        'Plan na okres po programie'
      ],
      1800,
      '12 tygodni',
      true,
      1,
      true
    );

  -- 6 gallery photos — Unsplash gym/training shots, mix of equipment +
  -- people in motion. Trainer replaces these one-by-one.
  insert into public.gallery_photos (trainer_id, url, position, is_placeholder)
  values
    (trainer_id_arg, 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=900&fit=crop', 0, true),
    (trainer_id_arg, 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=900&fit=crop', 1, true),
    (trainer_id_arg, 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=900&fit=crop', 2, true),
    (trainer_id_arg, 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&h=900&fit=crop', 3, true),
    (trainer_id_arg, 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1200&h=900&fit=crop', 4, true),
    (trainer_id_arg, 'https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=1200&h=900&fit=crop', 5, true);
end;
$$;

grant execute on function public.seed_trainer_placeholders(uuid) to authenticated;
