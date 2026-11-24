// ---------- Rozi Level 4 (R8): building and checking a goal plan (SERVER) ----------
//
// Fixed templates per goal kind. The model passes only the numbers the person gave (kind, target, weeks, why); this
// code reads the person's own data, applies the safety limits and builds every weekly step. A plan that breaks a
// limit is refused with a reason Rozi can explain, or a safer number to suggest. Nothing here writes anything.

import { isDeadliftVariation } from "../../exercise-library.ts";
import { calculatePersonalRecords } from "../../progress.ts";
import { shiftDate } from "../../dates.ts";
import { isLifting, trackingOf } from "../../tracking.ts";
import { findExercise, type RoziContext } from "../tools.ts";
import { GOAL_KINDS, type GoalKind, type GoalPlan, type GoalStep } from "./goal-types.ts";

/** Safety limits (also in docs/ROZI_AGENT_ARCHITECTURE.md §7). */
export const GOAL_LIMITS = {
  minWeeks: 4,
  maxWeeks: 12,
  maxSessionsPerWeek: 6,
  minSessionsPerWeek: 2,
  /** Fastest safe change, as a share of current body weight per week. */
  lossPerWeek: 0.01,
  gainPerWeek: 0.005,
  minTargetBmi: 18.5,
  /** Weight logs older than this don't count as "current". */
  weightMaxAgeDays: 30,
  /** Strength: up to +2.5% a week, +20% overall, from the best logged working set. */
  liftPerWeek: 0.025,
  liftMax: 0.2,
} as const;

export type BuildResult = { ok: true; plan: GoalPlan } | { ok: false; reason: string; suggestion?: string };

type Args = Record<string, unknown>;
const num = (args: Args, key: string): number | null => (typeof args[key] === "number" && Number.isFinite(args[key]) ? (args[key] as number) : null);
const str = (args: Args, key: string, max = 80): string => (typeof args[key] === "string" ? (args[key] as string).trim().slice(0, max) : "");
const round = (value: number, step: number) => Math.round(value / step) * step;
const fix = (value: number) => Math.round(value * 10) / 10;

function weeksFrom(args: Args, fallback: number): number | null {
  const weeks = num(args, "weeks") ?? fallback;
  return Number.isInteger(weeks) && weeks >= GOAL_LIMITS.minWeeks && weeks <= GOAL_LIMITS.maxWeeks ? weeks : null;
}

/** Week n (1-based) of a plan starting on `start`: 7 days. */
function weekDates(start: string, week: number): { start: string; end: string } {
  return { start: shiftDate(start, (week - 1) * 7), end: shiftDate(start, week * 7 - 1) };
}

/** Workouts completed in the 28 days before today, per week. */
function recentSessionsPerWeek(ctx: RoziContext): number {
  const since = shiftDate(ctx.today, -28);
  return ctx.sessions.filter((session) => session.status === "completed" && session.date >= since && session.date < ctx.today).length / 4;
}

function latestWeight(ctx: RoziContext): number | null {
  const latest = ctx.bodyWeightEntries.at(-1);
  if (!latest || latest.measuredOn < shiftDate(ctx.today, -GOAL_LIMITS.weightMaxAgeDays)) return null;
  return latest.weightKg;
}

