// ---------- Rozi Level 4 (R8): goals, server side (propose, approve, status, list) ----------
//
// SERVER ONLY. Same shape as the Level 3 actions: the model can only call propose_goal_plan, whose numbers are
// rebuilt and checked by buildGoalPlan; the plan is recorded with the service role, hash-bound to the person and
// the exact plan; approval and status changes run AS the person through owner-checked database functions.

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiTool } from "../provider.ts";
import type { RoziContext, ToolOutcome } from "../tools.ts";
import { canonicalJson } from "../actions/action-approval.ts";
import { buildGoalPlan, GOAL_LIMITS } from "./plan-builder.ts";
import { GOAL_KINDS, parseGoal, type GoalPlan, type RoziGoal } from "./goal-types.ts";
import { goalProgress } from "./plan-monitor.ts";

/** Goals are switched on per server (ROZI_GOALS=on). Off: Rozi can't propose goals. */
export function goalsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ROZI_GOALS ?? "").trim().toLowerCase() === "on";
}

export const PROPOSE_GOAL_TOOL: AiTool = {
  name: "propose_goal_plan",
  description: `Propose a goal with a weekly plan (${GOAL_LIMITS.minWeeks}–${GOAL_LIMITS.maxWeeks} weeks) when the user asks for one ("help me lose 4 kg", "I want to bench 60 kg", "make me train 4 times a week"). RozFit builds and safety-checks the plan from their data; nothing starts until they tap Approve on the card. Kinds: consistency {sessionsPerWeek}; weight_loss / weight_gain {targetKg}; strength {exercise, targetKg}. Only pass numbers the user gave; leave weeks out unless they said a time. If the result says it isn't possible, explain the reason and offer the suggestion.`,
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...GOAL_KINDS] },
      why: { type: "string", description: "The user's reason, in their words (short)." },
      weeks: { type: "integer" },
      sessionsPerWeek: { type: "integer" },
      targetKg: { type: "number" },
      exercise: { type: "string" },
    },
    required: ["kind"],
  },
};

export const GOAL_PROGRESS_TOOL: AiTool = {
  name: "get_goal_progress",
  description: "The user's current goal and how each week went against its target (workouts, weight or lift), overall state (on_track, behind, ahead, paused, finished) and, when behind, a suggested gentler plan. Use for 'how is my goal going', 'am I on track', 'what's this week's target'. If there's a suggestion, offer it; only if the user agrees, call propose_goal_plan with its numbers.",
  parameters: { type: "object", properties: {} },
};

/** Runs get_goal_progress for the person's live goal (read-only). */
export function goalProgressOutcome(goal: RoziGoal | null, ctx: RoziContext): ToolOutcome {
  if (!goal) return { result: { hasGoal: false, note: "No active goal. Offer to set one if they want." } };
  const progress = goalProgress(goal, ctx);
  return {
    result: {
      hasGoal: true, title: progress.title, state: progress.state, summary: progress.summary,
      week: progress.currentWeek, ofWeeks: goal.steps.length, endDate: goal.endDate,
      thisWeek: progress.weeks.find((week) => week.state === "in_progress") ?? null,
      weeks: progress.weeks.filter((week) => week.state !== "upcoming").map(({ week, target, actual, state }) => ({ week, target, actual, state })),
      suggestion: progress.suggestion,
    },
    card: { type: "goal_progress", progress: { title: progress.title, state: progress.state, summary: progress.summary, currentWeek: progress.currentWeek, endDate: goal.endDate, weeks: progress.weeks } },
  };
}

/**
 * The person's live goal (active or paused), or one that finished in the last 14 days (so Rozi can sum it up), or null.
 * `today` is the person's date (YYYY-MM-DD).
 */
export async function loadLiveGoal(userClient: SupabaseClient, today: string): Promise<RoziGoal | null> {
  const goals = await listGoals(userClient, 10);
  if (!goals) return null;
  const live = goals.find((goal) => goal.status === "active" || goal.status === "paused");
  if (live) return live;
  const recent = new Date(`${today}T00:00:00Z`);
  recent.setUTCDate(recent.getUTCDate() - 14);
  return goals.find((goal) => goal.status === "completed" && goal.endDate >= recent.toISOString().slice(0, 10)) ?? null;
}

