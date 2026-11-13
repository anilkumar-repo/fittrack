-- Phase 11: friends, shared streaks, challenges and nudges.
--
-- Privacy model: friends never read each other's workout sessions. Each person publishes a small summary
-- (name, streak, workouts this week, recent workout dates) to friend_stats, which only their friends and
-- fellow challenge members can read. Friendships are made with a one-time invite code.

-- Invite codes: 8 characters without look-alikes (0/O, 1/I). The app creates them; accepting runs on the server.
create table public.friend_invites (
  code text primary key check (code ~ '^[A-Z2-9]{8}$'),
  inviter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);
create index friend_invites_inviter_idx on public.friend_invites (inviter_id, created_at desc);
create index friend_invites_accepted_by_idx on public.friend_invites (accepted_by);

-- One row per direction, so "my friends" is a simple lookup.
create table public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friendships_friend_idx on public.friendships (friend_id);

create table public.friend_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  goal text not null default 'general' check (goal in ('general', 'muscle', 'tone')),
  current_streak integer not null default 0 check (current_streak between 0 and 2000),
  best_streak integer not null default 0 check (best_streak between 0 and 2000),
  week_count integer not null default 0 check (week_count between 0 and 14),
  week_goal integer not null default 3 check (week_goal between 1 and 7),
  last_workout_date date,
  -- Completed workout dates from the last 62 days, used for challenge progress.
  recent_dates date[] not null default '{}' check (cardinality(recent_dates) <= 62),
  updated_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  period text not null check (period in ('week', 'month')),
  target integer not null check (target between 1 and 31),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 31)
);
create index challenges_creator_idx on public.challenges (creator_id);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index challenge_members_user_idx on public.challenge_members (user_id);

-- A friendly reminder to train. One per friend per day.
create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 120),
  sent_on date not null default current_date,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (from_user, to_user, sent_on),
  check (from_user <> to_user)
);
create index nudges_to_user_idx on public.nudges (to_user, created_at desc);

-- Helpers used by the access rules. They live in the private schema, which the API does not expose.
create or replace function private.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.user_id = p_a and f.friend_id = p_b);
$$;

create or replace function private.is_challenge_member(p_challenge uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_members m where m.challenge_id = p_challenge and m.user_id = p_user);
$$;

create or replace function private.can_see_stats(p_viewer uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_viewer = p_owner
    or private.are_friends(p_viewer, p_owner)
    or exists (
      select 1 from public.challenge_members mine
      join public.challenge_members theirs on theirs.challenge_id = mine.challenge_id
      where mine.user_id = p_viewer and theirs.user_id = p_owner
    );
$$;

revoke all on function private.are_friends(uuid, uuid) from public, anon;
revoke all on function private.is_challenge_member(uuid, uuid) from public, anon;
revoke all on function private.can_see_stats(uuid, uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.is_challenge_member(uuid, uuid) to authenticated;
grant execute on function private.can_see_stats(uuid, uuid) to authenticated;

-- Access rules.
alter table public.friend_invites enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_stats enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.nudges enable row level security;

revoke all on public.friend_invites, public.friendships, public.friend_stats, public.challenges, public.challenge_members, public.nudges from anon, authenticated;
grant select, insert on public.friend_invites to authenticated;
grant select, delete on public.friendships to authenticated;
grant select, insert, update on public.friend_stats to authenticated;
grant select, insert, delete on public.challenges to authenticated;
grant select, insert, delete on public.challenge_members to authenticated;
grant select, insert on public.nudges to authenticated;
grant update (seen_at) on public.nudges to authenticated;

create policy "Create own friend invites" on public.friend_invites for insert to authenticated
  with check (inviter_id = (select auth.uid()));
create policy "Read own friend invites" on public.friend_invites for select to authenticated
  using (inviter_id = (select auth.uid()));

create policy "See own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_id, friend_id));
create policy "Remove own friendships" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_id, friend_id));

create policy "Friends and challenge members see stats" on public.friend_stats for select to authenticated
  using (private.can_see_stats((select auth.uid()), user_id));
create policy "Publish own stats" on public.friend_stats for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Update own stats" on public.friend_stats for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Members see their challenges" on public.challenges for select to authenticated
  using (creator_id = (select auth.uid()) or private.is_challenge_member(id, (select auth.uid())));
create policy "Create own challenges" on public.challenges for insert to authenticated
  with check (creator_id = (select auth.uid()));
create policy "Creators delete their challenges" on public.challenges for delete to authenticated
  using (creator_id = (select auth.uid()));

create policy "Members see fellow members" on public.challenge_members for select to authenticated
  using (private.is_challenge_member(challenge_id, (select auth.uid())));
-- The creator adds themselves and their friends; nobody else can add members.
create policy "Creators add themselves and friends" on public.challenge_members for insert to authenticated
  with check (
    exists (select 1 from public.challenges c where c.id = challenge_id and c.creator_id = (select auth.uid()))
    and (user_id = (select auth.uid()) or private.are_friends((select auth.uid()), user_id))
  );
create policy "Members leave challenges" on public.challenge_members for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Send nudges to friends" on public.nudges for insert to authenticated
  with check (from_user = (select auth.uid()) and private.are_friends((select auth.uid()), to_user));
create policy "See sent and received nudges" on public.nudges for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
create policy "Mark received nudges seen" on public.nudges for update to authenticated
  using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));

-- Accepting an invite reads someone else's code, so it runs on the server. Each code works once.
create or replace function public.accept_friend_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_invite public.friend_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in to add a friend.' using errcode = '42501';
  end if;
  select * into v_invite from public.friend_invites invites
    where invites.code = upper(btrim(coalesce(p_code, '')))
    for update;
  if not found or v_invite.accepted_at is not null or v_invite.expires_at <= now() then
    raise exception 'This friend code is not valid or has expired.' using errcode = '22023';
  end if;
  if v_invite.inviter_id = v_user then
    raise exception 'That is your own code. Send it to a friend instead.' using errcode = '22023';
  end if;
  insert into public.friendships (user_id, friend_id) values (v_user, v_invite.inviter_id), (v_invite.inviter_id, v_user)
    on conflict do nothing;
  update public.friend_invites invites set accepted_by = v_user, accepted_at = now() where invites.code = v_invite.code;
  return v_invite.inviter_id;
end;
$function$;

revoke all on function public.accept_friend_invite(text) from public, anon;
grant execute on function public.accept_friend_invite(text) to authenticated;
