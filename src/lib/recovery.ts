import { shiftDate, weekDates, weekdayOf } from "./dates.ts";
import { regionsForExercises, type BodyRegion } from "./figure.ts";
import { calculatePersonalRecords, type PersonalRecord } from "./progress.ts";
import type { MissedReason, Profile, WorkoutSession } from "./types";

/**
 * Phase 3 (2026-11-17): recovery from what was actually logged. These are guides from the person's own logs
 * and check-ins, not medical measurements; the planner's safety rules (pain → recovery) stay in charge.
 */
export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";
export const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "shoulders", "arms", "legs", "core"];
export const GROUP_LABELS: Record<MuscleGroup, string> = { chest: "Chest", back: "Back", shoulders: "Shoulders", arms: "Arms", legs: "Legs", core: "Core" };
export const GROUP_REGIONS: Record<MuscleGroup, BodyRegion[]> = {
  chest: ["chest"], back: ["back"], shoulders: ["shoulders"], arms: ["arms", "forearms"], legs: ["thighs", "hamstrings", "hips", "calves"], core: ["core"],
};
const REGION_GROUP = new Map<BodyRegion, MuscleGroup>(MUSCLE_GROUPS.flatMap((group) => GROUP_REGIONS[group].map((region) => [region, group] as const)));

/** fresh = trained today/yesterday · recovering = almost there · ready · sore = soreness or discomfort reported · no_data = not trained yet */
export type RecoveryStatus = "fresh" | "recovering" | "ready" | "sore" | "no_data";
export const STATUS_LABELS: Record<RecoveryStatus, string> = { fresh: "Just trained", recovering: "Recovering", ready: "Ready", sore: "Sore — go easy", no_data: "Not trained yet" };

export interface MuscleRecovery {
  group: MuscleGroup;
  status: RecoveryStatus;
  lastTrained: string | null;
  daysSince: number | null;
  /** Completed sets in the last session that trained it. */
  lastSets: number;
  /** Completed sets this week (Monday–Sunday). */
  weekSets: number;
  /** Exercise names from that last session. */
  exercises: string[];
  /** When it should feel ready again (null once ready). */
  readyOn: string | null;
}

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);
}

/** Every completed set in a session, with the muscle groups its exercise trains. */
export function sessionGroupSets(session: WorkoutSession): Array<{ group: MuscleGroup; sets: number; exercise: string }> {
  const out: Array<{ group: MuscleGroup; sets: number; exercise: string }> = [];
  for (const log of session.exerciseLogs) {
    const sets = log.sets.filter((set) => set.completed).length;
    if (!sets) continue;
    const planned = session.plan.exercises.find((exercise) => exercise.id === log.exerciseId);
    const groups = new Set(regionsForExercises([{ id: log.exerciseId, movementPattern: planned?.movementPattern }]).map((region) => REGION_GROUP.get(region)).filter((group): group is MuscleGroup => Boolean(group)));
    for (const group of groups) out.push({ group, sets, exercise: log.substitutionName || planned?.name || log.exerciseId });
  }
  return out;
}

