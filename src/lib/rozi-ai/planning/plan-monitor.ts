// ---------- Rozi Level 4 (R9): weekly progress against a goal plan, and replan suggestions ----------
//
// Read-only and deterministic: it compares each week's target with what the person logged that week. When they're
// behind, it suggests a new plan built from what they actually managed. The suggestion is only ever passed to
// propose_goal_plan (which re-checks it and asks for approval); nothing here changes a goal.

import { calculatePersonalRecords } from "../../progress.ts";
import type { RoziContext } from "../tools.ts";
import { GOAL_LIMITS } from "./plan-builder.ts";
import type { GoalStep, RoziGoal } from "./goal-types.ts";

export type WeekState = "met" | "missed" | "no_data" | "in_progress" | "upcoming";
export type GoalState = "on_track" | "behind" | "ahead" | "paused" | "finished";

export interface WeekProgress {
  week: number;
  start: string;
  end: string;
  target: string;
  actual: string | null;
  state: WeekState;
}

export interface GoalProgress {
  title: string;
  state: GoalState;
  /** The week today falls in (1-based); 0 before the start, steps.length + 1 after the end. */
  currentWeek: number;
  weeks: WeekProgress[];
  metWeeks: number;
  finishedWeeks: number;
  /** One plain sentence for the person. */
  summary: string;
  /** When behind: the numbers for a gentler new plan, to pass to propose_goal_plan if the person agrees. */
  suggestion: { why: string; propose: Record<string, unknown> } | null;
}

/** Weight tolerance: weekly weigh-ins bounce around by a few hundred grams. */
const WEIGHT_TOLERANCE = 0.3;

const inWeek = (date: string, step: GoalStep) => date >= step.start && date <= step.end;

function sessionsIn(ctx: RoziContext, step: GoalStep): number {
  return ctx.sessions.filter((session) => session.status === "completed" && inWeek(session.date, step)).length;
}

function lastWeightIn(ctx: RoziContext, step: GoalStep): number | null {
  const entries = ctx.bodyWeightEntries.filter((entry) => inWeek(entry.measuredOn, step));
  return entries.length ? entries[entries.length - 1].weightKg : null;
}

function bestLiftIn(ctx: RoziContext, step: GoalStep, exerciseId: string): number | null {
  const week = ctx.sessions.filter((session) => session.status === "completed" && inWeek(session.date, step));
  return calculatePersonalRecords(week).find((record) => record.exerciseId === exerciseId)?.loadKg ?? null;
}

/** How one finished (or current) week went against its target. */
function weekProgress(goal: RoziGoal, step: GoalStep, ctx: RoziContext): WeekProgress {
  const base = { week: step.week, start: step.start, end: step.end };
  if (ctx.today < step.start) return { ...base, target: step.title, actual: null, state: "upcoming" };
  const current = ctx.today <= step.end;
  const target = goal.target;
  if (target.kind === "consistency") {
    const done = sessionsIn(ctx, step);
    const needed = step.sessions ?? target.sessionsPerWeek;
    const state: WeekState = done >= needed ? "met" : current ? "in_progress" : "missed";
    return { ...base, target: `${needed} workouts`, actual: `${done} done`, state };
  }
  if (target.kind === "strength") {
    const best = bestLiftIn(ctx, step, target.exerciseId);
    const needed = step.liftKg ?? target.targetKg;
    const state: WeekState = best !== null && best >= needed ? "met" : current ? "in_progress" : best === null ? "no_data" : "missed";
    return { ...base, target: `${needed} kg`, actual: best === null ? null : `${best} kg`, state };
  }
  const weight = lastWeightIn(ctx, step);
  const needed = step.weightKg ?? target.targetKg;
  const losing = target.kind === "weight_loss";
  const ok = weight !== null && (losing ? weight <= needed + WEIGHT_TOLERANCE : weight >= needed - WEIGHT_TOLERANCE);
  const state: WeekState = ok ? "met" : current ? "in_progress" : weight === null ? "no_data" : "missed";
  return { ...base, target: `about ${needed} kg`, actual: weight === null ? null : `${weight} kg`, state };
}

