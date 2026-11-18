-- Phase 7 step B — Feed.
--   * A post = one finished workout: its workout card, a caption, and optionally one photo. People choose to post
--     (the app asks after each workout); nothing is shared automatically. One post per person per workout day.
--   * Who sees it: the author, their friends, and their Train together group — never strangers. Blocks (the same
--     ones chats use) hide posts and comments both ways.
--   * 💪 likes and short comments. The author can delete any comment on their post; anyone can delete their own.
--     Posts and comments can be reported (a copy of the text is kept).
--   * Photos live in a private bucket, "post-photos/<user id>/<file>". Only people who can see the post can load
--     the photo (signed links). Each person uploads only into their own folder. 1.5 MB max, WebP or JPEG.
--   Everything is read and changed through the functions below; the tables themselves are closed.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  session_date date not null,
  card jsonb not null check (jsonb_typeof(card) = 'object' and pg_column_size(card) <= 8192),
  caption text not null default '' check (char_length(caption) <= 1000),
  photo_path text check (photo_path is null or char_length(photo_path) <= 200),
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create unique index if not exists posts_one_per_day_idx on public.posts (author_id, session_date) where deleted_at is null;
create index if not exists posts_author_time_idx on public.posts (author_id, created_at desc);
create index if not exists posts_photo_idx on public.posts (photo_path) where photo_path is not null;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_author_idx on public.post_comments (author_id, created_at desc);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  comment_id uuid references public.post_comments (id) on delete set null,
  reported_user uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('harassment', 'inappropriate', 'spam', 'unsafe', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  snapshot text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists post_reports_once_idx on public.post_reports (reporter, coalesce(comment_id, post_id));
comment on table public.post_reports is 'Reported posts and comments, with a copy of the text (and the photo path) at the time. Reviewed by the owner.';

create table if not exists public.post_push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  kind text not null check (kind in ('like', 'comment')),
  sent_at timestamptz not null default now(),
  primary key (user_id, post_id, kind)
);
comment on table public.post_push_log is 'Server only: when the author last got a like / comment notification for a post (one every few minutes at most).';

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reports enable row level security;
alter table public.post_push_log enable row level security;
revoke all on public.posts, public.post_likes, public.post_comments, public.post_reports, public.post_push_log from anon, authenticated;

-- ---------- Helpers ----------

create or replace function private.same_buddy_group(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.buddy_members mine join public.buddy_members theirs on theirs.group_id = mine.group_id and theirs.status = 'active'
    where mine.user_id = p_a and mine.status = 'active' and theirs.user_id = p_b
  );
$$;

-- May this viewer see this author's posts? Themselves, or friends / Train together buddies with no block either way.
create or replace function private.can_see_posts(p_author uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_author is not null and p_viewer is not null and (
    p_author = p_viewer
    or ((private.are_friends(p_viewer, p_author) or private.same_buddy_group(p_viewer, p_author)) and not private.is_blocked(p_viewer, p_author))
  );
$$;

-- May the signed-in person load this photo? Their own uploads, or the photo of a post they can see.
create or replace function private.can_see_post_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts posts
    where posts.photo_path = p_name and posts.deleted_at is null and private.can_see_posts(posts.author_id, (select auth.uid()))
  );
$$;

