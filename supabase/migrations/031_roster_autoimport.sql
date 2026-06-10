-- 031_roster_autoimport.sql
--
-- /studio/klienci goes live: every booking must surface its client in the
-- trainer's roster (trainer_clients, 023). The booking is created by the
-- CLIENT, whose RLS identity cannot insert into the trainer's private
-- roster — so the import happens in a SECURITY DEFINER trigger instead of
-- application code. Covers every booking path (web, future API) for free.

create or replace function public.auto_import_trainer_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trainer_clients (trainer_id, profile_id, display_name)
  select new.trainer_id, new.client_id, coalesce(p.display_name, 'Klient')
  from public.profiles p
  where p.id = new.client_id
  on conflict (trainer_id, profile_id) where profile_id is not null
  do nothing;
  return new;
end;
$$;

drop trigger if exists bookings_auto_import_client on public.bookings;
create trigger bookings_auto_import_client
  after insert on public.bookings
  for each row execute function public.auto_import_trainer_client();

-- Backfill: clients who already booked before this migration.
insert into public.trainer_clients (trainer_id, profile_id, display_name)
select distinct b.trainer_id, b.client_id, coalesce(p.display_name, 'Klient')
from public.bookings b
join public.profiles p on p.id = b.client_id
on conflict (trainer_id, profile_id) where profile_id is not null
do nothing;
