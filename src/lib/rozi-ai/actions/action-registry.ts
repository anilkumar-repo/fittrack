// ---------- Rozi actions: what each action does (builders) and how its result is checked (verifiers) ----------
//
// Builders run on the server with the person's own data (RoziContext). They turn the model's loose request
// ({ exercise: "bench" }) into the EXACT change, using FitTrack's existing logic (exercise-swap, rozi-plan,
// onboarding options, trainer/equipment rules) — or refuse with a reason. Verifiers re-read the person's data after
// the app applied the change and confirm it really happened. Both are pure, so they're tested without a database.

import { ACTIVITY_OPTIONS, FOCUS_OPTIONS } from "../../onboarding.ts";
import { GOAL_OPTIONS, goalTitle } from "../../program.ts";
import { planWorkout } from "../../rozi-plan.ts";
import { canUseExercise, findInWorkout, findNamedExercise, swapBlock, SWAP_BLOCK_TEXT } from "../../exercise-swap.ts";
import { generateWorkout } from "../../planner.ts";
import { getExerciseDefinition } from "../../templates.ts";
import type { BodyWeightEntry, TrainingGoal, WorkoutSession } from "../../types";
import type { RoziContext } from "../tools.ts";
import type { ActionPayload, ActionSummary, ActionType, PreferenceChanges } from "./action-types.ts";

export type BuildResult = { ok: true; payload: ActionPayload; summary: ActionSummary } | { ok: false; reason: string };
type Input = Record<string, unknown>;

const str = (input: Input, key: string, max = 80) => (typeof input[key] === "string" ? (input[key] as string).trim().slice(0, max) : "");
const num = (input: Input, key: string) => { const value = Number(input[key]); return Number.isFinite(value) ? value : null; };
const PLAN_AREAS = ["legs", "glutes", "chest", "back", "shoulders", "arms", "push", "pull", "upper_body", "lower_body", "full_body", "core"];

function todaysWorkout(ctx: RoziContext): { session: WorkoutSession | undefined; exercises: WorkoutSession["plan"]["exercises"] } {
  const session = ctx.sessions.find((item) => item.date === ctx.today);
  const plan = session?.plan ?? generateWorkout({ date: ctx.today, profile: ctx.profile, sessions: ctx.sessions, trainerRuleSettings: ctx.trainerRuleSettings, trainerRuleRevision: ctx.trainerRuleRevision });
  return { session, exercises: plan?.exercises ?? [] };
}

function buildSwap(ctx: RoziContext, input: Input): BuildResult {
  const { session, exercises } = todaysWorkout(ctx);
  if (!exercises.length) return { ok: false, reason: "Today is a rest day, so there's nothing to swap." };
  const from = findInWorkout(exercises, str(input, "exercise"));
  if (!from) return { ok: false, reason: `"${str(input, "exercise")}" isn't in today's workout (${exercises.map((item) => item.name).join(", ")}).` };
  const blocked = swapBlock(session, session && session.status !== "planned" ? session.plan : { ...(session?.plan ?? {}), exercises } as WorkoutSession["plan"], from.id);
  if (blocked) return { ok: false, reason: SWAP_BLOCK_TEXT[blocked] };
  const to = findNamedExercise(str(input, "replacement"), ctx.planningProfile);
  if (!to) return { ok: false, reason: "Say which exercise to do instead (or use suggest_exercise_swap to show choices)." };
  if (to.id === from.id || exercises.some((item) => item.id === to.id)) return { ok: false, reason: `${to.name} is already in today's workout.` };
  if (!canUseExercise(to, ctx.planningProfile)) return { ok: false, reason: `${to.name} needs equipment or a trainer approval this person doesn't have.` };
  return {
    ok: true,
    payload: { type: "swap_exercise", date: ctx.today, fromId: from.id, toId: to.id },
    summary: { title: `Swap ${from.name} for ${to.name}`, why: str(input, "why", 200), changes: [`Today: ${to.name} instead of ${from.name}`, `Keeps ${from.sets} × ${from.reps}`] },
  };
}

