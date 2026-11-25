// ---------- R14 Coach review: what to change in the plan, from what the person logged ----------
//
// Reads the last 2–4 weeks of logged training — pain and soreness, effort, skipped moves, stalled lifts, finished
// sets and missed days — and suggests at most three plan changes, safety first. It's plain code (no AI), so it's
// predictable and tested; Rozi AI explains it and the person approves each change (or turns on auto-apply for the
// small safe ones: a lighter week when the body asks for it, swapping a move they keep skipping, and backing off an
// extra set that turned out too much). Nothing here writes anything.

import { adjustmentsOf, changeProblem, inOwnLightWeek, type PlanChange } from "./coach-plan.ts";
import { shiftDate, weekdayOf } from "./dates.ts";
import { getSafeExerciseAlternatives } from "./exercise-library.ts";
import { findPlateaus } from "./insights.ts";
import { programWeek } from "./levels.ts";
import { inLightWeek } from "./program.ts";
import { getExerciseDefinition } from "./templates.ts";
import type { Profile, WorkoutSession } from "./types";

/** Thresholds (also in docs/ROZI_AGENT_ARCHITECTURE.md §13). */
export const REVIEW_RULES = {
  /** Pain in a check-in, or discomfort after a workout, this many days back → lighter week. */
  painDays: 7,
  /** Average soreness (1–5) over at least 2 check-ins in 10 days, at or above this → lighter week. */
  soreness: 4,
  /** Average effort (1–10) over the last 3 reviews at or above this → lighter week / back off. */
  hardEffort: 9,
  backOffEffort: 8.5,
  /** Skipped this many times in 28 days → swap it. */
  skips: 2,
  /** "Too easy": this many fully done workouts in 14 days with average effort at or below this. */
  easySessions: 3,
  easyEffort: 6,
  /** Earliest program week for an extra set. */
  easyFromWeek: 5,
  /** Fewer than this share of planned days done over 3 weeks (at least 6 planned) → shorter sessions. */
  consistency: 0.5,
  minPlannedDays: 6,
  shorterBy: 10,
  /** At most this many suggestions at a time. */
  max: 3,
} as const;

export type SuggestionKind = "lighter_week" | "back_off" | "swap_skipped" | "swap_stalled" | "more_sets" | "shorter_sessions";

export interface CoachSuggestion {
  /** kind:subject:week — the same suggestion keeps its id all week (for "not now" and auto-apply). */
  id: string;
  kind: SuggestionKind;
  title: string;
  why: string;
  change: PlanChange;
  /** Small and safe: may be applied by itself when the person turned on auto-apply. */
  safe: boolean;
}

export interface CoachReview {
  /** Monday of the week the review is for. */
  week: string;
  suggestions: CoachSuggestion[];
  /** Workouts done and planned in the last 3 weeks, and average effort, for the card's header line. */
  done: number;
  planned: number;
  averageEffort: number | null;
}

interface ReviewInput { profile: Profile; sessions: WorkoutSession[]; today: string }

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  return shiftDate(date, -((weekdayOf(date) + 6) % 7));
}

/** Planned training days from `from` up to (not including) `to`, from the profile's days and start date. */
function plannedDays(profile: Profile, from: string, to: string): number {
  let count = 0;
  for (let day = from; day < to; day = shiftDate(day, 1)) {
    if (day >= profile.trainingStartDate && profile.trainingDays.includes(weekdayOf(day))) count += 1;
  }
  return count;
}

/** Every set the plan asked for was done (skipped moves don't count as done). */
function fullyDone(session: WorkoutSession): boolean {
  const logs = session.exerciseLogs.filter((log) => log.status !== "skipped");
  return logs.length > 0 && session.exerciseLogs.every((log) => log.status !== "skipped")
    && logs.every((log) => log.sets.filter((set) => set.completed).length >= log.plannedSets);
}

