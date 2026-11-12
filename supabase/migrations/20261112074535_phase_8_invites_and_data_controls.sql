-- Phase 8: trainer invite codes, client-controlled trainer access, and deleting your own workout data.
-- A trainer account (trusted app_metadata role) creates a short code; the client enters it to link.
-- Linking still writes the same public.trainer_clients row an administrator used to insert by hand.

create table public.trainer_invites (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

create index trainer_invites_trainer_created_idx on public.trainer_invites (trainer_id, created_at desc);
create index trainer_invites_accepted_by_idx on public.trainer_invites (accepted_by);

alter table public.trainer_invites enable row level security;
revoke all on public.trainer_invites from anon, authenticated;
grant select on public.trainer_invites to authenticated;

create policy "Trainers can read their own invites"
  on public.trainer_invites for select to authenticated
  using ((select auth.uid()) = trainer_id);

-- Only a trusted trainer account can create a code. Codes avoid look-alike characters (0/O, 1/I).
create or replace function public.create_trainer_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_expires timestamptz;
begin
  if v_user is null or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer' then
    raise exception 'Only a trainer account can create an invite code.' using errcode = '42501';
  end if;
  if (select count(*) from public.trainer_invites invites
      where invites.trainer_id = v_user and invites.accepted_at is null and invites.expires_at > now()) >= 20 then
    raise exception 'You already have 20 unused invite codes. Use one of those or wait for them to expire.' using errcode = '22023';
  end if;
  loop
    v_bytes := uuid_send(gen_random_uuid());
    select string_agg(substr(v_alphabet, (get_byte(v_bytes, positions.i) & 31) + 1, 1), '')
      into v_code
      from unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) as positions(i);
    begin
      insert into public.trainer_invites as invites (trainer_id, code)
      values (v_user, v_code)
      returning invites.expires_at into v_expires;
      exit;
    exception when unique_violation then
      -- Extremely unlikely collision: try another code.
    end;
  end loop;
  return query select v_code, v_expires;
end;
$function$;

-- The signed-in client links themselves to the trainer who issued the code. Each code works once.
create or replace function public.accept_trainer_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_invite public.trainer_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in to use an invite code.' using errcode = '42501';
  end if;
  select * into v_invite from public.trainer_invites invites
    where invites.code = upper(btrim(coalesce(p_code, '')))
    for update;
  if not found or v_invite.accepted_at is not null or v_invite.expires_at <= now() then
    raise exception 'This invite code is not valid or has expired.' using errcode = '22023';
  end if;
  if v_invite.trainer_id = v_user then
    raise exception 'You cannot use your own invite code.' using errcode = '22023';
  end if;

  insert into public.trainer_clients (trainer_id, client_id, status, created_by)
  values (v_invite.trainer_id, v_user, 'active', v_invite.trainer_id)
  on conflict (trainer_id, client_id) do update set status = 'active';

  update public.trainer_invites invites
    set accepted_by = v_user, accepted_at = now()
    where invites.id = v_invite.id;
  return v_invite.trainer_id;
end;
$function$;

-- A client can withdraw trainer access at any time. The row is kept as inactive for the record.
create or replace function public.remove_my_trainers()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sign in to change trainer access.' using errcode = '42501';
  end if;
  update public.trainer_clients links set status = 'inactive'
    where links.client_id = v_user and links.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Deletes the caller's own workout sessions (check-ins, logs, sets, and reviews cascade) and body-weight
-- entries. The account, profile, trainer rules, and rule audit history are kept.
create or replace function public.delete_my_workout_data()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in to delete your workout data.' using errcode = '42501';
  end if;
  delete from public.workout_sessions sessions where sessions.user_id = v_user;
  delete from public.body_weight_entries entries where entries.user_id = v_user;
end;
$function$;

revoke all on function public.create_trainer_invite() from public, anon;
revoke all on function public.accept_trainer_invite(text) from public, anon;
revoke all on function public.remove_my_trainers() from public, anon;
revoke all on function public.delete_my_workout_data() from public, anon;
grant execute on function public.create_trainer_invite() to authenticated;
grant execute on function public.accept_trainer_invite(text) to authenticated;
grant execute on function public.remove_my_trainers() to authenticated;
grant execute on function public.delete_my_workout_data() to authenticated;
