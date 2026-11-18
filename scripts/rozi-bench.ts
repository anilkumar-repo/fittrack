// Rozi AI benchmark: the same 10 questions, on the same MADE-UP fitness data, against each provider/model.
//   npm run rozi:bench                                  → every model below that has a key
//   npm run rozi:bench -- --only groq:openai/gpt-oss-20b → one model
// Writes docs/ROZI_AI_BENCHMARK.md (results) and prints a summary. Never reads an account; never prints keys.

import { writeFileSync } from "node:fs";
import { createDemoState } from "../src/lib/demo-data.ts";
import { dateLabel, shiftDate, weekdayOf } from "../src/lib/dates.ts";
import { getExerciseDefinition } from "../src/lib/templates.ts";
import type { Profile, WorkoutSession } from "../src/lib/types";
import { readRoziAiConfig } from "../src/lib/rozi-ai/config.ts";
import { askRozi, type RoziAnswer } from "../src/lib/rozi-ai/conversation.ts";
import type { ChatLine } from "../src/lib/rozi-ai/prompt.ts";
import { RoziAiError, type AiProvider, type AiRequest, type AiResult } from "../src/lib/rozi-ai/provider.ts";
import { providerFor } from "../src/lib/rozi-ai/server.ts";
import { roziContext, runRoziTool, type RoziContext } from "../src/lib/rozi-ai/tools.ts";
import { selectTools } from "../src/lib/rozi-ai/tool-select.ts";

// ---------- Models and their published prices (USD per 1M tokens, checked 2026-11-18) ----------

// `skip`: left out of a full run (with the reason); still runnable with --only.
const MODELS: Array<{ provider: "gemini" | "groq"; model: string; price: [number, number] | null; tpm: number | null; skip?: string }> = [
  { provider: "groq", model: "openai/gpt-oss-120b", price: [0.15, 0.6], tpm: 8000 },
  { provider: "groq", model: "openai/gpt-oss-20b", price: [0.075, 0.3], tpm: 8000 },
  { provider: "groq", model: "qwen/qwen3.8-27b", price: [0.8, 4.0], tpm: 8000 },
  { provider: "gemini", model: "gemini-3.8-flash", price: null, tpm: null, skip: "free tier allows 20 requests/day per model (Google 429 GenerateRequestsPerDayPerProjectPerModel-FreeTier: 20); used up" },
  { provider: "gemini", model: "gemini-3.5-flash-lite", price: null, tpm: null },
];

// ---------- Made-up data with known answers ----------

const TODAY = new Date().toISOString().slice(0, 10);

function session(date: string, moves: Array<[string, number, number | null]>, status: "completed" | "skipped" = "completed"): WorkoutSession {
  return {
    id: `bench-${date}`, date, status,
    plan: { title: "Strength day", focus: "Foundation A", durationMinutes: 45, exercises: moves.map(([id]) => getExerciseDefinition(id)!), generationReasons: ["Your Monday–Wednesday–Friday plan."] },
    exerciseLogs: moves.map(([id, sets, kg]) => ({ exerciseId: id, plannedSets: sets, plannedReps: 8, status: status === "skipped" ? "skipped" : "completed", substitutionName: "", formQuality: "sound", notes: "",
      sets: Array.from({ length: sets }, () => ({ plannedReps: 8, actualReps: status === "skipped" ? null : 8, loadKg: kg, completed: status !== "skipped", extra: false })) })),
  } as unknown as WorkoutSession;
}

/** ~10 weeks of Mon/Wed/Fri training before today. Squat climbs most (+15 kg), bench +5, pulldown +5; one skipped day. */
function sampleSessions(): WorkoutSession[] {
  const sessions: WorkoutSession[] = [];
  let index = 0;
  for (let back = 70; back >= 1; back--) {
    const date = shiftDate(TODAY, -back);
    if (![1, 3, 5].includes(weekdayOf(date))) continue;
    const step = Math.floor(index / 3);
    const kind = index % 3;
    if (back === 12) sessions.push(session(date, [["back_squat", 3, null]], "skipped"));
    else if (kind === 0) sessions.push(session(date, [["barbell_bench", 3, Math.min(45, 40 + step * 0.5)], ["lat_pulldown", 3, Math.min(40, 35 + step * 0.5)]]));
    else if (kind === 1) sessions.push(session(date, [["back_squat", 3, Math.min(65, 50 + step * 1.5)], ["machine_shoulder_press", 3, 20]]));
    else sessions.push(session(date, [["barbell_bench", 3, Math.min(45, 40 + step * 0.5)], ["seated_row", 3, 30]]));
    index++;
  }
  return sessions;
}

