-- Phase 12: phone notifications (morning motivation, evening log reminder, friend nudges).
--
-- Each phone or browser that allows notifications stores one subscription. Only its owner can read or
-- change it; the app's server sends notifications with the service key, which bypasses these rules.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  time_zone text not null default 'Asia/Kolkata' check (char_length(time_zone) between 1 and 80),
  morning boolean not null default true,
  morning_hour smallint not null default 7 check (morning_hour between 5 and 11),
  evening boolean not null default true,
  evening_hour smallint not null default 19 check (evening_hour between 16 and 22),
  nudges boolean not null default true,
  last_morning_on date,
  last_evening_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create policy "Own push subscriptions: read" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Own push subscriptions: add" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Own push subscriptions: change" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own push subscriptions: remove" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- A nudge is pushed to the phone at most once.
alter table public.nudges add column if not exists pushed_at timestamptz;

-- Every hour, ask the app to send that hour's notifications. The app address and the shared secret are
-- read from the encrypted vault at run time (secrets 'rozfit_app_url' and 'rozfit_cron_secret'), so
-- neither is stored in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function private.request_hourly_push()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'rozfit_app_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'rozfit_cron_secret');
begin
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url || '/api/push/hourly',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$function$;
revoke all on function private.request_hourly_push() from public, anon, authenticated;

select cron.schedule('rozfit-hourly-push', '2 * * * *', 'select private.request_hourly_push()');
