import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "../demo-data.ts";
import type { OwnTrainingData } from "../supabase-repository";
import { dayIn, handleRoziChat, parseChatBody, type RoziChatDeps } from "./handler.ts";
import { RoziAiError, type AiProvider, type AiRequest } from "./provider.ts";
import { createRateLimiter } from "./rate-limit.ts";

const NOW = new Date("2026-11-18T09:00:00Z");
const adult = (birthYear?: number): OwnTrainingData => ({
  profile: { ...createDemoState().profile, id: "owner-1", displayName: "Private Name", birthYear, timeZone: "Asia/Kolkata" },
  sessions: [], bodyWeightEntries: [], trainerRuleSettings: undefined, trainerRuleRevision: 1,
});

/** A model that answers with fixed text (or throws), and records what it was asked. */
function model(reply: string | RoziAiError) {
  const requests: AiRequest[] = [];
  const provider: AiProvider = {
    name: "fake", model: "fake-1",
    async generate(request) {
      requests.push(request);
      if (reply instanceof RoziAiError) throw reply;
      return { text: reply, toolCalls: [], modelTurn: { role: "model", parts: [{ kind: "text", text: reply }] }, finishReason: "STOP", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, model: "fake-1", latencyMs: 5 };
    },
  };
  return { provider, requests };
}

function deps(over: Partial<RoziChatDeps> & { data?: OwnTrainingData | null; reply?: string | RoziAiError } = {}) {
  const fake = model(over.reply ?? "Hi from Rozi!");
  const logs: Array<Record<string, unknown>> = [];
  const loaded: string[] = [];
  const value: RoziChatDeps = {
    session: async (token) => (token === "good-token" ? { userId: "owner-1", loadData: async () => { loaded.push("owner-1"); return over.data === undefined ? adult(1990) : over.data; } } : null),
    providers: () => ({ ok: true, providers: [fake.provider] }),
    limiter: createRateLimiter(),
    now: () => NOW,
    log: (entry) => logs.push(entry),
    ...over,
  };
  return { deps: value, fake, logs, loaded };
}

const ASK = { message: "What's my workout today?", consent: true };

test("a signed-in adult who opted in gets Rozi's answer", async () => {
  const { deps: d, fake, logs } = deps();
  const result = await handleRoziChat({ token: "good-token", body: ASK }, d);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, text: "Hi from Rozi!", cards: [], intent: "GENERAL_FITNESS_QUESTION", model: "fake-1" });
  assert.match(fake.requests[0].system, /Wednesday, November 18/, "today is worked out in the person's time zone");
  assert.ok(!JSON.stringify(fake.requests).includes("Private Name"), "the name never reaches the model");
  assert.equal(logs.length, 1);
  assert.ok(!JSON.stringify(logs).includes("owner-1") && !JSON.stringify(logs).includes("workout today"), "logs hold no user id or message");
});

test("no sign-in, or a bad one, is refused before anything is read", async () => {
  const { deps: d, loaded, fake } = deps();
  assert.equal((await handleRoziChat({ token: null, body: ASK }, d)).status, 401);
  const bad = await handleRoziChat({ token: "forged", body: ASK }, d);
  assert.equal(bad.status, 401);
  assert.deepEqual(bad.body, { ok: false, reason: "sign-in", message: "Your sign-in has expired. Please sign in again.", fallback: true });
  const broken = deps({ session: async () => { throw new Error("network"); } });
  assert.equal((await handleRoziChat({ token: "good-token", body: ASK }, broken.deps)).status, 401);
  assert.equal(loaded.length, 0);
  assert.equal(fake.requests.length, 0);
});

test("the person is only ever the token's owner: a user id in the body is ignored", async () => {
  const { deps: d, loaded } = deps();
  const result = await handleRoziChat({ token: "good-token", body: { ...ASK, userId: "someone-else", user_id: "someone-else" } }, d);
  assert.equal(result.status, 200);
  assert.deepEqual(loaded, ["owner-1"]);
});

test("bad requests are refused with 400", async () => {
  const { deps: d } = deps();
  for (const body of [null, "text", [], {}, { message: "" }, { message: "   " }, { message: 42 }, { message: "x".repeat(301), consent: true },
    { ...ASK, history: "nope" }, { ...ASK, history: [{ from: "admin", text: "x" }] }, { ...ASK, history: [{ from: "me" }] }, { ...ASK, history: Array(41).fill({ from: "me", text: "x" }) }]) {
    const result = await handleRoziChat({ token: "good-token", body }, d);
    assert.equal(result.status, 400, JSON.stringify(body).slice(0, 60));
    assert.equal((result.body as { fallback: boolean }).fallback, false);
  }
});

