-- Rozi agent (R10, 2026-11-24): memory the person controls.
--
--   * rozi_memories: short notes the person chose to save ("Left knee hurts on lunges"). Closed table (row-level
--     security on, no policies, no grants): every read and write goes through the owner-checked functions below.
--   * Only the person writes: Rozi can suggest a note on a card, but saving runs with the person's own sign-in.
--   * At most 30 notes, 3–200 characters, no duplicates (case-insensitive). Deleting really deletes.
--   * Deleted with the account (cascade).

create table if not exists public.rozi_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('injury', 'preference', 'schedule', 'other')),
  note text not null check (char_length(btrim(note)) between 3 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists rozi_memories_unique_note_idx on public.rozi_memories (user_id, lower(btrim(note)));
create index if not exists rozi_memories_user_time_idx on public.rozi_memories (user_id, created_at desc);

alter table public.rozi_memories enable row level security;
revoke all on public.rozi_memories from anon, authenticated;
comment on table public.rozi_memories is 'Notes the person asked Rozi to remember. Closed: use the rozi_*_memory functions.';

create or replace function private.rozi_memory_json(m public.rozi_memories)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'kind', m.kind, 'note', m.note, 'created_at', m.created_at, 'updated_at', m.updated_at);
$$;
revoke all on function private.rozi_memory_json(public.rozi_memories) from public;

-- The person's notes, newest first.
create or replace function public.rozi_my_memories()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.rozi_memory_json(m) order by m.created_at desc), '[]'::jsonb)
  from public.rozi_memories m where m.user_id = (select auth.uid());
$$;

-- Save a note (the person's own tap). A note they already have returns that one.
create or replace function public.rozi_save_memory(p_kind text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v public.rozi_memories;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rozi_memory:' || v_user::text, 0));
  select * into v from public.rozi_memories where user_id = v_user and lower(btrim(note)) = lower(btrim(p_note));
  if found then return private.rozi_memory_json(v); end if;
  if (select count(*) from public.rozi_memories where user_id = v_user) >= 30 then
    raise exception 'Rozi can remember up to 30 notes. Delete one first.' using errcode = '54000';
  end if;
  insert into public.rozi_memories (user_id, kind, note) values (v_user, p_kind, btrim(p_note)) returning * into v;
  return private.rozi_memory_json(v);
end;
$$;

-- Edit one of the person's notes.
create or replace function public.rozi_update_memory(p_memory uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v public.rozi_memories;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  update public.rozi_memories set note = btrim(p_note), updated_at = now() where id = p_memory and user_id = v_user returning * into v;
  if not found then raise exception 'That note isn''t yours or doesn''t exist.' using errcode = '42501'; end if;
  return private.rozi_memory_json(v);
end;
$$;

-- Delete one of the person's notes (really deleted).
create or replace function public.rozi_delete_memory(p_memory uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from public.rozi_memories where id = p_memory and user_id = v_user;
  if not found then raise exception 'That note isn''t yours or doesn''t exist.' using errcode = '42501'; end if;
  return true;
end;
$$;

revoke all on function public.rozi_my_memories(), public.rozi_save_memory(text, text), public.rozi_update_memory(uuid, text), public.rozi_delete_memory(uuid) from public, anon;
grant execute on function public.rozi_my_memories(), public.rozi_save_memory(text, text), public.rozi_update_memory(uuid, text), public.rozi_delete_memory(uuid) to authenticated;
