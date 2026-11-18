-- Phase 7 step A — Chats.
--   * 1:1 chats ("direct") between two people who are friends, or trainer and client (an active link either way).
--   * One group chat per Train together group ("buddy"); its members are always the group's active members.
--   * Messages: text (up to 2,000 characters), a Rozi sticker, or a "share my workout" card. Senders can delete their
--     own. Anyone can block a person (no 1:1 messages either way; their group messages are hidden for you) and
--     report a message. Messages arrive live (Supabase Realtime on public.messages, limited by row security) and as
--     a phone notification from /api/push/chat (chat_push_log keeps it to one per chat every few minutes).
--   Reading messages is the only direct table access (so Realtime works); everything else goes through functions.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'buddy')),
  direct_key text unique,
  buddy_group_id uuid unique references public.buddy_groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check ((kind = 'direct' and direct_key is not null and buddy_group_id is null) or (kind = 'buddy' and buddy_group_id is not null and direct_key is null))
);
comment on column public.chats.direct_key is 'For 1:1 chats: the two user ids, smaller first, joined by a colon (one chat per pair).';

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default clock_timestamp(),
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);
comment on table public.chat_members is 'Read position and mute per person per chat. For group chats a row appears the first time someone opens it; membership itself comes from buddy_members.';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('text', 'sticker', 'workout')),
  body text not null default '' check (char_length(body) <= 2000),
  payload jsonb check (payload is null or pg_column_size(payload) <= 8192),
  -- clock_timestamp: exact order even for several messages inside one transaction.
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index if not exists messages_chat_time_idx on public.messages (chat_id, created_at desc);
create index if not exists messages_sender_time_idx on public.messages (sender_id, created_at desc);

create table if not exists public.chat_blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists chat_blocks_blocked_idx on public.chat_blocks (blocked);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  chat_id uuid references public.chats (id) on delete set null,
  reported_user uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('harassment', 'inappropriate', 'spam', 'unsafe', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  message_snapshot text not null default '',
  created_at timestamptz not null default now(),
  unique (reporter, message_id)
);
comment on table public.chat_reports is 'Reported messages, with a copy of the text at the time (kept if the sender deletes it). Reviewed by the owner.';

create table if not exists public.chat_push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);
comment on table public.chat_push_log is 'Server only: when each person last got a notification for each chat (one every few minutes at most).';

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_push_log enable row level security;
revoke all on public.chats, public.chat_members, public.messages, public.chat_blocks, public.chat_reports, public.chat_push_log from anon, authenticated;

-- ---------- Helpers ----------

-- Is this person in this chat? 1:1: a member row. Group: an active member of the Train together group.
create or replace function private.in_chat(p_chat uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chats chats
    where chats.id = p_chat and (
      (chats.kind = 'direct' and exists (select 1 from public.chat_members members where members.chat_id = chats.id and members.user_id = p_user))
      or (chats.kind = 'buddy' and exists (select 1 from public.buddy_members buddies where buddies.group_id = chats.buddy_group_id and buddies.user_id = p_user and buddies.status = 'active'))
    )
  );
$$;

create or replace function private.is_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_blocks blocks where (blocks.blocker = p_a and blocks.blocked = p_b) or (blocks.blocker = p_b and blocks.blocked = p_a));
$$;

