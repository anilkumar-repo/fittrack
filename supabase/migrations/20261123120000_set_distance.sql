-- R5 (2026-11-23): distance on logged sets (walks, runs, rides, rows).
-- Time needs no new column: a timed set's number is already stored in actual_reps / planned_reps (seconds for holds such
-- as a plank, minutes for cardio such as a walk), so no existing workout data changes. The app now labels it by the
-- exercise's tracking unit.
--   1. workout_set_logs.distance_km: optional, 0–1000 km.
--   2. save_workout_session also writes it (the client sends it as "distanceKm" on each set). Everything else unchanged;
--      create or replace keeps the function's existing grants.

-- 1. Distance column
alter table public.workout_set_logs
  add column if not exists distance_km numeric(6, 2)
    check (distance_km is null or distance_km between 0 and 1000);

comment on column public.workout_set_logs.distance_km is 'Distance for cardio sets (walk, run, ride, row), in kilometres. Null for everything else.';

-- 2. The single-transaction save, now also writing distance_km.
create or replace function public.save_workout_session(p_session jsonb)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_status text := p_session ->> 'status';
  v_check_in jsonb := nullif(p_session -> 'check_in', 'null'::jsonb);
  v_review jsonb := nullif(p_session -> 'review', 'null'::jsonb);
  v_logs jsonb := coalesce(nullif(p_session -> 'exercise_logs', 'null'::jsonb), '[]'::jsonb);
  v_session uuid;
  v_log jsonb;
  v_log_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in to save a workout.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_logs) <> 'array' then
    raise exception 'Exercise logs must be a list.' using errcode = '22023';
  end if;

  insert into public.workout_sessions as sessions (
    user_id, workout_date, status, template_key, template_version, rule_version,
    plan_snapshot, check_in, exercise_logs, review, completed_at, updated_at
  ) values (
    v_user,
    (p_session ->> 'workout_date')::date,
    v_status,
    p_session ->> 'template_key',
    p_session ->> 'template_version',
    p_session ->> 'rule_version',
    p_session -> 'plan_snapshot',
    v_check_in,
    v_logs,
    v_review,
    case when v_status = 'completed' then coalesce((p_session ->> 'completed_at')::timestamptz, now()) end,
    now()
  )
  on conflict (user_id, workout_date) do update set
    status = excluded.status,
    template_key = excluded.template_key,
    template_version = excluded.template_version,
    rule_version = excluded.rule_version,
    plan_snapshot = excluded.plan_snapshot,
    check_in = excluded.check_in,
    exercise_logs = excluded.exercise_logs,
    review = excluded.review,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at
  returning sessions.id into v_session;

  if v_check_in is not null then
    insert into public.workout_check_ins (session_id, user_id, energy, soreness, pain, recovery, discomfort_note, note, updated_at)
    values (
      v_session, v_user,
      (v_check_in ->> 'energy')::smallint,
      (v_check_in ->> 'soreness')::smallint,
      (v_check_in ->> 'pain')::boolean,
      (v_check_in ->> 'recovery')::smallint,
      coalesce(v_check_in ->> 'discomfort', ''),
      coalesce(v_check_in ->> 'note', ''),
      now()
    )
    on conflict (session_id) do update set
      energy = excluded.energy,
      soreness = excluded.soreness,
      pain = excluded.pain,
      recovery = excluded.recovery,
      discomfort_note = excluded.discomfort_note,
      note = excluded.note,
      updated_at = excluded.updated_at;
  end if;

  for v_log in select items.value from jsonb_array_elements(v_logs) as items(value)
  loop
    insert into public.workout_exercise_logs as logs (
      session_id, user_id, exercise_id, planned_sets, planned_reps, status, substitution_name, form_quality, notes, updated_at
    ) values (
      v_session, v_user,
      v_log ->> 'exerciseId',
      (v_log ->> 'plannedSets')::smallint,
      (v_log ->> 'plannedReps')::smallint,
      v_log ->> 'status',
      coalesce(v_log ->> 'substitutionName', ''),
      coalesce(v_log ->> 'formQuality', 'not_rated'),
      coalesce(v_log ->> 'notes', ''),
      now()
    )
    on conflict (session_id, exercise_id) do update set
      planned_sets = excluded.planned_sets,
      planned_reps = excluded.planned_reps,
      status = excluded.status,
      substitution_name = excluded.substitution_name,
      form_quality = excluded.form_quality,
      notes = excluded.notes,
      updated_at = excluded.updated_at
    returning logs.id into v_log_id;

    insert into public.workout_set_logs (
      exercise_log_id, session_id, user_id, set_number, planned_reps, actual_reps, load_kg, distance_km, completed, is_extra, set_type, updated_at
    )
    select
      v_log_id, v_session, v_user,
      sets.position::smallint,
      (sets.value ->> 'plannedReps')::smallint,
      (sets.value ->> 'actualReps')::smallint,
      (sets.value ->> 'loadKg')::numeric,
      (sets.value ->> 'distanceKm')::numeric,
      coalesce((sets.value ->> 'completed')::boolean, false),
      coalesce((sets.value ->> 'extra')::boolean, false),
      case when sets.value ->> 'kind' in ('warmup', 'drop', 'failure') then sets.value ->> 'kind' else 'normal' end,
      now()
    from jsonb_array_elements(coalesce(nullif(v_log -> 'sets', 'null'::jsonb), '[]'::jsonb)) with ordinality as sets(value, position)
    on conflict (exercise_log_id, set_number) do update set
      planned_reps = excluded.planned_reps,
      actual_reps = excluded.actual_reps,
      load_kg = excluded.load_kg,
      distance_km = excluded.distance_km,
      completed = excluded.completed,
      is_extra = excluded.is_extra,
      set_type = excluded.set_type,
      updated_at = excluded.updated_at;
  end loop;

  if v_review is not null then
    insert into public.workout_reviews (session_id, user_id, effort, mood, energy_after, discomfort, discomfort_note, note, updated_at)
    values (
      v_session, v_user,
      (v_review ->> 'effort')::smallint,
      v_review ->> 'mood',
      (v_review ->> 'energyAfter')::smallint,
      (v_review ->> 'discomfort')::boolean,
      coalesce(v_review ->> 'discomfortNote', ''),
      coalesce(v_review ->> 'note', ''),
      now()
    )
    on conflict (session_id) do update set
      effort = excluded.effort,
      mood = excluded.mood,
      energy_after = excluded.energy_after,
      discomfort = excluded.discomfort,
      discomfort_note = excluded.discomfort_note,
      note = excluded.note,
      updated_at = excluded.updated_at;
  end if;

  return v_session;
end;
$function$;
