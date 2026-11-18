-- Phase 6 step B — Train together.
--   Friends form a buddy group (you + up to 3; one group per person) that follows ONE plan: the same goal, the
--   same training days and the same session each day. The rotation follows the calendar from the group's start date
--   (profiles.buddy_anchor), so a skip never puts buddies out of step. Weights, level and equipment stay personal.
--   Plan changes are proposals that apply once every member accepts. Members see each other's day (done / skipped /
--   planned), a skip reason only if that member shares reasons, and "at the gym". One streak "carry" per group per week.
--   Notifications (finished / skipped / evening / both rested) are sent by the server; buddy_push_log prevents repeats.

alter table public.profiles add column if not exists buddy_anchor date;
comment on column public.profiles.buddy_anchor is 'Set while in a buddy group: the plan rotation follows the calendar from this date (the same session for every buddy).';

create table if not exists public.buddy_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  goal text not null check (goal in ('general', 'muscle', 'tone', 'fatloss')),
  training_days integer[] not null check (cardinality(training_days) between 3 and 6 and training_days <@ array[0, 1, 2, 3, 4, 5, 6]),
  anchor_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buddy_members (
  group_id uuid not null references public.buddy_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'left', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  share_reasons boolean not null default false,
  at_gym_until timestamptz,
  joined_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
-- One active group per person.
create unique index if not exists buddy_members_one_group_idx on public.buddy_members (user_id) where status = 'active';
create index if not exists buddy_members_user_idx on public.buddy_members (user_id, status);

create table if not exists public.buddy_proposals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.buddy_groups (id) on delete cascade,
  proposed_by uuid not null references auth.users (id) on delete cascade,
  goal text not null check (goal in ('general', 'muscle', 'tone', 'fatloss')),
  training_days integer[] not null check (cardinality(training_days) between 3 and 6 and training_days <@ array[0, 1, 2, 3, 4, 5, 6]),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'replaced')),
  accepted_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists buddy_proposals_group_idx on public.buddy_proposals (group_id, status);

create table if not exists public.buddy_carries (
  group_id uuid not null references public.buddy_groups (id) on delete cascade,
  week_start date not null,
  carried_date date not null,
  carried_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, week_start)
);

create table if not exists public.buddy_push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  sent_on date not null,
  from_user uuid not null default '00000000-0000-0000-0000-000000000000',
  created_at timestamptz not null default now(),
  primary key (user_id, kind, sent_on, from_user)
);
comment on table public.buddy_push_log is 'Server only: which buddy notifications were sent, so none repeats.';

alter table public.buddy_groups enable row level security;
alter table public.buddy_members enable row level security;
alter table public.buddy_proposals enable row level security;
alter table public.buddy_carries enable row level security;
alter table public.buddy_push_log enable row level security;
revoke all on public.buddy_groups, public.buddy_members, public.buddy_proposals, public.buddy_carries, public.buddy_push_log from anon, authenticated;
-- Everything is read through buddy_overview() and changed through the functions below.

-- ---------- Helpers ----------

create or replace function private.my_buddy_group()
returns uuid language sql stable security definer set search_path = '' as $$
  select members.group_id from public.buddy_members members where members.user_id = (select auth.uid()) and members.status = 'active' limit 1;
$$;

