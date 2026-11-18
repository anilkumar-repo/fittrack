import assert from "node:assert/strict";
import test from "node:test";
import { createGeminiProvider, type GeminiClient, type GeminiParams, type GeminiResponse } from "./gemini-provider.ts";
import { RoziAiError, type AiRequest } from "./provider.ts";

const CONFIG = { provider: "gemini" as const, model: "gemini-3.8-flash", apiKey: "test-key-not-real" };

/** A stand-in for the SDK: records the call and answers with `reply` (or throws it). */
function fakeClient(reply: GeminiResponse | (() => Promise<GeminiResponse>)) {
  const calls: GeminiParams[] = [];
  const client: GeminiClient = {
    models: {
      async generateContent(params) {
        calls.push(params);
        return typeof reply === "function" ? reply() : reply;
      },
    },
  };
  return { client, calls };
}

const ASK: AiRequest = {
  system: "You are Rozi.",
  turns: [{ role: "user", parts: [{ kind: "text", text: "What's my workout today?" }] }],
};

test("sends the system rules, the conversation and the limits to the configured model", async () => {
  const { client, calls } = fakeClient({ candidates: [{ content: { parts: [{ text: "Push day!" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3, totalTokenCount: 15 } });
  const result = await createGeminiProvider(CONFIG, client).generate({ ...ASK, maxOutputTokens: 200 });
  assert.equal(result.text, "Push day!");
  assert.equal(result.finishReason, "STOP");
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 3, totalTokens: 15 });
  assert.equal(result.model, "gemini-3.8-flash");
  const sent = calls[0];
  assert.equal(sent.model, "gemini-3.8-flash");
  assert.equal(sent.config.systemInstruction, "You are Rozi.");
  assert.equal(sent.config.maxOutputTokens, 200);
  assert.deepEqual(sent.config.thinkingConfig, { thinkingLevel: "LOW" }, "fast thinking by default");
  assert.deepEqual(sent.contents, [{ role: "user", parts: [{ text: "What's my workout today?" }] }]);
  assert.ok(sent.config.abortSignal instanceof AbortSignal);
  assert.ok(!JSON.stringify(sent).includes("test-key-not-real"), "the key is never part of the request body");
});

test("tools go out as function declarations, and tool calls and results round-trip", async () => {
  const { client, calls } = fakeClient({ candidates: [{ content: { parts: [{ functionCall: { id: "c1", name: "get_today_workout", args: {} } }] }, finishReason: "STOP" }] });
  const provider = createGeminiProvider(CONFIG, client);
  const result = await provider.generate({
    ...ASK,
    tools: [{ name: "get_today_workout", description: "Today's planned workout", parameters: { type: "object", properties: {} } }],
  });
  assert.deepEqual(result.toolCalls, [{ id: "c1", name: "get_today_workout", args: {} }]);
  assert.equal(result.text, "");
  assert.deepEqual(calls[0].config.tools, [{ functionDeclarations: [{ name: "get_today_workout", description: "Today's planned workout", parametersJsonSchema: { type: "object", properties: {} } }] }]);

  await provider.generate({
    ...ASK,
    turns: [
      ...ASK.turns,
      { role: "model", parts: [{ kind: "tool-call", id: "c1", name: "get_today_workout", args: {} }] },
      { role: "user", parts: [{ kind: "tool-result", id: "c1", name: "get_today_workout", result: { title: "Push B" } }] },
    ],
  });
  assert.deepEqual(calls[1].contents.slice(1), [
    { role: "model", parts: [{ functionCall: { id: "c1", name: "get_today_workout", args: {} } }] },
    { role: "user", parts: [{ functionResponse: { id: "c1", name: "get_today_workout", response: { title: "Push B" } } }] },
  ]);
});

test("JSON answers are requested with a schema", async () => {
  const { client, calls } = fakeClient({ candidates: [{ content: { parts: [{ text: "{\"intent\":\"TODAY_WORKOUT\"}" }] } }] });
  await createGeminiProvider(CONFIG, client).generate({ ...ASK, jsonSchema: { type: "object" } });
  assert.equal(calls[0].config.responseMimeType, "application/json");
  assert.deepEqual(calls[0].config.responseJsonSchema, { type: "object" });
});

test("the model's private thinking is never shown as Rozi's answer", async () => {
  const { client } = fakeClient({ candidates: [{ content: { parts: [{ text: "Let me think…", thought: true }, { text: "Rest day today." }] } }] });
  assert.equal((await createGeminiProvider(CONFIG, client).generate(ASK)).text, "Rest day today.");
});

async function failure(reply: GeminiResponse | (() => Promise<GeminiResponse>), timeoutMs?: number): Promise<RoziAiError> {
  const { client } = fakeClient(reply);
  try {
    await createGeminiProvider(CONFIG, client, timeoutMs).generate(ASK);
  } catch (error) {
    assert.ok(error instanceof RoziAiError);
    assert.ok(!error.message.includes("test-key-not-real"));
    return error;
  }
  throw new Error("expected a failure");
}

test("API failures become safe, typed errors", async () => {
  const withStatus = (status: number) => () => Promise.reject(Object.assign(new Error(`raw server text with secrets ${status}`), { status }));
  assert.equal((await failure(withStatus(401))).code, "auth");
  assert.equal((await failure(withStatus(403))).code, "auth");
  const missing = await failure(withStatus(404));
  assert.equal(missing.code, "model-not-found");
  assert.match(missing.message, /ROZI_AI_MODEL/);
  const limited = await failure(withStatus(429));
  assert.equal(limited.code, "rate-limited");
  assert.equal(limited.retryable, true);
  const busy = await failure(withStatus(503));
  assert.equal(busy.code, "unavailable");
  assert.match(busy.message, /busy/);
  assert.equal((await failure(withStatus(500))).code, "unavailable");
  assert.equal((await failure(withStatus(400))).code, "bad-request");
  const network = await failure(() => Promise.reject(new TypeError("fetch failed")));
  assert.equal(network.code, "unavailable");
  assert.ok(!network.message.includes("raw server text"));
});

test("a slow model times out instead of hanging Rozi", async () => {
  const error = await failure(() => new Promise(() => undefined), 30);
  assert.equal(error.code, "timeout");
  assert.equal(error.retryable, true);
});

test("blocked and empty answers are reported, not shown", async () => {
  assert.equal((await failure({ promptFeedback: { blockReason: "SAFETY" } })).code, "blocked");
  assert.equal((await failure({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] })).code, "blocked");
  assert.equal((await failure({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] })).code, "empty");
});