const profile: Profile = {
  ...createDemoState().profile, id: "bench-user", displayName: "Bench Sample", trainingDays: [1, 3, 5], trainingStartDate: shiftDate(TODAY, -75),
  sessionsPerWeek: 3, heightCm: 176, birthYear: 1993, experience: "intermediate", goal: "muscle", equipmentAvailability: "verified",
  availableEquipment: ["dumbbells", "bench", "barbell", "rack", "cable", "machines"] as Profile["availableEquipment"],
};
const ctx: RoziContext = roziContext({
  profile, sessions: sampleSessions(),
  bodyWeightEntries: [{ id: "a", measuredOn: shiftDate(TODAY, -60), weightKg: 80 }, { id: "b", measuredOn: shiftDate(TODAY, -3), weightKg: 78.4 }] as never,
  trainerRuleSettings: undefined, trainerRuleRevision: 1,
}, TODAY, 10);

// ---------- The questions, the tools we expect, and how we check the answer against the known data ----------

// The tools' results are free-form JSON for the model; this dev script reads a few known fields from them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- benchmark-only reading of tool JSON
const truth = (tool: string, args: Record<string, unknown> = {}) => runRoziTool(tool, args, ctx).result as Record<string, any>;
const today = truth("get_workout_for_day", { day: "today" });
const last = truth("get_workout_history", { period: "last_workout" }).lastWorkout;
const chest = truth("get_recovery", { muscle: "chest" }).groups[0];
const lastMonth = truth("get_workout_history", { period: "last_month" });
const best = truth("get_progress", {}).biggestImprovements[0];
const dayWords = (date: string) => [dateLabel(date, { month: "long", day: "numeric" }), dateLabel(date, { month: "short", day: "numeric" }), dateLabel(date, { weekday: "long" }), date];
/** Models write typographic characters (gpt-oss: non-breaking hyphens and narrow spaces); compare plain text. */
const plain = (text: string) => text.normalize("NFKC").replace(/[\u2010-\u2015\u2212]/g, "-").replace(/[\u00a0\u2007\u202f\u2009]/g, " ").toLowerCase();
const mentionsAny = (answer: string, words: string[]) => words.some((word) => plain(answer).includes(plain(String(word))));

interface Case {
  id: number;
  question: string;
  history?: ChatLine[];
  /** Tools that must be used (all of them); [] = no tool should be needed. */
  expect: string[];
  check: (answer: string) => boolean;
  truth: string;
}

