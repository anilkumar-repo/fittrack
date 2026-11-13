import assert from "node:assert/strict";
import test from "node:test";
import { missedDayHistory, missedDaySession, unexplainedMissedDays, validateMissedReason } from "./missed-days.ts";
import { generateWorkout } from "./planner.ts";
import { normalizeWorkoutSession } from "./workout-tracking.ts";
import type { Profile, WorkoutPlan, WorkoutSession } from "./types";

// Training on Tuesday, Thursday and Saturday. 2026-11-13 is a Friday.
const profile: Profile = {
  id: "c", displayName: "C", experience: "beginner", sessionsPerWeek: 3, trainingDays: [2, 4, 6], trainingStartDate: "2026-11-01",
  timeZone: "Asia/Kolkata", deadliftEnabled: false, trainerRole: false, preferredSessionMinutes: 40, equipmentAvailability: "unknown", availableEquipment: [],
};
const plan = (date: string) => generateWorkout({ date, profile, sessions: [] }) as WorkoutPlan;
const done = (date: string): WorkoutSession => ({ id: date, date, status: "completed", plan: plan(date), exerciseLogs: [] });

test("asks about planned days in the last week that have no workout and no reason", () => {
  assert.deepEqual(unexplainedMissedDays(profile, [], "2026-11-13"), ["2026-11-07", "2026-11-10", "2026-11-12"]);
  assert.deepEqual(unexplainedMissedDays(profile, [done("2026-11-10"), done("2026-11-12")], "2026-11-13"), ["2026-11-07"]);
  // A planned (not started) session is still a missed day.
  assert.deepEqual(unexplainedMissedDays(profile, [{ ...done("2026-11-12"), status: "planned" }, done("2026-11-10"), done("2026-11-07")], "2026-11-13"), ["2026-11-12"]);
});

test("never asks about today, rest days, days before the start, or older than a week", () => {
  assert.deepEqual(unexplainedMissedDays(profile, [], "2026-11-12"), ["2026-11-05", "2026-11-07", "2026-11-10"]);
  assert.deepEqual(unexplainedMissedDays({ ...profile, trainingStartDate: "2026-11-11" }, [], "2026-11-13"), ["2026-11-12"]);
  assert.deepEqual(unexplainedMissedDays(profile, [], "2026-11-30").every((date) => date >= "2026-11-23"), true);
});

test("a saved reason clears the day and appears in the history", () => {
  const skipped = missedDaySession("2026-11-12", plan("2026-11-12"), { reason: "busy", note: "  late meeting " });
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.missedReason?.note, "late meeting");
  assert.deepEqual(unexplainedMissedDays(profile, [skipped, done("2026-11-10"), done("2026-11-07")], "2026-11-13"), []);
  assert.deepEqual(missedDayHistory([skipped, done("2026-11-10")]).map((item) => item.entry.reason), ["busy"]);
  // The reason survives the normal load path.
  assert.equal(normalizeWorkoutSession(skipped)?.missedReason?.reason, "busy");
});

test("'something else' needs a short explanation", () => {
  assert.deepEqual(validateMissedReason({ reason: "busy", note: "" }), []);
  assert.equal(validateMissedReason({ reason: "other", note: " " }).length, 1);
  assert.deepEqual(validateMissedReason({ reason: "other", note: "Car broke down" }), []);
});

test("a missed day does not change the next plan's exercise choices", () => {
  const skipped = missedDaySession("2026-11-12", plan("2026-11-12"), { reason: "tired", note: "" });
  const withMiss = generateWorkout({ date: "2026-11-14", profile, sessions: [done("2026-11-10"), skipped] }) as WorkoutPlan;
  const without = generateWorkout({ date: "2026-11-14", profile, sessions: [done("2026-11-10")] }) as WorkoutPlan;
  assert.deepEqual(withMiss.exercises.map((exercise) => exercise.id), without.exercises.map((exercise) => exercise.id));
});
