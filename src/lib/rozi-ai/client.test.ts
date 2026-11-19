import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askRoziAi } from "./client.ts";

const signedIn = (token: string | null) => ({ auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) } }) as unknown as SupabaseClient;

function fakeFetch(reply: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (reply instanceof Error) throw reply;
    return new Response(typeof reply === "string" ? reply : JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

test("sends the question with the sign-in token and consent, and returns Rozi's answer", async () => {
  const { fetcher, calls } = fakeFetch({ ok: true, text: "Push day!", cards: [], intent: "TODAY_WORKOUT", model: "openai/gpt-oss-20b" });
  const result = await askRoziAi(signedIn("token-123"), "What's my workout today?", fetcher, "11111111-2222-4333-8444-555555555555");
  assert.deepEqual(result, { ok: true, text: "Push day!", cards: [], intent: "TODAY_WORKOUT", model: "openai/gpt-oss-20b" });
  assert.equal(calls[0].url, "/api/rozi/chat");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer token-123");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { message: "What's my workout today?", consent: true, conversationId: "11111111-2222-4333-8444-555555555555" }, "no chat history is sent — the server reads it");
});

test("signed out, network trouble or an odd reply all fall back to the phone — never an exception", async () => {
  assert.deepEqual(await askRoziAi(signedIn(null), "hi", fakeFetch({}).fetcher), { ok: false, reason: "sign-in", message: "Sign in to use Rozi AI.", fallback: true });
  const offline = await askRoziAi(signedIn("t"), "hi", fakeFetch(new TypeError("Failed to fetch")).fetcher);
  assert.equal(offline.ok === false && offline.fallback, true);
  for (const odd of ["<html>oops</html>", { hello: 1 }, { ok: true, text: 5 }, { ok: true, text: "x" }]) {
    const result = await askRoziAi(signedIn("t"), "hi", fakeFetch(odd, 500).fetcher);
    assert.ok(!result.ok && result.fallback, JSON.stringify(odd));
  }
  const busy = await askRoziAi(signedIn("t"), "hi", fakeFetch({ ok: false, reason: "busy", message: "busy", fallback: true, retryAfterSeconds: 30 }, 503).fetcher);
  assert.deepEqual(busy, { ok: false, reason: "busy", message: "busy", fallback: true, retryAfterSeconds: 30 });
});
