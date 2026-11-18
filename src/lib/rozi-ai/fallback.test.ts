import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "../demo-data.ts";
import { describeChain, readRoziAiChain } from "./config.ts";
import { askRoziWithFallback, createCooldowns, RoziAiChainError } from "./fallback.ts";
import { RoziAiError, type AiProvider } from "./provider.ts";
import { roziAiProviders } from "./server.ts";
import { selectTools } from "./tool-select.ts";
import { ROZI_TOOLS, roziContext } from "./tools.ts";

const ctx = roziContext({ profile: createDemoState().profile, sessions: [], bodyWeightEntries: [], trainerRuleSettings: undefined, trainerRuleRevision: 1 }, "2026-11-18", 9);

/** A model that answers, or fails with `error`, and counts its calls. */
function model(name: string, outcome: string | RoziAiError) {
  let calls = 0;
  const provider: AiProvider = {
    name: "fake", model: name,
    async generate() {
      calls++;
      if (outcome instanceof RoziAiError) throw outcome;
      return { text: outcome, toolCalls: [], modelTurn: { role: "model", parts: [{ kind: "text", text: outcome }] }, finishReason: "STOP", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, model: name, latencyMs: 3 };
    },
  };
  return { provider, calls: () => calls };
}

const limited = (seconds?: number) => new RoziAiError("rate-limited", "limit", { status: 429, retryable: true, retryAfterSeconds: seconds ?? null });

test("the first model answers when it can; the others aren't touched", async () => {
  const a = model("a", "from A"), b = model("b", "from B");
  const answer = await askRoziWithFallback({ providers: [a.provider, b.provider], ctx, message: "hi" });
  assert.equal(answer.text, "from A");
  assert.equal(answer.fallbackUsed, false);
  assert.equal(b.calls(), 0);
  assert.deepEqual(answer.attempts.map((item) => `${item.model}=${item.outcome}`), ["a=answered"]);
});

test("busy, rate-limited, slow or broken models fall through to the next, in order", async () => {
  for (const error of [limited(), new RoziAiError("unavailable", "busy"), new RoziAiError("timeout", "slow"), new RoziAiError("bad-tool-call", "x"), new RoziAiError("model-not-found", "x"), new RoziAiError("auth", "x")]) {
    const a = model("a", error), b = model("b", "from B"), c = model("c", "from C");
    const answer = await askRoziWithFallback({ providers: [a.provider, b.provider, c.provider], ctx, message: "hi" });
    assert.equal(answer.text, "from B", error.code);
    assert.equal(answer.model, "b");
    assert.equal(answer.fallbackUsed, true);
    assert.equal(c.calls(), 0);
    assert.deepEqual(answer.attempts.map((item) => item.outcome), [error.code, "answered"]);
  }
});

test("a safety block is never routed around", async () => {
  const a = model("a", new RoziAiError("blocked", "blocked")), b = model("b", "from B");
  await assert.rejects(askRoziWithFallback({ providers: [a.provider, b.provider], ctx, message: "x" }), (error) => error instanceof RoziAiChainError && error.code === "blocked");
  assert.equal(b.calls(), 0);
});

test("a model that hit its limit rests, so the next questions skip straight past it", async () => {
  let clock = 1_000_000;
  const now = () => clock;
  const cooldowns = createCooldowns();
  const a = model("a", limited(20)), b = model("b", "from B");
  await askRoziWithFallback({ providers: [a.provider, b.provider], ctx, message: "one", cooldowns, now });
  const second = await askRoziWithFallback({ providers: [a.provider, b.provider], ctx, message: "two", cooldowns, now });
  assert.equal(a.calls(), 1, "A wasn't asked again while resting");
  assert.deepEqual(second.attempts.map((item) => `${item.model}=${item.outcome}`), ["a=resting", "b=answered"]);
  clock += 21_000;
  await askRoziWithFallback({ providers: [a.provider, b.provider], ctx, message: "three", cooldowns, now });
  assert.equal(a.calls(), 2, "after its wait, A is tried first again");
});

test("when every model fails or rests, the error says when to try again", async () => {
  const cooldowns = createCooldowns();
  const a = model("a", limited(30)), b = model("b", limited(50));
  await assert.rejects(askRoziWithFallback({ providers: [a.provider, b.provider], ctx, message: "x", cooldowns }), (error) => error instanceof RoziAiChainError && error.code === "rate-limited" && error.attempts.length === 2);
  await assert.rejects(askRoziWithFallback({ providers: [a.provider, b.provider], ctx, message: "y", cooldowns }), (error) => {
    assert.ok(error instanceof RoziAiChainError);
    assert.equal(error.code, "rate-limited");
    assert.ok(error.retryAfterSeconds !== null && error.retryAfterSeconds <= 30 && error.retryAfterSeconds > 0, "the soonest model's wait");
    assert.deepEqual(error.attempts.map((item) => item.outcome), ["resting", "resting"]);
    return true;
  });
  await assert.rejects(askRoziWithFallback({ providers: [], ctx, message: "z" }), (error) => error instanceof RoziAiError && error.code === "not-configured");
});