function trainingSessions(sessions: WorkoutSession[], today: string): WorkoutSession[] {
  return sessions.filter((session) => !session.sampleData && session.date <= today && (session.status === "completed" || session.status === "in_progress"))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Recovery status of each muscle group on `today`. */
export function muscleRecovery(sessions: WorkoutSession[], today: string): MuscleRecovery[] {
  const trained = trainingSessions(sessions, today);
  const week = new Set(weekDates(today));
  return MUSCLE_GROUPS.map((group) => {
    let last: WorkoutSession | null = null;
    let lastSets = 0;
    let exercises: string[] = [];
    let weekSets = 0;
    for (const session of trained) {
      const hits = sessionGroupSets(session).filter((hit) => hit.group === group);
      if (!hits.length) continue;
      const sets = hits.reduce((sum, hit) => sum + hit.sets, 0);
      if (week.has(session.date)) weekSets += sets;
      last = session;
      lastSets = sets;
      exercises = hits.map((hit) => hit.exercise);
    }
    if (!last) return { group, status: "no_data", lastTrained: null, daysSince: null, lastSets: 0, weekSets, exercises: [], readyOn: null };
    const daysSince = daysBetween(today, last.date);
    // About 2 days for a few sets, 3 days after a big session (6+ sets).
    const needs = lastSets >= 6 ? 3 : 2;
    const sore = daysSince <= 3 && ((last.checkIn?.soreness ?? 0) >= 4 || last.review?.discomfort === true);
    const status: RecoveryStatus = daysSince >= needs ? (sore && daysSince <= 2 ? "sore" : "ready") : sore ? "sore" : daysSince <= 1 ? "fresh" : "recovering";
    return { group, status, lastTrained: last.date, daysSince, lastSets, weekSets, exercises, readyOn: status === "ready" ? null : shiftDate(last.date, needs) };
  });
}

/** "5/6 ready": groups that are ready or not trained yet. */
export function readyCount(recovery: MuscleRecovery[]): number {
  return recovery.filter((item) => item.status === "ready" || item.status === "no_data").length;
}

/** One short line for Home about the body as a whole. */
export function recoveryLine(recovery: MuscleRecovery[]): string {
  const sore = recovery.filter((item) => item.status === "sore").map((item) => GROUP_LABELS[item.group].toLowerCase());
  const busy = recovery.filter((item) => item.status === "fresh" || item.status === "recovering").map((item) => GROUP_LABELS[item.group].toLowerCase());
  if (sore.length) return `You reported soreness — go easy on ${sore.join(" and ")}. A stretch helps.`;
  if (!busy.length) return recovery.every((item) => item.status === "no_data") ? "Log your first workout and this map lights up." : "Everything is recovered. Good day to train.";
  if (busy.length >= 4) return "Most muscles are still recovering. A lighter day or a stretch is a good idea.";
  return `${busy.map((word) => word[0].toUpperCase() + word.slice(1)).join(" and ")} still recovering; the rest is ready.`;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  planned: number;
  completed: number;
  skipped: number;
  consistency: number | null;
  sets: number;
  reps: number;
  volumeKg: number;
  minutes: number;
  newRecords: PersonalRecord[];
  groupSets: Record<MuscleGroup, number>;
  avgEnergy: number | null;
  avgSoreness: number | null;
  discomfortDays: number;
  missedReasons: MissedReason[];
  nextWeekDays: number;
  rozi: string;
}

/** Everything for "Your week with Rozi", from saved sessions only. `weekStart` is a Monday. */
export function weeklyReport(profile: Pick<Profile, "trainingDays" | "trainingStartDate" | "sessionsPerWeek">, sessions: WorkoutSession[], weekStart: string, today: string): WeeklyReport {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
  const weekEnd = days[6];
  const real = sessions.filter((session) => !session.sampleData);
  const inWeek = real.filter((session) => days.includes(session.date));
  const done = inWeek.filter((session) => session.status === "completed");
  const planned = days.filter((day) => day >= profile.trainingStartDate && day <= today && profile.trainingDays.includes(weekdayOf(day))).length;
  const groupSets = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<MuscleGroup, number>;
  let sets = 0;
  let reps = 0;
  let volumeKg = 0;
  for (const session of done) {
    for (const hit of sessionGroupSets(session)) groupSets[hit.group] += hit.sets;
    for (const log of session.exerciseLogs) for (const set of log.sets) {
      if (!set.completed) continue;
      sets += 1;
      reps += set.actualReps ?? 0;
      volumeKg += (set.actualReps ?? 0) * (set.loadKg ?? 0);
    }
  }
  const before = new Map(calculatePersonalRecords(real.filter((session) => session.status === "completed" && session.date < weekStart)).map((record) => [record.exerciseId, record]));
  const newRecords = calculatePersonalRecords(real.filter((session) => session.status === "completed" && session.date <= weekEnd))
    .filter((record) => record.date >= weekStart && record.date <= weekEnd && (!before.has(record.exerciseId) || record.loadKg > before.get(record.exerciseId)!.loadKg));
  const checkIns = inWeek.map((session) => session.checkIn).filter((checkIn): checkIn is NonNullable<typeof checkIn> => Boolean(checkIn));
  const average = (values: number[]) => values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
  const skipped = inWeek.filter((session) => session.status === "skipped");
  const consistency = planned ? Math.round((Math.min(done.length, planned) / planned) * 100) : null;
  const rozi = !done.length
    ? (planned ? "A quiet week. One short workout next week gets you rolling again." : "Your plan starts soon. Rozi’s ready when you are.")
    : consistency !== null && consistency >= 100
      ? `Every planned workout done${newRecords.length ? ` and ${newRecords.length} new ${newRecords.length === 1 ? "record" : "records"}` : ""}. Brilliant week!`
      : `${done.length} ${done.length === 1 ? "workout" : "workouts"} done${newRecords.length ? `, ${newRecords.length} new ${newRecords.length === 1 ? "record" : "records"}` : ""}. Keep stacking small steps.`;
  return {
    weekStart, weekEnd, planned, completed: done.length, skipped: skipped.length, consistency,
    sets, reps, volumeKg: Math.round(volumeKg), minutes: done.reduce((sum, session) => sum + (session.plan.durationMinutes ?? 0), 0),
    newRecords, groupSets,
    avgEnergy: average(checkIns.map((checkIn) => checkIn.energy)),
    avgSoreness: average(checkIns.map((checkIn) => checkIn.soreness)),
    discomfortDays: inWeek.filter((session) => session.review?.discomfort || session.checkIn?.pain).length,
    missedReasons: skipped.map((session) => session.missedReason?.reason).filter((reason): reason is MissedReason => Boolean(reason)),
    nextWeekDays: profile.trainingDays.length,
    rozi,
  };
}