test("thinking can be left to the model or raised", async () => {
  const { client, calls } = fakeClient({ candidates: [{ content: { parts: [{ text: "ok" }] } }] });
  const provider = createGeminiProvider(CONFIG, client);
  await provider.generate({ ...ASK, thinking: "default" });
  await provider.generate({ ...ASK, thinking: "high" });
  assert.equal(calls[0].config.thinkingConfig, undefined);
  assert.deepEqual(calls[1].config.thinkingConfig, { thinkingLevel: "HIGH" });
});

test("Gemini 3 thought signatures come back on the model turn and are sent back unchanged", async () => {
  const { client, calls } = fakeClient({ candidates: [{ content: { parts: [
    { text: "private", thought: true },
    { functionCall: { id: "c1", name: "get_streak", args: {} }, thoughtSignature: "sig-abc" },
  ] } }] });
  const provider = createGeminiProvider(CONFIG, client);
  const first = await provider.generate(ASK);
  assert.deepEqual(first.modelTurn, { role: "model", parts: [{ kind: "tool-call", id: "c1", name: "get_streak", args: {}, signature: "sig-abc" }] });
  await provider.generate({ ...ASK, turns: [...ASK.turns, first.modelTurn, { role: "user", parts: [{ kind: "tool-result", id: "c1", name: "get_streak", result: { current: 3 } }] }] });
  assert.deepEqual(calls[1].contents[1], { role: "model", parts: [{ functionCall: { id: "c1", name: "get_streak", args: {} }, thoughtSignature: "sig-abc" }] });
});
