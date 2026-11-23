-- ---------- Rozi actions (Level 3): repeatable security test ----------
-- Run AFTER migration 20261119150000_rozi_actions.sql. Changes nothing: everything runs in a transaction that always
-- ends with an error and is rolled back.  Success: ERROR: PASS rozi_actions_security: <n> checks
begin;
do $test$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  h text := repeat('a', 64);
  j jsonb; j2 jsonb; act uuid; act2 uuid; n int := 0; denied boolean;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', 'act-sec-a-' || a || '@example.invalid', now(), now()),
    (b, 'authenticated', 'authenticated', 'act-sec-b-' || b || '@example.invalid', now(), now());

  -- Server proposes; the same key returns the same row.
  set local role service_role;
  j := public.rozi_propose_action(a, 'log_water', '{"ml":500}'::jsonb, '{"title":"Log 500 ml"}'::jsonb, h, 'log_water:2026-11-19:test');
  act := (j ->> 'id')::uuid;
  j2 := public.rozi_propose_action(a, 'log_water', '{"ml":500}'::jsonb, '{}'::jsonb, h, 'log_water:2026-11-19:test');
  if (j2 ->> 'id')::uuid <> act or j ->> 'status' <> 'awaiting_approval' then raise exception 'FAIL idempotent proposal'; end if;
  n := n + 2;
  reset role;

  -- The tables are closed; the app can't propose or finish.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform 1 from public.rozi_actions limit 1; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL app can read rozi_actions directly'; end if;
  denied := false; begin perform public.rozi_propose_action(a, 'log_water', '{}'::jsonb, '{}'::jsonb, h, 'app-made-key'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL app can propose'; end if;
  denied := false; begin perform public.rozi_finish_action(a, act, true); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL app can mark an action completed'; end if;
  n := n + 3;

  -- Wrong hash (payload changed) is refused; the right one starts it once.
  denied := false; begin perform public.rozi_start_action(act, repeat('b', 64)); exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'FAIL changed payload accepted'; end if;
  j := public.rozi_start_action(act, h);
  if j ->> 'status' <> 'executing' or (j ->> 'started_now')::boolean is distinct from true then raise exception 'FAIL approve did not start: %', j; end if;
  j := public.rozi_start_action(act, h);
  if j ->> 'status' <> 'executing' or j ? 'started_now' then raise exception 'FAIL second approve would apply again: %', j; end if;
  n := n + 4;
  reset role;

  -- Another person can't see, start or reject it.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.rozi_start_action(act, h); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL other person started it'; end if;
  denied := false; begin perform public.rozi_reject_action(act); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL other person rejected it'; end if;
  if jsonb_array_length(public.rozi_my_actions(50)) <> 0 then raise exception 'FAIL other person sees it in history'; end if;
  n := n + 3;
  reset role;

  -- Server finishes (only from executing); a later start returns the stored result, nothing runs again.
  set local role service_role;
  j := public.rozi_finish_action(a, act, true, '{"verified":true}'::jsonb);
  if j ->> 'status' <> 'completed' then raise exception 'FAIL finish'; end if;
  j := public.rozi_finish_action(a, act, false, null, 'late');
  if j ->> 'status' <> 'completed' then raise exception 'FAIL finished action changed again'; end if;
  denied := false; begin perform public.rozi_finish_action(b, act, true); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL finish for the wrong person'; end if;
  -- Expiry and rejection.
  j := public.rozi_propose_action(a, 'log_water', '{"ml":250}'::jsonb, '{}'::jsonb, h, 'log_water:expired-one');
  act2 := (j ->> 'id')::uuid;
  j := public.rozi_propose_action(a, 'log_water', '{"ml":250}'::jsonb, '{}'::jsonb, h, 'log_water:rejected-one');
  n := n + 3;
  reset role;
  update public.rozi_actions set expires_at = now() - interval '1 minute' where id = act2;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j2 := public.rozi_start_action(act, h);
  if j2 ->> 'status' <> 'completed' then raise exception 'FAIL completed action restarted'; end if;
  j2 := public.rozi_start_action(act2, h);
  if j2 ->> 'status' <> 'expired' then raise exception 'FAIL expired approval accepted: %', j2; end if;
  j2 := public.rozi_reject_action((j ->> 'id')::uuid);
  if j2 ->> 'status' <> 'rejected' then raise exception 'FAIL reject'; end if;
  j2 := public.rozi_start_action((j ->> 'id')::uuid, h);
  if j2 ->> 'status' <> 'rejected' then raise exception 'FAIL rejected action started'; end if;
  if jsonb_array_length(public.rozi_my_actions(50)) <> 3 then raise exception 'FAIL history count'; end if;
  n := n + 5;
  reset role;

  -- anon gets nothing.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  denied := false; begin perform public.rozi_my_actions(5); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL anon can list actions'; end if;
  denied := false; begin perform public.rozi_start_action(act, h); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL anon can start actions'; end if;
  n := n + 2;
  reset role;

  raise exception 'PASS rozi_actions_security: % checks', n;
end $test$;
rollback;
