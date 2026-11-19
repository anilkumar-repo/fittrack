// ---------- Swapping an exercise in a workout ----------
//
// People change workouts all the time: the machine is busy, a move doesn't feel right, or they just prefer another.
// One place decides what can be swapped and does the swap, used by the Swap button on each exercise, the exercise
// guide's "Use instead", and Rozi's swap card. Rules:
//   * any library exercise can come in, as long as the trainer rules allow it (deadlift approval) and the person's
//     equipment covers it — the same rules the planner uses, so a swap is kept when the plan is rebuilt;
//   * the sets, reps and rest of the exercise it replaces are kept;
//   * before the workout starts, any exercise can be swapped; once it's started, only one with no sets done yet;
//   * the original plan stays in the session's history (originalExercises), as with the planner's own changes.

import { exerciseEquipmentIsAvailable, exerciseSearchRank, getSafeExerciseAlternatives, isExerciseAllowedForProfile, rankSearchResults } from "./exercise-library.ts";
import { getExerciseDefinition } from "./templates.ts";
import { EXERCISE_LIBRARY } from "./templates.ts";
import type { ExerciseDefinition, Profile, WorkoutPlan, WorkoutSession } from "./types";
import { createExerciseLog } from "./workout-tracking.ts";

export type SwapBlock = "completed" | "sets-done" | "not-in-workout";

/** Why an exercise can't be swapped right now, or null if it can. */
export function swapBlock(session: WorkoutSession | undefined, plan: WorkoutPlan | null, exerciseId: string): SwapBlock | null {
  const exercises = session && session.status !== "planned" ? session.plan.exercises : plan?.exercises ?? session?.plan.exercises ?? [];
  if (!exercises.some((exercise) => exercise.id === exerciseId)) return "not-in-workout";
  if (!session || session.status === "planned") return null;
  if (session.status !== "in_progress") return "completed";
  const log = session.exerciseLogs.find((item) => item.exerciseId === exerciseId);
  return log?.sets.some((set) => set.completed) ? "sets-done" : null;
}

export const SWAP_BLOCK_TEXT: Record<SwapBlock, string> = {
  completed: "This workout is finished, so its exercises stay as they were done.",
  "sets-done": "You've already logged sets of this exercise. Swap one you haven't started yet.",
  "not-in-workout": "That exercise isn't in this workout.",
};

/** Could this exercise go into the workout for this person (trainer rules and equipment)? */
export function canUseExercise(exercise: ExerciseDefinition, profile: Profile): boolean {
  return isExerciseAllowedForProfile(exercise, profile) && exerciseEquipmentIsAvailable(exercise, profile);
}

export interface SwapChoices {
  /** Close matches: the same movement, fitting the equipment (up to 4). */
  suggested: ExerciseDefinition[];
  /** Everything else this person can do, best matches for `query` (or the same muscles) first. */
  others: ExerciseDefinition[];
  /** Exercises left out only because of missing equipment (so the screen can say why). */
  needsEquipment: number;
}

/**
 * What `source` could be swapped for. `profile` should be the planning profile (trainer equipment rules applied).
 * Exercises already in the workout are left out.
 */
export function swapChoices(source: ExerciseDefinition, profile: Profile, workoutExercises: ExerciseDefinition[], query = ""): SwapChoices {
  const taken = new Set(workoutExercises.map((exercise) => exercise.id));
  const suggested = query.trim() ? [] : getSafeExerciseAlternatives(source, profile, workoutExercises.filter((exercise) => exercise.id !== source.id));
  const shown = new Set([source.id, ...suggested.map((exercise) => exercise.id)]);
  const pool = EXERCISE_LIBRARY.filter((exercise) => !taken.has(exercise.id) && !shown.has(exercise.id) && isExerciseAllowedForProfile(exercise, profile));
  const usable = pool.filter((exercise) => exerciseEquipmentIsAvailable(exercise, profile));
  // Closest first: the same movement, then the most shared muscle words ("Upper chest" shares "chest" with "Chest").
  const reference = getExerciseDefinition(source.id) ?? source;
  const muscleWords = (exercise: ExerciseDefinition) => new Set(exercise.targetMuscles.flatMap((muscle) => muscle.toLowerCase().split(/[\s/-]+/)).filter((word) => word.length > 3 && !["upper", "lower", "front", "rear", "side", "inner", "outer"].includes(word)));
  const sourceWords = muscleWords(reference);
  const closeness = (exercise: ExerciseDefinition) => (exercise.movementPattern && exercise.movementPattern === reference.movementPattern ? 10 : 0)
    + [...muscleWords(exercise)].filter((word) => sourceWords.has(word)).length * 2 + (exercise.targetMuscles[0] && reference.targetMuscles[0] && muscleWords({ ...exercise, targetMuscles: [exercise.targetMuscles[0]] }).has([...muscleWords({ ...reference, targetMuscles: [reference.targetMuscles[0]] })][0] ?? "") ? 1 : 0);
  const matching = (list: ExerciseDefinition[]) => rankSearchResults(list.filter((exercise) => exerciseSearchRank(exercise, query) !== null), query).map((item) => item.exercise);
  const others = query.trim()
    ? matching(usable)
    : [...usable].sort((a, b) => closeness(b) - closeness(a) || a.name.localeCompare(b.name));
  const needsEquipment = (query.trim() ? matching(pool) : pool).length - others.length;
  return { suggested, others, needsEquipment };
}

