create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null,
  plain_text text not null check (char_length(trim(plain_text)) > 0),
  mood_score double precision check (
    mood_score is null or mood_score between -1 and 1
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_entries_user_created_idx
on public.journal_entries (user_id, created_at desc);

create or replace function public.set_journal_entry_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_journal_entry_updated_at
before update on public.journal_entries
for each row execute function public.set_journal_entry_updated_at();

alter table public.journal_entries enable row level security;

create policy "Users can read their own journal entries"
on public.journal_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own journal entries"
on public.journal_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own journal entries"
on public.journal_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own journal entries"
on public.journal_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete
on public.journal_entries
to authenticated;
