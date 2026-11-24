import { getExerciseDefinition } from "./templates.ts";
import type { ExerciseDefinition, ExerciseTracking, TrackingUnit } from "./types.ts";

/**
 * Time and distance tracking (R5). A set's number (actualReps / plannedReps) means reps, seconds, minutes or rounds
 * depending on the exercise. These helpers label it and keep timed sets out of lifting maths (1RM, volume, load records).
 */

const REPS: ExerciseTracking = { unit: "reps" };

/** How an exercise's sets are counted. Old saved copies without `tracking` use the library entry; unknown ones are reps. */
export function trackingOf(exercise: Pick<ExerciseDefinition, "id" | "tracking"> | string | undefined): ExerciseTracking {
  if (!exercise) return REPS;
  if (typeof exercise === "string") return getExerciseDefinition(exercise)?.tracking ?? REPS;
  return exercise.tracking ?? getExerciseDefinition(exercise.id)?.tracking ?? REPS;
}

/** Column heading in the logger. */
export const UNIT_HEADING: Record<TrackingUnit, string> = { reps: "Reps", seconds: "Sec", minutes: "Min", rounds: "Rounds" };

/** Words for screen readers and sentences. */
export const UNIT_WORD: Record<TrackingUnit, string> = { reps: "reps", seconds: "seconds", minutes: "minutes", rounds: "rounds" };

const UNIT_SHORT: Record<TrackingUnit, string> = { reps: "reps", seconds: "sec", minutes: "min", rounds: "rounds" };

/** "10 reps", "30 sec", "25 min", "8 rounds". */
export function formatAmount(value: number, unit: TrackingUnit): string {
  return `${value} ${unit === "reps" && value === 1 ? "rep" : unit === "rounds" && value === 1 ? "round" : UNIT_SHORT[unit]}`;
}

/** "30, 30 sec" style list for several sets in one unit. */
export function formatAmounts(values: number[], unit: TrackingUnit): string {
  return values.length === 1 ? formatAmount(values[0], unit) : `${values.join(", ")} ${UNIT_SHORT[unit]}`;
}

/** Reps and holds can carry a weight (a weighted plank, a farmer carry); minutes and rounds of cardio don't. */
export function usesLoad(tracking: ExerciseTracking): boolean {
  return tracking.unit === "reps" || tracking.unit === "seconds";
}

/** Only rep sets count for lifting maths: estimated 1RM, volume (kg × reps), rep totals and load records. */
export function isLifting(tracking: ExerciseTracking): boolean {
  return tracking.unit === "reps";
}

/** "2.4 km". */
export function formatDistance(km: number): string {
  return `${Math.round(km * 100) / 100} km`;
}
