-- Phase 7 step C — Discover + profiles.
--   * A public face for each person: a unique @username, a short bio, and "Let people find me".
--     Findable is forced OFF for anyone under 18 — and for anyone without a birth year, since age can't be checked.
--   * Find people (search by name or @username, only people who are findable) and "People you may know" (findable
--     friends of friends, with the mutual count). Connecting is by friend request — the feed and chats stay
--     friends-only; there are no public followers.
--   * Profile page: anyone you're connected to (or a findable person) shows name, picture, @username and bio;
--     friends (and you) also see streaks, this month's workouts and their posts.
--   Tables are closed; everything goes through the functions below.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists findable boolean not null default true;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_.]{3,20}$');
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 160);
create unique index if not exists profiles_username_idx on public.profiles (username) where username is not null;
comment on column public.profiles.findable is 'Shown in Find friends / suggestions. Always false for under-18s and when no birth year is set (enforced by a trigger).';

-- Adults only, decided from the birth year (unknown age counts as not adult).
create or replace function private.is_adult(p_birth_year smallint)
returns boolean language sql stable set search_path = '' as $$
  select p_birth_year is not null and (extract(year from current_date)::integer - p_birth_year) >= 18;
$$;

create or replace function private.enforce_findable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.is_adult(new.birth_year) then new.findable := false; end if;
  if new.username is not null then new.username := lower(btrim(new.username)); end if;
  return new;
end;
$$;
drop trigger if exists enforce_findable on public.profiles;
create trigger enforce_findable before insert or update on public.profiles for each row execute function private.enforce_findable();
-- Accounts that existed before this update never chose to be findable, so they start unfindable (they can turn it on
-- from their profile). New adult accounts start findable; under-18s and unknown ages are always off (trigger above).
update public.profiles set findable = false where findable;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  check (from_user <> to_user)
);
create unique index if not exists friend_requests_one_pending_idx on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user)) where status = 'pending';
create index if not exists friend_requests_to_idx on public.friend_requests (to_user, status);
create index if not exists friend_requests_from_idx on public.friend_requests (from_user, created_at desc);
alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon, authenticated;

-- ---------- Helpers ----------