-- Did the signed-in person block this sender? (Used by the reading policy, which can't read chat_blocks itself.)
create or replace function private.i_blocked(p_sender uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_blocks blocks where blocks.blocker = (select auth.uid()) and blocks.blocked = p_sender);
$$;

-- May these two people message each other 1:1? Friends, or trainer and client, and nobody blocked anybody.
create or replace function private.can_message(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_a is not null and p_b is not null and p_a <> p_b and not private.is_blocked(p_a, p_b) and (
    private.are_friends(p_a, p_b)
    or exists (select 1 from public.trainer_clients links where links.status = 'active'
      and ((links.trainer_id = p_a and links.client_id = p_b) or (links.trainer_id = p_b and links.client_id = p_a)))
  );
$$;

-- The other person in a 1:1 chat.
create or replace function private.chat_other(p_chat uuid, p_user uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select members.user_id from public.chat_members members where members.chat_id = p_chat and members.user_id <> p_user limit 1;
$$;

revoke all on function private.in_chat(uuid, uuid), private.is_blocked(uuid, uuid), private.i_blocked(uuid), private.can_message(uuid, uuid), private.chat_other(uuid, uuid) from public;
grant execute on function private.in_chat(uuid, uuid), private.i_blocked(uuid) to authenticated;

-- Reading messages (also what Realtime checks): your chats only, and never from someone you blocked.
create policy "Members read their chats' messages" on public.messages for select to authenticated
  using (
    private.in_chat(chat_id, (select auth.uid())) and not private.i_blocked(sender_id)
  );
grant select on public.messages to authenticated;

-- Live delivery.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------- Opening chats ----------

-- The 1:1 chat with a friend, trainer or client (made the first time).
create or replace function public.open_direct_chat(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_key text;
  v_chat uuid;
begin
  if v_user is null then raise exception 'Sign in to chat.' using errcode = '42501'; end if;
  v_key := least(v_user::text, p_other::text) || ':' || greatest(v_user::text, p_other::text);
  select chats.id into v_chat from public.chats chats where chats.direct_key = v_key;
  if v_chat is null then
    if not private.can_message(v_user, p_other) then raise exception 'You can message friends, your trainer and your clients.' using errcode = '42501'; end if;
    insert into public.chats (kind, direct_key) values ('direct', v_key) on conflict (direct_key) do nothing returning id into v_chat;
    if v_chat is null then select chats.id into v_chat from public.chats chats where chats.direct_key = v_key; end if;
  elsif not exists (select 1 from public.chat_members members where members.chat_id = v_chat and members.user_id = v_user) then
    raise exception 'This chat isn''t yours.' using errcode = '42501';
  end if;
  insert into public.chat_members (chat_id, user_id) values (v_chat, v_user), (v_chat, p_other) on conflict do nothing;
  return v_chat;
end;
$$;

-- Your Train together group's chat (made the first time).
create or replace function public.open_buddy_chat()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
  v_chat uuid;
begin
  if v_user is null or v_group is null then raise exception 'Join a Train together group to use its chat.' using errcode = '22023'; end if;
  insert into public.chats (kind, buddy_group_id) values ('buddy', v_group) on conflict (buddy_group_id) do nothing returning id into v_chat;
  if v_chat is null then select chats.id into v_chat from public.chats chats where chats.buddy_group_id = v_group; end if;
  insert into public.chat_members (chat_id, user_id) values (v_chat, v_user) on conflict do nothing;
  return v_chat;
end;
$$;

-- ---------- Sending ----------

create or replace function public.send_message(p_chat uuid, p_kind text, p_body text default '', p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_chat public.chats%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
  v_payload jsonb := p_payload;
  v_row public.messages%rowtype;
begin
  if v_user is null then raise exception 'Sign in to chat.' using errcode = '42501'; end if;
  select * into v_chat from public.chats chats where chats.id = p_chat;
  if not found or not private.in_chat(p_chat, v_user) then raise exception 'This chat isn''t yours.' using errcode = '42501'; end if;
  if v_chat.kind = 'direct' and not private.can_message(v_user, private.chat_other(p_chat, v_user)) then
    raise exception 'You can''t message this person any more.' using errcode = '42501';
  end if;
  if (select count(*) from public.messages messages where messages.sender_id = v_user and messages.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Slow down a little — try again in a minute.' using errcode = '22023';
  end if;
  if p_kind = 'text' then
    if v_body = '' then raise exception 'Write a message first.' using errcode = '22023'; end if;
    if char_length(v_body) > 2000 then raise exception 'Keep it under 2,000 characters.' using errcode = '22023'; end if;
    v_payload := null;
  elsif p_kind = 'sticker' then
    if coalesce(jsonb_typeof(v_payload), '') <> 'object' or coalesce(v_payload ->> 'mood', '') <> all (array['cheer', 'chat-hello', 'milestone', 'trophy',
      'personal-record', 'streak-risk', 'grumpy', 'comeback', 'care', 'workout', 'energy-5', 'energy-1', 'rest', 'water', 'chat-idea', 'done-day']) then
      raise exception 'Choose a sticker.' using errcode = '22023';
    end if;
    v_body := ''; v_payload := jsonb_build_object('mood', v_payload ->> 'mood');
  elsif p_kind = 'workout' then
    -- Checked step by step (a SQL "or" doesn't promise an order, and jsonb_array_length fails on a non-array).
    if coalesce(jsonb_typeof(v_payload), '') <> 'object' or coalesce(jsonb_typeof(v_payload -> 'exercises'), '') <> 'array' then
      raise exception 'That workout card can''t be shared.' using errcode = '22023';
    end if;
    if coalesce(char_length(v_payload ->> 'title'), 0) not between 1 and 80 or jsonb_array_length(v_payload -> 'exercises') > 12 or pg_column_size(v_payload) > 8192 then
      raise exception 'That workout card can''t be shared.' using errcode = '22023';
    end if;
    if char_length(v_body) > 500 then raise exception 'Keep the note under 500 characters.' using errcode = '22023'; end if;
  else
    raise exception 'Unknown message type.' using errcode = '22023';
  end if;
  insert into public.messages (chat_id, sender_id, kind, body, payload) values (p_chat, v_user, p_kind, v_body, v_payload) returning * into v_row;
  update public.chats chats set last_message_at = v_row.created_at where chats.id = p_chat;
  insert into public.chat_members (chat_id, user_id, last_read_at) values (p_chat, v_user, v_row.created_at)
    on conflict (chat_id, user_id) do update set last_read_at = excluded.last_read_at;
  return to_jsonb(v_row);
end;
$$;

-- Delete your own message (it shows as "Message deleted").
create or replace function public.delete_message(p_message uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.messages messages set deleted_at = now(), body = '', payload = null
    where messages.id = p_message and messages.sender_id = (select auth.uid()) and messages.deleted_at is null;
  return found;
end;
$$;

-- ---------- Reading, mute, block, report ----------

create or replace function public.mark_chat_read(p_chat uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not private.in_chat(p_chat, v_user) then raise exception 'This chat isn''t yours.' using errcode = '42501'; end if;
  insert into public.chat_members (chat_id, user_id, last_read_at) values (p_chat, v_user, clock_timestamp())
    on conflict (chat_id, user_id) do update set last_read_at = clock_timestamp();
  return clock_timestamp();
end;
$$;

create or replace function public.set_chat_muted(p_chat uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not private.in_chat(p_chat, v_user) then raise exception 'This chat isn''t yours.' using errcode = '42501'; end if;
  insert into public.chat_members (chat_id, user_id, muted) values (p_chat, v_user, coalesce(p_on, false))
    on conflict (chat_id, user_id) do update set muted = coalesce(p_on, false);
  return coalesce(p_on, false);
end;
$$;

-- Block (or unblock) someone: no 1:1 messages either way, and their group messages are hidden for you.
create or replace function public.set_chat_block(p_user uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or p_user is null or p_user = v_user then raise exception 'Choose someone to block.' using errcode = '22023'; end if;
  if p_on then
    insert into public.chat_blocks (blocker, blocked) values (v_user, p_user) on conflict do nothing;
  else
    delete from public.chat_blocks blocks where blocks.blocker = v_user and blocks.blocked = p_user;
  end if;
  return p_on;
end;
$$;

create or replace function public.report_message(p_message uuid, p_reason text, p_note text default '')
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.messages%rowtype;
begin
  if v_user is null then raise exception 'Sign in to report.' using errcode = '42501'; end if;
  select * into v_row from public.messages messages where messages.id = p_message;
  if not found or not private.in_chat(v_row.chat_id, v_user) then raise exception 'You can only report messages you can see.' using errcode = '42501'; end if;
  if v_row.sender_id = v_user then raise exception 'That''s your own message.' using errcode = '22023'; end if;
  if p_reason not in ('harassment', 'inappropriate', 'spam', 'unsafe', 'other') then raise exception 'Choose a reason.' using errcode = '22023'; end if;
  insert into public.chat_reports (reporter, message_id, chat_id, reported_user, reason, note, message_snapshot)
  values (v_user, p_message, v_row.chat_id, v_row.sender_id, p_reason, left(btrim(coalesce(p_note, '')), 500),
    case v_row.kind when 'text' then v_row.body when 'sticker' then '[sticker]' else '[workout] ' || coalesce(v_row.payload ->> 'title', '') || ' ' || v_row.body end)
  on conflict (reporter, message_id) do nothing;
  return true;
end;
$$;

-- ---------- Lists ----------

-- Your chats, newest first: the group chat (if you train together) and every 1:1 chat with at least one message
-- (or opened by you). Title and picture, last message, unread count, mute, and whether you can still send.
create or replace function public.my_chats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid := private.my_buddy_group();
begin
  if v_user is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(item order by coalesce((item ->> 'last_at')::timestamptz, (item ->> 'created_at')::timestamptz) desc)
    from (
      select jsonb_build_object(
        'id', chats.id, 'kind', chats.kind, 'created_at', chats.created_at, 'last_at', chats.last_message_at,
        'other_id', other.id,
        'title', case when chats.kind = 'buddy' then 'Train together' else coalesce(other.display_name, 'Friend') end,
        'avatar', case when chats.kind = 'buddy' then '' else coalesce(other.avatar, '') end,
        'members', case when chats.kind = 'buddy' then (
          select jsonb_agg(jsonb_build_object('id', profiles.id, 'name', coalesce(profiles.display_name, 'Buddy'), 'avatar', coalesce(profiles.avatar, '')) order by buddies.joined_at nulls last)
          from public.buddy_members buddies join public.profiles profiles on profiles.id = buddies.user_id
          where buddies.group_id = chats.buddy_group_id and buddies.status = 'active') end,
        'muted', coalesce(mine.muted, false),
        'blocked', other.id is not null and exists (select 1 from public.chat_blocks blocks where blocks.blocker = v_user and blocks.blocked = other.id),
        'can_send', case when chats.kind = 'buddy' then true else private.can_message(v_user, other.id) end,
        'unread', (select count(*) from public.messages messages
          where messages.chat_id = chats.id and messages.sender_id <> v_user and messages.deleted_at is null
            and messages.created_at > coalesce(mine.last_read_at, '-infinity'::timestamptz)
            and not exists (select 1 from public.chat_blocks blocks where blocks.blocker = v_user and blocks.blocked = messages.sender_id)),
        'last', (select jsonb_build_object('kind', messages.kind, 'body', left(messages.body, 140), 'title', messages.payload ->> 'title',
            'sender_id', messages.sender_id, 'deleted', messages.deleted_at is not null, 'at', messages.created_at)
          from public.messages messages where messages.chat_id = chats.id
            and not exists (select 1 from public.chat_blocks blocks where blocks.blocker = v_user and blocks.blocked = messages.sender_id)
          order by messages.created_at desc limit 1)
      ) as item
      from public.chats chats
      left join public.chat_members mine on mine.chat_id = chats.id and mine.user_id = v_user
      left join public.profiles other on chats.kind = 'direct' and other.id = private.chat_other(chats.id, v_user)
      where (chats.kind = 'direct' and mine.user_id is not null) or (chats.kind = 'buddy' and chats.buddy_group_id = v_group)
    ) listed
  ), '[]'::jsonb);
end;
$$;

-- Who you can start a 1:1 chat with: friends, your trainers, your clients (names and pictures).
create or replace function public.chat_people()
returns table (user_id uuid, display_name text, avatar text, role text)
language sql stable security definer set search_path = '' as $$
  with people as (
    select friends.friend_id as id, 'friend' as role from public.friendships friends where friends.user_id = (select auth.uid())
    union select links.trainer_id, 'trainer' from public.trainer_clients links where links.client_id = (select auth.uid()) and links.status = 'active'
    union select links.client_id, 'client' from public.trainer_clients links where links.trainer_id = (select auth.uid()) and links.status = 'active'
  )
  select profiles.id, coalesce(profiles.display_name, 'Friend'), coalesce(profiles.avatar, ''),
    (array_agg(people.role order by case people.role when 'trainer' then 0 when 'client' then 1 else 2 end))[1]
  from people join public.profiles profiles on profiles.id = people.id
  where not private.is_blocked((select auth.uid()), people.id)
  group by profiles.id, profiles.display_name, profiles.avatar
  order by 2;
$$;

-- The people in one chat (names and pictures for the thread), including past members of a group who wrote in it.
create or replace function public.chat_members_info(p_chat uuid)
returns table (user_id uuid, display_name text, avatar text)
language sql stable security definer set search_path = '' as $$
  select profiles.id, coalesce(profiles.display_name, 'Someone'), coalesce(profiles.avatar, '')
  from public.profiles profiles
  where private.in_chat(p_chat, (select auth.uid())) and (
    profiles.id in (select members.user_id from public.chat_members members where members.chat_id = p_chat)
    or profiles.id in (select distinct messages.sender_id from public.messages messages where messages.chat_id = p_chat)
    or profiles.id in (select buddies.user_id from public.chats chats join public.buddy_members buddies on buddies.group_id = chats.buddy_group_id
      where chats.id = p_chat and buddies.status = 'active')
  );
$$;

-- ---------- Access ----------

revoke all on function public.open_direct_chat(uuid), public.open_buddy_chat(), public.send_message(uuid, text, text, jsonb), public.delete_message(uuid),
  public.mark_chat_read(uuid), public.set_chat_muted(uuid, boolean), public.set_chat_block(uuid, boolean), public.report_message(uuid, text, text),
  public.my_chats(), public.chat_people(), public.chat_members_info(uuid) from public, anon;
grant execute on function public.open_direct_chat(uuid), public.open_buddy_chat(), public.send_message(uuid, text, text, jsonb), public.delete_message(uuid),
  public.mark_chat_read(uuid), public.set_chat_muted(uuid, boolean), public.set_chat_block(uuid, boolean), public.report_message(uuid, text, text),
  public.my_chats(), public.chat_people(), public.chat_members_info(uuid) to authenticated;
