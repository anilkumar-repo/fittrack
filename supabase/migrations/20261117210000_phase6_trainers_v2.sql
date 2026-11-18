-- Phase 6 — Trainers v2.
--   1. Trainer links get requests ("Ask to be my trainer" from Friends), where they came from, and per-link sharing:
--      what each trainer may see. Default: workouts on; body, check-ins and missed-day reasons off.
--   2. Trainers read client data only through what the client shares (row security + read functions that leave out
--      unshared fields). Before this, any linked trainer could read everything.
--   3. Functions: request / answer / withdraw a trainer request, change sharing, a trainer removes a client, see which
--      friends are trainers, preview a QR / invite code, and the trainer dashboard's client list and workout summary.
--   4. Trainer broadcasts: one message to all of a trainer's clients (at most 5 a day).
-- Only accounts with the trainer flag (app_metadata.role = 'trainer') can be trainers, as before.

-- ---------- 1. Links: requests, origin, sharing ----------

create or replace function private.valid_trainer_shares(p_shares jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_shares) = 'object'
    and not exists (
      select 1 from jsonb_each(p_shares) as entries(key, value)
      where entries.key not in ('workouts', 'body', 'checkins', 'missed') or jsonb_typeof(entries.value) <> 'boolean'
    );
$$;

alter table public.trainer_clients drop constraint if exists trainer_clients_status_check;
alter table public.trainer_clients add constraint trainer_clients_status_check
  check (status in ('requested', 'active', 'inactive', 'declined'));

alter table public.trainer_clients
  add column if not exists origin text not null default 'code',
  add column if not exists shares jsonb not null default '{"workouts": true, "body": false, "checkins": false, "missed": false}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.trainer_clients drop constraint if exists trainer_clients_origin_check;
alter table public.trainer_clients add constraint trainer_clients_origin_check check (origin in ('friend', 'code', 'invite', 'qr'));
alter table public.trainer_clients drop constraint if exists trainer_clients_shares_check;
alter table public.trainer_clients add constraint trainer_clients_shares_check check (private.valid_trainer_shares(shares));

create index if not exists trainer_clients_trainer_status_idx on public.trainer_clients (trainer_id, status);
create index if not exists trainer_clients_client_status_idx on public.trainer_clients (client_id, status);

comment on column public.trainer_clients.origin is 'How the link started: friend (request from Friends), code (client code), invite (trainer code), qr (gym QR).';
comment on column public.trainer_clients.shares is 'What this trainer may see: workouts, body (height, age, weight), checkins (energy, soreness, pain, notes), missed (missed-day reasons).';

