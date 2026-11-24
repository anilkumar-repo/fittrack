-- R4 (2026-11-23): two new equipment choices, resistance bands and a kettlebell.
-- Widens the two places that list the allowed equipment keys (15 → 17). Existing rows stay valid (the list only grows).
-- No data changes, no new tables, no new permissions.

-- 1. Profiles: allowed equipment keys.
alter table public.profiles drop constraint if exists profiles_available_equipment_check;
alter table public.profiles
  add constraint profiles_available_equipment_check check (
    cardinality(available_equipment) <= 17
    and available_equipment <@ array[
      'dumbbells', 'bench', 'cable_machine', 'leg_press', 'leg_curl_machine', 'rack', 'mat', 'chair',
      'barbell', 'smith_machine', 'gym_machines', 'pullup_bar', 'step', 'back_extension', 'cardio_machine',
      'resistance_band', 'kettlebell'
    ]::text[]
  );

-- 2. Trainer equipment settings accept the same 17 choices (same function as before, only the key list and limit change;
--    create or replace keeps its existing grants).
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
    or jsonb_array_length(value -> 'exerciseTemplates') > 60
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
    or jsonb_array_length(value -> 'equipment' -> 'availableEquipment') > 17
  then return false; end if;
  if value #>> '{equipment,mode}' in ('inherit', 'unknown')
    and jsonb_array_length(value -> 'equipment' -> 'availableEquipment') <> 0
  then return false; end if;
  for equipment_key in select jsonb_array_elements_text(value -> 'equipment' -> 'availableEquipment') loop
    if equipment_key not in (
      'dumbbells', 'bench', 'cable_machine', 'leg_press', 'leg_curl_machine', 'rack', 'mat', 'chair',
      'barbell', 'smith_machine', 'gym_machines', 'pullup_bar', 'step', 'back_extension', 'cardio_machine',
      'resistance_band', 'kettlebell'
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
    -- Any exercise from the goal programs; the app checks the exact list. Deadlift variations are never allowed here.
    if exercise_id !~ '^[a-z][a-z0-9_]{1,59}$' or exercise_id in ('dumbbell_rdl', 'barbell_rdl') then return false; end if;
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