-- How two people relate: 'self', 'friend', 'requested' (I asked them), 'incoming' (they asked me) or 'none'.
create or replace function private.relation(p_me uuid, p_other uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_me = p_other then 'self'
    when private.are_friends(p_me, p_other) then 'friend'
    when exists (select 1 from public.friend_requests requests where requests.status = 'pending' and requests.from_user = p_me and requests.to_user = p_other) then 'requested'
    when exists (select 1 from public.friend_requests requests where requests.status = 'pending' and requests.from_user = p_other and requests.to_user = p_me) then 'incoming'
    else 'none' end;
$$;

create or replace function private.mutual_friends(p_a uuid, p_b uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.friendships mine join public.friendships theirs on theirs.friend_id = mine.friend_id
  where mine.user_id = p_a and theirs.user_id = p_b;
$$;

-- A person as search and suggestions show them: never workouts, only the public face.
create or replace function private.person_json(p_me uuid, p_other uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', profiles.id, 'name', coalesce(profiles.display_name, 'Someone'), 'avatar', coalesce(profiles.avatar, ''),
    'username', profiles.username, 'relation', private.relation(p_me, profiles.id), 'mutual', private.mutual_friends(p_me, profiles.id))
  from public.profiles profiles where profiles.id = p_other;
$$;

revoke all on function private.is_adult(smallint), private.enforce_findable(), private.relation(uuid, uuid), private.mutual_friends(uuid, uuid), private.person_json(uuid, uuid) from public;

-- ---------- Your public profile ----------

-- Saves your @username, bio and "Let people find me". Returns what was saved (findable may be forced off).
create or replace function public.set_public_profile(p_username text, p_bio text, p_findable boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_username text := nullif(lower(btrim(coalesce(p_username, ''))), '');
  v_bio text := btrim(coalesce(p_bio, ''));
  v_row public.profiles%rowtype;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if v_username is not null and v_username !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'Usernames are 3–20 letters, numbers, dots or underscores.' using errcode = '22023';
  end if;
  if v_username is not null and exists (select 1 from public.profiles profiles where profiles.username = v_username and profiles.id <> v_user) then
    raise exception 'That username is taken. Try another one.' using errcode = '22023';
  end if;
  if char_length(v_bio) > 160 then raise exception 'Keep your bio under 160 characters.' using errcode = '22023'; end if;
  update public.profiles profiles set username = v_username, bio = v_bio, findable = coalesce(p_findable, false), updated_at = now()
    where profiles.id = v_user returning * into v_row;
  if not found then raise exception 'Finish setting up your profile first.' using errcode = '22023'; end if;
  return jsonb_build_object('username', v_row.username, 'bio', v_row.bio, 'findable', v_row.findable, 'adult', private.is_adult(v_row.birth_year));
end;
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(btrim(coalesce(p_username, ''))) ~ '^[a-z0-9_.]{3,20}$'
    and not exists (select 1 from public.profiles profiles where profiles.username = lower(btrim(p_username)) and profiles.id <> (select auth.uid()));
$$;

-- ---------- Finding people ----------

-- Findable people whose name or @username matches (2+ characters), up to 20. Never you, never blocked people.
create or replace function public.search_people(p_query text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_handle text := ltrim(lower(btrim(coalesce(p_query, ''))), '@');
begin
  if v_user is null or char_length(v_query) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(private.person_json(v_user, found.id) order by found.rank, found.name)
    from (
      select profiles.id, coalesce(profiles.display_name, '') as name,
        case when profiles.username = v_handle then 0 when profiles.username like v_handle || '%' then 1
          when lower(profiles.display_name) like v_query || '%' then 2 else 3 end as rank
      from public.profiles profiles
      where profiles.id <> v_user and profiles.findable and private.is_adult(profiles.birth_year)
        and not private.is_blocked(v_user, profiles.id)
        and (profiles.username like v_handle || '%' or lower(profiles.display_name) like '%' || v_query || '%')
      order by rank, name
      limit 20
    ) found
  ), '[]'::jsonb);
end;
$$;

-- "People you may know": findable friends of your friends you aren't connected to yet, most mutual friends first.
create or replace function public.suggested_people()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(private.person_json(v_user, candidates.id) order by candidates.mutual desc, candidates.name)
    from (
      select theirs.friend_id as id, count(*) as mutual, min(profiles.display_name) as name
      from public.friendships mine
      join public.friendships theirs on theirs.user_id = mine.friend_id
      join public.profiles profiles on profiles.id = theirs.friend_id
      where mine.user_id = v_user and theirs.friend_id <> v_user
        and profiles.findable and private.is_adult(profiles.birth_year)
        and not private.are_friends(v_user, theirs.friend_id) and not private.is_blocked(v_user, theirs.friend_id)
        and not exists (select 1 from public.friend_requests requests where requests.status = 'pending'
          and ((requests.from_user = v_user and requests.to_user = theirs.friend_id) or (requests.from_user = theirs.friend_id and requests.to_user = v_user)))
      group by theirs.friend_id
      order by count(*) desc
      limit 10
    ) candidates
  ), '[]'::jsonb);
end;
$$;

-- ---------- Friend requests ----------

