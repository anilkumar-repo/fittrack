import assert from "node:assert/strict";
import test from "node:test";
import { generateWorkout } from "./planner.ts";
import { isRecoveryWeek, stageLabel, trainingWeek } from "./program.ts";
import { EQUIPMENT_OPTIONS, EXERCISE_LIBRARY, GOAL_CYCLES, getExerciseDefinition, getTemplateExercises } from "./templates.ts";
import type { EquipmentKey, Profile, WorkoutPlan, WorkoutSession } from "./types";

const ALL_EQUIPMENT = EQUIPMENT_OPTIONS.map((item) => item.id) as EquipmentKey[];
const gym: Profile = {
  id: "client", displayName: "Client", experience: "beginner", sessionsPerWeek: 6,
  trainingDays: [1, 2, 3, 4, 5, 6], trainingStartDate: "2026-11-02", timeZone: "Asia/Kolkata", deadliftEnabled: false,
  trainerRole: false, preferredSessionMinutes: 60, equipmentAvailability: "verified", availableEquipment: ALL_EQUIPMENT, goal: "muscle",
};

function done(plan: WorkoutPlan): WorkoutSession {
  return { id: plan.date, date: plan.date, status: "completed", plan, exerciseLogs: [] };
}

/** Plans each listed date in order, completing every workout. */
function run(profile: Profile, dates: string[]): WorkoutPlan[] {
  const sessions: WorkoutSession[] = [];
  return dates.map((date) => {
    const plan = generateWorkout({ date, profile, sessions }) as WorkoutPlan;
    sessions.push(done(plan));
    return plan;
  });
}

test("every template exercise and fallback exists in the library", () => {
  for (const cycle of Object.values(GOAL_CYCLES)) for (const focus of cycle) assert.ok(getTemplateExercises(focus).length >= 3, focus);
  for (const exercise of EXERCISE_LIBRARY) {
    if (exercise.fallbackId) assert.ok(getExerciseDefinition(exercise.fallbackId), `${exercise.id} → ${exercise.fallbackId}`);
  }
});

test("Build muscle rotates push, pull, legs across a six-day week", () => {
  const plans = run(gym, ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
  assert.deepEqual(plans.map((plan) => plan.focus), ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"]);
  assert.equal(plans[0].exercises[0].id, "barbell_bench");
  assert.equal(plans[0].exercises.length, 7);
  assert.ok(plans[0].exercises.every((exercise) => exercise.sets <= 3));
  assert.equal(plans[0].stage, "Foundation: set your working weights");
});

test("deadlift variations stay out until the trainer approves them", () => {
  const legs = run(gym, ["2026-11-02", "2026-11-03", "2026-11-04"])[2];
  assert.equal(legs.focus, "Legs A");
  assert.equal(legs.exercises.some((exercise) => /rdl|deadlift/i.test(exercise.id)), false);
  assert.ok(legs.exercises.some((exercise) => exercise.id === "hip_thrust" && exercise.substitutedFor === "dumbbell_rdl"));
  const approved = run({ ...gym, deadliftEnabled: true }, ["2026-11-02", "2026-11-03", "2026-11-04"])[2];
  assert.ok(approved.exercises.some((exercise) => exercise.id === "dumbbell_rdl"));
});

test("without confirmed equipment, programs fall back to bodyweight moves", () => {
  const home = { ...gym, equipmentAvailability: "unknown" as const, availableEquipment: [] };
  const push = generateWorkout({ date: "2026-11-02", profile: home, sessions: [] }) as WorkoutPlan;
  assert.ok(push.exercises.length > 0);
  assert.ok(push.exercises.every((exercise) => (exercise.requiredEquipment ?? []).length === 0));
});

test("every fourth week is lighter: conditioning for Build muscle, fewer sets for Get fit & toned", () => {
  assert.equal(trainingWeek("2026-11-02", "2026-11-23"), 4);
  assert.equal(isRecoveryWeek("muscle", 4), true);
  assert.equal(isRecoveryWeek("general", 4), false);
  assert.equal(stageLabel("muscle", 4), "Conditioning week");
  const week4 = run(gym, ["2026-11-23", "2026-11-24", "2026-11-25"]);
  assert.deepEqual(week4.map((plan) => plan.focus), ["Conditioning circuit", "Core and cardio", "Conditioning circuit"]);
  assert.equal(week4[0].recoveryWeek, true);

  const tone: Profile = { ...gym, goal: "tone", trainingDays: [1, 2, 4, 5], sessionsPerWeek: 4, trainingStartDate: "2026-10-05" };
  const normal = generateWorkout({ date: "2026-11-23", profile: { ...tone, trainingStartDate: "2026-10-26" }, sessions: [] }) as WorkoutPlan; // week 5
  const lighter = generateWorkout({ date: "2026-11-23", profile: { ...tone, trainingStartDate: "2026-10-05" }, sessions: [] }) as WorkoutPlan; // week 8
  assert.equal(normal.focus, "Lower A");
  assert.equal(lighter.recoveryWeek, true);
  const sets = (plan: WorkoutPlan) => plan.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  assert.ok(sets(lighter) < sets(normal));
});

test("Get fit & toned alternates lower and upper body and starts with two sets", () => {
  const tone: Profile = { ...gym, goal: "tone", trainingDays: [1, 2, 4, 5], sessionsPerWeek: 4 };
  const plans = run(tone, ["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"]);
  assert.deepEqual(plans.map((plan) => plan.focus), ["Lower A", "Upper A", "Lower B", "Upper B"]);
  assert.ok(plans[0].exercises.every((exercise) => exercise.sets <= 2));
  assert.ok(plans[3].exercises.some((exercise) => exercise.category === "core"));
});

test("the general goal keeps the original full-body rotation", () => {
  const plan = generateWorkout({ date: "2026-11-03", profile: { ...gym, goal: "general", trainingDays: [2, 4, 6] }, sessions: [] }) as WorkoutPlan;
  assert.equal(plan.focus, "Foundation A");
  assert.equal(plan.goal, undefined);
});

test("Lose weight mixes full-body strength, steady cardio and intervals", () => {
  const fatloss: Profile = { ...gym, goal: "fatloss", trainingDays: [1, 2, 4, 5], sessionsPerWeek: 4 };
  const plans = run(fatloss, ["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"]);
  assert.deepEqual(plans.map((plan) => plan.focus), ["Burn A", "Cardio and core", "Burn B", "Intervals and core"]);
  assert.ok(plans[0].exercises.some((exercise) => exercise.id === "hip_thrust" && exercise.substitutedFor === "dumbbell_rdl"));
  assert.ok(plans[1].exercises.some((exercise) => exercise.id === "easy_cardio"));
  assert.ok(plans[3].exercises.some((exercise) => exercise.id === "interval_cardio"));
  assert.match(plans[0].description, /calorie deficit/);
  assert.ok(plans[0].exercises.every((exercise) => exercise.sets <= 2));
});
