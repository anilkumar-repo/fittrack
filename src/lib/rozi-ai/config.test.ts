import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODEL, DEFAULT_MODELS, describeConfig, readRoziAiConfig } from "./config.ts";
import { roziAiProvider } from "./server.ts";

const KEY = "test-key-not-real";

test("a key and the defaults give a Gemini config", () => {
  const result = readRoziAiConfig({ GEMINI_API_KEY: ` ${KEY} ` });
  assert.deepEqual(result, { ok: true, config: { provider: "gemini", model: DEFAULT_MODEL, apiKey: KEY } });
  assert.equal(DEFAULT_MODEL, "gemini-3.8-flash");
});

test("the model and provider come from the environment", () => {
  const result = readRoziAiConfig({ GEMINI_API_KEY: KEY, ROZI_AI_PROVIDER: "Gemini", ROZI_AI_MODEL: "gemini-4-argon" });
  assert.ok(result.ok && result.config.model === "gemini-4-argon");
});

test("a missing key turns Rozi AI off (no crash)", () => {
  assert.deepEqual(readRoziAiConfig({}), { ok: false, problem: "missing-key" });
  assert.deepEqual(readRoziAiConfig({ GEMINI_API_KEY: "   " }), { ok: false, problem: "missing-key" });
  assert.deepEqual(roziAiProvider({}), { ok: false, problem: "missing-key" });
});

test("a key under a NEXT_PUBLIC_ name is refused, because it would reach every browser", () => {
  assert.deepEqual(readRoziAiConfig({ GEMINI_API_KEY: KEY, NEXT_PUBLIC_GEMINI_API_KEY: KEY }), { ok: false, problem: "exposed-key" });
  assert.deepEqual(readRoziAiConfig({ NEXT_PUBLIC_GOOGLE_API_KEY: KEY }), { ok: false, problem: "exposed-key" });
  // An empty leftover variable is fine.
  assert.equal(readRoziAiConfig({ GEMINI_API_KEY: KEY, NEXT_PUBLIC_GEMINI_API_KEY: "" }).ok, true);
});

test("other providers and odd model names are refused", () => {
  assert.deepEqual(readRoziAiConfig({ GEMINI_API_KEY: KEY, ROZI_AI_PROVIDER: "openai" }), { ok: false, problem: "unsupported-provider" });
  assert.deepEqual(readRoziAiConfig({ GEMINI_API_KEY: KEY, ROZI_AI_MODEL: "Gemini 3.8 Flash" }), { ok: false, problem: "invalid-model" });
  assert.deepEqual(readRoziAiConfig({ GEMINI_API_KEY: KEY, ROZI_AI_MODEL: "../../models x" }), { ok: false, problem: "invalid-model" });
});

test("the description never contains the key", () => {
  const text = describeConfig(readRoziAiConfig({ GEMINI_API_KEY: KEY }));
  assert.equal(text, "gemini · gemini-3.8-flash · key set");
  assert.ok(!text.includes(KEY));
  assert.equal(describeConfig(readRoziAiConfig({})), "Rozi AI off: missing-key");
});

test("Groq: its own key and default model; Gemini settings stay intact", () => {
  const env = { GEMINI_API_KEY: KEY, GROQ_API_KEY: "gsk-test", ROZI_AI_PROVIDER: "groq" };
  assert.deepEqual(readRoziAiConfig(env), { ok: true, config: { provider: "groq", model: DEFAULT_MODELS.groq, apiKey: "gsk-test" } });
  assert.equal(DEFAULT_MODELS.groq, "openai/gpt-oss-120b");
  assert.deepEqual(readRoziAiConfig({ ...env, ROZI_AI_MODEL: "qwen/qwen3.8-27b" }), { ok: true, config: { provider: "groq", model: "qwen/qwen3.8-27b", apiKey: "gsk-test" } });
  assert.deepEqual(readRoziAiConfig({ GEMINI_API_KEY: KEY, ROZI_AI_PROVIDER: "groq" }), { ok: false, problem: "missing-key" }, "Groq never borrows the Gemini key");
  assert.equal((readRoziAiConfig({ ...env, ROZI_AI_PROVIDER: "gemini", ROZI_AI_MODEL: "" }) as { config: { model: string } }).config.model, "gemini-3.8-flash");
  assert.equal(DEFAULT_MODEL, "gemini-3.8-flash", "the default provider is still Gemini");
});

test("an explicit choice (used by the benchmark) overrides the environment", () => {
  const env = { GEMINI_API_KEY: KEY, GROQ_API_KEY: "gsk-test", ROZI_AI_PROVIDER: "groq", ROZI_AI_MODEL: "openai/gpt-oss-120b" };
  const chosen = readRoziAiConfig(env, { provider: "gemini", model: "gemini-3.5-flash-lite" });
  assert.ok(chosen.ok && chosen.config.provider === "gemini" && chosen.config.model === "gemini-3.5-flash-lite" && chosen.config.apiKey === KEY);
  const provider = roziAiProvider(env);
  assert.ok(provider.ok && provider.provider.name === "groq" && provider.provider.model === "openai/gpt-oss-120b");
});

test("a Groq key under a NEXT_PUBLIC_ name is refused too; odd model paths are refused", () => {
  assert.deepEqual(readRoziAiConfig({ GROQ_API_KEY: "gsk", ROZI_AI_PROVIDER: "groq", NEXT_PUBLIC_GROQ_API_KEY: "gsk" }), { ok: false, problem: "exposed-key" });
  assert.deepEqual(readRoziAiConfig({ GROQ_API_KEY: "gsk", ROZI_AI_PROVIDER: "groq", ROZI_AI_MODEL: "openai/../../x" }), { ok: false, problem: "invalid-model" });
  assert.deepEqual(readRoziAiConfig({ GROQ_API_KEY: "gsk", ROZI_AI_PROVIDER: "groq", ROZI_AI_MODEL: "https://evil.example/x" }), { ok: false, problem: "invalid-model" });
});
