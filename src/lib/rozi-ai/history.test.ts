import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAllConversations, deleteConversation, isMissingFunction, listConversations, loadConversation, saveReply, startQuestion } from "./history.ts";

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

test("saving a reply trims it and leaves out oversized cards", async () => {
  const db = fakeDb({});
  assert.equal(await saveReply(db.client, CONV, { text: "x".repeat(2000), intent: "TODAY_WORKOUT", source: "ai", model: "m", cards: [{ type: "stat", title: "t", value: "v", detail: "d" }] }), true);
  const args = db.calls[0][1] as { p_message: string; p_cards: unknown[] };
  assert.equal(args.p_message.length, 1500);
  assert.equal(args.p_cards.length, 1);
  await saveReply(db.client, CONV, { text: "ok", source: "ai", cards: [{ type: "stat", title: "x".repeat(20_000), value: "", detail: "" }] });
  assert.equal((db.calls[1][1] as { p_cards: unknown }).p_cards, null);
  assert.equal(await saveReply(db.client, "nope", { text: "x", source: "ai" }), false);
  assert.equal(await saveReply(fakeDb({ rozi_save_reply: { error: { code: "42501" } } }).client, CONV, { text: "x", source: "phone" }), false);
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
