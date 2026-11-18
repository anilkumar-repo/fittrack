// Live check of the Rozi AI connection: `npm run rozi:ping`.
// Reads GEMINI_API_KEY / ROZI_AI_PROVIDER / ROZI_AI_MODEL from .env.local. Sends only made-up test text (no account
// data) and never prints the key. Exits with 1 if anything fails.

import { describeConfig, readRoziAiConfig } from "../src/lib/rozi-ai/config.ts";
import { providerFor } from "../src/lib/rozi-ai/server.ts";
import { RoziAiError } from "../src/lib/rozi-ai/provider.ts";

// Optional: --provider groq --model openai/gpt-oss-20b (otherwise .env.local decides).
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const config = readRoziAiConfig(process.env, { provider: flag("provider"), model: flag("model") });
console.log(describeConfig(config));
if (!config.ok) {
  console.log(config.problem === "missing-key" ? "Add the provider's API key (GEMINI_API_KEY or GROQ_API_KEY) to .env.local, then run again." : "Fix the setting above, then run again.");
  process.exit(1);
}

const provider = providerFor(config.config);
try {
  // 1. Plain answer.
  const hello = await provider.generate({
    system: "You are Rozi, a friendly fitness buddy. Answer in one short sentence.",
    turns: [{ role: "user", parts: [{ kind: "text", text: "Say hello and tell me you're online." }] }],
  });
  console.log(`✔ answer (${hello.latencyMs} ms, ${hello.usage?.totalTokens ?? "?"} tokens): ${hello.text}`);

  // 2. Tool calling: the model should ask for today's workout instead of making one up.
  const tools = [{ name: "get_today_workout", description: "Returns the user's planned workout for today from the app.", parameters: { type: "object", properties: {} } }];
  const ask = await provider.generate({
    system: "You are Rozi. Never invent workout data; use the tools to look it up.",
    turns: [{ role: "user", parts: [{ kind: "text", text: "What's my workout today?" }] }],
    tools,
  });
  const call = ask.toolCalls[0];
  if (!call) throw new Error(`expected a tool call, got text: ${ask.text}`);
  console.log(`✔ tool call: ${call.name}(${JSON.stringify(call.args)})`);
  const reply = await provider.generate({
    system: "You are Rozi. Never invent workout data; use the tools to look it up. Answer in one or two short sentences.",
    turns: [
      { role: "user", parts: [{ kind: "text", text: "What's my workout today?" }] },
      ask.modelTurn,
      { role: "user", parts: [{ kind: "tool-result", id: call.id, name: call.name, result: { title: "Sample day · Test", moves: ["Squat", "Push-up", "Plank"], minutes: 30 } }] },
    ],
    tools,
  });
  console.log(`✔ answer from tool data (${reply.latencyMs} ms): ${reply.text}`);
  console.log(`Model ${reply.model} works with tools. Rozi AI is ready for the next stage.`);
} catch (error) {
  if (error instanceof RoziAiError) console.log(`✖ ${error.code}${error.status ? ` (${error.status})` : ""}: ${error.message}`);
  else console.log(`✖ ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}