function consistencyPlan(args: Args, ctx: RoziContext, weeks: number): BuildResult {
  const target = num(args, "sessionsPerWeek");
  if (target === null || !Number.isInteger(target) || target < GOAL_LIMITS.minSessionsPerWeek || target > GOAL_LIMITS.maxSessionsPerWeek) {
    return { ok: false, reason: `Ask how many workouts a week they want (${GOAL_LIMITS.minSessionsPerWeek}–${GOAL_LIMITS.maxSessionsPerWeek}).` };
  }
  const days = ctx.profile.trainingDays.length;
  if (target > days) return { ok: false, reason: `Their plan has ${days} training days a week. They need to add days in Settings → Your plan before aiming for ${target}.` };
  // Start from what they do now (+1 at most) and add one workout every two weeks until the target.
  const now = Math.round(recentSessionsPerWeek(ctx));
  const first = Math.max(GOAL_LIMITS.minSessionsPerWeek, Math.min(target, now + 1));
  const steps: GoalStep[] = Array.from({ length: weeks }, (_, index) => {
    const sessions = Math.min(target, first + Math.floor(index / 2));
    return { week: index + 1, ...weekDates(ctx.today, index + 1), title: `Train ${sessions} times`, sessions };
  });
  return { ok: true, plan: { kind: "consistency", title: `Train ${target} times a week`, reason: "", target: { kind: "consistency", sessionsPerWeek: target }, startDate: ctx.today, endDate: shiftDate(ctx.today, weeks * 7), steps } };
}

function weightPlan(kind: "weight_loss" | "weight_gain", args: Args, ctx: RoziContext, weeksArg: number | null): BuildResult {
  const targetKg = num(args, "targetKg");
  const fromKg = latestWeight(ctx);
  if (fromKg === null) return { ok: false, reason: "Ask them to log today's weight first (Progress → Body weight); a plan needs a weight from the last 30 days." };
  if (targetKg === null || targetKg < 30 || targetKg > 300) return { ok: false, reason: "Ask for the target weight in kg." };
  const losing = kind === "weight_loss";
  const change = losing ? fromKg - targetKg : targetKg - fromKg;
  if (change <= 0) return { ok: false, reason: losing ? `The target (${targetKg} kg) isn't below their current ${fromKg} kg.` : `The target (${targetKg} kg) isn't above their current ${fromKg} kg.` };
  if (losing) {
    const heightM = (ctx.profile.heightCm ?? 0) / 100;
    if (!heightM) return { ok: false, reason: "Ask for their height first (Settings → Your body) so the target can be checked for safety." };
    const minKg = Math.ceil(GOAL_LIMITS.minTargetBmi * heightM * heightM * 10) / 10;
    if (targetKg < minKg) return { ok: false, reason: `${targetKg} kg would be underweight for their height. RozFit won't plan below ${minKg} kg.`, suggestion: `${minKg} kg` };
  }
  const perWeek = fromKg * (losing ? GOAL_LIMITS.lossPerWeek : GOAL_LIMITS.gainPerWeek);
  const minWeeks = Math.max(GOAL_LIMITS.minWeeks, Math.ceil(change / perWeek));
  if (minWeeks > GOAL_LIMITS.maxWeeks) {
    const reachable = fix(GOAL_LIMITS.maxWeeks * perWeek);
    return { ok: false, reason: `${fix(change)} kg is more than is safe in ${GOAL_LIMITS.maxWeeks} weeks.`, suggestion: `a first goal of ${fix(losing ? fromKg - reachable : fromKg + reachable)} kg in ${GOAL_LIMITS.maxWeeks} weeks` };
  }
  const weeks = weeksArg === null ? minWeeks : weeksArg;
  if (weeks < minWeeks) return { ok: false, reason: `${fix(change)} kg in ${weeks} weeks is faster than is safe.`, suggestion: `${minWeeks} weeks` };
  const sessions = Math.max(GOAL_LIMITS.minSessionsPerWeek, Math.min(GOAL_LIMITS.maxSessionsPerWeek, ctx.profile.trainingDays.length));
  const steps: GoalStep[] = Array.from({ length: weeks }, (_, index) => {
    const weightKg = fix(fromKg + (losing ? -1 : 1) * (change * (index + 1)) / weeks);
    return { week: index + 1, ...weekDates(ctx.today, index + 1), title: `About ${weightKg} kg by the end of the week`, weightKg, sessions };
  });
  return {
    ok: true,
    plan: { kind, title: `${losing ? "Lose" : "Gain"} ${fix(change)} kg (to ${targetKg} kg)`, reason: "", target: { kind, fromKg, targetKg }, startDate: ctx.today, endDate: shiftDate(ctx.today, weeks * 7), steps },
  };
}