test("history is trimmed to the last 8 lines of 600 characters", () => {
  const parsed = parseChatBody({ ...ASK, history: Array.from({ length: 20 }, (_, index) => ({ from: index % 2 ? "rozi" : "me", text: `${index} ${"y".repeat(900)}` })) });
  assert.equal(parsed?.history.length, 8);
  assert.ok(parsed?.history.every((line) => line.text.length <= 600));
  assert.match(parsed!.history[0].text, /^12 /);
});

test("not opted in, no AI configured, no profile, or not an adult: refused with fallback", async () => {
  const optOut = await handleRoziChat({ token: "good-token", body: { message: "hi" } }, deps().deps);
  assert.deepEqual([optOut.status, (optOut.body as { reason: string }).reason], [403, "consent"]);
  const off = await handleRoziChat({ token: "good-token", body: ASK }, deps({ providers: () => ({ ok: false, problem: "missing-key" }) }).deps);
  assert.deepEqual([off.status, (off.body as { reason: string }).reason, (off.body as { fallback: boolean }).fallback], [503, "off", true]);
  const noProfile = await handleRoziChat({ token: "good-token", body: ASK }, deps({ data: null }).deps);
  assert.deepEqual([noProfile.status, (noProfile.body as { reason: string }).reason], [409, "no-profile"]);
  for (const birthYear of [undefined, 2010]) {
    const minor = deps({ data: adult(birthYear) });
    const result = await handleRoziChat({ token: "good-token", body: ASK }, minor.deps);
    assert.deepEqual([result.status, (result.body as { reason: string }).reason], [403, "adults-only"]);
    assert.equal(minor.fake.requests.length, 0, "nothing is sent to the AI");
  }
  assert.equal((await handleRoziChat({ token: "good-token", body: ASK }, deps({ data: adult(2008) }).deps)).status, 200, "turns 18 this year");
});

test("too many questions are refused with a wait time", async () => {
  const { deps: d, fake } = deps();
  for (let index = 0; index < 6; index++) assert.equal((await handleRoziChat({ token: "good-token", body: ASK }, d)).status, 200);
  const limited = await handleRoziChat({ token: "good-token", body: ASK }, d);
  assert.equal(limited.status, 429);
  assert.equal((limited.body as { reason: string }).reason, "limit");
  assert.ok(((limited.body as { retryAfterSeconds: number }).retryAfterSeconds) > 0);
  assert.equal(fake.requests.length, 6);
});

test("AI failures become a fallback, never an error page", async () => {
  const busy = await handleRoziChat({ token: "good-token", body: ASK }, deps({ reply: new RoziAiError("rate-limited", "x", { status: 429, retryAfterSeconds: 40 }) }).deps);
  assert.deepEqual([busy.status, (busy.body as { reason: string }).reason, (busy.body as { retryAfterSeconds: number }).retryAfterSeconds, (busy.body as { fallback: boolean }).fallback], [503, "busy", 40, true]);
  const timeout = await handleRoziChat({ token: "good-token", body: ASK }, deps({ reply: new RoziAiError("timeout", "x") }).deps);
  assert.equal((timeout.body as { reason: string }).reason, "busy");
  const broken = await handleRoziChat({ token: "good-token", body: ASK }, deps({ reply: new RoziAiError("auth", "key refused") }).deps);
  assert.deepEqual([broken.status, (broken.body as { reason: string }).reason], [502, "error"]);
  assert.ok(!JSON.stringify(broken.body).includes("key refused"), "provider details aren't shown to the person");
  const failingLoad = await handleRoziChat({ token: "good-token", body: ASK }, deps({ session: async () => ({ userId: "owner-1", loadData: async () => { throw new Error("db down"); } }) }).deps);
  assert.deepEqual([failingLoad.status, (failingLoad.body as { reason: string }).reason], [502, "error"]);
});

test("today follows the person's time zone", () => {
  assert.equal(dayIn("Asia/Kolkata", new Date("2026-11-18T20:00:00Z")), "2026-11-19");
  assert.equal(dayIn("America/Los_Angeles", new Date("2026-11-18T05:00:00Z")), "2026-11-17");
  assert.equal(dayIn("Not/AZone", new Date("2026-11-18T05:00:00Z")), "2026-11-18");
});

test("the rate limiter allows 6 a minute and 60 a day, per person", () => {
  const limiter = createRateLimiter();
  const start = Date.parse("2026-11-18T00:00:00Z");
  for (let index = 0; index < 6; index++) assert.equal(limiter.take("a", start + index).allowed, true);
  const blocked = limiter.take("a", start + 10);
  assert.equal(blocked.allowed, false);
  assert.ok(!blocked.allowed && blocked.retryAfterSeconds === 60);
  assert.equal(limiter.take("b", start + 10).allowed, true, "other people aren't affected");
  assert.equal(limiter.take("a", start + 61_000).allowed, true, "a minute later it's fine again");
  let day = start;
  const daily = createRateLimiter();
  let allowed = 0;
  for (let index = 0; index < 80; index++) { day += 61_000; if (daily.take("a", day).allowed) allowed++; }
  assert.equal(allowed, 60);
});

