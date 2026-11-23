-- Rozi agent, Level 3 (2026-11-19): actions Rozi proposes and the person approves.
--
--   * rozi_actions: one row per proposed change. Closed table (row-level security on, no direct access): every read
--     and every status change goes through the functions below, which check the owner and the current status.
--   * Lifecycle: awaiting_approval → approved → executing → completed | failed, or rejected / expired / cancelled.
--     No other transitions exist; there is no "update status" function.
--   * Approval is bound to the person, the action id and the payload hash, expires after 30 minutes and is single
--     use. The app applies the change through its own save path after approval (one writer, no stale copies); the
--     server then checks the result and records completed / failed.
--   * Idempotency: one row per (user, idempotency key) while it is open or done; a second approve / start returns
--     the stored state instead of running again (row lock).
--   * Deleted with the account (cascade). No personal details are stored beyond the change itself.

create table if not exists public.rozi_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action_type text not null check (action_type ~ '^[a-z_]{3,40}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 16384),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 8192),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'approved', 'executing', 'completed', 'failed', 'rejected', 'expired', 'cancelled')),
  conversation_id uuid references public.rozi_conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  approved_at timestamptz,
  executing_at timestamptz,
  finished_at timestamptz,
  result jsonb check (result is null or pg_column_size(result) <= 8192),
  error text check (error is null or char_length(error) <= 500)
);

-- One live or finished row per idempotency key (rejected / expired / cancelled / failed can be proposed again).
create unique index if not exists rozi_actions_idempotency_idx on public.rozi_actions (user_id, idempotency_key)
  where status in ('awaiting_approval', 'approved', 'executing', 'completed');
create index if not exists rozi_actions_user_time_idx on public.rozi_actions (user_id, created_at desc);

alter table public.rozi_actions enable row level security;
revoke all on public.rozi_actions from anon, authenticated;
comment on table public.rozi_actions is 'Changes Rozi proposed and their approval / outcome. Closed: use the rozi_* action functions.';

-- The person-facing view of an action (never more than the owner needs).
create or replace function private.rozi_action_json(a public.rozi_actions)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'type', a.action_type, 'status', a.status, 'summary', a.summary, 'payload', a.payload,
    'payload_hash', a.payload_hash, 'created_at', a.created_at, 'expires_at', a.expires_at,
    'approved_at', a.approved_at, 'finished_at', a.finished_at, 'result', a.result, 'error', a.error);
$$;
revoke all on function private.rozi_action_json(public.rozi_actions) from public;

