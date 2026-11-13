-- Phase 10: a reason for each missed training day.
-- A missed day is a workout_sessions row with status 'skipped' and a reason. Trainers already read their
-- clients' sessions through the existing policies, so they see the reasons with no new access.

alter table public.workout_sessions
  add column if not exists missed_reason text
    check (missed_reason in ('busy', 'unwell', 'tired', 'sore', 'travel', 'forgot', 'other')),
  add column if not exists missed_note text not null default ''
    check (char_length(missed_note) <= 300),
  add constraint workout_sessions_missed_reason_detail check (
    missed_reason is distinct from 'other' or char_length(btrim(missed_note)) >= 3
  );

-- Records a missed day. It runs as the calling user, so row-level security applies, and it never
-- overwrites a workout that was started or completed.
create or replace function public.record_missed_workout(
  p_date date,
  p_reason text,
  p_note text,
  p_plan jsonb,
  p_template_key text,
  p_template_version text,
  p_rule_version text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_session uuid;
begin
  if v_user is null then
    raise exception 'Sign in to save a reason.' using errcode = '42501';
  end if;
  if p_date > current_date + 1 then
    raise exception 'A missed day must be in the past.' using errcode = '22023';
  end if;

  insert into public.workout_sessions as sessions (
    user_id, workout_date, status, template_key, template_version, rule_version,
    plan_snapshot, exercise_logs, missed_reason, missed_note, updated_at
  ) values (
    v_user, p_date, 'skipped', p_template_key, p_template_version, p_rule_version,
    p_plan, '[]'::jsonb, p_reason, coalesce(btrim(p_note), ''), now()
  )
  on conflict (user_id, workout_date) do update set
    status = 'skipped',
    missed_reason = excluded.missed_reason,
    missed_note = excluded.missed_note,
    updated_at = now()
  where sessions.status in ('planned', 'skipped')
  returning sessions.id into v_session;

  return v_session;
end;
$function$;

revoke all on function public.record_missed_workout(date, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.record_missed_workout(date, text, text, jsonb, text, text, text) to authenticated;
