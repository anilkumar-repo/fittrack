-- Rozi agent, Level 4 (R9, 2026-11-24): goals finish when their plan ends.
--
--   * rozi_my_goals shows an active or paused goal whose end date has passed as 'completed'.
--   * Approving a new goal marks such a finished goal 'completed' (not 'replaced'); an unfinished one is still
--     'replaced'. Everything else in both functions is unchanged; grants are kept by create or replace.

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
  -- The current live goal ends: completed if its plan has run its course, otherwise replaced.
  update public.rozi_goals set status = case when end_date <= current_date then 'completed' else 'replaced' end, finished_at = now()
    where user_id = v_user and status in ('active', 'paused') and id <> v.id;
  update public.rozi_goals set status = 'active', approved_at = now() where id = v.id returning * into v;
  return private.rozi_goal_json(v) || jsonb_build_object('approved_now', true);
end;
$$;

-- The person's goals, newest first (lapsed proposals shown as expired, finished plans as completed).
create or replace function public.rozi_my_goals(p_limit int default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.rozi_goal_json(g) || jsonb_build_object('status',
           case when g.status = 'awaiting_approval' and g.expires_at <= now() then 'expired'
                when g.status in ('active', 'paused') and g.end_date <= current_date then 'completed'
                else g.status end) order by g.created_at desc), '[]'::jsonb)
  from (select * from public.rozi_goals where user_id = (select auth.uid()) order by created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 50)) g;
$$;
