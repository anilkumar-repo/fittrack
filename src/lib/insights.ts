// ---------- Advanced intelligence (R12): plateaus, the post-workout recap, and "why this workout" ----------
//
// Deterministic and read-only: everything comes from the person's saved sets, the exercise library and the plan's
// own fields. Nothing here changes a plan. A plateau only SUGGESTS a variation; swapping stays the person's choice
// (the swap card or a Rozi action they approve).

import { shiftDate } from "./dates.ts";
import { variationsOf } from "./exercise-variations.ts";
import { exerciseHistory, type ExerciseDay } from "./pro-tracking.ts";
import { goalTitle } from "./program.ts";
import { exerciseGroups, GROUP_LABELS, muscleRecovery } from "./recovery.ts";
import { getExerciseDefinition } from "./templates.ts";
import type { Profile, WorkoutPlan, WorkoutSession } from "./types.ts";

/** "No e1RM gain for 3+ weeks": at least 3 sessions in the last 3 weeks, spread over 10+ days, none beating the earlier best. */
export const PLATEAU_RULES = { windowDays: 21, minSessions: 3, minSpanDays: 10, lookbackDays: 84, maxIdleDays: 14, variationWeeks: 3 } as const;

export interface Plateau {
  exerciseId: string;
  name: string;
  /** Best estimated one-rep max before the last 3 weeks, and when. */
  bestKg: number;
  bestOn: string;
  /** Best estimated one-rep max in the last 3 weeks. */
  recentBestKg: number;
  sessionsSince: number;
  weeksStalled: number;
  /** The closest version of the same movement this person can do now, with how it differs. */
  variation: { id: string; name: string; differences: string[] } | null;
  /** One plain sentence: what's happening and what to try. */
  advice: string;
}

const daysBetween = (later: string, earlier: string) => Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);

/** Sets done on a swapped-in exercise belong to that exercise, not the planned one, so they're left out. */
const swapped = (log: { substitutionName?: string | null }) => Boolean(String(log.substitutionName ?? "").trim());

function withoutSubstitutions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.map((session) => ({ ...session, exerciseLogs: session.exerciseLogs.filter((log) => !swapped(log)) }));
}

function nameOf(exerciseId: string, sessions: WorkoutSession[]): string {
  return getExerciseDefinition(exerciseId)?.name
    ?? sessions.flatMap((session) => session.plan.exercises).find((exercise) => exercise.id === exerciseId)?.name
    ?? exerciseId;
}

function plateauFor(exerciseId: string, clean: WorkoutSession[], profile: Profile, today: string): Plateau | null {
  const windowStart = shiftDate(today, -(PLATEAU_RULES.windowDays - 1));
  const lookbackStart = shiftDate(today, -PLATEAU_RULES.lookbackDays);
  const days = exerciseHistory(clean, exerciseId).filter((day): day is ExerciseDay & { oneRepMax: number } =>
    day.oneRepMax !== null && day.date <= today && day.date >= lookbackStart);
  const recent = days.filter((day) => day.date >= windowStart);
  const prior = days.filter((day) => day.date < windowStart);
  if (recent.length < PLATEAU_RULES.minSessions || !prior.length) return null;
  const newest = recent[0].date;
  const oldest = recent[recent.length - 1].date;
  if (daysBetween(newest, oldest) < PLATEAU_RULES.minSpanDays || daysBetween(today, newest) > PLATEAU_RULES.maxIdleDays) return null;
  const best = prior.reduce((top, day) => (day.oneRepMax > top.oneRepMax ? day : top));
  const recentBestKg = Math.max(...recent.map((day) => day.oneRepMax));
  if (recentBestKg > best.oneRepMax) return null;
  // Weeks without a new best: from the old best, but never less than the 3-week window that proved it.
  const weeksStalled = Math.max(Math.floor(PLATEAU_RULES.windowDays / 7), Math.floor(daysBetween(today, best.date) / 7));
  const name = nameOf(exerciseId, clean);
  const definition = getExerciseDefinition(exerciseId);
  const option = definition ? variationsOf(definition, profile).find((item) => item.usable) : undefined;
  const variation = option ? { id: option.exercise.id, name: option.exercise.name, differences: option.differences.slice(0, 2) } : null;
  const advice = variation
    ? `${name} hasn't gone up in ${weeksStalled} weeks. Try ${variation.name} for ${PLATEAU_RULES.variationWeeks} weeks${variation.differences[0] ? ` (${variation.differences[0]})` : ""}, then go back to ${name}.`
    : `${name} hasn't gone up in ${weeksStalled} weeks. For ${PLATEAU_RULES.variationWeeks} weeks, change the reps (heavier for 6, or lighter for 12), then go back to your usual sets.`;
  return { exerciseId, name, bestKg: best.oneRepMax, bestOn: best.date, recentBestKg, sessionsSince: recent.length, weeksStalled, variation, advice };
}