/** Ties an approval to one person and one exact plan. */
export function planHash(userId: string, plan: GoalPlan): string {
  return createHash("sha256").update(`${userId}\ngoal\n${canonicalJson(plan)}`).digest("hex");
}

export interface GoalProblem { problem: string }
export const isGoalProblem = (value: RoziGoal | GoalProblem): value is GoalProblem => "problem" in value;

/** Runs the propose_goal_plan tool: build + check → hash → record. The card carries the goal for approval. */
export async function proposeGoal(deps: { service: SupabaseClient; userId: string; ctx: RoziContext; conversationId: string | null }, args: Record<string, unknown>): Promise<ToolOutcome> {
  const built = buildGoalPlan(args, deps.ctx);
  if (!built.ok) return { result: { proposed: false, reason: built.reason, ...(built.suggestion ? { suggestion: built.suggestion } : {}) } };
  const plan = built.plan;
  const hash = planHash(deps.userId, plan);
  const { data, error } = await deps.service.rpc("rozi_propose_goal", {
    p_user: deps.userId, p_kind: plan.kind, p_title: plan.title, p_reason: plan.reason, p_target: plan.target,
    p_start: plan.startDate, p_end: plan.endDate, p_steps: plan.steps, p_hash: hash, p_conversation: deps.conversationId,
  });
  const goal = error ? null : parseGoal(data);
  if (!goal) return { result: { proposed: false, reason: error?.code === "54000" ? "Too many goals are waiting for approval." : "The plan couldn't be prepared right now." } };
  return {
    result: {
      proposed: true, title: goal.title, weeks: goal.steps.length, endDate: goal.endDate,
      firstWeek: goal.steps[0]?.title ?? null, lastWeek: goal.steps.at(-1)?.title ?? null,
      howItWorks: "Nothing has started. The card shows the weekly plan with Approve and Not now; approving replaces any current goal. Don't say it's set up.",
    },
    card: { type: "goal", goal: { id: goal.id, kind: goal.kind, title: goal.title, reason: goal.reason, status: goal.status, startDate: goal.startDate, endDate: goal.endDate, steps: goal.steps, planHash: goal.planHash, expiresAt: goal.expiresAt } },
  };
}

const problemFor = (code: string | undefined, fallback: string) =>
  code === "22023" ? "That plan was modified. Ask Rozi again." : code === "42501" ? "That goal isn't yours." : fallback;

/** The person approves on the card (their own sign-in). approvedNow is true only for the approving call. */
export async function approveGoal(userClient: SupabaseClient, goalId: string, hash: string): Promise<RoziGoal | GoalProblem> {
  const { data, error } = await userClient.rpc("rozi_approve_goal", { p_goal: goalId, p_hash: hash });
  if (error) return { problem: problemFor(error.code, "It couldn't be approved right now.") };
  return parseGoal(data) ?? { problem: "It couldn't be approved right now." };
}

export const GOAL_STATUS_ACTIONS = ["reject", "pause", "resume", "cancel"] as const;
export type GoalStatusAction = (typeof GOAL_STATUS_ACTIONS)[number];

export async function setGoalStatus(userClient: SupabaseClient, goalId: string, action: GoalStatusAction): Promise<RoziGoal | GoalProblem> {
  const { data, error } = await userClient.rpc("rozi_set_goal_status", { p_goal: goalId, p_action: action });
  if (error) return { problem: problemFor(error.code, "It couldn't be changed right now.") };
  return parseGoal(data) ?? { problem: "It couldn't be changed right now." };
}

export async function listGoals(userClient: SupabaseClient, limit = 20): Promise<RoziGoal[] | null> {
  const { data, error } = await userClient.rpc("rozi_my_goals", { p_limit: limit });
  if (error || !Array.isArray(data)) return null;
  return data.map(parseGoal).filter((item): item is RoziGoal => item !== null);
}
