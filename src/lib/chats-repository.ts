import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageKind, WorkoutCard } from "./chats";

type Row = Record<string, unknown>;
const NOT_READY = "Chats need the latest database update. Please try again after it's installed.";

function fail(error: { code?: string; message: string }): never {
  const missing = error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST205" || error.code === "42P01";
  throw new Error(missing ? NOT_READY : error.message);
}

export interface ChatPerson { id: string; name: string; avatar?: string }

export interface ChatSummary {
  id: string;
  kind: "direct" | "buddy";
  title: string;
  avatar?: string;
  /** 1:1 chats: the other person. */
  otherId?: string;
  /** Group chats: the people in it. */
  members: ChatPerson[];
  lastAt: string | null;
  last: { kind: string; body: string; title?: string | null; senderId: string; deleted: boolean; at: string } | null;
  unread: number;
  muted: boolean;
  blocked: boolean;
  canSend: boolean;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  kind: MessageKind;
  body: string;
  payload: Row | null;
  at: string;
  deleted: boolean;
}

const person = (row: Row): ChatPerson => ({ id: String(row.id ?? row.user_id), name: String(row.name ?? row.display_name ?? "Someone"), ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}) });

export function toMessage(row: Row): ChatMessage {
  const kind = row.kind === "sticker" || row.kind === "workout" ? row.kind : "text";
  return {
    id: String(row.id), chatId: String(row.chat_id), senderId: String(row.sender_id), kind, body: String(row.body ?? ""),
    payload: row.payload && typeof row.payload === "object" ? row.payload as Row : null, at: String(row.created_at), deleted: Boolean(row.deleted_at),
  };
}

/** Your chats, newest first (null before the database update). */
export async function loadChats(client: SupabaseClient): Promise<ChatSummary[] | null> {
  const { data, error } = await client.rpc("my_chats");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    fail(error);
  }
  return ((data ?? []) as Row[]).map((row) => {
    const last = row.last as Row | null;
    return {
      id: String(row.id), kind: row.kind === "buddy" ? "buddy" : "direct", title: String(row.title ?? "Chat"),
      ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}),
      ...(typeof row.other_id === "string" ? { otherId: row.other_id } : {}),
      members: Array.isArray(row.members) ? (row.members as Row[]).map(person) : [],
      lastAt: typeof row.last_at === "string" ? row.last_at : null,
      last: last ? { kind: String(last.kind), body: String(last.body ?? ""), title: typeof last.title === "string" ? last.title : null, senderId: String(last.sender_id), deleted: last.deleted === true, at: String(last.at) } : null,
      unread: Number(row.unread ?? 0), muted: row.muted === true, blocked: row.blocked === true, canSend: row.can_send !== false,
    };
  });
}

/** Unread messages across chats you haven't muted (for the badge). */
export const unreadTotal = (chats: ChatSummary[] | null) => (chats ?? []).reduce((sum, chat) => sum + (chat.muted ? 0 : chat.unread), 0);

async function call<T>(client: SupabaseClient, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) fail(error);
  return data as T;
}

export const openDirectChat = (client: SupabaseClient, otherId: string) => call<string>(client, "open_direct_chat", { p_other: otherId });
export const openBuddyChat = (client: SupabaseClient) => call<string>(client, "open_buddy_chat");
export const markChatRead = (client: SupabaseClient, chatId: string) => call<string>(client, "mark_chat_read", { p_chat: chatId });
export const setChatMuted = (client: SupabaseClient, chatId: string, on: boolean) => call<boolean>(client, "set_chat_muted", { p_chat: chatId, p_on: on });
export const setChatBlock = (client: SupabaseClient, userId: string, on: boolean) => call<boolean>(client, "set_chat_block", { p_user: userId, p_on: on });
export const deleteMessage = (client: SupabaseClient, messageId: string) => call<boolean>(client, "delete_message", { p_message: messageId });
export type ChatReportReason = "harassment" | "inappropriate" | "spam" | "unsafe" | "other";
export const reportMessage = (client: SupabaseClient, messageId: string, reason: ChatReportReason, note: string) => call<boolean>(client, "report_message", { p_message: messageId, p_reason: reason, p_note: note });

/** Sends a message, then asks the server to notify the others (best effort). */
export async function sendMessage(client: SupabaseClient, chatId: string, kind: MessageKind, body: string, payload?: { mood: string } | WorkoutCard): Promise<ChatMessage> {
  const row = await call<Row>(client, "send_message", { p_chat: chatId, p_kind: kind, p_body: body, p_payload: payload ?? null });
  const message = toMessage(row);
  void notifyChat(client, message.id);
  return message;
}

async function notifyChat(client: SupabaseClient, messageId: string): Promise<void> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/push/chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ messageId }) }).catch(() => undefined);
}

/** The latest messages (oldest first), or the page before `before`. */
export async function loadMessages(client: SupabaseClient, chatId: string, before?: string, limit = 50): Promise<ChatMessage[]> {
  let query = client.from("messages").select("id, chat_id, sender_id, kind, body, payload, created_at, deleted_at").eq("chat_id", chatId).order("created_at", { ascending: false }).limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) fail(error);
  return ((data ?? []) as Row[]).map(toMessage).reverse();
}

/** Names and pictures of the people in a chat. */
export async function loadChatPeople(client: SupabaseClient, chatId: string): Promise<Map<string, ChatPerson>> {
  const { data, error } = await client.rpc("chat_members_info", { p_chat: chatId });
  if (error) fail(error);
  return new Map(((data ?? []) as Row[]).map((row) => { const value = person(row); return [value.id, value]; }));
}

export interface Contact extends ChatPerson { role: "friend" | "trainer" | "client" }

/** Who you can start a 1:1 chat with: friends, your trainers, your clients. */
export async function loadContacts(client: SupabaseClient): Promise<Contact[]> {
  const { data, error } = await client.rpc("chat_people");
  if (error) fail(error);
  return ((data ?? []) as Row[]).map((row) => ({ ...person(row), role: row.role === "trainer" || row.role === "client" ? row.role : "friend" }));
}

/**
 * Live messages: new, edited (deleted) ones arrive as they happen. Row security on `messages` decides what each
 * person receives. Without `chatId`, every chat you're in (for the unread badge). Returns the unsubscribe.
 */
export function subscribeToMessages(client: SupabaseClient, onChange: (message: ChatMessage, event: "INSERT" | "UPDATE") => void, chatId?: string): () => void {
  const channel = client
    .channel(`messages-${chatId ?? "all"}-${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", ...(chatId ? { filter: `chat_id=eq.${chatId}` } : {}) }, (change) => {
      if (change.eventType !== "INSERT" && change.eventType !== "UPDATE") return;
      onChange(toMessage(change.new as Row), change.eventType);
    })
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