/** Lifts that have stalled: worst first (longest without a new best). Only loaded lifts with an estimated 1-rep max. */
export function findPlateaus(sessions: WorkoutSession[], profile: Profile, today: string): Plateau[] {
  const clean = withoutSubstitutions(sessions.filter((session) => !session.sampleData));
  const windowStart = shiftDate(today, -(PLATEAU_RULES.windowDays - 1));
  const ids = new Set(clean.filter((session) => session.date >= windowStart && session.date <= today).flatMap((session) => session.exerciseLogs.map((log) => log.exerciseId)));
  return [...ids].map((id) => plateauFor(id, clean, profile, today)).filter((item): item is Plateau => item !== null)
    .sort((a, b) => b.weeksStalled - a.weeksStalled || a.name.localeCompare(b.name));
}

// ---------- Post-workout recap ----------

export interface WorkoutRecap {
  date: string;
  setsDone: number;
  setsPlanned: number;
  volumeKg: number;
  /** New bests in this workout, e.g. "Bench press: 62.5 kg, your heaviest yet". */
  records: string[];
  /** Compared with the last time each lift was done, e.g. "Squat: stronger than last time (est. 1-rep max 92 → 95 kg)". */
  compared: Array<{ name: string; change: "up" | "same" | "down"; text: string }>;
  /** Lifts in this workout that have stalled. */
  plateaus: Plateau[];
  /** One plain sentence for the top of the recap. */
  headline: string;
}

/** What a saved workout achieved, from logged sets only. Null when nothing was logged that day. */
export function workoutRecap(sessions: WorkoutSession[], date: string, profile: Profile): WorkoutRecap | null {
  const real = sessions.filter((session) => !session.sampleData);
  const session = real.find((item) => item.date === date);
  if (!session || (session.status !== "completed" && session.status !== "in_progress")) return null;
  const setsDone = session.exerciseLogs.reduce((sum, log) => sum + log.sets.filter((set) => set.completed).length, 0);
  if (!setsDone) return null;
  const setsPlanned = session.exerciseLogs.reduce((sum, log) => sum + log.plannedSets, 0);
  const clean = withoutSubstitutions(real.filter((item) => item.date <= date));
  const records: string[] = [];
  const compared: WorkoutRecap["compared"] = [];
  let volumeKg = 0;
  for (const log of session.exerciseLogs) {
    if (swapped(log)) continue;
    const history = exerciseHistory(clean, log.exerciseId);
    const today = history.find((day) => day.date === date);
    if (!today) continue;
    volumeKg += today.volumeKg;
    const earlier = history.filter((day) => day.date < date);
    const name = nameOf(log.exerciseId, real);
    const heaviestBefore = Math.max(0, ...earlier.map((day) => day.best?.loadKg ?? 0));
    if (today.best && earlier.length && today.best.loadKg > heaviestBefore) records.push(`${name}: ${today.best.loadKg} kg, your heaviest yet`);
    const last = earlier[0];
    if (today.oneRepMax !== null && last?.oneRepMax) {
      const change = today.oneRepMax > last.oneRepMax ? "up" : today.oneRepMax < last.oneRepMax ? "down" : "same";
      const words = change === "up" ? "stronger than last time" : change === "down" ? "a little under last time (normal day to day)" : "the same as last time";
      compared.push({ name, change, text: `${name}: ${words} (est. 1-rep max ${last.oneRepMax} → ${today.oneRepMax} kg)` });
    }
  }
  const ids = new Set(session.exerciseLogs.map((log) => log.exerciseId));
  const plateaus = findPlateaus(real.filter((item) => item.date <= date), profile, date).filter((item) => ids.has(item.exerciseId));
  const ups = compared.filter((item) => item.change === "up").length;
  const headline = records.length
    ? `New best on ${records.length === 1 ? records[0].split(":")[0] : `${records.length} lifts`}!`
    : ups
      ? `Stronger than last time on ${ups} ${ups === 1 ? "lift" : "lifts"}.`
      : `${setsDone} ${setsDone === 1 ? "set" : "sets"} done. Showing up is what builds strength.`;
  return { date, setsDone, setsPlanned, volumeKg: Math.round(volumeKg), records, compared, plateaus, headline };
}

