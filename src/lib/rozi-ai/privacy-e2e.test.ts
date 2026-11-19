// End to end through the real handler, tools and fallback chain (only the model and the database are fakes):
// nothing that identifies the person — display name, @username, bio, account id, sign-in token, email, phone number,
// or a provider key — reaches any AI provider request or the server log, even when the model runs every tool.

import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "../demo-data.ts";
import type { OwnTrainingData } from "../supabase-repository";
import { handleRoziChat, type RoziChatDeps } from "./handler.ts";
import type { AiProvider, AiRequest } from "./provider.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { ROZI_TOOLS } from "./tools.ts";

const SECRETS = {
  userId: "5f1c0a3e-7d42-4b8e-9a61-0c2d3e4f5a6b",
  token: "eyJhbGciOiJIUzI1NiJ9.private-session-token",
  displayName: "Zebulon Quartermaine",
  username: "zq_lifts_private",
  bio: "Bio text nobody else should see",
  email: "zebulon.q@example.com",
  phone: "+91 98765 43210",
  phoneDigits: "9876543210",
  apiKey: "gsk_test_key_should_never_leave_the_server",
};

const CONV = "11111111-2222-4333-8444-555555555555";

function data(): OwnTrainingData {
  const demo = createDemoState();
  return {
    profile: { ...demo.profile, id: SECRETS.userId, displayName: SECRETS.displayName, username: SECRETS.username, bio: SECRETS.bio, birthYear: 1990, timeZone: "Asia/Kolkata" },
    sessions: demo.sessions, bodyWeightEntries: demo.bodyWeightEntries, trainerRuleSettings: undefined, trainerRuleRevision: 1,
  };
}

/**
 * A model that asks for every tool it was offered that hasn't run yet (5 per round, over the allowed rounds — so every
 * tool result is checked), then answers.
 */
function greedyModel() {
  const requests: AiRequest[] = [];
  const provider: AiProvider = {
    name: "fake", model: "fake-1",
    async generate(request) {
      requests.push(request);
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const ran = new Set(request.turns.flatMap((turn) => turn.parts).filter((part) => part.kind === "tool-result").map((part) => part.name));
      const remaining = (request.tools ?? []).filter((tool) => !ran.has(tool.name)).slice(0, 5);
      if (remaining.length) {
        const calls = remaining.map((tool, index) => ({
          id: `${tool.name}-${index}`, name: tool.name,
          args: tool.name === "get_exercise_info" ? { exercise: "Bench press" } : tool.name === "plan_custom_workout" ? { area: "full_body" } : {},
        }));
        return { text: "", toolCalls: calls, modelTurn: { role: "model", parts: calls.map((call) => ({ kind: "tool-call" as const, ...call })) }, finishReason: "STOP", usage, model: "fake-1", latencyMs: 1 };
      }
      return { text: "Here's your summary.", toolCalls: [], modelTurn: { role: "model", parts: [{ kind: "text", text: "Here's your summary." }] }, finishReason: "STOP", usage, model: "fake-1", latencyMs: 1 };
    },
  };
  return { provider, requests };
}

test("no personal identifiers reach the AI provider or the logs, even when every tool runs", async () => {
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = SECRETS.apiKey;
  try {
    const fake = greedyModel();
    const logs: Array<Record<string, unknown>> = [];
    const deps: RoziChatDeps = {
      session: async (token) => (token === SECRETS.token ? {
        userId: SECRETS.userId,
        loadData: async () => data(),
        history: {
          // An earlier turn in which the person typed their contact details.
          load: async () => [{ from: "me", text: `my email is ${SECRETS.email}` }, { from: "rozi", text: "Thanks! Let's train." }],
          start: async () => ({ kind: "ok", conversationId: CONV }),
          saveAiReply: async () => true,
        },
      } : null),
      providers: () => ({ ok: true, providers: [fake.provider] }),
      limiter: createRateLimiter(),
      now: () => new Date("2026-11-18T09:00:00Z"),
      log: (entry) => logs.push(entry),
    };
    // A follow-up question, so every tool is offered; it also contains a phone number and an email.
    const result = await handleRoziChat({ token: SECRETS.token, body: { message: `And what about that? Call me on ${SECRETS.phone} or ${SECRETS.email}`, consent: true, conversationId: CONV } }, deps);

    assert.equal(result.status, 200);
    assert.equal(fake.requests.length, 4, "three rounds of tools, then the answer");
    const offered = fake.requests[0].tools?.map((tool) => tool.name) ?? [];
    assert.deepEqual([...offered].sort(), ROZI_TOOLS.map((tool) => tool.name).sort(), "every tool was offered and run");
    const toolResults = fake.requests.at(-1)!.turns.flatMap((turn) => turn.parts).filter((part) => part.kind === "tool-result");
    assert.equal(toolResults.length, ROZI_TOOLS.length, "every tool returned a result to the model");

    const sentToProvider = JSON.stringify(fake.requests);
    const logged = JSON.stringify(logs);
    for (const [label, secret] of Object.entries(SECRETS)) {
      assert.ok(!sentToProvider.includes(secret), `${label} was sent to the AI provider`);
      assert.ok(!logged.includes(secret), `${label} was written to the log`);
    }
    assert.ok(sentToProvider.includes("[email]") && sentToProvider.includes("[phone]"), "contact details were masked, not dropped silently");
    assert.ok(!logged.includes("Call me"), "the log has no message text");
  } finally {
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});
