-- Self-serve trainers (Phase 6, step A).
--   Anyone can switch on Trainer mode in the app (bio + specialities). Being a trainer no longer comes from the
--   sign-in token (which only an admin could set and needed a sign-out); it comes from public.trainer_profiles.
--   Safeguards: clients still have to accept every trainer and choose what to share (Phase 6); at most 25 active
--   clients per trainer; anyone can report a trainer, and 3 different people reporting within 30 days pauses the
--   trainer automatically until the owner reviews it (trainer_profiles.suspended).

-- ---------- Trainer profiles ----------

create table if not exists public.trainer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active boolean not null default true,
  bio text not null default '' check (char_length(bio) <= 280),
  specialties text[] not null default '{}' check (cardinality(specialties) <= 6),
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.trainer_profiles is 'Self-serve trainers. active = Trainer mode on; suspended = paused after reports (owner reviews).';

alter table public.trainer_profiles enable row level security;
revoke all on public.trainer_profiles from anon, authenticated;
grant select on public.trainer_profiles to authenticated;
-- Signed-in people see their own row and every active trainer (for badges, bios and the join page).
create policy "Read own and active trainer profiles" on public.trainer_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (active and not suspended));

-- Anyone made a trainer the old way keeps being one.
insert into public.trainer_profiles (user_id)
select users.id from auth.users users where users.raw_app_meta_data ->> 'role' = 'trainer'
on conflict (user_id) do nothing;

-- Is this person a trainer right now (mode on, not paused)?
create or replace function private.is_trainer_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trainer_profiles profiles where profiles.user_id = p_user and profiles.active and not profiles.suspended);
$$;

create or replace function private.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_trainer_user((select auth.uid()));
$$;

revoke all on function private.is_trainer_user(uuid), private.is_trainer() from public;
grant execute on function private.is_trainer_user(uuid), private.is_trainer() to authenticated;

-- Room for one more client (at most 25 active).
create or replace function private.trainer_has_room(p_trainer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.trainer_clients links where links.trainer_id = p_trainer and links.status = 'active') < 25;
$$;
revoke all on function private.trainer_has_room(uuid) from public;

