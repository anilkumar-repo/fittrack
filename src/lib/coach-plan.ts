// ---------- R14 Coach review: the plan changes a person approved, and how the planner applies them ----------
//
// Stored on the person's own profile row (profiles.plan_adjustments, owner-only via RLS). Everything here is pure:
// reading the stored object defensively, applying or undoing one change, and adjusting a generated workout. The
// planner re-checks equipment and trainer rules every time, so a stored swap can never bring back a move the person
// isn't allowed to do. Train together groups share one plan, so their workouts are never adjusted per person.

import { canUseExercise, swapInPlan } from "./exercise-swap.ts";
import { coachKeyOf } from "./coach-key.ts";
import { getExerciseDefinition } from "./templates.ts";
import type { Profile, WorkoutPlan } from "./types";

/** Limits on what the plan can hold. */
export const COACH_LIMITS = { maxSwaps: 12, maxHistory: 20, maxDismissed: 40, minMinutes: 20, maxMinutes: 90, minSets: 1, maxSets: 6 } as const;

export type SetDelta = -1 | 0 | 1;

/** One change to the plan. */
export type PlanChange =
  | { type: "swap"; fromId: string; toId: string }
  | { type: "unswap"; fromId: string }
  | { type: "set_delta"; delta: SetDelta }
  | { type: "light_week"; start: string }
  | { type: "session_minutes"; minutes: number };

/** What a change replaced, so it can be undone. */
interface Snapshot { swaps: Record<string, string>; setDelta: SetDelta; lightWeekStart: string | null; minutes: number }

export interface CoachHistoryEntry {
  /** The suggestion id (kind:subject:week), or "manual:…" for a change made by hand. */
  id: string;
  on: string;
  title: string;
  change: PlanChange;
  /** Applied by Rozi on its own (auto-apply), rather than approved by tapping. */
  auto: boolean;
  previous: Snapshot;
  undone?: boolean;
}

export interface PlanAdjustments {
  v: 1;
  /** Exercise to use instead of another, in every workout the planner builds. */
  swaps: Record<string, string>;
  /** One set more (+1) or fewer (−1) on the main lifts. */
  setDelta: SetDelta;
  /** Monday-or-any-day a 7-day lighter week you accepted starts. */
  lightWeekStart: string | null;
  /** Let Rozi apply the small, safe changes by itself (each can be undone). */
  autoApply: boolean;
  /** Newest first. */
  history: CoachHistoryEntry[];
  /** Suggestion ids the person said "not now" to. */
  dismissed: string[];
}

export const EMPTY_ADJUSTMENTS: PlanAdjustments = { v: 1, swaps: {}, setDelta: 0, lightWeekStart: null, autoApply: false, history: [], dismissed: [] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9_]{2,60}$/;
const isDelta = (value: unknown): value is SetDelta => value === -1 || value === 0 || value === 1;

function parseChange(value: unknown): PlanChange | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  switch (item.type) {
    case "swap": return typeof item.fromId === "string" && typeof item.toId === "string" && ID.test(item.fromId) && ID.test(item.toId) ? { type: "swap", fromId: item.fromId, toId: item.toId } : null;
    case "unswap": return typeof item.fromId === "string" && ID.test(item.fromId) ? { type: "unswap", fromId: item.fromId } : null;
    case "set_delta": return isDelta(item.delta) ? { type: "set_delta", delta: item.delta } : null;
    case "light_week": return typeof item.start === "string" && DATE.test(item.start) ? { type: "light_week", start: item.start } : null;
    case "session_minutes": return typeof item.minutes === "number" && item.minutes >= COACH_LIMITS.minMinutes && item.minutes <= COACH_LIMITS.maxMinutes ? { type: "session_minutes", minutes: Math.round(item.minutes) } : null;
    default: return null;
  }
}

function parseSwaps(value: unknown): Record<string, string> {
  const swaps: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return swaps;
  for (const [from, to] of Object.entries(value as Record<string, unknown>).slice(0, COACH_LIMITS.maxSwaps)) {
    if (typeof to === "string" && ID.test(from) && ID.test(to) && from !== to && getExerciseDefinition(from) && getExerciseDefinition(to)) swaps[from] = to;
  }
  return swaps;
}

