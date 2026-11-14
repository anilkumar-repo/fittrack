-- Body stats and "why" from Get started, water tracking, smarter reminders, and clients adding their own trainers.

-- 1. Profile: body stats (for BMI and targets) and the person's reason for starting.
alter table public.profiles
  add column if not exists height_cm numeric(5, 1) check (height_cm is null or height_cm between 100 and 250),
  add column if not exists birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  add column if not exists sex text check (sex is null or sex in ('female', 'male', 'other')),
  add column if not exists why text not null default '' check (char_length(why) <= 200);

-- 2. Water: one row per drink logged.
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,
  ml smallint not null check (ml between 50 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists water_logs_user_day_idx on public.water_logs (user_id, logged_on);
alter table public.water_logs enable row level security;
revoke all on public.water_logs from anon, authenticated;
grant select, insert, delete on public.water_logs to authenticated;
create policy "Water: read own" on public.water_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Water: add own" on public.water_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Water: remove own" on public.water_logs for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. Reminder switches and "last sent" markers for the new reminders.
alter table public.push_subscriptions
  add column if not exists hydration boolean not null default true,
  add column if not exists comeback boolean not null default true,
  add column if not exists weigh_in boolean not null default true,
  add column if not exists last_water_at timestamptz,
  add column if not exists last_comeback_slot text check (last_comeback_slot is null or char_length(last_comeback_slot) <= 20),
  add column if not exists last_weigh_in_on date;

-- 4. Clients add their own trainers: the client makes a code and sends it; the trainer enters it.
create table if not exists public.client_share_codes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);
create index if not exists client_share_codes_client_idx on public.client_share_codes (client_id, created_at desc);
alter table public.client_share_codes enable row level security;
revoke all on public.client_share_codes from anon, authenticated;
grant select on public.client_share_codes to authenticated;
create policy "Share codes: read own" on public.client_share_codes for select to authenticated using ((select auth.uid()) = client_id);

-- Any signed-in person can make a code for their trainer (at most 10 unused at a time).
create or replace function public.create_client_share_code()
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
  if v_user is null then
    raise exception 'Sign in to create a code for your trainer.' using errcode = '42501';
  end if;
  if (select count(*) from public.client_share_codes codes
      where codes.client_id = v_user and codes.used_at is null and codes.expires_at > now()) >= 10 then
    raise exception 'You already have 10 unused codes. Share one of those or wait for them to expire.' using errcode = '22023';
  end if;
  loop
    v_bytes := uuid_send(gen_random_uuid());
    select string_agg(substr(v_alphabet, (get_byte(v_bytes, positions.i) & 31) + 1, 1), '')
      into v_code
      from unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) as positions(i);
    begin
      insert into public.client_share_codes as codes (client_id, code)
      values (v_user, v_code)
      returning codes.expires_at into v_expires;
      exit;
    exception when unique_violation then
      -- Extremely unlikely collision: try another code.
    end;
  end loop;
  return query select v_code, v_expires;
end;
$function$;

-- A trainer account enters the client's code to link. Each code works once.
create or replace function public.trainer_add_client_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_row public.client_share_codes%rowtype;
begin
  if v_user is null or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'trainer' then
    raise exception 'Only a trainer account can add a client.' using errcode = '42501';
  end if;
  select * into v_row from public.client_share_codes codes
    where codes.code = upper(btrim(coalesce(p_code, '')))
    for update;
  if not found or v_row.used_at is not null or v_row.expires_at <= now() then
    raise exception 'This code is not valid or has expired. Ask your client for a new one.' using errcode = '22023';
  end if;
  if v_row.client_id = v_user then
    raise exception 'You cannot add yourself as a client.' using errcode = '22023';
  end if;
  insert into public.trainer_clients (trainer_id, client_id, status, created_by)
  values (v_user, v_row.client_id, 'active', v_row.client_id)
  on conflict (trainer_id, client_id) do update set status = 'active';
  update public.client_share_codes codes set used_by = v_user, used_at = now() where codes.id = v_row.id;
  return v_row.client_id;
end;
$function$;

-- A client's active trainers, with names, so they can see and remove each one.
create or replace function public.my_trainers()
returns table (trainer_id uuid, display_name text, linked_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $function$
  select links.trainer_id, coalesce(profiles.display_name, 'Trainer'), links.created_at
  from public.trainer_clients links
  left join public.profiles profiles on profiles.id = links.trainer_id
  where links.client_id = (select auth.uid()) and links.status = 'active'
  order by links.created_at;
$function$;

-- A client removes one trainer (the others stay linked).
create or replace function public.remove_my_trainer(p_trainer uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in to change trainer access.' using errcode = '42501';
  end if;
  update public.trainer_clients links set status = 'inactive'
    where links.client_id = v_user and links.trainer_id = p_trainer and links.status = 'active';
  return found;
end;
$function$;

revoke all on function public.create_client_share_code() from public, anon;
revoke all on function public.trainer_add_client_by_code(text) from public, anon;
revoke all on function public.my_trainers() from public, anon;
revoke all on function public.remove_my_trainer(uuid) from public, anon;
grant execute on function public.create_client_share_code() to authenticated;
grant execute on function public.trainer_add_client_by_code(text) to authenticated;
grant execute on function public.my_trainers() to authenticated;
grant execute on function public.remove_my_trainer(uuid) to authenticated;
