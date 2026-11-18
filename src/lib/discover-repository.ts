import type { SupabaseClient } from "@supabase/supabase-js";
import type { Relation } from "./discover";

type Row = Record<string, unknown>;
const NOT_READY = "Finding friends needs the latest database update. Please try again after it's installed.";

function fail(error: { code?: string; message: string }): never {
  const missing = error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST205" || error.code === "42P01";
  throw new Error(missing ? NOT_READY : error.message);
}

const RELATIONS = new Set(["self", "friend", "requested", "incoming", "none"]);
export interface Person { id: string; name: string; avatar?: string; username?: string; relation: Relation; mutual: number; requestId?: string }

export function toPerson(row: Row): Person {
  return {
    id: String(row.id), name: String(row.name ?? "Someone"), relation: (RELATIONS.has(String(row.relation)) ? row.relation : "none") as Relation, mutual: Number(row.mutual ?? 0),
    ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}),
    ...(typeof row.username === "string" && row.username ? { username: row.username } : {}),
    ...(typeof row.request_id === "string" ? { requestId: row.request_id } : {}),
  };
}

async function call<T>(client: SupabaseClient, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) fail(error);
  return data as T;
}

export interface PublicProfile { username: string | null; bio: string; findable: boolean; adult: boolean }

/** Saves your @username, bio and "Let people find me" (the database turns findable off for under-18s). */
export async function setPublicProfile(client: SupabaseClient, input: { username: string; bio: string; findable: boolean }): Promise<PublicProfile> {
  const row = await call<Row>(client, "set_public_profile", { p_username: input.username, p_bio: input.bio, p_findable: input.findable });
  return { username: typeof row.username === "string" ? row.username : null, bio: String(row.bio ?? ""), findable: row.findable === true, adult: row.adult === true };
}

export const usernameAvailable = (client: SupabaseClient, username: string) => call<boolean>(client, "username_available", { p_username: username });

export async function searchPeople(client: SupabaseClient, query: string): Promise<Person[]> {
  return ((await call<Row[]>(client, "search_people", { p_query: query })) ?? []).map(toPerson);
}

/** People you may know (null before the database update). */
export async function suggestedPeople(client: SupabaseClient): Promise<Person[] | null> {
  const { data, error } = await client.rpc("suggested_people");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    fail(error);
  }
  return ((data ?? []) as Row[]).map(toPerson);
}

/** Sends a friend request (or, if they already asked you, makes you friends). Notifies them (best effort). */
export async function sendFriendRequest(client: SupabaseClient, userId: string): Promise<"requested" | "friends" | "already-friends"> {
  const result = await call<string>(client, "send_friend_request", { p_user: userId });
  if (result === "requested") void notifyRequest(client, userId);
  return result === "friends" || result === "already-friends" ? result : "requested";
}
export const respondFriendRequest = (client: SupabaseClient, requestId: string, accept: boolean) => call<boolean>(client, "respond_friend_request", { p_request: requestId, p_accept: accept });
export const cancelFriendRequest = (client: SupabaseClient, userId: string) => call<boolean>(client, "cancel_friend_request", { p_user: userId });

export interface FriendRequests { incoming: Person[]; outgoing: Person[] }
/** Requests waiting for you and the ones you sent (empty before the database update). */
export async function loadFriendRequests(client: SupabaseClient): Promise<FriendRequests> {
  const { data, error } = await client.rpc("friend_requests_overview");
  if (error) return { incoming: [], outgoing: [] };
  const value = (data ?? {}) as Row;
  return { incoming: ((value.incoming ?? []) as Row[]).map(toPerson), outgoing: ((value.outgoing ?? []) as Row[]).map(toPerson) };
}

export interface ProfilePost { id: string; title: string; photo: string | null; date: string; likes: number }
export interface PersonProfile extends Person {
  bio: string;
  friends: number;
  /** Only for friends (and you). */
  stats?: { streak: number; best: number; week: number; weekGoal: number; month: number };
  postCount?: number;
  posts?: ProfilePost[];
}

/** Someone's profile (null when you can't see them). */
export async function loadPersonProfile(client: SupabaseClient, userId: string): Promise<PersonProfile | null> {
  const row = await call<Row | null>(client, "person_profile", { p_user: userId });
  if (!row) return null;
  const stats = row.stats as Row | null | undefined;
  return {
    ...toPerson(row), bio: String(row.bio ?? ""), friends: Number(row.friends ?? 0),
    ...(stats ? { stats: { streak: Number(stats.streak ?? 0), best: Number(stats.best ?? 0), week: Number(stats.week ?? 0), weekGoal: Number(stats.week_goal ?? 3), month: Number(stats.month ?? 0) } } : {}),
    ...(typeof row.post_count === "number" ? { postCount: row.post_count } : {}),
    ...(Array.isArray(row.posts) ? { posts: (row.posts as Row[]).map((post) => ({ id: String(post.id), title: String(post.title ?? "Workout"), photo: typeof post.photo === "string" && post.photo ? post.photo : null, date: String(post.date ?? ""), likes: Number(post.likes ?? 0) })) } : {}),
  };
}

async function notifyRequest(client: SupabaseClient, userId: string): Promise<void> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/push/friend-request", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ to: userId }) }).catch(() => undefined);
}
