// ---------- Rozi AI: one question, answered ----------
//
// The model reads the question (and recent chat), asks for the facts it needs through the tools, and writes Rozi's
// reply from the tools' results. RozFit's code builds the cards from those same results.

import type { RoziCard } from "./cards.ts";
import { historyTurns, replyLanguageHint, roziSystemPrompt, type ChatLine } from "./prompt.ts";
import { RoziAiError, type AiProvider, type AiTool, type AiTurn, type AiUsage } from "./provider.ts";
import { ROZI_TOOLS, runRoziTool, type RoziContext, type ToolOutcome } from "./tools.ts";

/** What the question was about (for history and analytics), from the first tool Rozi used. */
export type RoziAiIntent =
  | "TODAY_WORKOUT" | "NEXT_WORKOUT" | "LAST_WORKOUT" | "WORKOUT_HISTORY" | "WEEKLY_WORKOUT_COUNT" | "MONTHLY_WORKOUT_COUNT"
  | "MUSCLE_HISTORY" | "MUSCLE_RECOVERY" | "PROGRESS_CHECK" | "EXERCISE_PROGRESS" | "WORKOUT_REASON" | "EXERCISE_EXPLANATION"
  | "BODY_GOAL_PROGRESS" | "WEEKLY_REPORT" | "STREAK_STATUS" | "ACHIEVEMENT_STATUS" | "MOBILITY_RECOMMENDATION" | "PLAN_WORKOUT"
  | "PROFILE" | "EXERCISE_SWAP" | "PROPOSED_CHANGE" | "GENERAL_FITNESS_QUESTION";

export function intentOf(tool: string | undefined, args: Record<string, unknown> = {}): RoziAiIntent {
  switch (tool) {
    case "get_workout_for_day": return args.day && args.day !== "today" ? "WORKOUT_HISTORY" : "TODAY_WORKOUT";
    case "get_next_workout": return "NEXT_WORKOUT";
    case "get_workout_history":
      if (args.muscle) return "MUSCLE_HISTORY";
      if (args.period === "last_workout") return "LAST_WORKOUT";
      if (args.period === "this_week" || args.period === "last_week") return "WEEKLY_WORKOUT_COUNT";
      if (args.period === "this_month" || args.period === "last_month") return "MONTHLY_WORKOUT_COUNT";
      return "WORKOUT_HISTORY";
    case "get_progress": return args.exercise ? "EXERCISE_PROGRESS" : "PROGRESS_CHECK";
    case "get_recovery": return "MUSCLE_RECOVERY";
    case "get_streak": return "STREAK_STATUS";
    case "get_weekly_report": return "WEEKLY_REPORT";
    case "get_body_stats": return "BODY_GOAL_PROGRESS";
    case "get_exercise_info": return "EXERCISE_EXPLANATION";
    case "get_mobility_suggestion": return "MOBILITY_RECOMMENDATION";
    case "get_achievements": return "ACHIEVEMENT_STATUS";
    case "plan_custom_workout": return "PLAN_WORKOUT";
    case "get_my_profile": return "PROFILE";
    case "propose_action": return "PROPOSED_CHANGE";
    case "suggest_exercise_swap": return "EXERCISE_SWAP";
    default: return "GENERAL_FITNESS_QUESTION";
  }
}

/** At most this many rounds of tool calls before Rozi must answer. */
export const MAX_TOOL_ROUNDS = 3;
/** At most this many tool calls in one round. */
const MAX_CALLS_PER_ROUND = 5;
/** At most this many cards under one reply. */
const MAX_CARDS = 3;
/** Rozi's reply is cut to this many characters. */
export const MAX_REPLY_CHARS = 1200;

export interface RoziAnswer {
  text: string;
  cards: RoziCard[];
  intent: RoziAiIntent;
  toolsUsed: string[];
  usage: AiUsage;
  model: string;
  latencyMs: number;
}

export interface AskRoziInput {
  provider: AiProvider;
  ctx: RoziContext;
  /** The new question (already validated for length by the caller). */
  message: string;
  /** Recent chat lines, oldest first, for follow-ups ("and last week?"). */
  history?: ChatLine[];
  signal?: AbortSignal;
  /** The tools to offer (default: all of them). See selectTools. */
  tools?: AiTool[];
  /**
   * Extra server-side tools (e.g. propose_action when actions are on). They're offered with the others and run
   * here instead of runRoziTool; they can't change anything by themselves (see actions/action-service.ts).
   */
  extraTools?: { tools: AiTool[]; run: (name: string, args: Record<string, unknown>) => Promise<ToolOutcome> };
}

/** Answers one question. Throws a RoziAiError if the model fails; the caller then answers on the device. */
export async function askRozi({ provider, ctx, message, history = [], signal, tools: baseTools = ROZI_TOOLS, extraTools }: AskRoziInput): Promise<RoziAnswer> {
  const tools = extraTools ? [...baseTools, ...extraTools.tools.filter((tool) => !baseTools.some((item) => item.name === tool.name))] : baseTools;
  const extraNames = new Set(extraTools?.tools.map((tool) => tool.name) ?? []);
  const system = roziSystemPrompt(ctx.today, ctx.hour, replyLanguageHint(message));
  const turns: AiTurn[] = [...historyTurns(history), { role: "user", parts: [{ kind: "text", text: message }] }];
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const cards: RoziCard[] = [];
  const toolsUsed: string[] = [];
  let intent: RoziAiIntent | null = null;
  let latencyMs = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await provider.generate({ system, turns, tools, signal });
    latencyMs += result.latencyMs;
    if (result.usage) {
      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;
      usage.totalTokens += result.usage.totalTokens;
    }
    if (!result.toolCalls.length || round === MAX_TOOL_ROUNDS) {
      const text = result.text.trim().slice(0, MAX_REPLY_CHARS);
      if (!text) throw new RoziAiError("empty", "Rozi couldn't put an answer together.", { retryable: true });
      return { text, cards, intent: intent ?? "GENERAL_FITNESS_QUESTION", toolsUsed, usage, model: result.model, latencyMs };
    }
    // Run the tools the model asked for, then send their results back with the model's own turn (and signatures).
    const calls = result.toolCalls.slice(0, MAX_CALLS_PER_ROUND);
    turns.push(result.modelTurn);
    const results = await Promise.all(calls.map(async (call) => {
      // Arguments that weren't valid JSON: don't guess — tell the model so it can call again properly.
      if (call.invalidArgs !== undefined) {
        return { kind: "tool-result" as const, ...(call.id ? { id: call.id } : {}), name: call.name, result: { error: "The arguments were not valid JSON. Call the tool again with a valid JSON object." } };
      }
      const outcome = extraTools && extraNames.has(call.name)
        ? await extraTools.run(call.name, call.args).catch(() => ({ result: { error: "That couldn't be done right now." } }) as ToolOutcome)
        : runRoziTool(call.name, call.args, ctx);
      toolsUsed.push(call.name);
      intent ??= intentOf(call.name, call.args);
      if (outcome.card && cards.length < MAX_CARDS) cards.push(outcome.card);
      return { kind: "tool-result" as const, ...(call.id ? { id: call.id } : {}), name: call.name, result: outcome.result };
    }));
    turns.push({ role: "user", parts: results });
  }
  throw new RoziAiError("empty", "Rozi couldn't put an answer together.", { retryable: true });
}