-- Server only (after its own validation): record a proposal, or return the existing open/done one for the same key.
create or replace function public.rozi_propose_action(p_user uuid, p_type text, p_payload jsonb, p_summary jsonb, p_hash text, p_idempotency_key text, p_conversation uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.rozi_actions;
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'Unknown person.' using errcode = '42501';
  end if;
  -- Old proposals lapse; a person can't pile up more than 10 waiting at once.
  update public.rozi_actions set status = 'expired', finished_at = now()
    where user_id = p_user and status = 'awaiting_approval' and expires_at <= now();
  select * into v from public.rozi_actions
    where user_id = p_user and idempotency_key = p_idempotency_key and status in ('awaiting_approval', 'approved', 'executing', 'completed');
  if found then return private.rozi_action_json(v); end if;
  if (select count(*) from public.rozi_actions where user_id = p_user and status = 'awaiting_approval') >= 10 then
    raise exception 'Too many changes are waiting for approval.' using errcode = '54000';
  end if;
  insert into public.rozi_actions (user_id, action_type, payload, summary, payload_hash, idempotency_key, conversation_id)
  values (p_user, p_type, p_payload, coalesce(p_summary, '{}'::jsonb), p_hash, p_idempotency_key,
    case when p_conversation is not null and exists (select 1 from public.rozi_conversations c where c.id = p_conversation and c.user_id = p_user) then p_conversation end)
  returning * into v;
  return private.rozi_action_json(v);
end;
$$;

-- The person approves the exact change they saw (hash) and it moves straight to executing, once.
-- Returns the action with started_now = true only for the call that started it: the app applies the change only
-- then, so a second tap, a refresh or another tab never applies it twice. Later calls return the current state.
create or replace function public.rozi_start_action(p_action uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v public.rozi_actions;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into v from public.rozi_actions where id = p_action and user_id = v_user for update;
  if not found then raise exception 'That change isn''t yours or doesn''t exist.' using errcode = '42501'; end if;
  if v.status = 'awaiting_approval' then
    if v.expires_at <= now() then
      update public.rozi_actions set status = 'expired', finished_at = now() where id = v.id returning * into v;
      return private.rozi_action_json(v);
    end if;
    if p_hash is distinct from v.payload_hash then
      raise exception 'That change was modified. Ask Rozi again.' using errcode = '22023';
    end if;
    update public.rozi_actions set status = 'executing', approved_at = now(), executing_at = now() where id = v.id returning * into v;
    return private.rozi_action_json(v) || jsonb_build_object('started_now', true);
  elsif v.status = 'executing' and v.executing_at < now() - interval '10 minutes' then
    -- Started but never reported back (closed tab, lost connection): it doesn't run again.
    update public.rozi_actions set status = 'failed', finished_at = now(), error = 'Not confirmed in time.' where id = v.id returning * into v;
  end if;
  return private.rozi_action_json(v);
end;
$$;

-- The person turns a waiting proposal down.
create or replace function public.rozi_reject_action(p_action uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v public.rozi_actions;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into v from public.rozi_actions where id = p_action and user_id = v_user for update;
  if not found then raise exception 'That change isn''t yours or doesn''t exist.' using errcode = '42501'; end if;
  if v.status = 'awaiting_approval' then
    update public.rozi_actions set status = case when v.expires_at <= now() then 'expired' else 'rejected' end, finished_at = now() where id = v.id returning * into v;
  end if;
  return private.rozi_action_json(v);
end;
$$;

-- Server only: after checking the result in the database, record completed or failed (only from executing).
create or replace function public.rozi_finish_action(p_user uuid, p_action uuid, p_ok boolean, p_result jsonb default null, p_error text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.rozi_actions;
begin
  select * into v from public.rozi_actions where id = p_action and user_id = p_user for update;
  if not found then raise exception 'That change isn''t this person''s.' using errcode = '42501'; end if;
  if v.status = 'executing' then
    update public.rozi_actions
      set status = case when p_ok then 'completed' else 'failed' end, finished_at = now(),
          result = p_result, error = case when p_ok then null else left(coalesce(p_error, 'It couldn''t be completed.'), 500) end
      where id = v.id returning * into v;
  end if;
  return private.rozi_action_json(v);
end;
$$;

-- The person's own action history, newest first (lapsed proposals shown as expired).
create or replace function public.rozi_my_actions(p_limit int default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.rozi_action_json(a) || jsonb_build_object('status',
           case when a.status = 'awaiting_approval' and a.expires_at <= now() then 'expired' else a.status end) order by a.created_at desc), '[]'::jsonb)
  from (select * from public.rozi_actions where user_id = (select auth.uid()) order by created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)) a;
$$;

revoke all on function public.rozi_propose_action(uuid, text, jsonb, jsonb, text, text, uuid), public.rozi_start_action(uuid, text),
  public.rozi_reject_action(uuid), public.rozi_finish_action(uuid, uuid, boolean, jsonb, text), public.rozi_my_actions(int) from public, anon;
grant execute on function public.rozi_start_action(uuid, text), public.rozi_reject_action(uuid), public.rozi_my_actions(int) to authenticated;
revoke all on function public.rozi_propose_action(uuid, text, jsonb, jsonb, text, text, uuid), public.rozi_finish_action(uuid, uuid, boolean, jsonb, text) from authenticated;
grant execute on function public.rozi_propose_action(uuid, text, jsonb, jsonb, text, text, uuid), public.rozi_finish_action(uuid, uuid, boolean, jsonb, text) to service_role;