/** Reads the stored object defensively: anything unknown or out of range is dropped, never trusted. */
export function parsePlanAdjustments(value: unknown): PlanAdjustments {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_ADJUSTMENTS };
  const raw = value as Record<string, unknown>;
  const history: CoachHistoryEntry[] = [];
  for (const entry of Array.isArray(raw.history) ? raw.history.slice(0, COACH_LIMITS.maxHistory) : []) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const change = parseChange(item.change);
    const previous = item.previous as Record<string, unknown> | undefined;
    if (!change || typeof item.id !== "string" || typeof item.on !== "string" || !DATE.test(item.on) || !previous) continue;
    history.push({
      id: item.id.slice(0, 120), on: item.on, title: typeof item.title === "string" ? item.title.slice(0, 120) : "", change, auto: item.auto === true,
      previous: {
        swaps: parseSwaps(previous.swaps),
        setDelta: isDelta(previous.setDelta) ? previous.setDelta : 0,
        lightWeekStart: typeof previous.lightWeekStart === "string" && DATE.test(previous.lightWeekStart) ? previous.lightWeekStart : null,
        minutes: typeof previous.minutes === "number" ? previous.minutes : 45,
      },
      ...(item.undone === true ? { undone: true } : {}),
    });
  }
  return {
    v: 1,
    swaps: parseSwaps(raw.swaps),
    setDelta: isDelta(raw.setDelta) ? raw.setDelta : 0,
    lightWeekStart: typeof raw.lightWeekStart === "string" && DATE.test(raw.lightWeekStart) ? raw.lightWeekStart : null,
    autoApply: raw.autoApply === true,
    history,
    dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.filter((id): id is string => typeof id === "string").slice(0, COACH_LIMITS.maxDismissed).map((id) => id.slice(0, 120)) : [],
  };
}

export function adjustmentsOf(profile: Pick<Profile, "planAdjustments">): PlanAdjustments {
  return profile.planAdjustments ? parsePlanAdjustments(profile.planAdjustments) : { ...EMPTY_ADJUSTMENTS };
}

function snapshot(profile: Profile, adjustments: PlanAdjustments): Snapshot {
  return { swaps: { ...adjustments.swaps }, setDelta: adjustments.setDelta, lightWeekStart: adjustments.lightWeekStart, minutes: profile.preferredSessionMinutes };
}

/** Why a change can't be made (or null when it can). Checked again when the planner applies it. */
export function changeProblem(profile: Profile, change: PlanChange): string | null {
  if (profile.buddyAnchor) return "In Train together your group shares one plan, so plan changes go through your buddies.";
  const adjustments = adjustmentsOf(profile);
  switch (change.type) {
    case "swap": {
      const from = getExerciseDefinition(change.fromId);
      const to = getExerciseDefinition(change.toId);
      if (!from || !to || from.id === to.id) return "That exercise isn't in RozFit's library.";
      if (!canUseExercise(to, profile)) return `${to.name} needs equipment or a trainer approval you don't have.`;
      if (Object.keys(adjustments.swaps).length >= COACH_LIMITS.maxSwaps && !adjustments.swaps[from.id]) return `Your plan already has ${COACH_LIMITS.maxSwaps} swaps — undo one first.`;
      return null;
    }
    case "unswap": return adjustments.swaps[change.fromId] ? null : "That exercise isn't swapped.";
    case "set_delta": return null;
    case "light_week": return DATE.test(change.start) ? null : "That date isn't valid.";
    case "session_minutes": return change.minutes >= COACH_LIMITS.minMinutes && change.minutes <= COACH_LIMITS.maxMinutes ? null : `Sessions must be ${COACH_LIMITS.minMinutes}–${COACH_LIMITS.maxMinutes} minutes.`;
  }
}

/** The profile with one change applied and recorded in the history (newest first), or the reason it can't be. */
export function applyPlanChange(profile: Profile, change: PlanChange, meta: { id: string; title: string; on: string; auto?: boolean }): { ok: true; profile: Profile } | { ok: false; reason: string } {
  const problem = changeProblem(profile, change);
  if (problem) return { ok: false, reason: problem };
  const current = adjustmentsOf(profile);
  const next: PlanAdjustments = { ...current, swaps: { ...current.swaps } };
  let minutes = profile.preferredSessionMinutes;
  switch (change.type) {
    case "swap": next.swaps[change.fromId] = change.toId; break;
    case "unswap": delete next.swaps[change.fromId]; break;
    case "set_delta": next.setDelta = change.delta; break;
    case "light_week": next.lightWeekStart = change.start; break;
    case "session_minutes": minutes = Math.round(change.minutes / 5) * 5; break;
  }
  const entry: CoachHistoryEntry = { id: meta.id.slice(0, 120), on: meta.on, title: meta.title.slice(0, 120), change, auto: meta.auto === true, previous: snapshot(profile, current) };
  next.history = [entry, ...current.history].slice(0, COACH_LIMITS.maxHistory);
  return { ok: true, profile: { ...profile, preferredSessionMinutes: minutes, planAdjustments: next } };
}

