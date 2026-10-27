-- Phase 6: bounded trainer controls, immutable audit history, and database-side validation.
-- This migration is additive. It preserves existing profile/session rows and snapshots.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_bounded_json_number(value jsonb, minimum numeric, maximum numeric, whole_number boolean default true)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  parsed numeric;
begin
  if value is null or jsonb_typeof(value) is distinct from 'number' then return false; end if;
  parsed := (value #>> '{}')::numeric;
  return parsed between minimum and maximum and (not whole_number or parsed = trunc(parsed));
exception when others then
  return false;
end;
$function$;

create or replace function private.is_valid_trainer_rule_settings(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  item jsonb;
  equipment_key text;
  exercise_id text;
begin
  if value is null or jsonb_typeof(value) <> 'object'
    or (value - array['exerciseTemplates', 'progression', 'recovery', 'equipment']::text[]) <> '{}'::jsonb
    or not (value ?& array['exerciseTemplates', 'progression', 'recovery', 'equipment']::text[])
    or jsonb_typeof(value -> 'exerciseTemplates') <> 'array'
    or jsonb_array_length(value -> 'exerciseTemplates') > 20
    or jsonb_typeof(value -> 'progression') <> 'object'
    or jsonb_typeof(value -> 'recovery') <> 'object'
    or jsonb_typeof(value -> 'equipment') <> 'object'
  then return false; end if;

  if ((value -> 'progression') - array['repIncrement', 'smallLoadStepKg']::text[]) <> '{}'::jsonb
    or not ((value -> 'progression') ?& array['repIncrement', 'smallLoadStepKg']::text[])
    or not private.is_bounded_json_number(value #> '{progression,repIncrement}', 1, 2)
    or not private.is_bounded_json_number(value #> '{progression,smallLoadStepKg}', 0.5, 2.5, false)
  then return false; end if;

  if (value -> 'recovery') - array[
    'stopEnergyThreshold', 'stopRecoveryThreshold', 'stopSorenessThreshold',
    'lowEnergyVolumeThreshold', 'highSorenessVolumeThreshold',
    'repeatedHighSorenessSessions', 'volumeReductionSets'
  ]::text[] <> '{}'::jsonb
    or not ((value -> 'recovery') ?& array[
      'stopEnergyThreshold', 'stopRecoveryThreshold', 'stopSorenessThreshold',
      'lowEnergyVolumeThreshold', 'highSorenessVolumeThreshold',
      'repeatedHighSorenessSessions', 'volumeReductionSets'
    ]::text[])
    or not private.is_bounded_json_number(value #> '{recovery,stopEnergyThreshold}', 1, 2)
    or not private.is_bounded_json_number(value #> '{recovery,stopRecoveryThreshold}', 1, 2)
    or not private.is_bounded_json_number(value #> '{recovery,stopSorenessThreshold}', 4, 5)
    or not private.is_bounded_json_number(value #> '{recovery,lowEnergyVolumeThreshold}', 1, 3)
    or not private.is_bounded_json_number(value #> '{recovery,highSorenessVolumeThreshold}', 3, 5)
    or not private.is_bounded_json_number(value #> '{recovery,repeatedHighSorenessSessions}', 1, 3)
    or not private.is_bounded_json_number(value #> '{recovery,volumeReductionSets}', 1, 2)
  then return false; end if;

  if (value -> 'equipment') - array['mode', 'availableEquipment']::text[] <> '{}'::jsonb
    or not ((value -> 'equipment') ?& array['mode', 'availableEquipment']::text[])
    or value #>> '{equipment,mode}' is null
    or value #>> '{equipment,mode}' not in ('inherit', 'unknown', 'verified')
    or jsonb_typeof(value -> 'equipment' -> 'availableEquipment') <> 'array'
    or jsonb_array_length(value -> 'equipment' -> 'availableEquipment') > 8
  then return false; end if;
  if value #>> '{equipment,mode}' in ('inherit', 'unknown')
    and jsonb_array_length(value -> 'equipment' -> 'availableEquipment') <> 0
  then return false; end if;
  for equipment_key in select jsonb_array_elements_text(value -> 'equipment' -> 'availableEquipment') loop
    if equipment_key not in ('dumbbells', 'bench', 'cable_machine', 'leg_press', 'leg_curl_machine', 'rack', 'mat', 'chair') then return false; end if;
  end loop;
  if jsonb_array_length(value -> 'equipment' -> 'availableEquipment') <> (
    select count(distinct item_value)
    from jsonb_array_elements_text(value -> 'equipment' -> 'availableEquipment') as equipment_items(item_value)
  ) then return false; end if;

  for item in select entry_value from jsonb_array_elements(value -> 'exerciseTemplates') as entries(entry_value) loop
    if jsonb_typeof(item) <> 'object'
      or (item - array['exerciseId', 'sets', 'minReps', 'maxReps', 'restSeconds']::text[]) <> '{}'::jsonb
      or not (item ?& array['exerciseId', 'sets', 'minReps', 'maxReps', 'restSeconds']::text[])
    then return false; end if;
    exercise_id := item ->> 'exerciseId';
    if exercise_id is null then return false; end if;
    if exercise_id not in (
      'goblet_squat', 'dumbbell_bench', 'lat_pulldown', 'glute_bridge', 'leg_press',
      'seated_row', 'shoulder_press', 'hamstring_curl', 'incline_pushup', 'chest_row', 'hip_thrust'
    ) then return false; end if;
    if not private.is_bounded_json_number(item -> 'sets', 1, 3)
      or not private.is_bounded_json_number(item -> 'minReps', 4, 20)
      or not private.is_bounded_json_number(item -> 'maxReps', 4, 20)
      or (item ->> 'minReps')::numeric > (item ->> 'maxReps')::numeric
      or not private.is_bounded_json_number(item -> 'restSeconds', 30, 180)
    then return false; end if;
  end loop;
  if jsonb_array_length(value -> 'exerciseTemplates') <> (
    select count(distinct entry_value ->> 'exerciseId') from jsonb_array_elements(value -> 'exerciseTemplates') as entries(entry_value)
  ) then return false; end if;
  return true;
exception when others then
  return false;
end;
$function$;

revoke all on function private.is_bounded_json_number(jsonb, numeric, numeric, boolean) from public, anon;
grant execute on function private.is_bounded_json_number(jsonb, numeric, numeric, boolean) to authenticated;
revoke all on function private.is_valid_trainer_rule_settings(jsonb) from public, anon;
grant execute on function private.is_valid_trainer_rule_settings(jsonb) to authenticated;

alter table public.trainer_rules
  add column rule_settings jsonb not null default '{
    "exerciseTemplates": [],
    "progression": {"repIncrement": 1, "smallLoadStepKg": 1},
    "recovery": {"stopEnergyThreshold": 1, "stopRecoveryThreshold": 1, "stopSorenessThreshold": 5, "lowEnergyVolumeThreshold": 2, "highSorenessVolumeThreshold": 4, "repeatedHighSorenessSessions": 2, "volumeReductionSets": 1},
    "equipment": {"mode": "inherit", "availableEquipment": []}
  }'::jsonb,
  add column rule_revision integer not null default 1 check (rule_revision >= 1);

alter table public.trainer_rules
  add constraint trainer_rules_rule_settings_valid
  check (private.is_valid_trainer_rule_settings(rule_settings));

create or replace function private.guard_trainer_rule_change()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is null
    or new.updated_by is distinct from auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'trainer'
    or new.user_id = auth.uid()
    or not exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = auth.uid() and tc.client_id = new.user_id and tc.status = 'active'
    )
  then raise exception 'Only an authenticated trainer with an active client relationship can change trainer rules.' using errcode = '42501'; end if;
  if not private.is_valid_trainer_rule_settings(new.rule_settings) then
    raise exception 'Trainer rule settings are invalid or outside supported safety limits.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.rule_revision := case
      when new.rule_settings <> '{"exerciseTemplates":[],"progression":{"repIncrement":1,"smallLoadStepKg":1},"recovery":{"stopEnergyThreshold":1,"stopRecoveryThreshold":1,"stopSorenessThreshold":5,"lowEnergyVolumeThreshold":2,"highSorenessVolumeThreshold":4,"repeatedHighSorenessSessions":2,"volumeReductionSets":1},"equipment":{"mode":"inherit","availableEquipment":[]}}'::jsonb
        or new.deadlift_enabled is true then 2
      else 1
    end;
  elsif new.rule_settings is distinct from old.rule_settings or new.deadlift_enabled is distinct from old.deadlift_enabled then
    new.rule_revision := old.rule_revision + 1;
  else
    new.rule_revision := old.rule_revision;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.guard_trainer_rule_change() from public, anon, authenticated;

create trigger trainer_rules_guard_change
  before insert or update on public.trainer_rules
  for each row execute function private.guard_trainer_rule_change();

create or replace function private.guard_workout_deadlift_restriction()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if jsonb_typeof(new.plan_snapshot) <> 'object' or jsonb_typeof(new.plan_snapshot -> 'exercises') <> 'array' then
    raise exception 'Workout plans must contain an exercise list.' using errcode = '23514';
  end if;
  if jsonb_typeof(new.plan_snapshot -> 'exercises') = 'array'
    and exists (
      select 1
      from jsonb_array_elements(new.plan_snapshot -> 'exercises') as plan_items(exercise)
      where lower(coalesce(plan_items.exercise ->> 'id', '') || ' ' || coalesce(plan_items.exercise ->> 'name', ''))
        ~ '(^|[^a-z])(deadlift|rdl|stiff[ -]?leg)([^a-z]|$)'
    )
    and not exists (
      select 1 from public.trainer_rules rules
      where rules.user_id = new.user_id and rules.deadlift_enabled is true
    )
  then raise exception 'A trainer must explicitly approve deadlift variations before they can be saved in a workout plan.' using errcode = '42501'; end if;
  return new;
end;
$function$;

revoke all on function private.guard_workout_deadlift_restriction() from public, anon, authenticated;
create trigger workout_sessions_guard_deadlift
  before insert or update on public.workout_sessions
  for each row execute function private.guard_workout_deadlift_restriction();

create table public.trainer_rule_audit (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  old_rule_settings jsonb not null,
  new_rule_settings jsonb not null,
  old_deadlift_enabled boolean not null,
  new_deadlift_enabled boolean not null,
  changed_at timestamptz not null default now(),
  constraint trainer_rule_audit_not_self check (trainer_id <> client_id)
);

create index trainer_rule_audit_client_changed_idx on public.trainer_rule_audit (client_id, changed_at desc);
alter table public.trainer_rule_audit enable row level security;
revoke all on public.trainer_rule_audit from anon, authenticated;
grant select on public.trainer_rule_audit to authenticated;

create policy "Clients and linked trainers can read rule audit"
  on public.trainer_rule_audit for select to authenticated
  using (
    client_id = (select auth.uid())
    or (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'trainer'
      and exists (
        select 1 from public.trainer_clients tc
        where tc.trainer_id = (select auth.uid())
          and tc.client_id = trainer_rule_audit.client_id
          and tc.status = 'active'
      )
    )
  );

create or replace function private.audit_trainer_rule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  old_settings jsonb;
  old_deadlift boolean;
begin
  if auth.uid() is null
    or new.updated_by is distinct from auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'trainer'
    or new.user_id = auth.uid()
    or not exists (
      select 1 from public.trainer_clients tc
      where tc.trainer_id = auth.uid() and tc.client_id = new.user_id and tc.status = 'active'
    )
  then raise exception 'Rule audit requires an authorized trainer and active client relationship.' using errcode = '42501'; end if;

  if tg_op = 'INSERT' then
    old_settings := '{"exerciseTemplates":[],"progression":{"repIncrement":1,"smallLoadStepKg":1},"recovery":{"stopEnergyThreshold":1,"stopRecoveryThreshold":1,"stopSorenessThreshold":5,"lowEnergyVolumeThreshold":2,"highSorenessVolumeThreshold":4,"repeatedHighSorenessSessions":2,"volumeReductionSets":1},"equipment":{"mode":"inherit","availableEquipment":[]}}'::jsonb;
    old_deadlift := false;
  else
    old_settings := old.rule_settings;
    old_deadlift := old.deadlift_enabled;
  end if;
  if old_settings is distinct from new.rule_settings or old_deadlift is distinct from new.deadlift_enabled then
    insert into public.trainer_rule_audit (trainer_id, client_id, old_rule_settings, new_rule_settings, old_deadlift_enabled, new_deadlift_enabled)
    values (auth.uid(), new.user_id, old_settings, new.rule_settings, old_deadlift, new.deadlift_enabled);
  end if;
  return new;
end;
$function$;

revoke all on function private.audit_trainer_rule_change() from public, anon, authenticated;

create trigger trainer_rules_audit_change
  after insert or update on public.trainer_rules
  for each row execute function private.audit_trainer_rule_change();

comment on table public.trainer_rule_audit is 'Append-only audit trail for explicit trainer rule and restriction changes.';
comment on column public.trainer_rules.rule_settings is 'Bounded deterministic planner overrides validated by the database. Pain recovery and deadlift authorization remain separate hard rules.';
