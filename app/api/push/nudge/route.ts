import { nudgeMessage } from "@/lib/notifications";
import { adminClient, sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/**
 * Pushes a nudge to the friend's phones right after it is sent. The caller must be signed in and must be
 * the sender; each nudge is pushed once, and only within ten minutes of being sent.
 */
export async function POST(request: Request) {
  const db = adminClient();
  if (!db) return Response.json({ pushed: false, reason: "not-configured" });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return Response.json({ error: "Sign in first" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { nudgeId?: unknown };
  const nudgeId = typeof body.nudgeId === "string" && /^[0-9a-f-]{36}$/i.test(body.nudgeId) ? body.nudgeId : null;
  if (!nudgeId) return Response.json({ error: "Missing nudge" }, { status: 400 });

  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: nudge } = await db.from("nudges").select("id, from_user, to_user, message")
    .eq("id", nudgeId).eq("from_user", auth.user.id).is("pushed_at", null).gte("created_at", tenMinutesAgo).maybeSingle();
  if (!nudge) return Response.json({ pushed: false, reason: "not-found" });

  await db.from("nudges").update({ pushed_at: new Date().toISOString() }).eq("id", nudge.id);
  const [{ data: sender }, { data: subs }] = await Promise.all([
    db.from("friend_stats").select("display_name").eq("user_id", auth.user.id).maybeSingle(),
    db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", nudge.to_user).eq("nudges", true),
  ]);
  const message = nudgeMessage(String(sender?.display_name ?? "A friend"), String(nudge.message ?? ""));
  let pushed = 0;
  for (const sub of subs ?? []) {
    const result = await sendPush(sub, message);
    if (result === "sent") pushed++;
    if (result === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return Response.json({ pushed: pushed > 0 });
}