-- True when the signed-in trainer has an active link to this client that shares this kind of data.
create or replace function private.trainer_sees(p_client uuid, p_share text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'trainer'
    and exists (
      select 1 from public.trainer_clients links
      where links.trainer_id = (select auth.uid()) and links.client_id = p_client and links.status = 'active'
        and coalesce((links.shares ->> p_share)::boolean, false)
    );
$$;
revoke all on function private.trainer_sees(uuid, text) from public;
grant execute on function private.trainer_sees(uuid, text) to authenticated;

-- ---------- 2. What trainers can read ----------

-- Profiles and sessions hold body details, check-ins and missed reasons in the same row, so trainers now read them
-- only through trainer_clients_overview() / trainer_client_sessions(), which leave out what isn't shared.
drop policy if exists "Trainers can read linked client profiles" on public.profiles;
drop policy if exists "Trainers can read linked client sessions" on public.workout_sessions;

drop policy if exists "Owners and linked trainers can read exercise logs" on public.workout_exercise_logs;
create policy "Owners and linked trainers can read exercise logs" on public.workout_exercise_logs for select to authenticated
  using (user_id = (select auth.uid()) or private.trainer_sees(user_id, 'workouts'));

drop policy if exists "Owners and linked trainers can read set logs" on public.workout_set_logs;
create policy "Owners and linked trainers can read set logs" on public.workout_set_logs for select to authenticated
  using (user_id = (select auth.uid()) or private.trainer_sees(user_id, 'workouts'));

drop policy if exists "Owners and linked trainers can read workout check-ins" on public.workout_check_ins;
create policy "Owners and linked trainers can read workout check-ins" on public.workout_check_ins for select to authenticated
  using (user_id = (select auth.uid()) or private.trainer_sees(user_id, 'checkins'));

drop policy if exists "Owners and linked trainers can read workout reviews" on public.workout_reviews;
create policy "Owners and linked trainers can read workout reviews" on public.workout_reviews for select to authenticated
  using (user_id = (select auth.uid()) or private.trainer_sees(user_id, 'checkins'));

drop policy if exists "Linked trainers can read shared body weight" on public.body_weight_entries;
create policy "Linked trainers can read shared body weight" on public.body_weight_entries for select to authenticated
  using (private.trainer_sees(user_id, 'body'));

-- ---------- 3. Functions ----------

-- A client asks a friend who is a trainer to be their trainer.
create or replace function public.request_trainer(p_trainer uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing public.trainer_clients%rowtype;
begin
  if v_user is null then raise exception 'Sign in to ask a trainer.' using errcode = '42501'; end if;
  if p_trainer is null or p_trainer = v_user then raise exception 'Choose a friend to ask.' using errcode = '22023'; end if;
  if not private.are_friends(v_user, p_trainer) then raise exception 'You can only ask a friend. Add them as a friend first.' using errcode = '22023'; end if;
  if coalesce((select users.raw_app_meta_data ->> 'role' from auth.users users where users.id = p_trainer), '') <> 'trainer' then
    raise exception 'This friend isn''t a RozFit trainer yet.' using errcode = '22023';
  end if;
  select * into v_existing from public.trainer_clients links where links.trainer_id = p_trainer and links.client_id = v_user for update;
  if found and v_existing.status = 'active' then return 'active'; end if;
  if found and v_existing.status = 'requested' then return 'requested'; end if;
  if found and v_existing.status = 'declined' and v_existing.updated_at > now() - interval '7 days' then
    raise exception 'They answered your last request recently. You can ask again in a few days.' using errcode = '22023';
  end if;
  insert into public.trainer_clients (trainer_id, client_id, status, created_by, origin, updated_at)
  values (p_trainer, v_user, 'requested', v_user, 'friend', now())
  on conflict (trainer_id, client_id) do update set status = 'requested', created_by = v_user, origin = 'friend', updated_at = now();
  return 'requested';
end;
$$;

-- The trainer accepts or declines a request.
create or replace function public.respond_trainer_request(p_client uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer' then
    raise exception 'Only a trainer account can answer requests.' using errcode = '42501';
  end if;
  update public.trainer_clients links
    set status = case when p_accept then 'active' else 'declined' end, updated_at = now()
    where links.trainer_id = v_user and links.client_id = p_client and links.status = 'requested';
  return found;
end;
$$;

-- The client changes what one trainer may see. Missing keys keep their current value.
create or replace function public.set_trainer_shares(p_trainer uuid, p_shares jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_shares jsonb;
begin
  if v_user is null then raise exception 'Sign in to change sharing.' using errcode = '42501'; end if;
  if not private.valid_trainer_shares(coalesce(p_shares, '{}'::jsonb)) then raise exception 'Unknown sharing setting.' using errcode = '22023'; end if;
  update public.trainer_clients links
    set shares = links.shares || p_shares, updated_at = now()
    where links.client_id = v_user and links.trainer_id = p_trainer and links.status in ('active', 'requested')
    returning links.shares into v_shares;
  if not found then raise exception 'This trainer isn''t linked to you.' using errcode = '22023'; end if;
  return v_shares;
end;
$$;

-- The client ends a link or withdraws a request (replaces the active-only version).
create or replace function public.remove_my_trainer(p_trainer uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Sign in to change trainer access.' using errcode = '42501'; end if;
  update public.trainer_clients links set status = 'inactive', updated_at = now()
    where links.client_id = v_user and links.trainer_id = p_trainer and links.status in ('active', 'requested');
  return found;
end;
$$;

-- The trainer ends a link with a client.
create or replace function public.trainer_remove_client(p_client uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer' then
    raise exception 'Only a trainer account can remove a client.' using errcode = '42501';
  end if;
  update public.trainer_clients links set status = 'inactive', updated_at = now()
    where links.trainer_id = v_user and links.client_id = p_client and links.status in ('active', 'requested');
  return found;
end;
$$;

-- The client's trainers and requests, with what each one sees (replaces the old my_trainers()).
drop function if exists public.my_trainers();
create function public.my_trainers()
returns table (trainer_id uuid, display_name text, avatar text, status text, origin text, shares jsonb, linked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select links.trainer_id, coalesce(profiles.display_name, 'Trainer'), coalesce(profiles.avatar, ''), links.status, links.origin, links.shares, links.created_at
  from public.trainer_clients links
  left join public.profiles profiles on profiles.id = links.trainer_id
  where links.client_id = (select auth.uid()) and links.status in ('active', 'requested')
  order by links.created_at;
$$;

-- Which of the signed-in person's friends are trainers (for "Ask to be my trainer").
create or replace function public.friend_trainers()
returns table (trainer_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select friends.friend_id
  from public.friendships friends
  join auth.users users on users.id = friends.friend_id
  where friends.user_id = (select auth.uid()) and coalesce(users.raw_app_meta_data ->> 'role', '') = 'trainer';
$$;

-- Requests waiting for the signed-in trainer.
create or replace function public.trainer_requests()
returns table (client_id uuid, display_name text, avatar text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select links.client_id, coalesce(profiles.display_name, 'Someone'), coalesce(profiles.avatar, ''), links.updated_at
  from public.trainer_clients links
  left join public.profiles profiles on profiles.id = links.client_id
  where links.trainer_id = (select auth.uid()) and links.status = 'requested'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'trainer'
  order by links.updated_at desc;
$$;

-- Who an invite / QR code belongs to, so the join page can say "Add Asha as your trainer?". Signed-in only.
create or replace function public.trainer_invite_info(p_code text)
returns table (trainer_id uuid, display_name text, avatar text)
language sql
stable
security definer
set search_path = ''
as $$
  select invites.trainer_id, coalesce(profiles.display_name, 'Your trainer'), coalesce(profiles.avatar, '')
  from public.trainer_invites invites
  left join public.profiles profiles on profiles.id = invites.trainer_id
  where (select auth.uid()) is not null and invites.code = upper(btrim(coalesce(p_code, '')))
    and invites.accepted_at is null and invites.expires_at > now();
$$;

-- Accepting a trainer's invite code now records whether it came from a QR (replaces the one-argument version).
drop function if exists public.accept_trainer_invite(text);
create function public.accept_trainer_invite(p_code text, p_origin text default 'invite')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.trainer_invites%rowtype;
  v_origin text := case when p_origin = 'qr' then 'qr' else 'invite' end;
begin
  if v_user is null then raise exception 'Sign in to use an invite code.' using errcode = '42501'; end if;
  select * into v_invite from public.trainer_invites invites
    where invites.code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or v_invite.accepted_at is not null or v_invite.expires_at <= now() then
    raise exception 'This invite code is not valid or has expired.' using errcode = '22023';
  end if;
  if v_invite.trainer_id = v_user then raise exception 'You cannot use your own invite code.' using errcode = '22023'; end if;
  insert into public.trainer_clients (trainer_id, client_id, status, created_by, origin, updated_at)
  values (v_invite.trainer_id, v_user, 'active', v_invite.trainer_id, v_origin, now())
  on conflict (trainer_id, client_id) do update set status = 'active', origin = v_origin, updated_at = now();
  update public.trainer_invites invites set accepted_by = v_user, accepted_at = now() where invites.id = v_invite.id;
  return v_invite.trainer_id;
end;
$$;

-- Trainer enters a client's code: unchanged, plus the origin.
create or replace function public.trainer_add_client_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.client_share_codes%rowtype;
begin
  if v_user is null or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer' then
    raise exception 'Only a trainer account can add a client.' using errcode = '42501';
  end if;
  select * into v_row from public.client_share_codes codes where codes.code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or v_row.used_at is not null or v_row.expires_at <= now() then
    raise exception 'This code is not valid or has expired. Ask your client for a new one.' using errcode = '22023';
  end if;
  if v_row.client_id = v_user then raise exception 'You cannot add yourself as a client.' using errcode = '22023'; end if;
  insert into public.trainer_clients (trainer_id, client_id, status, created_by, origin, updated_at)
  values (v_user, v_row.client_id, 'active', v_row.client_id, 'code', now())
  on conflict (trainer_id, client_id) do update set status = 'active', origin = 'code', updated_at = now();
  update public.client_share_codes codes set used_by = v_user, used_at = now() where codes.id = v_row.id;
  return v_row.client_id;
end;
$$;

-- Trainer dashboard: every active client with their plan, and body details only when shared.
create or replace function public.trainer_clients_overview()
returns table (
  client_id uuid, display_name text, avatar text, goal text, experience text, sessions_per_week integer, training_days integer[],
  training_start_date date, time_zone text, preferred_session_minutes integer, equipment_availability text, available_equipment text[],
  shares jsonb, origin text, linked_at timestamptz,
  height_cm numeric, birth_year integer, sex text, weight_kg numeric, weighed_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select links.client_id, coalesce(profiles.display_name, 'Client'), coalesce(profiles.avatar, ''), profiles.goal, profiles.experience,
    profiles.sessions_per_week, profiles.training_days, profiles.training_start_date, profiles.time_zone, profiles.preferred_session_minutes,
    profiles.equipment_availability, profiles.available_equipment,
    links.shares, links.origin, links.created_at,
    case when (links.shares ->> 'body')::boolean then profiles.height_cm end,
    case when (links.shares ->> 'body')::boolean then profiles.birth_year::integer end,
    case when (links.shares ->> 'body')::boolean then profiles.sex end,
    case when (links.shares ->> 'body')::boolean then latest.weight_kg end,
    case when (links.shares ->> 'body')::boolean then latest.measured_on end
  from public.trainer_clients links
  join public.profiles profiles on profiles.id = links.client_id
  left join lateral (
    select weights.weight_kg, weights.measured_on from public.body_weight_entries weights
    where weights.user_id = links.client_id order by weights.measured_on desc limit 1
  ) latest on true
  where links.trainer_id = (select auth.uid()) and links.status = 'active'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'trainer'
  order by profiles.display_name;
$$;

-- Trainer dashboard: recent workout days of clients who share workouts (up to 120 days). Check-in numbers and
-- missed-day reasons are filled in only when the client shares them.
create or replace function public.trainer_client_sessions(p_since date)
returns table (client_id uuid, workout_date date, status text, completed_at timestamptz, energy smallint, soreness smallint, pain boolean, missed_reason text, missed_note text)
language sql
stable
security definer
set search_path = ''
as $$
  select sessions.user_id, sessions.workout_date, sessions.status, sessions.completed_at,
    case when (links.shares ->> 'checkins')::boolean then (sessions.check_in ->> 'energy')::smallint end,
    case when (links.shares ->> 'checkins')::boolean then (sessions.check_in ->> 'soreness')::smallint end,
    case when (links.shares ->> 'checkins')::boolean then (sessions.check_in ->> 'pain')::boolean end,
    case when (links.shares ->> 'missed')::boolean then sessions.missed_reason end,
    case when (links.shares ->> 'missed')::boolean then sessions.missed_note end
  from public.trainer_clients links
  join public.workout_sessions sessions on sessions.user_id = links.client_id
  where links.trainer_id = (select auth.uid()) and links.status = 'active' and (links.shares ->> 'workouts')::boolean
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'trainer'
    and sessions.workout_date >= greatest(coalesce(p_since, current_date - 30), current_date - 120)
  order by sessions.user_id, sessions.workout_date;
$$;

-- ---------- 4. Broadcasts ----------

create table if not exists public.trainer_broadcasts (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  pushed_at timestamptz
);
create index if not exists trainer_broadcasts_trainer_idx on public.trainer_broadcasts (trainer_id, created_at desc);

alter table public.trainer_broadcasts enable row level security;
revoke all on public.trainer_broadcasts from anon, authenticated;
grant select, delete on public.trainer_broadcasts to authenticated;

create policy "Trainers and their clients read broadcasts" on public.trainer_broadcasts for select to authenticated
  using (
    trainer_id = (select auth.uid())
    or exists (
      select 1 from public.trainer_clients links
      where links.trainer_id = trainer_broadcasts.trainer_id and links.client_id = (select auth.uid()) and links.status = 'active'
    )
  );
create policy "Trainers delete their own broadcasts" on public.trainer_broadcasts for delete to authenticated
  using (trainer_id = (select auth.uid()));

-- Sending goes through this function: trainers only, 1–500 characters, at most 5 in 24 hours.
create or replace function public.send_trainer_broadcast(p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer' then
    raise exception 'Only a trainer account can send a message to clients.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 500 then
    raise exception 'Write a message of up to 500 characters.' using errcode = '22023';
  end if;
  if (select count(*) from public.trainer_broadcasts broadcasts where broadcasts.trainer_id = v_user and broadcasts.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You can send up to 5 messages a day. Try again tomorrow.' using errcode = '22023';
  end if;
  insert into public.trainer_broadcasts (trainer_id, body) values (v_user, btrim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

-- Signed-in people only (anonymous visitors can't call any of these).
revoke all on function public.request_trainer(uuid), public.respond_trainer_request(uuid, boolean), public.set_trainer_shares(uuid, jsonb),
  public.remove_my_trainer(uuid), public.trainer_remove_client(uuid), public.my_trainers(), public.friend_trainers(), public.trainer_requests(),
  public.trainer_invite_info(text), public.accept_trainer_invite(text, text), public.trainer_add_client_by_code(text),
  public.trainer_clients_overview(), public.trainer_client_sessions(date), public.send_trainer_broadcast(text) from public, anon;
grant execute on function public.request_trainer(uuid), public.respond_trainer_request(uuid, boolean), public.set_trainer_shares(uuid, jsonb),
  public.remove_my_trainer(uuid), public.trainer_remove_client(uuid), public.my_trainers(), public.friend_trainers(), public.trainer_requests(),
  public.trainer_invite_info(text), public.accept_trainer_invite(text, text), public.trainer_add_client_by_code(text),
  public.trainer_clients_overview(), public.trainer_client_sessions(date), public.send_trainer_broadcast(text) to authenticated;