const CASES: Case[] = [
  { id: 1, question: "Hello, Rozi!", expect: [], check: (a) => a.length > 0, truth: "A greeting; no data needed." },
  { id: 2, question: "Explain progressive overload.", expect: [], check: (a) => /gradual|increas|more weight|more reps|harder/i.test(a), truth: "General explanation." },
  { id: 3, question: "What is my workout today?", expect: ["get_workout_for_day"], truth: today.restDay ? "Rest day" : `${today.title}: ${today.exercises.map((e: { name: string }) => e.name).slice(0, 3).join(", ")}`,
    check: (a) => today.restDay ? /rest/i.test(a) : mentionsAny(a, [today.title.split(" · ")[0], ...today.exercises.map((e: { name: string }) => e.name)]) },
  { id: 4, question: "Show my last workout.", expect: ["get_workout_history"], truth: `${last.date}: ${last.moves.join(", ")}`,
    check: (a) => mentionsAny(a, [...dayWords(last.date), ...last.moves]) },
  { id: 5, question: "Am I getting stronger?", expect: ["get_progress"], truth: `Yes — e.g. ${best.exercise} ${best.fromKg} → ${best.toKg} kg`,
    check: (a) => /yes|absolutely|definitely|stronger|\bup\b|improv|increas|gain|went from|\+\d/i.test(a) && /\d/.test(a) },
  { id: 6, question: "Is my chest recovered?", expect: ["get_recovery"], truth: `Chest: ${chest.status} (ready on ${chest.readyOn ?? "now"})`,
    check: (a) => chest.status === "Ready" ? /ready|recovered|yes|good to go/i.test(a) : /not|recover|rest|tomorrow|wait|almost|fresh|just trained/i.test(a) },
  { id: 7, question: "What about last month?", history: [{ from: "me", text: "How many workouts did I do this month?" }, { from: "rozi", text: "You've completed several workouts this month — nice consistency!" }],
    expect: ["get_workout_history"], truth: `Last month: ${lastMonth.completed} completed`, check: (a) => a.includes(String(lastMonth.completed)) },
  { id: 8, question: "Which exercise improved most?", expect: ["get_progress"], truth: `${best.exercise}: ${best.fromKg} → ${best.toKg} kg (+${best.changeKg})`,
    check: (a) => /squat/i.test(a) },
  { id: 9, question: "What's my workout today, and is my chest recovered enough for it?", expect: ["get_workout_for_day", "get_recovery"], truth: "Both today's plan and chest recovery",
    check: (a) => /chest/i.test(a) && (today.restDay ? /rest/i.test(a) : mentionsAny(a, [today.title.split(" · ")[0], ...today.exercises.map((e: { name: string }) => e.name), "workout"])) },
  { id: 10, question: "Can you book me a table at a restaurant tonight?", expect: [], truth: "Politely declines (off-topic).",
    check: (a) => /can't|cannot|can not|not able|unable|only|fitness|workout|sorry/i.test(a) },
];

// ---------- Running ----------

interface CallLog { inputTokens: number; outputTokens: number; latencyMs: number; invalidArgs: number; toolCalls: string[]; remainingTokens: number | null }

/** Records every model call (tokens, latency, tool calls, malformed arguments). */
function recording(provider: AiProvider, log: CallLog[]): AiProvider {
  return {
    name: provider.name, model: provider.model,
    async generate(request: AiRequest): Promise<AiResult> {
      const result = await provider.generate(request);
      log.push({
        inputTokens: result.usage?.inputTokens ?? 0, outputTokens: result.usage?.outputTokens ?? 0, latencyMs: result.latencyMs,
        invalidArgs: result.toolCalls.filter((call) => call.invalidArgs !== undefined).length, toolCalls: result.toolCalls.map((call) => call.name),
        remainingTokens: result.limits?.remainingTokens ?? null,
      });
      return result;
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Row {
  id: number; ok: boolean; error: string | null; tools: string[]; rightTools: boolean; correct: boolean; latencyMs: number;
  inputTokens: number; outputTokens: number; calls: number; invalidArgs: number; rateLimited: number; answer: string;
}

async function runModel(entry: typeof MODELS[number]): Promise<{ entry: typeof MODELS[number]; rows: Row[]; skipped?: string }> {
  const config = readRoziAiConfig(process.env, { provider: entry.provider, model: entry.model });
  if (!config.ok) return { entry, rows: [], skipped: config.problem };
  const base = providerFor(config.config);
  const rows: Row[] = [];
  for (const item of CASES) {
    const log: CallLog[] = [];
    let answer: RoziAnswer | null = null;
    let error: string | null = null;
    let rateLimited = 0;
    const started = Date.now();
    for (let attempt = 1; attempt <= 2 && !answer; attempt++) {
      try {
        // Same as the app: only the tools this question can need.
        answer = await askRozi({ provider: recording(base, log), ctx, message: item.question, history: item.history, tools: selectTools(item.question, item.history) });
        error = null;
      } catch (failure) {
        error = failure instanceof RoziAiError ? `${failure.code}${failure.status ? ` ${failure.status}` : ""}` : "error";
        if (failure instanceof RoziAiError && failure.code === "rate-limited") {
          rateLimited++;
          const wait = failure.retryAfterSeconds;
          if (attempt === 1 && wait !== null && wait <= 65) { await sleep((wait + 1) * 1000); continue; }
        }
        break;
      }
    }
    const tools = answer?.toolsUsed ?? [];
    // Only an answered question can have used the right tools.
    const rightTools = Boolean(answer) && (item.expect.length ? item.expect.every((tool) => tools.includes(tool)) : tools.length === 0 || item.id === 1);
    const text = plain(answer?.text ?? "");
    const row: Row = {
      id: item.id, ok: Boolean(answer), error, tools, rightTools, correct: Boolean(answer) && item.check(text),
      latencyMs: answer ? log.reduce((sum, call) => sum + call.latencyMs, 0) : Date.now() - started,
      inputTokens: log.reduce((sum, call) => sum + call.inputTokens, 0), outputTokens: log.reduce((sum, call) => sum + call.outputTokens, 0),
      calls: log.length, invalidArgs: log.reduce((sum, call) => sum + call.invalidArgs, 0), rateLimited, answer: text.replace(/\s+/g, " ").slice(0, 220),
    };
    rows.push(row);
    console.log(`  ${entry.model} Q${item.id} ${row.ok ? "✔" : "✖"} ${row.error ?? ""} tools=[${tools.join(",")}] right=${row.rightTools} correct=${row.correct} ${row.latencyMs}ms ${row.inputTokens}/${row.outputTokens} tok`);
    // Stay under the tokens-per-minute limit: spread this question's tokens over a minute's share.
    if (entry.tpm) await sleep(Math.min(75_000, Math.ceil(((row.inputTokens + row.outputTokens) / entry.tpm) * 60_000 * 1.3)));
  }
  return { entry, rows };
}

const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex > 0 ? process.argv[onlyIndex + 1] : null;
const chosen = only ? MODELS.filter((entry) => `${entry.provider}:${entry.model}` === only) : MODELS;
const results: Array<Awaited<ReturnType<typeof runModel>>> = [];
for (const entry of chosen) {
  if (entry.skip && !only) { results.push({ entry, rows: [], skipped: entry.skip }); continue; }
  console.log(`\n▶ ${entry.provider} · ${entry.model}`);
  results.push(await runModel(entry));
}

// ---------- Report ----------

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const lines: string[] = [
  "# Rozi AI benchmark",
  "",
  `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC with \`npm run rozi:bench\`. Same 10 questions, same made-up data (10 weeks of Mon/Wed/Fri training; squat improved most), same tools and rules for every model, and — like the app — each question is offered only the tools it can need (selectTools). No account data.`,
  "",
  "| Provider · model | Answered | Tool calls valid | Right tools | Correct answer | Avg latency | Tokens in / out (total) | Cost (listed price) | Rate-limit hits |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
for (const { entry, rows, skipped } of results) {
  if (skipped) { lines.push(`| ${entry.provider} · ${entry.model} | skipped (${skipped}) | | | | | | | |`); continue; }
  const answered = rows.filter((row) => row.ok);
  const calls = rows.reduce((sum, row) => sum + row.calls, 0);
  const invalid = rows.reduce((sum, row) => sum + row.invalidArgs, 0);
  const input = rows.reduce((sum, row) => sum + row.inputTokens, 0);
  const output = rows.reduce((sum, row) => sum + row.outputTokens, 0);
  const cost = entry.price ? `$${((input * entry.price[0] + output * entry.price[1]) / 1_000_000).toFixed(4)}` : "free tier";
  const avg = answered.length ? Math.round(answered.reduce((sum, row) => sum + row.latencyMs, 0) / answered.length) : 0;
  lines.push(`| ${entry.provider} · ${entry.model} | ${answered.length}/10 | ${pct(calls - invalid, calls)} (${invalid} malformed) | ${rows.filter((row) => row.rightTools).length}/10 | ${rows.filter((row) => row.correct).length}/10 | ${(avg / 1000).toFixed(1)} s | ${input} / ${output} (${input + output}) | ${cost} | ${rows.reduce((sum, row) => sum + row.rateLimited, 0)} |`);
}
lines.push("", "Correct answer = the reply matches the known fact for that question (checked automatically, see the truth column). Right tools = every expected tool was used (and none for questions 1, 2 and 10).", "");
for (const { entry, rows } of results) {
  if (!rows.length) continue;
  lines.push(`## ${entry.provider} · ${entry.model}`, "", "| # | Question | Truth | Tools used | ✔ tools | ✔ answer | Time | Reply |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const item = CASES.find((entry2) => entry2.id === row.id)!;
    lines.push(`| ${row.id} | ${item.question} | ${item.truth.replace(/\|/g, "/")} | ${row.tools.join(", ") || "—"} | ${row.rightTools ? "✔" : "✖"} | ${row.correct ? "✔" : "✖"} | ${(row.latencyMs / 1000).toFixed(1)} s | ${row.ok ? row.answer.replace(/\|/g, "/") : `✖ ${row.error}`} |`);
  }
  lines.push("");
}
writeFileSync("docs/ROZI_AI_BENCHMARK.md", `${lines.join("\n")}\n`);
console.log(`\n${lines.slice(4, 5 + results.length + 1).join("\n")}\n\nWrote docs/ROZI_AI_BENCHMARK.md`);
