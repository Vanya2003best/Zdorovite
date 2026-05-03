-- =====================================================
-- 016_review_replies.sql
-- Trainer can publicly reply to a client's review (Yelp / Google Business
-- pattern). One reply per review (trainer who owns the trainer_id).
-- =====================================================

alter table public.reviews
  add column if not exists reply_text text,
  add column if not exists reply_at   timestamptz;

-- Length cap matches review text; the FE editor enforces it client-side too.
alter table public.reviews
  add constraint reviews_reply_text_len_chk
  check (reply_text is null or char_length(reply_text) between 1 and 2000);

-- Keep reply_at in sync with reply_text writes. Set on first reply, refresh
-- on every subsequent edit, clear on null. We use a BEFORE-UPDATE trigger so
-- the timestamp lands in the same row write.
create or replace function public.touch_review_reply_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (new.reply_text is distinct from old.reply_text) then
    if new.reply_text is null then
      new.reply_at := null;
    else
      new.reply_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_touch_reply_at on public.reviews;
create trigger reviews_touch_reply_at
  before update on public.reviews
  for each row
  execute function public.touch_review_reply_at();

-- RLS: only the trainer who owns this review's trainer_id can set/clear the
-- reply. The existing "reviews update author" policy from migration 001 lets
-- the review's AUTHOR (client) edit the review body — we add a separate
-- policy for the TRAINER that's scoped to the reply columns. Postgres RLS
-- doesn't support per-column policies, so we add a policy that gates on
-- trainer_id = auth.uid() and rely on the FE / action to only ever PATCH
-- reply_text from this path. The author's update policy remains for them
-- to edit rating/text.
drop policy if exists "reviews update trainer reply" on public.reviews;
create policy "reviews update trainer reply"
  on public.reviews
  for update
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);