-- Switch Trainer mode on or off, with a short bio and up to 6 specialities.
create or replace function public.set_trainer_mode(p_on boolean, p_bio text default null, p_specialties text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.trainer_profiles%rowtype;
  v_specialties text[];
begin
  if v_user is null then raise exception 'Sign in to become a trainer.' using errcode = '42501'; end if;
  select * into v_row from public.trainer_profiles profiles where profiles.user_id = v_user for update;
  if found and v_row.suspended and p_on then
    raise exception 'Your trainer profile is paused while we look into a report. Contact RozFit support.' using errcode = '42501';
  end if;
  select coalesce(array_agg(left(btrim(item), 30)) filter (where btrim(item) <> ''), '{}')
    into v_specialties from unnest(coalesce(p_specialties, v_row.specialties, '{}')) as items(item);
  if cardinality(v_specialties) > 6 then raise exception 'Choose up to 6 specialities.' using errcode = '22023'; end if;
  insert into public.trainer_profiles as profiles (user_id, active, bio, specialties, updated_at)
  values (v_user, p_on, left(btrim(coalesce(p_bio, '')), 280), v_specialties, now())
  on conflict (user_id) do update set
    active = p_on,
    bio = case when p_bio is null then profiles.bio else left(btrim(p_bio), 280) end,
    specialties = v_specialties,
    updated_at = now()
  returning * into v_row;
  return jsonb_build_object('active', v_row.active, 'bio', v_row.bio, 'specialties', v_row.specialties, 'suspended', v_row.suspended);
end;
$$;

-- ---------- Reports ----------

create table if not exists public.trainer_reports (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('unsafe', 'inappropriate', 'spam', 'fake', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  reported_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (trainer_id, reporter_id, reported_on)
);
create index if not exists trainer_reports_trainer_idx on public.trainer_reports (trainer_id, created_at desc);
comment on table public.trainer_reports is 'Reports about trainers. Read them in the Supabase dashboard; nobody can read them from the app.';
alter table public.trainer_reports enable row level security;
revoke all on public.trainer_reports from anon, authenticated;

create or replace function public.report_trainer(p_trainer uuid, p_reason text, p_note text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Sign in to report.' using errcode = '42501'; end if;
  if p_trainer is null or p_trainer = v_user then raise exception 'Choose a trainer to report.' using errcode = '22023'; end if;
  if p_reason not in ('unsafe', 'inappropriate', 'spam', 'fake', 'other') then raise exception 'Choose a reason.' using errcode = '22023'; end if;
  insert into public.trainer_reports (trainer_id, reporter_id, reason, note)
  values (p_trainer, v_user, p_reason, left(btrim(coalesce(p_note, '')), 500))
  on conflict (trainer_id, reporter_id, reported_on) do nothing;
  -- Three different people within 30 days: pause the trainer until reviewed.
  if (select count(distinct reports.reporter_id) from public.trainer_reports reports
      where reports.trainer_id = p_trainer and reports.created_at > now() - interval '30 days') >= 3 then
    update public.trainer_profiles profiles set suspended = true, updated_at = now() where profiles.user_id = p_trainer;
  end if;
  return true;
end;
$$;

-- ---------- Every trainer check now uses trainer_profiles ----------

-- Functions that only check "is the caller a trainer": swap the sign-in-token check for private.is_trainer().
do $$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.create_trainer_invite()', 'public.send_trainer_broadcast(text)', 'public.trainer_client_sessions(date)',
    'public.trainer_clients_overview()', 'public.trainer_remove_client(uuid)', 'public.trainer_requests()',
    'public.trainer_update_client_plan(uuid, text, integer[], integer, text)', 'private.trainer_sees(uuid, text)',
    'private.audit_trainer_rule_change()', 'private.guard_trainer_rule_change()'
  ]::regprocedure[] loop
    v_definition := pg_get_functiondef(v_function);
    v_definition := replace(v_definition, $q$coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer'$q$, 'not private.is_trainer()');
    v_definition := replace(v_definition, $q$coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'trainer'$q$, 'private.is_trainer()');
    v_definition := replace(v_definition, $q$(auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'trainer'$q$, 'not private.is_trainer()');
    if v_definition ilike '%app_metadata%' then raise exception 'Unexpected trainer check left in %', v_function; end if;
    execute v_definition;
  end loop;
end $$;

-- The rest are rewritten in full: they also get the 25-client limit or check another person's trainer status.

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
  if not private.is_trainer_user(p_trainer) then raise exception 'This friend isn''t a RozFit trainer right now.' using errcode = '22023'; end if;
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

create or replace function public.respond_trainer_request(p_client uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not private.is_trainer() then raise exception 'Only a trainer can answer requests.' using errcode = '42501'; end if;
  if p_accept and not private.trainer_has_room(v_user) then raise exception 'You already have 25 clients, the most a trainer can have.' using errcode = '22023'; end if;
  update public.trainer_clients links
    set status = case when p_accept then 'active' else 'declined' end, updated_at = now()
    where links.trainer_id = v_user and links.client_id = p_client and links.status = 'requested';
  return found;
end;
$$;

create or replace function public.friend_trainers()
returns table (trainer_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select friends.friend_id from public.friendships friends
  where friends.user_id = (select auth.uid()) and private.is_trainer_user(friends.friend_id);
$$;

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
    and invites.accepted_at is null and invites.expires_at > now() and private.is_trainer_user(invites.trainer_id);
$$;

create or replace function public.accept_trainer_invite(p_code text, p_origin text default 'invite')
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
  select * into v_invite from public.trainer_invites invites where invites.code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or v_invite.accepted_at is not null or v_invite.expires_at <= now() or not private.is_trainer_user(v_invite.trainer_id) then
    raise exception 'This invite code is not valid or has expired.' using errcode = '22023';
  end if;
  if v_invite.trainer_id = v_user then raise exception 'You cannot use your own invite code.' using errcode = '22023'; end if;
  if not exists (select 1 from public.trainer_clients links where links.trainer_id = v_invite.trainer_id and links.client_id = v_user and links.status = 'active')
    and not private.trainer_has_room(v_invite.trainer_id) then
    raise exception 'This trainer already has the most clients they can take (25).' using errcode = '22023';
  end if;
  insert into public.trainer_clients (trainer_id, client_id, status, created_by, origin, updated_at)
  values (v_invite.trainer_id, v_user, 'active', v_invite.trainer_id, v_origin, now())
  on conflict (trainer_id, client_id) do update set status = 'active', origin = v_origin, updated_at = now();
  update public.trainer_invites invites set accepted_by = v_user, accepted_at = now() where invites.id = v_invite.id;
  return v_invite.trainer_id;
end;
$$;

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
  if v_user is null or not private.is_trainer() then raise exception 'Only a trainer can add a client. Turn on Trainer mode first.' using errcode = '42501'; end if;
  select * into v_row from public.client_share_codes codes where codes.code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or v_row.used_at is not null or v_row.expires_at <= now() then
    raise exception 'This code is not valid or has expired. Ask your client for a new one.' using errcode = '22023';
  end if;
  if v_row.client_id = v_user then raise exception 'You cannot add yourself as a client.' using errcode = '22023'; end if;
  if not exists (select 1 from public.trainer_clients links where links.trainer_id = v_user and links.client_id = v_row.client_id and links.status = 'active')
    and not private.trainer_has_room(v_user) then
    raise exception 'You already have 25 clients, the most a trainer can have.' using errcode = '22023';
  end if;
  insert into public.trainer_clients (trainer_id, client_id, status, created_by, origin, updated_at)
  values (v_user, v_row.client_id, 'active', v_row.client_id, 'code', now())
  on conflict (trainer_id, client_id) do update set status = 'active', origin = 'code', updated_at = now();
  update public.client_share_codes codes set used_by = v_user, used_at = now() where codes.id = v_row.id;
  return v_row.client_id;
end;
$$;

-- Plan-rule access: same rules, trainer status from trainer_profiles.
drop policy if exists "Trainers can read rules for linked clients" on public.trainer_rules;
create policy "Trainers can read rules for linked clients" on public.trainer_rules for select to authenticated
  using (user_id = (select auth.uid()) or (private.is_trainer() and exists (
    select 1 from public.trainer_clients tc where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active')));

drop policy if exists "Trainers can create rules for linked clients" on public.trainer_rules;
create policy "Trainers can create rules for linked clients" on public.trainer_rules for insert to authenticated
  with check (private.is_trainer() and updated_by = (select auth.uid()) and exists (
    select 1 from public.trainer_clients tc where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active'));

drop policy if exists "Trainers can update rules for linked clients" on public.trainer_rules;
create policy "Trainers can update rules for linked clients" on public.trainer_rules for update to authenticated
  using (private.is_trainer() and exists (
    select 1 from public.trainer_clients tc where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active'))
  with check (private.is_trainer() and updated_by = (select auth.uid()) and exists (
    select 1 from public.trainer_clients tc where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rules.user_id and tc.status = 'active'));

drop policy if exists "Clients and linked trainers can read rule audit" on public.trainer_rule_audit;
create policy "Clients and linked trainers can read rule audit" on public.trainer_rule_audit for select to authenticated
  using (client_id = (select auth.uid()) or (private.is_trainer() and exists (
    select 1 from public.trainer_clients tc where tc.trainer_id = (select auth.uid()) and tc.client_id = trainer_rule_audit.client_id and tc.status = 'active')));

-- Final check: nothing in the app's schemas still reads the trainer flag from the sign-in token.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f' and pg_get_functiondef(p.oid) ilike '%app_metadata%'
  ) or exists (
    select 1 from pg_policies where schemaname = 'public' and (coalesce(qual, '') ilike '%app_metadata%' or coalesce(with_check, '') ilike '%app_metadata%')
  ) then
    raise exception 'A trainer check still uses the sign-in token.';
  end if;
end $$;

revoke all on function public.set_trainer_mode(boolean, text, text[]), public.report_trainer(uuid, text, text) from public, anon;
grant execute on function public.set_trainer_mode(boolean, text, text[]), public.report_trainer(uuid, text, text) to authenticated;
