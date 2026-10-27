-- Phase 2: normalized session check-ins, exercise/set logs, reviews, and trainer/client access.
-- Existing JSON snapshots remain intact and are copied into the related tables below.

alter table public.workout_sessions
  add constraint workout_sessions_id_user_id_key unique (id, user_id);

create table public.trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint trainer_clients_not_self check (trainer_id <> client_id),
  constraint trainer_clients_unique_pair unique (trainer_id, client_id)
);

create table public.workout_check_ins (
  session_id uuid primary key,
  user_id uuid not null,
  energy smallint not null check (energy between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  pain boolean not null,
  recovery smallint check (recovery is null or recovery between 1 and 5),
  discomfort_note text not null default '' check (char_length(discomfort_note) <= 1000),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_check_ins_session_owner_fk foreign key (session_id, user_id)
    references public.workout_sessions (id, user_id) on delete cascade
);

create table public.workout_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  exercise_id text not null check (char_length(exercise_id) between 1 and 120),
  planned_sets smallint not null check (planned_sets between 1 and 20),
  planned_reps smallint not null check (planned_reps between 1 and 1000),
  status text not null default 'not_started' check (status in ('not_started', 'partial', 'completed', 'skipped')),
  substitution_name text not null default '' check (char_length(substitution_name) <= 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_exercise_logs_session_exercise_unique unique (session_id, exercise_id),
  constraint workout_exercise_logs_id_session_owner_unique unique (id, session_id, user_id),
  constraint workout_exercise_logs_session_owner_fk foreign key (session_id, user_id)
    references public.workout_sessions (id, user_id) on delete cascade
);

create table public.workout_set_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null,
  session_id uuid not null,
  user_id uuid not null,
  set_number smallint not null check (set_number between 1 and 30),
  planned_reps smallint check (planned_reps is null or planned_reps between 1 and 1000),
  actual_reps smallint check (actual_reps is null or actual_reps between 1 and 1000),
  load_kg numeric(7, 2) check (load_kg is null or load_kg between 0 and 2000),
  completed boolean not null default false,
  is_extra boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_set_logs_exercise_set_unique unique (exercise_log_id, set_number),
  constraint workout_set_logs_completed_reps check (not completed or actual_reps is not null),
  constraint workout_set_logs_exercise_owner_fk foreign key (exercise_log_id, session_id, user_id)
    references public.workout_exercise_logs (id, session_id, user_id) on delete cascade
);

create table public.workout_reviews (
  session_id uuid primary key,
  user_id uuid not null,
  effort smallint not null check (effort between 1 and 10),
  mood text not null check (mood in ('better', 'same', 'tougher')),
  energy_after smallint not null check (energy_after between 1 and 5),
  discomfort boolean not null,
  discomfort_note text not null default '' check (char_length(discomfort_note) <= 1000),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_reviews_session_owner_fk foreign key (session_id, user_id)
    references public.workout_sessions (id, user_id) on delete cascade
);

create index trainer_clients_trainer_status_idx on public.trainer_clients (trainer_id, status);
create index trainer_clients_client_status_idx on public.trainer_clients (client_id, status);
create index workout_exercise_logs_user_session_idx on public.workout_exercise_logs (user_id, session_id);
create index workout_set_logs_user_session_idx on public.workout_set_logs (user_id, session_id);

-- Backfill the normalized children from Phase 1 JSON, without deleting or rewriting snapshots.
insert into public.workout_check_ins (session_id, user_id, energy, soreness, pain, recovery, discomfort_note, note)
select ws.id, ws.user_id,
  (ws.check_in ->> 'energy')::smallint,
  (ws.check_in ->> 'soreness')::smallint,
  coalesce((ws.check_in ->> 'pain')::boolean, false),
  nullif(ws.check_in ->> 'recovery', '')::smallint,
  left(coalesce(ws.check_in ->> 'discomfort', ''), 1000),
  left(coalesce(ws.check_in ->> 'note', ''), 2000)
from public.workout_sessions ws
where jsonb_typeof(ws.check_in) = 'object'
  and ws.check_in ? 'energy'
  and ws.check_in ? 'soreness'
on conflict (session_id) do nothing;

insert into public.workout_exercise_logs (session_id, user_id, exercise_id, planned_sets, planned_reps, status, substitution_name, notes)
select ws.id, ws.user_id, entry.value ->> 'exerciseId',
  greatest(1, coalesce((
    select nullif(exercise.value ->> 'sets', '')::smallint
    from jsonb_array_elements(case when jsonb_typeof(ws.plan_snapshot -> 'exercises') = 'array' then ws.plan_snapshot -> 'exercises' else '[]'::jsonb end) exercise(value)
    where exercise.value ->> 'id' = entry.value ->> 'exerciseId' limit 1
  ), 1)),
  greatest(1, coalesce((
    select substring(exercise.value ->> 'reps' from '^[0-9]+')::smallint
    from jsonb_array_elements(case when jsonb_typeof(ws.plan_snapshot -> 'exercises') = 'array' then ws.plan_snapshot -> 'exercises' else '[]'::jsonb end) exercise(value)
    where exercise.value ->> 'id' = entry.value ->> 'exerciseId' limit 1
  ), 8)),
  case when coalesce((entry.value ->> 'skipped')::boolean, false) then 'skipped'
       when coalesce((entry.value ->> 'completed')::boolean, false) then 'completed'
       else 'not_started' end,
  left(coalesce(entry.value ->> 'substitutionName', ''), 120),
  left(coalesce(entry.value ->> 'notes', ''), 2000)
