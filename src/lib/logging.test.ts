import assert from "node:assert/strict";
import test from "node:test";
import { describeLastPerformance, displayToKg, formatCountdown, formatWeight, kgToDisplay, lastLoadKg, lastPerformance } from "./logging.ts";
import { generateWorkout } from "./planner.ts";
import { createDemoState } from "./demo-data.ts";
import type { ExerciseLog, WorkoutSession } from "./types";

const profile = { ...createDemoState().profile, trainingDays: [2, 4, 6] };

function sessionOn(date: string, status: WorkoutSession["status"], sets: ExerciseLog["sets"]): WorkoutSession {
  const plan = generateWorkout({ date, profile, sessions: [] });
  assert.ok(plan);
  const exerciseId = plan.exercises[0].id;
  return { id: date, date, status, plan, exerciseLogs: [{ exerciseId, plannedSets: 2, plannedReps: 8, status: "completed", substitutionName: "", formQuality: "sound", notes: "", sets }] };
}
const done = (reps: number, loadKg: number | null) => ({ plannedReps: 8, actualReps: reps, loadKg, completed: true, extra: false });

test("pounds entered by a person survive the round trip through stored kilograms", () => {
  for (const pounds of [2.5, 5, 12.5, 25, 45, 135, 222.5]) assert.equal(kgToDisplay(displayToKg(pounds, "lb"), "lb"), pounds);
  assert.equal(displayToKg(12.5, "kg"), 12.5);
  assert.equal(formatWeight(20, "lb"), "44.1 lb");
  assert.equal(formatWeight(12.5, "kg"), "12.5 kg");
});

test("finds the most recent earlier completed sets and ignores planned, later, and empty sessions", () => {
  const older = sessionOn("2026-11-03", "completed", [done(8, 10), done(8, 10)]);
  const recent = sessionOn("2026-11-05", "completed", [done(10, 12.5), done(9, 12.5), { plannedReps: 8, actualReps: null, loadKg: null, completed: false, extra: false }]);
  const plannedOnly = sessionOn("2026-11-07", "planned", [done(20, 50)]);
  const later = sessionOn("2026-11-12", "completed", [done(30, 60)]);
  const exerciseId = older.exerciseLogs[0].exerciseId;
  const last = lastPerformance(exerciseId, [older, later, plannedOnly, recent], "2026-11-10");
  assert.equal(last?.date, "2026-11-05");
  assert.deepEqual(last?.sets, [{ reps: 10, loadKg: 12.5 }, { reps: 9, loadKg: 12.5 }]);
  assert.equal(lastPerformance("not-an-exercise", [older], "2026-11-10"), null);
  assert.equal(lastPerformance(exerciseId, [older], "2026-11-03"), null);
});

test("describes last time in the chosen unit without inventing a load", () => {
  assert.equal(describeLastPerformance({ date: "2026-11-05", sets: [{ reps: 10, loadKg: 12.5 }, { reps: 9, loadKg: 12.5 }] }, "kg"), "10, 9 reps · 12.5 kg");
  assert.equal(describeLastPerformance({ date: "2026-11-05", sets: [{ reps: 10, loadKg: null }, { reps: 10, loadKg: null }] }, "kg"), "10, 10 reps");
  assert.equal(describeLastPerformance({ date: "2026-11-05", sets: [{ reps: 10, loadKg: 20 }, { reps: 8, loadKg: null }] }, "lb"), "10 × 44.1 lb, 8 reps");
  assert.equal(lastLoadKg({ date: "2026-11-05", sets: [{ reps: 10, loadKg: 10 }, { reps: 8, loadKg: 12.5 }] }), 12.5);
  assert.equal(lastLoadKg({ date: "2026-11-05", sets: [{ reps: 10, loadKg: null }] }), null);
  assert.equal(lastLoadKg(null), null);
});

test("formats the rest countdown", () => {
  assert.equal(formatCountdown(90), "1:30");
  assert.equal(formatCountdown(4.2), "0:05");
  assert.equal(formatCountdown(-3), "0:00");
});
