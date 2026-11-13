-- Fitness levels: beginner, intermediate, advanced, pro.
-- The level is picked in Get started (or by a trainer), and moves up by itself with steady training.

-- 1. Allow the two new levels.
alter table public.profiles drop constraint if exists profiles_experience_check;
alter table public.profiles add constraint profiles_experience_check
  check (experience in ('beginner', 'intermediate', 'advanced', 'pro'));

-- 2. The day the current level started (null = the training start date).
alter table public.profiles add column if not exists level_since date;

-- 3. A linked trainer can also set the client's level. The old 4-argument version is replaced.
drop function if exists public.trainer_update_client_plan(uuid, text, integer[], integer);
create or replace function public.trainer_update_client_plan(p_client uuid, p_goal text, p_training_days integer[], p_minutes integer, p_experience text default null)
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
  if p_goal not in ('general', 'muscle', 'tone', 'fatloss') or p_minutes not in (30, 40, 50)
    or (p_experience is not null and p_experience not in ('beginner', 'intermediate', 'advanced', 'pro')) then
    raise exception 'Choose a valid goal, level and session length.' using errcode = '22023';
  end if;
  update public.profiles
    set goal = p_goal, training_days = p_training_days, sessions_per_week = cardinality(p_training_days),
        preferred_session_minutes = p_minutes,
        -- A changed level starts today; an unchanged one keeps its start day.
        level_since = case when p_experience is not null and p_experience <> experience then current_date else level_since end,
        experience = coalesce(p_experience, experience),
        updated_at = now()
    where id = p_client;
  if not found then raise exception 'The client has no saved profile yet.' using errcode = '22023'; end if;
end;
$function$;
revoke all on function public.trainer_update_client_plan(uuid, text, integer[], integer, text) from public, anon;
grant execute on function public.trainer_update_client_plan(uuid, text, integer[], integer, text) to authenticated;