-- A workout card as the app makes it (title, up to 12 exercises, small).
create or replace function private.valid_workout_card(p_card jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if coalesce(jsonb_typeof(p_card), '') <> 'object' or coalesce(jsonb_typeof(p_card -> 'exercises'), '') <> 'array' then return false; end if;
  return coalesce(char_length(p_card ->> 'title'), 0) between 1 and 80 and jsonb_array_length(p_card -> 'exercises') between 1 and 12 and pg_column_size(p_card) <= 8192;
end;
$$;

revoke all on function private.same_buddy_group(uuid, uuid), private.can_see_posts(uuid, uuid), private.can_see_post_photo(text), private.valid_workout_card(jsonb) from public;
grant execute on function private.can_see_post_photo(text) to authenticated;

-- ---------- Photo storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 1572864, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Post photos: upload own" on storage.objects;
create policy "Post photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Post photos: read own or visible" on storage.objects;
create policy "Post photos: read own or visible" on storage.objects for select to authenticated
  using (bucket_id = 'post-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.can_see_post_photo(name)));
drop policy if exists "Post photos: delete own" on storage.objects;
create policy "Post photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Posting ----------

create or replace function public.create_post(p_date date, p_card jsonb, p_caption text default '', p_photo text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_caption text := btrim(coalesce(p_caption, ''));
  v_photo text := nullif(btrim(coalesce(p_photo, '')), '');
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to post.' using errcode = '42501'; end if;
  if p_date is null or p_date > current_date + 1 or p_date < current_date - 7 then raise exception 'You can post workouts from the last week.' using errcode = '22023'; end if;
  if not private.valid_workout_card(p_card) then raise exception 'That workout can''t be posted.' using errcode = '22023'; end if;
  if char_length(v_caption) > 1000 then raise exception 'Keep the caption under 1,000 characters.' using errcode = '22023'; end if;
  if v_photo is not null and (split_part(v_photo, '/', 1) <> v_user::text or not exists (
    select 1 from storage.objects objects where objects.bucket_id = 'post-photos' and objects.name = v_photo)) then
    raise exception 'That photo wasn''t uploaded. Please try again.' using errcode = '22023';
  end if;
  if (select count(*) from public.posts posts where posts.author_id = v_user and posts.created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s a lot of posts today — try again tomorrow.' using errcode = '22023';
  end if;
  if exists (select 1 from public.posts posts where posts.author_id = v_user and posts.session_date = p_date and posts.deleted_at is null) then
    raise exception 'You already posted this workout.' using errcode = '22023';
  end if;
  insert into public.posts (author_id, session_date, card, caption, photo_path) values (v_user, p_date, p_card, v_caption, v_photo) returning id into v_id;
  return v_id;
end;
$$;

-- Delete your post. Returns its photo path (the app then removes the file).
create or replace function public.delete_post(p_post uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_photo text;
begin
  update public.posts posts set deleted_at = now() where posts.id = p_post and posts.author_id = (select auth.uid()) and posts.deleted_at is null
    returning posts.photo_path into v_photo;
  if not found then raise exception 'That post isn''t yours.' using errcode = '42501'; end if;
  return v_photo;
end;
$$;

-- ---------- Likes and comments ----------

create or replace function public.set_post_like(p_post uuid, p_on boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_author uuid := (select posts.author_id from public.posts posts where posts.id = p_post and posts.deleted_at is null);
begin
  if v_user is null or not coalesce(private.can_see_posts(v_author, v_user), false) then raise exception 'You can''t see this post.' using errcode = '42501'; end if;
  if p_on then insert into public.post_likes (post_id, user_id) values (p_post, v_user) on conflict do nothing;
  else delete from public.post_likes likes where likes.post_id = p_post and likes.user_id = v_user; end if;
  return (select count(*) from public.post_likes likes where likes.post_id = p_post);
end;
$$;

create or replace function public.add_comment(p_post uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_author uuid := (select posts.author_id from public.posts posts where posts.id = p_post and posts.deleted_at is null);
  v_body text := btrim(coalesce(p_body, ''));
  v_row public.post_comments%rowtype;
begin
  if v_user is null or not coalesce(private.can_see_posts(v_author, v_user), false) then raise exception 'You can''t see this post.' using errcode = '42501'; end if;
  if v_body = '' then raise exception 'Write a comment first.' using errcode = '22023'; end if;
  if char_length(v_body) > 500 then raise exception 'Keep comments under 500 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.post_comments comments where comments.author_id = v_user and comments.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Slow down a little — try again in a minute.' using errcode = '22023';
  end if;
  insert into public.post_comments (post_id, author_id, body) values (p_post, v_user, v_body) returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'post_id', v_row.post_id, 'author_id', v_row.author_id, 'body', v_row.body, 'created_at', v_row.created_at);
end;
$$;

-- Delete a comment: your own, or any comment on your post.
create or replace function public.delete_comment(p_comment uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.post_comments comments set deleted_at = now(), body = '[deleted]'
    from public.posts posts
    where comments.id = p_comment and comments.deleted_at is null and posts.id = comments.post_id
      and (comments.author_id = (select auth.uid()) or posts.author_id = (select auth.uid()));
  return found;
end;
$$;

create or replace function public.report_post(p_post uuid, p_comment uuid, p_reason text, p_note text default '')
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_post public.posts%rowtype;
  v_comment public.post_comments%rowtype;
begin
  if v_user is null then raise exception 'Sign in to report.' using errcode = '42501'; end if;
  select * into v_post from public.posts posts where posts.id = p_post;
  if not found or not private.can_see_posts(v_post.author_id, v_user) then raise exception 'You can only report what you can see.' using errcode = '42501'; end if;
  if p_reason not in ('harassment', 'inappropriate', 'spam', 'unsafe', 'other') then raise exception 'Choose a reason.' using errcode = '22023'; end if;
  if p_comment is not null then
    select * into v_comment from public.post_comments comments where comments.id = p_comment and comments.post_id = p_post;
    if not found then raise exception 'That comment isn''t on this post.' using errcode = '22023'; end if;
    if v_comment.author_id = v_user then raise exception 'That''s your own comment.' using errcode = '22023'; end if;
  elsif v_post.author_id = v_user then
    raise exception 'That''s your own post.' using errcode = '22023';
  end if;
  insert into public.post_reports (reporter, post_id, comment_id, reported_user, reason, note, snapshot)
  values (v_user, p_post, p_comment, coalesce(v_comment.author_id, v_post.author_id), p_reason, left(btrim(coalesce(p_note, '')), 500),
    case when p_comment is not null then v_comment.body else coalesce(v_post.card ->> 'title', '') || ' — ' || v_post.caption || coalesce(' [photo ' || v_post.photo_path || ']', '') end)
  on conflict do nothing;
  return true;
end;
$$;

-- ---------- Reading ----------

-- One post as the app shows it (likes, whether you liked, comment count, and the latest comments).
create or replace function private.post_json(p_post public.posts, p_viewer uuid, p_comments integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p_post.id, 'author_id', p_post.author_id, 'author', coalesce(profiles.display_name, 'Friend'), 'avatar', coalesce(profiles.avatar, ''),
    'date', p_post.session_date, 'card', p_post.card, 'caption', p_post.caption, 'photo', p_post.photo_path, 'at', p_post.created_at,
    'likes', (select count(*) from public.post_likes likes where likes.post_id = p_post.id and not private.is_blocked(likes.user_id, p_viewer)),
    'liked', exists (select 1 from public.post_likes likes where likes.post_id = p_post.id and likes.user_id = p_viewer),
    'comment_count', (select count(*) from public.post_comments comments where comments.post_id = p_post.id and comments.deleted_at is null and not private.is_blocked(comments.author_id, p_viewer)),
    'comments', coalesce((select jsonb_agg(item order by item ->> 'at') from (
      select jsonb_build_object('id', comments.id, 'author_id', comments.author_id, 'author', coalesce(who.display_name, 'Friend'), 'avatar', coalesce(who.avatar, ''),
        'body', comments.body, 'at', comments.created_at) as item
      from public.post_comments comments left join public.profiles who on who.id = comments.author_id
      where comments.post_id = p_post.id and comments.deleted_at is null and not private.is_blocked(comments.author_id, p_viewer)
      order by comments.created_at desc limit p_comments) latest), '[]'::jsonb)
  )
  from public.profiles profiles where profiles.id = p_post.author_id;
$$;
revoke all on function private.post_json(public.posts, uuid, integer) from public;

-- Your feed: your posts and your friends' / buddies', newest first, 20 at a time (`p_before` for the next page).
create or replace function public.feed(p_before timestamptz default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(private.post_json(full_post, v_user, 2) order by full_post.created_at desc)
    from (
      select posts.id from public.posts posts
      where posts.deleted_at is null and (p_before is null or posts.created_at < p_before) and private.can_see_posts(posts.author_id, v_user)
      order by posts.created_at desc
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) listed
    join public.posts full_post on full_post.id = listed.id
  ), '[]'::jsonb);
end;
$$;

-- One post with all its comments (null if you can't see it).
create or replace function public.post_detail(p_post uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_post public.posts%rowtype;
begin
  select * into v_post from public.posts posts where posts.id = p_post and posts.deleted_at is null;
  if not found or not private.can_see_posts(v_post.author_id, v_user) then return null; end if;
  return private.post_json(v_post, v_user, 200);
end;
$$;

-- Workout days you've already posted (so the app shows "Posted" instead of asking again).
create or replace function public.my_post_dates(p_since date)
returns setof date language sql stable security definer set search_path = '' as $$
  select posts.session_date from public.posts posts
  where posts.author_id = (select auth.uid()) and posts.deleted_at is null and posts.session_date >= coalesce(p_since, current_date - 30);
$$;

-- ---------- Access ----------

revoke all on function public.create_post(date, jsonb, text, text), public.delete_post(uuid), public.set_post_like(uuid, boolean), public.add_comment(uuid, text),
  public.delete_comment(uuid), public.report_post(uuid, uuid, text, text), public.feed(timestamptz, integer), public.post_detail(uuid), public.my_post_dates(date) from public, anon;
grant execute on function public.create_post(date, jsonb, text, text), public.delete_post(uuid), public.set_post_like(uuid, boolean), public.add_comment(uuid, text),
  public.delete_comment(uuid), public.report_post(uuid, uuid, text, text), public.feed(timestamptz, integer), public.post_detail(uuid), public.my_post_dates(date) to authenticated;
