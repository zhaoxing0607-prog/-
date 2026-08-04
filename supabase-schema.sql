-- Exécutez ce script une seule fois dans Supabase > SQL Editor.
create table if not exists public.moldflow_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.moldflow_state enable row level security;

create policy "read own moldflow data" on public.moldflow_state
for select to authenticated using ((select auth.uid()) = user_id);

create policy "create own moldflow data" on public.moldflow_state
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "update own moldflow data" on public.moldflow_state
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists moldflow_state_user_idx on public.moldflow_state(user_id);