// ---------- "Why this workout" in plain words ----------

/** Planner reasons that are about the person (check-ins, soreness, focus, trainer), not internal rule notes. */
const PERSONAL_REASON = /^(Your check-in|Your last session|Soreness has been|Low energy|High soreness|Recent training frequency|Today’s very low|Your focus is|Your trainer)/;

/** Up to five short sentences on why this is `date`'s workout, from the plan's own fields and the person's logs. */
export function explainWorkout(plan: WorkoutPlan, date: string, sessions: WorkoutSession[], profile: Profile, today: string): string[] {
  const lines: string[] = [];
  if (plan.goal && plan.weekNumber) lines.push(`Week ${plan.weekNumber} of your “${goalTitle(plan.goal)}” plan${plan.stage ? ` (${plan.stage} stage)` : ""}: ${plan.title} is next in the rotation.`);
  else lines.push(`${plan.title} is next in your ${profile.sessionsPerWeek}-day rotation.`);

  if (plan.sessionType === "recovery") lines.push("Today is a recovery session: your check-in or recent training asked for an easier day.");
  else if (plan.isReturnSession) lines.push("You've been away for 2 weeks or more, so this is a lighter comeback session.");
  if (plan.recoveryWeek) lines.push("This is a lighter week: every 4th week is easier so your body can catch up.");
  if (plan.lightWeek) lines.push("Your trainer made this week lighter.");

  if (plan.sessionType !== "recovery") {
    const groups = exerciseGroups(plan.exercises);
    if (groups.length) {
      // Recovery as it stood before this day's own sets.
      const state = new Map(muscleRecovery(sessions.filter((session) => session.date < date), date).map((item) => [item.group, item]));
      const label = (list: typeof groups) => list.map((group) => GROUP_LABELS[group].toLowerCase()).join(", ");
      const ready = groups.filter((group) => ["ready", "no_data"].includes(state.get(group)?.status ?? "no_data"));
      const tired = groups.filter((group) => !ready.includes(group));
      lines.push(tired.length
        ? `It trains ${label(groups)}. ${GROUP_LABELS[tired[0]]}${tired.length > 1 ? ` and ${label(tired.slice(1))}` : ""} ${tired.length > 1 ? "are" : "is"} still recovering, so keep those sets comfortable.`
        : `It trains ${label(groups)}, all ready to train.`);
    }
  }

  for (const reason of plan.generationReasons.filter((item) => PERSONAL_REASON.test(item)).slice(0, 2)) lines.push(reason);

  const planned = new Set(plan.exercises.map((exercise) => exercise.id));
  const stalled = findPlateaus(sessions, profile, today).find((item) => planned.has(item.exerciseId));
  if (stalled) lines.push(stalled.advice);
  return lines.slice(0, 5);
}