from public.workout_sessions ws
cross join lateral jsonb_array_elements(case when jsonb_typeof(ws.exercise_logs) = 'array' then ws.exercise_logs else '[]'::jsonb end) entry(value)
where nullif(entry.value ->> 'exerciseId', '') is not null
on conflict (session_id, exercise_id) do nothing;

insert into public.workout_set_logs (exercise_log_id, session_id, user_id, set_number, planned_reps, actual_reps, load_kg, completed, is_extra)
select exercise_log.id, ws.id, ws.user_id, old_set.ordinality::smallint,
  nullif(old_set.value ->> 'reps', '')::smallint,
  nullif(old_set.value ->> 'reps', '')::smallint,
  nullif(old_set.value ->> 'loadKg', '')::numeric(7, 2),
  exercise_log.status = 'completed',
  old_set.ordinality > exercise_log.planned_sets
from public.workout_sessions ws
cross join lateral jsonb_array_elements(case when jsonb_typeof(ws.exercise_logs) = 'array' then ws.exercise_logs else '[]'::jsonb end) entry(value)
cross join lateral jsonb_array_elements(case when jsonb_typeof(entry.value -> 'sets') = 'array' then entry.value -> 'sets' else '[]'::jsonb end) with ordinality old_set(value, ordinality)
join public.workout_exercise_logs exercise_log on exercise_log.session_id = ws.id and exercise_log.exercise_id = entry.value ->> 'exerciseId'
on conflict (exercise_log_id, set_number) do nothing;

insert into public.workout_reviews (session_id, user_id, effort, mood, energy_after, discomfort, discomfort_note, note)
select ws.id, ws.user_id,
  (ws.review ->> 'effort')::smallint,
  case when ws.review ->> 'mood' in ('better', 'same', 'tougher') then ws.review ->> 'mood' else 'same' end,
  coalesce(nullif(ws.review ->> 'energyAfter', '')::smallint, 3),
  coalesce((ws.review ->> 'discomfort')::boolean, false),
  left(coalesce(ws.review ->> 'discomfortNote', ''), 1000),
  left(coalesce(ws.review ->> 'note', ''), 2000)
from public.workout_sessions ws
where jsonb_typeof(ws.review) = 'object'
  and ws.review ? 'effort'
on conflict (session_id) do nothing;

alter table public.trainer_clients enable row level security;
alter table public.workout_check_ins enable row level security;
alter table public.workout_exercise_logs enable row level security;
alter table public.workout_set_logs enable row level security;
alter table public.workout_reviews enable row level security;

create policy "Users can view their trainer relationships"
  on public.trainer_clients for select to authenticated
  using ((select auth.uid()) = trainer_id or (select auth.uid()) = client_id);

create policy "Trainers can read linked client profiles"
  on public.profiles for select to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = profiles.id and tc.status = 'active'
    )
  );

create policy "Trainers can read linked client sessions"
  on public.workout_sessions for select to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = workout_sessions.user_id and tc.status = 'active'
    )
  );

drop policy if exists "Trainers can create their own trainer rules" on public.trainer_rules;
drop policy if exists "Trainers can update their own trainer rules" on public.trainer_rules;

create policy "Trainers can read rules for linked clients"
  on public.trainer_rules for select to authenticated
  using (user_id = (select auth.uid()) or (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active'
    )
  ));

create policy "Trainers can create rules for linked clients"
  on public.trainer_rules for insert to authenticated
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and updated_by = (select auth.uid())
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active'
    )
  );

create policy "Trainers can update rules for linked clients"
  on public.trainer_rules for update to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active'
    )
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and updated_by = (select auth.uid())
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active'
    )
  );

create policy "Owners and linked trainers can read workout check-ins"
  on public.workout_check_ins for select to authenticated
  using (user_id = (select auth.uid()) or (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = workout_check_ins.user_id and tc.status = 'active'
    )
  ));
create policy "Owners can create workout check-ins"
  on public.workout_check_ins for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Owners can update workout check-ins"
  on public.workout_check_ins for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Owners and linked trainers can read exercise logs"
  on public.workout_exercise_logs for select to authenticated
  using (user_id = (select auth.uid()) or (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = workout_exercise_logs.user_id and tc.status = 'active'
    )
  ));
create policy "Owners can create exercise logs"
  on public.workout_exercise_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Owners can update exercise logs"
  on public.workout_exercise_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Owners and linked trainers can read set logs"
  on public.workout_set_logs for select to authenticated
  using (user_id = (select auth.uid()) or (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = workout_set_logs.user_id and tc.status = 'active'
    )
  ));
create policy "Owners can create set logs"
  on public.workout_set_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Owners can update set logs"
  on public.workout_set_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Owners and linked trainers can read workout reviews"
  on public.workout_reviews for select to authenticated
  using (user_id = (select auth.uid()) or (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
    and exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = (select auth.uid()) and tc.client_id = workout_reviews.user_id and tc.status = 'active'
    )
  ));
create policy "Owners can create workout reviews"
  on public.workout_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Owners can update workout reviews"
  on public.workout_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.trainer_clients to authenticated;
grant select, insert, update on public.workout_check_ins to authenticated;
grant select, insert, update on public.workout_exercise_logs to authenticated;
grant select, insert, update on public.workout_set_logs to authenticated;
grant select, insert, update on public.workout_reviews to authenticated;
