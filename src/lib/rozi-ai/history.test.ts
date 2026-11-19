import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAllConversations, deleteConversation, isMissingFunction, listConversations, loadConversation, loadHistoryLines, saveAiReply, saveReply, startQuestion } from "./history.ts";

const CONV = "11111111-2222-4333-8444-555555555555";

/** A stand-in Supabase client: answers each rpc from `replies` and records the calls. */
function fakeDb(replies: Record<string, { data?: unknown; error?: { code?: string; message?: string } }>) {
  const calls: Array<[string, unknown]> = [];
  const client = { rpc: async (name: string, args?: unknown) => { calls.push([name, args]); return { data: replies[name]?.data ?? null, error: replies[name]?.error ?? null }; } } as unknown as SupabaseClient;
  return { client, calls };
}

test("starting a question: ok, limited (minute/day), or unavailable", async () => {
  const ok = fakeDb({ rozi_start_question: { data: { allowed: true, conversation_id: CONV } } });
  assert.deepEqual(await startQuestion(ok.client, CONV, "hi"), { kind: "ok", conversationId: CONV });
  assert.deepEqual(ok.calls[0], ["rozi_start_question", { p_conversation: CONV, p_message: "hi" }]);
  const bad = fakeDb({ rozi_start_question: { data: { allowed: true, conversation_id: CONV } } });
  await startQuestion(bad.client, "x'; drop", "hi");
  assert.deepEqual(bad.calls[0][1], { p_conversation: null, p_message: "hi" }, "a malformed id is never sent");
  assert.deepEqual(await startQuestion(fakeDb({ rozi_start_question: { data: { allowed: false, limit: "day", retry_after_seconds: 3600 } } }).client, null, "hi"), { kind: "limited", limit: "day", retryAfterSeconds: 3600 });
  assert.deepEqual(await startQuestion(fakeDb({ rozi_start_question: { data: { allowed: false, limit: "minute" } } }).client, null, "hi"), { kind: "limited", limit: "minute", retryAfterSeconds: 60 });
  assert.deepEqual(await startQuestion(fakeDb({ rozi_start_question: { error: { code: "PGRST202", message: "Could not find the function" } } }).client, null, "hi"), { kind: "unavailable" });
});

test("the app can only save on-phone answers; AI replies go through the server-only function", async () => {
  const app = fakeDb({});
  assert.equal(await saveReply(app.client, CONV, { text: "On-phone answer", intent: "TODAY_WORKOUT", source: "phone" }), true);
  assert.deepEqual(app.calls[0], ["rozi_save_reply", { p_conversation: CONV, p_message: "On-phone answer", p_intent: "TODAY_WORKOUT", p_source: "phone" }]);
  assert.equal(await saveReply(app.client, CONV, { text: "pretend AI", source: "ai" }), false, "the app never even tries to save an AI reply");
  assert.equal(app.calls.length, 1);
  assert.equal(await saveReply(app.client, "nope", { text: "x", source: "phone" }), false);
  assert.equal(await saveReply(fakeDb({ rozi_save_reply: { error: { code: "42501" } } }).client, CONV, { text: "x", source: "phone" }), false);

  const server = fakeDb({});
  assert.equal(await saveAiReply(server.client, "user-1", CONV, { text: "x".repeat(2000), intent: "TODAY_WORKOUT", model: "m", cards: [{ type: "stat", title: "t", value: "v", detail: "d" }] }), true);
  const args = server.calls[0][1] as { p_user: string; p_message: string; p_cards: unknown[] };
  assert.equal(server.calls[0][0], "rozi_save_ai_reply");
  assert.equal(args.p_user, "user-1");
  assert.equal(args.p_message.length, 1500);
  assert.equal(args.p_cards.length, 1);
  await saveAiReply(server.client, "user-1", CONV, { text: "ok", cards: [{ type: "stat", title: "x".repeat(20_000), value: "", detail: "" }] });
  assert.equal((server.calls[1][1] as { p_cards: unknown }).p_cards, null, "oversized cards are left out");
});

test("history for the model: the person's questions and AI replies only (on-phone answers left out)", async () => {
  const db = fakeDb({ rozi_conversation: { data: { id: CONV, title: "t", messages: [
    { id: "1", sender: "me", message: "Q1", created_at: "a" },
    { id: "2", sender: "rozi", source: "phone", message: "phone answer written by the app", created_at: "b" },
    { id: "3", sender: "me", message: "Q2", created_at: "c" },
    { id: "4", sender: "rozi", source: "ai", message: "AI answer", created_at: "d" },
  ] } } });
  assert.deepEqual(await loadHistoryLines(db.client, CONV), [{ from: "me", text: "Q1" }, { from: "me", text: "Q2" }, { from: "rozi", text: "AI answer" }]);
  assert.equal(await loadHistoryLines(db.client, null), null);
  assert.equal(await loadHistoryLines(fakeDb({ rozi_conversation: { data: null } }).client, CONV), null, "not the person's conversation → nothing");
});

test("listing, opening and deleting conversations", async () => {
  const db = fakeDb({
    rozi_conversations: { data: [{ id: CONV, title: "Workout?", created_at: "a", updated_at: "b", messages: 2 }] },
    rozi_conversation: { data: { id: CONV, title: "Workout?", messages: [{ id: "m1", sender: "me", message: "Workout?", created_at: "a" }, { id: "m2", sender: "rozi", message: "Legs", source: "ai", intent: "TODAY_WORKOUT", model: "m", cards: [{ type: "stat" }], created_at: "b" }] } },
    rozi_delete_conversation: { data: true },
    rozi_delete_all_conversations: { data: 3 },
  });
  assert.deepEqual(await listConversations(db.client), [{ id: CONV, title: "Workout?", createdAt: "a", updatedAt: "b", messages: 2 }]);
  const conversation = await loadConversation(db.client, CONV);
  assert.equal(conversation?.messages.length, 2);
  assert.equal(conversation?.messages[1].source, "ai");
  assert.equal(conversation?.messages[0].cards, null);
  assert.equal(await loadConversation(db.client, "bad"), null);
  assert.equal(await deleteConversation(db.client, CONV), true);
  assert.equal(await deleteAllConversations(db.client), 3);
  assert.equal(await listConversations(fakeDb({ rozi_conversations: { error: { code: "PGRST202" } } }).client), null, "no history yet → null");
  assert.equal(isMissingFunction({ code: "42883" }), true);
  assert.equal(isMissingFunction({ code: "42501" }), false);
});
