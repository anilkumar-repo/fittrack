-- Rozi agent (R13 security review, 2026-11-24): one proposal at a time per person.
--
-- Two questions running at once for the same person could both pass the "at most 10 waiting actions / 3 waiting
-- goals" check, or record the same goal plan twice. Each proposal now takes the same per-person lock the other Rozi
-- functions use (goals share the key with rozi_approve_goal). The one added line per function is the only change;
-- everything else is the live definition as of 2026-11-24 (md5-checked). Grants are kept by create or replace.

create or replace function public.rozi_propose_action(p_user uuid, p_type text, p_payload jsonb, p_summary jsonb, p_hash text, p_idempotency_key text, p_conversation uuid default null::uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v public.rozi_actions;
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'Unknown person.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rozi_action:' || p_user::text, 0));
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
$function$;

create or replace function public.rozi_propose_goal(p_user uuid, p_kind text, p_title text, p_reason text, p_target jsonb, p_start date, p_end date, p_steps jsonb, p_hash text, p_conversation uuid default null::uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v public.rozi_goals;
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'Unknown person.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rozi_goal:' || p_user::text, 0));
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
$function$;
