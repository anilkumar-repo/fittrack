import { adminClient, sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/**
 * Tells someone they have a new friend request. The caller must be signed in and have a pending request to that
 * person made in the last two minutes (so it can't be used to spam). Respects "Nudges & messages from friends".
 */
export async function POST(request: Request) {
  const db = adminClient();
  if (!db) return Response.json({ pushed: false, reason: "not-configured" });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return Response.json({ error: "Sign in first" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { to?: unknown };
  const to = typeof body.to === "string" && /^[0-9a-f-]{36}$/i.test(body.to) ? body.to : null;
  if (!to) return Response.json({ error: "Unknown request" }, { status: 400 });

  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: pending } = await db.from("friend_requests").select("id").eq("from_user", auth.user.id).eq("to_user", to).eq("status", "pending").gte("created_at", since).limit(1);
  if (!pending?.length) return Response.json({ pushed: false, reason: "no-request" });
  const [{ data: me }, { data: subs }] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", to).eq("nudges", true),
  ]);
  let pushed = 0;
  for (const sub of subs ?? []) {
    const result = await sendPush(sub, { kind: "nudge", title: "New friend request", body: `${String(me?.display_name || "Someone")} wants to be friends on RozFit.`, url: "/discover", tag: "friend-request" });
    if (result === "sent") pushed++;
    if (result === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return Response.json({ pushed });
}
