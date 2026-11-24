-- Rozi agent (R11, 2026-11-24): weekly check-ins the person opts into.
--
--   * rozi_checkin_settings: one row per person: on/off (off by default), which day and hour, when they agreed,
--     and the last week a check-in was sent. Closed table (row-level security on, no policies, no grants).
--   * No summary is stored. The hourly schedule (already running for push) counts last week's workouts from the
--     saved sessions and sends one notification; tapping it opens "Your week with Rozi". No AI call is made.
--   * The person reads and changes their own row only through the owner-checked functions below. The server
--     (service role) can list who opted in and mark a week as sent, once per week.
--   * Deleted with the account (cascade).

create table if not exists public.rozi_checkin_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  -- 0 = Sunday … 6 = Saturday (same as the app's weekdayOf).
  weekday smallint not null default 1 check (weekday between 0 and 6),
  hour smallint not null default 9 check (hour between 5 and 21),
  consented_at timestamptz,
  last_sent_week date,
  updated_at timestamptz not null default now()
);

alter table public.rozi_checkin_settings enable row level security;
revoke all on public.rozi_checkin_settings from anon, authenticated;
comment on table public.rozi_checkin_settings is 'Weekly Rozi check-in choices. Closed: use the rozi_*checkin* functions.';

-- The person's choices (defaults when they never chose).
create or replace function public.rozi_my_checkin_settings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('enabled', s.enabled, 'weekday', s.weekday, 'hour', s.hour, 'consented_at', s.consented_at)
       from public.rozi_checkin_settings s where s.user_id = (select auth.uid())),
    jsonb_build_object('enabled', false, 'weekday', 1, 'hour', 9, 'consented_at', null));
$$;

-- Turn check-ins on or off and pick the day and hour (the person's own tap).
create or replace function public.rozi_set_checkin_settings(p_enabled boolean, p_weekday smallint, p_hour smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_enabled is null or p_weekday is null or p_weekday not between 0 and 6 or p_hour is null or p_hour not between 5 and 21 then
    raise exception 'Pick a day and an hour between 5:00 and 21:00.' using errcode = '22023';
  end if;
  insert into public.rozi_checkin_settings (user_id, enabled, weekday, hour, consented_at, updated_at)
  values (v_user, p_enabled, p_weekday, p_hour, case when p_enabled then now() end, now())
  on conflict (user_id) do update set
    enabled = excluded.enabled, weekday = excluded.weekday, hour = excluded.hour, updated_at = now(),
    -- The moment they agreed: set when switched on, kept while on, cleared when switched off.
    consented_at = case when not excluded.enabled then null
                        when public.rozi_checkin_settings.enabled then public.rozi_checkin_settings.consented_at
                        else now() end;
  return public.rozi_my_checkin_settings();
end;
$$;

-- Server only: everyone who opted in, with their day, hour and last sent week.
create or replace function public.rozi_checkin_people()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'weekday', s.weekday, 'hour', s.hour, 'last_sent_week', s.last_sent_week)), '[]'::jsonb)
  from public.rozi_checkin_settings s where s.enabled;
$$;

-- Server only: claims one week for one person. True the first time only, so a week is never sent twice,
-- and false when the person has switched check-ins off.
create or replace function public.rozi_mark_checkin_sent(p_user uuid, p_week date)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_week is null then return false; end if;
  update public.rozi_checkin_settings set last_sent_week = p_week
    where user_id = p_user and enabled and last_sent_week is distinct from p_week;
  return found;
end;
$$;

revoke all on function public.rozi_my_checkin_settings(), public.rozi_set_checkin_settings(boolean, smallint, smallint),
  public.rozi_checkin_people(), public.rozi_mark_checkin_sent(uuid, date) from public, anon, authenticated;
grant execute on function public.rozi_my_checkin_settings(), public.rozi_set_checkin_settings(boolean, smallint, smallint) to authenticated;
grant execute on function public.rozi_checkin_people(), public.rozi_mark_checkin_sent(uuid, date) to service_role;