/** Undo the newest change that is still in effect: everything goes back to how it was before it. */
export function undoLastChange(profile: Profile): Profile {
  const current = adjustmentsOf(profile);
  const index = current.history.findIndex((entry) => !entry.undone);
  if (index < 0) return profile;
  const entry = current.history[index];
  const next: PlanAdjustments = {
    ...current,
    swaps: { ...entry.previous.swaps },
    setDelta: entry.previous.setDelta,
    lightWeekStart: entry.previous.lightWeekStart,
    history: current.history.map((item, at) => (at === index ? { ...item, undone: true } : item)),
  };
  return { ...profile, preferredSessionMinutes: entry.previous.minutes, planAdjustments: next };
}

/** Say "not now" to a suggestion for this week. */
export function dismissSuggestion(profile: Profile, id: string): Profile {
  const current = adjustmentsOf(profile);
  return { ...profile, planAdjustments: { ...current, dismissed: [id.slice(0, 120), ...current.dismissed.filter((item) => item !== id)].slice(0, COACH_LIMITS.maxDismissed) } };
}

export function setAutoApply(profile: Profile, on: boolean): Profile {
  return { ...profile, planAdjustments: { ...adjustmentsOf(profile), autoApply: on } };
}

/** Is `date` inside the 7-day lighter week the person accepted? */
export function inOwnLightWeek(profile: Pick<Profile, "planAdjustments">, date: string): boolean {
  const start = adjustmentsOf(profile).lightWeekStart;
  if (!start) return false;
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
  return days >= 0 && days < 7;
}

/** How many of the first exercises count as "main lifts" for a set nudge. */
const MAIN_LIFTS = 3;

/**
 * A generated training workout with the person's approved swaps and set nudge applied. Every swap is re-checked
 * (equipment, trainer rules, not already in the workout); a nudge never goes below 1 or above 6 sets, and is skipped
 * in a return, recovery or lighter week. Train together plans are left as they are.
 */
export function adjustPlan(plan: WorkoutPlan, profile: Profile): WorkoutPlan {
  const key = coachKeyOf(profile);
  if (profile.buddyAnchor || plan.sessionType !== "training") return key ? { ...plan, coachKey: key } : plan;
  return { ...applyAdjustments(plan, profile), ...(key ? { coachKey: key } : {}) };
}

function applyAdjustments(plan: WorkoutPlan, profile: Profile): WorkoutPlan {
  const adjustments = adjustmentsOf(profile);
  let next = plan;
  for (const exercise of plan.exercises) {
    const toId = adjustments.swaps[exercise.id];
    const to = toId ? getExerciseDefinition(toId) : undefined;
    if (!to || !canUseExercise(to, profile) || next.exercises.some((item) => item.id === to.id)) continue;
    next = swapInPlan(next, exercise.id, to, `${to.name} replaces ${exercise.name}: a change you approved in your coach review.`);
  }
  const quiet = plan.isReturnSession || plan.recoveryWeek || plan.lightWeek;
  if (adjustments.setDelta !== 0 && !quiet) {
    let changed = 0;
    const exercises = next.exercises.map((exercise) => {
      if (changed >= MAIN_LIFTS || exercise.category !== "strength") return exercise;
      changed += 1;
      return { ...exercise, sets: Math.min(COACH_LIMITS.maxSets, Math.max(COACH_LIMITS.minSets, exercise.sets + adjustments.setDelta)) };
    });
    next = { ...next, exercises, generationReasons: [...next.generationReasons, adjustments.setDelta > 0 ? "One more set on the main lifts: a change you approved in your coach review." : "One set fewer on the main lifts: a change you approved in your coach review."] };
  }
  return next;
}
