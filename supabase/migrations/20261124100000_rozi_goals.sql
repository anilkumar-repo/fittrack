-- Rozi agent, Level 4 step 1 (R8, 2026-11-24): goals with a weekly plan that the person approves once.
--
--   * rozi_goals: one row per proposed goal. Closed table (row-level security on, no policies, no grants): every read
--     and status change goes through the functions below, which check the owner and the current status.
--   * The server builds and validates the plan (fixed templates, safety limits) and records it with the service role.
--     The person approves the exact plan they saw (hash), once, within 30 minutes.
--   * One goal is active or paused per person; approving a new one replaces it.
--   * Lifecycle: awaiting_approval → active ⇄ paused → cancelled | replaced; awaiting_approval → rejected | expired.
--     'completed' is reserved for the weekly check (R9). There is no general "update status" function.
--   * Deleted with the account (cascade). Stores only the goal and its weekly targets.

create table if not exists public.rozi_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('consistency', 'weight_loss', 'weight_gain', 'strength')),
  title text not null check (char_length(title) between 3 and 120),
  reason text not null default '' check (char_length(reason) <= 300),
  target jsonb not null check (jsonb_typeof(target) = 'object' and pg_column_size(target) <= 2048),
  start_date date not null,
  end_date date not null,
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 12 and pg_column_size(steps) <= 16384),
  plan_hash text not null check (plan_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'active', 'paused', 'completed', 'cancelled', 'replaced', 'rejected', 'expired')),
  conversation_id uuid references public.rozi_conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  approved_at timestamptz,
  finished_at timestamptz,
  constraint rozi_goals_dates check (end_date > start_date and end_date <= start_date + 90)
);

-- At most one live goal (active or paused) per person.
create unique index if not exists rozi_goals_one_live_idx on public.rozi_goals (user_id) where status in ('active', 'paused');
create index if not exists rozi_goals_user_time_idx on public.rozi_goals (user_id, created_at desc);

alter table public.rozi_goals enable row level security;
revoke all on public.rozi_goals from anon, authenticated;
comment on table public.rozi_goals is 'Goals Rozi proposed with a weekly plan, and their approval / status. Closed: use the rozi_*_goal functions.';

-- The person-facing view of a goal.
create or replace function private.rozi_goal_json(g public.rozi_goals)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', g.id, 'kind', g.kind, 'title', g.title, 'reason', g.reason, 'target', g.target,
    'start_date', g.start_date, 'end_date', g.end_date, 'steps', g.steps, 'plan_hash', g.plan_hash,
    'status', g.status, 'created_at', g.created_at, 'expires_at', g.expires_at,
    'approved_at', g.approved_at, 'finished_at', g.finished_at);
$$;
revoke all on function private.rozi_goal_json(public.rozi_goals) from public;

