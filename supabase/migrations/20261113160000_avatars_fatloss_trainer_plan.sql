-- Profile pictures, the "Lose weight" goal, and trainers editing a client's plan.

-- 1. "Lose weight" goal.
alter table public.profiles drop constraint if exists profiles_goal_check;
alter table public.profiles add constraint profiles_goal_check check (goal in ('general', 'muscle', 'tone', 'fatloss'));
alter table public.friend_stats drop constraint if exists friend_stats_goal_check;
alter table public.friend_stats add constraint friend_stats_goal_check check (goal in ('general', 'muscle', 'tone', 'fatloss'));

-- 2. Profile pictures: "photo:<storage link>", "rozi:<mood>" or "color:<hex>". Friends see the picture through friend_stats.
alter table public.profiles add column if not exists avatar text not null default ''
  check (char_length(avatar) <= 500 and (avatar = '' or avatar ~ '^(photo:https://|rozi:[a-z0-9-]{1,30}$|color:#[0-9a-fA-F]{6}$)'));
alter table public.friend_stats add column if not exists avatar text not null default ''
  check (char_length(avatar) <= 500 and (avatar = '' or avatar ~ '^(photo:https://|rozi:[a-z0-9-]{1,30}$|color:#[0-9a-fA-F]{6}$)'));

-- Photos live in a public "avatars" bucket under a folder named after the owner; names are random.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "Avatars: upload own" on storage.objects;
drop policy if exists "Avatars: replace own" on storage.objects;
drop policy if exists "Avatars: delete own" on storage.objects;
create policy "Avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3. A linked trainer can change a client's goal, training days and session length.
create or replace function public.trainer_update_client_plan(p_client uuid, p_goal text, p_training_days integer[], p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer' then
    raise exception 'Only a trainer account can change a client''s plan.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.trainer_clients links where links.trainer_id = v_user and links.client_id = p_client and links.status = 'active') then
    raise exception 'This client is not linked to your trainer account.' using errcode = '42501';
  end if;
  if p_goal not in ('general', 'muscle', 'tone', 'fatloss') or p_minutes not in (30, 40, 50) then
    raise exception 'Choose a valid goal and session length.' using errcode = '22023';
  end if;
  update public.profiles
    set goal = p_goal, training_days = p_training_days, sessions_per_week = cardinality(p_training_days),
        preferred_session_minutes = p_minutes, updated_at = now()
    where id = p_client;
  if not found then raise exception 'The client has no saved profile yet.' using errcode = '22023'; end if;
end;
$function$;
revoke all on function public.trainer_update_client_plan(uuid, text, integer[], integer) from public, anon;
grant execute on function public.trainer_update_client_plan(uuid, text, integer[], integer) to authenticated;

-- 4. Trainer exercise changes may use any exercise from the goal programs (up to 60 entries).
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
