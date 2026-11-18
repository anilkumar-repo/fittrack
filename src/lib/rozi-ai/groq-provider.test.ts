import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "../demo-data.ts";
import { askRozi } from "./conversation.ts";
import { createGroqProvider, nullableOptional, toGroqMessages, type GroqClient, type GroqParams, type GroqResponse } from "./groq-provider.ts";
import { ROZI_TOOLS } from "./tools.ts";
import { RoziAiError, type AiRequest } from "./provider.ts";
import { roziContext } from "./tools.ts";

const CONFIG = { provider: "groq" as const, model: "openai/gpt-oss-120b", apiKey: "gsk_test_not_real" };
const ASK: AiRequest = { system: "You are Rozi.", turns: [{ role: "user", parts: [{ kind: "text", text: "Hi" }] }] };

/** A stand-in for the SDK: each call takes the next reply (or throws it) and records the request. */
function fakeClient(replies: Array<GroqResponse | Error | (() => Promise<never>)>, headers: Headers | null = null) {
  const calls: GroqParams[] = [];
  const client: GroqClient = {
    async complete(params) {
      calls.push(structuredClone(params));
      const reply = replies.shift() ?? { choices: [{ message: { content: "ok" } }] };
      if (typeof reply === "function") return reply();
      if (reply instanceof Error) throw reply;
      return { body: reply, headers };
    },
  };
  return { client, calls };
}

