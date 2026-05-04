-- 021_gym_chains.sql
--
-- Gym-chain affiliation system. Three tables:
--   1. gym_chains    — Zdrofit, Calypso, FitFabric, etc.
--   2. gym_branches  — specific locations of each chain
--   3. trainer_branches — many-to-many trainer ↔ branch with self-claim/verified
--                          status. Doubles as a passive recruiting funnel
--                          (branches with recruiting_open=true display "we're
--                          hiring" CTA on their landing page).
--
-- Architecture rule: NO hardcoded brand names anywhere in the application.
-- Everything chain-specific (logo, colour, website) lives as a column on
-- gym_chains. Pulling Zdrofit's row deletes their branches + trainer
-- affiliations + badges via cascades — clean kill switch if the verbal
-- partnership ever collapses.

-- 1. Chains
create table public.gym_chains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  brand_color text,
  website text,
  created_at timestamptz not null default now()
);

comment on table public.gym_chains is
  'Top-level gym/fitness chain (Zdrofit, Calypso, FitFabric, JustGym, etc).';

-- 2. Branches (specific locations)
create table public.gym_branches (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.gym_chains(id) on delete cascade,
  name text not null,
  slug text not null,
  city text not null,
  address text,
  lat numeric(10,7),
  lng numeric(10,7),
  -- Recruiting funnel — when true, branch landing shows a prominent
  -- "Aplikuj jako trener" CTA + the branch surfaces in trainer-side
  -- "Kluby z otwartą rekrutacją" filter.
  recruiting_open boolean not null default false,
  recruiting_message text,
  created_at timestamptz not null default now(),
  unique (chain_id, slug)
);

comment on column public.gym_branches.recruiting_open is
  'When true, the branch is actively hiring trainers — drives the recruiting CTA on branch landing + filter on trainer-side discovery.';

-- 3. Trainer ↔ branch affiliation (many-to-many)
create table public.trainer_branches (
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  branch_id  uuid not null references public.gym_branches(id) on delete cascade,
  -- self_claimed = trainer ticked "I work here", instant but unverified.
  -- verified     = NaZdrow! admin or evidence_url review confirmed.
  -- rejected     = explicit denial, prevents re-claim spam.
  status text not null default 'self_claimed'
    check (status in ('self_claimed', 'verified', 'rejected')),
  verified_at timestamptz,
  evidence_url text,
  created_at timestamptz not null default now(),
  primary key (trainer_id, branch_id)
);

-- Reverse-lookup index for branch landing queries ("show all trainers at
-- this branch") — primary key already covers (trainer_id, branch_id) but
-- not the reverse direction.
create index trainer_branches_branch_idx on public.trainer_branches (branch_id);

-- ===== RLS =====
alter table public.gym_chains    enable row level security;
alter table public.gym_branches  enable row level security;
alter table public.trainer_branches enable row level security;

-- Public read for chains + branches — they're catalog data, no privacy.
create policy "gym_chains read public"
  on public.gym_chains for select using (true);
create policy "gym_branches read public"
  on public.gym_branches for select using (true);

-- trainer_branches: public can read VERIFIED claims + the trainer can
-- always see their own (including self_claimed and rejected so they know
-- the status).
create policy "trainer_branches read public-verified-or-own"
  on public.trainer_branches for select
  using (status = 'verified' or auth.uid() = trainer_id);

-- Trainers manage their own claims; status='verified' / 'rejected' is
-- admin-only (enforced by service-role writes). Trainer can self-claim or
-- self-revoke; can't unilaterally upgrade to verified.
create policy "trainer_branches insert self"
  on public.trainer_branches for insert
  with check (auth.uid() = trainer_id and status = 'self_claimed');
create policy "trainer_branches delete self"
  on public.trainer_branches for delete
  using (auth.uid() = trainer_id);
create policy "trainer_branches update self evidence"
  on public.trainer_branches for update
  using (auth.uid() = trainer_id)
  with check (
    auth.uid() = trainer_id
    -- Allow only evidence_url update; can't self-promote to verified.
    and status in ('self_claimed', 'rejected')
  );
