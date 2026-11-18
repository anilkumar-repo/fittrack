-- Rozi AI stage 6 — chat history and the daily question limit.
--   * rozi_conversations / rozi_messages: one person's own chats with Rozi AI. Deleted with the account (cascade).
--   * The tables are closed; everything goes through the functions below, which work only on the caller's own rows.
--   * rozi_start_question records a question and enforces the limits (6 a minute, 60 a day) from these rows, so the
--     limit holds across server instances and restarts. A question without a reply means Rozi answered on the phone
--     (the AI was busy) — history shows it honestly.
--   * Conversations untouched for 180 days are removed when the person starts a new one.

create table if not exists public.rozi_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists rozi_conversations_user_time_idx on public.rozi_conversations (user_id, updated_at desc);

create table if not exists public.rozi_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.rozi_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sender text not null check (sender in ('me', 'rozi')),
  message text not null check (char_length(message) between 1 and 1500),
  intent text check (intent is null or intent ~ '^[A-Z_]{2,40}$'),
  source text check (source is null or source in ('ai', 'phone')),
  model text check (model is null or char_length(model) <= 80),
  cards jsonb check (cards is null or (jsonb_typeof(cards) = 'array' and pg_column_size(cards) <= 16384)),
  -- clock_timestamp: exact order even for a question and its reply inside one transaction.
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists rozi_messages_conversation_time_idx on public.rozi_messages (conversation_id, created_at);
create index if not exists rozi_messages_user_time_idx on public.rozi_messages (user_id, created_at desc) where sender = 'me';

alter table public.rozi_conversations enable row level security;
alter table public.rozi_messages enable row level security;
revoke all on public.rozi_conversations, public.rozi_messages from anon, authenticated;

comment on table public.rozi_conversations is 'Rozi AI chats, one person each. Closed: use the rozi_* functions.';
comment on table public.rozi_messages is 'Questions (sender me) and Rozi AI replies (sender rozi). A question without a reply was answered on the phone.';

-- ---------- Ask: record the question, enforce the limits, start or continue a conversation ----------

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

  -- Continue the caller's own conversation; an unknown or someone else's id starts a new one (never attaches).
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

-- ---------- Save Rozi's reply into the caller's own conversation ----------

create or replace function public.rozi_save_reply(p_conversation uuid, p_message text, p_intent text default null, p_source text default 'ai', p_model text default null, p_cards jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to ask Rozi.' using errcode = '42501'; end if;
  if not exists (select 1 from public.rozi_conversations c where c.id = p_conversation and c.user_id = v_user) then
    raise exception 'This conversation isn''t yours.' using errcode = '42501';
  end if;
  if char_length(v_message) not between 1 and 1500 then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  if p_intent is not null and p_intent !~ '^[A-Z_]{2,40}$' then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  if coalesce(p_source, 'ai') not in ('ai', 'phone') then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  if p_cards is not null and (jsonb_typeof(p_cards) <> 'array' or pg_column_size(p_cards) > 16384) then raise exception 'That reply can''t be saved.' using errcode = '22023'; end if;
  insert into public.rozi_messages (conversation_id, user_id, sender, message, intent, source, model, cards)
    values (p_conversation, v_user, 'rozi', v_message, p_intent, coalesce(p_source, 'ai'), left(p_model, 80), p_cards) returning id into v_id;
  update public.rozi_conversations c set updated_at = clock_timestamp() where c.id = p_conversation;
  return v_id;
end;
$$;

-- ---------- Read ----------

-- The caller's recent conversations, newest first.
create or replace function public.rozi_conversations(p_limit int default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_data order by updated_at desc), '[]'::jsonb) from (
    select c.updated_at, jsonb_build_object('id', c.id, 'title', c.title, 'created_at', c.created_at, 'updated_at', c.updated_at,
      'messages', (select count(*) from public.rozi_messages m where m.conversation_id = c.id)) as row_data
    from public.rozi_conversations c
    where c.user_id = (select auth.uid())
    order by c.updated_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) recent;
$$;

-- One of the caller's conversations with its messages (oldest first, up to 200), or null if it isn't theirs.
create or replace function public.rozi_conversation(p_conversation uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'created_at', c.created_at, 'updated_at', c.updated_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'message', m.message, 'intent', m.intent, 'source', m.source,
        'model', m.model, 'cards', m.cards, 'created_at', m.created_at) order by m.created_at)
      from (select * from public.rozi_messages m2 where m2.conversation_id = c.id order by m2.created_at limit 200) m
    ), '[]'::jsonb))
  from public.rozi_conversations c
  where c.id = p_conversation and c.user_id = (select auth.uid());
$$;

-- ---------- Delete ----------

create or replace function public.rozi_delete_conversation(p_conversation uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from public.rozi_conversations c where c.id = p_conversation and c.user_id = v_user;
  return found;
end;
$$;

create or replace function public.rozi_delete_all_conversations()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_count integer;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from public.rozi_conversations c where c.user_id = v_user;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- Access ----------

revoke all on function public.rozi_start_question(uuid, text), public.rozi_save_reply(uuid, text, text, text, text, jsonb),
  public.rozi_conversations(int), public.rozi_conversation(uuid), public.rozi_delete_conversation(uuid), public.rozi_delete_all_conversations()
  from public, anon;
grant execute on function public.rozi_start_question(uuid, text), public.rozi_save_reply(uuid, text, text, text, text, jsonb),
  public.rozi_conversations(int), public.rozi_conversation(uuid), public.rozi_delete_conversation(uuid), public.rozi_delete_all_conversations()
  to authenticated;