/** A gentler plan from what they actually managed (only offered when behind). */
function replanSuggestion(goal: RoziGoal, weeks: WeekProgress[], ctx: RoziContext): GoalProgress["suggestion"] {
  const finished = weeks.filter((week) => week.state === "met" || week.state === "missed" || week.state === "no_data");
  const remaining = Math.max(GOAL_LIMITS.minWeeks, Math.min(GOAL_LIMITS.maxWeeks, goal.steps.length - finished.length + 2));
  const target = goal.target;
  if (target.kind === "consistency") {
    const managed = finished.length ? Math.round(finished.reduce((sum, week) => sum + Number.parseInt(week.actual ?? "0", 10), 0) / finished.length) : 0;
    const sessionsPerWeek = Math.max(GOAL_LIMITS.minSessionsPerWeek, Math.min(target.sessionsPerWeek, managed + 1));
    if (sessionsPerWeek >= target.sessionsPerWeek) {
      return { why: `Keep ${target.sessionsPerWeek} a week as the aim, with ${remaining} more weeks to build up to it.`, propose: { kind: "consistency", sessionsPerWeek: target.sessionsPerWeek, weeks: remaining } };
    }
    return { why: `You've been managing about ${managed} a week; building from ${sessionsPerWeek} is more realistic.`, propose: { kind: "consistency", sessionsPerWeek, weeks: remaining } };
  }
  if (target.kind === "strength") {
    return { why: `Give ${target.exerciseName} more time: the same ${target.targetKg} kg target over ${remaining} weeks, from your best set now.`, propose: { kind: "strength", exercise: target.exerciseName, targetKg: target.targetKg, weeks: remaining } };
  }
  const latest = ctx.bodyWeightEntries.at(-1)?.weightKg ?? null;
  if (latest === null) return null;
  return { why: `Keep ${target.targetKg} kg as the target but give it more time from your weight now (${latest} kg).`, propose: { kind: target.kind, targetKg: target.targetKg } };
}

/** Week-by-week progress of a goal, the overall state, and a suggestion when behind. */
export function goalProgress(goal: RoziGoal, ctx: RoziContext): GoalProgress {
  const weeks = goal.steps.map((step) => weekProgress(goal, step, ctx));
  const finishedWeeks = weeks.filter((week) => week.state === "met" || week.state === "missed" || week.state === "no_data");
  const metWeeks = weeks.filter((week) => week.state === "met").length;
  const current = goal.steps.findIndex((step) => ctx.today >= step.start && ctx.today <= step.end);
  const currentWeek = current >= 0 ? current + 1 : ctx.today < goal.startDate ? 0 : goal.steps.length + 1;
  const lastTwo = finishedWeeks.slice(-2);
  const finished = ctx.today >= goal.endDate || goal.status === "completed";
  const state: GoalState = finished ? "finished"
    : goal.status === "paused" ? "paused"
      : lastTwo.length === 2 && lastTwo.every((week) => week.state !== "met") ? "behind"
        : current >= 0 && weeks[current].state === "met" && finishedWeeks.every((week) => week.state === "met") && finishedWeeks.length > 0 ? "ahead"
          : "on_track";
  const summary = state === "finished" ? `The plan has ended: ${metWeeks} of ${weeks.length} weeks hit their target.`
    : state === "paused" ? "This goal is paused."
      : state === "behind" ? `The last two weeks missed their targets (${metWeeks} of ${finishedWeeks.length} weeks met so far).${goal.target.kind.startsWith("weight") && !ctx.bodyWeightEntries.length ? " Log a weight so progress can be checked." : ""}`
        : state === "ahead" ? "Every week so far has hit its target, and this week's is done already."
          : finishedWeeks.length ? `${metWeeks} of ${finishedWeeks.length} weeks met so far; week ${currentWeek} is under way.` : `Week ${Math.max(1, currentWeek)} is under way.`;
  return {
    title: goal.title, state, currentWeek, weeks, metWeeks, finishedWeeks: finishedWeeks.length, summary,
    suggestion: state === "behind" ? replanSuggestion(goal, weeks, ctx) : null,
  };
}
