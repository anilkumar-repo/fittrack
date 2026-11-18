import type { SupabaseClient } from "@supabase/supabase-js";
import { readWorkoutCard, type WorkoutCard } from "./chats";

type Row = Record<string, unknown>;
const NOT_READY = "The feed needs the latest database update. Please try again after it's installed.";
const BUCKET = "post-photos";

function fail(error: { code?: string; message: string }): never {
  const missing = error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST205" || error.code === "42P01";
  throw new Error(missing ? NOT_READY : error.message);
}

export interface FeedComment { id: string; authorId: string; author: string; avatar?: string; body: string; at: string }
export interface FeedPost {
  id: string;
  authorId: string;
  author: string;
  avatar?: string;
  date: string;
  card: WorkoutCard | null;
  caption: string;
  /** Storage path of the photo (load it with `photoLinks`). */
  photo: string | null;
  at: string;
  likes: number;
  liked: boolean;
  commentCount: number;
  comments: FeedComment[];
}

const comment = (row: Row): FeedComment => ({
  id: String(row.id), authorId: String(row.author_id), author: String(row.author ?? "Friend"), body: String(row.body ?? ""), at: String(row.at ?? row.created_at ?? ""),
  ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}),
});

export function toPost(row: Row): FeedPost {
  return {
    id: String(row.id), authorId: String(row.author_id), author: String(row.author ?? "Friend"), date: String(row.date ?? ""),
    ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}),
    card: readWorkoutCard(row.card), caption: String(row.caption ?? ""), photo: typeof row.photo === "string" && row.photo ? row.photo : null,
    at: String(row.at ?? ""), likes: Number(row.likes ?? 0), liked: row.liked === true, commentCount: Number(row.comment_count ?? 0),
    comments: Array.isArray(row.comments) ? (row.comments as Row[]).map(comment) : [],
  };
}

/** Your feed, newest first (null before the database update). Pass the last post's time for the next page. */
export async function loadFeed(client: SupabaseClient, before?: string): Promise<FeedPost[] | null> {
  const { data, error } = await client.rpc("feed", before ? { p_before: before, p_limit: 20 } : { p_limit: 20 });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    fail(error);
  }
  return ((data ?? []) as Row[]).map(toPost);
}

/** One post with all its comments (null if it's gone or you can't see it). */
export async function loadPost(client: SupabaseClient, postId: string): Promise<FeedPost | null> {
  const { data, error } = await client.rpc("post_detail", { p_post: postId });
  if (error) fail(error);
  return data ? toPost(data as Row) : null;
}

/** Short-lived private links for post photos (only works for photos you're allowed to see). */
export async function photoLinks(client: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(unique, 60 * 60);
  if (error || !data) return new Map();
  return new Map(data.filter((item) => item.signedUrl && item.path).map((item) => [item.path as string, item.signedUrl]));
}

/**
 * Posts a finished workout: uploads the (already shrunk) photo into your own folder first, then creates the post.
 * If the post can't be made, the uploaded photo is removed again.
 */
export async function createPost(client: SupabaseClient, userId: string, input: { date: string; card: WorkoutCard; caption: string; photo?: Blob | null }): Promise<string> {
  let path: string | null = null;
  if (input.photo) {
    path = `${userId}/${crypto.randomUUID()}.${input.photo.type === "image/jpeg" ? "jpg" : "webp"}`;
    const { error } = await client.storage.from(BUCKET).upload(path, input.photo, { contentType: input.photo.type, cacheControl: "3600", upsert: false });
    if (error) throw new Error(error.message.includes("exceeded") ? "That photo is too large. Try another one." : `The photo didn’t upload: ${error.message}`);
  }
  const { data, error } = await client.rpc("create_post", { p_date: input.date, p_card: input.card, p_caption: input.caption, p_photo: path });
  if (error) {
    if (path) await client.storage.from(BUCKET).remove([path]);
    fail(error);
  }
  return String(data);
}

/** Deletes your post and its photo. */
export async function deletePost(client: SupabaseClient, postId: string): Promise<void> {
  const { data, error } = await client.rpc("delete_post", { p_post: postId });
  if (error) fail(error);
  if (typeof data === "string" && data) await client.storage.from(BUCKET).remove([data]);
}

/** Workout days you've already posted (empty before the database update). */
export async function loadPostedDates(client: SupabaseClient, since: string): Promise<Set<string>> {
  const { data, error } = await client.rpc("my_post_dates", { p_since: since });
  if (error) return new Set();
  return new Set(((data ?? []) as unknown[]).map((value) => String(typeof value === "object" && value ? Object.values(value)[0] : value)));
}

async function call<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) fail(error);
  return data as T;
}

/** Like or unlike; returns the new like count. Tells the author about a new like (best effort). */
export async function setPostLike(client: SupabaseClient, postId: string, on: boolean): Promise<number> {
  const count = Number(await call<number>(client, "set_post_like", { p_post: postId, p_on: on }));
  if (on) void notifyFeed(client, "like", postId);
  return count;
}

export async function addComment(client: SupabaseClient, postId: string, body: string): Promise<FeedComment> {
  const row = await call<Row>(client, "add_comment", { p_post: postId, p_body: body });
  void notifyFeed(client, "comment", postId);
  return comment(row);
}

export const deleteComment = (client: SupabaseClient, commentId: string) => call<boolean>(client, "delete_comment", { p_comment: commentId });
export type PostReportReason = "harassment" | "inappropriate" | "spam" | "unsafe" | "other";
export const reportPost = (client: SupabaseClient, postId: string, commentId: string | null, reason: PostReportReason, note: string) =>
  call<boolean>(client, "report_post", { p_post: postId, p_comment: commentId, p_reason: reason, p_note: note });

async function notifyFeed(client: SupabaseClient, kind: "like" | "comment", postId: string): Promise<void> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/push/feed", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ kind, postId }) }).catch(() => undefined);
}
