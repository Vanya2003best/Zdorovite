-- ===================================================================
-- Role-based auth (mirroring education-platform's UserRole enum pattern).
-- Replaces the binary `is_trainer` flag with a proper enum so we can add
-- admin / moderator / future roles without schema churn.
-- ===================================================================

-- 1) Enum type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('client', 'trainer', 'admin');
  end if;
end$$;

-- 2) Add column with safe default
alter table public.profiles
  add column if not exists role public.user_role not null default 'client';

-- 3) Backfill from existing is_trainer flag
update public.profiles set role = 'trainer' where is_trainer = true and role = 'client';

-- 4) Index for role-based queries (e.g. "all trainers")
create index if not exists profiles_role_idx on public.profiles (role);

-- 5) Update the auth trigger so brand-new users default to 'client'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    'client'
  );
  return new;
end;
$$;

-- 6) Keep is_trainer column for transition period (sync via trigger so old code still works).
--    DROP it after we've verified all callers are updated (planned next migration).
create or replace function public.sync_is_trainer_from_role()
returns trigger
language plpgsql
as $$
begin
  new.is_trainer := (new.role = 'trainer');
  return new;
end;
$$;

drop trigger if exists profiles_sync_is_trainer on public.profiles;
create trigger profiles_sync_is_trainer
  before insert or update of role on public.profiles
  for each row execute function public.sync_is_trainer_from_role();
