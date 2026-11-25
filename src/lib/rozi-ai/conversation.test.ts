import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "../demo-data.ts";
import { getExerciseDefinition } from "../templates.ts";
import type { Profile, WorkoutSession } from "../types";
import { askRozi, intentOf, MAX_REPLY_CHARS, MAX_TOOL_ROUNDS } from "./conversation.ts";
import { historyTurns, replyLanguageHint, roziSystemPrompt } from "./prompt.ts";
import { RoziAiError, type AiProvider, type AiRequest, type AiResult } from "./provider.ts";
import { ROZI_TOOLS, roziContext } from "./tools.ts";

function session(date: string, id: string, kg: number): WorkoutSession {
  return {
    id: `s-${date}`, date, status: "completed",
    plan: { title: `Workout ${date}`, focus: "Foundation A", durationMinutes: 40, exercises: [getExerciseDefinition(id)!], generationReasons: [] },
    exerciseLogs: [{ exerciseId: id, plannedSets: 3, plannedReps: 8, status: "completed", substitutionName: "", formQuality: "sound", notes: "",
      sets: Array.from({ length: 3 }, () => ({ plannedReps: 8, actualReps: 8, loadKg: kg, completed: true, extra: false })) }],
  } as unknown as WorkoutSession;
}

const profile: Profile = { ...createDemoState().profile, displayName: "Secret Person", trainingDays: [1, 3, 5], trainingStartDate: "2026-10-01" };
const ctx = roziContext({ profile, sessions: [session("2026-11-09", "barbell_bench", 40), session("2026-11-16", "barbell_bench", 42.5)], bodyWeightEntries: [], trainerRuleSettings: undefined, trainerRuleRevision: 1 }, "2026-11-18", 18);

type Step = Partial<AiResult> | Error;

/** A scripted model: answers each call with the next step, and records every request. */
function scripted(steps: Step[]) {
  const requests: AiRequest[] = [];
  const provider: AiProvider = {
    name: "fake", model: "fake-model",
    async generate(request) {
      requests.push(structuredClone({ ...request, signal: undefined }));
      const step = steps.shift() ?? { text: "" };
      if (step instanceof Error) throw step;
      const toolCalls = step.toolCalls ?? [];
      return {
        text: step.text ?? "", toolCalls, finishReason: "STOP", model: "fake-model", latencyMs: 10,
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        modelTurn: step.modelTurn ?? { role: "model", parts: toolCalls.length ? toolCalls.map((call) => ({ kind: "tool-call" as const, ...call, signature: "sig" })) : [{ kind: "text" as const, text: step.text ?? "" }] },
      };
    },
  };
  return { provider, requests };
}

test("Rozi asks for the facts, gets them from the app, and answers from them", async () => {
  const { provider, requests } = scripted([
    { toolCalls: [{ id: "c1", name: "get_progress", args: { exercise: "bench press" } }] },
    { text: "Yes! Your bench went from 40 to 42.5 kg. 💪" },
  ]);
  const answer = await askRozi({ provider, ctx, message: "Am I getting stronger at bench?" });
  assert.equal(answer.text, "Yes! Your bench went from 40 to 42.5 kg. 💪");
  assert.equal(answer.intent, "EXERCISE_PROGRESS");
  assert.deepEqual(answer.toolsUsed, ["get_progress"]);
  assert.equal(answer.cards[0]?.type, "progress");
  assert.deepEqual(answer.usage, { inputTokens: 200, outputTokens: 40, totalTokens: 240 });
  assert.equal(answer.latencyMs, 20);

  // Second call: the model's own turn (with its signature) and the real tool result went back.
  const second = requests[1].turns;
  assert.deepEqual(second[1], { role: "model", parts: [{ kind: "tool-call", id: "c1", name: "get_progress", args: { exercise: "bench press" }, signature: "sig" }] });
  const result = second[2].parts[0] as { kind: string; name: string; result: { heaviestChangeKg: number } };
  assert.equal(result.kind, "tool-result");
  assert.equal(result.result.heaviestChangeKg, 2.5);
  // Every call offers the tools and Rozi's rules; nothing personal is in the rules.
  assert.ok(requests.every((request) => request.tools?.length === ROZI_TOOLS.length && ROZI_TOOLS.length === 15));
  assert.ok(!requests[0].system.includes("Secret Person"));
});

test("a general question can be answered without tools", async () => {
  const { provider } = scripted([{ text: "Aim for 7–9 hours of sleep to recover well." }]);
  const answer = await askRozi({ provider, ctx, message: "How much sleep do I need?" });
  assert.equal(answer.intent, "GENERAL_FITNESS_QUESTION");
  assert.deepEqual(answer.cards, []);
});

test("recent chat goes along for follow-ups, trimmed", async () => {
  const { provider, requests } = scripted([{ text: "Last week you did 2 workouts." }]);
  const history = Array.from({ length: 12 }, (_, index) => ({ from: index % 2 ? "rozi" as const : "me" as const, text: `line ${index} ${"x".repeat(900)}` }));
  await askRozi({ provider, ctx, message: "and last week?", history });
  const turns = requests[0].turns;
  assert.equal(turns.length, 9, "8 earlier lines + the new question");
  assert.equal(turns[0].role, "user");
  assert.ok((turns[0].parts[0] as { text: string }).text.length <= 600);
  assert.deepEqual(turns.at(-1), { role: "user", parts: [{ kind: "text", text: "and last week?" }] });
});

