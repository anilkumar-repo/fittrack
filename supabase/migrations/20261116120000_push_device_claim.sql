-- A phone has one push subscription (endpoint). When someone signs in to a different account on the same
-- phone and turns notifications on, the plain upsert failed: the row belonged to the other account, and the
-- "change" policy only allows updating your own rows ("new row violates row-level security policy").
-- This function lets the signed-in person take over the subscription for their device: the endpoint itself
-- proves the device, and only the signed-in user can be written as the owner.

create or replace function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_time_zone text,
  p_morning boolean,
  p_morning_hour smallint,
  p_evening boolean,
  p_evening_hour smallint,
  p_nudges boolean,
  p_hydration boolean,
  p_comeback boolean,
  p_weigh_in boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  insert into public.push_subscriptions as s (
    user_id, endpoint, p256dh, auth, time_zone, morning, morning_hour, evening, evening_hour, nudges, hydration, comeback, weigh_in, updated_at
  ) values (
    me, p_endpoint, p_p256dh, p_auth, p_time_zone, p_morning, p_morning_hour, p_evening, p_evening_hour, p_nudges, p_hydration, p_comeback, p_weigh_in, now()
  )
  on conflict (endpoint) do update set
    user_id = me,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    time_zone = excluded.time_zone,
    morning = excluded.morning,
    morning_hour = excluded.morning_hour,
    evening = excluded.evening,
    evening_hour = excluded.evening_hour,
    nudges = excluded.nudges,
    hydration = excluded.hydration,
    comeback = excluded.comeback,
    weigh_in = excluded.weigh_in,
    -- A new owner starts fresh, so today's reminders are not skipped because the old account got them.
    last_morning_on = case when s.user_id = me then s.last_morning_on else null end,
    last_evening_on = case when s.user_id = me then s.last_evening_on else null end,
    updated_at = now();
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text, text, boolean, smallint, boolean, smallint, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text, text, boolean, smallint, boolean, smallint, boolean, boolean, boolean, boolean) to authenticated;