-- Ask someone to be friends. They must be findable (or a friend of a friend). If they already asked you, you
-- become friends straight away. Returns 'requested', 'friends' or 'already-friends'.
create or replace function public.send_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_incoming uuid;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_user is null or p_user = v_user then raise exception 'Choose someone else.' using errcode = '22023'; end if;
  if private.are_friends(v_user, p_user) then return 'already-friends'; end if;
  if private.is_blocked(v_user, p_user) then raise exception 'You can''t send this request.' using errcode = '42501'; end if;
  select requests.id into v_incoming from public.friend_requests requests where requests.status = 'pending' and requests.from_user = p_user and requests.to_user = v_user;
  if v_incoming is not null then
    update public.friend_requests requests set status = 'accepted', decided_at = now() where requests.id = v_incoming;
    insert into public.friendships (user_id, friend_id) values (v_user, p_user), (p_user, v_user) on conflict do nothing;
    return 'friends';
  end if;
  if not exists (select 1 from public.profiles profiles where profiles.id = p_user and profiles.findable and private.is_adult(profiles.birth_year))
    and private.mutual_friends(v_user, p_user) = 0 then
    raise exception 'This person can''t be found right now.' using errcode = '42501';
  end if;
  if exists (select 1 from public.friend_requests requests where requests.status = 'pending' and requests.from_user = v_user and requests.to_user = p_user) then return 'requested'; end if;
  if (select count(*) from public.friend_requests requests where requests.from_user = v_user and requests.created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of requests today — try again tomorrow.' using errcode = '22023';
  end if;
  -- Someone who declined you can't be asked again for a week.
  if exists (select 1 from public.friend_requests requests where requests.from_user = v_user and requests.to_user = p_user and requests.status = 'declined' and requests.decided_at > now() - interval '7 days') then
    raise exception 'They can''t be asked again just yet.' using errcode = '22023';
  end if;
  insert into public.friend_requests (from_user, to_user) values (v_user, p_user);
  return 'requested';
end;
$$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_from uuid;
begin
  update public.friend_requests requests set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
    where requests.id = p_request and requests.to_user = v_user and requests.status = 'pending' returning requests.from_user into v_from;
  if not found then raise exception 'This request is no longer open.' using errcode = '22023'; end if;
  if p_accept then insert into public.friendships (user_id, friend_id) values (v_user, v_from), (v_from, v_user) on conflict do nothing; end if;
  return p_accept;
end;
$$;

create or replace function public.cancel_friend_request(p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_requests requests set status = 'cancelled', decided_at = now()
    where requests.from_user = (select auth.uid()) and requests.to_user = p_user and requests.status = 'pending';
  return found;
end;
$$;

-- Requests waiting for you, and the ones you sent.
create or replace function public.friend_requests_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then return jsonb_build_object('incoming', '[]'::jsonb, 'outgoing', '[]'::jsonb); end if;
  return jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(private.person_json(v_user, requests.from_user) || jsonb_build_object('request_id', requests.id, 'at', requests.created_at) order by requests.created_at desc)
      from public.friend_requests requests where requests.to_user = v_user and requests.status = 'pending' and not private.is_blocked(v_user, requests.from_user)), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(private.person_json(v_user, requests.to_user) || jsonb_build_object('request_id', requests.id, 'at', requests.created_at) order by requests.created_at desc)
      from public.friend_requests requests where requests.from_user = v_user and requests.status = 'pending'), '[]'::jsonb)
  );
end;
$$;

-- ---------- Profile page ----------

-- Someone's profile. Visible when they're you, a friend, connected by a request either way, a Train together buddy,
-- or findable. Friends (and you) also get stats and posts. Null when you can't see them (or a block exists).
create or replace function public.person_profile(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_relation text;
  v_close boolean;
  v_base jsonb;
begin
  if v_user is null then return null; end if;
  select * into v_profile from public.profiles profiles where profiles.id = p_user;
  if not found or private.is_blocked(v_user, p_user) then return null; end if;
  v_relation := private.relation(v_user, p_user);
  v_close := v_relation in ('self', 'friend') or private.same_buddy_group(v_user, p_user);
  if not v_close and v_relation = 'none' and not (v_profile.findable and private.is_adult(v_profile.birth_year)) then return null; end if;
  v_base := jsonb_build_object('id', v_profile.id, 'name', coalesce(v_profile.display_name, 'Someone'), 'avatar', coalesce(v_profile.avatar, ''),
    'username', v_profile.username, 'bio', v_profile.bio, 'relation', v_relation, 'mutual', private.mutual_friends(v_user, p_user),
    'friends', (select count(*) from public.friendships friends where friends.user_id = p_user));
  if not v_close then return v_base; end if;
  return v_base || jsonb_build_object(
    'stats', (select jsonb_build_object('streak', stats.current_streak, 'best', stats.best_streak, 'week', stats.week_count, 'week_goal', stats.week_goal,
        'month', (select count(*) from unnest(stats.recent_dates) as days(day) where day >= date_trunc('month', current_date)::date), 'goal', stats.goal)
      from public.friend_stats stats where stats.user_id = p_user),
    'post_count', (select count(*) from public.posts posts where posts.author_id = p_user and posts.deleted_at is null),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', posts.id, 'title', posts.card ->> 'title', 'photo', posts.photo_path, 'date', posts.session_date,
        'likes', (select count(*) from public.post_likes likes where likes.post_id = posts.id)) order by posts.created_at desc)
      from (select * from public.posts posts where posts.author_id = p_user and posts.deleted_at is null and private.can_see_posts(posts.author_id, v_user)
        order by posts.created_at desc limit 30) posts), '[]'::jsonb)
  );
end;
$$;

-- ---------- Access ----------

revoke all on function public.set_public_profile(text, text, boolean), public.username_available(text), public.search_people(text), public.suggested_people(),
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.cancel_friend_request(uuid), public.friend_requests_overview(),
  public.person_profile(uuid) from public, anon;
grant execute on function public.set_public_profile(text, text, boolean), public.username_available(text), public.search_people(text), public.suggested_people(),
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.cancel_friend_request(uuid), public.friend_requests_overview(),
  public.person_profile(uuid) to authenticated;