function buildPlan(ctx: RoziContext, input: Input, kind: "start_plan_today" | "save_routine"): BuildResult {
  const area = str(input, "area").toLowerCase().replace(/[\s-]+/g, "_");
  if (!PLAN_AREAS.includes(area)) return { ok: false, reason: `Choose an area: ${PLAN_AREAS.join(", ")}.` };
  const minutes = num(input, "minutes");
  const plan = planWorkout(`plan a ${area.replace("_", " ")} workout${minutes ? ` ${Math.min(90, Math.max(15, Math.round(minutes)))} min` : ""}`, ctx.planningProfile);
  if (!plan) return { ok: false, reason: "No suitable moves with this person's equipment." };
  const names = plan.routine.exercises.map((item) => getExerciseDefinition(item.exerciseId)?.name ?? item.exerciseId);
  if (kind === "save_routine") {
    return { ok: true, payload: { type: "save_routine", name: plan.routine.name, exercises: plan.routine.exercises }, summary: { title: `Save “${plan.routine.name}” to My routines`, why: str(input, "why", 200), changes: names.map((name, index) => `${name} · ${plan.routine.exercises[index].sets} × ${plan.routine.exercises[index].reps}`) } };
  }
  const today = ctx.sessions.find((item) => item.date === ctx.today);
  if (today && today.status !== "planned") return { ok: false, reason: today.status === "completed" ? "Today's workout is already done — save it as a routine for another day instead." : "A workout is already in progress today." };
  return { ok: true, payload: { type: "start_plan_today", date: ctx.today, plan }, summary: { title: `Make “${plan.routine.name}” today's workout`, why: str(input, "why", 200), changes: [`Replaces today's planned workout${today ? ` (${today.plan.title})` : ""}`, ...names.map((name, index) => `${name} · ${plan.routine.exercises[index].sets} × ${plan.routine.exercises[index].reps}`)] } };
}

function buildPreferences(ctx: RoziContext, input: Input): BuildResult {
  const changes: PreferenceChanges = {};
  const lines: string[] = [];
  const goal = str(input, "goal").toLowerCase();
  if (goal) {
    const option = GOAL_OPTIONS.find((item) => item.id === goal || item.title.toLowerCase() === goal);
    if (!option) return { ok: false, reason: `Goal must be one of: ${GOAL_OPTIONS.map((item) => item.id).join(", ")}.` };
    if (ctx.profile.buddyAnchor) return { ok: false, reason: "In Train together, the goal is shared — propose it to your buddies in Friends → Train together." };
    if ((ctx.profile.goal ?? "general") !== option.id) { changes.goal = option.id as TrainingGoal; lines.push(`Goal: ${goalTitle((ctx.profile.goal ?? "general") as TrainingGoal)} → ${option.title}`); }
  }
  const minutes = num(input, "sessionMinutes");
  if (minutes !== null) {
    const rounded = Math.round(minutes / 5) * 5;
    if (rounded < 20 || rounded > 90) return { ok: false, reason: "Session length must be 20–90 minutes." };
    if (rounded !== ctx.profile.preferredSessionMinutes) { changes.preferredSessionMinutes = rounded; lines.push(`Session length: ${ctx.profile.preferredSessionMinutes} → ${rounded} min`); }
  }
  const focus = str(input, "focusArea").toLowerCase();
  if (focus) {
    const option = FOCUS_OPTIONS.find((item) => item.id === focus || item.label.toLowerCase() === focus);
    if (!option) return { ok: false, reason: `Focus must be one of: ${FOCUS_OPTIONS.map((item) => item.id).join(", ")}.` };
    if ((ctx.profile.focusArea ?? "balanced") !== option.id) { changes.focusArea = option.id; lines.push(`Focus muscle: ${option.label}`); }
  }
  const day = str(input, "typicalDay").toLowerCase().replace(/[\s-]+/g, "_");
  if (day) {
    const option = ACTIVITY_OPTIONS.find((item) => item.id === day || item.label.toLowerCase().replace(/\s+/g, "_") === day);
    if (!option) return { ok: false, reason: `Typical day must be one of: ${ACTIVITY_OPTIONS.map((item) => item.id).join(", ")}.` };
    if (ctx.profile.dailyActivity !== option.id) { changes.dailyActivity = option.id; lines.push(`Typical day: ${option.label}`); }
  }
  if (!lines.length) return { ok: false, reason: "Nothing would change — these are already the person's settings." };
  return { ok: true, payload: { type: "update_training_preferences", changes }, summary: { title: "Update your plan settings", why: str(input, "why", 200), changes: lines } };
}

