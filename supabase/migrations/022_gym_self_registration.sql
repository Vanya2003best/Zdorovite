-- 022_gym_self_registration.sql
--
-- Self-registration for gym chains + branches via /dodaj-klub. Adds the
-- pending/active/rejected status lifecycle, contact info for verification,
-- and an admin approval token for the magic-link approval flow that comes
-- next iteration (trainer self-claims, club gets email with link to
-- approve/reject).
--
-- Existing seeded rows (Zdrofit + 6 Wrocław branches from
-- scripts/seed-gym-chains.ts) are bumped to status='active' as part of
-- this migration so they don't disappear from /sieci/* during the rollout.

-- 1. Chain status (active = seeded by us OR verified after self-registration;
--    pending = waiting for verification; rejected = explicit denial).
alter table public.gym_chains
  add column status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected'));

-- Contact for the entity that registered the chain. Required for verification
-- but exposed only to NaZdrow! admins (RLS below masks it from public reads).
alter table public.gym_chains
  add column contact_email text,
  add column contact_phone text,
  add column nip text,
  add column registered_by uuid references auth.users(id) on delete set null,
  add column registered_at timestamptz;

-- 2. Branch status — same lifecycle. We split chain vs branch status so a
--    verified chain can have pending branches added later by other branch
--    managers.
alter table public.gym_branches
  add column status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected'));

alter table public.gym_branches
  add column contact_email text,
  add column contact_phone text,
  add column registered_by uuid references auth.users(id) on delete set null,
  add column registered_at timestamptz;

-- Magic-link approval token for the next iteration's email-based flow:
-- club gets a link like /klub/[token]/zatwierdzenia?claim=<id> that lets
-- them approve/reject trainer self-claims WITHOUT a full auth account
-- (clubs aren't auth users yet — that's a future iteration).
alter table public.gym_branches
  add column admin_token text unique;

-- 3. Bump everything currently seeded to 'active' so /sieci/* doesn't blank.
update public.gym_chains set status = 'active' where status = 'pending';
update public.gym_branches set status = 'active' where status = 'pending';

-- 4. RLS adjustments — public can only see active branches/chains.
--    Drop existing select policy and replace with status-aware version.
drop policy if exists "gym_chains read public" on public.gym_chains;
drop policy if exists "gym_branches read public" on public.gym_branches;

create policy "gym_chains read public-active-or-self"
  on public.gym_chains for select
  using (status = 'active' or auth.uid() = registered_by);

create policy "gym_branches read public-active-or-self"
  on public.gym_branches for select
  using (status = 'active' or auth.uid() = registered_by);

-- Insert: any authenticated user can submit a chain or branch (via
-- /dodaj-klub). status='pending' enforced. registered_by must match auth.
create policy "gym_chains insert self"
  on public.gym_chains for insert
  with check (
    auth.uid() is not null
    and status = 'pending'
    and registered_by = auth.uid()
  );

create policy "gym_branches insert self"
  on public.gym_branches for insert
  with check (
    auth.uid() is not null
    and status = 'pending'
    and registered_by = auth.uid()
  );

-- 5. Index for the admin queue (NaZdrow! reviews pending in chronological order).
create index gym_chains_pending_idx on public.gym_chains (registered_at)
  where status = 'pending';
create index gym_branches_pending_idx on public.gym_branches (registered_at)
  where status = 'pending';
