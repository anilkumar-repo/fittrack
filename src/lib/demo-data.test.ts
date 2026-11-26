import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState, defaultDisplayName, isBuiltInDemoExample, localTimeZone, readDemoState, todayInTimeZone, writeDemoState } from "./demo-data.ts";
import { generateWorkout } from "./planner.ts";
import { createExerciseLog } from "./workout-tracking.ts";
import type { WorkoutSession } from "./types";

test("a new demo profile starts without invented completed workouts", () => {
  const state = createDemoState();
  assert.deepEqual(state.sessions, []);
  assert.deepEqual(state.bodyWeightEntries, []);
});

test("recognizes only the old built-in demo fixtures, not user-entered sessions", () => {
  const { profile } = createDemoState();
  const date = "2026-10-27";
  const plan = generateWorkout({ date, profile, sessions: [] });
  assert.ok(plan);
  const session: WorkoutSession = {
    id: `demo-${date}`, date, status: "completed", plan,
    exerciseLogs: plan.exercises.map((exercise) => {
      const log = createExerciseLog(exercise.id, exercise.sets, exercise.reps);
      return { ...log, status: "completed", sets: log.sets.map((set) => ({ ...set, actualReps: set.plannedReps, completed: true })) };
    }),
    checkIn: { energy: 4, soreness: 1, pain: false, recovery: 4, discomfort: "", note: "" },
    review: { effort: 6, mood: "better", energyAfter: 3, discomfort: false, discomfortNote: "", note: "A good steady session." },
    completedAt: `${date}T10:00:00.000Z`,
  };
  assert.equal(isBuiltInDemoExample(session), true);
  assert.equal(isBuiltInDemoExample({ ...session, review: { ...session.review!, note: "My workout" } }), false);
});

test("a new account gets a name from its email and a usable local time zone, never the demo persona", () => {
  assert.equal(defaultDisplayName("priya.sharma92@example.com"), "Priya");
  assert.equal(defaultDisplayName("a_kumar@example.com"), "Kumar");
  assert.equal(defaultDisplayName(undefined), "Friend");
  assert.match(todayInTimeZone(localTimeZone()), /^\d{4}-\d{2}-\d{2}$/);
});

test("data saved only on this device always loads with deadlifts locked (they need a trainer on an account)", () => {
  const store = new Map<string, string>();
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) } };
  try {
    const saved = createDemoState();
    writeDemoState({ ...saved, profile: { ...saved.profile, deadliftEnabled: true } });
    assert.equal(readDemoState()?.profile.deadliftEnabled, false);
  } finally {
    (globalThis as { window?: unknown }).window = original;
  }
});
