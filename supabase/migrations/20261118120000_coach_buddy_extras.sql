-- Phase 6 step C — coach-buddy extras.
--   1. Coach in the group: when one member is an active trainer AND every other active member has them as an active
--      trainer, that member is the group's coach. A coach's plan change applies straight away (no proposal round):
--      the clients already chose this trainer to adjust their plan.
--   2. A lighter week: a trainer can make the current week (Monday–Sunday) lighter for a client — fewer sets, same
--      session. When that client trains in a group the trainer coaches, the whole group gets the lighter week, so
--      buddies stay on the same session. profiles.light_week_start holds the Monday; the app's planner reads it.
--   3. "Train together" gym QR: a trainer can make a QR that adds them as your trainer AND puts you in their buddy
--      group (their plan, same session each day). Showing the QR is the trainer's consent, so no friendship is needed.

alter table public.profiles add column if not exists light_week_start date;
comment on column public.profiles.light_week_start is 'Monday of a week a trainer made lighter (fewer sets, same session). Set only through trainer_set_light_week().';

alter table public.trainer_invites add column if not exists together boolean not null default false;
comment on column public.trainer_invites.together is 'A "Train together" QR: whoever uses it also joins the trainer''s buddy group.';

-- ---------- Helpers ----------

-- The group's coach: the active member who is an active trainer of every other active member (null if none).
create or replace function private.buddy_coach(p_group uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coach.user_id
  from public.buddy_members coach
  where coach.group_id = p_group and coach.status = 'active'
    and private.is_trainer_user(coach.user_id)
    and (select count(*) from public.buddy_members others where others.group_id = p_group and others.status = 'active') >= 2
    and not exists (
      select 1 from public.buddy_members others
      where others.group_id = p_group and others.status = 'active' and others.user_id <> coach.user_id
        and not exists (
          select 1 from public.trainer_clients links
          where links.trainer_id = coach.user_id and links.client_id = others.user_id and links.status = 'active'
        )
    )
  order by coach.joined_at nulls last
  limit 1;
$$;
revoke all on function private.buddy_coach(uuid) from public;

-- ---------- 1. A coach changes the shared plan directly ----------

create or replace function public.propose_buddy_plan(p_goal text, p_training_days integer[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
  v_days integer[] := (select array_agg(distinct day order by day) from unnest(coalesce(p_training_days, '{}')) as days(day));
  v_coach boolean;
  v_id uuid;
begin
  if v_user is null or v_group is null then raise exception 'You aren''t in a buddy group.' using errcode = '22023'; end if;
  if p_goal not in ('general', 'muscle', 'tone', 'fatloss') then raise exception 'Choose a goal.' using errcode = '22023'; end if;
  if v_days is null or cardinality(v_days) not between 3 and 6 or not v_days <@ array[0, 1, 2, 3, 4, 5, 6] then
    raise exception 'Choose 3 to 6 training days.' using errcode = '22023';
  end if;
  v_coach := private.buddy_coach(v_group) = v_user;
  update public.buddy_proposals proposals set status = 'replaced', decided_at = now() where proposals.group_id = v_group and proposals.status = 'pending';
  insert into public.buddy_proposals (group_id, proposed_by, goal, training_days, accepted_by, status, decided_at)
  values (v_group, v_user, p_goal, v_days, array[v_user], case when v_coach then 'accepted' else 'pending' end, case when v_coach then now() end)
  returning id into v_id;
  if v_coach then
    update public.buddy_groups groups set goal = p_goal, training_days = v_days, anchor_date = current_date, updated_at = now() where groups.id = v_group;
    perform private.apply_buddy_plan(v_group);
  end if;
  return v_id;
end;
$$;

-- ---------- 2. A lighter week ----------

-- Turns this week's lighter sessions on or off for a client (and their whole group when this trainer coaches it).
-- Returns the Monday it applies from, or null when turned off.
create or replace function public.trainer_set_light_week(p_client uuid, p_on boolean)
returns date language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_monday date := current_date - ((extract(isodow from current_date)::integer) - 1);
  v_group uuid;
begin
  if v_user is null or not private.is_trainer() then raise exception 'Only a trainer can make a week lighter.' using errcode = '42501'; end if;
  if not exists (select 1 from public.trainer_clients links where links.trainer_id = v_user and links.client_id = p_client and links.status = 'active') then
    raise exception 'This person isn''t your client.' using errcode = '42501';
  end if;
  select members.group_id into v_group from public.buddy_members members where members.user_id = p_client and members.status = 'active' limit 1;
  if v_group is not null and private.buddy_coach(v_group) = v_user then
    update public.profiles profiles set light_week_start = case when p_on then v_monday end, updated_at = now()
      where profiles.id in (select members.user_id from public.buddy_members members where members.group_id = v_group and members.status = 'active');
  else
    update public.profiles profiles set light_week_start = case when p_on then v_monday end, updated_at = now() where profiles.id = p_client;
  end if;
  return case when p_on then v_monday end;
end;
$$;

-- Which of my clients have a lighter week right now.
create or replace function public.trainer_light_weeks()
returns table (client_id uuid, light_week_start date) language sql stable security definer set search_path = '' as $$
  select profiles.id, profiles.light_week_start
  from public.trainer_clients links
  join public.profiles profiles on profiles.id = links.client_id
  where links.trainer_id = (select auth.uid()) and links.status = 'active' and private.is_trainer()
    and profiles.light_week_start is not null and profiles.light_week_start > current_date - 7;
$$;

-- ---------- 3. "Train together" gym QR ----------

-- A gym QR code; with p_together the person who uses it also joins your buddy group.
create or replace function public.create_trainer_invite(p_together boolean)
returns table (code text, expires_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_expires timestamptz;
begin
  select made.code, made.expires_at into v_code, v_expires from public.create_trainer_invite() as made;
  update public.trainer_invites invites set together = coalesce(p_together, false) where invites.code = v_code;
  return query select v_code, v_expires;
end;
$$;

-- Who a code belongs to, and whether it's a "Train together" QR.
drop function if exists public.trainer_invite_info(text);
create function public.trainer_invite_info(p_code text)
returns table (trainer_id uuid, display_name text, avatar text, together boolean)
language sql stable security definer set search_path = '' as $$
  select invites.trainer_id, coalesce(profiles.display_name, 'Your trainer'), coalesce(profiles.avatar, ''), invites.together
  from public.trainer_invites invites
  left join public.profiles profiles on profiles.id = invites.trainer_id
  where (select auth.uid()) is not null and invites.code = upper(btrim(coalesce(p_code, '')))
    and invites.accepted_at is null and invites.expires_at > now() and private.is_trainer_user(invites.trainer_id);
$$;

-- After using a "Train together" QR (accept_trainer_invite first): join the trainer's group, or start one with them.
-- Your plan switches to the group's. Fails, leaving the trainer link in place, if you're already in a group or it's full.
create or replace function public.join_trainer_group(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.trainer_invites%rowtype;
  v_group uuid;
  v_active integer;
begin
  if v_user is null then raise exception 'Sign in to train together.' using errcode = '42501'; end if;
  select * into v_invite from public.trainer_invites invites
    where invites.code = upper(btrim(coalesce(p_code, ''))) and invites.together and invites.accepted_by = v_user
      and invites.accepted_at > now() - interval '1 day';
  if not found or not private.is_trainer_user(v_invite.trainer_id) then
    raise exception 'This QR isn''t a Train together code, or it has expired.' using errcode = '22023';
  end if;
  if private.my_buddy_group() is not null then
    raise exception 'You''re already training together with a group. Leave it first to join your trainer''s.' using errcode = '22023';
  end if;
  select members.group_id into v_group from public.buddy_members members where members.user_id = v_invite.trainer_id and members.status = 'active' limit 1;
  if v_group is null then
    insert into public.buddy_groups (created_by, goal, training_days, anchor_date)
    select v_invite.trainer_id, coalesce(profiles.goal, 'general'), coalesce(nullif(profiles.training_days, '{}'), array[1, 3, 5]), current_date
    from public.profiles profiles where profiles.id = v_invite.trainer_id
    returning id into v_group;
    if v_group is null then raise exception 'Your trainer needs to finish setting up their plan first.' using errcode = '22023'; end if;
    insert into public.buddy_members (group_id, user_id, status, invited_by, joined_at) values (v_group, v_invite.trainer_id, 'active', v_invite.trainer_id, now());
  end if;
  v_active := (select count(*) from public.buddy_members members where members.group_id = v_group and members.status = 'active');
  if v_active >= 4 then raise exception 'Your trainer''s group is full (4 people).' using errcode = '22023'; end if;
  -- The first buddy to join starts the shared rotation today (for everyone).
  if v_active = 1 then update public.buddy_groups groups set anchor_date = current_date, updated_at = now() where groups.id = v_group; end if;
  insert into public.buddy_members (group_id, user_id, status, invited_by, joined_at, updated_at)
  values (v_group, v_user, 'active', v_invite.trainer_id, now(), now())
  on conflict (group_id, user_id) do update set status = 'active', invited_by = v_invite.trainer_id, joined_at = now(), updated_at = now();
  perform private.apply_buddy_plan(v_group);
  return v_group;
end;
$$;

-- ---------- Overview: the coach and lighter weeks ----------

create or replace function public.buddy_overview(p_since date default current_date - 35)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
  v_since date := greatest(coalesce(p_since, current_date - 35), current_date - 90);
begin
  if v_user is null then return null; end if;
  return jsonb_build_object(
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('group_id', invites.group_id, 'from', coalesce(inviter.display_name, 'A friend'), 'from_avatar', coalesce(inviter.avatar, ''),
        'goal', groups.goal, 'training_days', groups.training_days,
        'members', (select count(*) from public.buddy_members others where others.group_id = invites.group_id and others.status = 'active')))
      from public.buddy_members invites
      join public.buddy_groups groups on groups.id = invites.group_id
      left join public.profiles inviter on inviter.id = invites.invited_by
      where invites.user_id = v_user and invites.status = 'invited'), '[]'::jsonb),
    'group', case when v_group is null then null else (
      select jsonb_build_object('id', groups.id, 'goal', groups.goal, 'training_days', groups.training_days, 'anchor_date', groups.anchor_date,
        'created_by', groups.created_by, 'coach', private.buddy_coach(groups.id))
      from public.buddy_groups groups where groups.id = v_group) end,
    'members', case when v_group is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('user_id', members.user_id, 'name', coalesce(profiles.display_name, 'Buddy'), 'avatar', coalesce(profiles.avatar, ''),
        'status', members.status, 'share_reasons', members.share_reasons, 'at_gym', members.at_gym_until > now(), 'time_zone', profiles.time_zone,
        'light_week', profiles.light_week_start is not null and profiles.light_week_start > current_date - 7) order by members.joined_at nulls last)
      from public.buddy_members members left join public.profiles profiles on profiles.id = members.user_id
      where members.group_id = v_group and members.status in ('active', 'invited')), '[]'::jsonb) end,
    'days', case when v_group is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('user_id', sessions.user_id, 'date', sessions.workout_date, 'status', sessions.status,
        'reason', case when members.share_reasons or sessions.user_id = v_user then sessions.missed_reason end) order by sessions.workout_date)
      from public.workout_sessions sessions
      join public.buddy_members members on members.user_id = sessions.user_id and members.group_id = v_group and members.status = 'active'
      where sessions.workout_date >= v_since), '[]'::jsonb) end,
    'carries', case when v_group is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('date', carries.carried_date, 'by', carries.carried_by)) from public.buddy_carries carries
      where carries.group_id = v_group and carries.carried_date >= v_since), '[]'::jsonb) end,
    'proposal', case when v_group is null then null else (
      select jsonb_build_object('id', proposals.id, 'by', proposals.proposed_by, 'goal', proposals.goal, 'training_days', proposals.training_days, 'accepted_by', proposals.accepted_by, 'at', proposals.created_at)
      from public.buddy_proposals proposals where proposals.group_id = v_group and proposals.status = 'pending' order by proposals.created_at desc limit 1) end
  );
end;
$$;

-- ---------- Access ----------

revoke all on function public.trainer_set_light_week(uuid, boolean), public.trainer_light_weeks(), public.create_trainer_invite(boolean),
  public.trainer_invite_info(text), public.join_trainer_group(text) from public, anon;
grant execute on function public.trainer_set_light_week(uuid, boolean), public.trainer_light_weeks(), public.create_trainer_invite(boolean),
  public.trainer_invite_info(text), public.join_trainer_group(text) to authenticated;
