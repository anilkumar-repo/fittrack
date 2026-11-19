-- ---------- Rozi AI + age: repeatable security test ----------
--
-- Run AFTER migrations 20261118230000_rozi_chat_history.sql and 20261119090000_age_and_rozi_security.sql.
-- Paste into the Supabase SQL editor (or run with psql). It changes NOTHING: two temporary accounts are made inside a
-- transaction, every check runs as those accounts (role authenticated / anon / service_role), and the block always
-- ends with an error so the whole transaction is rolled back.
--
--   Success:  ERROR:  PASS rozi_ai_security: <n> checks
--   Failure:  ERROR:  FAIL <what went wrong>
--
-- Checks: tables closed to the app; one person can't read, continue, save into or delete another's chat; the browser
-- can't save AI replies (server-only function); anon can't call anything; the 6-a-minute limit; the advisory lock; the
-- 18+ rule at its exact boundary (year-only and full date of birth) and the findable switch.

begin;
do $test$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  yr int := extract(year from current_date)::int;
  conv_a uuid;
  j jsonb;
  n int := 0;
  i int;
  denied boolean;

begin
  insert into auth.users (id, aud, role, email, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', 'rozi-sec-a-' || a || '@example.invalid', now(), now()),
    (b, 'authenticated', 'authenticated', 'rozi-sec-b-' || b || '@example.invalid', now(), now());

  -- ---- A: an adult with a conversation ----
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.profiles (id, birth_year) values (a, (yr - 30)::smallint);
  j := public.rozi_start_question(null, 'A private question');
  conv_a := (j ->> 'conversation_id')::uuid;
  if conv_a is null or (j ->> 'allowed')::boolean is distinct from true then raise exception 'FAIL A could not start a question: %', j; end if;
  n := n + 1;

  -- The tables themselves are closed to the app.
  denied := false; begin perform 1 from public.rozi_messages limit 1; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL authenticated can read rozi_messages directly'; end if;
  denied := false; begin perform 1 from public.rozi_conversations limit 1; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL authenticated can read rozi_conversations directly'; end if;
  n := n + 2;

  -- The browser can't save an AI reply, with or without saying so.
  denied := false; begin perform public.rozi_save_reply(conv_a, 'forged AI', null, 'ai', 'm', '[]'::jsonb); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL app saved a reply with source ai'; end if;
  denied := false; begin perform public.rozi_save_reply(conv_a, 'forged AI (default source)'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL app saved a reply with the default source'; end if;
  denied := false; begin perform public.rozi_save_ai_reply(a, conv_a, 'x'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL app can call the server-only rozi_save_ai_reply'; end if;
  perform public.rozi_save_reply(conv_a, 'on-phone answer', 'TODAY_WORKOUT', 'phone', 'ignored', '[{"x":1}]'::jsonb);
  n := n + 3;
  reset role;
  if not exists (select 1 from public.rozi_messages where conversation_id = conv_a and source = 'phone' and model is null and cards is null) then
    raise exception 'FAIL phone reply not saved, or kept model/cards';
  end if;
  n := n + 1;

  -- ---- B: another adult, trying to reach A's conversation ----
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.profiles (id, birth_year) values (b, (yr - 30)::smallint);
  if public.rozi_conversation(conv_a) is not null then raise exception 'FAIL B can open A''s conversation'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(to_jsonb(public.rozi_conversations(100)), '[]'::jsonb)) e where e ->> 'id' = conv_a::text) then
    raise exception 'FAIL A''s conversation is in B''s list';
  end if;
  j := public.rozi_start_question(conv_a, 'B tries to continue A''s chat');
  if (j ->> 'conversation_id')::uuid = conv_a then raise exception 'FAIL B attached a question to A''s conversation'; end if;
  denied := false; begin perform public.rozi_save_reply(conv_a, 'B writes into A', null, 'phone'); exception when insufficient_privilege or no_data_found or raise_exception then denied := true; end;
  if not denied then raise exception 'FAIL B saved a reply into A''s conversation'; end if;
  if public.rozi_delete_conversation(conv_a) then raise exception 'FAIL B deleted A''s conversation'; end if;
  perform public.rozi_delete_all_conversations();
  n := n + 5;
  reset role;
  if not exists (select 1 from public.rozi_conversations where id = conv_a and user_id = a) then raise exception 'FAIL A''s conversation was removed by B'; end if;
  n := n + 1;

  -- ---- Server (service role): saves only into the named person's own conversation ----
  set local role service_role;
  perform public.rozi_save_ai_reply(a, conv_a, 'Real AI reply', 'TODAY_WORKOUT', 'openai/gpt-oss-20b', '[{"type":"stat"}]'::jsonb);
  denied := false; begin perform public.rozi_save_ai_reply(b, conv_a, 'wrong owner'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL server saved into a conversation of the wrong person'; end if;
  reset role;
  if (select count(*) from public.rozi_messages where conversation_id = conv_a and source = 'ai') <> 1 then raise exception 'FAIL server AI reply not saved exactly once'; end if;
  n := n + 2;

  -- ---- anon can't call anything ----
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  denied := false; begin perform public.rozi_start_question(null, 'x'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL anon can call rozi_start_question'; end if;
  denied := false; begin perform public.rozi_conversation(conv_a); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL anon can call rozi_conversation'; end if;
  denied := false; begin perform public.rozi_save_ai_reply(a, conv_a, 'x'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL anon can call rozi_save_ai_reply'; end if;
  n := n + 3;
  reset role;

  -- ---- Limits: 6 a minute (A already asked 1, B's attempts don't count for A) ----
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..5 loop
    j := public.rozi_start_question(conv_a, 'q' || i);
    if (j ->> 'allowed')::boolean is distinct from true then raise exception 'FAIL question % of 6 was refused: %', i + 1, j; end if;
  end loop;
  j := public.rozi_start_question(conv_a, 'one too many');
  if (j ->> 'allowed')::boolean is distinct from false or j ->> 'limit' <> 'minute' then raise exception 'FAIL 7th question in a minute was allowed: %', j; end if;
  n := n + 2;
  reset role;
  if (select pg_get_functiondef(p.oid) not like '%pg_advisory_xact_lock%' from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'rozi_start_question') then
    raise exception 'FAIL rozi_start_question has no per-person advisory lock';
  end if;
  n := n + 1;

  -- ---- Age: 18+ at the exact boundary ----
  if private.is_adult((yr - 18)::smallint, null) then raise exception 'FAIL year-only 18 counted as adult (could be 17)'; end if;
  if not private.is_adult((yr - 19)::smallint, null) then raise exception 'FAIL year-only 19 not adult'; end if;
  if not private.is_adult(null, (current_date - interval '18 years')::date) then raise exception 'FAIL 18th birthday today not adult'; end if;
  if private.is_adult(null, (current_date - interval '18 years' + interval '1 day')::date) then raise exception 'FAIL 18th birthday tomorrow counted as adult'; end if;
  if private.is_adult(null::smallint, null::date) then raise exception 'FAIL no age counted as adult'; end if;
  n := n + 5;
  if exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
             where s.nspname in ('public', 'private') and p.prokind = 'f' and pg_get_functiondef(p.oid) ~ 'is_adult\([a-z_]+\.birth_year\)') then
    raise exception 'FAIL a function still calls the year-only is_adult';
  end if;
  n := n + 1;

  -- Findable needs a confirmed adult; future birth dates are refused.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set birth_year = (yr - 18)::smallint, birth_date = null, findable = true where id = b;
  if (select findable from public.profiles where id = b) then raise exception 'FAIL year-only 18 can be findable'; end if;
  update public.profiles set birth_date = (current_date - interval '18 years' + interval '1 day')::date, findable = true where id = b;
  if (select findable from public.profiles where id = b) then raise exception 'FAIL 17 (birthday tomorrow) can be findable'; end if;
  update public.profiles set birth_date = (current_date - interval '18 years')::date, findable = true where id = b;
  if not (select findable from public.profiles where id = b) then raise exception 'FAIL 18 today cannot be findable'; end if;
  denied := false; begin update public.profiles set birth_date = current_date + 1 where id = b; exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'FAIL a future date of birth was accepted'; end if;
  n := n + 4;
  reset role;

  raise exception 'PASS rozi_ai_security: % checks', n;
end $test$;
rollback;
