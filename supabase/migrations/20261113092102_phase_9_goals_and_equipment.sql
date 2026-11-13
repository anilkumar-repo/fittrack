-- Phase 9: training goal on the profile, and the wider equipment list used by goal-based programs.

alter table public.profiles
  add column if not exists goal text not null default 'general'
    check (goal in ('general', 'muscle', 'tone'));

-- The equipment list grows from 8 to 15 choices.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%available_equipment%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_available_equipment_check check (
    cardinality(available_equipment) <= 15
    and available_equipment <@ array[
      'dumbbells', 'bench', 'cable_machine', 'leg_press', 'leg_curl_machine', 'rack', 'mat', 'chair',
      'barbell', 'smith_machine', 'gym_machines', 'pullup_bar', 'step', 'back_extension', 'cardio_machine'
    ]::text[]
  );

-- Trainer equipment settings accept the same 15 choices.
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
    or jsonb_array_length(value -> 'equipment' -> 'availableEquipment') > 15
  then return false; end if;
  if value #>> '{equipment,mode}' in ('inherit', 'unknown')
    and jsonb_array_length(value -> 'equipment' -> 'availableEquipment') <> 0
  then return false; end if;
  for equipment_key in select jsonb_array_elements_text(value -> 'equipment' -> 'availableEquipment') loop
    if equipment_key not in (
      'dumbbells', 'bench', 'cable_machine', 'leg_press', 'leg_curl_machine', 'rack', 'mat', 'chair',
      'barbell', 'smith_machine', 'gym_machines', 'pullup_bar', 'step', 'back_extension', 'cardio_machine'
    ) then return false; end if;
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