function strengthPlan(args: Args, ctx: RoziContext, weeks: number): BuildResult {
  const named = str(args, "exercise");
  const exercise = named ? findExercise(named, ctx) : null;
  if (!exercise) return { ok: false, reason: "Ask which exercise (from RozFit's library) the goal is for." };
  if (!isLifting(trackingOf(exercise))) return { ok: false, reason: `${exercise.name} is timed, not lifted for reps; a strength goal needs a weighted rep exercise.` };
  if (isDeadliftVariation(exercise) && !ctx.profile.deadliftEnabled) return { ok: false, reason: `${exercise.name} needs their trainer's approval first.` };
  const best = calculatePersonalRecords(ctx.sessions.filter((session) => session.status === "completed")).find((record) => record.exerciseId === exercise.id);
  if (!best) return { ok: false, reason: `There's no logged ${exercise.name} set with a weight yet. Ask them to log one workout with it first.` };
  const targetKg = num(args, "targetKg");
  if (targetKg === null || targetKg <= best.loadKg) return { ok: false, reason: `Ask for a target above their best ${exercise.name} set (${best.loadKg} kg × ${best.reps}).` };
  const maxKg = round(best.loadKg * (1 + Math.min(GOAL_LIMITS.liftPerWeek * weeks, GOAL_LIMITS.liftMax)), 0.5);
  if (targetKg > maxKg) return { ok: false, reason: `${targetKg} kg is a bigger jump than is safe in ${weeks} weeks from ${best.loadKg} kg.`, suggestion: `${maxKg} kg` };
  // Rise evenly; weeks 4 and 8 hold the previous weight (lighter weeks for recovery).
  const rising = Array.from({ length: weeks }, (_, index) => index + 1).filter((week) => week !== 4 && week !== 8);
  let last = best.loadKg;
  const steps: GoalStep[] = Array.from({ length: weeks }, (_, index) => {
    const week = index + 1;
    const hold = week === 4 || week === 8;
    if (!hold) last = round(best.loadKg + (targetKg - best.loadKg) * ((rising.indexOf(week) + 1) / rising.length), 0.5);
    return { week, ...weekDates(ctx.today, week), title: hold ? `Hold ${last} kg (lighter week)` : `Work up to ${last} kg`, liftKg: last, ...(hold ? { note: "Recovery week: same weight, fewer hard sets." } : {}) };
  });
  return {
    ok: true,
    plan: { kind: "strength", title: `${exercise.name}: ${targetKg} kg in ${weeks} weeks`, reason: "", target: { kind: "strength", exerciseId: exercise.id, exerciseName: exercise.name, fromKg: best.loadKg, targetKg }, startDate: ctx.today, endDate: shiftDate(ctx.today, weeks * 7), steps },
  };
}

/** Builds and checks a goal plan from the model's numbers and the person's own data. */
export function buildGoalPlan(args: Args, ctx: RoziContext): BuildResult {
  const kind = str(args, "kind", 20) as GoalKind;
  if (!(GOAL_KINDS as readonly string[]).includes(kind)) return { ok: false, reason: "Goals can be: workouts a week, losing or gaining weight, or lifting more on one exercise." };
  const weeksGiven = args.weeks === undefined ? null : weeksFrom(args, 0);
  if (args.weeks !== undefined && weeksGiven === null) return { ok: false, reason: `Plans run ${GOAL_LIMITS.minWeeks}–${GOAL_LIMITS.maxWeeks} weeks.` };
  const built = kind === "consistency" ? consistencyPlan(args, ctx, weeksGiven ?? 6)
    : kind === "strength" ? strengthPlan(args, ctx, weeksGiven ?? 8)
      : weightPlan(kind, args, ctx, weeksGiven);
  if (!built.ok) return built;
  return { ok: true, plan: { ...built.plan, reason: str(args, "why", 300) } };
}
