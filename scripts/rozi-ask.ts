// Live check of Rozi AI end to end with MADE-UP sample data (no account is read):
//   npm run rozi:ask                      → asks a fixed set of questions
//   npm run rozi:ask -- "your question"   → asks one question
// Prints Rozi's reply, the tools used, the cards and timings. Never prints the key.

import { createDemoState } from "../src/lib/demo-data.ts";
import { getExerciseDefinition } from "../src/lib/templates.ts";
import type { Profile, WorkoutSession } from "../src/lib/types";
import { describeChain, readRoziAiChain, readRoziAiConfig, type RoziAiChainResult } from "../src/lib/rozi-ai/config.ts";
import { askRoziWithFallback, createCooldowns, RoziAiChainError } from "../src/lib/rozi-ai/fallback.ts";
import { selectTools } from "../src/lib/rozi-ai/tool-select.ts";
import { providerFor } from "../src/lib/rozi-ai/server.ts";
import { RoziAiError } from "../src/lib/rozi-ai/provider.ts";
import { roziContext } from "../src/lib/rozi-ai/tools.ts";

// Optional: --provider groq --model openai/gpt-oss-20b (otherwise .env.local decides).
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
// Default: the chain from .env.local (ROZI_AI_CHAIN, or the single provider/model). --provider/--model: one model only.
let chain: RoziAiChainResult;
if (flag("provider") || flag("model")) {
  const single = readRoziAiConfig(process.env, { provider: flag("provider"), model: flag("model") });
  chain = single.ok ? { ok: true, chain: { configs: [single.config], skipped: [] } } : { ok: false, problem: single.problem, skipped: [] };
} else chain = readRoziAiChain(process.env);
console.log(describeChain(chain));
if (!chain.ok) process.exit(1);

function session(date: string, moves: Array<[string, number, number | null]>): WorkoutSession {
  return {
    id: `sample-${date}`, date, status: "completed",
    plan: { title: "Sample workout", focus: "Foundation A", durationMinutes: 45, exercises: moves.map(([id]) => getExerciseDefinition(id)!), generationReasons: [] },
    exerciseLogs: moves.map(([id, sets, kg]) => ({ exerciseId: id, plannedSets: sets, plannedReps: 8, status: "completed", substitutionName: "", formQuality: "sound", notes: "",
      sets: Array.from({ length: sets }, () => ({ plannedReps: 8, actualReps: 8, loadKg: kg, completed: true, extra: false })) })),
  } as unknown as WorkoutSession;
}

const today = new Date().toISOString().slice(0, 10);
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const profile: Profile = {
  ...createDemoState().profile, displayName: "Sample", trainingDays: [1, 3, 5], trainingStartDate: ago(60), sessionsPerWeek: 3,
  heightCm: 175, birthYear: 1995, experience: "intermediate", goal: "muscle", equipmentAvailability: "verified",
  availableEquipment: ["dumbbells", "bench", "barbell", "rack", "cable", "machines"] as Profile["availableEquipment"],
};
const ctx = roziContext({
  profile,
  sessions: [session(ago(9), [["barbell_bench", 3, 40], ["seated_row", 3, 30]]), session(ago(5), [["back_squat", 3, 60]]), session(ago(2), [["barbell_bench", 3, 42.5], ["lat_pulldown", 3, 35]])],
  bodyWeightEntries: [{ id: "a", measuredOn: ago(30), weightKg: 78 }, { id: "b", measuredOn: ago(3), weightKg: 76.8 }] as never,
  trainerRuleSettings: undefined, trainerRuleRevision: 1,
}, today, new Date().getHours());

const asked = process.argv.slice(2).filter((value, index, all) => !value.startsWith("--") && !all[index - 1]?.startsWith("--"));
const questions = asked.length ? [asked.join(" ")] : [
  "What's my workout today?",
  "Am I getting stronger at bench press?",
  "Is my chest recovered?",
  "Explain how to do a goblet squat",
  "Plan me a 30 min leg workout",
];

const providers = chain.chain.configs.map(providerFor);
const cooldowns = createCooldowns();
let failed = false;
for (const question of questions) {
  console.log(`\n? ${question}`);
  try {
    const tools = selectTools(question);
    const answer = await askRoziWithFallback({ providers, cooldowns, ctx, message: question, tools });
    console.log(`Rozi (${answer.model}): ${answer.text}`);
    console.log(`  tools offered ${tools.length}, used: ${answer.toolsUsed.join(", ") || "none"} · intent ${answer.intent} · cards ${answer.cards.map((card) => card.type).join(", ") || "none"} · ${answer.latencyMs} ms · ${answer.usage.totalTokens} tokens`);
    console.log(`  tried: ${answer.attempts.map((item) => `${item.model}=${item.outcome}`).join(" → ")}`);
  } catch (error) {
    failed = true;
    console.log(error instanceof RoziAiError ? `  ✖ ${error.code}${error.status ? ` (${error.status})` : ""}: ${error.message}` : `  ✖ ${error instanceof Error ? error.message : "unknown error"}`);
    if (error instanceof RoziAiChainError) console.log(`  tried: ${error.attempts.map((item) => `${item.model}=${item.outcome}`).join(" → ")}`);
  }
}
process.exit(failed ? 1 : 0);