/** The plan with `sourceId` replaced by `replacement`, keeping its sets, reps and rest and remembering the original. */
export function swapInPlan(plan: WorkoutPlan, sourceId: string, replacement: ExerciseDefinition, reason?: string): WorkoutPlan {
  const source = plan.exercises.find((exercise) => exercise.id === sourceId);
  if (!source || plan.exercises.some((exercise) => exercise.id === replacement.id)) return plan;
  const why = reason ?? `${replacement.name} replaces ${source.name} (your choice).`;
  const swapped: ExerciseDefinition = {
    ...(getExerciseDefinition(replacement.id) ?? replacement),
    sets: source.sets, reps: source.reps, restSeconds: source.restSeconds,
    substitutedFor: source.substitutedFor ?? source.id, manualOverride: true, selectionReason: why,
  };
  return {
    ...plan,
    exercises: plan.exercises.map((exercise) => (exercise.id === sourceId ? swapped : exercise)),
    generationReasons: [...plan.generationReasons, why],
  };
}

/** The session with the swap applied; a started workout gets a fresh log for the new exercise. */
export function swapInSession(session: WorkoutSession, plan: WorkoutPlan, sourceId: string, replacement: ExerciseDefinition, reason?: string): WorkoutSession {
  const nextPlan = swapInPlan(plan, sourceId, replacement, reason);
  if (nextPlan === plan) return session;
  const swapped = nextPlan.exercises.find((exercise) => exercise.id === replacement.id)!;
  return {
    ...session,
    plan: nextPlan,
    exerciseLogs: session.status === "planned" ? session.exerciseLogs : session.exerciseLogs.map((log) => (log.exerciseId === sourceId ? createExerciseLog(swapped.id, swapped.sets, swapped.reps) : log)),
  };
}

// ---------- Finding what to swap from a sentence (Rozi) ----------

const GENERIC_WORDS = new Set(["barbell", "dumbbell", "machine", "cable", "seated", "standing", "bodyweight", "exercise", "the", "and", "with", "one", "arm", "supported"]);
const wordsOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter(Boolean).map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word));

/** The workout exercise a sentence names ("swap the bench press", "replace squats"), or null. */
export function findInWorkout(exercises: ExerciseDefinition[], text: string): ExerciseDefinition | null {
  const said = new Set(wordsOf(text));
  let best: ExerciseDefinition | null = null;
  let bestScore = 0;
  for (const exercise of exercises) {
    const parts = wordsOf(exercise.name).filter((word) => word.length > 2 && !GENERIC_WORDS.has(word));
    const hits = parts.filter((word) => said.has(word)).length;
    const score = parts.length ? hits / parts.length + hits * 0.01 : 0;
    if (hits && score > bestScore) { best = exercise; bestScore = score; }
  }
  return best;
}

export interface SwapSuggestion {
  /** Why nothing can be swapped ("rest-day": no workout that day). */
  blocked: SwapBlock | "rest-day" | null;
  /** The exercise to swap out, if one was named and found. */
  from: ExerciseDefinition | null;
  /** Up to 4 replacements for `from` (a named replacement first, when it's allowed). */
  options: ExerciseDefinition[];
  /** The workout's exercises (to pick from when none was named). */
  exercises: ExerciseDefinition[];
  /** A named replacement that this person can't use (equipment or trainer rule). */
  replacementNotAllowed: string | null;
}

/**
 * What Rozi offers for "I want to change my workout": the named exercise and replacements, or the list to pick from.
 * `workoutPlan` is the plan for that day (saved or as planned); `session` the saved session, if any.
 */
export function swapSuggestion(session: WorkoutSession | undefined, workoutPlan: WorkoutPlan | null, profile: Profile, request: { exercise?: string; replacement?: string }): SwapSuggestion {
  const exercises = session && session.status !== "planned" ? session.plan.exercises : workoutPlan?.exercises ?? [];
  if (!exercises.length) return { blocked: "rest-day", from: null, options: [], exercises: [], replacementNotAllowed: null };
  if (session?.status === "completed" || session?.status === "skipped") return { blocked: "completed", from: null, options: [], exercises, replacementNotAllowed: null };
  const from = request.exercise ? findInWorkout(exercises, request.exercise) : null;
  if (!from) return { blocked: null, from: null, options: [], exercises, replacementNotAllowed: null };
  const blocked = swapBlock(session, workoutPlan, from.id);
  // A named replacement: an exercise whose name matches, preferring one this person can do, then the shortest name.
  const wanted = request.replacement
    ? EXERCISE_LIBRARY.filter((exercise) => exerciseSearchRank(exercise, request.replacement!) === 0)
      .sort((a, b) => Number(canUseExercise(b, profile)) - Number(canUseExercise(a, profile)) || a.name.length - b.name.length)[0] ?? null
    : null;
  const wantedOk = wanted && wanted.id !== from.id && !exercises.some((exercise) => exercise.id === wanted.id) && canUseExercise(wanted, profile) ? wanted : null;
  const choices = swapChoices(from, profile, exercises);
  const options = [...(wantedOk ? [wantedOk] : []), ...choices.suggested, ...choices.others].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index).slice(0, 4);
  return { blocked, from, options: blocked ? [] : options, exercises, replacementNotAllowed: wanted && !wantedOk ? wanted.name : null };
}
