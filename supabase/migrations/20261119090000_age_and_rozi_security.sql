-- Security audit Phase A (2026-11-19).
--
-- 1. Age: a birth YEAR alone can't prove someone is 18 — a person born in December 2008 is still 17 in November 2026
--    (and the app stores birth_year as "this year − age", so it's approximate anyway). Adults are now:
--      * a full date of birth (new optional profiles.birth_date) that is 18 years ago or more, today; or
--      * only a birth year, at least 19 years ago (certain whatever the birthday).
--    Everything that decides "adult" (findable, search, suggestions, friend requests, profiles, public profile) uses it.
--    Findable accounts that no longer qualify are switched to not findable.
-- 2. Rozi AI: rozi_start_question takes a per-person lock, so two questions at the same moment can't both slip under
--    the 6-a-minute / 60-a-day limit.
-- 3. Rozi AI: replies marked as AI can only be saved by the server (service role, after it checked the sign-in);
--    the app itself can only save its own on-phone answers.

-- ---------- 1. Age ----------

alter table public.profiles add column if not exists birth_date date
  check (birth_date is null or birth_date between date '1900-01-01' and date '2100-12-31');
comment on column public.profiles.birth_date is 'Optional full date of birth. Needed to confirm 18+ when the birth year alone can''t (born exactly 18 years ago).';

-- A full date wins: birth_year follows it, and a future date is refused.
create or replace function private.sync_birth_year()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.birth_date is not null then
    if new.birth_date > current_date then raise exception 'Date of birth can''t be in the future.' using errcode = '22023'; end if;
    new.birth_year := extract(year from new.birth_date)::smallint;
  end if;
  return new;
end;
$$;
drop trigger if exists a_sync_birth_year on public.profiles;
-- Named "a_…" so it runs before enforce_findable (triggers fire in name order).
create trigger a_sync_birth_year before insert or update on public.profiles for each row execute function private.sync_birth_year();

-- Adult today: from the full date when known, otherwise only when the birth year makes it certain.
create or replace function private.is_adult(p_birth_year smallint, p_birth_date date)
returns boolean language sql stable set search_path = '' as $$
  select case
    when p_birth_date is not null then p_birth_date <= (current_date - interval '18 years')::date
    else p_birth_year is not null and (extract(year from current_date)::integer - p_birth_year) >= 19
  end;
$$;
-- The old one-value version stays for safety, now strict as well.
create or replace function private.is_adult(p_birth_year smallint)
returns boolean language sql stable set search_path = '' as $$
  select private.is_adult(p_birth_year, null::date);
$$;
revoke all on function private.is_adult(smallint, date), private.is_adult(smallint), private.sync_birth_year() from public;

-- Switch every existing caller from is_adult(x.birth_year) to is_adult(x.birth_year, x.birth_date). The live definitions
-- are rewritten in place (only that call changes; owner, grants, SECURITY DEFINER and search_path are kept), and the
-- migration stops if the number of rewritten functions isn't exactly what was reviewed.
do $rewrite$
declare
  f record;
  v_def text;
  v_new text;
  v_count integer := 0;
begin
  for f in
    select p.oid, n.nspname, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f'
      and p.proname in ('enforce_findable', 'set_public_profile', 'search_people', 'suggested_people', 'send_friend_request', 'person_profile')
  loop
    v_def := pg_get_functiondef(f.oid);
    v_new := regexp_replace(v_def, 'private\.is_adult\(([a-z_]+)\.birth_year\)', 'private.is_adult(\1.birth_year, \1.birth_date)', 'g');
    if v_new = v_def then raise exception 'Age rewrite: no is_adult call found in %.%', f.nspname, f.proname; end if;
    if v_new ~ 'private\.is_adult\([a-z_]+\.birth_year\)' then raise exception 'Age rewrite: % still has a one-value call', f.proname; end if;
    execute v_new;
    v_count := v_count + 1;
  end loop;
  if v_count <> 6 then raise exception 'Age rewrite: expected 6 functions, rewrote %', v_count; end if;
end;
$rewrite$;

-- Accounts that were findable but can no longer be confirmed as adults stop being findable (the trigger agrees).
update public.profiles set findable = false where findable and not private.is_adult(birth_year, birth_date);

-- ---------- 2. Rozi AI: one question at a time per person ----------

create or replace function public.rozi_start_question(p_conversation uuid, p_message text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_message text := btrim(coalesce(p_message, ''));
  v_minute int;
  v_day int;
  v_oldest timestamptz;
  v_conversation uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to ask Rozi.' using errcode = '42501'; end if;
  if char_length(v_message) not between 1 and 300 then raise exception 'Ask a question of up to 300 characters.' using errcode = '22023'; end if;
  -- One question at a time per person: a second request at the same moment waits here until the first has counted
  -- and saved, so concurrent requests can't both slip under the limit. Released at the end of the transaction.
  perform pg_advisory_xact_lock(hashtextextended('rozi_start_question:' || v_user::text, 0));

  select count(*) into v_minute from public.rozi_messages m where m.user_id = v_user and m.sender = 'me' and m.created_at > clock_timestamp() - interval '1 minute';
  if v_minute >= 6 then
    select min(m.created_at) into v_oldest from public.rozi_messages m where m.user_id = v_user and m.sender = 'me' and m.created_at > clock_timestamp() - interval '1 minute';
    return jsonb_build_object('allowed', false, 'limit', 'minute', 'retry_after_seconds', greatest(1, ceil(extract(epoch from v_oldest + interval '1 minute' - clock_timestamp()))::int));
  end if;
  select count(*) into v_day from public.rozi_messages m where m.user_id = v_user and m.sender = 'me' and m.created_at > clock_timestamp() - interval '1 day';
  if v_day >= 60 then
    select min(m.created_at) into v_oldest from public.rozi_messages m where m.user_id = v_user and m.sender = 'me' and m.created_at > clock_timestamp() - interval '1 day';
    return jsonb_build_object('allowed', false, 'limit', 'day', 'retry_after_seconds', greatest(1, ceil(extract(epoch from v_oldest + interval '1 day' - clock_timestamp()))::int));
  end if;

  if p_conversation is not null then
    select c.id into v_conversation from public.rozi_conversations c where c.id = p_conversation and c.user_id = v_user;
  end if;
  if v_conversation is null then
    delete from public.rozi_conversations c where c.user_id = v_user and c.updated_at < clock_timestamp() - interval '180 days';
    insert into public.rozi_conversations (user_id, title) values (v_user, left(v_message, 80)) returning id into v_conversation;
  end if;

  insert into public.rozi_messages (conversation_id, user_id, sender, message) values (v_conversation, v_user, 'me', v_message) returning id into v_id;
  update public.rozi_conversations c set updated_at = clock_timestamp() where c.id = v_conversation;
  return jsonb_build_object('allowed', true, 'conversation_id', v_conversation, 'message_id', v_id, 'used_today', v_day + 1);
end;
$$;

-- ---------- 3. Rozi AI: only the server saves AI replies ----------

-- Called by the app: it may only save its own on-phone answers (source 'phone').
create or replace function public.rozi_save_reply(p_conversation uuid, p_message text, p_intent text default null, p_source text default 'ai', p_model text default null, p_cards jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to ask Rozi.' using errcode = '42501'; end if;
  if coalesce(p_source, 'ai') <> 'phone' then raise exception 'Only RozFit''s server saves AI replies.' using errcode = '42501'; end if;
  if not exists (select 1 from public.rozi_conversations c where c.id = p_conversation and c.user_id = v_user) then
    raise exception 'This conversation isn''t yours.' using errcode = '42501';
  end if;
  if char_length(v_message) not between 1 and 1500 then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  if p_intent is not null and p_intent !~ '^[A-Z_]{2,40}$' then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  -- On-phone answers carry no model and no cards.
  insert into public.rozi_messages (conversation_id, user_id, sender, message, intent, source)
    values (p_conversation, v_user, 'rozi', v_message, p_intent, 'phone') returning id into v_id;
  update public.rozi_conversations c set updated_at = clock_timestamp() where c.id = p_conversation;
  return v_id;
end;
$$;

-- Called only by the server (service role), after /api/rozi/chat checked the person's sign-in.
create or replace function public.rozi_save_ai_reply(p_user uuid, p_conversation uuid, p_message text, p_intent text default null, p_model text default null, p_cards jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if p_user is null or not exists (select 1 from public.rozi_conversations c where c.id = p_conversation and c.user_id = p_user) then
    raise exception 'This conversation isn''t this person''s.' using errcode = '42501';
  end if;
  if char_length(v_message) not between 1 and 1500 then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  if p_intent is not null and p_intent !~ '^[A-Z_]{2,40}$' then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  if p_cards is not null and (jsonb_typeof(p_cards) <> 'array' or pg_column_size(p_cards) > 16384) then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  insert into public.rozi_messages (conversation_id, user_id, sender, message, intent, source, model, cards)
    values (p_conversation, p_user, 'rozi', v_message, p_intent, 'ai', left(p_model, 80), p_cards) returning id into v_id;
  update public.rozi_conversations c set updated_at = clock_timestamp() where c.id = p_conversation;
  return v_id;
end;
$$;
revoke all on function public.rozi_save_ai_reply(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.rozi_save_ai_reply(uuid, uuid, text, text, text, jsonb) to service_role;