// ---------- Chat history (stage 6) ----------

const CONV = "11111111-2222-4333-8444-555555555555";

function withHistory(start: () => Promise<import("./history.ts").StartQuestionResult>, extra: Partial<Parameters<typeof deps>[0]> = {}) {
  const saved: Array<{ conversationId: string; reply: import("./history.ts").ReplyToSave }> = [];
  const started: Array<[string | null, string]> = [];
  const made = deps({
    ...extra,
    session: async (token) => token === "good-token" ? {
      userId: "owner-1",
      loadData: async () => adult(1990),
      history: {
        start: async (conversationId, message) => { started.push([conversationId, message]); return start(); },
        saveReply: async (conversationId, reply) => { saved.push({ conversationId, reply }); return true; },
      },
    } : null,
  });
  return { ...made, saved, started };
}

test("with history: the question is recorded, the reply saved, and the conversation id returned", async () => {
  const { deps: d, saved, started, fake } = withHistory(async () => ({ kind: "ok", conversationId: CONV }));
  const result = await handleRoziChat({ token: "good-token", body: { ...ASK, conversationId: CONV } }, d);
  assert.equal(result.status, 200);
  assert.equal((result.body as { conversationId: string }).conversationId, CONV);
  assert.deepEqual(started, [[CONV, "What's my workout today?"]]);
  assert.deepEqual(saved, [{ conversationId: CONV, reply: { text: "Hi from Rozi!", intent: "GENERAL_FITNESS_QUESTION", source: "ai", model: "fake-1", cards: [] } }]);
  assert.equal(fake.requests.length, 1);
});

test("with history: the database limit refuses before any AI call (and the in-memory limit isn't used)", async () => {
  const day = withHistory(async () => ({ kind: "limited", limit: "day", retryAfterSeconds: 7200 }));
  const result = await handleRoziChat({ token: "good-token", body: ASK }, day.deps);
  assert.deepEqual([result.status, (result.body as { reason: string }).reason, (result.body as { retryAfterSeconds: number }).retryAfterSeconds], [429, "limit", 7200]);
  assert.match((result.body as { message: string }).message, /back tomorrow/);
  assert.equal(day.fake.requests.length, 0);
  // Recorded questions don't also count against the in-memory limiter: 10 in a row pass when the database allows them.
  const ok = withHistory(async () => ({ kind: "ok", conversationId: CONV }));
  for (let index = 0; index < 10; index++) assert.equal((await handleRoziChat({ token: "good-token", body: ASK }, ok.deps)).status, 200);
});

test("history unavailable (migration not applied): answers still work, limited in memory, nothing saved", async () => {
  const { deps: d, saved } = withHistory(async () => ({ kind: "unavailable" }));
  const result = await handleRoziChat({ token: "good-token", body: ASK }, d);
  assert.equal(result.status, 200);
  assert.equal((result.body as { conversationId?: string }).conversationId, undefined);
  assert.equal(saved.length, 0);
  for (let index = 0; index < 5; index++) await handleRoziChat({ token: "good-token", body: ASK }, d);
  assert.equal((await handleRoziChat({ token: "good-token", body: ASK }, d)).status, 429, "the in-memory limit (6 a minute) applies");
  const throwing = withHistory(async () => { throw new Error("db down"); });
  assert.equal((await handleRoziChat({ token: "good-token", body: ASK }, throwing.deps)).status, 200, "a history error never blocks the answer");
});

test("when the AI fails, the fallback carries the conversation id so the phone answer can be saved there", async () => {
  const { deps: d, saved } = withHistory(async () => ({ kind: "ok", conversationId: CONV }), { reply: new RoziAiError("unavailable", "busy") });
  const result = await handleRoziChat({ token: "good-token", body: ASK }, d);
  assert.deepEqual([result.status, (result.body as { reason: string }).reason, (result.body as { conversationId: string }).conversationId], [503, "busy", CONV]);
  assert.equal(saved.length, 0, "no AI reply to save");
});

test("a malformed conversation id is ignored (a new conversation starts)", async () => {
  const { deps: d, started } = withHistory(async () => ({ kind: "ok", conversationId: CONV }));
  await handleRoziChat({ token: "good-token", body: { ...ASK, conversationId: "not-a-uuid'; drop" } }, d);
  await handleRoziChat({ token: "good-token", body: { ...ASK, conversationId: 42 } }, d);
  assert.deepEqual(started.map(([id]) => id), [null, null]);
});