test("several tools in one round all run, and cards are capped at three", async () => {
  const { provider } = scripted([
    { toolCalls: [{ name: "get_streak", args: {} }, { name: "get_weekly_report", args: { week: "this" } }, { name: "get_recovery", args: {} }, { name: "get_achievements", args: {} }] },
    { text: "Great week!" },
  ]);
  const answer = await askRozi({ provider, ctx, message: "How am I doing?" });
  assert.deepEqual(answer.toolsUsed, ["get_streak", "get_weekly_report", "get_recovery", "get_achievements"]);
  assert.equal(answer.cards.length, 3);
  assert.equal(answer.intent, "STREAK_STATUS");
});

test("a model that keeps calling tools is stopped", async () => {
  const loop = Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => ({ toolCalls: [{ name: "get_streak", args: {} }] }));
  const { provider, requests } = scripted(loop);
  await assert.rejects(askRozi({ provider, ctx, message: "streak?" }), (error) => error instanceof RoziAiError && error.code === "empty");
  assert.equal(requests.length, MAX_TOOL_ROUNDS + 1);
});

test("model failures reach the caller as RoziAiError (so it can answer on the device)", async () => {
  const { provider } = scripted([new RoziAiError("rate-limited", "quota", { status: 429, retryable: true })]);
  await assert.rejects(askRozi({ provider, ctx, message: "hi" }), (error) => error instanceof RoziAiError && error.code === "rate-limited");
  const empty = scripted([{ text: "   " }]);
  await assert.rejects(askRozi({ provider: empty.provider, ctx, message: "hi" }), (error) => error instanceof RoziAiError && error.code === "empty");
});

test("very long replies are cut", async () => {
  const { provider } = scripted([{ text: "a".repeat(5000) }]);
  assert.equal((await askRozi({ provider, ctx, message: "tell me everything" })).text.length, MAX_REPLY_CHARS);
});

test("intents follow the tool and its arguments", () => {
  assert.equal(intentOf("get_workout_history", { period: "last_workout" }), "LAST_WORKOUT");
  assert.equal(intentOf("get_workout_history", { period: "this_month" }), "MONTHLY_WORKOUT_COUNT");
  assert.equal(intentOf("get_workout_history", { muscle: "legs" }), "MUSCLE_HISTORY");
  assert.equal(intentOf("get_workout_for_day", { day: "today" }), "TODAY_WORKOUT");
  assert.equal(intentOf("get_progress", {}), "PROGRESS_CHECK");
  assert.equal(intentOf("plan_custom_workout", { area: "legs" }), "PLAN_WORKOUT");
  assert.equal(intentOf(undefined), "GENERAL_FITNESS_QUESTION");
});

test("Rozi's rules carry the date and the safety lines, and no personal details", () => {
  const prompt = roziSystemPrompt("2026-11-18", 7);
  assert.match(prompt, /Wednesday, November 18/);
  assert.match(prompt, /07:00/);
  assert.match(prompt, /must come from the tools/);
  assert.match(prompt, /don't diagnose/);
  assert.match(prompt, /emergency/);
  assert.match(prompt, /Deadlift variations need the user's trainer's approval/);
  assert.deepEqual(historyTurns([{ from: "me", text: "  " }, { from: "rozi", text: "Hi!" }]), [{ role: "model", parts: [{ kind: "text", text: "Hi!" }] }]);
});

test("English and Indian-script questions get an explicit reply language; others keep the general rule", () => {
  for (const message of ["Am I getting stronger at bench press?", "Explain how to do a goblet squat", "What's my workout today?", "hi"]) assert.equal(replyLanguageHint(message), "English", message);
  assert.equal(replyLanguageHint("నా వ్యాయామం ఏమిటి?"), "Telugu");
  assert.equal(replyLanguageHint("నా BMI ఎంత?"), "Telugu", "an English word inside doesn't change it");
  assert.equal(replyLanguageHint("मेरा वर्कआउट क्या है?"), "Hindi");
  assert.equal(replyLanguageHint("माझा आजचा वर्कआउट काय आहे?"), "Marathi");
  assert.equal(replyLanguageHint("என் உடற்பயிற்சி என்ன?"), "Tamil");
  for (const message of ["¿Cómo hago una sentadilla?", "Squat 100 kg", "我的训练是什么？"]) assert.equal(replyLanguageHint(message), null, message);
  assert.match(roziSystemPrompt("2026-11-18", 9, "English"), /latest message is in English: reply in English, never in another language/);
  assert.match(roziSystemPrompt("2026-11-18", 9, "Telugu"), /reply in Telugu \(in its own script; exercise names may stay in English\)/);
  assert.match(roziSystemPrompt("2026-11-18", 9), /Reply in the language the user writes in/);
});