-- Copies the group's plan onto every active member's profile (goal, days and the calendar rotation start).
create or replace function private.apply_buddy_plan(p_group uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles profiles
    set goal = groups.goal, training_days = groups.training_days, sessions_per_week = cardinality(groups.training_days),
        buddy_anchor = groups.anchor_date, updated_at = now()
    from public.buddy_groups groups
    join public.buddy_members members on members.group_id = groups.id and members.status = 'active'
    where groups.id = p_group and profiles.id = members.user_id;
end;
$$;

-- With fewer than two active people, nobody trains "together": the remaining person's plan goes back to normal
-- rotation. The group itself ends unless invites are still open (then it waits for someone to accept).
create or replace function private.close_buddy_group_if_alone(p_group uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_active integer := (select count(*) from public.buddy_members members where members.group_id = p_group and members.status = 'active');
  v_invited integer := (select count(*) from public.buddy_members members where members.group_id = p_group and members.status = 'invited');
begin
  if v_active >= 2 then return; end if;
  update public.profiles profiles set buddy_anchor = null, updated_at = now()
    where profiles.id in (select members.user_id from public.buddy_members members where members.group_id = p_group and members.status = 'active');
  update public.buddy_proposals proposals set status = 'replaced', decided_at = now() where proposals.group_id = p_group and proposals.status = 'pending';
  if v_active = 0 or v_invited = 0 then
    update public.buddy_members members set status = 'left', at_gym_until = null, updated_at = now()
      where members.group_id = p_group and members.status in ('active', 'invited');
  end if;
end;
$$;

-- While someone is in a buddy group, their goal, days and rotation start always stay the group's: an app holding an
-- older copy of the profile can't undo the sync by saving it (changes go through proposals).
create or replace function private.keep_buddy_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_group public.buddy_groups%rowtype;
begin
  select groups.* into v_group from public.buddy_groups groups
    join public.buddy_members members on members.group_id = groups.id and members.status = 'active'
    where members.user_id = new.id
      and (select count(*) from public.buddy_members others where others.group_id = groups.id and others.status = 'active') >= 2
    limit 1;
  if found then
    new.goal := v_group.goal;
    new.training_days := v_group.training_days;
    new.sessions_per_week := cardinality(v_group.training_days);
    new.buddy_anchor := v_group.anchor_date;
  end if;
  return new;
end;
$$;
drop trigger if exists keep_buddy_plan on public.profiles;
create trigger keep_buddy_plan before update on public.profiles for each row execute function private.keep_buddy_plan();

revoke all on function private.my_buddy_group(), private.apply_buddy_plan(uuid), private.close_buddy_group_if_alone(uuid), private.keep_buddy_plan() from public;
grant execute on function private.my_buddy_group() to authenticated;

-- ---------- Functions ----------

-- Invite a friend to train together. Starts a group from your current plan if you aren't in one.
create or replace function public.invite_buddy(p_friend uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid;
  v_existing text;
begin
  if v_user is null then raise exception 'Sign in to train together.' using errcode = '42501'; end if;
  if p_friend is null or p_friend = v_user then raise exception 'Choose a friend.' using errcode = '22023'; end if;
  if not private.are_friends(v_user, p_friend) then raise exception 'You can only invite friends.' using errcode = '22023'; end if;
  v_group := private.my_buddy_group();
  if v_group is null then
    insert into public.buddy_groups (created_by, goal, training_days, anchor_date)
    select v_user, coalesce(profiles.goal, 'general'), coalesce(nullif(profiles.training_days, '{}'), array[1, 3, 5]), current_date
    from public.profiles profiles where profiles.id = v_user
    returning id into v_group;
    if v_group is null then raise exception 'Finish setting up your plan first.' using errcode = '22023'; end if;
    -- Your plan only switches to the shared rotation once someone accepts.
    insert into public.buddy_members (group_id, user_id, status, invited_by, joined_at) values (v_group, v_user, 'active', v_user, now());
  end if;
  select members.status into v_existing from public.buddy_members members where members.group_id = v_group and members.user_id = p_friend;
  if v_existing in ('active', 'invited') then return v_group; end if;
  if (select count(*) from public.buddy_members members where members.group_id = v_group and members.status in ('active', 'invited')) >= 4 then
    raise exception 'A group can have up to 4 people (you and 3 buddies).' using errcode = '22023';
  end if;
  insert into public.buddy_members (group_id, user_id, status, invited_by, updated_at) values (v_group, p_friend, 'invited', v_user, now())
  on conflict (group_id, user_id) do update set status = 'invited', invited_by = v_user, updated_at = now();
  return v_group;
end;
$$;

-- Accept or decline an invite. Accepting switches your plan to the group's (goal, days, same session each day).
create or replace function public.respond_buddy_invite(p_group uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Sign in to train together.' using errcode = '42501'; end if;
  if not exists (select 1 from public.buddy_members members where members.group_id = p_group and members.user_id = v_user and members.status = 'invited') then
    raise exception 'This invite is no longer open.' using errcode = '22023';
  end if;
  if not p_accept then
    update public.buddy_members members set status = 'declined', updated_at = now() where members.group_id = p_group and members.user_id = v_user;
    perform private.close_buddy_group_if_alone(p_group);
    return false;
  end if;
  if private.my_buddy_group() is not null then raise exception 'Leave your current buddy group first (you can be in one).' using errcode = '22023'; end if;
  if (select count(*) from public.buddy_members members where members.group_id = p_group and members.status = 'active') >= 4 then
    raise exception 'This group is full.' using errcode = '22023';
  end if;
  -- The first buddy to join starts the shared rotation today (for both of you).
  if (select count(*) from public.buddy_members members where members.group_id = p_group and members.status = 'active') = 1 then
    update public.buddy_groups groups set anchor_date = current_date, updated_at = now() where groups.id = p_group;
  end if;
  update public.buddy_members members set status = 'active', joined_at = now(), updated_at = now() where members.group_id = p_group and members.user_id = v_user;
  perform private.apply_buddy_plan(p_group);
  return true;
end;
$$;

-- Leave the group (or cancel an invite you sent to someone: p_member).
create or replace function public.leave_buddy_group(p_member uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
  v_cancelled boolean;
begin
  if v_user is null or v_group is null then raise exception 'You aren''t in a buddy group.' using errcode = '22023'; end if;
  if p_member is not null and p_member <> v_user then
    -- Only invites can be cancelled by someone else; active buddies leave themselves.
    update public.buddy_members members set status = 'declined', updated_at = now()
      where members.group_id = v_group and members.user_id = p_member and members.status = 'invited';
    v_cancelled := found;
    perform private.close_buddy_group_if_alone(v_group);
    return v_cancelled;
  end if;
  update public.buddy_members members set status = 'left', at_gym_until = null, updated_at = now() where members.group_id = v_group and members.user_id = v_user;
  update public.profiles profiles set buddy_anchor = null, updated_at = now() where profiles.id = v_user;
  update public.buddy_proposals proposals set status = 'replaced', decided_at = now() where proposals.group_id = v_group and proposals.status = 'pending';
  perform private.close_buddy_group_if_alone(v_group);
  return true;
end;
$$;

-- Propose a plan change (goal and/or days). Replaces an earlier open proposal. Applies once everyone accepts.
create or replace function public.propose_buddy_plan(p_goal text, p_training_days integer[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
  v_days integer[] := (select array_agg(distinct day order by day) from unnest(coalesce(p_training_days, '{}')) as days(day));
  v_id uuid;
begin
  if v_user is null or v_group is null then raise exception 'You aren''t in a buddy group.' using errcode = '22023'; end if;
  if p_goal not in ('general', 'muscle', 'tone', 'fatloss') then raise exception 'Choose a goal.' using errcode = '22023'; end if;
  if v_days is null or cardinality(v_days) not between 3 and 6 or not v_days <@ array[0, 1, 2, 3, 4, 5, 6] then
    raise exception 'Choose 3 to 6 training days.' using errcode = '22023';
  end if;
  update public.buddy_proposals proposals set status = 'replaced', decided_at = now() where proposals.group_id = v_group and proposals.status = 'pending';
  insert into public.buddy_proposals (group_id, proposed_by, goal, training_days, accepted_by) values (v_group, v_user, p_goal, v_days, array[v_user])
  returning id into v_id;
  return v_id;
end;
$$;

-- Accept or decline a proposal. When every active member has accepted, the new plan starts today for everyone.
create or replace function public.respond_buddy_proposal(p_proposal uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
  v_row public.buddy_proposals%rowtype;
begin
  if v_user is null or v_group is null then raise exception 'You aren''t in a buddy group.' using errcode = '22023'; end if;
  select * into v_row from public.buddy_proposals proposals where proposals.id = p_proposal and proposals.group_id = v_group and proposals.status = 'pending' for update;
  if not found then raise exception 'This change is no longer open.' using errcode = '22023'; end if;
  if not p_accept then
    update public.buddy_proposals proposals set status = 'declined', decided_at = now() where proposals.id = p_proposal;
    return 'declined';
  end if;
  update public.buddy_proposals proposals set accepted_by = (select array_agg(distinct person) from unnest(proposals.accepted_by || v_user) as people(person))
    where proposals.id = p_proposal returning * into v_row;
  if exists (
    select 1 from public.buddy_members members where members.group_id = v_group and members.status = 'active' and not (members.user_id = any (v_row.accepted_by))
  ) then
    return 'waiting';
  end if;
  update public.buddy_proposals proposals set status = 'accepted', decided_at = now() where proposals.id = p_proposal;
  update public.buddy_groups groups set goal = v_row.goal, training_days = v_row.training_days, anchor_date = current_date, updated_at = now() where groups.id = v_group;
  perform private.apply_buddy_plan(v_group);
  return 'accepted';
end;
$$;

-- "I'm at the gym" for the next two hours (or off).
create or replace function public.set_at_gym(p_on boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_until timestamptz := case when p_on then now() + interval '2 hours' end;
begin
  update public.buddy_members members set at_gym_until = v_until, updated_at = now()
    where members.user_id = v_user and members.status = 'active';
  if not found then raise exception 'You aren''t in a buddy group.' using errcode = '22023'; end if;
  return v_until;
end;
$$;

-- Whether buddies see why you skipped a day.
create or replace function public.set_buddy_share_reasons(p_on boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.buddy_members members set share_reasons = p_on, updated_at = now()
    where members.user_id = (select auth.uid()) and members.status = 'active';
  return found;
end;
$$;

-- Keep the buddy streak alive over one missed day, once per group per week (Monday–Sunday).
create or replace function public.carry_buddy_streak(p_date date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
  v_week date := p_date - ((extract(isodow from p_date)::integer) - 1);
begin
  if v_user is null or v_group is null then raise exception 'You aren''t in a buddy group.' using errcode = '22023'; end if;
  if p_date is null or p_date > current_date or p_date < current_date - 7 then raise exception 'You can carry a day from the last week.' using errcode = '22023'; end if;
  insert into public.buddy_carries (group_id, week_start, carried_date, carried_by) values (v_group, v_week, p_date, v_user)
  on conflict (group_id, week_start) do nothing;
  if not found then raise exception 'Your group already used this week''s carry.' using errcode = '22023'; end if;
  return true;
end;
$$;

-- Everything the buddy screens need, in one call: invites, the group, members, recent days, carries, open proposal.
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
      select jsonb_build_object('id', groups.id, 'goal', groups.goal, 'training_days', groups.training_days, 'anchor_date', groups.anchor_date, 'created_by', groups.created_by)
      from public.buddy_groups groups where groups.id = v_group) end,
    'members', case when v_group is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('user_id', members.user_id, 'name', coalesce(profiles.display_name, 'Buddy'), 'avatar', coalesce(profiles.avatar, ''),
        'status', members.status, 'share_reasons', members.share_reasons, 'at_gym', members.at_gym_until > now(), 'time_zone', profiles.time_zone) order by members.joined_at nulls last)
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

revoke all on function public.invite_buddy(uuid), public.respond_buddy_invite(uuid, boolean), public.leave_buddy_group(uuid),
  public.propose_buddy_plan(text, integer[]), public.respond_buddy_proposal(uuid, boolean), public.set_at_gym(boolean),
  public.set_buddy_share_reasons(boolean), public.carry_buddy_streak(date), public.buddy_overview(date) from public, anon;
grant execute on function public.invite_buddy(uuid), public.respond_buddy_invite(uuid, boolean), public.leave_buddy_group(uuid),
  public.propose_buddy_plan(text, integer[]), public.respond_buddy_proposal(uuid, boolean), public.set_at_gym(boolean),
  public.set_buddy_share_reasons(boolean), public.carry_buddy_streak(date), public.buddy_overview(date) to authenticated;