/** The weekly review: up to three suggested plan changes, safety first. */
export function weeklyReview({ profile, sessions, today }: ReviewInput): CoachReview {
  const week = mondayOf(today);
  const real = sessions.filter((session) => !session.sampleData && session.date <= today);
  const completed = real.filter((session) => session.status === "completed").sort((a, b) => b.date.localeCompare(a.date));
  const since = (days: number) => shiftDate(today, -days);
  const done = completed.filter((session) => session.date >= since(21) && session.date < today).length;
  const planned = plannedDays(profile, since(21), today);
  const recentEfforts = completed.slice(0, 3).map((session) => session.review?.effort).filter((value): value is number => typeof value === "number");
  const effort = average(recentEfforts);
  const review: CoachReview = { week, suggestions: [], done, planned, averageEffort: effort === null ? null : round1(effort) };
  // Train together shares one plan; no per-person changes.
  if (profile.buddyAnchor) return review;

  const adjustments = adjustmentsOf(profile);
  const suggestions: CoachSuggestion[] = [];
  const add = (kind: SuggestionKind, subject: string, title: string, why: string, change: PlanChange, safe: boolean) => {
    const id = `${kind}:${subject}:${week}`;
    if (adjustments.dismissed.includes(id) || adjustments.history.some((entry) => entry.id === id && !entry.undone)) return;
    if (changeProblem(profile, change)) return;
    suggestions.push({ id, kind, title, why, change, safe });
  };

  // 1. The body asks for a lighter week: pain, discomfort after training, high soreness or very hard efforts.
  const inLight = inLightWeek(profile.lightWeekStart, today) || inOwnLightWeek(profile, today);
  const pain = real.some((session) => session.date >= since(REVIEW_RULES.painDays) && (session.checkIn?.pain || session.review?.discomfort));
  const soreness = real.filter((session) => session.date >= since(10) && session.checkIn).map((session) => session.checkIn!.soreness);
  const sore = soreness.length >= 2 && (average(soreness) ?? 0) >= REVIEW_RULES.soreness;
  const veryHard = recentEfforts.length >= 3 && (effort ?? 0) >= REVIEW_RULES.hardEffort;
  if (!inLight && (pain || sore || veryHard)) {
    const reason = pain ? "You reported pain or discomfort in the last week." : sore ? `Your soreness has averaged ${round1(average(soreness)!)} out of 5 lately.` : `Your last three workouts felt ${round1(effort!)}/10 hard.`;
    add("lighter_week", "body", "Take a lighter week", `${reason} Same workouts with about a third fewer sets for 7 days, so you recover and come back stronger. Stop any move that hurts.`, { type: "light_week", start: today }, true);
  }

  // 2. An extra set that turned out too much.
  if (adjustments.setDelta > 0 && (((effort ?? 0) >= REVIEW_RULES.backOffEffort && recentEfforts.length >= 2) || sore || pain)) {
    add("back_off", "sets", "Drop the extra set", "Since adding a set on your main lifts, your workouts feel very hard. Going back to the planned sets keeps progress steady.", { type: "set_delta", delta: 0 }, true);
  }

  // 3. A move you keep skipping: swap it for the closest one you can do.
  const skipCounts = new Map<string, number>();
  for (const session of real.filter((item) => item.date >= since(28))) {
    for (const log of session.exerciseLogs) if (log.status === "skipped") skipCounts.set(log.exerciseId, (skipCounts.get(log.exerciseId) ?? 0) + 1);
  }
  const skipped = [...skipCounts].filter(([id, count]) => count >= REVIEW_RULES.skips && !adjustments.swaps[id]).sort((a, b) => b[1] - a[1])[0];
  if (skipped) {
    const from = getExerciseDefinition(skipped[0]);
    const to = from ? getSafeExerciseAlternatives(from, profile)[0] : undefined;
    if (from && to) add("swap_skipped", from.id, `Swap ${from.name} for ${to.name}`, `You've skipped ${from.name} ${skipped[1]} times in the last 4 weeks. ${to.name} trains the same movement and fits your equipment.`, { type: "swap", fromId: from.id, toId: to.id }, true);
  }

  // 4. A stalled lift: a variation for the next few weeks.
  const stalled = findPlateaus(real, profile, today).find((item) => item.variation && !adjustments.swaps[item.exerciseId]);
  if (stalled?.variation) {
    add("swap_stalled", stalled.exerciseId, `Swap ${stalled.name} for ${stalled.variation.name}`, `${stalled.name} hasn't gone up for ${stalled.weeksStalled} weeks. Doing a close variation for about 3 weeks is a proven way past a plateau; then go back to ${stalled.name}.`, { type: "swap", fromId: stalled.exerciseId, toId: stalled.variation.id }, false);
  }

  // 5. Too easy for a while: one more set on the main lifts.
  const easy = completed.filter((session) => session.date >= since(14) && fullyDone(session) && typeof session.review?.effort === "number");
  const easyEffort = average(easy.map((session) => session.review!.effort));
  if (adjustments.setDelta < 1 && !pain && !sore && easy.length >= REVIEW_RULES.easySessions && (easyEffort ?? 10) <= REVIEW_RULES.easyEffort && programWeek(profile, today) >= REVIEW_RULES.easyFromWeek) {
    add("more_sets", "sets", "Add a set to your main lifts", `You finished every set in your last ${easy.length} workouts and rated them about ${round1(easyEffort!)}/10. One more set on your first three lifts is the next step.`, { type: "set_delta", delta: 1 }, false);
  }

  // 6. Missing many planned days: shorter sessions are easier to fit in.
  const busy = real.filter((session) => session.date >= since(21) && session.missedReason?.reason === "busy").length;
  if (planned >= REVIEW_RULES.minPlannedDays && done / planned < REVIEW_RULES.consistency && profile.preferredSessionMinutes - REVIEW_RULES.shorterBy >= 20) {
    const minutes = profile.preferredSessionMinutes - REVIEW_RULES.shorterBy;
    add("shorter_sessions", "minutes", `Shorter sessions: ${minutes} minutes`, `You've done ${done} of ${planned} planned workouts in the last 3 weeks${busy ? `, and said you were busy ${busy} ${busy === 1 ? "time" : "times"}` : ""}. A shorter session is easier to fit in — showing up beats a perfect plan.`, { type: "session_minutes", minutes }, false);
  }

  review.suggestions = suggestions.slice(0, REVIEW_RULES.max);
  return review;
}

/** The safe suggestions to apply by themselves when the person turned on auto-apply (and haven't been applied yet). */
export function autoApplicable(profile: Profile, review: CoachReview): CoachSuggestion[] {
  return adjustmentsOf(profile).autoApply ? review.suggestions.filter((item) => item.safe) : [];
}
