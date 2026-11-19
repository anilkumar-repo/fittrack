// ---------- Rozi AI: chat history (database functions from 20261118230000_rozi_chat_history.sql) ----------
//
// Used by the server route (record the question + limit, save the reply) and by the Rozi screen (list, open, delete).
// Every call goes through the person's own sign-in; the database only ever touches their own conversations.
// Before the migration is applied the functions don't exist: callers get "unavailable" and carry on without history.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoziCard } from "./cards.ts";
import type { ChatLine } from "./prompt.ts";

export type StartQuestionResult =
  | { kind: "ok"; conversationId: string }
  | { kind: "limited"; limit: "minute" | "day"; retryAfterSeconds: number }
  /** History isn't available (migration not applied, or a database error): carry on without it. */
  | { kind: "unavailable" };

export interface RoziConversationSummary { id: string; title: string; createdAt: string; updatedAt: string; messages: number }

export interface RoziStoredMessage {
  id: string;
  sender: "me" | "rozi";
  message: string;
  intent: string | null;
  source: "ai" | "phone" | null;
  model: string | null;
  cards: RoziCard[] | null;
  createdAt: string;
}

export interface RoziStoredConversation { id: string; title: string; messages: RoziStoredMessage[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isConversationId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** The history functions aren't in the database yet (PostgREST "function not found"). */
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "")));
}

/** Records the question (and enforces the database limits); continues `conversationId` if it's the person's own. */
export async function startQuestion(client: SupabaseClient, conversationId: string | null, message: string): Promise<StartQuestionResult> {
  const { data, error } = await client.rpc("rozi_start_question", { p_conversation: isConversationId(conversationId) ? conversationId : null, p_message: message });
  if (error || !data || typeof data !== "object") return { kind: "unavailable" };
  const value = data as { allowed?: boolean; conversation_id?: string; limit?: string; retry_after_seconds?: number };
  if (value.allowed === false) return { kind: "limited", limit: value.limit === "day" ? "day" : "minute", retryAfterSeconds: Math.max(1, Number(value.retry_after_seconds) || 60) };
  return isConversationId(value.conversation_id) ? { kind: "ok", conversationId: value.conversation_id } : { kind: "unavailable" };
}

export interface ReplyToSave { text: string; intent?: string | null; source: "ai" | "phone"; model?: string | null; cards?: RoziCard[] | null }

/**
 * The app saves its own on-phone answer next to the question (source "phone"; the database refuses anything else
 * from the app). Returns false if it couldn't be saved — history is a nice-to-have; the answer still shows.
 */
export async function saveReply(client: SupabaseClient, conversationId: string, reply: ReplyToSave): Promise<boolean> {
  if (!isConversationId(conversationId) || !reply.text.trim() || reply.source !== "phone") return false;
  const { error } = await client.rpc("rozi_save_reply", {
    p_conversation: conversationId, p_message: reply.text.slice(0, 1500), p_intent: reply.intent ?? null, p_source: "phone",
  });
  return !error;
}

/**
 * SERVER ONLY: saves an AI reply with the service-role client, after /api/rozi/chat checked the person's sign-in.
 * The database function is callable only by the service role and checks the conversation belongs to `userId`.
 */
export async function saveAiReply(serviceClient: SupabaseClient, userId: string, conversationId: string, reply: Omit<ReplyToSave, "source">): Promise<boolean> {
  if (!isConversationId(conversationId) || !reply.text.trim()) return false;
  const cards = reply.cards?.length ? reply.cards : null;
  const { error } = await serviceClient.rpc("rozi_save_ai_reply", {
    p_user: userId, p_conversation: conversationId, p_message: reply.text.slice(0, 1500), p_intent: reply.intent ?? null,
    p_model: reply.model ?? null, p_cards: cards && JSON.stringify(cards).length <= 14_000 ? cards : null,
  });
  return !error;
}

/**
 * The earlier turns the model sees, read from the person's OWN saved conversation (owner-checked in the database) —
 * never from what the browser sends. Only the person's questions and Rozi's AI replies are used; on-phone answers
 * (saved by the app) are left out. Null when there's no history to load.
 */
export async function loadHistoryLines(client: SupabaseClient, conversationId: string | null, max = 8): Promise<ChatLine[] | null> {
  if (!isConversationId(conversationId)) return null;
  const conversation = await loadConversation(client, conversationId);
  if (!conversation) return null;
  return conversation.messages
    .filter((message) => message.sender === "me" || message.source === "ai")
    .slice(-max)
    .map((message) => ({ from: message.sender, text: message.message.slice(0, 600) }));
}

/** The person's recent conversations, newest first; null if history isn't available. */
export async function listConversations(client: SupabaseClient, limit = 30): Promise<RoziConversationSummary[] | null> {
  const { data, error } = await client.rpc("rozi_conversations", { p_limit: limit });
  if (error || !Array.isArray(data)) return null;
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id), title: String(row.title ?? "Chat"), createdAt: String(row.created_at), updatedAt: String(row.updated_at), messages: Number(row.messages ?? 0),
  }));
}

/** One conversation with its messages, or null if it isn't the person's (or history isn't available). */
export async function loadConversation(client: SupabaseClient, conversationId: string): Promise<RoziStoredConversation | null> {
  if (!isConversationId(conversationId)) return null;
  const { data, error } = await client.rpc("rozi_conversation", { p_conversation: conversationId });
  if (error || !data || typeof data !== "object") return null;
  const value = data as { id: string; title: string; messages?: Array<Record<string, unknown>> };
  return {
    id: String(value.id), title: String(value.title ?? "Chat"),
    messages: (value.messages ?? []).map((row) => ({
      id: String(row.id), sender: row.sender === "rozi" ? "rozi" : "me", message: String(row.message ?? ""),
      intent: typeof row.intent === "string" ? row.intent : null, source: row.source === "ai" || row.source === "phone" ? row.source : null,
      model: typeof row.model === "string" ? row.model : null, cards: Array.isArray(row.cards) ? (row.cards as RoziCard[]) : null, createdAt: String(row.created_at),
    })),
  };
}

export async function deleteConversation(client: SupabaseClient, conversationId: string): Promise<boolean> {
  if (!isConversationId(conversationId)) return false;
  const { data, error } = await client.rpc("rozi_delete_conversation", { p_conversation: conversationId });
  return !error && data === true;
}

export async function deleteAllConversations(client: SupabaseClient): Promise<number | null> {
  const { data, error } = await client.rpc("rozi_delete_all_conversations");
  return error ? null : Number(data ?? 0);
}
