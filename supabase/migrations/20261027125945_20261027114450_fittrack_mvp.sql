-- FitTrack MVP: profiles, trainer-controlled rules, and versioned session snapshots.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Maya' check (char_length(display_name) between 1 and 80),
  experience text not null default 'beginner' check (experience in ('beginner', 'intermediate')),
  sessions_per_week integer not null default 3 check (sessions_per_week between 2 and 4),
  training_days integer[] not null default array[2, 4, 6],
  training_start_date date not null default current_date,
  time_zone text not null default 'Asia/Kolkata' check (char_length(time_zone) between 1 and 80),
  preferred_session_minutes integer not null default 40 check (preferred_session_minutes in (30, 40, 50)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_training_days_count check (cardinality(training_days) between 2 and 4),
  constraint profiles_training_days_values check (training_days <@ array[0, 1, 2, 3, 4, 5, 6])
);

create table public.trainer_rules (
  user_id uuid primary key references auth.users (id) on delete cascade,
  deadlift_enabled boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_date date not null,
  status text not null default 'in_progress' check (status in ('planned', 'in_progress', 'completed', 'skipped')),
  template_key text not null,
  template_version text not null,
  rule_version text not null,
  plan_snapshot jsonb not null,
  check_in jsonb,
  exercise_logs jsonb not null default '[]'::jsonb,
  review jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workout_date)
);

create index workout_sessions_user_date_idx
  on public.workout_sessions (user_id, workout_date desc);

alter table public.profiles enable row level security;
alter table public.trainer_rules enable row level security;
alter table public.workout_sessions enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their own trainer rules"
  on public.trainer_rules for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Trainers can create their own trainer rules"
  on public.trainer_rules for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
  );

create policy "Trainers can update their own trainer rules"
  on public.trainer_rules for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
  )
  with check (
    (select auth.uid()) = user_id
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
  );

create policy "Users can read their own workout sessions"
  on public.workout_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own workout sessions"
  on public.workout_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own workout sessions"
  on public.workout_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.trainer_rules to authenticated;
grant select, insert, update on public.workout_sessions to authenticated;