const say = (content: string): GroqResponse => ({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 } });
const httpError = (status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  Object.assign(new Error(`raw groq text ${status} gsk_test_not_real`), { status, headers: new Headers(headers), error: extra });

test("sends Rozi's rules, the chat, tools and limits in Groq's format", async () => {
  const { client, calls } = fakeClient([say("Hi! 💪")], new Headers({ "x-ratelimit-remaining-requests": "998", "x-ratelimit-remaining-tokens": "7400" }));
  const result = await createGroqProvider(CONFIG, client).generate({
    ...ASK, maxOutputTokens: 300,
    tools: [{ name: "get_streak", description: "Streak", parameters: { type: "object", properties: {} } }],
  });
  assert.equal(result.text, "Hi! 💪");
  assert.deepEqual(result.usage, { inputTokens: 50, outputTokens: 10, totalTokens: 60 });
  assert.deepEqual(result.limits, { remainingRequests: 998, remainingTokens: 7400 });
  const sent = calls[0];
  assert.equal(sent.model, "openai/gpt-oss-120b");
  assert.deepEqual(sent.messages, [{ role: "system", content: "You are Rozi." }, { role: "user", content: "Hi" }]);
  assert.equal(sent.max_completion_tokens, 300);
  assert.equal(sent.tool_choice, "auto");
  assert.deepEqual(sent.tools, [{ type: "function", function: { name: "get_streak", description: "Streak", parameters: { type: "object", properties: {} } } }]);
  assert.equal(sent.reasoning_effort, "low");
  assert.equal(sent.include_reasoning, false, "gpt-oss: no reasoning text back");
  assert.ok(!JSON.stringify(sent).includes("gsk_test_not_real"), "the key is never in the request body");
});

test("Qwen gets hidden reasoning; other models get no reasoning fields", async () => {
  const qwen = fakeClient([say("ok")]);
  await createGroqProvider({ ...CONFIG, model: "qwen/qwen3.8-27b" }, qwen.client).generate(ASK);
  assert.equal(qwen.calls[0].reasoning_format, "hidden");
  assert.equal(qwen.calls[0].include_reasoning, undefined);
  const other = fakeClient([say("ok")]);
  await createGroqProvider({ ...CONFIG, model: "some/other-model" }, other.client).generate(ASK);
  assert.equal(other.calls[0].reasoning_effort, undefined);
});

test("tool calls come back parsed, go back as tool messages, and Gemini signatures are never sent", async () => {
  const { client, calls } = fakeClient([
    { choices: [{ message: { content: null, tool_calls: [{ id: "call_a", function: { name: "get_progress", arguments: "{\"exercise\":\"bench\"}" } }] }, finish_reason: "tool_calls" }] },
    say("Your bench is up 2.5 kg."),
  ]);
  const provider = createGroqProvider(CONFIG, client);
  const first = await provider.generate(ASK);
  assert.deepEqual(first.toolCalls, [{ id: "call_a", name: "get_progress", args: { exercise: "bench" } }]);
  assert.deepEqual(first.modelTurn, { role: "model", parts: [{ kind: "tool-call", id: "call_a", name: "get_progress", args: { exercise: "bench" } }] });
  await provider.generate({
    ...ASK,
    turns: [
      ...ASK.turns,
      // A turn carrying a Gemini-style signature must not leak it.
      { role: "model", parts: [{ kind: "tool-call", id: "call_a", name: "get_progress", args: { exercise: "bench" }, signature: "gemini-sig" }] },
      { role: "user", parts: [{ kind: "tool-result", id: "call_a", name: "get_progress", result: { heaviestChangeKg: 2.5 } }] },
    ],
  });
  assert.deepEqual(calls[1].messages.slice(2), [
    { role: "assistant", content: null, tool_calls: [{ id: "call_a", type: "function", function: { name: "get_progress", arguments: "{\"exercise\":\"bench\"}" } }] },
    { role: "tool", tool_call_id: "call_a", name: "get_progress", content: "{\"heaviestChangeKg\":2.5}" },
  ]);
  assert.ok(!JSON.stringify(calls[1]).includes("gemini-sig"));
});

test("tool calls without ids get stable ids, and their results are matched by order", () => {
  const messages = toGroqMessages("rules", [
    { role: "user", parts: [{ kind: "text", text: "two things" }] },
    { role: "model", parts: [{ kind: "tool-call", name: "get_streak", args: {} }, { kind: "tool-call", name: "get_recovery", args: {} }] },
    { role: "user", parts: [{ kind: "tool-result", name: "get_streak", result: { current: 3 } }, { kind: "tool-result", name: "get_recovery", result: { ready: 6 } }] },
  ]);
  const assistant = messages[2] as { tool_calls: Array<{ id: string }> };
  assert.deepEqual(assistant.tool_calls.map((call) => call.id), ["call_1_0", "call_1_1"]);
  assert.deepEqual(messages.slice(3).map((message) => (message as { tool_call_id: string }).tool_call_id), ["call_1_0", "call_1_1"]);
});

test("malformed tool arguments are flagged, not guessed", async () => {
  const { client } = fakeClient([{ choices: [{ message: { tool_calls: [{ id: "x", function: { name: "get_progress", arguments: "{exercise: bench" } }, { id: "y", function: { name: "get_streak", arguments: "[1,2]" } }] } }] }]);
  const result = await createGroqProvider(CONFIG, client).generate(ASK);
  assert.equal(result.toolCalls[0].invalidArgs, "{exercise: bench");
  assert.deepEqual(result.toolCalls[0].args, {});
  assert.equal(result.toolCalls[1].invalidArgs, "[1,2]", "an array isn't an arguments object");
});

async function failure(replies: Array<GroqResponse | Error | (() => Promise<never>)>, timeoutMs?: number) {
  const fake = fakeClient(replies);
  try {
    await createGroqProvider(CONFIG, fake.client, timeoutMs).generate(ASK);
  } catch (error) {
    assert.ok(error instanceof RoziAiError);
    assert.ok(!error.message.includes("gsk_test_not_real") && !error.message.includes("raw groq text"));
    return { error, calls: fake.calls.length };
  }
  throw new Error("expected a failure");
}

test("errors become safe, typed errors with bounded retries", async () => {
  assert.equal((await failure([httpError(401)])).error.code, "auth");
  const missing = await failure([httpError(404)]);
  assert.equal(missing.error.code, "model-not-found");
  assert.equal(missing.calls, 1, "not retried");
  assert.equal((await failure([httpError(413)])).error.code, "bad-request");

  // Busy (503 / 498): one quick retry, then a clear error.
  const busy = await failure([httpError(503), httpError(498)]);
  assert.equal(busy.error.code, "unavailable");
  assert.match(busy.error.message, /busy/);
  assert.equal(busy.calls, 2);

  // Rate limit with a short wait: retried once and succeeds.
  const fake = fakeClient([httpError(429, {}, { "retry-after": "0" }), say("Back!")]);
  assert.equal((await createGroqProvider(CONFIG, fake.client).generate(ASK)).text, "Back!");
  // Rate limit with a long wait: no waiting inside Rozi; the wait is passed on.
  const long = await failure([httpError(429, {}, { "retry-after": "120" })]);
  assert.equal(long.error.code, "rate-limited");
  assert.equal(long.error.retryAfterSeconds, 120);
  assert.equal(long.calls, 1);

  // Groq couldn't parse the model's tool call: one retry, then "bad-tool-call".
  const bad = await failure([httpError(400, { error: { code: "tool_use_failed", failed_generation: "<function=…" } }), httpError(400, { error: { code: "tool_use_failed" } })]);
  assert.equal(bad.error.code, "bad-tool-call");
  assert.equal(bad.calls, 2);

  // A network blip is retried once (and would succeed); two in a row fail cleanly.
  const network = await failure([new TypeError("fetch failed"), new TypeError("fetch failed")]);
  assert.equal(network.error.code, "unavailable");
  assert.equal(network.calls, 2);
});

test("a slow model times out instead of hanging Rozi; empty and filtered answers are errors", async () => {
  const slow = await failure([() => new Promise<never>(() => undefined)], 30);
  assert.equal(slow.error.code, "timeout");
  assert.equal((await failure([{ choices: [{ message: { content: "" }, finish_reason: "stop" }] }, { choices: [{ message: { content: "" } }] }])).error.code, "empty");
  assert.equal((await failure([{ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }])).error.code, "blocked");
});

test("the whole Rozi loop works over Groq: tool, real data, final answer; bad arguments get a second chance", async () => {
  const ctx = roziContext({ profile: { ...createDemoState().profile, displayName: "Secret Person" }, sessions: [], bodyWeightEntries: [], trainerRuleSettings: undefined, trainerRuleRevision: 1 }, "2026-11-18", 9);
  const { client, calls } = fakeClient([
    { choices: [{ message: { tool_calls: [{ id: "c1", function: { name: "get_streak", arguments: "{oops" } }] } }] },
    { choices: [{ message: { tool_calls: [{ id: "c2", function: { name: "get_streak", arguments: "{}" } }] } }] },
    say("No streak yet — your next workout starts one!"),
  ]);
  const answer = await askRozi({ provider: createGroqProvider(CONFIG, client), ctx, message: "What's my streak?" });
  assert.equal(answer.text, "No streak yet — your next workout starts one!");
  assert.deepEqual(answer.toolsUsed, ["get_streak"], "the malformed call didn't run");
  const toolMessages = calls[2].messages.filter((message) => message.role === "tool") as Array<{ tool_call_id: string; content: string }>;
  assert.match(toolMessages[0].content, /not valid JSON/);
  assert.equal(toolMessages[1].tool_call_id, "c2");
  assert.match(toolMessages[1].content, /"current":0/);
  assert.ok(!JSON.stringify(calls).includes("Secret Person"));
});

test("optional tool arguments accept null for Groq (gpt-oss sends exercise: null); required ones don't", () => {
  const schema = nullableOptional({ type: "object", properties: { exercise: { type: "string" }, period: { type: "string", enum: ["this_week", "last_week"] }, area: { type: "string" } }, required: ["area"] });
  const properties = schema.properties as Record<string, { type: unknown; enum?: unknown[] }>;
  assert.deepEqual(properties.exercise.type, ["string", "null"]);
  assert.deepEqual(properties.period.enum, ["this_week", "last_week", null]);
  assert.equal(properties.area.type, "string");
  // Every Rozi tool converts cleanly, and the originals (used for Gemini) are untouched.
  for (const tool of ROZI_TOOLS) assert.doesNotThrow(() => nullableOptional(tool.parameters));
  assert.equal((ROZI_TOOLS.find((tool) => tool.name === "get_progress")!.parameters.properties as Record<string, { type: unknown }>).exercise.type, "string");
});
