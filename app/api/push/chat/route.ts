import { adminClient, sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

/** Most one notification per chat per person this often (a burst of messages makes one buzz). */
const QUIET_MS = 3 * 60_000;
/** Someone who opened the chat this recently is reading it: no notification. */
const READING_MS = 45_000;

/**
 * A new chat message: notifies the other people in the chat. The caller must be signed in and be the sender of a
 * message sent in the last two minutes. Skipped for anyone who muted the chat, blocked the sender, has the chat
 * open right now, or turned off "Nudges & messages from friends"; at most one notification per chat every few minutes.
 */
export async function POST(request: Request) {
  const db = adminClient();
  if (!db) return Response.json({ pushed: false, reason: "not-configured" });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return Response.json({ error: "Sign in first" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { messageId?: unknown };
  const messageId = typeof body.messageId === "string" && /^[0-9a-f-]{36}$/i.test(body.messageId) ? body.messageId : null;
  if (!messageId) return Response.json({ error: "Unknown message" }, { status: 400 });

  const { data: message } = await db.from("messages").select("id, chat_id, sender_id, kind, body, payload, created_at, deleted_at").eq("id", messageId).maybeSingle();
  if (!message || String(message.sender_id) !== auth.user.id || message.deleted_at) return Response.json({ pushed: false, reason: "not-yours" });
  if (Date.now() - Date.parse(String(message.created_at)) > 2 * 60_000) return Response.json({ pushed: false, reason: "too-old" });
  const chatId = String(message.chat_id);
  const { data: chat } = await db.from("chats").select("id, kind, buddy_group_id").eq("id", chatId).maybeSingle();
  if (!chat) return Response.json({ pushed: false, reason: "no-chat" });

  // Who's in the chat (a group's members are its Train together group's active members).
  let recipients: string[] = [];
  if (chat.kind === "buddy") {
    const { data: members } = await db.from("buddy_members").select("user_id").eq("group_id", String(chat.buddy_group_id)).eq("status", "active");
    recipients = (members ?? []).map((row: Row) => String(row.user_id));
  } else {
    const { data: members } = await db.from("chat_members").select("user_id").eq("chat_id", chatId);
    recipients = (members ?? []).map((row: Row) => String(row.user_id));
  }
  if (!recipients.includes(auth.user.id)) return Response.json({ pushed: false, reason: "not-a-member" });
  recipients = recipients.filter((id) => id !== auth.user.id);
  if (!recipients.length) return Response.json({ pushed: 0 });

  const [{ data: sender }, { data: states }, { data: blocks }, { data: logs }] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    db.from("chat_members").select("user_id, muted, last_read_at").eq("chat_id", chatId).in("user_id", recipients),
    db.from("chat_blocks").select("blocker").eq("blocked", auth.user.id).in("blocker", recipients),
    db.from("chat_push_log").select("user_id, sent_at").eq("chat_id", chatId).in("user_id", recipients),
  ]);
  const stateOf = new Map((states ?? []).map((row: Row) => [String(row.user_id), row]));
  const blockedBy = new Set((blocks ?? []).map((row: Row) => String(row.blocker)));
  const lastPush = new Map((logs ?? []).map((row: Row) => [String(row.user_id), Date.parse(String(row.sent_at))]));

  const name = String(sender?.display_name || "A friend");
  const first = name.split(" ")[0];
  const payload = (message.payload ?? {}) as Row;
  const text = message.kind === "sticker" ? "Sent you a sticker 🧡" : message.kind === "workout"
    ? `Shared a workout: ${String(payload.title ?? "")}`.trim() : String(message.body).replace(/\s+/g, " ").slice(0, 120);
  const push = chat.kind === "buddy"
    ? { kind: "chat" as const, title: "Train together", body: `${first}: ${text}`, url: `/chats/${chatId}`, tag: `chat-${chatId}` }
    : { kind: "chat" as const, title: name, body: text, url: `/chats/${chatId}`, tag: `chat-${chatId}` };

  let pushed = 0;
  const now = Date.now();
  for (const id of recipients) {
    const state = stateOf.get(id);
    if (state?.muted === true || blockedBy.has(id)) continue;
    if (state && now - Date.parse(String(state.last_read_at)) < READING_MS) continue;
    if (now - (lastPush.get(id) ?? 0) < QUIET_MS) continue;
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", id).eq("nudges", true);
    if (!subs?.length) continue;
    await db.from("chat_push_log").upsert({ user_id: id, chat_id: chatId, sent_at: new Date().toISOString() });
    for (const sub of subs) {
      const result = await sendPush(sub, push);
      if (result === "sent") pushed++;
      if (result === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }
  return Response.json({ pushed });
}