function buildWeight(ctx: RoziContext, input: Input): BuildResult {
  const kg = num(input, "kg");
  if (kg === null || kg < 25 || kg > 300) return { ok: false, reason: "Body weight must be 25–300 kg." };
  const rounded = Math.round(kg * 10) / 10;
  return { ok: true, payload: { type: "log_body_weight", date: ctx.today, kg: rounded }, summary: { title: `Log ${rounded} kg body weight`, why: str(input, "why", 200), changes: [`Weight for today: ${rounded} kg`] } };
}

function buildWater(ctx: RoziContext, input: Input): BuildResult {
  const ml = num(input, "ml");
  if (ml === null || ml < 50 || ml > 2000) return { ok: false, reason: "Water must be 50–2000 ml at a time." };
  const rounded = Math.round(ml / 50) * 50;
  return { ok: true, payload: { type: "log_water", date: ctx.today, ml: rounded }, summary: { title: `Log ${rounded} ml of water`, why: str(input, "why", 200), changes: [`Adds ${rounded} ml to today`] } };
}

/** Builds the exact change for an action type from the model's request, or refuses. */
export function buildAction(type: ActionType, input: Input, ctx: RoziContext): BuildResult {
  switch (type) {
    case "swap_exercise": return buildSwap(ctx, input);
    case "start_plan_today": return buildPlan(ctx, input, "start_plan_today");
    case "save_routine": return buildPlan(ctx, input, "save_routine");
    case "update_training_preferences": return buildPreferences(ctx, input);
    case "log_body_weight": return buildWeight(ctx, input);
    case "log_water": return buildWater(ctx, input);
  }
}

// ---------- Verification (after the app applied the change) ----------

/** What the server re-reads with the person's own sign-in to check a result. */
export interface VerifyState {
  sessions: WorkoutSession[];
  profile: RoziContext["profile"];
  bodyWeightEntries: BodyWeightEntry[];
  /** Routine names (newest first), when needed. */
  routineNames?: string[];
  /** Water entries (ml) logged on the action's day since the action was approved, when needed. */
  waterLogsSinceApproval?: number[];
}

/** Did the change really happen? (Returns a short reason when it didn't.) */
export function verifyAction(payload: ActionPayload, state: VerifyState): { ok: true } | { ok: false; reason: string } {
  const day = (date: string) => state.sessions.find((session) => session.date === date);
  switch (payload.type) {
    case "swap_exercise": {
      const ids = day(payload.date)?.plan.exercises.map((item) => item.id) ?? [];
      return ids.includes(payload.toId) && !ids.includes(payload.fromId) ? { ok: true } : { ok: false, reason: "Today's workout doesn't show the swap." };
    }
    case "start_plan_today": {
      const ids = day(payload.date)?.plan.exercises.map((item) => item.id) ?? [];
      return payload.plan.routine.exercises.every((item) => ids.includes(item.exerciseId)) ? { ok: true } : { ok: false, reason: "Today's workout isn't the new plan." };
    }
    case "save_routine":
      return state.routineNames?.includes(payload.name) ? { ok: true } : { ok: false, reason: "The routine isn't in My routines." };
    case "update_training_preferences": {
      const profile = state.profile;
      const mismatch = Object.entries(payload.changes).find(([key, value]) => (profile as unknown as Record<string, unknown>)[key] !== value);
      const label: Record<string, string> = { goal: "The goal", preferredSessionMinutes: "The session length", focusArea: "The focus muscle", dailyActivity: "Your typical day" };
      return mismatch ? { ok: false, reason: `${label[mismatch[0]] ?? "A setting"} wasn't saved.` } : { ok: true };
    }
    case "log_body_weight":
      return state.bodyWeightEntries.some((entry) => entry.measuredOn === payload.date && Math.abs(entry.weightKg - payload.kg) < 0.05) ? { ok: true } : { ok: false, reason: "The weight isn't saved." };
    case "log_water":
      return state.waterLogsSinceApproval?.includes(payload.ml) ? { ok: true } : { ok: false, reason: "The water isn't saved." };
  }
}
