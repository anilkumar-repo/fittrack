import { adminClient, sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/**
 * Pushes a trainer's broadcast to every active client's phone, right after it's sent. The caller must be signed in
 * and must be the trainer who wrote it; each broadcast is pushed once, within ten minutes. Phones that turned off
 * "Nudges from friends" don't get it (it still shows on their Home).
 */
export async function POST(request: Request) {
  const db = adminClient();
  if (!db) return Response.json({ pushed: false, reason: "not-configured" });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return Response.json({ error: "Sign in first" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { broadcastId?: unknown };
  const id = typeof body.broadcastId === "string" && /^[0-9a-f-]{36}$/i.test(body.broadcastId) ? body.broadcastId : null;
  if (!id) return Response.json({ error: "Missing message" }, { status: 400 });

  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: broadcast } = await db.from("trainer_broadcasts").select("id, trainer_id, body")
    .eq("id", id).eq("trainer_id", auth.user.id).is("pushed_at", null).gte("created_at", tenMinutesAgo).maybeSingle();
  if (!broadcast) return Response.json({ pushed: false, reason: "not-found" });
  await db.from("trainer_broadcasts").update({ pushed_at: new Date().toISOString() }).eq("id", broadcast.id);

  const [{ data: trainer }, { data: links }] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    db.from("trainer_clients").select("client_id").eq("trainer_id", auth.user.id).eq("status", "active"),
  ]);
  const clientIds = (links ?? []).map((row) => String(row.client_id));
  if (!clientIds.length) return Response.json({ pushed: false, reason: "no-clients" });
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", clientIds).eq("nudges", true);

  const text = String(broadcast.body);
  const message = { kind: "trainer" as const, title: `💬 ${String(trainer?.display_name ?? "Your trainer")}`, body: text.length > 140 ? `${text.slice(0, 137)}…` : text, url: "/#trainer-messages" };
  let pushed = 0;
  for (const sub of subs ?? []) {
    const result = await sendPush(sub, message);
    if (result === "sent") pushed++;
    if (result === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return Response.json({ pushed });
}