-- Server only (after its own validation): record a goal proposal.
create or replace function public.rozi_propose_goal(p_user uuid, p_kind text, p_title text, p_reason text, p_target jsonb,
  p_start date, p_end date, p_steps jsonb, p_hash text, p_conversation uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.rozi_goals;
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'Unknown person.' using errcode = '42501';
  end if;
  update public.rozi_goals set status = 'expired', finished_at = now()
    where user_id = p_user and status = 'awaiting_approval' and expires_at <= now();
  -- The same plan proposed again returns the waiting one.
  select * into v from public.rozi_goals where user_id = p_user and status = 'awaiting_approval' and plan_hash = p_hash;
  if found then return private.rozi_goal_json(v); end if;
  if (select count(*) from public.rozi_goals where user_id = p_user and status = 'awaiting_approval') >= 3 then
    raise exception 'Too many goals are waiting for approval.' using errcode = '54000';
  end if;
  insert into public.rozi_goals (user_id, kind, title, reason, target, start_date, end_date, steps, plan_hash, conversation_id)
  values (p_user, p_kind, p_title, coalesce(p_reason, ''), p_target, p_start, p_end, p_steps, p_hash,
    case when p_conversation is not null and exists (select 1 from public.rozi_conversations c where c.id = p_conversation and c.user_id = p_user) then p_conversation end)
  returning * into v;
  return private.rozi_goal_json(v);
end;
$$;

-- The person approves the exact plan they saw (hash), once. Any current live goal is replaced.
-- Returns the goal with approved_now = true only for the call that approved it.
create or replace function public.rozi_approve_goal(p_goal uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v public.rozi_goals;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  -- One approval at a time per person, so two goals can't both become live.
  perform pg_advisory_xact_lock(hashtextextended('rozi_goal:' || v_user::text, 0));
  select * into v from public.rozi_goals where id = p_goal and user_id = v_user for update;
  if not found then raise exception 'That goal isn''t yours or doesn''t exist.' using errcode = '42501'; end if;
  if v.status <> 'awaiting_approval' then return private.rozi_goal_json(v); end if;
  if v.expires_at <= now() then
    update public.rozi_goals set status = 'expired', finished_at = now() where id = v.id returning * into v;
    return private.rozi_goal_json(v);
  end if;
  if p_hash is distinct from v.plan_hash then
    raise exception 'That plan was modified. Ask Rozi again.' using errcode = '22023';
  end if;
  update public.rozi_goals set status = 'replaced', finished_at = now()
    where user_id = v_user and status in ('active', 'paused') and id <> v.id;
  update public.rozi_goals set status = 'active', approved_at = now() where id = v.id returning * into v;
  return private.rozi_goal_json(v) || jsonb_build_object('approved_now', true);
end;
$$;

-- The person rejects a proposal, or pauses / resumes / cancels their goal. Only these transitions exist.
create or replace function public.rozi_set_goal_status(p_goal uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v public.rozi_goals;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_action not in ('reject', 'pause', 'resume', 'cancel') then
    raise exception 'Unknown change.' using errcode = '22023';
  end if;
  select * into v from public.rozi_goals where id = p_goal and user_id = v_user for update;
  if not found then raise exception 'That goal isn''t yours or doesn''t exist.' using errcode = '42501'; end if;
  if p_action = 'reject' and v.status = 'awaiting_approval' then
    update public.rozi_goals set status = case when v.expires_at <= now() then 'expired' else 'rejected' end, finished_at = now() where id = v.id returning * into v;
  elsif p_action = 'pause' and v.status = 'active' then
    update public.rozi_goals set status = 'paused' where id = v.id returning * into v;
  elsif p_action = 'resume' and v.status = 'paused' then
    update public.rozi_goals set status = 'active' where id = v.id returning * into v;
  elsif p_action = 'cancel' and v.status in ('active', 'paused') then
    update public.rozi_goals set status = 'cancelled', finished_at = now() where id = v.id returning * into v;
  end if;
  return private.rozi_goal_json(v);
end;
$$;

-- The person's goals, newest first (lapsed proposals shown as expired).
create or replace function public.rozi_my_goals(p_limit int default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.rozi_goal_json(g) || jsonb_build_object('status',
           case when g.status = 'awaiting_approval' and g.expires_at <= now() then 'expired' else g.status end) order by g.created_at desc), '[]'::jsonb)
  from (select * from public.rozi_goals where user_id = (select auth.uid()) order by created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 50)) g;
$$;

revoke all on function public.rozi_propose_goal(uuid, text, text, text, jsonb, date, date, jsonb, text, uuid), public.rozi_approve_goal(uuid, text),
  public.rozi_set_goal_status(uuid, text), public.rozi_my_goals(int) from public, anon;
grant execute on function public.rozi_approve_goal(uuid, text), public.rozi_set_goal_status(uuid, text), public.rozi_my_goals(int) to authenticated;
revoke all on function public.rozi_propose_goal(uuid, text, text, text, jsonb, date, date, jsonb, text, uuid) from authenticated;
grant execute on function public.rozi_propose_goal(uuid, text, text, text, jsonb, date, date, jsonb, text, uuid) to service_role;
