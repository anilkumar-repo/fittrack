import assert from "node:assert/strict";
import test from "node:test";
import { EXERCISE_LIBRARY, GOAL_CYCLES, getExerciseDefinition, getTemplateExercises, type TemplateFocus } from "./templates.ts";
import { unitFromReps } from "./exercise-taxonomy.ts";
import { formatAmount, isLifting, trackingOf, usesLoad } from "./tracking.ts";
import { exerciseHistory } from "./pro-tracking.ts";
import { calculatePersonalRecords } from "./progress.ts";
import { weeklyReport } from "./recovery.ts";
import { normalizeWorkoutSession } from "./workout-tracking.ts";
import type { ExerciseLog, WorkoutSession } from "./types.ts";

// R5: time and distance tracking. A set's number means reps, seconds, minutes or rounds depending on the exercise.

test("every exercise has a tracking unit that matches its reps text", () => {
  for (const exercise of EXERCISE_LIBRARY) {
    assert.ok(exercise.tracking, `${exercise.id} needs tracking`);
    assert.equal(exercise.tracking.unit, unitFromReps(exercise.reps), `${exercise.id}: "${exercise.reps}"`);
  }
  assert.deepEqual(getExerciseDefinition("floor_plank")?.tracking, { unit: "seconds" });
  assert.deepEqual(getExerciseDefinition("farmer_carry")?.tracking, { unit: "seconds" });
  assert.deepEqual(getExerciseDefinition("comfortable_walk")?.tracking, { unit: "minutes", distance: true });
  assert.deepEqual(getExerciseDefinition("easy_cardio")?.tracking, { unit: "minutes", distance: true });
  assert.deepEqual(getExerciseDefinition("interval_cardio")?.tracking, { unit: "rounds" });
  assert.deepEqual(getExerciseDefinition("barbell_bench")?.tracking, { unit: "reps" });
});

test("every workout template uses the same unit as the exercise (so stored numbers keep one meaning)", () => {
  const focuses = new Set<TemplateFocus>(Object.values(GOAL_CYCLES).flat());
  for (const focus of focuses) {
    for (const exercise of getTemplateExercises(focus)) {
      assert.equal(unitFromReps(exercise.reps), exercise.tracking?.unit, `${focus}: ${exercise.id} "${exercise.reps}"`);
    }
  }
});

test("labels and rules per unit", () => {
  assert.equal(formatAmount(30, "seconds"), "30 sec");
  assert.equal(formatAmount(25, "minutes"), "25 min");
  assert.equal(formatAmount(1, "rounds"), "1 round");
  assert.equal(formatAmount(10, "reps"), "10 reps");
  assert.ok(usesLoad({ unit: "seconds" }) && !usesLoad({ unit: "minutes" }) && !usesLoad({ unit: "rounds" }));
  assert.ok(isLifting({ unit: "reps" }) && !isLifting({ unit: "seconds" }));
  // Old saved copies without `tracking` fall back to the library, then to reps.
  assert.equal(trackingOf({ id: "floor_plank" }).unit, "seconds");
  assert.equal(trackingOf("not_an_exercise").unit, "reps");
});

function log(exerciseId: string, sets: Array<{ reps: number; kg?: number | null; km?: number }>): ExerciseLog {
  return { exerciseId, plannedSets: sets.length, plannedReps: sets[0]?.reps ?? 1, status: "completed", substitutionName: "", formQuality: "not_rated", notes: "",
    sets: sets.map((set) => ({ plannedReps: set.reps, actualReps: set.reps, loadKg: set.kg ?? null, completed: true, extra: false, ...(set.km !== undefined ? { distanceKm: set.km } : {}) })) };
}

function session(date: string, logs: ExerciseLog[]): WorkoutSession {
  return { id: date, date, status: "completed", plan: { exercises: logs.map((item) => getExerciseDefinition(item.exerciseId)!) }, exerciseLogs: logs } as unknown as WorkoutSession;
}

test("timed sets stay out of lifting maths: no 1RM, no volume, no load records, no reps in the weekly total", () => {
  const sessions = [session("2026-11-17", [
    log("farmer_carry", [{ reps: 40, kg: 24 }, { reps: 40, kg: 24 }]),
    log("floor_plank", [{ reps: 60 }]),
    log("dumbbell_bench", [{ reps: 10, kg: 20 }]),
  ])];
  const carry = exerciseHistory(sessions, "farmer_carry")[0];
  assert.equal(carry.unit, "seconds");
  assert.equal(carry.oneRepMax, null);
  assert.equal(carry.volumeKg, 0);
  const bench = exerciseHistory(sessions, "dumbbell_bench")[0];
  assert.equal(bench.volumeKg, 200);
  assert.ok(bench.oneRepMax);
  assert.deepEqual(calculatePersonalRecords(sessions).map((record) => record.exerciseId), ["dumbbell_bench"]);
  const report = weeklyReport({ trainingDays: [1, 3, 5], trainingStartDate: "2026-11-01", sessionsPerWeek: 3 }, sessions, "2026-11-17", "2026-11-23");
  assert.equal(report.sets, 4, "timed sets still count as sets");
  assert.equal(report.reps, 10, "only the bench reps");
  assert.equal(report.volumeKg, 200);
});

test("distance is kept in history and survives loading a saved session", () => {
  const walk = [session("2026-11-18", [log("comfortable_walk", [{ reps: 25, km: 2.4 }])])];
  assert.equal(exerciseHistory(walk, "comfortable_walk")[0].sets[0].distanceKm, 2.4);
  const loaded = normalizeWorkoutSession(JSON.parse(JSON.stringify(walk[0])));
  assert.equal(loaded?.exerciseLogs[0].sets[0].distanceKm, 2.4);
});