test("the time budget stops further models", async () => {
  let clock = 0;
  const slow: AiProvider = { name: "fake", model: "slow", async generate() { clock += 41_000; throw new RoziAiError("timeout", "slow"); } };
  const b = model("b", "from B");
  await assert.rejects(askRoziWithFallback({ providers: [slow, b.provider], ctx, message: "x", now: () => clock }), (error) => error instanceof RoziAiChainError && error.attempts.at(-1)?.outcome === "out-of-time");
  assert.equal(b.calls(), 0);
});

test("ROZI_AI_CHAIN: order kept, keys checked per entry, duplicates and odd entries dropped", () => {
  const env = { ROZI_AI_CHAIN: " groq:openai/gpt-oss-20b, groq:openai/gpt-oss-120b ,gemini:gemini-3.5-flash-lite, groq:openai/gpt-oss-20b, nonsense, openai:gpt-9", GROQ_API_KEY: "gsk", GEMINI_API_KEY: "g" };
  const result = readRoziAiChain(env);
  assert.ok(result.ok);
  assert.deepEqual(result.chain.configs.map((config) => `${config.provider}:${config.model}`), ["groq:openai/gpt-oss-20b", "groq:openai/gpt-oss-120b", "gemini:gemini-3.5-flash-lite"]);
  assert.deepEqual(result.chain.configs.map((config) => config.apiKey), ["gsk", "gsk", "g"]);
  assert.equal(describeChain(result), "groq · openai/gpt-oss-20b → groq · openai/gpt-oss-120b → gemini · gemini-3.5-flash-lite (skipped: nonsense invalid-model; openai:gpt-9 unsupported-provider)");
  const many = readRoziAiChain({ ...env, ROZI_AI_CHAIN: "groq:model-1, groq:model-2, groq:model-3, groq:model-4, groq:model-5" });
  assert.ok(many.ok && many.chain.configs.length === 4 && many.chain.skipped[0].problem === "too-many" && many.chain.skipped[0].entry === "groq:model-5");
  // A provider whose key is missing is skipped, not fatal.
  const noGemini = readRoziAiChain({ ...env, GEMINI_API_KEY: "" });
  assert.ok(noGemini.ok && noGemini.chain.configs.length === 2 && noGemini.chain.skipped.some((item) => item.problem === "missing-key"));
  assert.ok(!describeChain(noGemini).includes("gsk"), "never shows a key");
  // No chain → the single pair.
  const single = readRoziAiChain({ ROZI_AI_PROVIDER: "groq", ROZI_AI_MODEL: "openai/gpt-oss-20b", GROQ_API_KEY: "gsk" });
  assert.ok(single.ok && single.chain.configs.length === 1);
  // Nothing usable → off; an exposed key → refused outright.
  assert.equal(readRoziAiChain({ ROZI_AI_CHAIN: "groq:openai/gpt-oss-20b" }).ok, false);
  assert.deepEqual(readRoziAiChain({ ...env, NEXT_PUBLIC_GROQ_API_KEY: "gsk" }), { ok: false, problem: "exposed-key", skipped: [] });
  const providers = roziAiProviders(env);
  assert.ok(providers.ok && providers.providers.map((provider) => provider.name).join() === "groq,groq,gemini");
});

test("only the tools a question needs are sent; follow-ups and unclear questions get all of them", () => {
  const names = (message: string, history = [] as Array<{ from: "me" | "rozi"; text: string }>) => selectTools(message, history).map((tool) => tool.name);
  assert.deepEqual(names("Is my chest recovered?"), ["get_recovery"]);
  assert.deepEqual(names("Hello, Rozi!"), ["get_my_profile"]);
  assert.deepEqual(names("How do I do a goblet squat?"), ["get_exercise_info"]);
  assert.deepEqual(names("What is my BMI?"), ["get_body_stats", "get_my_profile"]);
  const both = names("What's my workout today, and is my chest recovered enough for it?");
  assert.ok(both.includes("get_workout_for_day") && both.includes("get_recovery"), "two-part questions get both groups");
  assert.ok(names("Plan me a 30 min leg workout").includes("plan_custom_workout"));
  assert.ok(names("Am I getting stronger?").includes("get_progress"));
  assert.ok(names("Which exercise improved most?").includes("get_progress"));
  assert.equal(names("Tell me something nice").length, ROZI_TOOLS.length, "nothing matched → every tool");
  const chat = [{ from: "me" as const, text: "How many workouts this month?" }, { from: "rozi" as const, text: "Three so far!" }];
  assert.equal(names("What about last month?", chat).length, ROZI_TOOLS.length, "follow-up → every tool");
  assert.equal(names("And my legs?", chat).length, ROZI_TOOLS.length, "follow-up → every tool");
  assert.deepEqual(names("Is my chest recovered?", chat), ["get_recovery"], "a clear question stays trimmed in a long chat");
  assert.ok(names("Am I getting stronger?", chat).length < ROZI_TOOLS.length);
  assert.equal(names("ok and?", chat).length, ROZI_TOOLS.length);
  // Fewer tools means far fewer tokens per call.
  const size = (message: string) => JSON.stringify(selectTools(message)).length;
  assert.ok(size("Is my chest recovered?") < JSON.stringify(ROZI_TOOLS).length / 5);
});
