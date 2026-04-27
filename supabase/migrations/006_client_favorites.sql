-- ===================================================================
-- Client favorites: a client (any signed-in user with role='client')
-- can favorite a trainer. Composite primary key prevents duplicates.
-- Trainer-side reads (e.g. "people who favorited me") aren't enabled
-- yet — only the owning client can read their list.
-- ===================================================================

create table public.client_favorites (
  client_id  uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, trainer_id)
);

-- Reverse-lookup index for "trainers favorited by this client" the index
-- on (client_id, trainer_id) from the PK already serves the forward case.
create index client_favorites_trainer_idx on public.client_favorites(trainer_id);

alter table public.client_favorites enable row level security;

create policy "favorites read own"
  on public.client_favorites for select
  using (auth.uid() = client_id);

create policy "favorites insert own"
  on public.client_favorites for insert
  with check (auth.uid() = client_id);

create policy "favorites delete own"
  on public.client_favorites for delete
  using (auth.uid() = client_id);
