import { adminClient, sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** At most one like / comment notification per post this often. */
const QUIET_MS = 10 * 60_000;

/**
 * Tells a post's author about a new 💪 or comment. The caller must be signed in and must really have liked /
 * commented on that post in the last two minutes. Not sent for your own post, if the author blocked you, or if the
 * author turned off "Nudges & messages from friends"; at most one per post (and kind) every 10 minutes.
 */
export async function POST(request: Request) {
  const db = adminClient();
  if (!db) return Response.json({ pushed: false, reason: "not-configured" });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return Response.json({ error: "Sign in first" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { kind?: unknown; postId?: unknown };
  const kind = body.kind === "like" || body.kind === "comment" ? body.kind : null;
  const postId = typeof body.postId === "string" && /^[0-9a-f-]{36}$/i.test(body.postId) ? body.postId : null;
  if (!kind || !postId) return Response.json({ error: "Unknown request" }, { status: 400 });

  const { data: post } = await db.from("posts").select("id, author_id, card, deleted_at").eq("id", postId).maybeSingle();
  if (!post || post.deleted_at || String(post.author_id) === auth.user.id) return Response.json({ pushed: false, reason: "no-one-to-tell" });
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: proof } = kind === "like"
    ? await db.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", auth.user.id).gte("created_at", since).limit(1)
    : await db.from("post_comments").select("body").eq("post_id", postId).eq("author_id", auth.user.id).is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
  if (!proof?.length) return Response.json({ pushed: false, reason: "not-yours" });

  const authorId = String(post.author_id);
  const [{ data: blocked }, { data: logged }, { data: me }] = await Promise.all([
    db.from("chat_blocks").select("blocker").or(`and(blocker.eq.${authorId},blocked.eq.${auth.user.id}),and(blocker.eq.${auth.user.id},blocked.eq.${authorId})`).limit(1),
    db.from("post_push_log").select("sent_at").eq("user_id", authorId).eq("post_id", postId).eq("kind", kind).maybeSingle(),
    db.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (blocked?.length) return Response.json({ pushed: false, reason: "blocked" });
  if (logged && Date.now() - Date.parse(String(logged.sent_at)) < QUIET_MS) return Response.json({ pushed: false, reason: "quiet" });
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", authorId).eq("nudges", true);
  if (!subs?.length) return Response.json({ pushed: 0 });
  await db.from("post_push_log").upsert({ user_id: authorId, post_id: postId, kind, sent_at: new Date().toISOString() });

  const name = String(me?.display_name || "A friend").split(" ")[0];
  const title = String((post.card as Record<string, unknown> | null)?.title ?? "your workout");
  const text = kind === "like" ? `${name} sent 💪 on ${title}` : `${name}: ${String((proof[0] as Record<string, unknown>).body ?? "").replace(/\s+/g, " ").slice(0, 120)}`;
  const message = { kind: "chat" as const, title: kind === "like" ? "New 💪 on your workout" : "New comment on your workout", body: text, url: `/feed?post=${postId}`, tag: `post-${postId}-${kind}` };
  let pushed = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, message);
    if (result === "sent") pushed++;
    if (result === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return Response.json({ pushed });
}
