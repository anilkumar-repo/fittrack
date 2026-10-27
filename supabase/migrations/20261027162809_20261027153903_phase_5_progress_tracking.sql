-- Optional, private body-weight history. Workout progress itself is derived from
-- the existing workout_sessions and related log tables.
create table if not exists public.body_weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(6, 2) not null check (weight_kg >= 20 and weight_kg <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table public.body_weight_entries enable row level security;

create policy "Owners can read their body-weight entries"
  on public.body_weight_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can insert their body-weight entries"
  on public.body_weight_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners can update their body-weight entries"
  on public.body_weight_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.body_weight_entries from anon, authenticated;
grant select, insert, update on public.body_weight_entries to authenticated;
